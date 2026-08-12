import { canonicalJson } from '../../../packages/schema/src/index.mjs';

const ROOT_KEYS = Object.freeze([
  'schema', 'id', 'bindingRef', 'componentSupportClaim', 'platformSafetyContractDigest', 'tuples',
]);
const TUPLE_KEYS = Object.freeze([
  'profile', 'validationProfile', 'platformSafetyRequirementSetDigest',
]);
const ORDER = Object.freeze(['ios', 'android', 'native.react-native-web']);

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value)) !== canonicalJson(keys)) {
    throw new Error(`G12_FIXTURE_INVALID: ${label} keys`);
  }
}

export function assertG12PlatformSafetyFixture(fixture, component) {
  exactKeys(fixture, ROOT_KEYS, 'root');
  if (fixture.schema !== 'core-ui-g1-2-platform-safety-fixture-v1'
    || fixture.id !== 'fixture:platform-safety-native'
    || fixture.bindingRef !== 'core:component:button#native.react-native'
    || fixture.componentSupportClaim !== 'none'
    || !Array.isArray(fixture.tuples) || fixture.tuples.length !== ORDER.length) {
    throw new Error('G12_FIXTURE_INVALID: identity');
  }
  if (canonicalJson(fixture.tuples.map(({ profile }) => profile)) !== canonicalJson(ORDER)) {
    throw new Error('G12_FIXTURE_INVALID: tuple order');
  }
  const contractDigests = new Set();
  for (const [position, tuple] of fixture.tuples.entries()) {
    exactKeys(tuple, TUPLE_KEYS, `tuple ${position}`);
    const requirementSet = component.platformSafetyRequirementSets[`native.react-native:${tuple.profile}`];
    if (!requirementSet || requirementSet.profile !== tuple.profile
      || requirementSet.validationProfile !== tuple.validationProfile
      || requirementSet.digest !== tuple.platformSafetyRequirementSetDigest) {
      throw new Error(`G12_FIXTURE_INVALID: tuple ${tuple.profile}`);
    }
    contractDigests.add(requirementSet.contractDigest);
  }
  if (contractDigests.size !== 1 || !contractDigests.has(fixture.platformSafetyContractDigest)) {
    throw new Error('G12_FIXTURE_INVALID: platform safety contract');
  }
  return fixture;
}
