import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { hasUnsanitizedEvidenceOutput, verifyEvidence } from '../../tooling/audits/repository-policy/src/evidence-verify.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import { TALE_TOKEN_PHASE_C_PROFILE } from './capture-tale-token-phase-c.mjs';
import {
  TALE_TOKEN_PHASE_C_V2_APPLICABILITY_PATHS,
  TALE_TOKEN_PHASE_C_V2_COMMANDS,
  TALE_TOKEN_PHASE_C_V2_EXPIRY,
  TALE_TOKEN_PHASE_C_V2_PROFILE_DIGEST,
  TALE_TOKEN_PHASE_C_V2_RETENTION,
  TALE_TOKEN_PHASE_C_V2_ROOT_PATHS,
  TALE_TOKEN_PHASE_C_V2_ROOT_SPECS,
  assertTaleTokenPhaseCV2CommitTopology,
  assertTaleTokenPhaseCV2RootSet,
  pathManifestAtRevision,
  proofToolIdentityAtRevision,
} from './tale-token-phase-c-v2-profile.mjs';

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

function normalizeOutput(value, root) {
  return value.replaceAll(`/private${root}`, '<repository>').replaceAll(root, '<repository>')
    .replace(/\/private\/var\/folders\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\((?:\d+\.)?\d+ms\)/gu, '(duration)')
    .replace(/duration_ms (?:\d+\.)?\d+/gu, 'duration_ms <duration>')
    .replace(/Done in [^\n]+/gu, 'Done in <duration>').replace(/Took: [^\n]+/gu, 'Took: <duration>')
    .replace(/Time: +[^\n]+/gu, 'Time: <duration>').replace(/\r\n/gu, '\n');
}

async function run(command, args, cwd) {
  try {
    const result = await execFile(command, args, {
      cwd, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    const output = normalizeOutput(result.stdout + result.stderr, cwd);
    if (hasUnsanitizedEvidenceOutput(output, cwd)) throw new Error('TALE_TOKEN_PHASE_C_V2_PRIVATE_OUTPUT');
    return { command: [command, ...args].join(' '), exitState: 0, output };
  } catch (error) {
    if (error.message === 'TALE_TOKEN_PHASE_C_V2_PRIVATE_OUTPUT') throw error;
    throw new Error(`TALE_TOKEN_PHASE_C_V2_COMMAND_FAILED: ${command} ${args.join(' ')}\n${normalizeOutput(`${error.stdout ?? ''}${error.stderr ?? ''}`, cwd)}`);
  }
}

async function git(root, ...args) {
  return (await run('git', args, root)).output.trim();
}

async function writeCanonical(root, path, value) {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  const bytes = canonicalJson(value);
  await writeFile(destination, bytes);
  return bytes;
}

export function parseTaleTokenPhaseCV2Arguments(args) {
  const check = args.includes('--check');
  if (args.filter((value) => value === '--check').length > 1) throw new Error('TALE_TOKEN_PHASE_C_V2_ARGUMENT_INVALID');
  const values = args.filter((value) => value !== '--check');
  if (values.length !== 6) throw new Error('TALE_TOKEN_PHASE_C_V2_ARGUMENT_INVALID');
  const output = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!['--source', '--tree', '--timestamp'].includes(key) || Object.hasOwn(output, key) || value?.startsWith('--')) {
      throw new Error('TALE_TOKEN_PHASE_C_V2_ARGUMENT_INVALID');
    }
    output[key] = value;
  }
  if (!/^[0-9a-f]{40}$/u.test(output['--source'] ?? '') || !/^[0-9a-f]{40}$/u.test(output['--tree'] ?? '')
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(output['--timestamp'] ?? '')) {
    throw new Error('TALE_TOKEN_PHASE_C_V2_ARGUMENT_REQUIRED');
  }
  return { check, sourceRevision: output['--source'], sourceTree: output['--tree'], timestamp: output['--timestamp'] };
}

