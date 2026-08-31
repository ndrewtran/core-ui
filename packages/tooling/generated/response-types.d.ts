// @generated-from: packages/tooling/command-registry.json
// @generated-content-sha256: sha256:1064109e15f3c22a9b6d9bef0c87e3462811eeee06fbcf01200be9f819c218e1
import type { QueryResponseType } from '@muxui/schema/types';

export type ManifestResponseType = Extract<QueryResponseType, "catalog.manifest">;
export type ListResponseType = Extract<QueryResponseType, "artifact.list">;
export type SearchResponseType = Extract<QueryResponseType, "artifact.search">;
export type GetResponseType = Extract<QueryResponseType, "artifact.detail">;
