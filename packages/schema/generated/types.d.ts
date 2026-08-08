// @generated-from: packages/schema/schemas/type-projection.json
// @generated-content-sha256: sha256:4476097c0651d1583c9f4d398dcb0526d75bc17bcffc21b80e6d96de569a404b
export type ArtifactRef = `core:${ArtifactKind}:${string}`;
export type BindingRef = `${Extract<ArtifactRef, `core:component:${string}`>}#${BindingId}`;
export type ArtifactKind = "component" | "pattern" | "token" | "foundation" | "guide" | "example" | "pitfall" | "migration" | "capability";
export type EnabledRecordKind = "component" | "token" | "guide" | "example" | "capability";
export type RelationType = "implemented-by" | "example-of" | "uses" | "available-on";
export type Lifecycle = "experimental" | "stable" | "deprecated" | "removed";
export type Strategy = "direct" | "adapted" | "native-alternative" | "unsupported";
export type BindingId = "web.html" | "web.react" | "native.react-native";
export type RuntimeProfileId = "ios" | "android" | "native.react-native-web";
export type ErrorCode = "CORE_SCHEMA_INVALID" | "CORE_ARTIFACT_ID_INVALID" | "CORE_RELATION_INVALID" | "CORE_FIELD_OWNERSHIP_INVALID" | "CORE_SCHEMA_VERSION_UNSUPPORTED" | "CORE_QUERY_INVALID" | "CORE_CURSOR_INVALID" | "CORE_ARTIFACT_NOT_FOUND" | "CORE_PROJECT_NOT_FOUND" | "CORE_CATALOG_NOT_DECLARED" | "CORE_CATALOG_NOT_INSTALLED" | "CORE_CATALOG_DECLARATION_DRIFT" | "CORE_CATALOG_INTEGRITY_MISMATCH" | "CORE_CATALOG_RESOLUTION_AMBIGUOUS" | "CORE_CATALOG_INCOMPATIBLE";
export type QueryResponseType = "catalog.manifest" | "artifact.list" | "artifact.search" | "artifact.detail" | "error";
