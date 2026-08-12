import { execFile as execFileCallback } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  hasUnsanitizedEvidenceOutput,
  resolveG12EvidenceIdentity,
  verifyEvidence,
} from '../../tooling/audits/repository-policy/src/evidence-verify.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import { nativeThemeProjection } from '../../packages/react-native/generated/native-themes.mjs';
import {
  G12_APPLICABILITY_PATHS,
  G12_ASSERTIONS,
  G12_COMMANDS,
  G12_CONTINUITY_PROFILE,
  G12_DISCLOSURE_CLASS,
  G12_EVIDENCE_KINDS,
  G12_EXPECTED_TEST_NAMES,
  G12_EXPIRY,
  G12_MAINTENANCE_ROOT,
  G12_RETENTION,
  G12_RESULT_KEYS,
  G12_RETAINED_RESULT_INDEXES,
  G12_ROOT,
  assertG12MaintenanceRootDirectory,
  assertG12RootDirectory,
  assertG12SourceTopology,
  createG12ApplicabilityProfile,
  createG12Facts,
  directoryManifest,
  pathManifestAtRevision,
  proofFileReferences,
  sha256Bytes,
} from './g1.2-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const DECISION_PATH = 'decisions/0008-g1-2-applicability-continuity.json';
const RECEIPT_PATH = 'decisions/0008-g1-2-applicability-continuity-acceptance.json';
const ROOTS = Object.freeze([G12_MAINTENANCE_ROOT, G12_ROOT]);
const JOURNAL = 'tests/evidence/.g1-2-transaction.json';
const LOCK = 'tests/evidence/.g1-2-transaction.lock';
const TRANSACTION_PROFILE = 'core-ui-g1-2-evidence-transaction-v1';
const LOCK_PROFILE = 'core-ui-g1-2-transaction-lock-v1';

