// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:39dd733939ac5634bc89124f5c27705686a2d35267cbe1f2c391fb303b52c0ef
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const nativeProfileProjection = deepFreeze({"bindingContentRevision":"sha256:9fd5619f1669f731a31bfd49b25198506af7df0117ed15e7ed7a36b46576d2f0","bindingRef":"core:component:button#native.react-native","bindingSpecRevision":"sha256:a6a03b1805f9285097811f0f7773c28c0b43102d8cde84987c7c53c2b8ae8d2f","componentId":"core:component:button","componentSupportClaim":"none","package":"@core-ui/react-native","platformSafetyContractDigest":"sha256:4ce80ab4d5ee2ebd9db45265b0ab9e5ce56dc18f3c59f17548bc680648705d97","profiles":{"android":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:9c98f1329080b3f9f554d1a0e10a04fb6d865f23fc1b0208c31f5edcb8c74401","profile":"android","strategy":"adapted","tokenRequirementSetDigest":"sha256:78598adeb18b3c3931578e12819a56264a9d1d76afc05d4bf2778adda52f9513","validationProfile":"native.android"},"ios":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:04a803108288a2b341f48e5b8a6bbc04e4592518cc537bf2e95c6cf6764f4105","profile":"ios","strategy":"adapted","tokenRequirementSetDigest":"sha256:994281d2f9a88064469eb311b4f79426a74186ab8c9c31f96ca7c8ef5e45c560","validationProfile":"native.ios"},"native.react-native-web":{"platformSafetyRequirementSetDigest":"sha256:4325d1ac906c4ac90d1fe561b46b9915c59a1ebf43b8d17e906de143fc47eb09","profile":"native.react-native-web","reason":"No responsible implementation in the first proof artifact.","strategy":"unsupported","validationProfile":"native.react-native-web"}},"schema":"core-ui-react-native-profile-projection-v1"});
export const nativeProfiles = nativeProfileProjection.profiles;
