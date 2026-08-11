import { canonicalDigest, canonicalJson, sha256Digest } from '@core-ui/schema';
import { DeliveryWorkflowError } from './delivery-profile.mjs';

function fail(message, details = {}) {
  throw new DeliveryWorkflowError('DELIVERY_ROLLBACK_INCOMPLETE', message, details);
}

function exactSet(values) {
  return [...new Set(values)].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

export function validateDeliveryRollback(contract, rollback, {
  patchBytes,
  postconditionRecords = new Map(),
  scanPreimages = new Map(),
} = {}) {
  const steps = contract.profile.recoverySteps;
  if (rollback.boundaries.map(({ id }) => id).join(',') !== 'RB-01,RB-02') {
    fail('rollback boundaries must be exactly RB-01 then RB-02');
  }
  if (rollback.boundaries[0].parent !== rollback.featureBase.commit
      || rollback.boundaries[1].parent !== rollback.boundaries[0].commit) {
    fail('rollback boundary parent topology is invalid');
  }
  for (const boundary of rollback.boundaries) {
    const sorted = [...boundary.paths].sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
    if (new Set(sorted.map(({ path }) => path)).size !== sorted.length
        || boundary.pathManifestDigest !== canonicalDigest(sorted)) {
      fail(`rollback boundary ${boundary.id} path manifest is invalid`);
    }
  }
  const writeSet = exactSet(rollback.workflowWriteSet.map(({ path }) => path));
  const boundaryUnion = exactSet(rollback.boundaries.flatMap(({ paths }) => paths.map(({ path }) => path)));
  if (canonicalJson(writeSet) !== canonicalJson(boundaryUnion)) fail('workflow write set does not equal the two-boundary union');
  const changed = exactSet(rollback.changedPathSet);
  if (changed.some((path) => !writeSet.includes(path))) fail('changed path set exceeds the admitted workflow write set');
  if (rollback.subsetProofDigest !== canonicalDigest(changed)) {
    fail('changed-path subset proof digest is stale');
  }
  if (patchBytes !== undefined) {
    const byteLength = Buffer.byteLength(patchBytes);
    if (rollback.reversePatch.byteLength !== byteLength || rollback.reversePatch.digest !== sha256Digest(patchBytes)) {
      fail('reverse patch bytes do not match the recorded rollback boundary');
    }
  }
  const completed = rollback.completedSteps;
  if (completed.some((step, index) => step !== steps[index])) fail('completed rollback steps must be an ordered prefix');
  if (rollback.completedPostconditions.length !== completed.length) fail('each completed step requires one postcondition');
  rollback.completedPostconditions.forEach((entry, index) => {
    if (entry.step !== completed[index]) fail(`postcondition order does not match ${entry.step}`);
    const record = postconditionRecords.get(entry.recordId);
    if (record && canonicalDigest(record) !== entry.recordDigest) fail(`postcondition digest mismatch for ${entry.step}`);
  });
  for (const observation of rollback.observedReferenceMatches) {
    const preimage = scanPreimages.get(observation.resultDigest);
    if (preimage && canonicalDigest(preimage) !== observation.resultDigest) fail(`reference scan preimage mismatch for ${observation.commandRef}`);
    if (observation.currentCommit !== rollback.current.commit || observation.currentTree !== rollback.current.tree) {
      fail(`reference scan source mismatch for ${observation.commandRef}`);
    }
  }
  const expectedScans = Object.keys(contract.profile.referenceScanCommands).sort();
  if (canonicalJson(rollback.observedReferenceMatches.map(({ commandRef }) => commandRef)) !== canonicalJson(expectedScans)) {
    fail('reference scan set is incomplete or unordered');
  }
  const remaining = steps.slice(completed.length);
  const nextStep = remaining[0] ?? 'verify-no-live-reference';
  if (rollback.failedStep !== (remaining[0] ?? null)) fail('failedStep does not identify the next incomplete recovery step');
  const command = contract.profile.recoveryCommands[nextStep];
  return {
    nextCommand: {
      argv: [
        ...command.argv,
        '--current-commit', rollback.current.commit,
        '--current-tree', rollback.current.tree,
        '--reverse-patch-digest', rollback.reversePatch.digest,
        '--postconditions-digest', canonicalDigest(rollback.completedPostconditions),
        '--scan-preimages-digest', canonicalDigest(rollback.observedReferenceMatches),
      ],
      commandId: command.commandId,
      postconditionDigest: canonicalDigest({
        contract: contract.profile.recoveryPostconditionContracts[nextStep],
        current: rollback.current,
        step: nextStep,
      }),
    },
    remainingRecoverySteps: remaining,
  };
}

export function renderRollbackStatus(result) {
  return `${canonicalJson(result)}\n`;
}