function prefixed(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function normalizeOutput(value, root) {
  return value
    .replaceAll(`/private${root}`, '<repository>')
    .replaceAll(root, '<repository>')
    .replace(/\/private\/var\/folders\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\((?:\d+\.)?\d+ms\)/gu, '(duration)')
    .replace(/duration_ms (?:\d+\.)?\d+/gu, 'duration_ms <duration>')
    .replace(/Done in [^\n]+/gu, 'Done in <duration>')
    .replace(/Took: [^\n]+/gu, 'Took: <duration>')
    .replace(/Time: +[^\n]+/gu, 'Time: <duration>')
    .replace(/Ran all test suites[^\n]*/gu, 'Ran all test suites')
    .replace(/\r\n/gu, '\n');
}

async function run(command, args, cwd) {
  try {
    const result = await execFile(command, args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      maxBuffer: 128 * 1024 * 1024,
    });
    const output = normalizeOutput(result.stdout + result.stderr, cwd);
    if (hasUnsanitizedEvidenceOutput(output, cwd)) throw new Error('G12_CAPTURE_PRIVATE_OUTPUT');
    return { command: [command, ...args].join(' '), exitState: 0, output };
  } catch (error) {
    if (error.message === 'G12_CAPTURE_PRIVATE_OUTPUT') throw error;
    const output = normalizeOutput(`${error.stdout ?? ''}${error.stderr ?? ''}`, cwd);
    throw new Error(`G12_CAPTURE_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
  }
}

async function git(cwd, ...args) {
  return (await run('git', args, cwd)).output.trim();
}

async function exists(path) {
  return stat(path).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

async function syncDirectory(path) {
  const directory = await open(path, 'r');
  await directory.sync();
  await directory.close();
}

async function syncTree(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await syncTree(child);
    else if (entry.isFile()) {
      const file = await open(child, 'r');
      await file.sync();
      await file.close();
    } else throw new Error('G12_CAPTURE_STAGED_ENTRY_INVALID');
  }
  await syncDirectory(path);
}

function assertLockValue(value, profile) {
  const expectedKeys = ['pid', 'processStart', 'profile', 'token'];
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson(expectedKeys)
    || value.profile !== profile || !Number.isSafeInteger(value.pid) || value.pid <= 0
    || typeof value.processStart !== 'string' || value.processStart.trim() === ''
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value.token)) {
    throw new Error('G12_CAPTURE_TRANSACTION_LOCK_INVALID');
  }
  return value;
}

async function processIncarnation(pid) {
  try {
    return (await execFile('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' })).stdout.trim() || null;
  } catch (error) {
    if (error?.code === 1) return null;
    throw error;
  }
}

async function createOwnedLock(path, profile, { openLock = open, syncParent = syncDirectory } = {}) {
  const value = {
    pid: process.pid,
    processStart: await processIncarnation(process.pid),
    profile,
    token: randomUUID(),
  };
  let handle;
  try {
    handle = await openLock(path, 'wx');
    await handle.writeFile(canonicalJson(value));
    await handle.sync();
    await syncParent(dirname(path));
    return { handle, path, value };
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
      await rm(path, { force: true }).catch(() => {});
      await syncParent(dirname(path)).catch(() => {});
    }
    throw error;
  }
}

async function releaseOwnedLock(lock) {
  await lock.handle.close();
  const current = assertLockValue(parseJsonStrict(await readFile(lock.path, 'utf8')), lock.value.profile);
  if (canonicalJson(current) !== canonicalJson(lock.value)) {
    throw new Error('G12_CAPTURE_TRANSACTION_LOCK_OWNERSHIP_LOST');
  }
  await rm(lock.path);
  await syncDirectory(dirname(lock.path));
}

export async function acquireG12TransactionLock(lockPath, dependencies) {
  await mkdir(dirname(lockPath), { recursive: true });
  try {
    return await createOwnedLock(lockPath, LOCK_PROFILE, dependencies);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const observed = assertLockValue(parseJsonStrict(await readFile(lockPath, 'utf8')), LOCK_PROFILE);
    const currentIncarnation = await processIncarnation(observed.pid);
    if (currentIncarnation === observed.processStart) throw new Error('G12_CAPTURE_TRANSACTION_LOCKED');
    throw new Error(
      `G12_CAPTURE_STALE_LOCK_RECOVERY_REQUIRED: token=${observed.token}; pid=${observed.pid}; processStart=${observed.processStart}`,
    );
  }
}

async function writeCanonical(root, relativePath, value) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  const bytes = canonicalJson(value);
  await writeFile(destination, bytes);
  return bytes;
}

async function readJson(root, relativePath) {
  const bytes = await readFile(join(root, relativePath), 'utf8');
  return { bytes, value: parseJsonStrict(bytes) };
}

export function parseG12CaptureArguments(args) {
  const check = args.includes('--check');
  const values = args.filter((value) => value !== '--check');
  if (values.length !== 6) throw new Error('G12_CAPTURE_ARGUMENT_INVALID');
  const output = {};
  for (let position = 0; position < values.length; position += 2) {
    const key = values[position];
    const value = values[position + 1];
    if (!['--source', '--tree', '--timestamp'].includes(key) || Object.hasOwn(output, key) || value?.startsWith('--')) {
      throw new Error('G12_CAPTURE_ARGUMENT_INVALID');
    }
    output[key] = value;
  }
  if (!/^[0-9a-f]{40}$/u.test(output['--source'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(output['--tree'] ?? '')
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(output['--timestamp'] ?? '')) {
    throw new Error('G12_CAPTURE_ARGUMENT_REQUIRED');
  }
  return { check, sourceRevision: output['--source'], sourceTree: output['--tree'], timestamp: output['--timestamp'] };
}

function assertTimestamp(timestamp, sourceCommitTime, acceptanceTime, now = new Date()) {
  const observed = new Date(timestamp);
  if (Number.isNaN(observed.valueOf()) || observed.toISOString().replace('.000Z', 'Z') !== timestamp
    || observed < new Date(sourceCommitTime) || observed < new Date(acceptanceTime) || observed > now) {
    throw new Error('G12_CAPTURE_TIMESTAMP_INVALID');
  }
}

async function environment(root) {
  const [node, pnpm, gitVersion, architecture, product, build] = await Promise.all([
    run('node', ['--version'], root),
    run('pnpm', ['--version'], root),
    run('git', ['--version'], root),
    run('uname', ['-m'], root),
    run('sw_vers', ['-productVersion'], root),
    run('sw_vers', ['-buildVersion'], root),
  ]);
  return {
    architecture: architecture.output.trim(),
    git: gitVersion.output.trim().replace(/^git version /u, ''),
    node: node.output.trim(),
    pnpm: pnpm.output.trim(),
    runnerImage: `local-macos-${product.output.trim()}`,
    runnerImageVersion: build.output.trim(),
    runnerOs: `macOS ${product.output.trim()}`,
  };
}

export function parseG12JestReport(output) {
  const reports = output.split('\n').filter((line) => line.startsWith('{"numFailedTestSuites"'));
  if (reports.length !== 1) throw new Error('G12_CAPTURE_JEST_JSON_AMBIGUOUS');
  return parseJsonStrict(reports[0]);
}

async function runValidation(root) {
  const commands = [
    ['node', ['--test', 'tests/evidence/g1.2-profile.test.mjs']],
    ['pnpm', ['--filter', '@core-ui/react-native', 'check']],
    ['pnpm', ['--filter', '@core-ui/react-native', 'exec', 'jest', '--config', 'test/jest.config.cjs', '--runInBand', '--json']],
    ['pnpm', ['generate:check']],
    ['node', ['tooling/audits/repository-policy/src/g1-2-applicability-continuity-verify.mjs']],
  ];
  const results = [];
  for (const [position, [command, args]] of commands.entries()) {
    const result = await run(command, args, root);
    if (position === 2) {
      const report = parseG12JestReport(result.output);
      result.output = canonicalJson({
        assertions: report.testResults.flatMap(({ assertionResults }) => assertionResults.map(({ fullName, status }) => ({ fullName, status }))),
        failedSuites: report.numFailedTestSuites,
        failedTests: report.numFailedTests,
        passedSuites: report.numPassedTestSuites,
        passedTests: report.numPassedTests,
        success: report.success,
      });
    }
    results.push(result);
  }
  if (canonicalJson(results.map(({ command }) => command)) !== canonicalJson(G12_COMMANDS)) {
    throw new Error('G12_CAPTURE_COMMAND_SET_INVALID');
  }
  return results;
}

function assertExpectedTests(packageOutput, jestOutput) {
  for (const [assertion, names] of Object.entries(G12_EXPECTED_TEST_NAMES)) {
    for (const name of names) {
      const output = assertion === 'E-G1.2-02' ? jestOutput : packageOutput;
      const count = output.split(name).length - 1;
      if (count !== 1) throw new Error(`G12_CAPTURE_TEST_NAME_INVALID: ${assertion} ${name} ${count}`);
    }
  }
}

async function createMaintenance(root, outputRoot, sourceRevision, sourceTree, decision, receipt) {
  const references = [];
  for (const target of decision.continuityTopology.targets) {
    const predecessor = await readJson(root, target.predecessor.path);
    if (prefixed(predecessor.bytes) !== target.predecessor.sha256) throw new Error('G12_CAPTURE_PREDECESSOR_DRIFT');
    const current = await pathManifestAtRevision(root, sourceRevision, target.predecessorCurrentApplicabilityManifest.paths);
    if (current.sha256 === target.predecessorCurrentApplicabilityManifest.sha256) {
      throw new Error('G12_CAPTURE_MANIFEST_UNCHANGED');
    }
    const certificate = {
      affectedAssertions: target.affectedAssertions,
      authorization: { path: RECEIPT_PATH, sha256: prefixed(receipt.bytes) },
      currentApplicabilityManifest: current,
      disclosureClass: G12_DISCLOSURE_CLASS,
      effectiveAt: receipt.value.updatedAt,
      evidenceStatus: 'superseded',
      historicalIndex: target.historicalIndex,
      owner: 'ndrewtran',
      previousSupersession: target.predecessor,
      reasonCode: 'governing-authority-changed',
      replacementPlan: target.replacementPlan,
      replacementStatus: 'pending',
      schema: 'core-ui-evidence-applicability-supersession-v1',
      sourceRevision,
      sourceTree,
      supersededApplicabilityManifest: target.predecessorCurrentApplicabilityManifest,
    };
    const relative = target.successorPath.replace(`${G12_MAINTENANCE_ROOT}/`, '');
    const bytes = await writeCanonical(outputRoot, relative, certificate);
    references.push({ milestone: target.milestone, path: target.successorPath, sha256: prefixed(bytes) });
  }
  if (references.length !== 28) throw new Error('G12_CAPTURE_SUCCESSOR_COUNT_INVALID');
  await writeCanonical(outputRoot, 'index.json', {
    records: [],
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    supersessions: references,
  });
}

async function createEvidence(root, outputRoot, { sourceRevision, sourceTree, timestamp }, results, env) {
  const fixture = parseJsonStrict(await readFile(join(root, 'tests/fixtures/g1.2/platform-safety-native.json'), 'utf8'));
  const packageManifest = parseJsonStrict(await readFile(join(root, 'packages/react-native/package.json'), 'utf8'));
  const manifest = await pathManifestAtRevision(root, sourceRevision, G12_APPLICABILITY_PATHS);
  const profile = createG12ApplicabilityProfile({
    manifest,
    proofFiles: await proofFileReferences(root, sourceRevision),
    sourceRevision,
    sourceTree,
  });
  const facts = createG12Facts({ fixture, nativeProjection: nativeThemeProjection, packageManifest });
  assertExpectedTests(results[1].output, results[2].output);
  const captureProcedure = `node tests/evidence/capture-g1.2.mjs --source ${sourceRevision} --tree ${sourceTree} --timestamp ${timestamp}`;
  for (const [position, result] of results.entries()) {
    await writeFile(join(outputRoot, 'validation', `${G12_RESULT_KEYS[position]}.txt`), result.output);
  }
  const validation = {
    applicabilityProfile: profile,
    captureProcedure,
    environment: env,
    executedRevision: sourceRevision,
    executedTree: sourceTree,
    results: results.map((result, position) => ({
      command: result.command,
      exitState: result.exitState,
      rawOutput: {
        path: `${G12_ROOT}/validation/${G12_RESULT_KEYS[position]}.txt`,
        sha256: prefixed(result.output),
      },
    })),
    schema: 'core-ui-evidence-validation-v1',
    sourceRevision,
    sourceTree,
  };
  const validationBytes = await writeCanonical(outputRoot, 'validation.json', validation);
  const validationRef = { path: `${G12_ROOT}/validation.json`, sha256: prefixed(validationBytes) };
  const records = [];
  for (const assertionId of G12_ASSERTIONS) {
    const retainedIndexes = G12_RETAINED_RESULT_INDEXES[assertionId];
    const artifact = {
      applicabilityManifest: manifest,
      applicabilityProfile: profile,
      assertionId,
      captureTimestamp: timestamp,
      command: retainedIndexes.map((position) => results[position].command).join(' && '),
      environment: env,
      evidenceKind: G12_EVIDENCE_KINDS[assertionId],
      executedRevision: sourceRevision,
      executedTree: sourceTree,
      exitState: 0,
      observations: {
        facts: facts[assertionId],
        retainedResults: retainedIndexes.map((position) => ({
          command: results[position].command,
          outputSha256: prefixed(results[position].output),
        })),
        testNames: G12_EXPECTED_TEST_NAMES[assertionId],
      },
      outcome: 'pass',
      schema: 'core-ui-evidence-artifact-v1',
      sourceRevision,
      sourceTree,
    };
    const artifactBytes = await writeCanonical(outputRoot, `artifacts/${assertionId}.json`, artifact);
    const record = {
      activeExceptionRefs: [],
      advisoryRefs: [],
      applicabilityManifest: manifest,
      applicabilityProfile: profile,
      artifact: { path: `${G12_ROOT}/artifacts/${assertionId}.json`, sha256: prefixed(artifactBytes) },
      assertionId,
      captureTimestamp: timestamp,
      command: artifact.command,
      disclosureClass: G12_DISCLOSURE_CLASS,
      environment: env,
      evidenceKind: G12_EVIDENCE_KINDS[assertionId],
      executedRevision: sourceRevision,
      executedTree: sourceTree,
      expiry: G12_EXPIRY,
      milestone: 'G1.2',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: G12_RETENTION,
      schema: 'core-ui-evidence-record-v1',
      sourceRevision,
      sourceTree,
      validation: validationRef,
    };
    const recordBytes = await writeCanonical(outputRoot, `records/${assertionId}.json`, record);
    records.push({ assertionId, path: `${G12_ROOT}/records/${assertionId}.json`, sha256: prefixed(recordBytes) });
  }
  await writeCanonical(outputRoot, 'index.json', {
    records,
    recertifications: [],
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    supersessions: [],
    validation: validationRef,
  });
}

export async function materializeG12Transactionally({
  repository = repositoryRoot,
  build,
  afterPublish = async () => {},
  afterEachMaterialization = async () => {},
  syncStagedTree = syncTree,
  renamePath = rename,
}) {
  const lockPath = join(repository, LOCK);
  const lock = await acquireG12TransactionLock(lockPath);
  const journalPath = join(repository, JOURNAL);
  try {
    if (await exists(journalPath)) {
    const journal = parseJsonStrict(await readFile(journalPath, 'utf8'));
    const expectedKeys = ['profile', 'roots', 'transactionPath'];
    if (canonicalJson(Object.keys(journal).sort()) !== canonicalJson(expectedKeys.sort())
      || journal.profile !== TRANSACTION_PROFILE
      || canonicalJson(journal.roots) !== canonicalJson(ROOTS)
      || typeof journal.transactionPath !== 'string'
      || !/^tests\/\.g1-2-transaction-[A-Za-z0-9_-]+$/u.test(journal.transactionPath)) {
      throw new Error('G12_CAPTURE_JOURNAL_INVALID');
    }
    for (const relative of ROOTS) await rm(join(repository, relative), { recursive: true, force: true });
    await rm(join(repository, journal.transactionPath), { recursive: true, force: true });
    await rm(journalPath, { force: true });
    }
    for (const relative of ROOTS) {
      if (await exists(join(repository, relative))) throw new Error(`G12_CAPTURE_TARGET_EXISTS: ${relative}`);
    }
    const transaction = await mkdtemp(join(repository, 'tests', '.g1-2-transaction-'));
    const staged = [join(transaction, 'maintenance'), join(transaction, 'g1.2')];
    const finals = ROOTS.map((relative) => join(repository, relative));
    const transactionPath = transaction.slice(repository.length + 1);
    await Promise.all(staged.map((path) => mkdir(path, { recursive: true })));
    try {
    await build(staged);
    for (const path of staged) await syncStagedTree(path);
    const journal = await open(journalPath, 'wx');
    await journal.writeFile(canonicalJson({
      profile: TRANSACTION_PROFILE,
      roots: ROOTS,
      transactionPath,
    }));
    await journal.sync();
    await journal.close();
    await syncDirectory(dirname(journalPath));
    for (let index = 0; index < staged.length; index += 1) {
      await mkdir(dirname(finals[index]), { recursive: true });
      await renamePath(staged[index], finals[index]);
      await syncDirectory(dirname(finals[index]));
      await afterEachMaterialization({ index, journalPath, materialized: ROOTS.slice(0, index + 1) });
    }
    await rm(transaction, { recursive: true, force: true });
    await afterPublish({ journalPath });
    await rm(journalPath, { force: true });
    await syncDirectory(dirname(journalPath));
    } catch (error) {
    if (error?.code === 'G12_SIMULATED_PROCESS_INTERRUPTION') throw error;
    const rollback = await mkdtemp(join(repository, 'tests', '.g1-2-rollback-'));
    const failures = [];
    for (let index = 0; index < finals.length; index += 1) {
      if (!await exists(finals[index])) continue;
      try {
        await renamePath(finals[index], join(rollback, String(index)));
      } catch (rollbackError) {
        failures.push(`${ROOTS[index]}: ${rollbackError.message}`);
        await rm(finals[index], { recursive: true, force: true });
      }
    }
    const residual = [];
    for (let index = 0; index < finals.length; index += 1) if (await exists(finals[index])) residual.push(ROOTS[index]);
    await rm(transaction, { recursive: true, force: true });
    await rm(rollback, { recursive: true, force: true });
    await rm(journalPath, { force: true });
    if (failures.length > 0 || residual.length > 0) {
      throw new Error(
        `G12_CAPTURE_ROLLBACK_INTEGRITY: original=${error.message}; failures=${failures.join(' | ') || 'none'}; residual=${residual.join(',') || 'none'}`,
        { cause: error },
      );
    }
      throw error;
    }
  } finally {
    await releaseOwnedLock(lock);
  }
}

async function assertFrozenSource(root, sourceRevision, sourceTree, allowEvidenceChild) {
  await assertG12SourceTopology(root, sourceRevision, sourceTree);
  const head = await git(root, 'rev-parse', 'HEAD');
  if (head !== sourceRevision) {
    const evidenceIdentity = allowEvidenceChild
      ? await resolveG12EvidenceIdentity(root, head).catch(() => null)
      : null;
    if (!evidenceIdentity
      || evidenceIdentity.sourceRevision !== sourceRevision
      || evidenceIdentity.sourceTree !== sourceTree) {
      throw new Error('G12_CAPTURE_SOURCE_HEAD_INVALID');
    }
  }
}

export async function captureG12(root, options) {
  await assertFrozenSource(root, options.sourceRevision, options.sourceTree, options.check);
  const decision = await readJson(root, DECISION_PATH);
  const receipt = await readJson(root, RECEIPT_PATH);
  if (prefixed(decision.bytes) !== 'sha256:91181e70d5a6239e4eaa48d759a31af2c14422964d475af1917d005783b752af'
    || prefixed(receipt.bytes) !== 'sha256:5f0ce9837775f508bf1453f201df74b5972444801f4cee283bbdc8a67f27bc7a'
    || decision.value.continuityTopology.captureProfile !== G12_CONTINUITY_PROFILE) {
    throw new Error('G12_CAPTURE_AUTHORITY_INVALID');
  }
  const sourceCommitTime = await git(root, 'show', '-s', '--format=%cI', options.sourceRevision);
  assertTimestamp(options.timestamp, sourceCommitTime, receipt.value.updatedAt);
  const results = await runValidation(root);
  const env = await environment(root);
  if (options.check) {
    for (const relative of ROOTS) await access(join(root, relative));
    await assertG12RootDirectory(root, G12_ROOT, options);
    await assertG12MaintenanceRootDirectory(root, G12_MAINTENANCE_ROOT, options);
    await run('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], root);
    return { checked: true, records: 5, successors: 28 };
  }
  const status = await git(root, 'status', '--porcelain');
  if (status !== '') throw new Error('G12_CAPTURE_WORKTREE_DIRTY');
  await materializeG12Transactionally({
    repository: root,
    build: async ([maintenanceRoot, evidenceRoot]) => {
      await createMaintenance(root, maintenanceRoot, options.sourceRevision, options.sourceTree, decision.value, receipt);
      await mkdir(join(evidenceRoot, 'validation'), { recursive: true });
      await createEvidence(root, evidenceRoot, options, results, env);
    },
    afterPublish: async ({ journalPath }) => {
      await assertG12RootDirectory(root, G12_ROOT, options);
      await assertG12MaintenanceRootDirectory(root, G12_MAINTENANCE_ROOT, options);
      await verifyEvidence(root, { allowTransactionJournal: journalPath, g12ExpectedIdentity: options });
    },
  });
  return {
    captured: true,
    evidenceFiles: (await directoryManifest(join(root, G12_ROOT))).length,
    maintenanceFiles: (await directoryManifest(join(root, G12_MAINTENANCE_ROOT))).length,
    records: 5,
    successors: 28,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const options = parseG12CaptureArguments(process.argv.slice(2));
  console.log(canonicalJson(await captureG12(repositoryRoot, options)));
}
