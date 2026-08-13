import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalDigest, canonicalJson, parseJsonStrict, sha256Digest } from '@core-ui/schema';
import { renderDeliveryPacket } from '../../src/delivery-packet.mjs';

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

function sampleString(contract) {
  if (contract.format === 'date-time') return '2099-01-01T00:00:00.000Z';
  if (contract.pattern?.includes('sha256:')) return DIGEST;
  if (contract.pattern?.includes('[0-9a-f]{40}')) return 'a'.repeat(40);
  if (contract.pattern?.includes('SCOPE-')) return 'SCOPE-FOUNDATION-001';
  if (contract.pattern?.includes('E-')) return 'E-DELIVERY-01';
  return 'fixture';
}

function sampleSchema(rootSchema, contract) {
  if (contract.$ref) {
    return sampleSchema(rootSchema, contract.$ref.slice(2).split('/').reduce((value, key) => value[key], rootSchema));
  }
  if (contract.const !== undefined) return clone(contract.const);
  if (contract.enum) return clone(contract.enum[0]);
  if (contract.oneOf) return sampleSchema(rootSchema, contract.oneOf[0]);
  if (contract.anyOf) return sampleSchema(rootSchema, contract.anyOf[0]);
  const type = Array.isArray(contract.type) ? contract.type.find((item) => item !== 'null') : contract.type;
  if (type === 'object') return Object.fromEntries((contract.required ?? []).map((key) => [key, sampleSchema(rootSchema, contract.properties[key])]));
  if (type === 'array') return Array.from({ length: contract.minItems ?? 0 }, () => sampleSchema(rootSchema, contract.items ?? {}));
  if (type === 'integer' || type === 'number') return contract.minimum ?? 0;
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  return sampleString(contract);
}

function canonicalBytes(value) {
  return `${canonicalJson(value)}\n`;
}

function rawIdentity(value, id, profile = value.profile) {
  const bytes = canonicalBytes(value);
  return {
    bytes,
    identity: {
      algorithm: 'sha256',
      byteLength: Buffer.byteLength(bytes),
      digest: sha256Digest(bytes),
      id,
      profile,
    },
  };
}

function packetReference(raw, status) {
  return {
    byteLength: raw.identity.byteLength,
    recordDigest: canonicalDigest(parseJsonStrict(raw.bytes)),
    recordId: raw.identity.id,
    recordProfile: raw.identity.profile,
    ...(status ? { status } : {}),
  };
}

const notApplicable = () => ({
  byteLength: null,
  recordDigest: null,
  recordId: null,
  recordProfile: null,
  status: 'not-applicable',
});

