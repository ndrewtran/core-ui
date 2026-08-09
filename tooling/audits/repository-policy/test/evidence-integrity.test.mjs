import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../src/canonical-json.mjs';
import { EvidenceIntegrityError, verifyEvidence } from '../src/evidence-verify.mjs';
import { sha256 } from '../src/policy.mjs';
import { acceptanceCommentBody } from '../src/tale-token-annex-acceptance.mjs';

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
      algorithm: 'sha256',
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
      milestone: 'G0.0',
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
    algorithm: 'sha256',
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
  return { recertification, recertificationBytes, recertificationPath };
}

async function addRecertificationContinuation(
  root,
  previous,
  { name = 'G0.0', mutate = (value) => value } = {},
) {
  const historicalPath = 'tests/evidence/g0.0/index.json';
  const historicalBytes = await readFile(join(root, historicalPath), 'utf8');
  const historicalIndex = JSON.parse(historicalBytes);
  const ownedPath = 'packages/source/owned.txt';
  const currentBytes = `repository-owned-${name}-current\n`;
  await writeFile(join(root, ownedPath), currentBytes);
  const currentApplicabilityManifest = {
    algorithm: 'sha256',
    paths: historicalIndex.applicabilityManifest.paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: `sha256:${sha256(canonicalJson([{
      path: ownedPath,
      sha256: `sha256:${sha256(currentBytes)}`,
    }]))}`,
  };
  const recertificationPath = `tests/evidence/g0.2/recertifications/${name}.json`;
  const recertification = mutate({
    currentApplicabilityManifest,
    historicalApplicabilityManifest: previous.recertification.currentApplicabilityManifest,
    historicalIndex: {
      path: historicalPath,
      sha256: `sha256:${sha256(historicalBytes)}`,
    },
    outcome: 'pass',
    previousRecertification: {
      path: previous.recertificationPath,
      sha256: `sha256:${sha256(previous.recertificationBytes)}`,
    },
    schema: 'core-ui-evidence-recertification-v2',
    sourceRevision: 'next-source',
    sourceTree: 'next-tree',
  });
  const recertificationBytes = canonicalJson(recertification);
  await mkdir(join(root, 'tests/evidence/g0.2/recertifications'), { recursive: true });
  await writeFile(join(root, recertificationPath), recertificationBytes);
  const indexPath = join(root, 'tests/evidence/g0.2/index.json');
  let index = {
    records: [],
    recertifications: [],
    sourceRevision: 'next-source',
    sourceTree: 'next-tree',
  };
  try {
    index = JSON.parse(await readFile(indexPath, 'utf8'));
  } catch {}
  index.recertifications.push({
    milestone: 'G0.0',
    path: recertificationPath,
    sha256: `sha256:${sha256(recertificationBytes)}`,
  });
  await writeFile(indexPath, canonicalJson(index));
  return { recertification, recertificationBytes, recertificationPath };
}

