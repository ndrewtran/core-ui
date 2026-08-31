# Token package navigation

`src/` owns deterministic token graph validation, requirement closure, theme
validation, and web/native transforms. Canonical token meaning and values remain
under `catalog/tokens/`; tests prove behavior but do not author token facts.

Run `pnpm --filter @muxui/tokens check`, then the root affected checks and
`pnpm generate:check` when package descriptors or catalog projections change.
