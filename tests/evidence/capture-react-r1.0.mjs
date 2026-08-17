import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { verifyEvidence } from '../../tooling/audits/repository-policy/src/evidence-verify.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  REACT_R10_APPLICABILITY_PATHS,
  REACT_R10_ASSERTION_IDS,
  REACT_R10_COMMANDS,
  REACT_R10_DISCLOSURE,
  REACT_R10_DIRECT_EXPECTATIONS,
  REACT_R10_EVIDENCE_KINDS,
  REACT_R10_EXPIRY,
  REACT_R10_EXPECTED_TEST_NAMES,
  REACT_R10_PROOF_FILES,
  REACT_R10_RETAINED_COMMANDS,
  REACT_R10_RESULT_KEYS,
  REACT_R10_RETENTION,
  REACT_R10_ROOT,
  REACT_R10_SOURCE_REVISION,
  REACT_R10_SOURCE_TREE,
  assertReactR10CommitTopology,
  assertReactR10Root,
  createReactR10Profile,
  pathManifestAtRevision,
  proofToolIdentityAtRevision,
  reactR10CaptureProcedure,
  reactR10FactsAtRevision,
} from './react-r1.0-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');

const commands = Object.freeze([
  ['profile', 'node', ['--test', 'tests/evidence/react-r1.0-profile.test.mjs', 'tooling/audits/repository-policy/test/react-r1.0.test.mjs']],
  ['react', 'pnpm', ['--filter', '@core-ui/react', 'check']],
  ['playground', 'pnpm', ['--dir', 'apps/react-playground', 'check']],
  ['generate', 'pnpm', ['generate']],
  ['generate-check', 'pnpm', ['generate:check']],
  ['check', 'pnpm', ['check']],
  ['check-all', 'pnpm', ['check:all']],
  ['release', 'pnpm', ['release:prepare']],
  ['evidence', 'node', ['tooling/audits/repository-policy/src/evidence-verify.mjs']],
]);
const postRootEvidenceOutput = '[evidence] verified 49 immutable index, 190 records, 190 artifacts, and 17 recertifications and 195 supersessions\n';

const prefixed = (bytes) => `sha256:${sha256(bytes)}`;
const exists = (path) => stat(path).then(() => true, (error) => {
  if (error?.code === 'ENOENT') return false;
  throw error;
});

export function normalizeReactR10Output(value, root) {
  return value.replaceAll(`/private${root}`, '<repository>').replaceAll(root, '<repository>')
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/gu, '')
    .replace(/\/(?:private\/)?var\/folders\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\/private\/tmp\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\((?:\d+\.)?\d+ms\)/gu, '(duration)')
    .replace(/duration_ms (?:\d+\.)?\d+/gu, 'duration_ms <duration>')
    .replace(/Done in [^\n]+/gu, 'Done in <duration>')
    .replace(/Took: [^\n]+/gu, 'Took: <duration>')
    .replace(/^Time:\s+[^\n]+$/gmu, 'Time: <duration>')
    .replace(/^Progress:.*\n?/gmu, '')
    .replace(/^\++\n?/gmu, '')
    .replace(/\r\n/gu, '\n');
}

export function hasUnsanitizedReactR10Output(value, root) {
  return value.includes(root)
    || /\/(?:Users|Volumes|home|root|tmp|private(?:\/(?:tmp|var\/folders))?|var\/folders)\//u.test(value)
    || /(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential)\s*[:=]\s*\S+/iu.test(value)
    || /\b(?:https?|ssh):\/\/[^\s/@:]+:[^\s/@]+@/iu.test(value)
    || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(value);
}

export function assertReactR10PostRootEvidenceOutput(output) {
  if (output !== postRootEvidenceOutput) throw new Error('REACT_R10_POST_ROOT_EVIDENCE_INVALID');
  return output;
}

