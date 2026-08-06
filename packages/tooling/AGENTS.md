# Tooling package navigation

This package owns the `core` CLI grammar, capability policy, output renderers,
and generated parser/help/completion/manifest/type projections. Query semantics,
ranking, provenance, and response grammar remain owned by `@core-ui/catalog`
and `@core-ui/schema`.

Change `command-registry.json` before regenerating command projections. Run
`pnpm --filter @core-ui/tooling check`, then `pnpm check` and
`pnpm generate:check`. Never patch `generated/command-surface.mjs` or
`generated/response-types.d.ts` directly.