export function assertTaleTokenPhaseCV2Identity({ actualTree, head, sourceRevision, sourceTime, sourceTree, status, timestamp }, now = new Date()) {
  if (actualTree !== sourceTree) throw new Error('TALE_TOKEN_PHASE_C_V2_TREE_MISMATCH');
  if (head !== sourceRevision) throw new Error('TALE_TOKEN_PHASE_C_V2_SOURCE_MISMATCH');
  if (status !== '') throw new Error('TALE_TOKEN_PHASE_C_V2_WORKTREE_DRIFT');
  const observed = new Date(timestamp);
  if (Number.isNaN(observed.valueOf()) || observed.toISOString().replace('.000Z', 'Z') !== timestamp
    || observed < new Date(sourceTime) || observed > now) throw new Error('TALE_TOKEN_PHASE_C_V2_TIMESTAMP_INVALID');
}

async function assertFrozenSource(root, options) {
  assertTaleTokenPhaseCV2Identity({
    actualTree: await git(root, 'rev-parse', `${options.sourceRevision}^{tree}`),
    head: await git(root, 'rev-parse', 'HEAD'),
    sourceRevision: options.sourceRevision,
    sourceTime: await git(root, 'show', '-s', '--format=%cI', options.sourceRevision),
    sourceTree: options.sourceTree,
    status: await git(root, 'status', '--porcelain=v1', '--untracked-files=all'),
    timestamp: options.timestamp,
  });
}

async function environment(root) {
  const values = await Promise.all([
    run('node', ['--version'], root), run('pnpm', ['--version'], root), run('git', ['--version'], root),
    run('uname', ['-m'], root), run('sw_vers', ['-productVersion'], root), run('sw_vers', ['-buildVersion'], root),
  ]);
  return {
    node: values[0].output.trim(), pnpm: values[1].output.trim(), git: values[2].output.trim().replace(/^git version /u, ''),
    architecture: values[3].output.trim(), runnerImage: `local-macos-${values[4].output.trim()}`,
    runnerOs: `macOS ${values[4].output.trim()}`, runnerImageVersion: values[5].output.trim(),
  };
}

async function runValidation(root) {
  const results = new Map();
  for (const [key, [command, ...args]] of Object.entries(TALE_TOKEN_PHASE_C_V2_COMMANDS)) {
    results.set(key, await run(command, args, root));
  }
  return results;
}

