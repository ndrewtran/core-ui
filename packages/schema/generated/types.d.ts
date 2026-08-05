// @generated-from: packages/schema/schemas/type-projection.json
// @generated-content-sha256: sha256:645803d128a3b841c7bcd434141bac152bb58922b14c315a415b2a9e1a3d895b
export type ArtifactRef = `core:${ArtifactKind}:${string}`;
export type BindingRef = `${Extract<ArtifactRef, `core:component:${string}`>}#${BindingId}`;
export type ArtifactKind = "component" | "pattern" | "token" | "foundation" | "guide" | "example" | "pitfall" | "migration" | "capability";
export type EnabledRecordKind = "component" | "token" | "guide" | "example" | "capability";
export type RelationType = "implemented-by" | "example-of" | "uses" | "available-on";
export type Lifecycle = "experimental" | "stable" | "deprecated" | "removed";
export type Strategy = "direct" | "adapted" | "native-alternative" | "unsupported";
export type BindingId = "web.html" | "web.react" | "native.react-native";
export type RuntimeProfileId = "ios" | "android" | "native.react-native-web";
export type ErrorCode = "CORE_SCHEMA_INVALID" | "CORE_ARTIFACT_ID_INVALID" | "CORE_RELATION_INVALID" | "CORE_FIELD_OWNERSHIP_INVALID" | "CORE_SCHEMA_VERSION_UNSUPPORTED";
