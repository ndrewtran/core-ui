import { canonicalDigest, canonicalJson } from '@core-ui/schema';
import { classifyDeliveryInvalidation } from './delivery-invalidation.mjs';
import {
  assertDeliveryRecordShape,
  DeliveryWorkflowError,
  validateDeliverySchema,
} from './delivery-profile.mjs';
import { validateDeliveryRollback } from './delivery-rollback.mjs';

function fail(code, message, details = {}) {
  throw new DeliveryWorkflowError(code, message, details);
}

function equal(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function readRecord(records, id) {
  return records instanceof Map ? records.get(id) : records?.[id];
}

function resolveVersion(contract, rawRecord) {
  if (rawRecord.schemaVersion === '1.0.0') return rawRecord;
  if (/^1\.(?:[1-9]\d*)\.\d+$/.test(rawRecord.schemaVersion)) {
    validateDeliverySchema(contract.schema.$defs.compatibleMinorRecord, rawRecord, {
      rootSchema: contract.schema,
      schemaAt: '/$defs/compatibleMinorRecord',
    });
    return rawRecord.baseRecord;
  }
  fail('DELIVERY_SCHEMA_VERSION_UNSUPPORTED', `unsupported delivery schema version ${rawRecord.schemaVersion}`);
}

function validateOwnerInputs(contract, record, records) {
  const matrix = contract.profile.ownerInputStatusMatrix[`${record.applicability.workClass}:${record.stage}`];
  if (!matrix) fail('DELIVERY_APPLICABILITY_INVALID', `no owner-input route for ${record.applicability.workClass}:${record.stage}`);
  for (const [key, input] of Object.entries(record.ownerInputs)) {
    const expected = matrix[key];
    if (!expected || input.status !== expected.status || input.nAReason !== expected.nAReason) {
      fail('DELIVERY_OWNER_INPUT_INVALID', `owner input ${key} does not match the closed applicability matrix`);
    }
    const expectedOwner = contract.profile.ownerInputOwners[key];
    const expectedProfile = contract.profile.ownerInputRecordProfiles[key];
    if (input.ownerRef !== expectedOwner) fail('DELIVERY_OWNER_INPUT_INVALID', `owner input ${key} has the wrong owner`);
    const owner = contract.owners.get(expectedOwner);
    if (!owner || input.ownerDocumentDigest !== owner.digest) fail('DELIVERY_OWNER_INPUT_INVALID', `owner input ${key} has a stale owner document digest`);
    if (input.status === 'not-applicable') {
      if (input.digest !== null || input.recordId !== null || input.recordProfile !== null) {
        fail('DELIVERY_OWNER_INPUT_INVALID', `not-applicable owner input ${key} must not contain a factual record`);
      }
      continue;
    }
    if (input.recordProfile !== expectedProfile) fail('DELIVERY_OWNER_INPUT_INVALID', `owner input ${key} has the wrong record profile`);
    const preimage = readRecord(records, input.recordId);
    if (!preimage || canonicalDigest(preimage) !== input.digest) fail('DELIVERY_OWNER_INPUT_INVALID', `owner input ${key} does not resolve to its factual record`);
  }
}

function validateStage(contract, record) {
  const expected = contract.profile.stageRequiredSections[record.stage];
  if (!expected) fail('DELIVERY_STAGE_INVALID', `unknown local stage ${record.stage}`);
  const actual = Object.keys(record).sort();
  if (!equal(actual, [...expected].sort())) fail('DELIVERY_STAGE_INVALID', `${record.stage} contains the wrong section set`);
}

function assertBounds(value, limits, pointer = '') {
  if (typeof value === 'string' && Buffer.byteLength(value) > limits.maxStringBytes) {
    fail('DELIVERY_INPUT_BOUNDS_EXCEEDED', `${pointer || '/'} exceeds maxStringBytes`);
  }
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayItems) fail('DELIVERY_INPUT_BOUNDS_EXCEEDED', `${pointer || '/'} exceeds maxArrayItems`);
    value.forEach((item, index) => assertBounds(item, limits, `${pointer}/${index}`));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => assertBounds(item, limits, `${pointer}/${key}`));
  }
}

function validateApplicability(contract, record) {
  const expected = contract.profile.applicabilityRoutes[record.applicability.workClass];
  if (!expected || !equal(record.applicability, { ...expected, workClass: record.applicability.workClass })) {
    fail('DELIVERY_APPLICABILITY_INVALID', `work class ${record.applicability.workClass} has a contradictory route`);
  }
}

export function validateDeliveryWorkflow(contract, rawRecord, {
  packetContext,
  patchBytes,
  postconditionRecords,
  records = new Map(),
  scanPreimages,
} = {}) {
  const record = resolveVersion(contract, rawRecord);
  assertBounds(rawRecord, contract.profile.limits);
  assertDeliveryRecordShape(contract, record);
  validateStage(contract, record);
  validateApplicability(contract, record);
  validateOwnerInputs(contract, record, records);
  if (record.intent.mode !== 'pre-g1.9') {
    fail('DELIVERY_CHANGE_INTENT_NOT_ADMITTED', 'changeIntent is deferred until G1.9');
  }
  let rollback = null;
  if (record.stage === 'ROLLBACK_RECOVERY_REQUIRED') {
    rollback = validateDeliveryRollback(contract, record.rollback, {
      patchBytes,
      postconditionRecords,
      scanPreimages,
    });
  }
  if (packetContext && record.stage !== 'PACKET_RENDERED') {
    fail('DELIVERY_PACKET_PHASE_INVALID', 'packet context is admitted only at PACKET_RENDERED');
  }
  return { record, rollback };
}

export function deriveDeliveryOutput(contract, rawRecord, options = {}) {
  const { record, rollback } = validateDeliveryWorkflow(contract, rawRecord, options);
  const invalidation = options.before
    ? classifyDeliveryInvalidation(contract, options.before, record)
    : { changedPointers: [], domains: [], earliestRewind: record.stage, invalidatedIdentities: [] };
  const fallbackCommand = contract.commands.get('check');
  const output = {
    invalidation,
    lifecycleState: record.stage,
    nextCommand: rollback?.nextCommand ?? {
      argv: fallbackCommand.value.argv,
      commandId: fallbackCommand.id,
      postconditionDigest: canonicalDigest({ record: canonicalDigest(record), state: record.stage }),
    },
    profile: 'core-ui-delivery-workflow-output-v1',
    remainingRecoverySteps: rollback?.remainingRecoverySteps ?? [],
  };
  validateDeliverySchema(contract.schema.$defs.derivedOutput, output, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/derivedOutput',
  });
  return output;
}
