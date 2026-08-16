import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ReactR10PostValidationDriftError,
  assertReactR10PostRootEvidenceOutput,
  assertReactR10PostValidationClean,
  assertTruthfulReactR10Timestamp,
  hasUnsanitizedReactR10Output,
  normalizeReactR10Output,
  parseReactR10Arguments,
  publishReactR10Atomically,
} from './capture-react-r1.0.mjs';
import {
  REACT_R10_APPLICABILITY_PATHS,
  REACT_R10_ASSERTION_IDS,
  REACT_R10_PROOF_FILES,
  REACT_R10_RESULT_KEYS,
  REACT_R10_ROOT,
  REACT_R10_SOURCE_REVISION,
  REACT_R10_SOURCE_TREE,
  assertReactR10Profile,
  assertReactR10SourceTopology,
  createReactR10Profile,
} from './react-r1.0-profile.mjs';

const execFile = promisify(execFileCallback);
const objectId = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const digest = `sha256:${'c'.repeat(64)}`;
const manifest = {
  algorithm: 'sha256', paths: REACT_R10_APPLICABILITY_PATHS,
  profile: 'core-ui-path-manifest-v1', sha256: digest,
};
const profile = () => createReactR10Profile({
  applicabilityManifest: manifest,
  toolRevision: objectId,
  toolTree: tree,
  toolFiles: REACT_R10_PROOF_FILES.map((path) => ({ path, sha256: digest })),
});

test('R1.0 arguments and timestamp are strict', () => {
  assert.deepEqual(parseReactR10Arguments([
    '--source', REACT_R10_SOURCE_REVISION, '--tree', REACT_R10_SOURCE_TREE,
    '--tool', objectId, '--tool-tree', tree, '--timestamp', '2026-08-17T00:00:00Z',
  ]), {
    sourceRevision: REACT_R10_SOURCE_REVISION, sourceTree: REACT_R10_SOURCE_TREE,
    toolRevision: objectId, toolTree: tree, timestamp: '2026-08-17T00:00:00Z',
  });
  assert.throws(() => parseReactR10Arguments([
    '--source', objectId, '--source', objectId, '--tree', tree,
    '--tool', objectId, '--tool-tree', tree, '--timestamp', '2026-08-17T00:00:00Z',
  ]), /ARGUMENT_INVALID/u);
  assert.throws(() => assertTruthfulReactR10Timestamp(
    '2026-08-16T00:00:00Z', '2026-08-17T00:00:00Z', new Date('2026-08-18T00:00:00Z'),
  ), /TIMESTAMP_INVALID/u);
});

test('R1.0 profile closes product, tool, applicability and assertion identities', () => {
  assert.doesNotThrow(() => assertReactR10Profile(profile()));
  assert.deepEqual(REACT_R10_ASSERTION_IDS, [
    'E-R1.0-01', 'E-R1.0-02', 'E-R1.0-03', 'E-R1.0-04', 'E-R1.0-05',
  ]);
  const altered = profile();
  altered.extra = true;
  assert.throws(() => assertReactR10Profile(altered), /PROFILE_INVALID/u);
  const drifted = profile();
  drifted.applicabilityManifest.paths = drifted.applicabilityManifest.paths.slice(1);
  assert.throws(() => assertReactR10Profile(drifted), /PROFILE_INVALID/u);
});

