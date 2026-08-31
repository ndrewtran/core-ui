// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:dcda4979d3baf1313760cd8a3a12b6f40ed36833dcb9bfe56962b7128fd5062e
export type NativeProfileId = 'android' | 'ios' | 'native.react-native-web';
export type NativeProfile = Readonly<
  | { profile: 'android'; validationProfile: 'native.android'; strategy: 'adapted'; lifecycle: 'experimental'; platformSafetyRequirementSetDigest: "sha256:c39d058a275ca15be603f8975627e6fba9bb8ac4f9e71dd4e053e17bc4d4d479"; tokenRequirementSetDigest: "sha256:cae8007dfb49557a8f3b2145779ef07531eaea96e64679a47a885b0a67297b84"; }
  | { profile: 'ios'; validationProfile: 'native.ios'; strategy: 'adapted'; lifecycle: 'experimental'; platformSafetyRequirementSetDigest: "sha256:99b6af26b8b3af16af361660b8e3862dbb867fcb92f412fc905517b92fc67113"; tokenRequirementSetDigest: "sha256:31d3d7d8b86fff0f626667d5b7a7de43f6c0abd2ad831bf270b73b6b6aeca886"; }
  | { profile: 'native.react-native-web'; validationProfile: 'native.react-native-web'; strategy: 'unsupported'; reason: "No responsible implementation in the first proof artifact."; platformSafetyRequirementSetDigest: "sha256:7fce639efab87e8d491ca3d3d7b4e1009e70636f4a83cd1e1d061c36891ec2be"; }
>;
export interface NativeProfileProjection {
  readonly schema: 'muxui-react-native-profile-projection-v1';
  readonly package: '@muxui/react-native';
  readonly componentId: 'muxui:component:button';
  readonly bindingRef: 'muxui:component:button#native.react-native';
  readonly bindingContentRevision: "sha256:9b50380991f8352fee4e0b72863558bf496dcef2c05877991044eb93196a645d";
  readonly bindingSpecRevision: "sha256:00de791db4af7b748ad6cfa5fedc7b5172ccdfe3d5e2ca2c18e876ca9b29d6c0";
  readonly componentSupportClaim: 'none';
  readonly platformSafetyContractDigest: "sha256:05aac25e3ce18edd5e441d7ab1de72edc88b753d5b86e373356755a6abe4f65e";
  readonly profiles: Readonly<Record<NativeProfileId, NativeProfile>>;
}
export const nativeProfileProjection: NativeProfileProjection;
export const nativeProfiles: Readonly<Record<NativeProfileId, NativeProfile>>;