async function addApplicabilitySupersession(
  root,
  {
    recertification,
    directory = 'supersession',
    historicalPath = 'tests/evidence/g0.0/index.json',
    name = 'G0.0',
    continuationDecision = 3,
    mutateAuthorityDecision = (value) => value,
    previousSupersession,
    mutate = (value) => value,
  } = {},
) {
  const historicalBytes = await readFile(join(root, historicalPath), 'utf8');
  const historicalIndex = JSON.parse(historicalBytes);
  const ownedPath = 'packages/source/owned.txt';
  const currentBytes = `repository-owned-${directory}-${name}\n`;
  await writeFile(join(root, ownedPath), currentBytes);
  const currentApplicabilityManifest = {
    algorithm: 'sha256',
    paths: historicalIndex.applicabilityManifest.paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: `sha256:${sha256(canonicalJson([{
      path: ownedPath,
      sha256: `sha256:${sha256(currentBytes)}`,
    }]))}`,
  };
  const supersededApplicabilityManifest = previousSupersession
    ? previousSupersession.supersession.currentApplicabilityManifest
    : recertification?.recertification.currentApplicabilityManifest
      ?? historicalIndex.applicabilityManifest;
  const supersessionPath = `tests/evidence/${directory}/supersessions/${name}.json`;
  await mkdir(join(root, 'decisions'), { recursive: true });
  let authorityDecisionPath = 'decisions/0002-tale-token-authority.json';
  let authorityDecision = {
    bodySha256: `sha256:${'c'.repeat(64)}`,
    commentId: 5229802192,
    commentNodeId: 'IC_fixture',
    createdAt: '2026-08-09T04:41:54Z',
    decisionId: 'core-ui:decision:0002',
    issueNumber: 39,
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: 'U_fixture',
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-authority-decision-v1',
    url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-5229802192',
  };
  if (previousSupersession) {
    const annexPath = 'decisions/0003-tale-token-classification-annex.json';
    if (continuationDecision === 3) {
      authorityDecisionPath = 'decisions/0003-tale-token-classification-acceptance.json';
      const annexBytes = '{"schema":"fixture-annex"}';
      const annexSha256 = `sha256:${sha256(annexBytes)}`;
      const commentBody = acceptanceCommentBody({
        annexPath,
        annexSha256,
        annexBytes: Buffer.byteLength(annexBytes),
      });
      authorityDecision = {
        bodySha256: `sha256:${sha256(commentBody)}`,
        commentId: 1,
        commentNodeId: 'IC_fixture_annex',
        createdAt: '2026-08-09T05:00:00Z',
        decisionId: 'core-ui:decision:0003',
        issueNumber: 39,
        outcome: 'accepted',
        owner: 'ndrewtran',
        ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
        provider: 'github',
        repository: 'ndrewtran/core-ui',
        schema: 'core-ui-authority-decision-v1',
        url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-1',
      };
      await writeFile(join(root, annexPath), annexBytes);
    } else {
      authorityDecisionPath = 'decisions/0004-future-authority.json';
      authorityDecision = {
        bodySha256: `sha256:${'d'.repeat(64)}`,
        commentId: 2,
        commentNodeId: 'IC_fixture_future',
        createdAt: '2026-08-09T06:00:00Z',
        decisionId: 'core-ui:decision:0004',
        issueNumber: 39,
        outcome: 'accepted',
        owner: 'ndrewtran',
        ownerNodeId: 'U_fixture',
        provider: 'github',
        repository: 'ndrewtran/core-ui',
        schema: 'core-ui-authority-decision-v1',
        url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-2',
      };
    }
  }
  const supersessionOwner = authorityDecision.owner;
  const supersessionEffectiveAt = authorityDecision.createdAt;
  authorityDecision = mutateAuthorityDecision(authorityDecision);
  const authorityDecisionBytes = canonicalJson(authorityDecision);
  await writeFile(join(root, authorityDecisionPath), authorityDecisionBytes);
  const supersession = mutate({
    affectedAssertions: historicalIndex.records
      .map(({ assertionId }) => assertionId)
      .sort(),
    authorization: {
      path: authorityDecisionPath,
      sha256: `sha256:${sha256(authorityDecisionBytes)}`,
    },
    currentApplicabilityManifest,
    disclosureClass: 'public-sanitized',
    effectiveAt: supersessionEffectiveAt,
    evidenceStatus: 'superseded',
    historicalIndex: {
      path: historicalPath,
      sha256: `sha256:${sha256(historicalBytes)}`,
    },
    owner: supersessionOwner,
    ...(previousSupersession ? {
      previousSupersession: {
        path: previousSupersession.supersessionPath,
        sha256: `sha256:${sha256(previousSupersession.supersessionBytes)}`,
      },
    } : {}),
    reasonCode: 'governing-authority-changed',
    replacementPlan: ['TALE-TOKEN-A', 'TALE-TOKEN-B', 'TALE-TOKEN-C'],
    replacementStatus: 'pending',
    schema: 'core-ui-evidence-applicability-supersession-v1',
    sourceRevision: 'a'.repeat(40),
    sourceTree: 'b'.repeat(40),
    supersededApplicabilityManifest,
    ...(!previousSupersession && recertification ? {
      supersededRecertification: {
        path: recertification.recertificationPath,
        sha256: `sha256:${sha256(recertification.recertificationBytes)}`,
      },
    } : {}),
  });
  const supersessionBytes = canonicalJson(supersession);
  await mkdir(join(root, `tests/evidence/${directory}/supersessions`), { recursive: true });
  await writeFile(join(root, supersessionPath), supersessionBytes);
  await writeFile(join(root, `tests/evidence/${directory}/index.json`), canonicalJson({
    supersessions: [{
      milestone: 'G0.0',
      path: supersessionPath,
      sha256: `sha256:${sha256(supersessionBytes)}`,
    }],
    records: [],
    schema: 'core-ui-evidence-index-v1',
    sourceRevision: 'a'.repeat(40),
    sourceTree: 'b'.repeat(40),
  }));
  return { supersession, supersessionBytes, supersessionPath };
}

