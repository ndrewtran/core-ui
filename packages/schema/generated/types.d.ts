// @generated-from: packages/schema/schemas/type-projection.json
// @generated-content-sha256: sha256:7f7d313695e26e217975969776e8536cab93e19754f53faafdd69069dfb11f39
export type ArtifactRef = `core:${ArtifactKind}:${string}`;
export type BindingRef = `${Extract<ArtifactRef, `core:component:${string}`>}#${BindingId}`;
export type ArtifactKind = "component" | "pattern" | "token" | "foundation" | "guide" | "example" | "pitfall" | "migration" | "capability";
export type EnabledRecordKind = "component" | "token" | "guide" | "example" | "capability";
export type RelationType = "implemented-by" | "example-of" | "uses" | "available-on";
export type Lifecycle = "experimental" | "stable" | "deprecated" | "removed";
export type Strategy = "direct" | "adapted" | "native-alternative" | "unsupported";
export type BindingId = "web.html" | "web.react" | "native.react-native";
export type RuntimeProfileId = "ios" | "android" | "native.react-native-web";
export type PlatformSafetyRequirementId = "system.forced-colors" | "system.high-contrast" | "native.dynamic-color" | "native.font-metrics" | "layout.direction" | "platform.accessibility-mapping";
export type ErrorCode = "CORE_SCHEMA_INVALID" | "CORE_ARTIFACT_ID_INVALID" | "CORE_RELATION_INVALID" | "CORE_FIELD_OWNERSHIP_INVALID" | "CORE_SCHEMA_VERSION_UNSUPPORTED" | "CORE_QUERY_INVALID" | "CORE_QUERY_API_VERSION_UNSUPPORTED" | "CORE_QUERY_INLINE_TOKENS_DEPRECATED" | "CORE_QUERY_PAGE_ENVELOPE_TOO_LARGE" | "CORE_QUERY_PAGE_ENTRY_TOO_LARGE" | "CORE_CURSOR_INVALID" | "CORE_ARTIFACT_NOT_FOUND" | "CORE_PROJECT_NOT_FOUND" | "CORE_CATALOG_NOT_DECLARED" | "CORE_CATALOG_NOT_INSTALLED" | "CORE_CATALOG_DECLARATION_DRIFT" | "CORE_CATALOG_INTEGRITY_MISMATCH" | "CORE_CATALOG_RESOLUTION_AMBIGUOUS" | "CORE_CATALOG_INCOMPATIBLE";
export type QueryResponseType = "catalog.manifest" | "artifact.list" | "artifact.search" | "artifact.detail" | "artifact.detail.section-page" | "error";
