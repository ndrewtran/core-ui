# Web package navigation

`src/` owns the framework-free runtime and internal public-surface compiler.
`generated/` is package-owned projection output and is never edited directly.
`test/` proves progressive HTML, hook conformance, one-owner lifecycle, and the
two G1.1 platform-safety fixture profiles. No file in this package may claim a
component support cell before its owning slice milestone.

Run `pnpm --filter @muxui/web check`, then the root affected checks.