async function assertEvidenceError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, code);
    return true;
  });
}

test('content-addressed evidence index verifies canonical records and artifacts', async () => {
  const { root } = await fixture();
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 0,
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('content-addressed evidence verifies one shared validation result', async () => {
  const { root } = await fixture({ validation: true });
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 0,
    indexCount: 1,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('applicability manifests ignore platform-specific install directories', async () => {
  const { root } = await fixture({ applicability: true });
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 0,
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
    supersessionCount: 0,
    indexCount: 2,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 1,
  });
});

test('append-only recertification extends through one digest-linked leaf', async () => {
  const { root } = await fixture({ applicability: true });
  const previous = await addRecertification(root);
  await addRecertificationContinuation(root, previous);
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 0,
    indexCount: 3,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 2,
  });
});

test('recertification rejects a fork from one predecessor', async () => {
  const { root } = await fixture({ applicability: true });
  const previous = await addRecertification(root);
  await addRecertificationContinuation(root, previous, { name: 'first' });
  await addRecertificationContinuation(root, previous, { name: 'second' });
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_RECERTIFICATION_FORK');
    return true;
  });
});

test('recertification rejects a predecessor cycle', async () => {
  const { root } = await fixture({ applicability: true });
  const previous = await addRecertification(root);
  await addRecertificationContinuation(root, previous, {
    mutate: (value) => ({
      ...value,
      previousRecertification: {
        path: 'tests/evidence/g0.2/recertifications/G0.0.json',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    }),
  });
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_RECERTIFICATION_CYCLE');
    return true;
  });
});

test('recertification rejects a stale terminal certificate', async () => {
  const { root } = await fixture({ applicability: true });
  const previous = await addRecertification(root);
  await addRecertificationContinuation(root, previous);
  await writeFile(join(root, 'packages/source/owned.txt'), 'changed-after-leaf\n');
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_APPLICABILITY_MISMATCH');
    return true;
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

test('append-only supersession preserves a superseded historical index', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root);
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 1,
    indexCount: 2,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('append-only supersession supersedes one exact terminal recertification', async () => {
  const { root } = await fixture({ applicability: true });
  const recertification = await addRecertification(root);
  await addApplicabilitySupersession(root, { recertification });
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 1,
    indexCount: 3,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 1,
  });
});

test('append-only supersession extends through one digest-linked leaf', async () => {
  const { root } = await fixture({ applicability: true });
  const previousSupersession = await addApplicabilitySupersession(root);
  await addApplicabilitySupersession(root, {
    directory: 'supersession-next',
    previousSupersession,
  });
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 2,
    indexCount: 3,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('a later Tale continuation uses its own standard authority decision', async () => {
  const { root } = await fixture({ applicability: true });
  const authorityRoot = await addApplicabilitySupersession(root);
  const annexTransition = await addApplicabilitySupersession(root, {
    directory: 'supersession-next',
    previousSupersession: authorityRoot,
  });
  await addApplicabilitySupersession(root, {
    continuationDecision: 4,
    directory: 'supersession-future',
    previousSupersession: annexTransition,
  });
  assert.deepEqual(await verifyEvidence(root), {
    supersessionCount: 3,
    indexCount: 4,
    recordCount: 1,
    artifactCount: 1,
    recertificationCount: 0,
  });
});

test('Tale authority continuation requires the exact acceptance authorization path', async () => {
  const { root } = await fixture({ applicability: true });
  const previous = await addApplicabilitySupersession(root);
  await addApplicabilitySupersession(root, {
    directory: 'supersession-next',
    previousSupersession: previous,
    mutate(value) {
      value.authorization = previous.supersession.authorization;
      value.owner = previous.supersession.owner;
      value.effectiveAt = previous.supersession.effectiveAt;
      return value;
    },
  });
  await assertEvidenceError(
    verifyEvidence(root),
    'EVIDENCE_SUPERSESSION_ACCEPTANCE_REQUIRED',
  );
});

test('supersession rejects a wrong historical digest', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root, {
    mutate: (value) => ({
      ...value,
      historicalIndex: {
        ...value.historicalIndex,
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    }),
  });
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_SUPERSESSION_INVALID');
    return true;
  });
});

