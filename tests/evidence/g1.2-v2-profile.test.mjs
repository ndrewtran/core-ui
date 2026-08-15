import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../packages/schema/src/index.mjs';
import {
  G12_V2_APPLICABILITY_PATHS,
  G12_V2_ASSERTION_IDS,
  G12_V2_DISCLOSURE,
  G12_V2_EVIDENCE_KINDS,
  G12_V2_EXPIRY,
  G12_V2_EXPECTED_TEST_NAMES,
  G12_V2_NONCLAIMS,
  G12_V2_PRODUCT_SOURCE,
  G12_V2_PROOF_FILES,
  G12_V2_ROOT,
  G12_V2_RETENTION,
  G12_V2_UPSTREAM_G10,
  G12_V2_UPSTREAM_G11,
  assertG12V2CurrentDependencies,
  assertG12V2DirectoryNames,
  assertG12V2Environment,
  assertG12V2EvidenceNodeRelations,
  assertG12V2SourceTopology,
  assertG12V2Upstream,
  expectedG12V2Facts,
  hasUnsanitizedG12V2Output,
  pathManifestAtRevision,
} from './g1.2-v2-profile.mjs';
import {
  G12V2PostValidationDriftError,
  assertG12V2PostValidationClean,
  normalizeG12V2Output,
  parseG12V2Arguments,
  publishG12V2Atomically,
} from './capture-g1.2-v2.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const execFile = promisify(execFileCallback);

async function absent(path) {
  return access(path).then(() => false, (error) => {
    if (error?.code === 'ENOENT') return true;
    throw error;
  });
}

test('G1.2-V2 owns exact current identities and five assertions', () => {
  assert.deepEqual(G12_V2_PRODUCT_SOURCE, {
    revision: '35f1e8d9cd451c30937a15d50ad730d7c109516a',
    tree: '85fea37de31d839219cfef8d3d21cd3fb68b8c94',
  });
  assert.equal(G12_V2_UPSTREAM_G10.commentId, 5301472350);
  assert.equal(G12_V2_UPSTREAM_G10.acceptedPacketSha256, 'sha256:59195089cbe2994bb2ad5469e0268bc897e702f365610c45c546907c130ca85b');
  assert.equal(G12_V2_UPSTREAM_G11.commentId, 5302695194);
  assert.deepEqual(G12_V2_ASSERTION_IDS, ['E-G1.2-01', 'E-G1.2-02', 'E-G1.2-03', 'E-G1.2-04', 'E-G1.2-05']);
});