export async function writeAdvisoryFixture(contract, repositoryRoot, directory, {
  exitState = 0,
  repositorySource = { commit: 'a'.repeat(40), tree: 'b'.repeat(40) },
} = {}) {
  await mkdir(directory, { recursive: true });
  const { record, records } = buildAuthoredRecord(contract, { stage: 'PACKET_RENDERED' });
  const workflowSchema = contract.schema.$defs.workflowRecord.properties;
  record.packet = sampleSchema(contract.schema, workflowSchema.packet);
  record.privacy = sampleSchema(contract.schema, workflowSchema.privacy);
  record.reviews = sampleSchema(contract.schema, workflowSchema.reviews);
  record.reviews.requiredAssignments = contract.profile.reviewerRoutes.repository.map((role, index) => {
    const assignmentRecordRef = `review-assignment-${index + 1}`;
    const assignment = {
      independence: true,
      ownerRef: 'repository-policy-owner',
      profile: 'core-ui-advisory-review-assignment-v1',
      reviewerIdentity: `${role}-fixture`,
      role,
    };
    records.set(assignmentRecordRef, assignment);
    return {
      assignmentOwnerRef: assignment.ownerRef,
      assignmentRecordDigest: canonicalDigest(assignment),
      assignmentRecordProfile: assignment.profile,
      assignmentRecordRef,
      independence: assignment.independence,
      reviewerIdentity: assignment.reviewerIdentity,
      role: assignment.role,
    };
  });
  const rawRecords = new Map([...records].map(([id, value]) => [id, rawIdentity(value, id, value.profile)]));
  const source = rawIdentity({ profile: 'core-ui-git-source-identity-v1', source: repositorySource }, 'source');
  const artifactSet = rawIdentity({ paths: ['fixture'], profile: 'core-ui-artifact-manifest-v1' }, 'artifacts');
  const output = rawIdentity({ exitState, profile: 'core-ui-deterministic-result-v1' }, 'check-output');
  let body = rawIdentity({ packetId: 'placeholder', profile: 'core-ui-pr-body-v1' }, 'body');
  for (const raw of [source, artifactSet, output, body]) rawRecords.set(raw.identity.id, raw);
  const command = contract.commands.get('check');
  const packetInput = {
    deterministicResults: [{
      commandId: 'check',
      commandRecordDigest: command.digest,
      commandRecordId: command.id,
      commandRecordProfile: command.value.profile,
      exitState,
      output: packetReference(output),
      ownerRef: command.value.ownerRef,
    }],
    profile: 'core-ui-delivery-packet-render-input-v1',
    renderedPrBody: packetReference(body),
    reviewPhase: 'pre-write-decision-review',
    reviewedObject: {
      artifactSet: packetReference(artifactSet, 'present'),
      diff: notApplicable(),
      evidence: notApplicable(),
      output: notApplicable(),
      source: packetReference(source),
    },
  };
  const values = () => new Map([...rawRecords].map(([id, raw]) => [id, parseJsonStrict(raw.bytes)]));
  const first = renderDeliveryPacket(contract, record, packetInput, { records: values() });
  body = rawIdentity(parseJsonStrict(first.body), 'body', 'core-ui-pr-body-v1');
  rawRecords.set('body', body);
  packetInput.renderedPrBody = packetReference(body);
  record.packet = renderDeliveryPacket(contract, record, packetInput, { records: values() }).packet;
  const stable = renderDeliveryPacket(contract, record, packetInput, { records: values() });
  if (canonicalJson(record.packet) !== canonicalJson(stable.packet)) throw new Error('packet fixture did not converge');
  const workflowRaw = rawIdentity(record, 'workflow-record');
  const packetRaw = rawIdentity(packetInput, 'packet-input');
  const inputs = [
    { raw: workflowRaw, slot: 'workflowRecord' },
    { raw: packetRaw, slot: 'packetInput' },
    { raw: body, slot: 'renderedPrBody' },
    ...[...rawRecords].filter(([id]) => id !== 'body').map(([id, raw]) => ({ raw, slot: `preimage.${id}` })),
  ].sort((left, right) => Buffer.from(left.slot).compare(Buffer.from(right.slot)));
  for (const { raw } of inputs) await writeFile(join(directory, `${raw.identity.id}.json`), raw.bytes);
  const invocation = {
    authorityIdentities: [...contract.owners].map(([ownerRef, owner]) => ({ digest: owner.digest, ownerRef }))
      .sort((left, right) => Buffer.from(left.ownerRef).compare(Buffer.from(right.ownerRef))),
    contractDigests: {
      diagnostics: contract.profile.diagnosticContractDigest,
      profile: sha256Digest(canonicalBytes(contract.profile)),
      profileSchema: sha256Digest(await readFile(join(repositoryRoot, 'tooling/audits/repository-policy/delivery-workflow-profile.schema.json'), 'utf8')),
      schema: contract.profile.schemaSha256,
    },
    evaluationTime: '2026-08-12T00:00:00.000Z',
    inputs: inputs.map(({ raw, slot }) => ({ identity: raw.identity, locator: `${raw.identity.id}.json`, slot })),
    profile: 'core-ui-delivery-advisory-invocation-v1',
    repositorySource,
    schemaVersion: '1.0.0',
  };
  return { invocation, packet: stable, packetInput, record };
}
