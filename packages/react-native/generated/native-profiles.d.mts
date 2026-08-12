// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:823b12d2b7d31e8d9dc82afda0a45412bb9589a128c931ff06cb4bb2067a8664
export type NativeProfileId = 'android' | 'ios' | 'native.react-native-web';
export type NativeProfile = Readonly<
  | { profile: 'android'; validationProfile: 'native.android'; strategy: 'adapted'; lifecycle: 'experimental'; platformSafetyRequirementSetDigest: "sha256:9c98f1329080b3f9f554d1a0e10a04fb6d865f23fc1b0208c31f5edcb8c74401"; tokenRequirementSetDigest: "sha256:78598adeb18b3c3931578e12819a56264a9d1d76afc05d4bf2778adda52f9513"; }
  | { profile: 'ios'; validationProfile: 'native.ios'; strategy: 'adapted'; lifecycle: 'experimental'; platformSafetyRequirementSetDigest: "sha256:04a803108288a2b341f48e5b8a6bbc04e4592518cc537bf2e95c6cf6764f4105"; tokenRequirementSetDigest: "sha256:994281d2f9a88064469eb311b4f79426a74186ab8c9c31f96ca7c8ef5e45c560"; }
  | { profile: 'native.react-native-web'; validationProfile: 'native.react-native-web'; strategy: 'unsupported'; reason: "No responsible implementation in the first proof artifact."; platformSafetyRequirementSetDigest: "sha256:4325d1ac906c4ac90d1fe561b46b9915c59a1ebf43b8d17e906de143fc47eb09"; }
>;
export interface NativeProfileProjection {
  readonly schema: 'core-ui-react-native-profile-projection-v1';
  readonly package: '@core-ui/react-native';
  readonly componentId: 'core:component:button';
  readonly bindingRef: 'core:component:button#native.react-native';
  readonly bindingContentRevision: "sha256:9fd5619f1669f731a31bfd49b25198506af7df0117ed15e7ed7a36b46576d2f0";
  readonly bindingSpecRevision: "sha256:589c901a1ae6d09bcd5606d16bf93f6ba29291d58e4ef6dbb82383692bede2f6";
  readonly componentSupportClaim: 'none';
  readonly platformSafetyContractDigest: "sha256:4ce80ab4d5ee2ebd9db45265b0ab9e5ce56dc18f3c59f17548bc680648705d97";
  readonly profiles: Readonly<Record<NativeProfileId, NativeProfile>>;
}
export const nativeProfileProjection: NativeProfileProjection;
export const nativeProfiles: Readonly<Record<NativeProfileId, NativeProfile>>;
