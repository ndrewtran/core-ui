# Tooling package navigation

This package owns the `muxui` CLI grammar, capability policy, output renderers,
and generated parser/help/completion/manifest/type projections. Query semantics,
ranking, provenance, and response grammar remain owned by `@muxui/catalog`
and `@muxui/schema`.

Change `command-registry.json` before regenerating command projections. Run
`pnpm --filter @muxui/tooling check`, then `pnpm check` and
`pnpm generate:check`. Never patch `generated/command-surface.mjs` or
`generated/response-types.d.ts` directly.