test('supersession rejects a wrong terminal recertification', async () => {
  const { root } = await fixture({ applicability: true });
  const recertification = await addRecertification(root);
  await addApplicabilitySupersession(root, {
    recertification,
    mutate: (value) => ({
      ...value,
      supersededRecertification: {
        ...value.supersededRecertification,
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    }),
  });
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_SUPERSESSION_INVALID');
    return true;
  });
});

test('supersession cannot supersede an unchanged applicability manifest', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root, {
    mutate: (value) => ({
      ...value,
      currentApplicabilityManifest: value.supersededApplicabilityManifest,
    }),
  });
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_SUPERSESSION_INVALID');
    return true;
  });
});

test('supersession rejects a stale terminal current manifest', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root);
  await writeFile(join(root, 'packages/source/owned.txt'), 'changed-after-supersession\n');
  await assert.rejects(verifyEvidence(root), (error) => {
    assert.ok(error instanceof EvidenceIntegrityError);
    assert.equal(error.code, 'EVIDENCE_APPLICABILITY_MISMATCH');
    return true;
  });
});

test('supersession rejects unknown top-level and nested manifest fields', async () => {
  const topLevel = await fixture({ applicability: true });
  await addApplicabilitySupersession(topLevel.root, {
    mutate: (value) => ({ ...value, unexpected: true }),
  });
  await assertEvidenceError(
    verifyEvidence(topLevel.root),
    'EVIDENCE_SUPERSESSION_SCHEMA_INVALID',
  );

  const nested = await fixture({ applicability: true });
  await addApplicabilitySupersession(nested.root, {
    mutate: (value) => ({
      ...value,
      currentApplicabilityManifest: {
        ...value.currentApplicabilityManifest,
        unexpected: true,
      },
    }),
  });
  await assertEvidenceError(
    verifyEvidence(nested.root),
    'EVIDENCE_SUPERSESSION_SCHEMA_INVALID',
  );

  const recertificationReference = await fixture({ applicability: true });
  const recertification = await addRecertification(recertificationReference.root);
  await addApplicabilitySupersession(recertificationReference.root, {
    recertification,
    mutate: (value) => ({
      ...value,
      supersededRecertification: {
        ...value.supersededRecertification,
        milestone: 'G0.0',
      },
    }),
  });
  await assertEvidenceError(
    verifyEvidence(recertificationReference.root),
    'EVIDENCE_SUPERSESSION_SCHEMA_INVALID',
  );
});

test('supersession rejects malformed status, owner, and timestamp identities', async () => {
  for (const mutate of [
    (value) => ({ ...value, evidenceStatus: 'valid' }),
    (value) => ({ ...value, owner: 'not an owner' }),
    (value) => ({ ...value, effectiveAt: '2026-99-99T99:99:99Z' }),
  ]) {
    const { root } = await fixture({ applicability: true });
    await addApplicabilitySupersession(root, { mutate });
    await assertEvidenceError(
      verifyEvidence(root),
      'EVIDENCE_SUPERSESSION_SCHEMA_INVALID',
    );
  }
});

test('supersession rejects malformed or internally inconsistent authorization', async () => {
  const malformed = await fixture({ applicability: true });
  await addApplicabilitySupersession(malformed.root, {
    mutateAuthorityDecision: (value) => ({
      ...value,
      createdAt: '2026-99-99T99:99:99Z',
    }),
  });
  await assertEvidenceError(
    verifyEvidence(malformed.root),
    'EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID',
  );

  const inconsistent = await fixture({ applicability: true });
  await addApplicabilitySupersession(inconsistent.root, {
    mutateAuthorityDecision: (value) => ({ ...value, issueNumber: 40 }),
  });
  await assertEvidenceError(
    verifyEvidence(inconsistent.root),
    'EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID',
  );
});

test('supersession rejects duplicate references', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root);
  const indexPath = join(root, 'tests/evidence/supersession/index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  index.supersessions.push(index.supersessions[0]);
  await writeFile(indexPath, canonicalJson(index));
  await assertEvidenceError(
    verifyEvidence(root),
    'EVIDENCE_SUPERSESSION_DUPLICATE_REFERENCE',
  );
});

