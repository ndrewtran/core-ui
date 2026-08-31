import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { canonicalJson } from '../src/canonical-json.mjs';
import {
  EvidenceIntegrityError,
  hasUnsanitizedEvidenceOutput,
  resolveG12EvidenceIdentity,
  verifyEvidence,
} from '../src/evidence-verify.mjs';
import { sha256 } from '../src/policy.mjs';
import { acceptanceCommentBody } from '../src/tale-token-annex-acceptance.mjs';
import { assertAuthorityDecisionShape } from '../src/evidence-applicability-supersession.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../../../..');

async function git(root, ...args) {
  return (await execFile('git', args, { cwd: root, encoding: 'utf8' })).stdout.trim();
}

async function commitApplicabilitySource(root, path, message) {
  try {
    await git(root, 'rev-parse', '--git-dir');
  } catch {
    await git(root, 'init', '-q', '-b', 'main');
    await git(root, 'config', 'user.name', 'Fixture');
    await git(root, 'config', 'user.email', 'fixture@example.invalid');
  }
  await git(root, 'add', '--', path);
  let stagedChange = true;
  try {
    await git(root, 'diff', '--cached', '--quiet', '--exit-code');
    stagedChange = false;
  } catch {}
  if (stagedChange) await git(root, 'commit', '-q', '-m', message);
  return {
    sourceRevision: await git(root, 'rev-parse', 'HEAD'),
    sourceTree: await git(root, 'rev-parse', 'HEAD^{tree}'),
  };
}

async function g12TopologyFixture({ extraEvidencePath = false, preexistingRootPayload = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'muxui-g12-topology-'));
  await git(root, 'init', '-q', '-b', 'main');
  await git(root, 'config', 'user.name', 'Fixture');
  await git(root, 'config', 'user.email', 'fixture@example.invalid');
  await writeFile(join(root, 'base.txt'), 'base\n');
  await git(root, 'add', 'base.txt');
  await git(root, 'commit', '-q', '-m', 'base');
  await git(root, 'switch', '-q', '-c', 'topic');
  await writeFile(join(root, 'source.txt'), 'source\n');
  if (preexistingRootPayload) {
    await mkdir(join(root, 'tests/evidence/g1.2/artifacts'), { recursive: true });
    await writeFile(join(root, 'tests/evidence/g1.2/artifacts/preexisting.json'), '{}\n');
  }
  await git(root, 'add', 'source.txt');
  if (preexistingRootPayload) await git(root, 'add', 'tests/evidence/g1.2/artifacts/preexisting.json');
  await git(root, 'commit', '-q', '-m', 'source');
  const sourceRevision = await git(root, 'rev-parse', 'HEAD');
  const sourceTree = await git(root, 'rev-parse', 'HEAD^{tree}');
  await mkdir(join(root, 'tests/evidence/g1.2'), { recursive: true });
  await mkdir(join(root, 'tests/evidence/authority-11-g1-2-applicability-v1'), { recursive: true });
  await writeFile(join(root, 'tests/evidence/g1.2/index.json'), '{}\n');
  await writeFile(join(root, 'tests/evidence/authority-11-g1-2-applicability-v1/index.json'), '{}\n');
  if (extraEvidencePath) await writeFile(join(root, 'unrelated.txt'), 'unrelated\n');
  await git(root, 'add', '.');
  await git(root, 'commit', '-q', '-m', 'evidence');
  const evidenceRevision = await git(root, 'rev-parse', 'HEAD');
  const evidenceTree = await git(root, 'rev-parse', 'HEAD^{tree}');
  await git(root, 'switch', '-q', 'main');
  await git(root, 'merge', '-q', '--no-ff', 'topic', '-m', 'synthetic merge');
  const mergeRevision = await git(root, 'rev-parse', 'HEAD');
  await git(root, 'switch', '-q', 'topic');
  await writeFile(join(root, 'after-evidence.txt'), 'unchanged descendant\n');
  await git(root, 'add', 'after-evidence.txt');
  await git(root, 'commit', '-q', '-m', 'unchanged descendant');
  const unchangedDescendant = await git(root, 'rev-parse', 'HEAD');
  return { evidenceRevision, evidenceTree, mergeRevision, root, sourceRevision, sourceTree, unchangedDescendant };
}

