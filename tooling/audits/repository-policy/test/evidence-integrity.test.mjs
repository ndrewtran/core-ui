import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../src/canonical-json.mjs';
import { EvidenceIntegrityError, verifyEvidence } from '../src/evidence-verify.mjs';
import { sha256 } from '../src/policy.mjs';

async function fixture({
  applicability = false,
  validation = false,
  recordOnlyValidation = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-evidence-'));
  await mkdir(join(root, 'tests/evidence/g0.0/artifacts'), { recursive: true });
  await mkdir(join(root, 'tests/evidence/g0.0/records'), { recursive: true });
  const artifactPath = 'tests/evidence/g0.0/artifacts/E-G0.0-01.json';
  const recordPath = 'tests/evidence/g0.0/records/E-G0.0-01.json';
  const artifactBytes = canonicalJson({ assertionId: 'E-G0.0-01', outcome: 'pass' });
  await writeFile(join(root, artifactPath), artifactBytes);
  const validationPath = 'tests/evidence/g0.0/verification.json';
  const validationValue = {
    sourceRevision: 'fixture-source',
    sourceTree: 'fixture-tree',
  };
  const hasValidation = validation || recordOnlyValidation;
  let applicabilityManifest;
  if (applicability) {
    const ownedPath = 'packages/source/owned.txt';
    const ownedBytes = 'repository-owned\n';
    await mkdir(join(root, 'packages/source/node_modules/dependency'), { recursive: true });
    await writeFile(join(root, ownedPath), ownedBytes);
    await writeFile(
      join(root, 'packages/source/node_modules/dependency/install.txt'),
      'platform-specific install\n',
    );
    applicabilityManifest = {
      paths: ['packages/source'],
      profile: 'core-ui-path-manifest-v1',
      sha256: `sha256:${sha256(canonicalJson([{
        path: ownedPath,
        sha256: `sha256:${sha256(ownedBytes)}`,
      }]))}`,
    };
  }
  const validationReference = hasValidation ? {
    path: validationPath,
    sha256: `sha256:${sha256(canonicalJson(validationValue))}`,
  } : undefined;
  if (hasValidation) await writeFile(join(root, validationPath), canonicalJson(validationValue));
  const recordBytes = canonicalJson({
    artifact: { path: artifactPath, sha256: `sha256:${sha256(artifactBytes)}` },
    assertionId: 'E-G0.0-01',
    sourceRevision: 'fixture-source',
    sourceTree: 'fixture-tree',
    ...(applicability ? { applicabilityManifest } : {}),
    ...(hasValidation ? { validation: validationReference } : {}),
  });
  await writeFile(join(root, recordPath), recordBytes);
  await writeFile(
    join(root, 'tests/evidence/g0.0/index.json'),
    canonicalJson({
      records: [{
        assertionId: 'E-G0.0-01',
        path: recordPath,
        sha256: `sha256:${sha256(recordBytes)}`,
      }],
      sourceRevision: 'fixture-source',
      ...(applicability ? { applicabilityManifest } : {}),
      ...(validation ? { validation: validationReference } : {}),
    }),
  );
  return { root, artifactPath };
}

async function addRecertification(root, mutate = (value) => value) {
  const historicalPath = 'tests/evidence/g0.0/index.json';
  const historicalBytes = await readFile(join(root, historicalPath), 'utf8');
  const historicalIndex = JSON.parse(historicalBytes);
  const ownedPath = 'packages/source/owned.txt';
  const currentBytes = 'repository-owned-current\n';
  await writeFile(join(root, ownedPath), currentBytes);
  const currentApplicabilityManifest = {
    paths: historicalIndex.applicabilityManifest.paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: `sha256:${sha256(canonicalJson([{
      path: ownedPath,
      sha256: `sha256:${sha256(currentBytes)}`,
    }]))}`,
  };
  const recertificationPath = 'tests/evidence/g0.1/recertifications/G0.0.json';
  const recertification = mutate({
    currentApplicabilityManifest,
    historicalApplicabilityManifest: historicalIndex.applicabilityManifest,
    historicalIndex: {
      path: historicalPath,
      sha256: `sha256:${sha256(historicalBytes)}`,
    },
    outcome: 'pass',
    schema: 'core-ui-evidence-recertification-v1',
    sourceRevision: 'current-source',
    sourceTree: 'current-tree',
  });
  const recertificationBytes = canonicalJson(recertification);
  await mkdir(join(root, 'tests/evidence/g0.1/recertifications'), { recursive: true });
  await writeFile(join(root, recertificationPath), recertificationBytes);
  await writeFile(join(root, 'tests/evidence/g0.1/index.json'), canonicalJson({
    records: [],
    recertifications: [{
      milestone: 'G0.0',
      path: recertificationPath,
      sha256: `sha256:${sha256(recertificationBytes)}`,
    }],
    sourceRevision: 'current-source',
    sourceTree: 'current-tree',
  }));
}

test('content-addressed evidence index verifies canonical records and artifacts', async () => {
  const { root } = await fixture();
  assert.deepEqual(await verifyEvidence(root), {
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('content-addressed evidence verifies one shared validation result', async () => {
  const { root } = await fixture({ validation: true });
  assert.deepEqual(await verifyEvidence(root), {
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('applicability manifests ignore platform-specific install directories', async () => {
  const { root } = await fixture({ applicability: true });
  assert.deepEqual(await verifyEvidence(root), {
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('content-addressed evidence rejects record-only validation ownership', async () => {
  const { root } = await fixture({ recordOnlyValidation: true });
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_VALIDATION_MISMATCH');
    return true;
  });
});

test('content-addressed evidence rejects a changed retained artifact', async () => {
  const { root, artifactPath } = await fixture();
  await writeFile(
    join(root, artifactPath),
    canonicalJson({ assertionId: 'E-G0.0-01', outcome: 'changed' }),
  );
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_DIGEST_MISMATCH');
    return true;
  });
});

test('append-only recertification preserves a stale historical index', async () => {
  const { root } = await fixture({ applicability: true });
  await addRecertification(root);
  assert.deepEqual(await verifyEvidence(root), {
    indexCount: 2,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 1,
  });
});

test('changed applicability still fails without a recertification', async () => {
  const { root } = await fixture({ applicability: true });
  await writeFile(join(root, 'packages/source/owned.txt'), 'changed\n');
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_APPLICABILITY_MISMATCH');
    return true;
  });
});

test('recertification rejects a wrong historical digest', async () => {
  const { root } = await fixture({ applicability: true });
  await addRecertification(root, (value) => ({
    ...value,
    historicalIndex: { ...value.historicalIndex, sha256: `sha256:${'0'.repeat(64)}` },
  }));
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_RECERTIFICATION_INVALID');
    return true;
  });
});

test('recertification rejects a stale current manifest', async () => {
  const { root } = await fixture({ applicability: true });
  await addRecertification(root, (value) => ({
    ...value,
    currentApplicabilityManifest: {
      ...value.currentApplicabilityManifest,
      sha256: `sha256:${'0'.repeat(64)}`,
    },
  }));
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_APPLICABILITY_MISMATCH');
    return true;
  });
});