async function createRoots(root, outputRoots, options, results, env) {
  const manifest = await pathManifestAtRevision(root, options.sourceRevision, TALE_TOKEN_PHASE_C_V2_APPLICABILITY_PATHS);
  const proofTool = await proofToolIdentityAtRevision(root, options.sourceRevision, options.sourceTree);
  const captureProcedure = `node tests/evidence/capture-tale-token-phase-c-v2.mjs --source ${options.sourceRevision} --tree ${options.sourceTree} --timestamp ${options.timestamp}`;
  const siblingIndexes = [];
  for (let position = 0; position < TALE_TOKEN_PHASE_C_V2_ROOT_SPECS.length; position += 1) {
    const spec = TALE_TOKEN_PHASE_C_V2_ROOT_SPECS[position];
    const finalRoot = TALE_TOKEN_PHASE_C_V2_ROOT_PATHS[position];
    const outputRoot = outputRoots[position];
    const selected = spec.resultKeys.map((key) => [key, results.get(key)]);
    for (const [key, result] of selected) await writeFile(join(outputRoot, 'validation', `${key}.txt`), result.output);
    const resultRefs = selected.map(([key, result]) => ({
      command: result.command, exitState: 0,
      rawOutput: { path: `${finalRoot}/validation/${key}.txt`, sha256: prefixed(result.output) },
    }));
    const validationBytes = await writeCanonical(outputRoot, 'validation.json', {
      applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
      captureProcedure,
      environment: env,
      executedRevision: options.sourceRevision,
      executedTree: options.sourceTree,
      proofTool,
      results: resultRefs,
      schema: 'core-ui-evidence-validation-v1',
      sourceRevision: options.sourceRevision,
      sourceTree: options.sourceTree,
    });
    const validation = { path: `${finalRoot}/validation.json`, sha256: prefixed(validationBytes) };
    let upstreamEvidence;
    if (spec.key === 'gate-0') {
      const g00Bytes = await readFile(join(root, 'tests/evidence/g0.0/index.json'));
      const g00Index = parseJsonStrict(g00Bytes.toString('utf8'));
      upstreamEvidence = {
        assertionCount: g00Index.records.length + TALE_TOKEN_PHASE_C_V2_ROOT_SPECS.slice(0, 5)
          .reduce((count, value) => count + Object.keys(value.assertions).length, 0),
        indexes: [
          { path: 'tests/evidence/g0.0/index.json', sha256: prefixed(g00Bytes), profileDigest: null },
          ...siblingIndexes,
        ],
      };
    }
    const recordRefs = [];
    for (const [assertionId, evidenceKind] of Object.entries(spec.assertions)) {
      const retainedResults = resultRefs.map(({ command, rawOutput }) => ({ command, outputSha256: rawOutput.sha256 }));
      const command = resultRefs.map(({ command: value }) => value).join(' && ');
      const artifactBytes = await writeCanonical(outputRoot, `artifacts/${assertionId}.json`, {
        applicabilityManifest: manifest,
        applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
        assertionId,
        captureTimestamp: options.timestamp,
        command,
        environment: env,
        evidenceKind,
        executedRevision: options.sourceRevision,
        executedTree: options.sourceTree,
        exitState: 0,
        observations: { checks: retainedResults, phase: 'TALE-TOKEN-C', ...(upstreamEvidence ? { upstreamEvidence } : {}) },
        outcome: 'pass',
        schema: 'core-ui-evidence-artifact-v1',
        sourceRevision: options.sourceRevision,
        sourceTree: options.sourceTree,
      });
      const artifact = { path: `${finalRoot}/artifacts/${assertionId}.json`, sha256: prefixed(artifactBytes) };
      const recordBytes = await writeCanonical(outputRoot, `records/${assertionId}.json`, {
        activeExceptionRefs: [], advisoryRefs: [], applicabilityManifest: manifest,
        applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE, artifact, assertionId,
        captureTimestamp: options.timestamp, command, disclosureClass: 'public-sanitized', environment: env,
        evidenceKind, executedRevision: options.sourceRevision, executedTree: options.sourceTree,
        expiry: TALE_TOKEN_PHASE_C_V2_EXPIRY, milestone: spec.milestone, outcome: 'pass', owner: 'ndrewtran',
        retentionPolicy: TALE_TOKEN_PHASE_C_V2_RETENTION, schema: 'core-ui-evidence-record-v1',
        sourceRevision: options.sourceRevision, sourceTree: options.sourceTree, validation,
      });
      recordRefs.push({ assertionId, path: `${finalRoot}/records/${assertionId}.json`, sha256: prefixed(recordBytes) });
    }
    const indexBytes = await writeCanonical(outputRoot, 'index.json', {
      applicabilityManifest: manifest, applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
      captureTimestamp: options.timestamp, disclosureClass: 'public-sanitized', milestone: spec.milestone,
      owner: 'ndrewtran', records: recordRefs, recertifications: [], retentionPolicy: TALE_TOKEN_PHASE_C_V2_RETENTION,
      schema: 'core-ui-evidence-index-v1', sourceRevision: options.sourceRevision, sourceTree: options.sourceTree,
      supersessions: [], validation,
    });
    if (position < 5) siblingIndexes.push({
      path: `${finalRoot}/index.json`, sha256: prefixed(indexBytes), profileDigest: TALE_TOKEN_PHASE_C_V2_PROFILE_DIGEST,
    });
  }
}

