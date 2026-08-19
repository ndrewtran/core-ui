import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { join } from 'node:path';
import {
  R1_ENTRY_BINDING,
  STAGE1_ARTIFACTS,
  STAGE1_SOURCE,
  verifyReactR1Entry,
  verifyReactAriaStage1Source,
} from '../src/react-aria-stage1-source-verify.mjs';

const repositoryRoot = join(import.meta.dirname, '../../../..');
const r1AcceptancePath = 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md';
const r1ManifestPath = 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json';
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const renderTemplate = (template, substitutions) => Object.entries(substitutions).reduce(
  (output, [name, value]) => output.replaceAll(`{${name}}`, value),
  template,
);

const writeR1Acceptance = (fixtureRoot) => {
  const manifestBytes = fs.readFileSync(join(fixtureRoot, r1ManifestPath));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const manifestSha256 = sha256(manifestBytes);
  const ownerCommentUrl = 'https://github.com/ndrewtran/core-ui/pull/87#issuecomment-1';
  const ownerStatement = renderTemplate(manifest.acceptanceRecordRenderer.ownerStatementTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
  });
  fs.writeFileSync(join(fixtureRoot, r1AcceptancePath), renderTemplate(
    manifest.acceptanceRecordRenderer.outputTemplate,
    {
      candidateSha256: manifest.candidate.digest,
      manifestSha256,
      ownerCommentUrl,
      ownerStatement,
      ownerStatementSha256: sha256(ownerStatement),
    },
  ));
};

const makeR1Fixture = (receiptState = 'staged') => {
  const fixtureRoot = fs.mkdtempSync(join(tmpdir(), 'core-ui-r1-entry-fixture-'));
  execFileSync('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, fixtureRoot], {
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', '--quiet', '--detach', 'HEAD'], {cwd: fixtureRoot, stdio: 'ignore'});
  const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  for (const relativePath of stagedPaths) {
    const destination = join(fixtureRoot, relativePath);
    fs.mkdirSync(join(destination, '..'), {recursive: true});
    fs.copyFileSync(join(repositoryRoot, relativePath), destination);
  }
  execFileSync('git', ['rm', '--ignore-unmatch', '--', r1AcceptancePath], {
    cwd: fixtureRoot,
    stdio: 'ignore',
  });
  if (receiptState !== 'absent') writeR1Acceptance(fixtureRoot);
  if (receiptState === 'staged') {
    execFileSync('git', ['add', '--', r1AcceptancePath], {cwd: fixtureRoot, stdio: 'ignore'});
  } else if (receiptState === 'intent-to-add') {
    execFileSync('git', ['add', '-N', '--', r1AcceptancePath], {cwd: fixtureRoot, stdio: 'ignore'});
  }
  return fixtureRoot;
};

test('Stage 1 verifier binds the committed source and accepted artifact identities', async () => {
  const result = verifyReactAriaStage1Source(repositoryRoot);
  assert.deepEqual(result.source, STAGE1_SOURCE);
  assert.deepEqual(result.counts, {families: 53, newImmutableIds: 45, reusedIds: 8, rawExports: 613});

  const decision = await readFile(join(repositoryRoot, 'decisions/0010-amendment-03-comprehensive-react-0-1.md'), 'utf8');
  assert.equal(decision.includes(
    'evaluation tool: '
      + `${STAGE1_ARTIFACTS.evaluator.bytes.toLocaleString('en-US')} bytes, SHA-256\n  \`${STAGE1_ARTIFACTS.evaluator.sha256}\``,
  ), true);
  assert.equal(decision.includes(
    'evaluation snapshot: '
      + `${STAGE1_ARTIFACTS.snapshot.bytes.toLocaleString('en-US')} bytes, SHA-256\n  \`${STAGE1_ARTIFACTS.snapshot.sha256}\``,
  ), true);
  assert.equal(decision.includes(
    'snapshot identity envelope: '
      + `${STAGE1_ARTIFACTS.envelope.bytes.toLocaleString('en-US')} bytes, SHA-256\n  \`${STAGE1_ARTIFACTS.envelope.sha256}\``,
  ), true);
});

test('Stage 1 verifier rejects moving and drifting source selectors', () => {
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, {sourceRef: 'origin/main'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, {sourceRef: '0000000000000000000000000000000000000000'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: committed source/u,
  );
});

test('R1.0 entry gate accepts only current authority and remains closed pending current evidence', async () => {
  for (const receiptState of ['absent', 'worktree-only', 'intent-to-add']) {
    const fixtureRoot = makeR1Fixture(receiptState);
    try {
      assert.throws(
        () => verifyReactR1Entry(fixtureRoot),
        /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
      );
    } finally {
      fs.rmSync(fixtureRoot, {recursive: true, force: true});
    }
  }
  const fixtureRoot = makeR1Fixture();
  try {
  const result = verifyReactR1Entry(fixtureRoot);
  assert.equal(result.accepted, true);
  assert.equal(result.productScope.version, '6.0.1');
  assert.equal(result.decision.sha256, R1_ENTRY_BINDING.decision.sha256);
  assert.equal(result.stage1.accepted, true);
  assert.deepEqual(result.applicability, {
    currentEvidenceLocator: null,
    historicalEvidence: {sufficient: false, status: 'historical-only'},
    status: 'pending-current-evidence',
  });
  assert.equal(result.activation.permitted, false);

  const historicalProductScope = execFileSync(
    'git', ['show', `${STAGE1_SOURCE.commit}:strategy/product-scope.md`], {cwd: fixtureRoot, encoding: 'utf8'},
  );
  const acceptedRoadmap = execFileSync(
    'git', ['show', 'HEAD:strategy/milestone-roadmap.md'], {cwd: repositoryRoot, encoding: 'utf8'},
  );
  assert.throws(
    () => verifyReactR1Entry(fixtureRoot, {
      productScopeSource: historicalProductScope,
      roadmapSource: acceptedRoadmap,
    }),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
  );
  assert.throws(
    () => verifyReactR1Entry(fixtureRoot, {stage1SourceRef: 'origin/main'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
  const replacedDecision = (await readFile(join(fixtureRoot, R1_ENTRY_BINDING.decision.path), 'utf8'))
    .replace(STAGE1_ARTIFACTS.snapshot.sha256, '0'.repeat(64));
  assert.throws(
    () => verifyReactR1Entry(fixtureRoot, {decisionSource: replacedDecision}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Decision/u,
  );
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
});
