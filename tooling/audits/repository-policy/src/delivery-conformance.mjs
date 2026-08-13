import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
  sha256Digest,
} from '@core-ui/schema';
import {
  DeliveryWorkflowError,
  compareRfc3339DateTime,
  isRfc3339DateTime,
  loadDeliveryProfile,
  validateDeliverySchema,
} from './delivery-profile.mjs';
import { renderDeliveryPacket } from './delivery-packet.mjs';
import { validateDeliveryWorkflow } from './delivery-workflow.mjs';

const INVOCATION_PROFILE = 'core-ui-delivery-advisory-invocation-v1';
const CONFORMANCE_PROFILE = 'core-ui-delivery-conformance-v1';

function fail(code, message, details = {}) {
  throw new DeliveryWorkflowError(code, message, details);
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  if (canonicalJson(actual) !== canonicalJson([...expected].sort())) {
    fail('DELIVERY_CONFORMANCE_INVALID', `${label} has the wrong fields`);
  }
}

function canonicalBytes(value) {
  return `${canonicalJson(value)}\n`;
}

export function validateRawIdentity(bytes, identity, label) {
  exactKeys(identity, ['algorithm', 'byteLength', 'digest', 'id', 'profile'], `${label} identity`);
  if (identity.algorithm !== 'sha256' || !identity.id || !identity.profile) {
    fail('DELIVERY_CONFORMANCE_INVALID', `${label} identity is malformed`);
  }
  if (Buffer.byteLength(bytes) !== identity.byteLength || sha256Digest(bytes) !== identity.digest) {
    fail('DELIVERY_CONFORMANCE_INVALID', `${label} bytes do not match their identity`);
  }
  let value;
  try {
    value = parseJsonStrict(bytes);
  } catch (error) {
    fail('DELIVERY_CONFORMANCE_INVALID', `${label} is not strict JSON`, { cause: error.message });
  }
  if (canonicalBytes(value) !== bytes) {
    fail('DELIVERY_CONFORMANCE_INVALID', `${label} is not canonical UTF-8 JSON plus LF`);
  }
  return value;
}

function within(root, candidate) {
  const offset = relative(root, candidate);
  return offset === '' || (!offset.startsWith(`..${sep}`) && offset !== '..' && !isAbsolute(offset));
}

async function readConfined(manifestPath, locator, limits) {
  if (typeof locator !== 'string' || !locator || isAbsolute(locator)) {
    fail('DELIVERY_INVOCATION_UNSAFE', 'invocation locators must be non-empty relative paths');
  }
  const root = await realpath(dirname(manifestPath));
  const lexical = resolve(root, locator);
  if (!within(root, lexical)) fail('DELIVERY_INVOCATION_UNSAFE', `locator escapes the invocation directory: ${locator}`);
  let target;
  try {
    target = await realpath(lexical);
  } catch {
    fail('DELIVERY_INVOCATION_INVALID', `invocation preimage is missing: ${locator}`);
  }
  if (!within(root, target)) fail('DELIVERY_INVOCATION_UNSAFE', `locator resolves outside the invocation directory: ${locator}`);
  const bytes = await readFile(target, 'utf8');
  if (Buffer.byteLength(bytes) > limits.maxPacketBytes) {
    fail('DELIVERY_INPUT_BOUNDS_EXCEEDED', `invocation preimage exceeds maxPacketBytes: ${locator}`);
  }
  return bytes;
}

