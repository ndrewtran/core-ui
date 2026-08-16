# React package navigation

`src/` owns the standalone React lifecycle, host-language refinements, and
Core-owned CSS implementation. It does not import `@core-ui/web` or Tale UI at
runtime or build time. The pinned Tale styling snapshot is a one-time donor:
each admitted component uses its accepted donor disposition and donor-to-Core
token/style crosswalk rather than copying Tale selectors, metadata, or package
identities. `test/` proves SSR/hydration, effect cleanup, typed host ergonomics,
CSS and donor-visual conformance, and applicable binding behavior. No
component-support claim is permitted before the owning R1 tranche evidence and
release boundary.

An applicable donor is routinely exportable only as `adopt` or `adapt`.
`defer`/`reject` remains unexported until its separately accepted exception is
reconciled; `no-applicable-donor` requires actual donor absence.

Copied or adapted substantial donor portions must retain the R1.0-owned Tale
license/notice disposition in the exact package and release artifacts.

Run `pnpm --filter @core-ui/react check`, then the root affected checks.
