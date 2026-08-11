import { canonicalDigest } from '@core-ui/schema';

const DIGEST = `sha256:${'0'.repeat(64)}`;

export function buildAuthoredRecord(contract, {
  stage = 'INTAKE',
  workClass = 'repository',
} = {}) {
  const records = new Map();
  const matrix = contract.profile.ownerInputStatusMatrix[`${workClass}:${stage}`];
  const ownerInputs = Object.fromEntries(Object.keys(contract.profile.ownerInputOwners).map((key) => {
    const cell = matrix[key];
    const ownerRef = contract.profile.ownerInputOwners[key];
    const ownerDocumentDigest = contract.owners.get(ownerRef).digest;
    if (cell.status === 'not-applicable') {
      return [key, {
        digest: null,
        nAReason: cell.nAReason,
        ownerDocumentDigest,
        ownerRef,
        recordId: null,
        recordProfile: null,
        status: 'not-applicable',
      }];
    }
    const recordProfile = contract.profile.ownerInputRecordProfiles[key];
    const value = { profile: recordProfile, value: { identity: `${key}-fixture` } };
    const recordId = `${recordProfile}:${key}`;
    records.set(recordId, value);
    return [key, {
      digest: canonicalDigest(value),
      nAReason: null,
      ownerDocumentDigest,
      ownerRef,
      recordId,
      recordProfile,
      status: 'present',
    }];
  }));
  const record = {
    applicability: { ...contract.profile.applicabilityRoutes[workClass], workClass },
    authority: {
      architectureRevision: DIGEST,
      decisionReceiptRef: 'decision-0007-acceptance',
      decisionRef: 'decision-0007',
      evidenceIds: ['E-DELIVERY-01'],
      ownerRefs: ['architecture-delivery-workflow'],
      productScopeRevision: DIGEST,
      roadmapRevision: DIGEST,
      scopeIds: ['SCOPE-FOUNDATION-001'],
    },
    intent: {
      completeness: 'known-incomplete-non-authoritative',
      expectedPathSet: [],
      humanDecisionRecordRef: 'decision-0007-decision-owner',
      mode: 'pre-g1.9',
    },
    ownerInputs,
    profile: 'core-ui-delivery-workflow-v1',
    recordKind: 'core-ui-delivery-workflow-record-v1',
    schemaVersion: '1.0.0',
    stage,
  };
  return { record, records };
}

export function clone(value) {
  return structuredClone(value);
}
