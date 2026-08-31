// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:e1d63812be531f4a6c58ad890e5388710079eefeeedfcb1f6afa925e20dce684
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const nativeProfileProjection = deepFreeze({"bindingContentRevision":"sha256:9b50380991f8352fee4e0b72863558bf496dcef2c05877991044eb93196a645d","bindingRef":"muxui:component:button#native.react-native","bindingSpecRevision":"sha256:00de791db4af7b748ad6cfa5fedc7b5172ccdfe3d5e2ca2c18e876ca9b29d6c0","componentId":"muxui:component:button","componentSupportClaim":"none","package":"@muxui/react-native","platformSafetyContractDigest":"sha256:05aac25e3ce18edd5e441d7ab1de72edc88b753d5b86e373356755a6abe4f65e","profiles":{"android":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:c39d058a275ca15be603f8975627e6fba9bb8ac4f9e71dd4e053e17bc4d4d479","profile":"android","strategy":"adapted","tokenRequirementSetDigest":"sha256:cae8007dfb49557a8f3b2145779ef07531eaea96e64679a47a885b0a67297b84","validationProfile":"native.android"},"ios":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:99b6af26b8b3af16af361660b8e3862dbb867fcb92f412fc905517b92fc67113","profile":"ios","strategy":"adapted","tokenRequirementSetDigest":"sha256:31d3d7d8b86fff0f626667d5b7a7de43f6c0abd2ad831bf270b73b6b6aeca886","validationProfile":"native.ios"},"native.react-native-web":{"platformSafetyRequirementSetDigest":"sha256:7fce639efab87e8d491ca3d3d7b4e1009e70636f4a83cd1e1d061c36891ec2be","profile":"native.react-native-web","reason":"No responsible implementation in the first proof artifact.","strategy":"unsupported","validationProfile":"native.react-native-web"}},"schema":"muxui-react-native-profile-projection-v1"});
export const nativeProfiles = nativeProfileProjection.profiles;
