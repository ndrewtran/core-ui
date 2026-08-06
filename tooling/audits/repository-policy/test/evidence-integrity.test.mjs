import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../src/canonical-json.mjs';
import { EvidenceIntegrityError, verifyEvidence } from '../src/evidence-verify.mjs';
import { sha256 } from '../src/policy.mjs';

async function fixture({ validation = false, recordOnlyValidation = false } = {}) {
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
      ...(validation ? { validation: validationReference } : {}),
    }),
  );
  return { root, artifactPath };
}

test('content-addressed evidence index verifies canonical records and artifacts', async () => {
  const { root } = await fixture();
  assert.deepEqual(await verifyEvidence(root), {
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
  });
});

test('content-addressed evidence verifies one shared validation result', async () => {
  const { root } = await fixture({ validation: true });
  assert.deepEqual(await verifyEvidence(root), {
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
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