async function run(command, args, root) {
  try {
    const result = await execFile(command, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      maxBuffer: 128 * 1024 * 1024,
    });
    return {
      command: [command, ...args].join(' '),
      exitState: 0,
      output: normalizeReactR10Output(result.stdout + result.stderr, root),
    };
  } catch (error) {
    const output = normalizeReactR10Output(`${error.stdout ?? ''}${error.stderr ?? ''}`, root);
    throw new Error(`REACT_R10_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
  }
}

async function git(root, ...args) {
  return (await run('git', args, root)).output.trim();
}

async function writeCanonical(root, relativePath, value) {
  const bytes = canonicalJson(value);
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return bytes;
}

async function chromeIdentity(root) {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    const version = await run(candidate, ['--version'], root);
    return { executableSha256: prefixed(await readFile(candidate)), version: version.output.trim() };
  }
  throw new Error('REACT_R10_BROWSER_REQUIRED');
}

async function environment(root) {
  const [node, pnpm, gitVersion, architecture, product, build, chrome] = await Promise.all([
    run('node', ['--version'], root), run('pnpm', ['--version'], root),
    run('git', ['--version'], root), run('uname', ['-m'], root),
    run('sw_vers', ['-productVersion'], root), run('sw_vers', ['-buildVersion'], root),
    chromeIdentity(root),
  ]);
  const playground = parseJsonStrict(await readFile(join(root, 'apps/react-playground/package.json'), 'utf8'));
  return {
    architecture: architecture.output.trim(),
    axeCore: playground.devDependencies['axe-core'],
    browser: chrome,
    git: gitVersion.output.trim().replace(/^git version /u, ''),
    node: node.output.trim(),
    playwrightCore: playground.devDependencies['playwright-core'],
    pnpm: pnpm.output.trim(),
    runnerImage: `local-macos-${product.output.trim()}`,
    runnerImageVersion: build.output.trim(),
    runnerOs: `macOS ${product.output.trim()}`,
  };
}

export class ReactR10PostValidationDriftError extends Error {
  constructor(status) {
    super(`REACT_R10_POST_VALIDATION_DRIFT: ${status}`);
    this.name = 'ReactR10PostValidationDriftError';
    this.code = 'REACT_R10_POST_VALIDATION_DRIFT';
  }
}

export async function assertReactR10PostValidationClean(root) {
  const status = await git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new ReactR10PostValidationDriftError(status);
}

export function parseReactR10Arguments(args) {
  const allowed = new Set(['--source', '--tree', '--tool', '--tool-tree', '--timestamp']);
  if (args.length !== 10) throw new Error('REACT_R10_ARGUMENT_INVALID');
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || Object.hasOwn(values, name) || !value || value.startsWith('--')) {
      throw new Error('REACT_R10_ARGUMENT_INVALID');
    }
    values[name] = value;
  }
  if (![values['--source'], values['--tree'], values['--tool'], values['--tool-tree']]
    .every((value) => /^[0-9a-f]{40}$/u.test(value))
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(values['--timestamp'])) {
    throw new Error('REACT_R10_ARGUMENT_REQUIRED');
  }
  return {
    sourceRevision: values['--source'], sourceTree: values['--tree'],
    toolRevision: values['--tool'], toolTree: values['--tool-tree'],
    timestamp: values['--timestamp'],
  };
}

export function assertTruthfulReactR10Timestamp(value, toolCommitTime, now = new Date()) {
  const captured = new Date(value);
  const tool = new Date(toolCommitTime);
  if (Number.isNaN(captured.valueOf()) || Number.isNaN(tool.valueOf())
    || value !== captured.toISOString().replace('.000Z', 'Z')
    || captured < tool || captured > now) throw new Error('REACT_R10_TIMESTAMP_INVALID');
}

export async function assertReactR10FrozenSource(root, values) {
  if (values.sourceRevision !== REACT_R10_SOURCE_REVISION || values.sourceTree !== REACT_R10_SOURCE_TREE
    || await git(root, 'rev-parse', 'HEAD') !== values.toolRevision
    || await git(root, 'rev-parse', `${values.sourceRevision}^{tree}`) !== values.sourceTree
    || await git(root, 'rev-parse', `${values.toolRevision}^{tree}`) !== values.toolTree) {
    throw new Error('REACT_R10_GIT_IDENTITY_INVALID');
  }
  if (await git(root, 'status', '--porcelain=v1', '--untracked-files=all')) throw new Error('REACT_R10_WORKTREE_DRIFT');
  if (await exists(join(root, REACT_R10_ROOT))) throw new Error('REACT_R10_OUTPUT_EXISTS');
  assertTruthfulReactR10Timestamp(values.timestamp, await git(root, 'show', '-s', '--format=%cI', values.toolRevision));
  await assertReactR10CommitTopology(root, values, { allowUncommitted: true });
  const product = await pathManifestAtRevision(root, values.sourceRevision, REACT_R10_APPLICABILITY_PATHS);
  const tool = await pathManifestAtRevision(root, values.toolRevision, REACT_R10_APPLICABILITY_PATHS);
  if (canonicalJson(product) !== canonicalJson(tool)) throw new Error('REACT_R10_APPLICABILITY_DRIFT');
}

async function assertPublishingRepositoryClean(root, values) {
  if (await git(root, 'rev-parse', 'HEAD') !== values.toolRevision) throw new Error('REACT_R10_PUBLICATION_HEAD_DRIFT');
  const status = await git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new ReactR10PostValidationDriftError(status);
}

async function runValidation(root) {
  const results = {};
  for (const [key, command, args] of commands) results[key] = await run(command, args, root);
  if (canonicalJson(Object.values(results).map(({ command }) => command)) !== canonicalJson(REACT_R10_COMMANDS)) {
    throw new Error('REACT_R10_COMMAND_SET_INVALID');
  }
  for (const [key, names] of Object.entries(REACT_R10_DIRECT_EXPECTATIONS)) {
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      if ((results[key].output.match(new RegExp(escaped, 'gu')) ?? []).length !== 1) {
        throw new Error(`REACT_R10_EXPECTED_RESULT_INVALID: ${name}`);
      }
    }
  }
  return results;
}

async function createRoot(root, outputRoot, values, commandResults, env) {
  const manifest = await pathManifestAtRevision(root, values.sourceRevision, REACT_R10_APPLICABILITY_PATHS);
  const proofTool = await proofToolIdentityAtRevision(root, values.toolRevision, values.toolTree);
  const profile = createReactR10Profile({ applicabilityManifest: manifest, toolRevision: values.toolRevision, toolTree: values.toolTree, toolFiles: proofTool.files });
  const facts = await reactR10FactsAtRevision(root, values.sourceRevision);
  const retainedResults = [];
  for (const key of REACT_R10_RESULT_KEYS) {
    const result = commandResults[key];
    if (hasUnsanitizedReactR10Output(result.output, root)) throw new Error(`REACT_R10_OUTPUT_UNSANITIZED: ${key}`);
    await mkdir(join(outputRoot, 'validation'), { recursive: true });
    await writeFile(join(outputRoot, 'validation', `${key}.txt`), result.output);
    retainedResults.push({
      command: result.command, exitState: 0,
      rawOutput: { path: `${REACT_R10_ROOT}/validation/${key}.txt`, sha256: prefixed(result.output) },
    });
  }
  const validationBytes = await writeCanonical(outputRoot, 'validation.json', {
    applicabilityProfile: profile,
    captureProcedure: reactR10CaptureProcedure(values),
    environment: env,
    executedRevision: values.toolRevision,
    executedTree: values.toolTree,
    proofTool,
    results: retainedResults,
    schema: 'core-ui-evidence-validation-v1',
    sourceRevision: values.sourceRevision,
    sourceTree: values.sourceTree,
  });
  const validation = { path: `${REACT_R10_ROOT}/validation.json`, sha256: prefixed(validationBytes) };
  const byCommand = new Map(retainedResults.map((result) => [result.command, result]));
  const recordReferences = [];
  for (const assertionId of REACT_R10_ASSERTION_IDS) {
    const selected = REACT_R10_RETAINED_COMMANDS[assertionId].map((command) => byCommand.get(command));
    if (selected.some((result) => result === undefined)) throw new Error(`REACT_R10_RESULT_SET_INVALID: ${assertionId}`);
    const command = selected.map((result) => result.command).join(' && ');
    const artifactPath = `${REACT_R10_ROOT}/artifacts/${assertionId}.json`;
    const artifactBytes = await writeCanonical(outputRoot, `artifacts/${assertionId}.json`, {
      applicabilityManifest: manifest,
      applicabilityProfile: profile,
      assertionId,
      captureTimestamp: values.timestamp,
      command,
      environment: env,
      evidenceKind: REACT_R10_EVIDENCE_KINDS[assertionId],
      executedRevision: values.toolRevision,
      executedTree: values.toolTree,
      exitState: 0,
      observations: {
        facts: facts[assertionId],
        retainedResults: selected.map(({ command: retainedCommand, rawOutput }) => ({
          command: retainedCommand, outputSha256: rawOutput.sha256,
        })),
        testNames: REACT_R10_EXPECTED_TEST_NAMES[assertionId],
      },
      outcome: 'pass',
      schema: 'core-ui-evidence-artifact-v1',
      sourceRevision: values.sourceRevision,
      sourceTree: values.sourceTree,
    });
    const recordPath = `${REACT_R10_ROOT}/records/${assertionId}.json`;
    const recordBytes = await writeCanonical(outputRoot, `records/${assertionId}.json`, {
      activeExceptionRefs: [], advisoryRefs: [], applicabilityManifest: manifest,
      applicabilityProfile: profile,
      artifact: { path: artifactPath, sha256: prefixed(artifactBytes) },
      assertionId, captureTimestamp: values.timestamp, command,
      disclosureClass: REACT_R10_DISCLOSURE, environment: env,
      evidenceKind: REACT_R10_EVIDENCE_KINDS[assertionId],
      executedRevision: values.toolRevision, executedTree: values.toolTree,
      expiry: REACT_R10_EXPIRY, milestone: 'R1.0', outcome: 'pass', owner: 'ndrewtran',
      retentionPolicy: REACT_R10_RETENTION, schema: 'core-ui-evidence-record-v1',
      sourceRevision: values.sourceRevision, sourceTree: values.sourceTree, validation,
    });
    recordReferences.push({ assertionId, path: recordPath, sha256: prefixed(recordBytes) });
  }
  await writeCanonical(outputRoot, 'index.json', {
    applicabilityManifest: manifest, applicabilityProfile: profile,
    captureTimestamp: values.timestamp, disclosureClass: REACT_R10_DISCLOSURE,
    executedRevision: values.toolRevision, executedTree: values.toolTree,
    milestone: 'R1.0', owner: 'ndrewtran', records: recordReferences, recertifications: [],
    retentionPolicy: REACT_R10_RETENTION, schema: 'core-ui-evidence-index-v1',
    sourceRevision: values.sourceRevision, sourceTree: values.sourceTree,
    supersessions: [], validation,
  });
}

async function listFiles(root, relative = '') {
  const output = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(root, path));
    else output.push(path);
  }
  return output.sort();
}

export async function compareReactR10Trees(expectedRoot, actualRoot) {
  const expectedFiles = await listFiles(join(expectedRoot, REACT_R10_ROOT));
  const actualFiles = await listFiles(join(actualRoot, REACT_R10_ROOT));
  if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) throw new Error('REACT_R10_DRIFT: file set');
  for (const path of expectedFiles) {
    const [expected, actual] = await Promise.all([
      readFile(join(expectedRoot, REACT_R10_ROOT, path)),
      readFile(join(actualRoot, REACT_R10_ROOT, path)),
    ]);
    if (!expected.equals(actual)) throw new Error(`REACT_R10_DRIFT: ${path}`);
  }
}

export async function publishReactR10Atomically({ repository, generatedRoot, afterPublish = async () => {}, renamePath = rename }) {
  const destination = join(repository, REACT_R10_ROOT);
  if (await exists(destination)) throw new Error('REACT_R10_OUTPUT_EXISTS');
  await mkdir(join(repository, 'tests'), { recursive: true });
  const transaction = await mkdtemp(join(repository, 'tests', '.react-r1.0-'));
  const staged = join(transaction, REACT_R10_ROOT);
  let published = false;
  try {
    await mkdir(dirname(staged), { recursive: true });
    await cp(join(generatedRoot, REACT_R10_ROOT), staged, { recursive: true });
    await compareReactR10Trees(generatedRoot, transaction);
    await mkdir(dirname(destination), { recursive: true });
    await renamePath(staged, destination);
    published = true;
    await afterPublish();
  } catch (error) {
    if (published) await rm(destination, { recursive: true, force: true });
    if (await exists(destination)) throw new Error('REACT_R10_ROLLBACK_INTEGRITY', { cause: error });
    throw error;
  } finally {
    await rm(transaction, { recursive: true, force: true });
  }
}

async function generateInDetachedWorktree(root, values, operation) {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-react-r1.0-'));
  const checkout = join(temporary, 'checkout');
  try {
    await run('git', ['worktree', 'add', '--detach', checkout, values.toolRevision], root);
    await run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], checkout);
    await assertReactR10FrozenSource(checkout, values);
    const results = await runValidation(checkout);
    await assertReactR10PostValidationClean(checkout);
    const env = await environment(checkout);
    await mkdir(join(checkout, REACT_R10_ROOT), { recursive: true });
    await createRoot(checkout, join(checkout, REACT_R10_ROOT), values, results, env);
    await assertReactR10Root(checkout, values, { allowUncommitted: true });
    const postRootEvidence = await run('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], checkout);
    assertReactR10PostRootEvidenceOutput(postRootEvidence.output);
    results.evidence = postRootEvidence;
    await createRoot(checkout, join(checkout, REACT_R10_ROOT), values, results, env);
    await assertReactR10Root(checkout, values, { allowUncommitted: true });
    await verifyEvidence(checkout, { reactR10ExpectedIdentity: values });
    return await operation(checkout);
  } finally {
    await run('git', ['worktree', 'remove', '--force', checkout], root).catch(() => null);
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function captureReactR10(root, values, { check = false } = {}) {
  if (check) {
    await assertReactR10Root(root, values);
    await generateInDetachedWorktree(root, values, (generated) => compareReactR10Trees(root, generated));
    return { checked: true, records: REACT_R10_ASSERTION_IDS.length };
  }
  await assertReactR10FrozenSource(root, values);
  await generateInDetachedWorktree(root, values, async (generated) => {
    await assertPublishingRepositoryClean(root, values);
    await publishReactR10Atomically({
      repository: root,
      generatedRoot: generated,
      afterPublish: async () => {
        await assertReactR10Root(root, values, { allowUncommitted: true });
        await verifyEvidence(root, { reactR10ExpectedIdentity: values });
      },
    });
  });
  return { captured: true, records: REACT_R10_ASSERTION_IDS.length };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (process.argv[2] === '--check') {
    if (process.argv.length !== 3) throw new Error('REACT_R10_ARGUMENT_INVALID');
    const index = parseJsonStrict(await readFile(join(repositoryRoot, REACT_R10_ROOT, 'index.json'), 'utf8'));
    const values = {
      sourceRevision: index.sourceRevision, sourceTree: index.sourceTree,
      toolRevision: index.executedRevision, toolTree: index.executedTree,
      timestamp: index.captureTimestamp,
    };
    console.log(canonicalJson(await captureReactR10(repositoryRoot, values, { check: true })));
  } else {
    const values = parseReactR10Arguments(process.argv.slice(2));
    console.log(canonicalJson(await captureReactR10(repositoryRoot, values)));
  }
}