test('authority decision receipts admit exact OWNER association and edit timestamp provenance', () => {
  const value = {
    authorAssociation: 'OWNER',
    bodySha256: `sha256:${'0'.repeat(64)}`,
    commentId: 1,
    commentNodeId: 'comment-node',
    createdAt: '2026-08-12T00:00:00Z',
    decisionId: 'core-ui:decision:0007',
    issueNumber: 54,
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: 'owner-node',
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-authority-decision-v1',
    updatedAt: '2026-08-12T00:00:00Z',
    url: 'https://github.com/ndrewtran/core-ui/issues/54#issuecomment-1',
  };
  assertAuthorityDecisionShape(value, (message) => { throw new Error(message); });
  assert.throws(
    () => assertAuthorityDecisionShape({ ...value, authorAssociation: 'CONTRIBUTOR' }, (message) => { throw new Error(message); }),
    /must be OWNER/,
  );
});

test('authority decision receipts admit truthful bounded task provenance without a fabricated human timestamp or comment', () => {
  const value = {
    candidate: { byteLength: 1, path: 'decisions/0009-delivery-review-readiness.json', sha256: `sha256:${'0'.repeat(64)}` },
    decisionId: 'core-ui:decision:0009',
    issueNumber: 58,
    manifest: { entryCount: 2, profile: 'core-ui-proposed-source-artifact-manifest-v1', sha256: `sha256:${'1'.repeat(64)}` },
    outcome: 'accepted',
    owner: 'ndrewtran',
    plan: { path: '/tmp/core-ui-review-readiness-proposal-v1.final.md', sha256: 'sha256:43a7b1724b4e107e253703952ac4839f7c99880f4b96e56b8e73e56de1aded7d' },
    provider: 'codex-task',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-task-provenance-authority-acceptance-v1',
    taskProvenance: {
      approvalInstruction: 'exact-plan-approved-for-bounded-execution',
      approvalTimestamp: null,
      githubCommentClaimed: false,
      taskId: '019ff5d8-5a4b-7252-958d-bab8b0087c34',
    },
  };
  assert.doesNotThrow(() => assertAuthorityDecisionShape(value, (message) => { throw new Error(message); }));
  assert.throws(() => assertAuthorityDecisionShape({
    ...value,
    taskProvenance: { ...value.taskProvenance, githubCommentClaimed: true },
  }, (message) => { throw new Error(message); }), /truthful approval boundary/);
});

