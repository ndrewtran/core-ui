// @generated-from: packages/tooling/command-registry.json
// @generated-content-sha256: sha256:ba132d949a3a5d60d1ad2f213af5beb9c9bfeb8433fcb589069e3ef04dd08a2d
import type { QueryResponseType } from '@core-ui/schema/types';

export type ManifestResponseType = Extract<QueryResponseType, "catalog.manifest">;
export type ListResponseType = Extract<QueryResponseType, "artifact.list">;
export type SearchResponseType = Extract<QueryResponseType, "artifact.search">;
export type GetResponseType = Extract<QueryResponseType, "artifact.detail">;
