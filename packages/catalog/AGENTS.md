# Catalog package navigation

This package owns the deterministic compiler, immutable generated bundle, and
transport-independent query kernel. Canonical product facts remain under
`catalog/`; response grammar remains owned by `@core-ui/schema`.

Run `pnpm --filter @core-ui/catalog check`, then the root `pnpm check` and
`pnpm generate:check`. Never patch `generated/catalog.mjs` directly.