test('G1.2-V2 source topology is the exact five-path sole child', () => {
  const changes = G12_V2_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`);
  assert.doesNotThrow(() => assertG12V2SourceTopology({
    changes, parents: [G12_V2_PRODUCT_SOURCE.revision],
    revision: '1'.repeat(40), tree: '2'.repeat(40),
  }));
  for (const mutation of [
    { changes: [...changes, 'A\ttests/evidence/unbounded.mjs'] },
    { changes, parents: [] },
    { changes: changes.slice(1) },
  ]) {
    assert.throws(() => assertG12V2SourceTopology({
      changes: mutation.changes, parents: mutation.parents ?? [G12_V2_PRODUCT_SOURCE.revision],
      revision: '1'.repeat(40), tree: '2'.repeat(40),
    }), /five-path proof-tool child/u);
  }
});

test('G1.2-V2 binds the exact accepted current G1.0 and G1.1 roots', async () => {
  assert.equal(G12_V2_UPSTREAM_G10.index.path, 'tests/evidence/default-theme-g1.0-v2/index.json');
  assert.equal(G12_V2_UPSTREAM_G11.index.path, 'tests/evidence/default-theme-g1.1-v2/index.json');
  assert.throws(() => assertG12V2Upstream({
    ...G12_V2_UPSTREAM_G10,
    index: { ...G12_V2_UPSTREAM_G10.index, sha256: `sha256:${'0'.repeat(64)}` },
  }, G12_V2_UPSTREAM_G10, 'G1.0'), /exact accepted current root/u);
  await assertG12V2CurrentDependencies(repositoryRoot);
});

test('G1.2-V2 applicability is identical at product source and current checkout', async () => {
  const [product, current] = await Promise.all([
    pathManifestAtRevision(repositoryRoot, G12_V2_PRODUCT_SOURCE.revision, G12_V2_APPLICABILITY_PATHS),
    pathManifestAtRevision(repositoryRoot, 'HEAD', G12_V2_APPLICABILITY_PATHS),
  ]);
  assert.equal(canonicalJson(current), canonicalJson(product));
});

test('G1.2-V2 arguments are exact', () => {
  const values = parseG12V2Arguments([
    '--source', '1'.repeat(40), '--tree', '2'.repeat(40), '--executed', '3'.repeat(40),
    '--executed-tree', '4'.repeat(40), '--timestamp', '2026-08-15T02:00:00Z',
  ]);
  assert.equal(values.executedRevision, '3'.repeat(40));
  assert.throws(() => parseG12V2Arguments(['--source', '1'.repeat(40)]), /ARGUMENT_INVALID/u);
});

test('G1.2-V2 environment is exact and contains no browser or local path', () => {
  const value = {
    architecture: 'arm64', git: '2.50.1', node: 'v24.19.0', pnpm: '10.33.0',
    runnerImage: 'local-macos-26.0', runnerImageVersion: '25A354', runnerOs: 'macOS 26.0',
  };
  assert.doesNotThrow(() => assertG12V2Environment(value));
  assert.throws(() => assertG12V2Environment({ ...value, browserPath: '/Applications/Google Chrome.app' }), /PROFILE_INVALID/u);
});

test('G1.2-V2 normalization and privacy checks reject local and credential output', () => {
  const normalized = normalizeG12V2Output(
    `${repositoryRoot}/file (12.3ms)\r\n`
      + 'Progress: resolved 513, reused 513, downloaded 0, added 510\r\n'
      + 'Progress: resolved 513, reused 513, downloaded 0, added 513, done\r\n'
      + 'Time:        0.311 s, estimated 1 s\r\n',
    repositoryRoot,
  );
  assert.equal(normalized, '<repository>/file (duration)\n'
    + 'Progress: resolved 513, reused 513, downloaded 0, added <progress>\n'
    + 'Progress: resolved 513, reused 513, downloaded 0, added 513, done\n'
    + 'Time: <duration>\n');
  assert.equal(hasUnsanitizedG12V2Output(normalized, repositoryRoot), false);
  assert.equal(hasUnsanitizedG12V2Output('/Users/admin/private', repositoryRoot), true);
  assert.equal(hasUnsanitizedG12V2Output('api_key=secret', repositoryRoot), true);
});

test('G1.2-V2 reuses exact current native facts and keeps component/support nonclaims', async () => {
  const facts = await expectedG12V2Facts(repositoryRoot);
  assert.deepEqual(Object.keys(facts), G12_V2_ASSERTION_IDS);
  assert.deepEqual(facts['E-G1.2-02'].nonclaims, G12_V2_NONCLAIMS);
  assert.equal(facts['E-G1.2-03'].strategy, 'unsupported');
  assert.equal(facts['E-G1.2-05'].componentSupportClaim, 'none');
});

test('G1.2-V2 retained nodes reject unknown fields and identity drift', async () => {
  const assertionId = 'E-G1.2-01';
  const expectedFacts = await expectedG12V2Facts(repositoryRoot);
  const environment = {
    architecture: 'arm64', git: '2.50.1', node: 'v24.19.0', pnpm: '10.33.0',
    runnerImage: 'local-macos-26.0', runnerImageVersion: '25A354', runnerOs: 'macOS 26.0',
  };
  const index = {
    applicabilityManifest: { profile: 'manifest' }, applicabilityProfile: { id: 'profile' },
    captureTimestamp: '2026-08-16T01:00:00Z', executedRevision: '3'.repeat(40),
    executedTree: '4'.repeat(40), sourceRevision: '1'.repeat(40), sourceTree: '2'.repeat(40),
    validation: { path: `${G12_V2_ROOT}/validation.json`, sha256: `sha256:${'5'.repeat(64)}` },
  };
  const command = 'node --test proof && pnpm check';
  const retainedResults = [{ command: 'node --test proof', outputSha256: `sha256:${'6'.repeat(64)}` }];
  const record = {
    activeExceptionRefs: [], advisoryRefs: [], applicabilityManifest: index.applicabilityManifest,
    applicabilityProfile: index.applicabilityProfile,
    artifact: { path: `${G12_V2_ROOT}/artifacts/${assertionId}.json`, sha256: `sha256:${'7'.repeat(64)}` },
    assertionId, captureTimestamp: index.captureTimestamp, command,
    disclosureClass: G12_V2_DISCLOSURE, environment,
    evidenceKind: G12_V2_EVIDENCE_KINDS[assertionId],
    executedRevision: index.executedRevision, executedTree: index.executedTree,
    expiry: G12_V2_EXPIRY, milestone: 'G1.2', outcome: 'pass', owner: 'ndrewtran',
    retentionPolicy: G12_V2_RETENTION, schema: 'core-ui-evidence-record-v1',
    sourceRevision: index.sourceRevision, sourceTree: index.sourceTree, validation: index.validation,
  };
  const artifact = {
    applicabilityManifest: index.applicabilityManifest, applicabilityProfile: index.applicabilityProfile,
    assertionId, captureTimestamp: index.captureTimestamp, command, environment,
    evidenceKind: record.evidenceKind, executedRevision: index.executedRevision,
    executedTree: index.executedTree, exitState: 0,
    observations: { facts: expectedFacts[assertionId], retainedResults, testNames: G12_V2_EXPECTED_TEST_NAMES[assertionId] },
    outcome: 'pass', schema: 'core-ui-evidence-artifact-v1',
    sourceRevision: index.sourceRevision, sourceTree: index.sourceTree,
  };
  const values = { artifact, assertionId, command, environment, expectedFacts, index, record, retainedResults };
  assert.doesNotThrow(() => assertG12V2EvidenceNodeRelations(values));
  for (const mutation of [
    { ...values, record: { ...record, unknown: true } },
    { ...values, record: { ...record, captureTimestamp: '2026-08-16T01:00:01Z' } },
    { ...values, record: { ...record, activeExceptionRefs: ['unexpected'] } },
    { ...values, artifact: { ...artifact, exitState: 1 } },
    { ...values, artifact: { ...artifact, observations: { ...artifact.observations, unknown: true } } },
  ]) assert.throws(() => assertG12V2EvidenceNodeRelations(mutation), /proof relation/u);
});

test('G1.2-V2 directory routing is absent-safe and fail-closed', () => {
  assert.equal(assertG12V2DirectoryNames(['g0.0']), false);
  assert.equal(assertG12V2DirectoryNames(['g1.2-v2']), true);
  assert.throws(() => assertG12V2DirectoryNames([
    'g1.2-v2', 'g1.2-v2-copy',
  ]), /exactly one/u);
});

test('G1.2-V2 publication is atomic and rolls back after failure', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'g12-v2-atomic-'));
  const repository = join(temporary, 'repository');
  const generated = join(temporary, 'generated');
  const generatedRoot = join(generated, G12_V2_ROOT);
  const destination = join(repository, G12_V2_ROOT);
  try {
    await mkdir(generatedRoot, { recursive: true });
    await mkdir(join(repository, 'tests/evidence'), { recursive: true });
    await writeFile(join(generatedRoot, 'marker.txt'), 'exact');
    await assert.rejects(publishG12V2Atomically({
      repository, generatedRoot: generated, afterPublish: async () => { throw new Error('injected'); },
    }), /injected/u);
    assert.equal(await absent(destination), true);
    await publishG12V2Atomically({ repository, generatedRoot: generated });
    assert.equal(await readFile(join(destination, 'marker.txt'), 'utf8'), 'exact');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('G1.2-V2 rejects post-validation drift before publication', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'g12-v2-drift-'));
  const output = join(repository, G12_V2_ROOT);
  try {
    await execFile('git', ['init', '--quiet'], { cwd: repository });
    await writeFile(join(repository, 'tracked.txt'), 'before');
    await execFile('git', ['add', 'tracked.txt'], { cwd: repository });
    await execFile('git', [
      '-c', 'user.name=Core UI Test',
      '-c', 'user.email=core-ui@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ], { cwd: repository });
    await writeFile(join(repository, 'tracked.txt'), 'validation mutation');
    await assert.rejects(
      assertG12V2PostValidationClean(repository),
      (error) => error instanceof G12V2PostValidationDriftError
        && error.code === 'G12_V2_POST_VALIDATION_DRIFT',
    );
    assert.equal(await absent(output), true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2-V2 retained root is absent before capture', async () => {
  assert.equal(await absent(join(repositoryRoot, G12_V2_ROOT)), true);
});
