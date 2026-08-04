# Decision 0001: Workspace runtime and repository policy

- Status: Accepted
- Date: 2026-08-04
- Owner: Core UI maintainer
- Roadmap: G0.0
- Scope: `SCOPE-FOUNDATION-001`, `SCOPE-QUALITY-GENERATOR-CONTRACT`

## Context

G0.0 requires one package-manager and runtime policy before workspace sources
multiply. The repository also needs one machine-readable owner for path,
generation, slug, and alias rules so navigation files and future generators do
not become competing policy sources.

## Decision

- Use pnpm workspaces and pin pnpm `10.33.0` in the root `packageManager`
  field and lockfile.
- Support Node.js `24.x` for the Foundation boundary. Pin local and CI proof to
  Node.js `24.19.0`; a different Node major requires a new decision or an
  amendment to this one.
- Use workspace dependency declarations as the task graph. Root commands select
  package-owned tasks in topological order; affected checks include every
  changed package and all of its dependents. A repository-wide policy or
  configuration change runs the full graph.
- Keep the six architecture-defined root commands as the entire root script
  surface. Detailed checks and generators belong to their owning workspace
  package.
- Store the executable canonical/projection, generated-marker, slug, and alias
  rules in `tooling/audits/repository-policy/repository-policy.json`. Prose may
  link to that file but must not duplicate it as an independently editable
  ruleset.
- A generated file must identify its earliest source and carry a verifiable
  content digest. A mismatch fails with an owner-linked repair instruction;
  generated output is never repaired directly.
- Package, catalog, and artifact slugs use lowercase kebab-case. Exceptions are
  explicit aliases owned by the canonical artifact record and are audited
  deterministically.

## Consequences

- The initial workspace can prove orchestration and repository policy without
  creating product, renderer, catalog, or speculative foundation packages.
- Root affected checks stay safe when shared configuration changes and remain
  narrow for isolated package changes.
- Future generators must implement stable ordering, `--check`, source-linked
  drift diagnostics, and wall-clock-free canonical preimages before activation.
- This decision makes no public runtime, package, compatibility, or release
  claim. The Foundation boundary remains internal.

## Rejected alternatives

- npm or Yarn alongside pnpm: this would create multiple workspace authorities.
- A hand-maintained component or package inventory in navigation files: this
  would become a second registry.
- Inferring generated files from directory names alone: this cannot provide the
  earliest source or detect direct body edits.
- Treating the current machine's unpinned runtime as support policy: this is not
  reproducible evidence.