test('R1.0 source topology accepts only the exact sole-parent five-path child', () => {
  const changes = REACT_R10_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`);
  assert.doesNotThrow(() => assertReactR10SourceTopology({
    changes, parents: [REACT_R10_SOURCE_REVISION], revision: objectId, tree,
  }));
  assert.throws(() => assertReactR10SourceTopology({
    changes: [...changes, 'A\tunexpected'], parents: [REACT_R10_SOURCE_REVISION], revision: objectId, tree,
  }), /five-path/u);
  assert.throws(() => assertReactR10SourceTopology({
    changes, parents: [objectId], revision: objectId, tree,
  }), /five-path/u);
});

test('R1.0 retained output normalization removes unstable and private material', () => {
  const root = '/Users/example/core-ui';
  const normalized = normalizeReactR10Output(
    `${root}/x\r\n/private/var/folders/a/b (12.3ms)\nduration_ms 4.2\nTime: 1.23 s\nProgress: resolved 536, reused 530\n++++++++++++++++\n`, root,
  );
  assert.doesNotMatch(normalized, /Users|var\/folders|12\.3|4\.2|1\.23|Progress|\+\+\+/u);
  assert.equal(hasUnsanitizedReactR10Output(normalized, root), false);
  for (const unsafe of [
    `${root}/secret`, '/private/tmp/private-output', 'authorization=secret',
    'api_key: value', 'ssh://user:pass@example.test/repo',
    '-----BEGIN PRIVATE KEY-----',
  ]) assert.equal(hasUnsanitizedReactR10Output(unsafe, root), true);
});

test('R1.0 post-validation drift is typed and fail-closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'react-r1-drift-'));
  try {
    await execFile('git', ['init', '-q'], { cwd: root });
    await execFile('git', ['config', 'user.name', 'Evidence Test'], { cwd: root });
    await execFile('git', ['config', 'user.email', 'evidence@example.invalid'], { cwd: root });
    await writeFile(join(root, 'tracked.txt'), 'clean\n');
    await execFile('git', ['add', 'tracked.txt'], { cwd: root });
    await execFile('git', ['commit', '-qm', 'baseline'], { cwd: root });
    await assertReactR10PostValidationClean(root);
    await writeFile(join(root, 'tracked.txt'), 'drift\n');
    await assert.rejects(
      () => assertReactR10PostValidationClean(root),
      (error) => error instanceof ReactR10PostValidationDriftError
        && error.code === 'REACT_R10_POST_VALIDATION_DRIFT',
    );
    await assert.rejects(() => access(join(root, REACT_R10_ROOT)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('R1.0 retains only the final post-root generic verifier result', () => {
  const finalOutput = '[evidence] verified 49 immutable index, 190 records, 190 artifacts, and 17 recertifications and 195 supersessions\n';
  assert.equal(assertReactR10PostRootEvidenceOutput(finalOutput), finalOutput);
  assert.throws(() => assertReactR10PostRootEvidenceOutput(
    '[evidence] verified 48 immutable index, 185 records, 185 artifacts, and 17 recertifications and 195 supersessions\n',
  ), /POST_ROOT_EVIDENCE_INVALID/u);
});

test('R1.0 atomic publication rejects partial roots and rolls back verification failure', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'react-r1-publish-'));
  const generated = await mkdtemp(join(tmpdir(), 'react-r1-generated-'));
  try {
    const generatedRoot = join(generated, REACT_R10_ROOT);
    await mkdir(generatedRoot, { recursive: true });
    await writeFile(join(generatedRoot, 'index.json'), '{}');
    await assert.rejects(() => publishReactR10Atomically({
      repository, generatedRoot: generated,
      afterPublish: async () => { throw new Error('verification drift'); },
    }), /verification drift/u);
    await assert.rejects(() => access(join(repository, REACT_R10_ROOT)));

    await rm(generatedRoot, { recursive: true, force: true });
    await mkdir(generatedRoot, { recursive: true });
    for (const path of [
      'index.json', 'validation.json',
      ...REACT_R10_RESULT_KEYS.map((key) => `validation/${key}.txt`),
      ...REACT_R10_ASSERTION_IDS.flatMap((id) => [`artifacts/${id}.json`, `records/${id}.json`]),
    ]) {
      await mkdir(join(generatedRoot, path, '..'), { recursive: true });
      await writeFile(join(generatedRoot, path), path);
    }
    await assert.rejects(() => publishReactR10Atomically({
      repository, generatedRoot: generated,
      renamePath: async () => { throw new Error('rename failure'); },
    }), /rename failure/u);
    await assert.rejects(() => access(join(repository, REACT_R10_ROOT)));
  } finally {
    await rm(repository, { recursive: true, force: true });
    await rm(generated, { recursive: true, force: true });
  }
});

test('R1.0 proof source stays readable as canonical JavaScript inputs', async () => {
  for (const path of REACT_R10_PROOF_FILES.slice(0, 3)) {
    assert.ok((await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')).length > 100);
  }
});
