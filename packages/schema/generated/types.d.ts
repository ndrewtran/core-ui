// @generated-from: packages/schema/schemas/type-projection.json
// @generated-content-sha256: sha256:1b3fc5eebbb405e62f45000667ec6145ba2d4f31844a41dffc04b60ab544efbe
export type ArtifactRef = `muxui:${ArtifactKind}:${string}`;
export type BindingRef = `${Extract<ArtifactRef, `muxui:component:${string}`>}#${BindingId}`;
export type ArtifactKind = "component" | "pattern" | "token" | "foundation" | "guide" | "example" | "pitfall" | "migration" | "capability";
export type EnabledRecordKind = "component" | "token" | "guide" | "example" | "capability";
export type RelationType = "implemented-by" | "example-of" | "uses" | "available-on";
export type Lifecycle = "experimental" | "stable" | "deprecated" | "removed";
export type Strategy = "direct" | "adapted" | "native-alternative" | "unsupported";
export type BindingId = "web.html" | "web.react" | "native.react-native";
export type RuntimeProfileId = "ios" | "android" | "native.react-native-web";
export type PlatformSafetyRequirementId = "system.forced-colors" | "system.high-contrast" | "native.dynamic-color" | "native.font-metrics" | "layout.direction" | "platform.accessibility-mapping";
export type ErrorCode = "MUXUI_SCHEMA_INVALID" | "MUXUI_ARTIFACT_ID_INVALID" | "MUXUI_RELATION_INVALID" | "MUXUI_FIELD_OWNERSHIP_INVALID" | "MUXUI_SCHEMA_VERSION_UNSUPPORTED" | "MUXUI_QUERY_INVALID" | "MUXUI_QUERY_API_VERSION_UNSUPPORTED" | "MUXUI_QUERY_INLINE_TOKENS_DEPRECATED" | "MUXUI_QUERY_PAGE_ENVELOPE_TOO_LARGE" | "MUXUI_QUERY_PAGE_ENTRY_TOO_LARGE" | "MUXUI_CURSOR_INVALID" | "MUXUI_ARTIFACT_NOT_FOUND" | "MUXUI_PROJECT_NOT_FOUND" | "MUXUI_CATALOG_NOT_DECLARED" | "MUXUI_CATALOG_NOT_INSTALLED" | "MUXUI_CATALOG_DECLARATION_DRIFT" | "MUXUI_CATALOG_INTEGRITY_MISMATCH" | "MUXUI_CATALOG_RESOLUTION_AMBIGUOUS" | "MUXUI_CATALOG_INCOMPATIBLE";
export type QueryResponseType = "catalog.manifest" | "artifact.list" | "artifact.search" | "artifact.detail" | "artifact.detail.section-page" | "error";
