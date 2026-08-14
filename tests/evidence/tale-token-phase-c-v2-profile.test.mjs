import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  TALE_TOKEN_PHASE_C_V2_APPLICABILITY_PATHS,
  TALE_TOKEN_PHASE_C_V2_PROOF_FILES,
  TALE_TOKEN_PHASE_C_V2_ROOT_NAMES,
  assertTaleTokenPhaseCV2CommitTopology,
  assertTaleTokenPhaseCV2DirectoryNames,
  assertTaleTokenPhaseCV2IndexSet,
  listTaleTokenPhaseCV2Files,
  pathManifestAtRevision,
} from './tale-token-phase-c-v2-profile.mjs';
import { pathManifestAtRevision as canonicalPathManifestAtRevision } from './g1.2-profile.mjs';
import {
  assertTaleTokenPhaseCV2Identity,
  materializeTaleTokenPhaseCV2Atomically,
  normalizeTaleTokenPhaseCV2Output,
  parseTaleTokenPhaseCV2Arguments,
} from './capture-tale-token-phase-c-v2.mjs';

const execFile = promisify(execFileCallback);

const revision = '1'.repeat(40);
const tree = '2'.repeat(40);
const timestamp = '2026-08-15T01:00:00Z';

function present(path) {
  return stat(path).then(() => true, (error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

async function git(root, ...args) {
  return (await execFile('git', args, { cwd: root, encoding: 'utf8' })).stdout.trim();
}

async function topologyRepository({ unrelated = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'phase-c-v2-topology-'));
  await git(root, 'init', '-q');
  await git(root, 'config', 'user.name', 'Core UI Test');
  await git(root, 'config', 'user.email', 'core-ui-test@example.invalid');
  await writeFile(join(root, 'source.txt'), 'source\n');
  await git(root, 'add', 'source.txt');
  await git(root, 'commit', '-q', '-m', 'source');
  const sourceRevision = await git(root, 'rev-parse', 'HEAD');
  const sourceTree = await git(root, 'rev-parse', 'HEAD^{tree}');
  for (const name of TALE_TOKEN_PHASE_C_V2_ROOT_NAMES) {
    const directory = join(root, 'tests/evidence', name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.json'), '{}');
  }
  if (unrelated) await writeFile(join(root, 'unrelated.txt'), 'not evidence\n');
  await git(root, 'add', 'tests/evidence', ...(unrelated ? ['unrelated.txt'] : []));
  await git(root, 'commit', '-q', '-m', 'evidence');
  return { root, sourceRevision, sourceTree };
}

test('Phase C v2 root set is exact and source-identical', () => {
  assert.equal(assertTaleTokenPhaseCV2DirectoryNames(TALE_TOKEN_PHASE_C_V2_ROOT_NAMES), true);
  assert.doesNotThrow(() => assertTaleTokenPhaseCV2IndexSet(TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.map((name) => ({
    name, index: { captureTimestamp: timestamp, sourceRevision: revision, sourceTree: tree },
  }))));
  for (const names of [
    TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.slice(1),
    [...TALE_TOKEN_PHASE_C_V2_ROOT_NAMES, 'tale-token-phase-c-g0.6-v2'],
  ]) assert.throws(() => assertTaleTokenPhaseCV2DirectoryNames(names), /six versioned/u);
  const mixed = TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.map((name, index) => ({
    name, index: { captureTimestamp: timestamp, sourceRevision: index === 2 ? '3'.repeat(40) : revision, sourceTree: tree },
  }));
  assert.throws(() => assertTaleTokenPhaseCV2IndexSet(mixed), /one source\/tree\/timestamp/u);
});

test('Phase C v2 file-set traversal is globally bytewise sorted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase-c-v2-files-'));
  try {
    await mkdir(join(root, 'validation'), { recursive: true });
    await writeFile(join(root, 'validation', 'schema.txt'), 'result\n');
    await writeFile(join(root, 'validation.json'), '{}');
    assert.deepEqual(await listTaleTokenPhaseCV2Files(root), ['validation.json', 'validation/schema.txt']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Phase C v2 applicability manifest delegates to the canonical path-manifest owner', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const sourceRevision = await git(root, 'rev-parse', 'HEAD');
  const paths = ['package.json', 'tests/evidence/README.md'];
  assert.deepEqual(
    await pathManifestAtRevision(root, sourceRevision, paths),
    await canonicalPathManifestAtRevision(root, sourceRevision, paths),
  );
  assert.ok(TALE_TOKEN_PHASE_C_V2_PROOF_FILES.includes('tests/evidence/g1.2-profile.mjs'));
  assert.ok(TALE_TOKEN_PHASE_C_V2_APPLICABILITY_PATHS.includes('tests/evidence/g1.2-profile.mjs'));
});

test('Phase C v2 arguments are exact', () => {
  assert.deepEqual(parseTaleTokenPhaseCV2Arguments([
    '--source', revision, '--tree', tree, '--timestamp', timestamp,
  ]), { check: false, sourceRevision: revision, sourceTree: tree, timestamp });
  assert.deepEqual(parseTaleTokenPhaseCV2Arguments([
    '--check', '--tree', tree, '--timestamp', timestamp, '--source', revision,
  ]), { check: true, sourceRevision: revision, sourceTree: tree, timestamp });
  for (const args of [
    [],
    ['--source', revision, '--source', revision, '--timestamp', timestamp],
    ['--source', 'bad', '--tree', tree, '--timestamp', timestamp],
    ['--source', revision, '--tree', tree, '--timestamp', 'bad'],
    ['--check', '--check', '--source', revision, '--tree', tree, '--timestamp', timestamp],
  ]) assert.throws(() => parseTaleTokenPhaseCV2Arguments(args), /ARGUMENT/u);
});

test('Phase C v2 output normalization removes transient pnpm progress updates', () => {
  const stable = 'Packages: +513\n++++++++++++++++++++++++++++++++++++\ndevDependencies:\n';
  const first = `Packages: +513\nProgress: resolved 1, reused 0, downloaded 0, added 0\nProgress: resolved 513, reused 513, downloaded 0, added 512\n++++++++++++++++++++++++++++++++++++\ndevDependencies:\n`;
  const second = `Packages: +513\nProgress: resolved 513, reused 513, downloaded 0, added 510\n++++++++++++++++++++++++++++++++++++\ndevDependencies:\n`;
  assert.equal(normalizeTaleTokenPhaseCV2Output(first, '/repository'), stable);
  assert.equal(normalizeTaleTokenPhaseCV2Output(second, '/repository'), stable);
});

test('Phase C v2 source, tree, clean-worktree, and timestamp checks fail closed', () => {
  const valid = { actualTree: tree, head: revision, sourceRevision: revision, sourceTime: timestamp, sourceTree: tree, status: '', timestamp };
  assert.doesNotThrow(() => assertTaleTokenPhaseCV2Identity(valid, new Date('2026-08-15T02:00:00Z')));
  for (const mutate of [
    (value) => { value.actualTree = '3'.repeat(40); },
    (value) => { value.head = '3'.repeat(40); },
    (value) => { value.status = '?? output'; },
    (value) => { value.timestamp = '2026-08-14T00:00:00Z'; },
    (value) => { value.timestamp = '2026-08-16T00:00:00Z'; },
  ]) {
    const value = structuredClone(valid);
    mutate(value);
    assert.throws(() => assertTaleTokenPhaseCV2Identity(value, new Date('2026-08-15T02:00:00Z')), /PHASE_C_V2/u);
  }
});

test('Phase C v2 committed topology is one evidence-only child and remains byte-identical', async () => {
  const valid = await topologyRepository();
  const unrelated = await topologyRepository({ unrelated: true });
  try {
    await assert.doesNotReject(assertTaleTokenPhaseCV2CommitTopology(valid.root, valid));
    await assert.rejects(pathManifestAtRevision(valid.root, valid.sourceRevision, ['missing']), /applicability path is missing/u);
    await writeFile(join(valid.root, 'tests/evidence', TALE_TOKEN_PHASE_C_V2_ROOT_NAMES[0], 'index.json'), '{"changed":true}');
    await git(valid.root, 'add', 'tests/evidence');
    await git(valid.root, 'commit', '-q', '-m', 'rewrite evidence');
    await assert.rejects(assertTaleTokenPhaseCV2CommitTopology(valid.root, valid), /byte-identical/u);
    await assert.rejects(assertTaleTokenPhaseCV2CommitTopology(unrelated.root, unrelated), /add only the six/u);
  } finally {
    await rm(valid.root, { recursive: true, force: true });
    await rm(unrelated.root, { recursive: true, force: true });
  }
});

test('Phase C v2 refuses any pre-existing output before build', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'phase-c-v2-existing-'));
  await mkdir(join(repository, 'tests/evidence', TALE_TOKEN_PHASE_C_V2_ROOT_NAMES[2]), { recursive: true });
  let built = false;
  try {
    await assert.rejects(materializeTaleTokenPhaseCV2Atomically({
      repository,
      build: async () => { built = true; },
    }), /OUTPUT_EXISTS/u);
    assert.equal(built, false);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('Phase C v2 atomically rolls back an inter-root failure and can retry', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'phase-c-v2-rollback-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  const build = async (roots) => Promise.all(roots.map((root, index) => writeFile(join(root, 'validation', `${index}.txt`), String(index))));
  try {
    await assert.rejects(materializeTaleTokenPhaseCV2Atomically({
      repository,
      build,
      afterEachPublish: async ({ index }) => { if (index === 2) throw new Error('INJECTED_PHASE_C_V2_FAILURE'); },
    }), /INJECTED_PHASE_C_V2_FAILURE/u);
    for (const name of TALE_TOKEN_PHASE_C_V2_ROOT_NAMES) assert.equal(await present(join(repository, 'tests/evidence', name)), false);
    await materializeTaleTokenPhaseCV2Atomically({ repository, build });
    assert.equal(await readFile(join(repository, 'tests/evidence', TALE_TOKEN_PHASE_C_V2_ROOT_NAMES[5], 'validation/5.txt'), 'utf8'), '5');
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
