import { canonicalJson, sha256Digest } from '@core-ui/schema';
import { DeliveryWorkflowError, validateDeliverySchema } from './delivery-profile.mjs';

const HANDOFF_PROFILE = 'core-ui-delivery-phase-handoff-v1';

function canonicalBytes(value) {
  return `${canonicalJson(value)}\n`;
}

export function deriveDeliveryHandoff(contract, evaluation) {
  if (!evaluation?.identity || !evaluation?.payload) {
    throw new DeliveryWorkflowError('DELIVERY_HANDOFF_INVALID', 'conformance result is required');
  }
  const nextOperationId = evaluation.payload.status === 'satisfied'
    ? 'DISPATCH_ADVISORY_REVIEW'
    : 'REWIND_TO_FAILED_CONFORMANCE_OWNER';
  const payload = {
    authorityReceiptRef: evaluation.workflowRecord.authority.decisionReceiptRef,
    conformanceIdentity: evaluation.identity,
    disclosureDigest: sha256Digest(canonicalBytes(evaluation.workflowRecord.privacy ?? null)),
    invalidatedIdentities: [],
    nextOperationId,
    outstandingHumanDecisionRefs: [],
    packetIdentity: evaluation.packet.envelope,
    profile: HANDOFF_PROFILE,
    repositorySource: evaluation.invocation.repositorySource,
    stage: evaluation.workflowRecord.stage,
    workflowProfile: contract.profile.profile,
  };
  validateDeliverySchema(contract.schema.$defs.phaseHandoff, payload, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/phaseHandoff',
  });
  const bytes = canonicalBytes(payload);
  return {
    bytes,
    identity: {
      algorithm: 'sha256',
      byteLength: Buffer.byteLength(bytes),
      digest: sha256Digest(bytes),
      id: `delivery-handoff-${sha256Digest(bytes).slice(-16)}`,
      profile: HANDOFF_PROFILE,
    },
    payload,
  };
}

export { HANDOFF_PROFILE };