test('supersession rejects a reference milestone that differs from its target index', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root);
  const indexPath = join(root, 'tests/evidence/supersession/index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  index.supersessions[0].milestone = 'Wrong milestone';
  await writeFile(indexPath, canonicalJson(index));
  await assertEvidenceError(
    verifyEvidence(root),
    'EVIDENCE_SUPERSESSION_MILESTONE_MISMATCH',
  );
});

test('supersession rejects an unknown target or missing predecessor', async () => {
  const unknownTarget = await fixture({ applicability: true });
  await addApplicabilitySupersession(unknownTarget.root, {
    mutate: (value) => ({
      ...value,
      historicalIndex: {
        ...value.historicalIndex,
        path: 'tests/evidence/unknown/index.json',
      },
    }),
  });
  await assertEvidenceError(
    verifyEvidence(unknownTarget.root),
    'EVIDENCE_SUPERSESSION_INVALID',
  );

  const missingPredecessor = await fixture({ applicability: true });
  const previousSupersession = await addApplicabilitySupersession(missingPredecessor.root);
  await addApplicabilitySupersession(missingPredecessor.root, {
    directory: 'supersession-next',
    previousSupersession,
    mutate: (value) => ({
      ...value,
      previousSupersession: {
        path: 'tests/evidence/missing/supersession.json',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    }),
  });
  await assertEvidenceError(
    verifyEvidence(missingPredecessor.root),
    'EVIDENCE_SUPERSESSION_INVALID',
  );
});

test('supersession rejects a predecessor from another historical target', async () => {
  const { root } = await fixture({ applicability: true });
  const historicalBytes = await readFile(join(root, 'tests/evidence/g0.0/index.json'), 'utf8');
  await mkdir(join(root, 'tests/evidence/g0.alt'), { recursive: true });
  await writeFile(join(root, 'tests/evidence/g0.alt/index.json'), historicalBytes);
  const previousSupersession = await addApplicabilitySupersession(root);
  await addApplicabilitySupersession(root, {
    directory: 'supersession-cross-target',
    historicalPath: 'tests/evidence/g0.alt/index.json',
    previousSupersession,
  });
  await writeFile(
    join(root, 'packages/source/owned.txt'),
    'repository-owned-supersession-G0.0\n',
  );
  await assertEvidenceError(
    verifyEvidence(root),
    'EVIDENCE_SUPERSESSION_INVALID',
  );
});

test('supersession rejects forks and self-referential cycles', async () => {
  const fork = await fixture({ applicability: true });
  const forkRoot = await addApplicabilitySupersession(fork.root);
  await addApplicabilitySupersession(fork.root, {
    directory: 'supersession-left',
    previousSupersession: forkRoot,
  });
  await addApplicabilitySupersession(fork.root, {
    directory: 'supersession-right',
    previousSupersession: forkRoot,
  });
  await assertEvidenceError(
    verifyEvidence(fork.root),
    'EVIDENCE_SUPERSESSION_FORK',
  );

  const cycle = await fixture({ applicability: true });
  await addApplicabilitySupersession(cycle.root, {
    mutate: (value) => ({
      ...value,
      previousSupersession: {
        path: 'tests/evidence/supersession/supersessions/G0.0.json',
        sha256: `sha256:${'0'.repeat(64)}`,
      },
    }),
  });
  await assertEvidenceError(
    verifyEvidence(cycle.root),
    'EVIDENCE_SUPERSESSION_CYCLE',
  );
});

test('a passing recertification cannot extend a superseded chain', async () => {
  const { root } = await fixture({ applicability: true });
  const recertification = await addRecertification(root);
  await addApplicabilitySupersession(root, { recertification });
  await addRecertificationContinuation(root, recertification);
  await assertEvidenceError(
    verifyEvidence(root),
    'EVIDENCE_RECERTIFICATION_AFTER_SUPERSESSION',
  );

  const withoutPriorRecertification = await fixture({ applicability: true });
  await addApplicabilitySupersession(withoutPriorRecertification.root);
  await addRecertification(withoutPriorRecertification.root);
  await assertEvidenceError(
    verifyEvidence(withoutPriorRecertification.root),
    'EVIDENCE_RECERTIFICATION_AFTER_SUPERSESSION',
  );
});
