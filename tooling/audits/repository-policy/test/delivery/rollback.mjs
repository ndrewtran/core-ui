import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalDigest, sha256Digest } from '@core-ui/schema';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { validateDeliveryRollback } from '../../src/delivery-rollback.mjs';

const COMMIT = (character) => character.repeat(40);
const DIGEST = (character) => `sha256:${character.repeat(64)}`;

function rollbackFixture(contract) {
  const firstPaths = [{ path: 'tooling/a', sha256: DIGEST('1') }];
  const secondPaths = [{ path: 'tests/b', sha256: DIGEST('2') }];
  const current = { commit: COMMIT('4'), tree: COMMIT('5') };
  const observedReferenceMatches = Object.entries(contract.profile.referenceScanCommands).sort(([left], [right]) => left.localeCompare(right)).map(([commandRef, command]) => ({
    commandDigest: canonicalDigest(command), commandRef, currentCommit: current.commit, currentTree: current.tree,
    exitState: 0, matchesDigest: canonicalDigest(['live-reference']), proofToolRecordDigest: DIGEST('6'),
    proofToolRecordId: 'proof-tool', proofToolRecordProfile: 'core-ui-proof-tool-identity-v1',
    resultDigest: DIGEST('7'), stderrDigest: DIGEST('8'), stdoutDigest: DIGEST('9'),
  }));
  const workflowWriteSet = [...firstPaths, ...secondPaths];
  return {
    boundaries: [
      { commit: COMMIT('1'), id: 'RB-01', parent: COMMIT('0'), pathManifestDigest: canonicalDigest(firstPaths), paths: firstPaths, tree: COMMIT('a') },
      { commit: COMMIT('2'), id: 'RB-02', parent: COMMIT('1'), pathManifestDigest: canonicalDigest(secondPaths), paths: secondPaths, tree: COMMIT('b') },
    ],
    changedPathSet: [], completedPostconditions: [], completedSteps: [], current,
    failedStep: contract.profile.recoverySteps[0], featureBase: { commit: COMMIT('0'), tree: COMMIT('c') },
    merge: { commit: COMMIT('3'), tree: COMMIT('b') }, observedReferenceMatches,
    reversePatch: { byteLength: 5, digest: sha256Digest('patch') }, rollbackSource: current,
    sanitizedError: 'synthetic failure', subsetProofDigest: canonicalDigest([]), workflowWriteSet,
  };
}

export function registerRollbackTests(repositoryRoot) {
  test('E-DELIVERY-07 emits a source-bound resumable recovery command without executing it', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const rollback = rollbackFixture(contract);
    const result = validateDeliveryRollback(contract, rollback, { patchBytes: 'patch' });
    assert.equal(result.remainingRecoverySteps.length, 7);
    assert.equal(result.nextCommand.commandId, 'delivery-rollback-disable-enforcement-hook');
    assert.ok(result.nextCommand.argv.includes(rollback.current.commit));
    assert.ok(result.nextCommand.argv.includes(rollback.reversePatch.digest));
  });

  test('E-DELIVERY-07 rejects scope growth, stale patches, and skipped recovery steps', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const expanded = rollbackFixture(contract);
    expanded.changedPathSet = ['outside/scope'];
    expanded.subsetProofDigest = canonicalDigest(expanded.changedPathSet);
    assert.throws(() => validateDeliveryRollback(contract, expanded, { patchBytes: 'patch' }), /DELIVERY_ROLLBACK_INCOMPLETE/);
    const stale = rollbackFixture(contract);
    assert.throws(() => validateDeliveryRollback(contract, stale, { patchBytes: 'other' }), /DELIVERY_ROLLBACK_INCOMPLETE/);
    const skipped = rollbackFixture(contract);
    skipped.completedSteps = [contract.profile.recoverySteps[1]];
    assert.throws(() => validateDeliveryRollback(contract, skipped, { patchBytes: 'patch' }), /DELIVERY_ROLLBACK_INCOMPLETE/);
  });
}
