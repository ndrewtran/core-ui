import { canonicalDigest, canonicalJson, sha256Digest } from '@core-ui/schema';
import { DeliveryWorkflowError, validateDeliverySchema } from './delivery-profile.mjs';

function fail(message) {
  throw new DeliveryWorkflowError('DELIVERY_PACKET_INVALID', message);
}

function validateIdentity(slot, identity, expectedStatus, expectedProfile) {
  if (identity.status !== expectedStatus) fail(`${slot} status does not match the review phase`);
  if (expectedStatus === 'not-applicable') {
    if ([identity.byteLength, identity.recordDigest, identity.recordId, identity.recordProfile].some((value) => value !== null)) {
      fail(`${slot} must be empty when not applicable`);
    }
  } else if (identity.recordProfile !== expectedProfile) {
    fail(`${slot} uses the wrong record profile`);
  }
}

export function requiredDeliveryReviewers(contract, workClass) {
  const reviewers = contract.profile.reviewerRoutes[workClass];
  if (!reviewers) fail(`unknown reviewer route ${workClass}`);
  return [...reviewers];
}

export function validateAdvisoryReviewResult(contract, result) {
  validateDeliverySchema(contract.schema.$defs.advisoryReviewResult, result, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/advisoryReviewResult',
  });
  const hasFindings = result.findings.length > 0;
  if ((result.outcome === 'clear') === hasFindings) fail('review outcome contradicts findings');
  if (result.recommendation === 'accept' && result.outcome !== 'clear') fail('accept recommendation requires a clear outcome');
  if (result.outcome === 'clear' && result.independence !== 'independent') fail('clear review must be independent');
  return result;
}

export function renderDeliveryPacket(contract, record, input, { records = new Map() } = {}) {
  validateDeliverySchema(contract.schema.$defs.packetRenderInput, input, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/packetRenderInput',
  });
  const phase = contract.profile.packetPhaseMatrix[input.reviewPhase];
  if (!phase) fail(`unknown review phase ${input.reviewPhase}`);
  for (const slot of ['artifactSet', 'diff', 'evidence', 'output']) {
    validateIdentity(slot, input.reviewedObject[slot], phase[slot], contract.profile.packetPreimageProfiles[slot]);
  }
  if (input.reviewedObject.source.recordProfile !== contract.profile.packetPreimageProfiles.source) fail('source uses the wrong record profile');
  const resolve = (identity) => {
    const preimage = records instanceof Map ? records.get(identity.recordId) : records[identity.recordId];
    if (!preimage || canonicalDigest(preimage) !== identity.recordDigest) fail(`unresolved packet preimage ${identity.recordId}`);
  };
  Object.values(input.reviewedObject).filter(({ status }) => status !== 'not-applicable').forEach(resolve);
  input.deterministicResults.forEach((result) => {
    const command = contract.commands.get(result.commandId);
    if (!command || command.digest !== result.commandRecordDigest || command.id !== result.commandRecordId) {
      fail(`deterministic result uses an unowned command ${result.commandId}`);
    }
    resolve(result.output);
  });
  resolve(input.renderedPrBody);
  const reviewedObjectDigest = canonicalDigest(input.reviewedObject);
  const deterministicResultsDigest = canonicalDigest(input.deterministicResults);
  const packetId = `delivery-${input.reviewPhase}-${reviewedObjectDigest.slice(-16)}`;
  const payloadSeed = {
    deterministicResults: input.deterministicResults,
    outputClassification: 'advisory-only',
    packetId,
    recordDigest: canonicalDigest(record),
    reviewPhase: input.reviewPhase,
    reviewedObject: input.reviewedObject,
  };
  const payload = canonicalJson(payloadSeed);
  const body = canonicalJson({ packetId, reviewPhase: input.reviewPhase, reviewedObject: input.reviewedObject });
  const packet = {
    algorithm: 'sha256',
    deterministicResultsDigest,
    evidenceApplicabilityDigest: canonicalDigest(record.applicability),
    id: packetId,
    outputClassification: 'advisory-only',
    payload: { byteLength: Buffer.byteLength(payload), digest: sha256Digest(payload) },
    profile: 'core-ui-review-packet-v1',
    rendered: { prBody: { byteLength: Buffer.byteLength(body), sha256: sha256Digest(body) } },
    reviewPhase: input.reviewPhase,
    reviewScopeDigest: canonicalDigest({ phase: input.reviewPhase, workClass: record.applicability.workClass }),
    reviewedObjectDigest,
    rolloutIdentityDigest: canonicalDigest({ authority: record.authority, intent: record.intent }),
  };
  return {
    body,
    envelope: {
      algorithm: 'sha256',
      byteLength: Buffer.byteLength(payload),
      digest: sha256Digest(payload),
      packetId,
      profile: 'core-ui-review-packet-v1',
    },
    packet,
    payload,
  };
}
