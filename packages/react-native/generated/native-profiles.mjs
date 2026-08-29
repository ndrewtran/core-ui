// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:d01040bf85dc8b3c65bd5abf1f97c21c964a7d096dee0d61d15e6e7bf4aa6e76
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const nativeProfileProjection = deepFreeze({"bindingContentRevision":"sha256:9fd5619f1669f731a31bfd49b25198506af7df0117ed15e7ed7a36b46576d2f0","bindingRef":"core:component:button#native.react-native","bindingSpecRevision":"sha256:56e8aa10d07de737a3e916bcde5ac70491e0f4b23ccb2c8e9e2b615eb02099b4","componentId":"core:component:button","componentSupportClaim":"none","package":"@core-ui/react-native","platformSafetyContractDigest":"sha256:4ce80ab4d5ee2ebd9db45265b0ab9e5ce56dc18f3c59f17548bc680648705d97","profiles":{"android":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:9c98f1329080b3f9f554d1a0e10a04fb6d865f23fc1b0208c31f5edcb8c74401","profile":"android","strategy":"adapted","tokenRequirementSetDigest":"sha256:6cc32f75eba202bb4a19e6b09b9e9cc391da0cf3eb536dd33dd3748e6997c401","validationProfile":"native.android"},"ios":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:04a803108288a2b341f48e5b8a6bbc04e4592518cc537bf2e95c6cf6764f4105","profile":"ios","strategy":"adapted","tokenRequirementSetDigest":"sha256:1a2481c2164d480fb8f734325ac4e54ffa4c8d14a19cec8c8d46d5fc24ba583b","validationProfile":"native.ios"},"native.react-native-web":{"platformSafetyRequirementSetDigest":"sha256:4325d1ac906c4ac90d1fe561b46b9915c59a1ebf43b8d17e906de143fc47eb09","profile":"native.react-native-web","reason":"No responsible implementation in the first proof artifact.","strategy":"unsupported","validationProfile":"native.react-native-web"}},"schema":"core-ui-react-native-profile-projection-v1"});
export const nativeProfiles = nativeProfileProjection.profiles;
