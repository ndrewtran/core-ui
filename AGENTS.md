# Mux UI route map

## Routes

- `strategy/`: architecture, milestone roadmap, and Product Scope authority.
- `decisions/`: accepted repository and product decisions.
- `catalog/`: canonical public knowledge sources.
- `packages/`: package-owned schemas, renderers, catalog, and tooling products.
- `apps/`: documentation and explorer projections over enabled products.
- `tooling/`: compilers, generators, audits, and evaluations.
- `tests/`: cross-package, consumer, platform, conformance, and agent fixtures.

Read the nearest local `AGENTS.md` after entering a major directory.

## Discovery loop

1. Identify the requested artifact, package, or capability.
2. Read its nearest `AGENTS.md` and owning canonical source.
3. Follow declared references; do not infer an inventory from filenames.
4. Change the earliest owner, then regenerate and verify its projections.

## Source ownership

Canonical facts are authored once. Renderer source owns runtime behavior;
tests prove expectations; generated output is never repaired directly. The
executable path, slug, alias, and generated-marker contract is owned by
`tooling/audits/repository-policy/repository-policy.json`.

## Verification

- `pnpm check`: affected deterministic checks plus required dependents.
- `pnpm check:all`: the complete deterministic workspace graph.
- `pnpm generate`: bounded package-owned projections in dependency order.
- `pnpm generate:check`: repeated no-op generation identity.
- `pnpm test:agent`: enabled opt-in or scheduled agent evaluations.
- `pnpm release:prepare`: deterministic candidate preparation; never publish.
