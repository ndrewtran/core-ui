import { canonicalDigest, canonicalJson } from './canonical.mjs';

const CONTRACT_SCHEMA = 'muxui-platform-safety-contract-v1';
const REQUIREMENT_SET_SCHEMA_VERSION = '1.0.0';
const VALIDATION_PROFILE_BY_RUNTIME_PROFILE = Object.freeze({
  ios: 'native.ios',
  android: 'native.android',
  'native.react-native-web': 'native.react-native-web',
});

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function closedObject(value, fields) {
  return isObject(value) && Object.keys(value).every((field) => fields.includes(field));
}

export class PlatformSafetyContractError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'PlatformSafetyContractError';
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

function fail(code, message, details) {
  throw new PlatformSafetyContractError(code, message, details);
}

export function validatePlatformSafetyContract(contract) {
  if (
    !closedObject(contract, ['schema', 'contractVersion', 'requirements'])
    || contract.schema !== CONTRACT_SCHEMA
    || !/^\d+\.\d+\.\d+$/.test(contract.contractVersion ?? '')
    || !Array.isArray(contract.requirements)
    || contract.requirements.length === 0
  ) {
    fail('MUXUI_PLATFORM_SAFETY_CONTRACT_INVALID', 'the architecture registry is malformed');
  }
  const ids = new Set();
  for (const [index, requirement] of contract.requirements.entries()) {
    if (
      !closedObject(requirement, ['id', 'meaning', 'boundary'])
      || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(requirement.id ?? '')
      || typeof requirement.meaning !== 'string'
      || requirement.meaning.length === 0
      || typeof requirement.boundary !== 'string'
      || requirement.boundary.length === 0
    ) {
      fail('MUXUI_PLATFORM_SAFETY_CONTRACT_INVALID', `requirements/${index} is malformed`, { index });
    }
    if (ids.has(requirement.id)) {
      fail('MUXUI_PLATFORM_SAFETY_CONTRACT_INVALID', `duplicate registry ID ${requirement.id}`, {
        requirementId: requirement.id,
      });
    }
    ids.add(requirement.id);
  }
  const value = structuredClone(contract);
  return Object.freeze({
    value: Object.freeze(value),
    requirementIds: Object.freeze(contract.requirements.map(({ id }) => id)),
    digest: canonicalDigest(contract),
  });
}

function expectedProfiles(bindingId, binding) {
  const runtimeProfiles = Object.entries(binding.runtimeProfiles ?? {});
  if (runtimeProfiles.length === 0) {
    return [{ profile: bindingId, validationProfile: undefined, unsupported: binding.strategy === 'unsupported' }];
  }
  return runtimeProfiles.map(([profile, runtimeProfile]) => ({
    profile,
    validationProfile: runtimeProfile.validationProfile
      ?? VALIDATION_PROFILE_BY_RUNTIME_PROFILE[profile],
    unsupported: runtimeProfile.strategy === 'unsupported',
  }));
}

function normalizeDisposition(entry, registryIds, { bindingId, profile, unsupported }) {
  if (!isObject(entry)) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', 'requirement disposition must be an object', {
      bindingId,
      profile,
    });
  }
  const prematureFields = ['availability', 'evidence', 'evidenceStatus', 'fulfilled', 'support']
    .filter((field) => Object.hasOwn(entry, field));
  if (prematureFields.length > 0) {
    fail(
      'MUXUI_PLATFORM_SAFETY_PREMATURE_FULFILLMENT',
      'G1.0 declarations cannot contain behavior, evidence, support, or availability results',
      { bindingId, profile, fields: prematureFields },
    );
  }
  if (!closedObject(entry, ['id', 'disposition', 'reason'])) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', 'requirement disposition has unknown fields', {
      bindingId,
      profile,
      requirementId: entry.id,
    });
  }
  if (!registryIds.has(entry.id)) {
    fail('MUXUI_PLATFORM_SAFETY_REQUIREMENT_UNKNOWN', `unknown requirement ${entry.id}`, {
      bindingId,
      profile,
      requirementId: entry.id,
    });
  }
  if (!['required', 'not-applicable'].includes(entry.disposition)) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', `${entry.id} has an invalid disposition`, {
      bindingId,
      profile,
      requirementId: entry.id,
    });
  }
  if (
    entry.disposition === 'not-applicable'
    && (typeof entry.reason !== 'string' || entry.reason.length === 0)
  ) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', `${entry.id} needs a not-applicable reason`, {
      bindingId,
      profile,
      requirementId: entry.id,
    });
  }
  if (entry.disposition === 'required' && entry.reason !== undefined) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', `${entry.id} required disposition must omit reason`, {
      bindingId,
      profile,
      requirementId: entry.id,
    });
  }
  if (unsupported && entry.disposition !== 'not-applicable') {
    fail(
      'MUXUI_PLATFORM_SAFETY_PREMATURE_FULFILLMENT',
      `unsupported profile ${profile} cannot require ${entry.id}`,
      { bindingId, profile, requirementId: entry.id },
    );
  }
  return {
    id: entry.id,
    disposition: entry.disposition,
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
  };
}

