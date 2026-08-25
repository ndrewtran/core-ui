import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import {
  STAGE1_ARTIFACTS,
  STAGE1_SOURCE,
  verifyReactAriaStage1Source,
} from '../src/react-aria-stage1-source-verify.mjs';

const repositoryRoot = join(import.meta.dirname, '../../../..');

test('Stage 1 verifier binds immutable source, evaluator, snapshot, envelope, and counts', () => {
  const result = verifyReactAriaStage1Source(repositoryRoot);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.source, STAGE1_SOURCE);
  assert.deepEqual(result.counts, { families: 53, newImmutableIds: 45, reusedIds: 8, rawExports: 613 });
  assert.deepEqual(result.artifacts, {
    evaluator: { bytes: STAGE1_ARTIFACTS.evaluator.bytes, sha256: STAGE1_ARTIFACTS.evaluator.sha256 },
    snapshot: { bytes: STAGE1_ARTIFACTS.snapshot.bytes, sha256: STAGE1_ARTIFACTS.snapshot.sha256 },
    envelope: { bytes: STAGE1_ARTIFACTS.envelope.bytes, sha256: STAGE1_ARTIFACTS.envelope.sha256 },
  });
});

test('Stage 1 verifier rejects moving, malformed, and drifted source selectors', () => {
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, { sourceRef: 'origin/main' }),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, { sourceRef: '0'.repeat(40) }),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: committed source/u,
  );
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, { sourceRef: 'not-a-commit' }),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
});