function validateInvocationShape(invocation) {
  exactKeys(invocation, [
    'authorityIdentities',
    'contractDigests',
    'evaluationTime',
    'inputs',
    'profile',
    'repositorySource',
    'schemaVersion',
  ], 'advisory invocation');
  if (invocation.profile !== INVOCATION_PROFILE || invocation.schemaVersion !== '1.0.0') {
    fail('DELIVERY_INVOCATION_INVALID', 'unsupported advisory invocation profile');
  }
  if (typeof invocation.evaluationTime !== 'string' || !isRfc3339DateTime(invocation.evaluationTime)) {
    fail('DELIVERY_INVOCATION_INVALID', 'evaluation time must be RFC 3339');
  }
  exactKeys(invocation.repositorySource, ['commit', 'tree'], 'repository source');
  if (!/^[0-9a-f]{40}$/u.test(invocation.repositorySource.commit)
    || !/^[0-9a-f]{40}$/u.test(invocation.repositorySource.tree)) {
    fail('DELIVERY_INVOCATION_INVALID', 'repository source identity is malformed');
  }
  if (!Array.isArray(invocation.authorityIdentities) || !Array.isArray(invocation.inputs)) {
    fail('DELIVERY_INVOCATION_INVALID', 'authority identities and inputs must be arrays');
  }
  const authorityRefs = invocation.authorityIdentities.map(({ ownerRef }) => ownerRef);
  if (new Set(authorityRefs).size !== authorityRefs.length) {
    fail('DELIVERY_INVOCATION_INVALID', 'authority identities must have unique owner refs');
  }
  for (const authority of invocation.authorityIdentities) {
    exactKeys(authority, ['digest', 'ownerRef'], `authority identity ${authority.ownerRef}`);
  }
  exactKeys(invocation.contractDigests, ['diagnostics', 'profile', 'profileSchema', 'schema'], 'contract digests');
  const slots = invocation.inputs.map(({ slot }) => slot);
  if (!['packetInput', 'renderedPrBody', 'workflowRecord'].every((slot) => slots.includes(slot))) {
    fail('DELIVERY_INVOCATION_INVALID', 'required invocation preimages are missing');
  }
  if (new Set(slots).size !== slots.length) {
    fail('DELIVERY_INVOCATION_INVALID', 'invocation input slots must be unique');
  }
  const inputIds = invocation.inputs.map(({ identity }) => identity.id);
  if (new Set(inputIds).size !== inputIds.length) {
    fail('DELIVERY_INVOCATION_INVALID', 'invocation input identity IDs must be unique');
  }
  const locators = invocation.inputs.map(({ locator }) => locator);
  if (new Set(locators).size !== locators.length) {
    fail('DELIVERY_INVOCATION_INVALID', 'invocation input locators must be unique');
  }
  for (const input of invocation.inputs) {
    exactKeys(input, ['identity', 'locator', 'slot'], `invocation input ${input.slot}`);
  }
}

function conformanceRules(record, packet, packetInput, invocation) {
  const disclosure = record.privacy?.disclosurePolicy;
  const capture = record.privacy?.captureAuthorization;
  const disclosed = disclosure?.class === 'public-repository-sanitized'
    && disclosure.audience.length > 0
    && disclosure.redactions.length > 0
    && compareRfc3339DateTime(disclosure.expiresAt, invocation.evaluationTime) >= 0
    && compareRfc3339DateTime(capture.expiresAt, invocation.evaluationTime) >= 0;
  const checks = [
    ['PACKET_RENDERED', record.stage === 'PACKET_RENDERED'],
    ['PACKET_IDENTITY_VALID', packet.envelope.digest === sha256Digest(packet.payload)
      && packet.envelope.byteLength === Buffer.byteLength(packet.payload)],
    ['DETERMINISTIC_RESULTS_PASS', packetInput.deterministicResults.every((result) => result.exitState === 0)],
    ['DISCLOSURE_VALID', disclosed],
    ['EXTERNAL_STATE_UNCLAIMED', packet.packet.outputClassification === 'advisory-only'],
  ];
  return {
    checked: checks.map(([id]) => id),
    failed: checks.filter(([, passed]) => !passed).map(([id]) => id),
  };
}