export function compilePlatformSafetyRequirementSets({ contract, bindingId, binding }) {
  const identity = validatePlatformSafetyContract(contract);
  if (!isObject(binding) || !Array.isArray(binding.platformSafety)) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_MISSING', `${bindingId} has no platform-safety declaration`, {
      bindingId,
    });
  }
  const profiles = expectedProfiles(bindingId, binding);
  const expectedByProfile = new Map(profiles.map((profile) => [profile.profile, profile]));
  const declarations = new Map();
  for (const declaration of binding.platformSafety) {
    if (!closedObject(declaration, ['profile', 'validationProfile', 'requirements'])) {
      fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', `${bindingId} has a malformed declaration`, {
        bindingId,
      });
    }
    if (declarations.has(declaration.profile)) {
      fail('MUXUI_PLATFORM_SAFETY_DECLARATION_DUPLICATE', `duplicate profile ${declaration.profile}`, {
        bindingId,
        profile: declaration.profile,
      });
    }
    const expected = expectedByProfile.get(declaration.profile);
    if (!expected) {
      fail('MUXUI_PLATFORM_SAFETY_PROFILE_INVALID', `wrong profile ${declaration.profile}`, {
        bindingId,
        profile: declaration.profile,
      });
    }
    if (declaration.validationProfile !== expected.validationProfile) {
      fail('MUXUI_PLATFORM_SAFETY_PROFILE_INVALID', `wrong validation profile for ${declaration.profile}`, {
        bindingId,
        profile: declaration.profile,
        required: expected.validationProfile ?? null,
        actual: declaration.validationProfile ?? null,
      });
    }
    if (!Array.isArray(declaration.requirements)) {
      fail('MUXUI_PLATFORM_SAFETY_DECLARATION_INVALID', `${declaration.profile} requirements must be an array`, {
        bindingId,
        profile: declaration.profile,
      });
    }
    const seenIds = new Set();
    const requirements = declaration.requirements.map((entry) => {
      if (seenIds.has(entry?.id)) {
        fail('MUXUI_PLATFORM_SAFETY_REQUIREMENT_DUPLICATE', `duplicate requirement ${entry.id}`, {
          bindingId,
          profile: declaration.profile,
          requirementId: entry.id,
        });
      }
      seenIds.add(entry?.id);
      return normalizeDisposition(entry, new Set(identity.requirementIds), {
        bindingId,
        profile: declaration.profile,
        unsupported: expected.unsupported,
      });
    });
    const missing = identity.requirementIds.filter((id) => !seenIds.has(id));
    if (missing.length > 0) {
      fail('MUXUI_PLATFORM_SAFETY_REQUIREMENT_MISSING', `${declaration.profile} is incomplete`, {
        bindingId,
        profile: declaration.profile,
        requirementIds: missing,
      });
    }
    const normalized = {
      bindingId,
      profile: declaration.profile,
      ...(expected.validationProfile === undefined
        ? {}
        : { validationProfile: expected.validationProfile }),
      requirements: requirements.sort((left, right) => compareText(left.id, right.id)),
    };
    declarations.set(declaration.profile, normalized);
  }
  const missingProfiles = profiles
    .map(({ profile }) => profile)
    .filter((profile) => !declarations.has(profile));
  if (missingProfiles.length > 0) {
    fail('MUXUI_PLATFORM_SAFETY_DECLARATION_MISSING', `${bindingId} is missing profile declarations`, {
      bindingId,
      profiles: missingProfiles,
    });
  }
  const sets = profiles.map(({ profile }) => {
    const declaration = declarations.get(profile);
    const declarationRevision = canonicalDigest(declaration);
    const preimage = {
      schemaVersion: REQUIREMENT_SET_SCHEMA_VERSION,
      contractVersion: contract.contractVersion,
      contractDigest: identity.digest,
      bindingId,
      profile,
      ...(declaration.validationProfile === undefined
        ? {}
        : { validationProfile: declaration.validationProfile }),
      declarationRevision,
      dispositions: declaration.requirements,
    };
    return [profile, Object.freeze({ ...preimage, digest: canonicalDigest(preimage) })];
  });
  return Object.freeze(Object.fromEntries(sets));
}

export function assertPlatformSafetyRequirementSet({
  contract,
  bindingId,
  binding,
  profile,
  requirementSet,
}) {
  const expected = compilePlatformSafetyRequirementSets({ contract, bindingId, binding })[profile];
  if (!expected || canonicalJson(requirementSet) !== canonicalJson(expected)) {
    fail(
      'MUXUI_PLATFORM_SAFETY_CONSUMER_WEAKENED',
      `${bindingId}:${profile} does not match the binding-owned requirement set`,
      {
        bindingId,
        profile,
        requiredDigest: expected?.digest ?? null,
        actualDigest: requirementSet?.digest ?? null,
      },
    );
  }
  return requirementSet;
}