test('evidence output privacy recognizes canonical token IDs without accepting credentials', () => {
  const root = '/workspace/muxui';
  assert.equal(hasUnsanitizedEvidenceOutput(
    '{"artifactId":"muxui:token:default-theme"}',
    root,
  ), false);
  assert.equal(hasUnsanitizedEvidenceOutput('token=secret-value', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('foo:token=secret-value', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('muxui:token=secret-value', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('auth:token: secret-value', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('x:token:secret-value', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('"muxui:token:default--theme"', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('"muxui:token:default.theme"', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('"muxui:token:default/theme"', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('"muxui:token:default-theme:secret"', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('authorization: Bearer-secret', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('api-key=secret-value', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('/Users/example/private.txt', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('/private/var/folders/example/private.txt', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('/private/tmp/muxui-evidence/private.txt', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('/var/folders/example/private.txt', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('/tmp/muxui-evidence/private.txt', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput('C:\\Users\\example\\private.txt', root), true);
  assert.equal(hasUnsanitizedEvidenceOutput(`${root}/packages/tokens`, root), true);
});

test('evidence verification rejects an in-progress G1.2 publication journal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'muxui-evidence-transaction-'));
  await mkdir(join(root, 'tests/evidence'), { recursive: true });
  await writeFile(join(root, 'tests/evidence/.g1-2-transaction.json'), canonicalJson({
    profile: 'muxui-g1-2-evidence-transaction-v1',
    roots: ['tests/evidence/authority-11-g1-2-applicability-v1', 'tests/evidence/g1.2'],
    transactionPath: 'tests/.g1-2-transaction-fixture',
  }));
  await assert.rejects(
    verifyEvidence(root),
    (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_TRANSACTION_INCOMPLETE',
  );
});

test('G1.2 topology resolves the exact evidence child from direct and synthetic-merge heads', async () => {
  const fixture = await g12TopologyFixture();
  const expected = {
    evidenceRevision: fixture.evidenceRevision,
    evidenceTree: fixture.evidenceTree,
    sourceRevision: fixture.sourceRevision,
    sourceTree: fixture.sourceTree,
  };
  assert.deepEqual(
    await resolveG12EvidenceIdentity(fixture.root, fixture.evidenceRevision),
    expected,
  );
  assert.deepEqual(
    await resolveG12EvidenceIdentity(fixture.root, fixture.mergeRevision),
    expected,
  );
  assert.deepEqual(
    await resolveG12EvidenceIdentity(fixture.root, fixture.unchangedDescendant),
    expected,
  );
});

test('G1.2 topology rejects an evidence introduction containing unrelated paths', async () => {
  const fixture = await g12TopologyFixture({ extraEvidencePath: true });
  await assert.rejects(
    resolveG12EvidenceIdentity(fixture.root, fixture.mergeRevision),
    (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_G12_TOPOLOGY_INVALID',
  );
});

test('G1.2 topology rejects roots partially present in the source parent', async () => {
  const fixture = await g12TopologyFixture({ preexistingRootPayload: true });
  await assert.rejects(
    resolveG12EvidenceIdentity(fixture.root, fixture.evidenceRevision),
    (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_G12_TOPOLOGY_INVALID',
  );
});

test('G1.2 topology rejects descendant and merge revisions that rewrite either evidence root', async () => {
  const fixture = await g12TopologyFixture();
  await git(fixture.root, 'switch', '-q', 'topic');
  await writeFile(join(fixture.root, 'tests/evidence/g1.2/index.json'), '{"changed":true}\n');
  await git(fixture.root, 'add', 'tests/evidence/g1.2/index.json');
  await git(fixture.root, 'commit', '-q', '-m', 'rewrite evidence');
  const changedDescendant = await git(fixture.root, 'rev-parse', 'HEAD');
  await assert.rejects(
    resolveG12EvidenceIdentity(fixture.root, changedDescendant),
    (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_G12_TOPOLOGY_INVALID',
  );
  await git(fixture.root, 'switch', '-q', 'main');
  await git(fixture.root, 'merge', '-q', '--no-ff', 'topic', '-m', 'merge rewritten evidence');
  const changedMerge = await git(fixture.root, 'rev-parse', 'HEAD');
  await assert.rejects(
    resolveG12EvidenceIdentity(fixture.root, changedMerge),
    (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_G12_TOPOLOGY_INVALID',
  );
});

test('G1.2 topology rejects parallel byte-identical evidence introductions', async () => {
  const fixture = await g12TopologyFixture();
  await git(fixture.root, 'switch', '-q', '-c', 'parallel-evidence', fixture.sourceRevision);
  await mkdir(join(fixture.root, 'tests/evidence/g1.2'), { recursive: true });
  await mkdir(join(fixture.root, 'tests/evidence/authority-11-g1-2-applicability-v1'), { recursive: true });
  await writeFile(join(fixture.root, 'tests/evidence/g1.2/index.json'), '{}\n');
  await writeFile(join(fixture.root, 'tests/evidence/authority-11-g1-2-applicability-v1/index.json'), '{}\n');
  await git(fixture.root, 'add', 'tests/evidence');
  await git(fixture.root, 'commit', '-q', '-m', 'parallel evidence');
  await git(fixture.root, 'switch', '-q', 'main');
  await git(fixture.root, 'merge', '-q', '--no-ff', 'parallel-evidence', '-m', 'merge parallel evidence');
  const parallelMerge = await git(fixture.root, 'rev-parse', 'HEAD');
  await assert.rejects(
    resolveG12EvidenceIdentity(fixture.root, parallelMerge),
    (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_G12_TOPOLOGY_INVALID',
  );
});

async function fixture({
  applicability = false,
  validation = false,
  recordOnlyValidation = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'muxui-evidence-'));
  await mkdir(join(root, 'tests/evidence/g0.0/artifacts'), { recursive: true });
  await mkdir(join(root, 'tests/evidence/g0.0/records'), { recursive: true });
  const artifactPath = 'tests/evidence/g0.0/artifacts/E-G0.0-01.json';
  const recordPath = 'tests/evidence/g0.0/records/E-G0.0-01.json';
  const artifactBytes = canonicalJson({ assertionId: 'E-G0.0-01', outcome: 'pass' });
  await writeFile(join(root, artifactPath), artifactBytes);
  const validationPath = 'tests/evidence/g0.0/verification.json';
  let sourceIdentity = {
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
    sourceIdentity = await commitApplicabilitySource(root, ownedPath, 'initial source');
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
  const validationValue = sourceIdentity;
  const validationReference = hasValidation ? {
    path: validationPath,
    sha256: `sha256:${sha256(canonicalJson(validationValue))}`,
  } : undefined;
  if (hasValidation) await writeFile(join(root, validationPath), canonicalJson(validationValue));
  const recordBytes = canonicalJson({
    artifact: { path: artifactPath, sha256: `sha256:${sha256(artifactBytes)}` },
    assertionId: 'E-G0.0-01',
    ...sourceIdentity,
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
      sourceRevision: sourceIdentity.sourceRevision,
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
  const sourceIdentity = await commitApplicabilitySource(root, ownedPath, 'recertification source');
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
    ...sourceIdentity,
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
    ...sourceIdentity,
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
  const currentBytes = 'repository-owned-next-current\n';
  await writeFile(join(root, ownedPath), currentBytes);
  const sourceIdentity = await commitApplicabilitySource(root, ownedPath, `recertification ${name} source`);
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
    ...sourceIdentity,
  });
  const recertificationBytes = canonicalJson(recertification);
  await mkdir(join(root, 'tests/evidence/g0.2/recertifications'), { recursive: true });
  await writeFile(join(root, recertificationPath), recertificationBytes);
  const indexPath = join(root, 'tests/evidence/g0.2/index.json');
  let index = {
    records: [],
    recertifications: [],
    ...sourceIdentity,
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
  const sourceIdentity = await commitApplicabilitySource(root, ownedPath, `${directory} ${name} source`);
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
    ...sourceIdentity,
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
    ...sourceIdentity,
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

test('applicability manifests reject a missing path at the recorded source', async () => {
  const { root } = await fixture({ applicability: true });
  const recordPath = 'tests/evidence/g0.0/records/E-G0.0-01.json';
  const indexPath = 'tests/evidence/g0.0/index.json';
  const record = JSON.parse(await readFile(join(root, recordPath), 'utf8'));
  const index = JSON.parse(await readFile(join(root, indexPath), 'utf8'));
  const missingManifest = {
    algorithm: 'sha256',
    paths: ['packages/source/missing.txt'],
    profile: 'core-ui-path-manifest-v1',
    sha256: `sha256:${sha256(canonicalJson([]))}`,
  };
  const recordBytes = canonicalJson({ ...record, applicabilityManifest: missingManifest });
  await writeFile(join(root, recordPath), recordBytes);
  await writeFile(join(root, indexPath), canonicalJson({
    ...index,
    applicabilityManifest: missingManifest,
    records: [{
      ...index.records[0],
      sha256: `sha256:${sha256(recordBytes)}`,
    }],
  }));
  await assertEvidenceError(
    verifyEvidence(root),
    'EVIDENCE_MANIFEST_ENTRY_INVALID',
  );
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

test('recertification remains an exact historical audit after later worktree change', async () => {
  const { root } = await fixture({ applicability: true });
  const previous = await addRecertification(root);
  await addRecertificationContinuation(root, previous);
  await writeFile(join(root, 'packages/source/owned.txt'), 'changed-after-leaf\n');
  assert.ok((await verifyEvidence(root)).recertificationCount > 0);
});

test('retained evidence integrity does not treat later worktree bytes as current proof', async () => {
  const { root } = await fixture({ applicability: true });
  await writeFile(join(root, 'packages/source/owned.txt'), 'changed\n');
  assert.equal((await verifyEvidence(root)).recordCount, 1);
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

test('supersession remains an exact historical audit after later worktree change', async () => {
  const { root } = await fixture({ applicability: true });
  await addApplicabilitySupersession(root);
  await writeFile(join(root, 'packages/source/owned.txt'), 'changed-after-supersession\n');
  assert.equal((await verifyEvidence(root)).supersessionCount, 1);
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
