import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { verifyEvidence } from '../../tooling/audits/repository-policy/src/evidence-verify.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  G12_V2_APPLICABILITY_PATHS,
  G12_V2_ASSERTION_IDS,
  G12_V2_DISCLOSURE,
  G12_V2_EVIDENCE_KINDS,
  G12_V2_EXPIRY,
  G12_V2_EXPECTED_TEST_NAMES,
  G12_V2_PRODUCT_SOURCE,
  G12_V2_PROOF_FILES,
  G12_V2_RESULT_KEYS,
  G12_V2_RETAINED_COMMANDS,
  G12_V2_RETENTION,
  G12_V2_ROOT,
  G12_V2_UPSTREAM_G11,
  assertG12V2CommitTopology,
  assertG12V2CurrentDependencies,
  assertG12V2Root,
  createG12V2Profile,
  expectedG12V2Facts,
  g12V2CaptureProcedure,
  hasUnsanitizedG12V2Output,
  pathManifestAtRevision,
  proofToolIdentityAtRevision,
} from './g1.2-v2-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
function prefixed(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function exists(path) {
  return stat(path).then(() => true, (error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

export function normalizeG12V2Output(value, root) {
  return value.replaceAll(`/private${root}`, '<repository>').replaceAll(root, '<repository>')
    .replace(/\/private\/var\/folders\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\((?:\d+\.)?\d+ms\)/gu, '(duration)')
    .replace(/duration_ms (?:\d+\.)?\d+/gu, 'duration_ms <duration>')
    .replace(/Done in [^\n]+/gu, 'Done in <duration>')
    .replace(/^Progress: resolved (\d+), reused (\d+), downloaded (\d+), added \d+$/gmu,
      'Progress: resolved $1, reused $2, downloaded $3, added <progress>')
    .replace(/Took: [^\n]+/gu, 'Took: <duration>')
    .replace(/^Time:\s+[^\n]+$/gmu, 'Time: <duration>')
    .replace(/^\x1B\[[0-9;?]*[A-Za-z].*$/gmu, '')
    .replace(/\r\n/gu, '\n');
}

async function run(command, args, root) {
  try {
    const result = await execFile(command, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      maxBuffer: 96 * 1024 * 1024,
    });
    return { command: [command, ...args].join(' '), exitState: 0, output: normalizeG12V2Output(result.stdout + result.stderr, root) };
  } catch (error) {
    const output = normalizeG12V2Output(`${error.stdout ?? ''}${error.stderr ?? ''}`, root);
    throw new Error(`G12_V2_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
  }
}

async function git(root, ...args) {
  return (await run('git', args, root)).output.trim();
}

export class G12V2PostValidationDriftError extends Error {
  constructor(status) {
    super(`G12_V2_POST_VALIDATION_DRIFT: ${status}`);
    this.name = 'G12V2PostValidationDriftError';
    this.code = 'G12_V2_POST_VALIDATION_DRIFT';
  }
}

export async function assertG12V2PostValidationClean(root) {
  const status = await git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new G12V2PostValidationDriftError(status);
}

async function writeCanonical(root, relativePath, value) {
  const bytes = canonicalJson(value);
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return bytes;
}

async function environment(root) {
  const [node, pnpm, gitVersion, architecture, product, build] = await Promise.all([
    run('node', ['--version'], root), run('pnpm', ['--version'], root),
    run('git', ['--version'], root), run('uname', ['-m'], root),
    run('sw_vers', ['-productVersion'], root), run('sw_vers', ['-buildVersion'], root),
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

export function parseG12V2Arguments(args) {
  const allowed = new Set(['--source', '--tree', '--executed', '--executed-tree', '--timestamp']);
  if (args.length !== 10) throw new Error('G12_V2_ARGUMENT_INVALID');
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || Object.hasOwn(values, name) || value?.startsWith('--')) throw new Error('G12_V2_ARGUMENT_INVALID');
    values[name] = value;
  }
  if (!/^[0-9a-f]{40}$/u.test(values['--source'] ?? '') || !/^[0-9a-f]{40}$/u.test(values['--tree'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--executed'] ?? '') || !/^[0-9a-f]{40}$/u.test(values['--executed-tree'] ?? '')
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(values['--timestamp'] ?? '')) throw new Error('G12_V2_ARGUMENT_REQUIRED');
  return {
    sourceRevision: values['--source'], sourceTree: values['--tree'],
    executedRevision: values['--executed'], executedTree: values['--executed-tree'],
    timestamp: values['--timestamp'],
  };
}

export function assertTruthfulG12V2Timestamp(value, executedCommitTime, now = new Date()) {
  const observed = new Date(value);
  const executed = new Date(executedCommitTime);
  if (Number.isNaN(observed.valueOf()) || Number.isNaN(executed.valueOf())
    || observed.toISOString().replace('.000Z', 'Z') !== value || observed < executed
    || observed < new Date(G12_V2_UPSTREAM_G11.createdAt) || observed > now) {
    throw new Error('G12_V2_TIMESTAMP_INVALID');
  }
}

async function assertFrozenSource(root, values) {
  if (values.sourceRevision !== G12_V2_PRODUCT_SOURCE.revision || values.sourceTree !== G12_V2_PRODUCT_SOURCE.tree) {
    throw new Error('G12_V2_PRODUCT_SOURCE_INVALID');
  }
  if (await git(root, 'rev-parse', 'HEAD') !== values.executedRevision
    || await git(root, 'rev-parse', `${values.sourceRevision}^{tree}`) !== values.sourceTree
    || await git(root, 'rev-parse', `${values.executedRevision}^{tree}`) !== values.executedTree) {
    throw new Error('G12_V2_GIT_IDENTITY_INVALID');
  }
  if (await git(root, 'status', '--porcelain=v1', '--untracked-files=all')) throw new Error('G12_V2_WORKTREE_DRIFT');
  if (await exists(join(root, G12_V2_ROOT))) throw new Error('G12_V2_OUTPUT_EXISTS');
  assertTruthfulG12V2Timestamp(values.timestamp, await git(root, 'show', '-s', '--format=%cI', values.executedRevision));
  await assertG12V2CommitTopology(root, values, { allowUncommitted: true });
  await assertG12V2CurrentDependencies(root);
  const productManifest = await pathManifestAtRevision(root, values.sourceRevision, G12_V2_APPLICABILITY_PATHS);
  const executedManifest = await pathManifestAtRevision(root, values.executedRevision, G12_V2_APPLICABILITY_PATHS);
  if (canonicalJson(productManifest) !== canonicalJson(executedManifest)) throw new Error('G12_V2_APPLICABILITY_DRIFT');
}

async function runValidation(root) {
  const results = {
    profile: await run('node', ['--test', 'tests/evidence/g1.2-v2-profile.test.mjs'], root),
    'react-native': await run('pnpm', ['--filter', '@core-ui/react-native', 'check'], root),
    'native-jest': await run('pnpm', ['--filter', '@core-ui/react-native', 'exec', 'jest', '--config', 'test/jest.config.cjs', '--runInBand', '--json'], root),
    generation: await run('pnpm', ['generate:check'], root),
    agent: await run('pnpm', ['test:agent'], root),
    release: await run('pnpm', ['release:prepare'], root),
    evidence: await run('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], root),
    check: await run('pnpm', ['check'], root),
    'check-all': await run('pnpm', ['check:all'], root),
  };
  const reports = results['native-jest'].output.split('\n').filter((line) => line.startsWith('{"numFailedTestSuites"'));
  if (reports.length !== 1) throw new Error('G12_V2_JEST_JSON_AMBIGUOUS');
  const report = parseJsonStrict(reports[0]);
  results['native-jest'].output = canonicalJson({
    assertions: report.testResults.flatMap(({ assertionResults }) => assertionResults.map(({ fullName, status }) => ({ fullName, status }))),
    failedSuites: report.numFailedTestSuites,
    failedTests: report.numFailedTests,
    passedSuites: report.numPassedTestSuites,
    passedTests: report.numPassedTests,
    success: report.success,
  });
  for (const [assertionId, names] of Object.entries(G12_V2_EXPECTED_TEST_NAMES)) {
    const output = assertionId === 'E-G1.2-02' ? results['native-jest'].output : results['react-native'].output;
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      if ((output.match(new RegExp(escaped, 'gu')) ?? []).length !== 1) throw new Error(`G12_V2_FOCUSED_ASSERTION_INVALID: ${name}`);
    }
  }
  return results;
}

async function createRoot(root, outputRoot, values, commandResults, env) {
  const manifest = await pathManifestAtRevision(root, values.sourceRevision, G12_V2_APPLICABILITY_PATHS);
  const proofTool = await proofToolIdentityAtRevision(root, values.executedRevision, values.executedTree);
  const profile = createG12V2Profile({ manifest, executedRevision: values.executedRevision, executedTree: values.executedTree, toolFiles: proofTool.files });
  const expectedFacts = await expectedG12V2Facts(root);
  const retainedResults = [];
  for (const key of G12_V2_RESULT_KEYS) {
    const result = commandResults[key];
    const relativePath = `${G12_V2_ROOT}/validation/${key}.txt`;
    if (hasUnsanitizedG12V2Output(result.output, root)) throw new Error(`G12_V2_OUTPUT_UNSANITIZED: ${key}`);
    await mkdir(join(outputRoot, 'validation'), { recursive: true });
    await writeFile(join(outputRoot, 'validation', `${key}.txt`), result.output);
    retainedResults.push({ command: result.command, exitState: 0, rawOutput: { path: relativePath, sha256: prefixed(result.output) } });
  }
  const procedure = g12V2CaptureProcedure(values);
  const validationBytes = await writeCanonical(outputRoot, 'validation.json', {
    applicabilityProfile: profile, captureProcedure: procedure, environment: env,
    executedRevision: values.executedRevision, executedTree: values.executedTree,
    proofTool, results: retainedResults, schema: 'core-ui-evidence-validation-v1',
    sourceRevision: values.sourceRevision, sourceTree: values.sourceTree,
  });
  const validation = { path: `${G12_V2_ROOT}/validation.json`, sha256: prefixed(validationBytes) };
  const byCommand = new Map(retainedResults.map((result) => [result.command, result]));
  const recordReferences = [];
  for (const assertionId of G12_V2_ASSERTION_IDS) {
    const selected = G12_V2_RETAINED_COMMANDS[assertionId].map((command) => byCommand.get(command));
    if (selected.some((result) => result === undefined)) throw new Error(`G12_V2_RESULT_SET_INVALID: ${assertionId}`);
    const command = selected.map((result) => result.command).join(' && ');
    const artifactPath = `${G12_V2_ROOT}/artifacts/${assertionId}.json`;
    const artifactBytes = await writeCanonical(outputRoot, `artifacts/${assertionId}.json`, {
      applicabilityManifest: manifest, applicabilityProfile: profile, assertionId,
      captureTimestamp: values.timestamp, command, environment: env,
      evidenceKind: G12_V2_EVIDENCE_KINDS[assertionId],
      executedRevision: values.executedRevision, executedTree: values.executedTree,
      exitState: 0, observations: {
        facts: expectedFacts[assertionId],
        retainedResults: selected.map(({ command: retainedCommand, rawOutput }) => ({ command: retainedCommand, outputSha256: rawOutput.sha256 })),
        testNames: G12_V2_EXPECTED_TEST_NAMES[assertionId],
      }, outcome: 'pass', schema: 'core-ui-evidence-artifact-v1',
      sourceRevision: values.sourceRevision, sourceTree: values.sourceTree,
    });
    const recordPath = `${G12_V2_ROOT}/records/${assertionId}.json`;
    const recordBytes = await writeCanonical(outputRoot, `records/${assertionId}.json`, {
      activeExceptionRefs: [], advisoryRefs: [], applicabilityManifest: manifest,
      applicabilityProfile: profile, artifact: { path: artifactPath, sha256: prefixed(artifactBytes) },
      assertionId, captureTimestamp: values.timestamp, command,
      disclosureClass: G12_V2_DISCLOSURE, environment: env,
      evidenceKind: G12_V2_EVIDENCE_KINDS[assertionId],
      executedRevision: values.executedRevision, executedTree: values.executedTree,
      expiry: G12_V2_EXPIRY, milestone: 'G1.2', outcome: 'pass', owner: 'ndrewtran',
      retentionPolicy: G12_V2_RETENTION, schema: 'core-ui-evidence-record-v1',
      sourceRevision: values.sourceRevision, sourceTree: values.sourceTree, validation,
    });
    recordReferences.push({ assertionId, path: recordPath, sha256: prefixed(recordBytes) });
  }
  await writeCanonical(outputRoot, 'index.json', {
    applicabilityManifest: manifest, applicabilityProfile: profile,
    captureTimestamp: values.timestamp, disclosureClass: G12_V2_DISCLOSURE,
    executedRevision: values.executedRevision, executedTree: values.executedTree,
    milestone: 'G1.2', owner: 'ndrewtran', records: recordReferences, recertifications: [],
    retentionPolicy: G12_V2_RETENTION, schema: 'core-ui-evidence-index-v1',
    sourceRevision: values.sourceRevision, sourceTree: values.sourceTree, supersessions: [], validation,
  });
}

async function listFiles(root, relative = '') {
  const output = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(root, path));
    else output.push(path);
  }
  return output.sort();
}

export async function compareG12V2Trees(expectedRoot, actualRoot) {
  const expectedFiles = await listFiles(join(expectedRoot, G12_V2_ROOT));
  const actualFiles = await listFiles(join(actualRoot, G12_V2_ROOT));
  if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) throw new Error('G12_V2_DRIFT: file set');
  for (const path of expectedFiles) {
    const [expected, actual] = await Promise.all([
      readFile(join(expectedRoot, G12_V2_ROOT, path)),
      readFile(join(actualRoot, G12_V2_ROOT, path)),
    ]);
    if (!expected.equals(actual)) throw new Error(`G12_V2_DRIFT: ${path}`);
  }
}

export async function publishG12V2Atomically({ repository, generatedRoot, afterPublish = async () => {}, renamePath = rename }) {
  const destination = join(repository, G12_V2_ROOT);
  if (await exists(destination)) throw new Error('G12_V2_OUTPUT_EXISTS');
  const transaction = await mkdtemp(join(repository, 'tests', '.g1-2-v2-'));
  const staged = join(transaction, G12_V2_ROOT);
  let published = false;
  try {
    await mkdir(dirname(staged), { recursive: true });
    await cp(join(generatedRoot, G12_V2_ROOT), staged, { recursive: true });
    await compareG12V2Trees(generatedRoot, transaction);
    await mkdir(dirname(destination), { recursive: true });
    await renamePath(staged, destination);
    published = true;
    await afterPublish();
  } catch (error) {
    if (published) await rm(destination, { recursive: true, force: true });
    if (await exists(destination)) throw new Error('G12_V2_ROLLBACK_INTEGRITY', { cause: error });
    throw error;
  } finally {
    await rm(transaction, { recursive: true, force: true });
  }
}

async function generateInDetachedWorktree(root, values, operation) {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-g1-2-v2-'));
  const checkout = join(temporary, 'checkout');
  try {
    await run('git', ['worktree', 'add', '--detach', checkout, values.executedRevision], root);
    await run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], checkout);
    await assertFrozenSource(checkout, values);
    const commandResults = await runValidation(checkout);
    await assertG12V2PostValidationClean(checkout);
    const env = await environment(checkout);
    if (env.node !== 'v24.19.0') throw new Error(`G12_V2_RUNTIME_INVALID: ${env.node}`);
    await mkdir(join(checkout, G12_V2_ROOT), { recursive: true });
    await createRoot(checkout, join(checkout, G12_V2_ROOT), values, commandResults, env);
    await assertG12V2Root(checkout, values, { allowUncommitted: true });
    await verifyEvidence(checkout, { g12V2ExpectedIdentity: values });
    return await operation(checkout);
  } finally {
    await run('git', ['worktree', 'remove', '--force', checkout], root).catch(() => null);
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function captureG12V2(root, values, { check = false } = {}) {
  if (check) {
    await assertG12V2Root(root, values);
    await generateInDetachedWorktree(root, values, (generated) => compareG12V2Trees(root, generated));
    return { checked: true, records: 5 };
  }
  await assertFrozenSource(root, values);
  await generateInDetachedWorktree(root, values, async (generated) => {
    await publishG12V2Atomically({
      repository: root,
      generatedRoot: generated,
      afterPublish: async () => {
        await assertG12V2Root(root, values, { allowUncommitted: true });
        await verifyEvidence(root, { g12V2ExpectedIdentity: values });
      },
    });
  });
  return { captured: true, records: 5 };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (process.argv[2] === '--check') {
    if (process.argv.length !== 3) throw new Error('G12_V2_ARGUMENT_INVALID');
    const index = parseJsonStrict(await readFile(join(repositoryRoot, G12_V2_ROOT, 'index.json'), 'utf8'));
    const values = {
      sourceRevision: index.sourceRevision, sourceTree: index.sourceTree,
      executedRevision: index.executedRevision, executedTree: index.executedTree,
      timestamp: index.captureTimestamp,
    };
    console.log(canonicalJson(await captureG12V2(repositoryRoot, values, { check: true })));
  } else {
    const values = parseG12V2Arguments(process.argv.slice(2));
    console.log(canonicalJson(await captureG12V2(repositoryRoot, values)));
  }
}