export async function evaluateDeliveryInvocation(repositoryRoot, manifestPath) {
  const contract = await loadDeliveryProfile(repositoryRoot);
  const manifestBytes = await readFile(manifestPath, 'utf8');
  const invocation = parseJsonStrict(manifestBytes);
  if (`${canonicalJson(invocation)}\n` !== manifestBytes) {
    fail('DELIVERY_INVOCATION_INVALID', 'invocation manifest must be canonical JSON plus LF');
  }
  validateInvocationShape(invocation);
  validateDeliverySchema(contract.schema.$defs.advisoryInvocation, invocation, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/advisoryInvocation',
  });
  const expectedAuthorities = [...contract.owners]
    .map(([ownerRef, owner]) => ({ digest: owner.digest, ownerRef }))
    .sort((left, right) => Buffer.from(left.ownerRef).compare(Buffer.from(right.ownerRef)));
  if (canonicalJson(invocation.authorityIdentities) !== canonicalJson(expectedAuthorities)) {
    fail('DELIVERY_INVOCATION_STALE', 'authority identity set is incomplete or stale');
  }
  const expectedContractDigests = {
    diagnostics: contract.profile.diagnosticContractDigest,
    profile: sha256Digest(`${canonicalJson(contract.profile)}\n`),
    profileSchema: sha256Digest(await readFile(resolve(repositoryRoot, 'tooling/audits/repository-policy/delivery-workflow-profile.schema.json'), 'utf8')),
    schema: contract.profile.schemaSha256,
  };
  if (canonicalJson(invocation.contractDigests) !== canonicalJson(expectedContractDigests)) {
    fail('DELIVERY_INVOCATION_STALE', 'delivery contract digest set is stale');
  }
  const values = new Map();
  const slots = new Map();
  const rawIdentities = new Map();
  const rawBytes = new Map();
  for (const input of invocation.inputs) {
    const bytes = await readConfined(manifestPath, input.locator, contract.profile.limits);
    const value = validateRawIdentity(bytes, input.identity, input.slot);
    slots.set(input.slot, value);
    values.set(input.identity.id, value);
    rawIdentities.set(input.identity.id, input.identity);
    rawBytes.set(input.identity.id, bytes);
  }
  const workflowRecord = slots.get('workflowRecord');
  const packetInput = slots.get('packetInput');
  const referenced = [
    packetInput.renderedPrBody,
    ...Object.values(packetInput.reviewedObject).filter(({ status }) => status !== 'not-applicable'),
    ...packetInput.deterministicResults.map(({ output }) => output),
  ];
  for (const reference of referenced) {
    const identity = rawIdentities.get(reference.recordId);
    const value = values.get(reference.recordId);
    if (!identity || !value
        || reference.byteLength !== identity.byteLength
        || reference.recordDigest !== canonicalDigest(value)
        || reference.recordProfile !== identity.profile) {
      fail('DELIVERY_INVOCATION_STALE', `packet preimage identity is stale: ${reference.recordId}`);
    }
  }
  const reviewedSource = values.get(packetInput.reviewedObject.source.recordId);
  exactKeys(reviewedSource, ['profile', 'source'], 'reviewed source preimage');
  exactKeys(reviewedSource.source, ['commit', 'tree'], 'reviewed source identity');
  if (reviewedSource.profile !== 'core-ui-git-source-identity-v1'
      || canonicalJson(reviewedSource.source) !== canonicalJson(invocation.repositorySource)) {
    fail('DELIVERY_INVOCATION_STALE', 'invocation repository source contradicts the reviewed source preimage');
  }
  validateDeliveryWorkflow(contract, workflowRecord, { records: values });
  const packet = renderDeliveryPacket(contract, workflowRecord, packetInput, { records: values });
  if (rawBytes.get(packetInput.renderedPrBody.recordId) !== `${packet.body}\n`) {
    fail('DELIVERY_INVOCATION_STALE', 'rendered PR body preimage does not match the canonical renderer');
  }
  if (canonicalJson(workflowRecord.packet) !== canonicalJson(packet.packet)) {
    fail('DELIVERY_INVOCATION_STALE', 'workflow packet does not match the canonical renderer');
  }
  const rules = conformanceRules(workflowRecord, packet, packetInput, invocation);
  const operationalApplicability = {
    ownerRef: contract.profile.operationalProofContract.ownerRef,
    profile: contract.profile.operationalProofContract.applicabilityProfile,
    reason: contract.profile.operationalProofContract.noRuntimeMutationReason,
    status: 'not-applicable',
  };
  const payload = {
    checkedRuleIds: rules.checked,
    failedRuleIds: rules.failed,
    inputIdentities: invocation.inputs.map(({ identity }) => identity),
    nonclaims: ['review-clearance', 'human-acceptance', 'hosted-truth', 'tracker-state', 'readiness', 'merge', 'release', 'completion'],
    operationalApplicability,
    packetIdentity: packet.envelope,
    profile: CONFORMANCE_PROFILE,
    repositorySource: invocation.repositorySource,
    status: rules.failed.length === 0 ? 'satisfied' : 'unsatisfied',
  };
  validateDeliverySchema(contract.schema.$defs.deliveryConformance, payload, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/deliveryConformance',
  });
  return {
    contract,
    identity: {
      algorithm: 'sha256',
      byteLength: Buffer.byteLength(canonicalBytes(payload)),
      digest: sha256Digest(canonicalBytes(payload)),
      id: `delivery-conformance-${canonicalDigest(invocation).slice(-16)}`,
      profile: CONFORMANCE_PROFILE,
    },
    invocation,
    packet,
    packetInput,
    payload,
    operationalApplicability,
    values,
    workflowRecord,
  };
}

export { CONFORMANCE_PROFILE, INVOCATION_PROFILE };
