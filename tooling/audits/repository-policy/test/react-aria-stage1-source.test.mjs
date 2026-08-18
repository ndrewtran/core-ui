import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  const result = verifyReactR1Entry(repositoryRoot);
  assert.equal(result.accepted, true);
  assert.equal(result.productScope.version, '6.0.0');
  assert.equal(result.decision.sha256, R1_ENTRY_BINDING.decision.sha256);
  assert.equal(result.stage1.accepted, true);
  assert.deepEqual(result.applicability, {
    currentEvidenceLocator: null,
    historicalEvidence: {sufficient: false, status: 'historical-only'},
    status: 'pending-current-evidence',
  });
  assert.equal(result.activation.permitted, false);

  const historicalProductScope = await import('node:child_process').then(({execFileSync}) => execFileSync(
    'git', ['show', `${STAGE1_SOURCE.commit}:strategy/product-scope.md`], {cwd: repositoryRoot, encoding: 'utf8'},
  ));
  assert.throws(
    () => verifyReactR1Entry(repositoryRoot, {productScopeSource: historicalProductScope}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
  );
  assert.throws(
    () => verifyReactR1Entry(repositoryRoot, {stage1SourceRef: 'origin/main'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
  const replacedDecision = (await readFile(join(repositoryRoot, R1_ENTRY_BINDING.decision.path), 'utf8'))
    .replace(STAGE1_ARTIFACTS.snapshot.sha256, '0'.repeat(64));
  assert.throws(
    () => verifyReactR1Entry(repositoryRoot, {decisionSource: replacedDecision}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Decision/u,
  );
});