export async function materializeTaleTokenPhaseCV2Atomically({
  repository = repositoryRoot,
  build,
  afterPublish = async () => {},
  afterEachPublish = async () => {},
  renamePath = rename,
}) {
  const finals = TALE_TOKEN_PHASE_C_V2_ROOT_PATHS.map((path) => join(repository, path));
  for (let index = 0; index < finals.length; index += 1) {
    if (await exists(finals[index])) throw new Error(`TALE_TOKEN_PHASE_C_V2_OUTPUT_EXISTS: ${TALE_TOKEN_PHASE_C_V2_ROOT_PATHS[index]}`);
  }
  const transaction = await mkdtemp(join(repository, 'tests', '.tale-token-phase-c-v2-'));
  const staged = TALE_TOKEN_PHASE_C_V2_ROOT_PATHS.map((_, index) => join(transaction, String(index)));
  await Promise.all(staged.map((path) => mkdir(join(path, 'validation'), { recursive: true })));
  const published = [];
  try {
    await build(staged);
    for (let index = 0; index < staged.length; index += 1) {
      await mkdir(dirname(finals[index]), { recursive: true });
      await renamePath(staged[index], finals[index]);
      published.push(index);
      await afterEachPublish({ index });
    }
    await afterPublish();
  } catch (error) {
    const failures = [];
    for (const index of published.reverse()) {
      try { await rm(finals[index], { recursive: true }); } catch (rollbackError) { failures.push(rollbackError.message); }
    }
    const residual = [];
    for (let index = 0; index < finals.length; index += 1) if (await exists(finals[index])) residual.push(TALE_TOKEN_PHASE_C_V2_ROOT_PATHS[index]);
    if (failures.length > 0 || residual.length > 0) throw new Error(`TALE_TOKEN_PHASE_C_V2_ROLLBACK_INTEGRITY: ${failures.join(' | ')}; ${residual.join(',')}`, { cause: error });
    throw error;
  } finally {
    await rm(transaction, { recursive: true, force: true });
  }
}

async function directoryFiles(root, relative = '') {
  const output = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await directoryFiles(root, path));
    else output.push(path);
  }
  return output;
}

async function compareRootSets(expectedRoot, actualRoot) {
  for (const relative of TALE_TOKEN_PHASE_C_V2_ROOT_PATHS) {
    const expectedFiles = await directoryFiles(join(expectedRoot, relative));
    const actualFiles = await directoryFiles(join(actualRoot, relative));
    if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) throw new Error(`TALE_TOKEN_PHASE_C_V2_DRIFT: ${relative} file set`);
    for (const path of expectedFiles) {
      const [expected, actual] = await Promise.all([readFile(join(expectedRoot, relative, path)), readFile(join(actualRoot, relative, path))]);
      if (!expected.equals(actual)) throw new Error(`TALE_TOKEN_PHASE_C_V2_DRIFT: ${relative}/${path}`);
    }
  }
}

async function generateInDetachedWorktree(root, options, operation) {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-phase-c-v2-'));
  const checkout = join(temporary, 'checkout');
  try {
    await run('git', ['worktree', 'add', '--detach', checkout, options.sourceRevision], root);
    await run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], checkout);
    const results = await runValidation(checkout);
    const env = await environment(checkout);
    await materializeTaleTokenPhaseCV2Atomically({
      repository: checkout,
      build: (outputs) => createRoots(checkout, outputs, options, results, env),
    });
    return await operation(checkout);
  } finally {
    await run('git', ['worktree', 'remove', '--force', checkout], root).catch(() => null);
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function captureTaleTokenPhaseCV2(root, options) {
  if (options.check) {
    await assertTaleTokenPhaseCV2RootSet(root, options);
    await assertTaleTokenPhaseCV2CommitTopology(root, options);
    await generateInDetachedWorktree(root, options, (generated) => compareRootSets(root, generated));
    return { checked: true, roots: 6 };
  }
  await assertFrozenSource(root, options);
  const results = await runValidation(root);
  const env = await environment(root);
  await materializeTaleTokenPhaseCV2Atomically({
    repository: root,
    build: (outputs) => createRoots(root, outputs, options, results, env),
    afterPublish: async () => {
      await assertTaleTokenPhaseCV2RootSet(root, options);
      await verifyEvidence(root, { phaseCV2ExpectedIdentity: options });
    },
  });
  return { captured: true, records: 26, roots: 6 };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const options = parseTaleTokenPhaseCV2Arguments(process.argv.slice(2));
  console.log(canonicalJson(await captureTaleTokenPhaseCV2(repositoryRoot, options)));
}
