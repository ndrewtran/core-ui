# Core UI milestone roadmap

- Status: Execution baseline
- Product: Core UI
- Architecture authority: [`monorepo-architecture.md`](./monorepo-architecture.md)
- Scope: implementation milestones, entry conditions, deliverables, acceptance
  evidence, dependencies, and scope controls

## Purpose and authority

This roadmap turns the Core UI architecture into evidence-bearing delivery
milestones. It does not replace or reinterpret the architecture. If this
roadmap conflicts with the architecture, the architecture wins and the roadmap
must be corrected before work continues.

The roadmap is dependency-based, not calendar-based. A milestone completes
only when its retained acceptance evidence proves the exit condition. Code
completion, a demonstration, elapsed time, or agreement that a milestone is
“close enough” is not completion.

The governing delivery rule is:

> Build the smallest operability spine that a real renderer slice needs, prove
> the slice across web, React, and React Native, and admit broader tooling only
> when an observed workflow and an earlier gate justify it.

## How to use this roadmap

### Status vocabulary

Every milestone uses one of these states:

| State | Meaning |
| --- | --- |
| `not-ready` | One or more entry conditions are unproved. Work may explore, but it may not publish or become a dependency. |
| `ready` | Every entry condition is proved and the milestone scope is locked. |
| `active` | Work is underway within the locked scope. |
| `evidence-review` | Deliverables are complete and the retained evidence packet is under review. |
| `complete` | Every exit assertion passes with no expired or disallowed exception. |
| `blocked` | A canonical-source, safety, compatibility, integrity, or required-proof failure prevents progress. |

Ordinary scheduling conflicts, missing later-gate infrastructure, optional
dashboard work, and unproved product ideas are not architectural blockers.

### Milestone completion rule

A milestone is complete only when all of the following are true:

1. Every entry condition was true when work began and remained true at
   evidence capture.
2. Every required deliverable exists under its named owner.
3. Every required assertion has retained evidence tied to exact source,
   artifact, binding, package, catalog, and environment revisions as
   applicable.
4. All negative-path fixtures pass; success-path demonstrations alone are
   insufficient.
5. Generated output has been reproduced from canonical input and was not
   patched.
6. Scope remained within the milestone, or a separately approved roadmap
   change re-established entry and exit conditions.
7. Active operational exceptions, if permitted, only narrow support and are
   visible in diagnostics and release metadata.

### Evidence packet contract

Each milestone produces one immutable evidence index. Individual evidence
records follow the architecture’s proof schema and identify:

- milestone and assertion ID;
- source revision and catalog version/digest;
- artifact, binding, binding-spec revision, renderer package, and runtime
  profile where applicable;
- evidence kind, tool version, environment, input and canonical example IDs;
- outcome, retained artifact URI or digest, disclosure class, owner, timestamp,
  and retention/expiry policy;
- active exception or advisory references; and
- the exact command or reproducible procedure used to produce the result.

Public evidence exposes only sanitized metadata and digests. Restricted or
internal payloads remain access-controlled. A transient log cannot satisfy an
exit condition.

### Acceptance cadence

| Cadence | Minimum evidence |
| --- | --- |
| Pull request | Schema and relation validity, generation identity, field ownership, affected types and units, changed examples, focused package fixture, and basic accessibility checks. |
| Scheduled | Full browser/device matrices, visual permutations, performance, broad consumer fixtures, and repeated agent evaluations. |
| Gate exit | Every milestone assertion for that gate, cross-cutting fixtures enabled by the gate, exact release-manifest correlation, and no expired exception. |
| Stable release | All deterministic gates, supported-profile smoke tests, digest parity, required manual accessibility evidence, compatibility review, and support-lifetime evidence retention. |

## Execution guardrails

### Renderer-first priority

- Gate 1 renderer slices are the critical path after Gate 0.
- An enabling-system milestone must name the renderer or acceptance fixture it
  unblocks. Unattached infrastructure returns to `not-ready`.
- A later capability cannot block an earlier renderer milestone unless the
  renderer would violate a canonical-source, safety, compatibility, integrity,
  or required-proof rule without it.
- Shared foundation code is added only after a real slice demonstrates the
  repeated semantic, logic, or interaction shape.
- Broad component expansion waits for the fixed Gate 1 matrix; broad tooling
  expansion waits for the capability’s own entry evidence.

### Scope admission

A proposal for a new artifact kind, durable relation, revision axis, package,
manifest, command, integration, or public capability must include:

1. an observed workflow that existing records and relations cannot express;
2. one authoritative owner and at least one named consumer;
3. its query or operation shape;
4. validation, proof, compatibility, and migration effects;
5. scaffold, semantic diff, diagnostics, and affected-closure support; and
6. a removal or deprecation path.

Admission preference is: derive a projection, add a typed relation, add a
bounded field to an existing kind, and only then introduce a new kind. Missing
admission evidence means defer, not “implement experimentally in stable
output.”

### Scope lock and change control

At `ready`, the milestone’s deliverables and exit assertions are locked. New
work is classified as one of:

- **Required correction:** necessary to satisfy an existing assertion. It stays
  in the milestone.
- **Adjacent improvement:** useful but unnecessary for exit. It becomes a
  separately tracked follow-up.
- **New capability or ontology:** requires scope admission and a roadmap
  amendment.
- **Later-gate dependency:** remains unavailable and must not be simulated by
  an undocumented shortcut.

No milestone may silently broaden its target matrix, supported runtime profile,
public API, or evidence claim. Narrowing support requires an explicit canonical
disposition or permitted operational exception.

From G1.9 onward, every authored repository change—whether produced manually
or by tooling—attaches a `ChangeIntentEnvelope` derived from the final diff
before merge. The envelope remains read-only until an enabled write protocol
exists. From G2.5 onward, any automated apply must bind explicit approval and
the operation journal to that exact envelope digest; a changed diff invalidates
the approval.

### Non-waivable rules

No operational exception or milestone decision may:

- patch a generated projection;
- create a second authoring owner;
- broaden support or compatibility;
- bypass package, catalog, signature, provenance, or lockfile integrity;
- turn missing evidence into a passed result;
- promote a stable binding without mandatory accessibility and safety proof;
- let hosted/latest guidance masquerade as installed-local truth;
- execute an unconfirmed mutation; or
- use a stochastic model result to override deterministic failure.

## Dependency map

```mermaid
flowchart TD
  g00["G0.0 Repository and task graph"]
  g01["G0.1 Schema and identity kernel"]
  g02["G0.2 Catalog compiler and query kernel"]
  g03["G0.3 CLI documentation surface"]
  g04["G0.4 Local catalog resolution"]
  g05["G0.5 Maintainer authoring baseline"]
  gate0["Gate 0 exit"]

  g10["G1.0 Tokens and foundation boundaries"]
  g11["G1.1 Web and React substrate"]
  g12["G1.2 React Native substrate"]
  slices["G1.3-G1.7 Component slices"]
  pattern["G1.8 Form pattern and curriculum"]
  g19["G1.9 Cross-slice proof and 0.1"]
  gate1["Gate 1 exit"]

  proofExt["G2.0 Tabs and Toast proof extension"]
  packages["G2.1 Packages, compatibility and releases"]
  consumers["G2.2 Consumer validation and resolver"]
  docs["G2.3 Documentation, explorers and local MCP"]
  plan["G2.4 Grounded composition planning"]
  projectOps["G2.5 Doctor and init"]
  authorOps["G2.6 Allowlisted canonical proposals"]
  gate2["Gate 2 exit"]

  scale["G3.1 Breadth and patterns"]
  migrations["G3.2 Migrations"]
  hosted["G3.3 Hosted MCP"]
  evals["G3.4 Agent-eval promotion"]
  design["G3.5 Themes and design-tool interchange"]
  semantics["G3.6 Promptable-semantics discovery"]
  optional["G3.7-G3.11 Optional capabilities"]

  g00 --> g01 --> g02 --> g03
  g02 --> g04
  g01 --> g05
  g03 --> gate0
  g04 --> gate0
  g05 --> gate0

  gate0 --> g10
  gate0 --> g11
  gate0 --> g12
  g10 --> slices
  g11 --> slices
  g12 --> slices
  slices --> pattern --> g19 --> gate1

  gate1 --> proofExt
  gate1 --> packages --> consumers --> gate2
  packages --> docs --> gate2
  pattern --> plan
  plan -.->|if enabled| gate2
  consumers --> projectOps
  projectOps -.->|if enabled| gate2
  g19 --> authorOps
  projectOps --> authorOps
  authorOps -.->|if enabled| gate2

  gate2 --> scale
  proofExt --> scale
  gate2 --> migrations
  projectOps --> migrations
  authorOps --> migrations
  gate2 --> hosted
  gate2 --> evals
  gate2 --> design
  gate1 --> semantics
  semantics -.->|if activated| design
  authorOps --> design
  gate2 --> optional
```

The promptable-semantics discovery milestone may begin after Gate 1 because it
is read-only research over observed tasks. It cannot change stable schemas or
block Gate 2. Any resulting capability follows its own later-gate admission.

## Roadmap overview

| Gate | Outcome | Release boundary | Gate must not include |
| --- | --- | --- | --- |
| Gate 0 | One canonical artifact compiles and is retrieved locally through deterministic API, human, JSON, and dense CLI surfaces. | Internal foundation; no public product claim. | Broad catalog, public MCP, docs application, planner, project mutation, migration, semantic search. |
| Gate 1 | The fixed `0.1` matrix proves real web, React, and React Native components plus one bounded pattern against one release manifest. | `0.1` prerelease acceptance boundary. | Broad component families, public planner, public MCP, consumer mutation, design-tool round-trip, extra frameworks. |
| Gate 2 | Packages, local compatibility, consumer validation, docs/explorers/local MCP, and any enabled planning or safe-operation capabilities are productized. | Productization release candidate; stable only if stable-release evidence is complete. | Hosted write access, arbitrary agent patches, unproved extensions, speculative higher-order kinds. |
| Gate 3 | Operational scale and independently justified integrations are enabled without changing kernel authority. | Capability-specific releases. | Any capability lacking observed demand, owner, bounded protocol, proof, and lifecycle. |

## Gate 0 — schema and query kernel

### G0.0 Repository, ownership, and task graph

**Objective:** Establish the predictable repository topology and the smallest
root workflow before product sources multiply.

**Entry conditions**

- The architecture is accepted as the normative source.
- The package manager and supported runtime policy are recorded in one
  repository decision.
- No existing generated inventory is treated as canonical input.

**Primary ownership**

- Root workspace configuration
- Root `AGENTS.md` and local navigation files
- Declarative task graph and repository policy checks

**Deliverables**

- The architecture-defined `catalog/`, `packages/`, `apps/`, `tooling/`,
  `tests/`, and `decisions/` boundaries.
- pnpm workspaces with a dependency-aware task graph.
- The memorable root commands: `check`, `check:all`, `generate`,
  `generate:check`, `test:agent`, and `release:prepare`.
- Generated-file markers, canonical/projection path policy, slug convention,
  and alias audit.
- A short root `AGENTS.md` containing only the route map, discovery loop,
  source ownership, and verification entry points.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G0.0-01` | A clean checkout discovers every major owner from the root route map without a repository-wide component inventory. | Cold-navigation transcript and path audit. |
| `E-G0.0-02` | Root tasks invoke package-owned tasks in dependency order and affected mode does not skip a required dependent. | Synthetic dependency fixture and task-graph report. |
| `E-G0.0-03` | Canonical and generated paths are distinguishable; a projection edit is rejected with its source pointer. | Positive/negative repository-policy fixture. |
| `E-G0.0-04` | A clean second generation run leaves the worktree unchanged. | Generation identity digest and clean-worktree assertion. |

**Scope controls**

- Do not create a component registry, docs site, MCP server, semantic-search
  service, or release dashboard.
- Do not add package-specific scripts to the root when a filtered task can own
  them.
- Do not create extra foundation packages before real slices prove separate
  distribution value.

**Exit condition:** The repository has one predictable navigation path, one
task graph, enforced ownership boundaries, and reproducible no-op generation.

### G0.1 Schema, identity, and revision kernel

**Objective:** Define the minimum closed schemas and identity rules required to
compile one real component without pre-building the full ontology.

**Entry conditions**

- G0.0 is complete.
- The first proof artifact and initial platform identifiers are selected.
- Every proposed field has an authored, derived, or proved classification.

**Primary ownership**

- `@core-ui/schema`
- Canonical serialization and revision policy
- Minimal relation registry

**Deliverables**

- Immutable `ArtifactRef` syntax and uniqueness checks.
- Minimum schemas for a component concept, platform binding, example, guide,
  capability, token source, query envelope, and diagnostic.
- Closed-schema behavior, explicit `schemaVersion`, lifecycle and strategy
  enums, platform/runtime-profile IDs, and minimal typed relations.
- Authored/derived/proved field metadata and one-owner validation.
- Canonical serialization plus `contentRevision` and binding `specRevision`
  closure calculation.
- Guidance-impact classification and the rule that implementation-relevant
  examples are normative regardless of an authored editorial label.
- Response-envelope versioning and append-only error-code policy.
- Schema evolution rules for patch, minor, major, deprecation, and explicit
  source migration.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G0.1-01` | Valid minimal records compile; unknown fields, duplicate IDs, invalid relations, and unowned fields fail closed. | Positive and negative schema corpus. |
| `E-G0.1-02` | Whitespace/key-order changes preserve revisions while a meaningful authored change updates the correct revision. | Canonicalization fixture and digest comparison. |
| `E-G0.1-03` | Editorial-only input changes content identity but not renderer compatibility; normative binding input changes `specRevision`. | Revision-closure fixture. |
| `E-G0.1-04` | Renderer/package/source locations are derived and cannot be authored as duplicate inventory. | Field-ownership audit. |
| `E-G0.1-05` | Schema compatibility fixtures enforce the declared patch/minor/major rules. | Version-negotiation matrix. |

**Scope controls**

- Do not add generic page, journey, flow, free-standing rationale, or consumer
  overlay kinds.
- Do not encode the full TypeScript, JSX, DOM, or React Native host type system.
- Do not create a revision axis without a named compatibility decision that
  existing revisions cannot express.
- Experimental fields stay inert and cannot affect stable query behavior.

**Exit condition:** One minimal canonical record family has stable identity,
closed validation, explicit ownership, and deterministic content/spec revision
semantics.

### G0.2 Catalog compiler and pure query kernel

**Objective:** Compile canonical sources into one immutable local catalog and
query it through a side-effect-free API.

**Entry conditions**

- G0.1 is complete.
- One minimal canonical component and its relations validate.
- Canonical ordering and digest algorithms are fixed by tests.

**Primary ownership**

- `@core-ui/catalog`
- Catalog compiler and search-index builder

**Deliverables**

- Deterministic catalog compiler, relation graph, search index, catalog digest,
  and immutable bundle format.
- Pure `getManifest`, `listArtifacts`, `searchArtifacts`, and `getArtifact`
  operations.
- Deterministic lexical/metadata search with match reasons; no required hosted
  or semantic search.
- Platform, detail, section, example-purpose, limit, and cursor request
  semantics.
- Resolution/provenance metadata in every implementation-guidance response.
- Query response schemas and stable type discriminators.
- Explicit source pointers and bounded relation traversal.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G0.2-01` | Two clean builds from the same sources produce byte-identical catalogs, indices, ordering, and digests. | Dual-build digest report. |
| `E-G0.2-02` | Programmatic list/search/get requests are deterministic and include exact match reasons, provenance, authority, and compatibility context. | Golden API corpus. |
| `E-G0.2-03` | Pagination is stable under the same catalog digest and rejects an invalid or cross-digest cursor. | Cursor fixture. |
| `E-G0.2-04` | Search returns bounded summaries; retrieval returns selected complete records without copying the whole graph. | Response-size and relation-boundary test. |
| `E-G0.2-05` | Query operations perform no writes, network requests, code execution, or environment-dependent ranking. | Hermeticity and side-effect audit. |

**Scope controls**

- `planComposition` remains unavailable.
- No docs application, MCP transport, project analysis, mutation, or hosted
  fallback is implemented here.
- Query logic stays transport-independent; adapters cannot fork it later.

**Exit condition:** The minimal artifact graph compiles reproducibly and the
pure local API retrieves it deterministically with complete provenance.

### G0.3 CLI documentation baseline

**Objective:** Make the CLI the first human, agent, and software documentation
surface over the query kernel.

**Entry conditions**

- G0.2 is complete.
- Success and error envelope schemas are published by `@core-ui/schema`.
- A token budget exists for each baseline command and detail level.

**Primary ownership**

- `@core-ui/tooling`
- Declarative command registry and output renderers

**Deliverables**

- `core manifest`, `core list`, `core search`, and `core get`.
- One declarative command registry generating parser metadata, `--help`, shell
  completion, manifest, response types, and future MCP schemas.
- Human, JSON, and dense renderers over the same response object.
- Common platform/detail/section/purpose/pagination selectors.
- One JSON value on stdout; progress and diagnostics on stderr.
- Versioned query envelopes, append-only codes, meaningful exit statuses, and
  safe `nextCommand` objects with effect and confirmation metadata.
- `core manifest --json` as cold-start discovery; bare `core --json` recovery.
- Dense golden snapshots and per-command token budgets.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G0.3-01` | API and CLI JSON normalize to the same response for identical requests. | Surface-parity matrix. |
| `E-G0.3-02` | Human, dense, and JSON outputs contain the same IDs, applicability, defaults, omissions, revisions, and follow-up actions. | Cross-renderer golden corpus. |
| `E-G0.3-03` | Dense output is deterministic, round-trippable to the response object, and within budget. | Snapshot and token-count report. |
| `E-G0.3-04` | Manifest, parser, help, completion, and response types agree; an undeclared command or response fails CI. | Command-registry consistency test. |
| `E-G0.3-05` | Error consumers can branch on code and structured details without parsing prose; mutating suggestions require confirmation. | Error-schema and exit-status fixture. |
| `E-G0.3-06` | An unprimed agent discovers the manifest and retrieves the artifact without repository crawling. | Informational cold-start smoke transcript. |

**Scope controls**

- No public `validate`, `plan`, `doctor`, `init`, or `migrate` behavior.
- Dense is a renderer, not a second content source.
- Static agent files are not created as large catalog dumps.

**Exit condition:** The CLI is a self-describing, deterministic documentation
API with equivalent human, JSON, and dense views of the same local record.

### G0.4 Project-local catalog package and resolver

**Objective:** Ensure implementation guidance resolves to the exact local
project dependency graph and never silently to hosted or highest-compatible
data.

**Entry conditions**

- G0.2 defines the catalog bundle and digest.
- G0.3 defines compatibility-aware query envelopes and diagnostics.
- Synthetic renderer descriptors and package graphs exist for resolver proof.

**Primary ownership**

- `@core-ui/catalog` package format
- `@core-ui/tooling` local resolver

**Deliverables**

- Published-package layout tying package version to `catalogVersion`, digest,
  query API, schema range, and source revision.
- Deterministic workspace discovery through the active package manager.
- Direct project-local catalog resolution; no parent/sibling/highest-version
  scan.
- Manifest/lockfile/installed-graph drift and integrity checks.
- Compatibility matching across schema, tooling, binding revision, renderer
  package/export, token range, and release manifest.
- Explicit content-addressed cache selection only by version and digest.
- Resolver error precedence and all seven architecture-defined error codes.
- Relative-path diagnostics and privacy-safe exact next commands.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G0.4-01` | Hoisted, sibling, ancestor, and newer cached catalogs never replace the selected workspace’s direct declaration. | Multi-workspace resolver matrix. |
| `E-G0.4-02` | Every reachable resolver code, precedence path, secondary detail, and safe next command is exercised. | Resolver taxonomy fixture. |
| `E-G0.4-03` | Integrity, declaration drift, ambiguous resolution, and incompatible binding/token tuples fail without network fallback. | Negative package-graph corpus. |
| `E-G0.4-04` | Installed-local authority and exact package/catalog tuple appear in every applicable response. | Query metadata assertion. |
| `E-G0.4-05` | JSON exposes no absolute root, credentials, secret, access-bearing URL, or unrestricted storage locator. | Privacy scan. |

**Scope controls**

- Do not invent `core-ui.lock`; package manifests and the package-manager
  lockfile remain dependency authority.
- A global CLI is bootstrap convenience only.
- Hosted discovery remains unavailable and cannot repair a local resolution
  failure.

**Exit condition:** Local guidance is offline, deterministic, project-correct,
privacy-safe, and fails with typed cause-specific remediation.

### G0.5 Maintainer authoring baseline

**Objective:** Make the correct canonical edit path easier to discover than an
informal projection patch from the first artifact onward.

**Entry conditions**

- G0.1 owns minimal source schemas and revisions.
- G0.2 can compile and locate canonical sources.
- G0.0 enforces generated/canonical path boundaries.

**Primary ownership**

- `@core-ui/schema` authoring metadata
- `@core-ui/tooling` maintainer-only authoring helpers

**Deliverables**

- Schema-aware editor metadata and completion.
- Minimal canonical scaffold for the first artifact family.
- Source-linked diagnostics naming the earliest editable owner.
- Semantic diff distinguishing editorial, compatible, and incompatible change.
- Revision explainer listing normalized inputs for content/spec digests.
- Affected-closure view over sources, projections, and required checks.
- Preview-only, semantics-preserving autofixes with explicit changed paths.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G0.5-01` | A maintainer scaffolds, validates, compiles, retrieves, breaks, diagnoses, and repairs the minimal artifact without editing a projection. | Authoring round-trip transcript and fixture. |
| `E-G0.5-02` | The semantic diff and revision explainer identify the exact owning field and correct version/revision effect. | Golden change corpus. |
| `E-G0.5-03` | Autofix rejects any change to intent, lifecycle, accessibility, public API, token meaning, migration, rationale, or exception. | Negative autofix policy tests. |
| `E-G0.5-04` | A new stable schema field fails readiness until scaffold, diff, diagnostics, and affected-closure support understand it. | Schema-authoring coupling fixture. |

**Scope controls**

- No general code generator, consumer scaffold, model-authored product decision,
  or automatic mutation.
- The authoring helper cannot own a second registry.
- Full change-intent closure is completed in Gate 1 against real renderer
  changes.

**Exit condition:** The minimum canonical source has a complete, owner-linked,
non-mutating authoring and diagnosis path.

### Gate 0 integration exit

Gate 0 completes only when G0.0 through G0.5 are complete and one evidence
packet proves this uninterrupted path:

```text
scaffold canonical source
  -> validate ownership and relations
  -> compile deterministic catalog
  -> resolve project-local authority
  -> manifest/list/search/get through API and CLI
  -> render human/JSON/dense equivalently
  -> explain revisions and repair a deliberate source error
```

Gate 0 does not wait for renderer breadth, public MCP, a docs application,
planning, project mutation, migration, hosted services, or model-evaluation
stability.

## Gate 1 — representative vertical slices

Gate 1 proves the architecture through a fixed, difficult `0.1` acceptance
matrix. A later prototype cannot substitute for a missing cell, and an
`unsupported` disposition can satisfy only a cell that asks for an explicit
strategy rather than an implementation.

### Gate 1 target matrix

| Slice | `web.html` | `web.react` | iOS | Android | React Native Web |
| --- | --- | --- | --- | --- | --- |
| Button | Implemented `direct` | Implemented `direct` | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Explicit strategy; evidence if implemented |
| TextField | Implemented `direct` | Implemented `direct` | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Explicit strategy; evidence if implemented |
| Switch | Implemented `direct` | Implemented `direct` | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Explicit strategy; evidence if implemented |
| Dialog | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Proved `adapted` or `native-alternative` | Proved `adapted` or `native-alternative` | Explicit strategy; evidence if implemented |
| Select | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Proved `native-alternative` | Proved `native-alternative` | Explicit strategy; evidence if implemented |
| Form pattern | Applicable composition and example | Applicable composition and example | Applicable composition and example | Applicable composition and example | Explicit applicability/disposition |

Every implemented cell requires one canonical executable example, schema and
relation validity, spec-to-code/type/behavior/token conformance, an applicable
packed-consumer fixture, risk-proportionate accessibility proof, and API/CLI
retrieval parity at the same record revision.

### G1.0 Tokens, themes, and foundation boundaries

**Objective:** Establish only the cross-renderer semantics, token transforms,
and pure logic required by the fixed slices.

**Entry conditions**

- Gate 0 is complete.
- Button, TextField, Switch, Dialog, Select, and Form token/semantic needs have
  been inventoried without implementing a generic UI runtime.
- Web and native target transforms have concrete consumer fixtures.

**Primary ownership**

- `@core-ui/schema` for the closed platform-safety contract grammar
- Canonical binding specs for per-binding/runtime-profile safety declarations
- `@core-ui/tokens` for canonical token/theme data, transforms, and validated
  token-requirement-set compilation
- `@core-ui/catalog` for derived contract/query projection
- `@core-ui/foundation/semantic`
- `@core-ui/foundation/logic`
- Optional `@core-ui/foundation/interaction` only where proved portable

**Deliverables**

- Reference, semantic, and component token layers with typed IDs, units, and
  acyclic aliasing.
- First-party default theme and typed mode axes for color scheme, contrast,
  motion, density, and direction where applicable.
- Deterministic web CSS and native theme-object transforms from the same
  canonical token sources.
- Token override policy (`fixed`, `theme`, or `instance`) and consumer-theme
  validation.
- Binding-owned token recipes compiled to `TokenRequirementSet` records and
  digests.
- Explicit required/optional/deprecated requirements and typed fallback value
  or fallback token semantics.
- The architecture-defined, closed, versioned `PlatformSafetyContract` derived
  from `strategy/platform-safety-contract.json`. A binding without nested
  runtime profiles declares against its binding ID/profile identity; a binding
  with nested profiles declares only per concrete nested profile. All six IDs
  receive a `required` or reasoned `not-applicable` disposition; unsupported
  profiles declare the latter without a behavior or evidence claim.
- A separate `PlatformSafetyRequirementSet` projection for each binding/profile
  containing the registry version/digest, binding/profile identity,
  declaration revision, complete dispositions, and projection digest. Unknown,
  missing, duplicate, wrong-profile, consumer-weakened, or prematurely
  fulfilled declarations fail closed. Token sources and `TokenRequirementSet`
  continue to own only token facts; target renderers own realization and
  observable behavior.
- Enforced foundation import boundaries for `semantic`, `logic`, and optional
  `interaction`.
- Profile-scoped proof metadata for every portable interaction machine.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.0-01` | Alias cycles, reverse-layer references, incompatible types/units, and unauthorized overrides fail deterministically. | Token schema and graph corpus. |
| `E-G1.0-02` | Web and native transforms derive from canonical tokens; native never parses CSS and components never consume reference values. | Output provenance and dependency audit. |
| `E-G1.0-03` | A missing required token fails each profile unless that exact binding/profile declares and proves an allowed fallback; fallback use emits a diagnostic. | Token fallback denial fixture. |
| `E-G1.0-04` | Requirement-set digests change exactly when semantic dependencies change and match packed renderer descriptors. | Digest-closure fixture. |
| `E-G1.0-05` | Foundation dependency direction is enforced and a portable machine is available only on profiles with materially distinct retained proof. | Import-boundary and portability matrix. |
| `E-G1.0-06` | Static theme output works without runtime switching; any runtime switch is separately declared and proved. | Web/native theme smoke fixtures. |
| `E-G1.0-07` | Closed platform-safety declarations enter binding-spec revisions and compile into separate per-binding/profile `PlatformSafetyRequirementSet` digests plus query/package projections; unknown, missing, duplicate, wrong-profile, consumer-weakened, or prematurely fulfilled requirements fail deterministically. This assertion produces no CSS/native adaptation, support, accessibility, or availability result. | Safety-contract closure and negative corpus. |

**Scope controls**

- Do not create a fourth shared platform-token namespace.
- Do not put selectors, React hooks, browser globals, native views, or mandatory
  transitions in foundation.
- Do not add a component token unless a fixed slice needs a stable
  customization point.
- Additional themes and design-tool interchange remain Gate 3.

**Exit condition:** The fixed slices have the smallest sufficient semantic,
logic, token, and optional portable-interaction substrate with cross-target
provenance and fallback denial. The platform-safety requirement contract is
closed, digest-bound, and consumer-non-removable, while web and native behavior
remain explicitly unproved and unavailable until G1.1 and G1.2 supply their
binding-owned evidence.

### G1.1 Framework-free web and React substrate

**Objective:** Establish the two web bindings without making React the
canonical inventory or duplicating styles and runtime ownership.

**Entry conditions**

- Gate 0 is complete.
- G1.0 exposes the token/theme and foundation inputs needed by the first slice.
- The `web.html` and `web.react` binding schemas are stable for Gate 1.

**Primary ownership**

- `@core-ui/web`
- `@core-ui/react`

**Deliverables**

- Per-component framework-free CSS entry points, stable cascade layers,
  documented root classes, semantic slots, state attributes, and public custom
  properties.
- Semantic HTML with progressive enhancement and optional explicitly imported,
  idempotent, SSR-safe, destroyable vanilla controllers.
- React bindings consuming web styles while owning React composition, state,
  refs, portals, effects, hydration, and cleanup.
- One-owner runtime protocol for root lifecycle, document listeners, focus
  restoration, dismissal, portals, inert/background behavior, and scroll-lock
  leases.
- Public events and observable DOM hooks derived from binding specs.
- Host TypeScript refinements validated against generated Core-owned binding
  types without exporting an upstream primitive library as public API.
- `@core-ui/web`-owned forced-colors and system-high-contrast behavior that
  consumers cannot disable through theme or instance values. `web.html` proves
  the behavior directly; `web.react` proves it consumes the same web source and
  cannot bypass it with a copied React safety implementation.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.1-01` | Web examples retain usable base semantics without JavaScript where progressive enhancement is promised. | Browser fixture with controllers disabled. |
| `E-G1.1-02` | Public CSS/DOM hooks match the binding specs; internal topology is not advertised or consumed by canonical examples. | CSS/DOM conformance audit. |
| `E-G1.1-03` | React and vanilla never own the same root or duplicate global effects; mount/unmount and concurrent instances clean up completely. | Ownership, leak, and duplicate-listener tests. |
| `E-G1.1-04` | SSR and hydration do not access browser globals early, change public semantics, or produce ownership duplication. | SSR/hydration fixture. |
| `E-G1.1-05` | React preserves applicable web semantics and hooks while allowed React ergonomics remain binding-owned and typed. | Cross-binding conformance report. |
| `E-G1.1-06` | Test-only conformance fixtures `fixture:platform-safety-web#web.html` and `fixture:platform-safety-web#web.react` each bind their own `PlatformSafetyRequirementSet`. They prove the applicable `system.forced-colors`, `system.high-contrast`, and `layout.direction` substrate policy; React proves source/parity consumption without bypass. Results bind registry/set digests, environment, and evidence identity, make no component-support claim, and leave per-slice fulfillment to G1.3–G1.7. | Forced-colors/high-contrast substrate browser matrix. |

**Scope controls**

- React cannot become the source of component identity, lifecycle, web styles,
  native parity, or documentation.
- Exact nesting, utility classes, keyframes, and undocumented attributes remain
  internal.
- No document-wide controller scan or import-time global lifecycle.

**Exit condition:** Framework-free web and React have explicit, non-competing
runtime ownership, a machine-enumerated compatible public surface, and retained
shared-substrate proof of binding-owned forced-colors/high-contrast safety.
Component support remains unclaimed until the owning slice evidence passes.

### G1.2 React Native substrate and runtime profiles

**Objective:** Establish a genuinely native renderer that shares meaning and
tokens without importing web implementation accidents.

**Entry conditions**

- Gate 0 is complete.
- G1.0 produces native token outputs and only the required foundation inputs.
- iOS, Android, and React Native Web validation-profile shapes are defined.

**Primary ownership**

- `@core-ui/react-native`
- Native explorer host as test infrastructure, not package runtime

**Deliverables**

- Native primitive composition, roles, states, values, actions,
  announcements, focus, gestures, and responder behavior.
- Explicit iOS/Android files where behavior differs.
- React Native Web as a named runtime profile with explicit strategy,
  lifecycle when supported, validation profile, and evidence.
- Native deviations and `native-alternative` references in binding specs.
- Host applications for Expo/native exploration outside the runtime package.
- Binding-owned iOS and Android dynamic-color, font-metric, direction, and
  applicable accessibility mappings that consumer values cannot disable.
  The shared React Native Web substrate declares its own profile-specific
  disposition without inheriting web, iOS, or Android behavior; an unsupported
  disposition carries no behavior claim. Each component slice owns its later
  binding/profile declaration and fulfillment proof.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.2-01` | The runtime package has no dependency on web, React DOM, CSS parsing, browser globals, Expo, or Storybook hosts. | Package/dependency audit. |
| `E-G1.2-02` | iOS and Android behavior/accessibility are proved against explicit validation profiles rather than assumed from shared props. | Native profile smoke matrix. |
| `E-G1.2-03` | React Native Web is never treated as `web.react` parity; unsupported or adapted behavior is surfaced honestly. | Runtime-profile query and evidence fixture. |
| `E-G1.2-04` | Native token values trace to canonical recipes and target transforms without CSS-derived authority. | Token provenance report. |
| `E-G1.2-05` | Test-only component fixture `fixture:platform-safety-native` uses binding `native.react-native` and distinct tuples `(profile: ios, validationProfile: native.ios)`, `(profile: android, validationProfile: native.android)`, and `(profile: native.react-native-web, validationProfile: native.react-native-web)`, each with its own `PlatformSafetyRequirementSet`. iOS/Android prove applicable `native.dynamic-color`, `native.font-metrics`, `layout.direction`, and `platform.accessibility-mapping` substrate policy; React Native Web records an explicit substrate disposition. Results bind registry/set digests, environment, and evidence identity, make no component-support claim, and leave per-slice fulfillment to G1.3–G1.7. | Native platform-safety substrate matrix. |

**Scope controls**

- Native navigation, routing, and host-level overlay policy remain
  application-owned.
- Do not force identical web/native anatomy or props where platform convention
  conflicts.
- Do not split React Native Web into another binding without sustained API or
  ownership divergence and ontology admission.

**Exit condition:** React Native has independent shared-substrate
implementation and proof, explicit iOS/Android/React Native Web fixture
dispositions, no web runtime dependency, and retained substrate
platform-theme-safety proof. Component support remains unclaimed until the
owning slice evidence passes.

### Shared slice deliverable contract

Each G1.3–G1.7 component milestone must deliver:

- one concept record with intent, anatomy, states, accessibility obligations,
  lifecycle, risk class, alternatives, and decision context where useful;
- exact `web.html`, `web.react`, and `native.react-native` binding specs plus a
  React Native Web profile disposition;
- canonical token recipe and compiled requirement-set digest;
- one complete platform-safety declaration against the architecture-owned
  `PlatformSafetyContract` plus a derived `PlatformSafetyRequirementSet`
  digest for every implemented binding/profile;
- structured pitfall records for known misuse, typed repair guidance, and
  affected bindings;
- one normative executable example for every implemented target and an
  alternative example where `native-alternative` is required;
- framework-free web, React, and native implementation or an allowed explicit
  target disposition;
- package exports and generated packed compatibility descriptors;
- risk-proportionate behavior, accessibility, visual, and package evidence;
- per-binding/profile fulfillment of every applicable platform-safety
  declaration through the slice's named behavior/accessibility evidence, bound
  to its exact safety-requirement-set digest; unsupported and reasoned
  `not-applicable` dispositions remain behavior-evidence-free;
- API/CLI human/JSON/dense retrieval parity; and
- a semantic diff and change-intent preview for one representative public
  change to the slice.

No slice may author a prop table, story, docs page, golden implementation, or
package index independently of these owners.

### G1.3 Button vertical slice

**Objective:** Prove the direct action-component path and the end-to-end
component addition workflow.

**Entry conditions**

- G1.0, G1.1, and G1.2 are ready with only Button-required capabilities.
- Button intent distinguishes immediate action from navigation.
- Pending, disabled, and accessible-name semantics are decided canonically.

**Deliverables**

- All shared slice deliverables for Button.
- Direct web and React bindings.
- Direct or adapted native bindings for iOS and Android.
- Explicit React Native Web strategy.
- Canonical minimal generation examples plus pending/disabled coverage.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.3-01` | Activation, disabled, pending, focus-visible, and busy semantics match each binding spec. | Browser/native behavior matrix. |
| `E-G1.3-02` | Required accessible naming and disabled/busy exposure pass on each implemented profile. | Automated and applicable manual accessibility evidence. |
| `E-G1.3-03` | Web and React expose the same documented CSS/DOM hooks without duplicate runtime ownership. | DOM/CSS/runtime parity fixture. |
| `E-G1.3-04` | Packed exports, types, styles, examples, descriptor revisions, and token digest resolve in clean consumers. | Packed consumer matrix. |
| `E-G1.3-05` | An agent discovers and generates the canonical Button without inventing navigation semantics, props, or imports. | Informational cold-start/generation result. |

**Scope controls**

- No polymorphic “button or link” ambiguity in the canonical default.
- Do not generalize a command/action abstraction beyond evidence from later
  components.
- Button cannot pull a broad icon, routing, or async workflow system into Gate
  1.

**Exit condition:** Button proves the complete direct component path on all
required targets and the packed/query surfaces agree with its implementation.

### G1.4 TextField vertical slice

**Objective:** Prove naming, value ownership, validation, form relations, and
controlled/uncontrolled ergonomics.

**Entry conditions**

- G1.3 is complete or its shared infrastructure is stable and independently
  evidenced.
- Label, description, error-message, value, and validation ownership are
  canonical decisions.

**Deliverables**

- All shared slice deliverables for TextField.
- Direct web/React and direct or adapted native implementations.
- Explicit controlled/uncontrolled React semantics without duplicate defaults.
- Label, description, error, required, disabled, and validation relations.
- Canonical examples for minimal, validation, and form use.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.4-01` | Value/default ownership and change events are deterministic across controlled and uncontrolled paths. | State and type matrix. |
| `E-G1.4-02` | Label, description, error, required, disabled, and invalid semantics are exposed correctly on each profile. | Accessibility relation matrix. |
| `E-G1.4-03` | Form submission/reset and native text-input adaptation match declared binding behavior. | Browser/native integration fixture. |
| `E-G1.4-04` | Example-purpose selection chooses the minimal generation example and the validation example only when prerequisites apply. | Curriculum selection fixture. |

**Scope controls**

- No general form engine, schema validator, masking framework, or rich-text
  editor.
- Host input props remain renderer-owned refinements and cannot introduce
  undocumented Core UI semantics.

**Exit condition:** TextField proves value, validation, accessible relation,
and form integration semantics across direct and adapted renderers.

### G1.5 Switch vertical slice

**Objective:** Prove boolean state, group relations, and native-control
semantics without assuming structural equivalence.

**Entry conditions**

- G1.0–G1.2 are complete for the required Switch capabilities.
- Switch intent is distinct from Checkbox and immediate-action controls.

**Deliverables**

- All shared slice deliverables for Switch.
- Direct web/React and direct or adapted native implementations.
- Controlled/uncontrolled checked state and group/label relations.
- Explicit React Native Web disposition.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.5-01` | Keyboard, pointer/touch, checked, disabled, focus, and event semantics match each binding. | Cross-input behavior matrix. |
| `E-G1.5-02` | Role, name, state, and group relationships pass on supported profiles. | Accessibility evidence. |
| `E-G1.5-03` | Native adaptation preserves intent without copying DOM anatomy or CSS semantics. | Binding-conformance review. |
| `E-G1.5-04` | A generated example does not substitute Checkbox or Button for Switch. | Agent generation smoke result. |

**Scope controls**

- Do not introduce a universal toggle abstraction or infer that Checkbox and
  Switch share identical behavior.
- Group behavior is included only to the extent required by the canonical
  relations and examples.

**Exit condition:** Switch proves semantic parity with platform-appropriate
binding conformance and honest native adaptation.

### G1.6 Dialog vertical slice

**Objective:** Prove composite overlay ownership, focus/dismissal behavior, and
native adaptation under the highest Gate 1 interaction risk.

**Entry conditions**

- G1.1 runtime ownership and G1.2 native profile policies are complete.
- Overlay, focus restoration, dismissal, background/inert, portal, and host
  responsibilities are explicitly allocated.
- Required manual accessibility environments are available.

**Deliverables**

- All shared slice deliverables for Dialog.
- Direct or adapted web/React implementations with one global-effect owner.
- Proved adapted or native-alternative iOS and Android strategy.
- Explicit React Native Web strategy.
- Canonical examples for modal use, dismissal constraints, and native
  alternative where applicable.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.6-01` | Focus entry, containment where promised, restoration, Escape/back dismissal, outside interaction, and cleanup match the binding. | Browser/native overlay matrix. |
| `E-G1.6-02` | Multiple instances do not duplicate document listeners, inert/background state, portal lifecycle, or scroll-lock ownership. | Concurrency and teardown fixture. |
| `E-G1.6-03` | Screen-reader/manual review passes on every supported binding/profile; missing mandatory evidence cannot be excepted into stable support. | Retained manual accessibility evidence. |
| `E-G1.6-04` | Native-alternative guidance resolves to a compatible example and never claims web feature equivalence. | Query and curriculum fixture. |
| `E-G1.6-05` | SSR/hydration and interrupted mount/unmount leave no leaked global effects. | Lifecycle recovery fixture. |

**Scope controls**

- Native navigation and application-level overlay stacks remain host-owned.
- Do not create a universal cross-platform portal/focus implementation.
- Dialog cannot be marked stable on a profile lacking mandatory manual proof.

**Exit condition:** Dialog proves composite-risk behavior, one-owner runtime
effects, native alternatives, and retained accessibility evidence.

### G1.7 Select vertical slice

**Objective:** Prove complex popup/listbox behavior on web and deliberately
native-alternative selection on mobile.

**Entry conditions**

- G1.1, G1.2, and relevant Dialog/overlay ownership primitives are proved.
- Selection/value normalization and native-alternative boundaries are decided.

**Deliverables**

- All shared slice deliverables for Select.
- Direct or adapted web/React listbox/popup implementation.
- Proved native-alternative picker strategy for iOS and Android.
- Explicit React Native Web disposition.
- Canonical examples for basic selection, disabled options, validation, and
  native alternatives where applicable.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.7-01` | Web keyboard navigation, active option, selection, dismissal, focus return, disabled items, and form value match the binding. | Browser interaction matrix. |
| `E-G1.7-02` | Native queries and docs return the declared picker alternative, its limits, and compatible example rather than a fictional listbox clone. | Native alternative retrieval fixture. |
| `E-G1.7-03` | Accessible naming, role/state/value, announcements, and validation relations pass on supported profiles. | Automated/manual accessibility evidence. |
| `E-G1.7-04` | Example selection is deterministic by purpose/profile and fails on contradictory preference or unmet prerequisite. | Curriculum positive/negative fixture. |

**Scope controls**

- No generalized combobox, autocomplete, virtualized data source, or remote
  query framework unless separately admitted.
- Native-alternative conformance does not imply API or feature equivalence.

**Exit condition:** Select proves honest divergence between complex web
interaction and native-alternative behavior with deterministic guidance.

### G1.8 Form pattern and deterministic example curriculum

**Objective:** Prove bounded multi-component composition and grounded planning
inputs without enabling the public planner.

**Entry conditions**

- Button and TextField are complete; Switch is available where the pattern uses
  it.
- Pattern roles, parameters, invariants, and unsupported cases can be expressed
  without a general UI tree language.
- Example metadata and binding-owned preference schemas are stable.

**Primary ownership**

- `PatternRecord` and its canonical examples
- Example records/source files and binding-to-example relations

**Deliverables**

- Form intent, use/avoid guidance, platform applicability, participant roles,
  relations, closed parameters, preconditions, alternatives, pitfalls, and
  accessibility obligations.
- Optional bounded decision context attached to the pattern owner.
- Applicable web, React, iOS, Android, and React Native Web examples or honest
  dispositions.
- Example purpose, complexity, prerequisites, profile applicability, risk/rule
  coverage, and binding-owned preference.
- Internal deterministic planning fixture that selects the pattern and binds
  only declared parameters; no public `core plan` yet.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.8-01` | Pattern references, roles, invariants, parameters, examples, and applicable binding revisions compile as one closed graph. | Pattern relation fixture. |
| `E-G1.8-02` | Normative example edits change the pattern/binding closure; editorial-only teaching order does not change renderer compatibility. | Normative example closure fixture. |
| `E-G1.8-03` | Exact profile/purpose filtering chooses one example deterministically; ambiguity, bad preference, missing prerequisite, and model/search override fail. | Curriculum selection matrix. |
| `E-G1.8-04` | The internal planner returns a known pattern, constraints, alternatives, and missing requirements; it never invents a component or step. | Grounded-plan golden corpus. |
| `E-G1.8-05` | Structural validation is confined to Core UI-owned examples and does not claim arbitrary consumer-tree correctness. | Enforcement-boundary test. |

**Scope controls**

- No generic page, flow, journey, template language, runtime abstraction, or
  consumer-code linter.
- Decision context is editorial unless its operative fact is also represented
  in a normative owning field.
- Public `plan`, consumer scaffolds, and project validation remain Gate 2.

**Exit condition:** The Form pattern and example curriculum provide complete,
deterministic composition inputs without creating an open-ended generator.

### G1.9 Cross-slice proof, authoring impact, and `0.1`

**Objective:** Prove the fixed matrix as one compatible release view and close
the Gate 1 cross-cutting architecture fixtures.

**Entry conditions**

- G1.0–G1.8 are complete for every required target cell.
- Package packing can derive descriptors from actual tarballs.
- Evidence policy, disclosure classes, and risk-class requirements are
  versioned.

**Primary ownership**

- Proof graph and release-manifest compiler
- Maintainer semantic diff and change-intent preview
- Internal local MCP parity probe

**Deliverables**

- Packed compatibility descriptors derived from tarball exports, binding specs,
  and token-requirement digests.
- One `0.1` release manifest correlating catalog, schema, token contract,
  binding-spec revisions, renderer packages, evidence digests, platform matrix,
  provenance, and active allowed exceptions.
- Complete PR/gate evidence for schema, spec, unit/state, browser, native,
  accessibility, visual, package, surface parity, and generation identity.
- Read-only change-intent envelopes for representative concept, binding,
  example, token, and renderer changes.
- Structured `EvidenceAdvisory` withdrawal/supersession and
  `OperationalExceptionRecord` enforcement, including disclosure-safe query
  status and release-manifest projection.
- `core validate` for Core UI-owned catalog and canonical example sources, with
  stable diagnostics and no consumer-project claim.
- Minimal local MCP adapter used only to compare query parity.
- Informational cold-start and generation evaluations over canonical example
  IDs.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G1.9-01` | Every required Gate 1 matrix cell is implemented/proved or has only the explicitly permitted disposition. The same release manifest correlates the architecture registry digest, current G1.1/G1.2 substrate evidence, each slice's exact `PlatformSafetyRequirementSet`, and its named behavior/accessibility evidence for every applicable binding/profile, including explicit unsupported/not-applicable dispositions. | Signed target-matrix and platform-safety correlation report. |
| `E-G1.9-02` | Packed descriptor derivation rejects a source-only, missing, mismatched, or unexported binding. | Packed descriptor fixture. |
| `E-G1.9-03` | Change-intent closure reports authoritative writes, affected projections, stale proof, version effects, checks, confirmation, and base-drift rejection for every representative source class. | Change-intent golden corpus. |
| `E-G1.9-04` | Evidence withdrawal marks every affected support/query/release view unproved without exposing restricted payloads. | Advisory propagation fixture. |
| `E-G1.9-05` | Expired, support-broadening, proof-manufacturing, integrity-bypassing, or projection-patching exceptions fail; allowed restrictions remain visible. | Exception enforcement fixture. |
| `E-G1.9-06` | API, CLI JSON, human, dense, and internal MCP return the same normalized record revisions and applicability. | Surface parity report. |
| `E-G1.9-07` | A clean rebuild reproduces catalog and release digests; model evaluation cannot waive deterministic failure. | Dual-build report and gate-policy test. |
| `E-G1.9-08` | Cold-start/generation metrics are captured with prompt/model/run metadata but remain informational until stable baselines exist. | Agent evaluation baseline report. |
| `E-G1.9-09` | Catalog/example validation emits source-linked stable rule IDs and declines unsupported consumer-project analysis. | Validator scope and diagnostic corpus. |

**Scope controls**

- The docs site is not a Gate 1 acceptance dependency.
- Internal MCP is not advertised as a mature product.
- Gate 1 validation is confined to Core UI-owned catalog/example sources.
- Agent evaluation misses inform diagnosis but do not override deterministic
  results or block `0.1` absent a separately stable threshold.
- Tabs, Toast, component breadth, hosted services, and public mutation cannot
  substitute for a missing required slice.

**Exit condition:** One reproducible `0.1` release manifest proves every fixed
slice and cross-cutting fixture against the same catalog/package/evidence view.

### Gate 1 integration exit

Gate 1 completes when G1.0 through G1.9 pass and:

- all required target cells are honest and evidenced;
- every canonical example has deterministic purpose/profile selection;
- web, React, and native packages consume shared meaning without sharing
  platform accidents;
- packed consumers prove published shape rather than source-tree assumptions;
- mandatory accessibility evidence exists for each risk/profile claim;
- web and native platform-theme safety has binding-owned retained evidence for
  every supported Gate 1 profile;
- change impact is explainable before any write capability exists; and
- later productization or integration work remains unnecessary for renderer
  correctness.

## Gate 2 — productization

Gate 2 turns the proved renderer/catalog system into installable, locally
authoritative products. Its workstreams may run in parallel after Gate 1, but
each capability remains unavailable until its own entry and evidence are
complete.

### G2.0 Post-`0.1` renderer proof extension: Tabs and Toast

**Objective:** Extend renderer proof into keyboard/layout state and
systemic/temporal host behavior before broad component expansion.

This milestone is required before broad component breadth, but it does not
block unrelated Gate 2 packaging, docs, or resolver productization.

**Entry conditions**

- Gate 1 is complete without counting Tabs or Toast as substitute slices.
- Tabs and Toast each have a bounded concept/binding proposal under existing
  schemas.
- The existing foundation and runtime ownership rules are evaluated before new
  abstractions are admitted.

**Deliverables**

- Tabs across applicable web, React, native, and React Native Web profiles,
  including keyboard/focus/layout state.
- Toast across applicable profiles, including provider/host ownership, queue
  transactions, timers, interruption, announcements, and cleanup.
- Canonical examples, descriptors, packed fixtures, query projections, and
  risk-proportionate evidence for both.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.0-01` | Tabs proves orientation, keyboard navigation, selection/focus ownership, panels, direction, disabled state, and native disposition. | Cross-profile interaction matrix. |
| `E-G2.0-02` | Toast proves host/provider ownership, ordering, timers, pause/resume, interruption, announcements, teardown, and concurrent producers. | Systemic/temporal evidence. |
| `E-G2.0-03` | Any new shared foundation logic is justified by repeated renderer evidence rather than abstraction preference. | Foundation-admission review. |

**Scope controls**

- No broad navigation framework, notification service, persistence layer, or
  application-level state manager.
- Failure cannot reopen or weaken the completed Gate 1 target matrix.

**Exit condition:** Tabs and Toast extend proof into their unique risk classes
without expanding foundation or host ownership beyond demonstrated need.

### G2.1 Publishable packages, compatibility, and release manifests

**Objective:** Package the proved system so consumers can verify the exact
catalog, renderer, schema, token, export, and evidence tuple they install.

**Entry conditions**

- Gate 1 is complete.
- Package boundaries match the architecture graph.
- Version-effect classification is available from semantic diff/change intent.

**Primary ownership**

- All public packages
- Release-manifest and descriptor compilers

**Deliverables**

- Publishable `@core-ui/schema`, `tokens`, `foundation`, `web`, `react`,
  `react-native`, `catalog`, and `tooling` packages as applicable.
- Compact renderer descriptors generated after packing from actual exports,
  binding-spec revisions, lifecycle/strategy, schema/token ranges, token
  requirement digests, and provenance.
- Immutable release manifest aggregating package descriptors, catalog/schema/
  token/query versions, evidence digests, supported profiles, provenance, and
  active exception digests/restrictions/expiries.
- SemVer classification for shared intent, binding API, runtime profile, token,
  implementation-only, and editorial changes.
- Historical catalog retrieval and compatibility negotiation.
- Release preparation that rejects inconsistent binding ranges, missing
  exports, digest drift, or version effects.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.1-01` | Every package installs from its packed artifact and exposes only declared exports, types, styles, assets, and supported engines. | Packed consumer matrix. |
| `E-G2.1-02` | Descriptor bindings match actual tarball exports and exact binding/token revisions; source-tree-only success fails. | Pack-time descriptor audit. |
| `E-G2.1-03` | The release manifest verifies every package/catalog/evidence/exception digest and rejects repacked bytes under the same version. | Manifest integrity fixture. |
| `E-G2.1-04` | Representative compatible, incompatible, editorial, implementation-only, token, and schema changes produce the required version effects. | SemVer classification corpus. |
| `E-G2.1-05` | Historical compatible catalogs answer for installed tuples while hosted/latest data remains advisory. | Multi-version query matrix. |

**Scope controls**

- Renderer packages do not carry or depend on the catalog at runtime.
- Descriptors are generated indices, never an authored component registry.
- Do not publish a package whose supported profile lacks current required
  evidence.
- No per-component independent SemVer release train.

**Exit condition:** Packed packages and one verifiable release manifest describe
the same implemented binding, token, evidence, and compatibility reality.

### G2.2 Consumer validation and production local resolution

**Objective:** Prove that a clean consumer resolves exact offline guidance and
validates only what the installed renderer graph can implement.

**Entry conditions**

- G2.1 package artifacts and descriptors are available.
- G0.4 resolver fixtures pass against synthetic graphs.
- Supported package managers and workspace shapes are declared in the mutable
  compatibility/evidence profile.

**Primary ownership**

- `@core-ui/tooling` local resolver and validator
- `tests/consumers`

**Deliverables**

- Official installation profiles including renderer packages plus project-local
  tooling and catalog dependencies.
- Production resolver over real packed descriptors and package-manager graphs.
- `core validate` for canonical catalog/examples first, then bounded
  consumer-project analysis with declared language/framework/version support.
- Project/root detection, installed tuple reporting, drift/integrity diagnosis,
  and safe inspection/install next commands.
- Consumer fixtures for HTML/CSS/JS, React, React Native iOS/Android, and
  supported React Native Web dispositions.
- False-positive policy, escape-hatch policy, and path confinement for any
  consumer analysis.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.2-01` | A clean consumer installs the declared profile and resolves exact local human/JSON/dense guidance with networking disabled. | Offline install/query fixture. |
| `E-G2.2-02` | Project-wide discovery filters bindings absent from the installed renderer graph instead of advertising catalog-only availability. | Mixed-version consumer fixture. |
| `E-G2.2-03` | Every resolver error and precedence rule passes against real packed packages and supported workspace layouts. | Production resolver matrix. |
| `E-G2.2-04` | Validation emits stable rule IDs, source locations, artifact/platform context, and exact repair commands without parsing prose. | Diagnostic golden corpus. |
| `E-G2.2-05` | Consumer analysis stays within declared project roots/languages/versions and meets its false-positive budget. | Confinement and supported-syntax corpus. |

**Scope controls**

- No arbitrary consumer AST claim beyond maintained parser/version support.
- No network fallback, ancestor scan, or hosted mutation.
- Consumer pattern-tree validation remains unavailable until separately proved
  by G2.4 or later capability admission.

**Exit condition:** Supported consumers install, resolve, and validate against
their exact local package graph with bounded diagnostics and no hosted truth
leakage.

### G2.3 Documentation, explorers, bootstrap, and public local MCP

**Objective:** Productize visual, narrative, static-agent, and installed local
MCP surfaces as clients of the same catalog/query/example sources.

**Entry conditions**

- G2.1 provides versioned catalog/package artifacts.
- Gate 1 query parity and canonical examples are complete.
- No docs-only content owner or manually maintained component inventory exists.

**Primary ownership**

- `apps/docs`
- `apps/explorer-web`
- `apps/explorer-native`
- Generated agent-bootstrap pipeline
- Installed local MCP adapter

**Deliverables**

- Documentation site rendering catalog responses and canonical guide sources.
- Web/React and native explorers generated from canonical examples.
- Version/authority/compatibility context visible on implementation guidance.
- Small generated `AGENTS.md`/editor/`llms.txt` bootstrap variants teaching the
  discovery loop and installed version.
- Optional versioned `llms-full.txt` offline export for tool-less environments.
- Site/explorer route generation, source pointers, and no-copy audits.
- Public installed local MCP with `search` and `get`; `plan`, `validate`, and
  read-only `doctor` appear only when their owning capabilities are complete
  and declared available.
- Per-adapter capability policy generated from the command/query registry.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.3-01` | Site loaders, local MCP, and API/CLI JSON return the same normalized record revisions, examples, lifecycle, and applicability. | Surface-parity matrix. |
| `E-G2.3-02` | Explorer source and rendered fixtures resolve canonical example IDs; no copied example body exists. | Example provenance audit. |
| `E-G2.3-03` | Changing canonical guidance/example data updates all enabled surfaces through generation without manual page edits. | Change-propagation fixture. |
| `E-G2.3-04` | Bootstrap files remain within size/token budgets and contain routing guidance rather than the component catalog. | Static-context budget report. |
| `E-G2.3-05` | Hosted or version-mismatched pages are labelled advisory and do not claim installed-project applicability. | Authority-label fixture. |

**Scope controls**

- The website is a client, not the documentation source.
- Explorer hosts are not runtime package dependencies.
- Offline full exports never become the default agent path or an authoring
  source.
- Local MCP exposes no init, migration, proposal apply, dependency install, or
  other mutation.

**Exit condition:** Site, explorers, bootstrap files, and enabled local MCP
tools reproduce canonical catalog/query truth without creating another
documentation or operation system.

### G2.4 Grounded composition planning

**Objective:** Enable `core plan` only when the pattern catalog can return
deterministic, non-invented composition plans.

**Entry conditions**

- G1.8 is complete.
- More than one observed composition request is covered by bounded patterns and
  canonical examples.
- Unsupported requests and missing requirements have typed response schemas.

**Primary ownership**

- `@core-ui/catalog` pure `planComposition`
- `@core-ui/tooling` CLI adapter

**Deliverables**

- Public `core plan` over known `PatternRecord` data.
- Parameter binding limited to the pattern’s closed schema.
- Returned components, examples, constraints, alternatives, preconditions,
  unsupported cases, and match reasons.
- Deterministic pattern and example selection under the installed-local tuple.
- Manifest/API/CLI and applicable MCP schema support.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.4-01` | Supported requests select a known compatible pattern and only declared parameters, components, examples, and steps. | Plan golden corpus. |
| `E-G2.4-02` | Unsupported, ambiguous, incompatible, or under-specified requests return typed missing requirements rather than plausible prose. | Negative plan corpus. |
| `E-G2.4-03` | API, CLI JSON/human/dense, site, and enabled MCP normalize to the same plan response. | Plan surface-parity matrix. |
| `E-G2.4-04` | Planner output changes only when normative pattern/example inputs or compatibility context changes. | Revision sensitivity fixture. |

**Scope controls**

- `core plan` is read-only and is not a change-intent or repository-mutation
  command.
- It cannot invent product architecture, business flows, components, props, or
  unrecorded implementation steps.
- Consumer templates/scaffolds and general tree validation require separate
  capability proof.

**Exit condition:** Composition planning is deterministic, installed-context
correct, bounded by canonical patterns, and honest about unsupported requests.

### G2.5 Project health and initialization

**Objective:** Introduce safe consumer-project writes only after project
detection, preview, confinement, atomicity, and recovery are proved.

**Entry conditions**

- G2.2 project detection and diagnostics are complete.
- Change-intent envelopes and semantic diffs are stable for consumer-project
  effects.
- A journal/recovery format and confirmation policy are versioned.

**Primary ownership**

- `@core-ui/tooling` local project operations

**Deliverables**

- Read-only `core doctor` before any mutating command.
- `core init` only after doctor’s project model, dry-run, merge, and recovery
  paths pass.
- Exact `ChangeIntentEnvelope` with project/lockfile/worktree preconditions,
  proposed writes, effects, affected closure, checks, and confirmation.
- Project-root confinement, explicit approval, atomic writes where possible,
  operation journal, idempotency, interruption recovery, and response-loss
  recovery.
- Typed outcomes for applied, no-op, stale preview, conflict, interrupted,
  rolled back, and recoverable operations.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.5-01` | Doctor detects supported projects, reports installed authority/drift, and performs no writes. | Project-detection matrix and write audit. |
| `E-G2.5-02` | Init dry-run and apply have the same bounded write set; confirmation is required for project/dependency effects. | Preview/apply equivalence fixture. |
| `E-G2.5-03` | Base drift, path escape, unexpected symlink, concurrent modification, and undeclared file fail before mutation. | Adversarial confinement corpus. |
| `E-G2.5-04` | Interruption at every journalled stage recovers, rolls back, or reports one exact recovery command without corrupting the project. | Fault-injection matrix. |
| `E-G2.5-05` | Repeating a completed operation is a deterministic no-op and lost response recovery does not duplicate changes. | Idempotency/replay fixture. |

**Scope controls**

- Hosted MCP never exposes init or any mutation.
- Init cannot become a general project generator or rewrite unrelated files.
- No action follows a `nextCommand` merely because tooling suggested it;
  confirmation policy remains authoritative.

**Exit condition:** Enabled project setup operations are previewed, confined,
confirmed, journalled, idempotent, and recoverable.

### G2.6 Allowlisted agent-safe canonical proposals

**Objective:** Support a small set of useful maintainer proposals without
creating an arbitrary model-driven patch path.

**Entry conditions**

- Gate 1 change-intent closure passes for concepts, bindings, examples, tokens,
  and renderers.
- G2.1 version effects and G2.5 journal/confirmation primitives are available.
- Each proposed operation has one owner, closed input schema, deterministic
  preview, proof policy, and rejection boundary.

**Primary ownership**

- Maintainer-only `@core-ui/tooling` proposal engine
- Existing canonical owners; the proposal engine owns no product decisions

**Initial allowlist**

| Operation | Authoritative owner | Minimum required review packet |
| --- | --- | --- |
| `example.create` | Example record plus one executable source file and binding relation | Purpose/profile/prerequisites, normative impact, selected owner paths, compile/behavior/selection proof. |
| `binding.variant.add` | Binding spec | Intent and allowed values/defaults, renderer/example/token changes, compatibility/version effect, affected profiles and proof. |
| `binding.prop.deprecate` | Binding lifecycle/migration data | Replacement or no-replacement reason, notice window, version effect, examples, diagnostics, migration artifact. |
| `token.alias.propose` | Canonical token source | Alias direction/type/meaning, cycle check, deprecation purpose, affected requirement sets/themes/renderers, migration effect. |

**Deliverables**

- Closed request and response schemas for each allowlisted operation.
- Deterministic, read-only proposal generation before approval.
- Review packet containing objective, base revisions, exact owning writes,
  semantic diff, affected/stale closure, version/migration effect, required
  evidence, risks, and rollback/recovery policy.
- Explicit user approval bound to the proposal digest.
- Apply path that rechecks preconditions and rejects any expanded write set.
- Typed unsupported result for requests outside the allowlist or requiring an
  unresolved product decision.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.6-01` | Each allowlisted operation produces the complete expected packet and only owner-approved canonical paths. | Per-operation golden corpus. |
| `E-G2.6-02` | Base drift, ambiguous intent, missing owner, incompatible version effect, unproved fallback, or write-set expansion rejects before apply. | Negative proposal corpus. |
| `E-G2.6-03` | Applying an approved proposal regenerates projections from source and never edits generated output directly. | End-to-end proposal fixture. |
| `E-G2.6-04` | Approval for one digest cannot authorize a changed proposal, additional path, dependency install, or different effect class. | Approval-binding security test. |
| `E-G2.6-05` | Free-form “patch this” and unsupported operation requests return a typed boundary response rather than an inferred diff. | Allowlist-boundary fixture. |

**Scope controls**

- No arbitrary repository patch, open-ended refactor, model-authored product
  decision, automatic stable promotion, or automatic exception creation.
- Renderer implementation changes may be listed as required work, but the
  canonical proposal engine cannot claim their behavior proved before their
  separate evidence passes.
- New operation kinds require observed repeated demand and full scope admission.

**Exit condition:** Four bounded proposal types produce reviewable, digest-bound
changes and deterministically reject all unowned or open-ended mutations.

### G2.7 Productization release and Gate 2 exit

**Objective:** Assemble enabled Gate 2 capabilities into one consumer-verifiable
release without making unavailable capabilities appear complete.

**Entry conditions**

- G2.1, G2.2, and G2.3 are complete.
- Each of G2.4–G2.6 is either complete and enabled or explicitly unavailable in
  the manifest; unavailable work cannot be implied by docs or commands.
- Stable claims have their complete risk/profile evidence.

**Deliverables**

- Versioned productization release manifest and compatibility profile.
- Capability manifest showing exact API/CLI/MCP/site availability and policy.
- Release evidence index with retention/disclosure policy and advisory status.
- Operational-exception diagnostics and release projection.
- Consumer install, offline guidance, packed renderer, site/explorer, and every
  enabled operation’s safety evidence.
- Release/rollback procedure and historical catalog availability.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G2.7-01` | A clean supported consumer installs the release and retrieves exact local guidance offline for its package tuple. | Release-candidate consumer matrix. |
| `E-G2.7-02` | Docs/explorers and every enabled adapter reproduce catalog results; disabled capabilities are absent or explicitly unavailable. | Capability/surface parity report. |
| `E-G2.7-03` | Every enabled validation, plan, doctor, init, or canonical proposal operation passes its manifest and safety gate. | Operation readiness index. |
| `E-G2.7-04` | Stable support has current required manual/automated evidence, digest parity, compatibility review, and no expired exception. | Stable-release evidence report. |
| `E-G2.7-05` | Rollback restores the prior verifiable package/catalog/manifest tuple without rewriting historical evidence. | Release rollback exercise. |

**Scope controls**

- Gate 2 completion does not require hosted MCP, migrations, additional themes,
  design-tool interchange, stable model-eval thresholds, extensions, extra
  frameworks, higher-order kinds, or an agent-to-UI renderer.
- An incomplete optional G2.4–G2.6 capability remains disabled; it does not
  lower the package/resolver/docs release standard.

**Exit condition:** Consumers can install, verify, query, and use every enabled
capability under exact local authority, while disabled capabilities remain
honestly unavailable.

## Gate 3 — operational scale, breadth, and integrations

Gate 3 is a portfolio of independently admitted capabilities, not one global
phase. Completing one Gate 3 milestone does not authorize another. Each remains
absent from manifests and product claims until its own exit evidence passes.

### G3.1 Deliberate component and pattern breadth

**Objective:** Expand the catalog only after the fixed slices and Tabs/Toast
have proved the reusable authoring, renderer, and evidence paths.

**Entry conditions**

- Gate 2 is complete for package/catalog/consumer authority.
- G2.0 is complete before adding broad component families with comparable
  keyboard, overlay, or temporal risks.
- Each candidate has observed demand, platform disposition, owner, risk class,
  and a named pattern or consumer need.

**Deliverables**

- A prioritized component/pattern queue grouped by user intent and missing
  capability rather than arbitrary inventory count.
- End-to-end additions using canonical scaffolds, examples, renderers,
  descriptors, docs projections, and evidence.
- Lifecycle criteria for experimental-to-stable promotion and explicit
  unsupported/native-alternative records where implementation is irresponsible.
- Coverage reports based on supported workflows and risk classes, not raw
  component totals.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.1-01` | Every added component follows the one-owner addition workflow and passes its risk/profile evidence without manual projection edits. | Per-component release packet. |
| `E-G3.1-02` | New shared foundation/runtime abstractions cite at least two materially distinct real consumers and preserve dependency boundaries. | Abstraction-admission report. |
| `E-G3.1-03` | Breadth changes do not regress discovery precision, dense budgets, package size policy, or agent invalid-generation metrics. | Catalog-scale regression report. |

**Scope controls**

- No component-count target can waive usefulness, platform honesty, or proof.
- Unsupported target cells remain explicit; breadth cannot be manufactured by
  wrappers or aliases.
- Product-specific workflows stay in applications unless a bounded reusable
  pattern satisfies ontology admission.

**Exit condition:** Catalog breadth grows through proved user workflows without
weakening ownership, renderer priority, retrieval quality, or evidence.

### G3.2 Declarative migrations and reviewed codemods

**Objective:** Enable `core migrate` only for version-bounded changes that can
be transformed deterministically and recovered safely.

**Entry conditions**

- Gate 2 release history contains at least one real supported migration need.
- Old and new binding specs/catalogs remain retrievable.
- G2.5 mutation safety and G2.6 review-packet primitives are complete.
- A migration is either declarative or has a reviewed, maintained parser and
  codemod boundary.

**Primary ownership**

- `MigrationRecord` canonical sources
- `@core-ui/tooling` local migration engine

**Deliverables**

- Version-bounded migration records with prerequisites, replacements or
  no-replacement reasons, transformations, unsupported cases, and validation.
- `core migrate` dry-run, change-intent envelope, semantic diff, journal,
  confirmation, atomic apply, idempotency, rollback, and recovery.
- Declarative transforms first; reviewed codemods only when syntax/version
  support and safety can be bounded.
- Historical guidance and deprecation-window retrieval.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.2-01` | Each migration transforms only the declared version range and refuses unknown, ambiguous, or already-migrated inputs safely. | Version-range corpus. |
| `E-G3.2-02` | Dry-run/apply parity, base-drift rejection, idempotency, interruption recovery, and rollback pass across supported project shapes. | Mutation fault-injection matrix. |
| `E-G3.2-03` | Migrated consumers compile, validate, and pass affected behavior/accessibility/package fixtures. | Before/after consumer evidence. |
| `E-G3.2-04` | Unsupported code receives an exact manual path; no model-generated patch is substituted. | Unsupported-syntax fixture. |

**Scope controls**

- No unconstrained LLM-generated migration patch.
- A codemod cannot silently rewrite unrelated formatting, files, or semantics.
- Migration does not run through hosted MCP.

**Exit condition:** Enabled migrations are version-exact, deterministic,
reviewable, bounded, and recoverable, with honest manual fallback.

### G3.3 Read-only hosted MCP

**Objective:** Offer remote discovery without letting hosted recency or service
state impersonate installed-local implementation authority.

**Entry conditions**

- Gate 2 query schemas and catalog compatibility policy are stable.
- Local MCP parity has passed across released records.
- Hosted storage, authentication where applicable, rate limits, privacy,
  revocation, and availability policies are defined.

**Deliverables**

- Small read-only `search`, `get`, and—only if G2.4 is complete—`plan` tool
  surface.
- Explicit target-tuple input for implementation-applicable results; otherwise
  advisory labelling.
- The same query request/response schemas and compatibility metadata as local
  surfaces.
- Content-addressed catalogs, provenance verification, cache isolation, and
  sanitized diagnostics.
- Operational metrics and degradation behavior that never change canonical
  ranking or local correctness.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.3-01` | Identical hosted/local requests over the same digest normalize to the same record/plan response. | Hosted parity matrix. |
| `E-G3.3-02` | Missing or incompatible target tuples suppress project-applicable imports/props/examples and return advisory context. | Compatibility negative corpus. |
| `E-G3.3-03` | Hosted tools perform no project write, consumer-code execution, extension execution, or local-filesystem diagnosis. | Capability and security audit. |
| `E-G3.3-04` | Service outage, stale cache, or rate limit cannot affect local CLI correctness or installed authority. | Failure-isolation exercise. |
| `E-G3.3-05` | Public responses expose no restricted evidence, secret, absolute path, credential, personal identifier, or access-bearing URL. | Disclosure/privacy scan. |

**Scope controls**

- No hosted `validate`, `doctor`, `init`, `migrate`, proposal apply, or arbitrary
  extension execution.
- Semantic search may be additive but cannot replace deterministic local
  search or reproducible tests.

**Exit condition:** Hosted MCP is a thin, read-only, compatibility-honest
adapter whose failure cannot alter local truth.

### G3.4 Agent-evaluation promotion

**Objective:** Promote selected model-based evaluations from informational
signals to release gates only after repeatable baselines and clear ownership
exist.

**Entry conditions**

- Gate 1 and Gate 2 have accumulated repeated cold-start and generation runs.
- Prompt sets reference canonical artifact/example IDs and contain no copied
  implementation source.
- Model/version variance, retry policy, threshold calculation, and failure owner
  are defined before thresholds are examined for promotion.

**Deliverables**

- Versioned cold-start, artifact-selection, code-generation, validation-repair,
  and composition prompt suites.
- Metrics for manifest discovery, selection precision/recall, invented/wrong
  props, invalid composition, compile/validation, accessibility obligations,
  one-diagnostic repair, context tokens, and repeated/model-family stability.
- Predeclared baselines, confidence/variance treatment, threshold policy, and
  triage ownership.
- Failure classification across code/API, relationship, search, guidance,
  example, or stochastic causes.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.4-01` | Repeated runs establish stable enough distributions for each promoted metric under declared models and settings. | Baseline/variance report. |
| `E-G3.4-02` | Thresholds are fixed before release-candidate evaluation and cannot be waived by relabelling deterministic failures as model variance. | Gate-policy audit. |
| `E-G3.4-03` | Failures trace to canonical IDs, inputs, tool/model versions, and an accountable owner without collecting consumer data by default. | Evaluation provenance/privacy report. |
| `E-G3.4-04` | A documentation patch is not automatically proposed when the actual owner is implementation, API, relation, search, or example metadata. | Failure-routing corpus. |

**Scope controls**

- Model evaluation never replaces schema, type, behavior, accessibility,
  visual, package, or generation-identity proof.
- A single stochastic miss does not override deterministic evidence; repeated
  failure is handled through the declared threshold policy.
- Prompt/model changes create new comparable evidence, not rewritten history.

**Exit condition:** Selected agent metrics are reproducible enough to gate a
release, have fixed ownership, and remain subordinate to deterministic proof.

### G3.5 Additional themes and design-tool interchange

**Objective:** Add design-tool operation and round-tripping as a bounded
projection/import-proposal workflow over stable canonical token and artifact
identities.

**Entry conditions**

- Gate 2 package, token-contract, artifact, binding, and release identities are
  stable across at least one real release change.
- At least one named design-tool workflow and adapter version is selected from
  observed maintainer use.
- Export-only value is demonstrated before import/write work begins.
- G2.6 proposal/review packets can represent token, example, and binding
  changes without direct projection edits.

**Primary ownership**

- Canonical token/artifact owners remain authoritative.
- A capability-gated design-tool adapter owns only interchange mappings and
  transport.

**Deliverables**

- Versioned interchange profile mapping design-tool variables/styles/nodes to
  stable Core token IDs, `ArtifactRef` values, binding/part IDs, modes, and
  adapter versions.
- Deterministic export with provenance, catalog/token digests, mapping coverage,
  and unsupported/lossy-field report.
- Import as a read-only proposal first: identity matching, semantic diff,
  change-intent envelope, affected proof, version effects, and review packet.
- Explicit conflict, ambiguity, deleted identity, stale-base, and lossy
  round-trip handling.
- Additional theme validation under token types, modes, override policy,
  fallbacks, forced-colors/high-contrast, and native adaptation.
- Synthetic round-trip fixtures; no collection of real product files by
  default.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.5-01` | Export preserves stable IDs, token types/modes/aliases, component-part identity, provenance, and adapter/catalog versions. | Export mapping fixture. |
| `E-G3.5-02` | Export→tool→import with no semantic edit produces an empty canonical write set or an explicit documented lossy delta. | No-op round-trip fixture. |
| `E-G3.5-03` | A supported design edit produces a bounded proposal against the correct owners and cannot write before digest-bound approval. | Supported import-proposal fixture. |
| `E-G3.5-04` | Ambiguous mappings, stale bases, unknown IDs, incompatible types, unsupported semantics, and lossy changes fail visibly without guessing. | Negative interchange corpus. |
| `E-G3.5-05` | Design-tool artifacts remain projections/import candidates and never outrank canonical source, package, or release authority. | Authority and drift audit. |
| `E-G3.5-06` | Additional themes satisfy required token/profile coverage and cannot disable mandatory platform adaptations. | Theme compatibility matrix. |

**Scope controls**

- No design-tool file becomes a canonical component, token, example, or layout
  source.
- No direct round-trip write, positional node heuristic as identity, or silent
  best-effort mapping.
- Layout/page/flow authoring is outside this milestone unless separately
  admitted under G3.8.
- A second design tool does not trigger a universal interchange abstraction
  until two real adapters prove repeated shape.

**Exit condition:** The selected design-tool workflow round-trips supported
semantics through deterministic, provenance-rich proposals while canonical
owners remain authoritative.

### G3.6 Promptable-semantics discovery and bounded activation

**Objective:** Determine whether recurring synthesis and transformation tasks
need additional typed semantics without pre-committing a parallel ontology.

**Entry conditions**

- Gate 1 has real component/pattern examples and recorded agent tasks.
- A representative, privacy-safe corpus of synthesis, transformation,
  explanation, and design-to-code requests exists.
- Current behavior over tokens, variants, patterns, decision context, and
  example curriculum is baselined first.

**Primary ownership**

- Evaluation/research workstream initially
- Existing record owners for any accepted bounded fields or relations

**Deliverables**

- Task corpus and failure taxonomy for candidate concepts such as density,
  emphasis, hierarchy, feedback strength, interaction certainty, and data
  density.
- Ownership analysis mapping each candidate to an existing token mode,
  component variant, pattern parameter/relation, decision context, product
  context, or unsupported ambiguity.
- Deterministic vocabulary candidates only where meaning is stable across
  multiple artifacts/workflows and has a named owner/consumer/proof path.
- Predeclared evaluation comparing the baseline with any candidate typed
  representation.
- An admission RFC—or an explicit no-new-ontology conclusion—for each candidate
  family.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.6-01` | Candidate terms are derived from observed tasks and classified by owner rather than assumed to form one universal semantic layer. | Task/ownership analysis. |
| `E-G3.6-02` | Existing fields/relations are preferred when they express the task without ambiguity or duplicated ownership. | Representation comparison. |
| `E-G3.6-03` | Any activated term has a closed schema, deterministic query/plan behavior, authoring support, migration, proof, and measurable improvement over baseline. | Admission packet and evaluation. |
| `E-G3.6-04` | Ambiguous, product-specific, or weakly evidenced terms remain unsupported or editorial and cannot influence stable generation. | Negative candidate corpus. |

**Scope controls**

- Discovery completion does not require adding vocabulary.
- No free-standing interpretation graph, prompt-only truth, model-generated
  ranking, or universal “design intent” object.
- Product-specific business priority and navigation remain application-owned.
- This read-only discovery cannot block Gate 2 or retroactively change Gate 1
  acceptance.

**Exit condition:** Observed workflows either justify narrowly owned typed
semantics with proof or produce an explicit decision that the existing model is
sufficient.

### G3.7 Optional extension and overlay trust model

**Objective:** Enable narrowly scoped extensions only if real demand justifies
moving beyond v1’s closed first-party catalog.

**Entry conditions**

- Gate 2 is complete and an observed workflow cannot be satisfied by first-party
  records, normal project code, or an inert namespace.
- Threat model, integrity/provenance, permissions, revocation, confinement,
  timeout, and compatibility policies are approved.
- Extension discovery remains non-executing.

**Deliverables**

- Namespaced extension schema/capability registry and explicit trust levels.
- Inert-data preservation and capability-specific query projection.
- Explicit local installation and scoped authorization for executable
  validators, codemods, or adapters.
- Overlay identity/collision policy if consumer catalog overlays are separately
  admitted; `core:*` IDs cannot be shadowed.
- Promotion path from first-party experimental extension to stable schema field
  through ADR, migrator, fixtures, and query/compiler support.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.7-01` | Inert extension changes update content/catalog provenance but not spec revision, descriptor, search, stable get/dense/bootstrap behavior. | Inert extension isolation fixture. |
| `E-G3.7-02` | Unsupported tooling preserves inert data without interpreting or projecting it. | Cross-version preservation fixture. |
| `E-G3.7-03` | Executable extensions require compatible explicit installation, integrity verification, least privilege, confinement, timeout, and revocation. | Security/adversarial matrix. |
| `E-G3.7-04` | Hosted services never execute extensions and namespace collisions fail closed. | Hosted capability audit. |

**Scope controls**

- Extensions are deny-by-default and cannot affect stable behavior without an
  owned schema/capability.
- No in-process arbitrary plugin execution during discovery.
- Consumer overlays and executable extensions are separate admissions; proving
  one does not enable the other.

**Exit condition:** Any enabled extension remains bounded, versioned,
revocable, non-authoritative outside its scope, and isolated from stable truth.

### G3.8 Optional higher-order product artifacts

**Objective:** Add a page, flow, journey, or other higher-order kind only when
patterns plus guides demonstrably cannot serve repeated agent workflows.

**Entry conditions**

- G3.6 or equivalent observed-task evidence identifies repeated unsupported
  requests.
- At least two real workflows share a stable ownership and query shape.
- The proposal passes the full ontology-growth admission rule.

**Deliverables**

- Accepted RFC identifying why `PatternRecord`, `GuideRecord`, relations, and
  application-owned data are insufficient.
- Closed schema, one owner, typed relations, lifecycle, compatibility/revision
  semantics, query and dense projections, authoring/scaffold/diff support,
  executable examples, proof, and deprecation path.
- Explicit boundary between reusable design-system knowledge and
  application-owned business/navigation logic.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.8-01` | The new kind improves the predeclared unsupported workflows without duplicating existing facts. | Baseline comparison and ownership audit. |
| `E-G3.8-02` | Human/JSON/dense/API/MCP/site projections agree and unsupported requests fail deterministically. | Surface and negative-query corpus. |
| `E-G3.8-03` | Authoring, migration, revision closure, and proof exist before stable activation. | Ontology admission packet. |

**Scope controls**

- No kind is required merely because a reviewer can name a plausible category.
- Product-specific screens, routes, analytics, content, and business state stay
  outside Core UI.
- If patterns/guides meet the observed need, this milestone closes with no new
  kind.

**Exit condition:** A higher-order kind exists only if real tasks prove unique,
bounded design-system ownership and measurable value.

### G3.9 Additional framework binding

**Objective:** Add a real second web framework binding before extracting any
general multi-framework abstraction.

**Entry conditions**

- Gate 2 web HTML/CSS/controller and compatibility contracts are stable.
- Demonstrated consumer demand selects one framework.
- The framework can bind to `web.html` and `@core-ui/web` without forking
  component identity, guidance, or styles.

**Deliverables**

- New platform binding records on existing component IDs.
- Framework package, canonical examples, host-type refinements, packed
  descriptors, consumer fixtures, and applicable accessibility evidence.
- Runtime ownership rules for the framework’s lifecycle and any web controller
  adapters.
- Comparison of repeated shape against React to inform—but not automatically
  create—a future shared adapter abstraction.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.9-01` | The framework preserves web semantics/styles/hooks and does not create a parallel registry or documentation path. | Binding/surface parity report. |
| `E-G3.9-02` | Packed consumers prove exports, types, runtime ownership, SSR/hydration where applicable, and canonical examples. | Framework consumer matrix. |
| `E-G3.9-03` | Any proposed shared abstraction is supported by two real bindings and has no React-specific or framework-specific ownership leak. | Abstraction review. |

**Scope controls**

- One framework milestone adds one framework, not an “all frameworks” layer.
- Web Components, Vue, Svelte, or another target is chosen by demand, not by
  speculative symmetry.

**Exit condition:** One demanded framework conforms to the existing web product
without copied truth; generalization remains evidence-led.

### G3.10 Optional agent-to-UI protocol binding

**Objective:** Add an agent-to-UI protocol only as another bounded binding or
integration, never as the definition of AI-first or a kernel dependency.

**Entry conditions**

- Gate 2 canonical query, compatibility, validation, and proof surfaces are
  stable.
- A named protocol and observed workflow justify a renderer/integration.
- Protocol input cannot bypass pattern/component constraints or installed
  compatibility.

**Deliverables**

- Explicit protocol-to-`ArtifactRef`/binding/pattern mapping.
- Compatibility-aware renderer or adapter with typed unsupported results.
- Validation, examples, package boundaries, provenance, and security policy.
- Clear authority boundary: protocol payload is a request/projection, not
  canonical product truth.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.10-01` | Protocol inputs resolve only supported installed artifacts/patterns and cannot invent public API or bypass constraints. | Protocol conformance corpus. |
| `E-G3.10-02` | Invalid, ambiguous, incompatible, or unsupported payloads fail with typed diagnostics. | Negative protocol corpus. |
| `E-G3.10-03` | Removing or disabling the protocol capability leaves the canonical catalog, renderers, and CLI documentation unchanged. | Kernel-independence fixture. |

**Scope controls**

- No protocol-specific component registry or canonical IDs.
- No claim that protocol support is required for Core UI to be AI-first.
- Mutation and external-action authority require separate explicit protocols.

**Exit condition:** The selected protocol is an optional, compatibility-aware
adapter over Core UI rather than a new source or kernel.

### G3.11 Optional consumer pattern validation and scaffolds

**Objective:** Extend proved pattern rules into supported consumer source only
when maintained parsers and acceptable diagnostic precision make that claim
responsible.

**Entry conditions**

- G2.4 has stable patterns, parameters, examples, and plan responses.
- Repeated consumer workflows demonstrate value beyond catalog/example
  validation.
- Supported languages, frameworks, syntax versions, parser ownership, escape
  hatches, and a predeclared false-positive budget are available.

**Deliverables**

- Manifest-declared consumer pattern validation for explicitly supported source
  shapes.
- Typed rule IDs, locations, pattern/artifact references, confidence boundary,
  suppressions/escape hatches, and exact repair guidance.
- Optional templates/scaffolds derived from canonical pattern plans and examples
  with change-intent preview for writes.
- Unsupported-syntax behavior that declines analysis rather than guessing.

**Acceptance evidence**

| ID | Required assertion | Retained evidence |
| --- | --- | --- |
| `E-G3.11-01` | Supported valid/invalid consumer trees meet the declared precision and recall budget under maintained parser versions. | Consumer pattern corpus. |
| `E-G3.11-02` | Unsupported or ambiguous source receives a typed unsupported result and no inferred structural claim. | Syntax-boundary corpus. |
| `E-G3.11-03` | Scaffolds reproduce a canonical plan/example, preview exact writes, and do not invent product workflows or hidden runtime abstractions. | Scaffold golden and mutation-safety fixture. |

**Scope controls**

- No claim to validate arbitrary JSX, HTML, React Native, or generated code.
- A scaffold is a projection of a known pattern, not a general application
  generator.
- Consumer suppressions cannot weaken canonical source validation or release
  proof.

**Exit condition:** Enabled consumer analysis and scaffolds remain syntax-
bounded, pattern-derived, deterministic, and honest about unsupported code.

### Gate 3 portfolio rule

Gate 3 has no single “everything complete” exit. Each enabled capability ships
with its own manifest declaration, version policy, evidence packet, support
matrix, and rollback/disable path. Unstarted or rejected Gate 3 milestones are
valid outcomes and do not make the core product incomplete.

## Milestone register

| ID | Milestone | Hard dependencies | Blocks |
| --- | --- | --- | --- |
| G0.0 | Repository, ownership, and task graph | Architecture authority | G0.1, all repository work |
| G0.1 | Schema, identity, and revision kernel | G0.0 | G0.2, G0.5, Gate 1 records |
| G0.2 | Catalog compiler and pure query kernel | G0.1 | G0.3, G0.4, query projections |
| G0.3 | CLI documentation baseline | G0.2 | Gate 0 exit, later adapters |
| G0.4 | Project-local catalog package and resolver | G0.2, G0.3 envelopes | Gate 0 exit, G2.2 |
| G0.5 | Maintainer authoring baseline | G0.0, G0.1, G0.2 | Gate 0 exit, Gate 1 authoring |
| G1.0 | Tokens, themes, and foundation boundaries | Gate 0 | All Gate 1 slices |
| G1.1 | Framework-free web and React substrate | Gate 0, G1.0 needs | Web/React slice cells |
| G1.2 | React Native substrate and profiles | Gate 0, G1.0 needs | Native slice cells |
| G1.3 | Button slice | G1.0–G1.2 | Gate 1 exit, authoring path baseline |
| G1.4 | TextField slice | G1.0–G1.3 as applicable | Form pattern, Gate 1 exit |
| G1.5 | Switch slice | G1.0–G1.2 | Gate 1 exit |
| G1.6 | Dialog slice | G1.1, G1.2, G1.0 overlay needs | Gate 1 exit, Select dependencies |
| G1.7 | Select slice | G1.1, G1.2, applicable G1.6 ownership | Gate 1 exit |
| G1.8 | Form pattern and curriculum | G1.3, G1.4, applicable G1.5 | G1.9, G2.4 |
| G1.9 | Cross-slice proof and `0.1` | G1.0–G1.8 | Gate 1 exit, all Gate 2 work |
| G2.0 | Tabs and Toast proof extension | Gate 1 | Broad G3.1 breadth only |
| G2.1 | Packages, compatibility, and releases | Gate 1 | G2.2, G2.3, Gate 2 release |
| G2.2 | Consumer validation and local resolution | G2.1, G0.4 | G2.5, Gate 2 release |
| G2.3 | Docs, explorers, static bootstrap, and local MCP | G2.1, Gate 1 parity | Gate 2 release |
| G2.4 | Grounded composition planning | G1.8, Gate 1 | Public `plan`, G3.11 |
| G2.5 | Doctor and init | G2.2, Gate 1 change intent | Enabled project writes |
| G2.6 | Allowlisted canonical proposals | G1.9, G2.1, G2.5 primitives | Enabled maintainer proposals |
| G2.7 | Productization release | G2.1, G2.2; enabled optional G2 milestones | Gate 2 exit |
| G3.1 | Component and pattern breadth | Gate 2; G2.0 for comparable risks | Only its admitted families |
| G3.2 | Migrations and codemods | Gate 2 history, G2.5/G2.6 safety | Public `migrate` |
| G3.3 | Hosted MCP | Gate 2 query stability | Hosted read-only capability |
| G3.4 | Agent-evaluation promotion | Repeated Gate 1/2 baselines | Only promoted eval gates |
| G3.5 | Themes and design-tool interchange | Stable Gate 2 identities, G2.6 | Selected interchange capability |
| G3.6 | Promptable-semantics discovery | Gate 1 task evidence | Only separately admitted semantics |
| G3.7 | Extension and overlay trust | Gate 2 plus observed demand | Only enabled extension scope |
| G3.8 | Higher-order artifacts | G3.6/equivalent demand evidence | Only accepted new kind |
| G3.9 | Additional framework | Stable Gate 2 web, demand | Selected framework binding |
| G3.10 | Agent-to-UI protocol | Stable Gate 2, named protocol demand | Selected protocol adapter |
| G3.11 | Consumer pattern validation/scaffolds | G2.4, parser evidence, demand | Supported consumer analysis only |

## Mandatory fixture ledger

| Architecture fixture | First release-blocking milestone | Evidence IDs |
| --- | --- | --- |
| Authoring round trip | G0.5 | `E-G0.5-01` through `E-G0.5-04` |
| Workspace catalog resolution | G0.4 | `E-G0.4-01` through `E-G0.4-05` |
| Normative example closure | G1.8 and G1.9 | `E-G1.8-02`, `E-G1.9-07` |
| Example curriculum selection | G1.8 | `E-G1.8-03` |
| Change-intent closure | G1.9 | `E-G1.9-03` |
| Packed descriptor derivation | G1.9, then real release at G2.1 | `E-G1.9-02`, `E-G2.1-02` |
| Token fallback denial | G1.0 | `E-G1.0-03` |
| Platform theme safety and accessibility | G1.0 contract; G1.1/G1.2 test-only substrate behavior; G1.3–G1.7 per-slice binding/profile fulfillment; G1.9 exact contract/evidence correlation | `E-G1.0-07`, `E-G1.1-06`, `E-G1.2-05`, `E-G1.3-01`, `E-G1.3-02`, `E-G1.4-02`, `E-G1.4-03`, `E-G1.5-01` through `E-G1.5-03`, `E-G1.6-01`, `E-G1.6-03`, `E-G1.6-04`, `E-G1.7-01` through `E-G1.7-03`, `E-G1.9-01` |
| Evidence advisory propagation | G1.9 | `E-G1.9-04` |
| Operational exception enforcement | G1.9 | `E-G1.9-05` |
| Inert extension isolation | G3.7 or earlier extension enablement | `E-G3.7-01`, `E-G3.7-02` |

The listed IDs are minimum coverage. A milestone may add evidence but cannot
remove or weaken these assertions without changing the architecture.

## Architecture traceability

| Architecture target | Roadmap realization |
| --- | --- |
| AI-first system/tooling properties | G0.2–G0.5 establish deterministic manifest/query/CLI/authoring; G1.9 starts agent smoke evidence; G3.4 promotes stable evals. |
| AI-operable component/API rules | G1.0–G1.8 apply naming, defaults, composition, styling, accessibility, and bounded escape hatches to real slices. |
| Canonical artifact graph and one owner per fact | G0.1 schemas/ownership, G0.2 graph/compiler, G0.5 authoring, all slice deliverables. |
| Content versus binding-spec revision | G0.1 closure proof, G0.5 explainers, G1.8 normative examples, G2.1 release/version effects. |
| Deterministic example curriculum | G1.3–G1.8 examples and preference, G1.9 parity, G2.4 planning. |
| Bounded patterns and portable guides | G1.8 Form pattern, G2.4 planner, G2.3 guide/site projection, G3.8 admission boundary. |
| Ontology growth budget | Global scope admission, G3.6 discovery, G3.7–G3.11 per-capability entry controls. |
| CLI as documentation | G0.3 baseline, G1.9 parity, G2.3 site/bootstrap projection. |
| One query engine and thin adapters | G0.2 kernel, G0.3 CLI, G1.9 internal MCP, G2.3 site, G3.3 hosted MCP. |
| Multi-platform semantic parity/binding conformance | G1.0–G1.8 fixed matrix, G2.0 extended risks, G3.9 future framework. |
| Foundation/web/React/native ownership | G1.0, G1.1, and G1.2 substrates plus per-slice evidence. |
| Public package graph and compatibility descriptors | G0.0 boundaries, G1.9 packed derivation, G2.1 releases. |
| Project-local catalog resolution and typed taxonomy | G0.4 synthetic proof, G2.2 production packed proof. |
| Predictable repository navigation/orchestration | G0.0 task graph/routes and G0.5 source-linked authoring. |
| Maintainer ergonomics and change-intent protocol | G0.5 baseline, G1.9 complete read-only closure, G2.5 project writes, G2.6 canonical proposals. |
| Generation hygiene | G0.0 path policy, G0.2 deterministic compiler, every milestone’s no-projection-patch rule. |
| Proof/evidence/disclosure/advisories | G1.9 evidence system, G2.1/G2.7 release manifests, G3.4 eval promotion. |
| Lifecycle, SemVer, historical retrieval, trust | G0.1 schema rules, G2.1 version/release, G2.2 installed authority, G3.2 migrations. |
| Token/theme/fallback/override policy | G1.0 default system and cross-platform safety contract, G1.1/G1.2 binding-owned platform proof, per-slice requirement sets, G1.9 integrated profile view, and G3.5 additional themes/interchange. |
| V1 product boundaries | Global guardrails, Gate 1 fixed matrix, Gate 2 capability enablement, independent Gate 3 admission. |
| Design-tool interoperability | G3.5 export/import-proposal and round-trip proof. |
| Promptable semantics | G3.6 observed-task discovery and bounded activation only. |
| Agent-safe write paths | G1.9 previews, G2.5 safe consumer operations, G2.6 allowlisted canonical proposals, G3.2 migrations. |
| Deferred extensions, frameworks, higher-order artifacts, and protocols | G3.7–G3.11 independent milestones. |

## Deferred-capability registry

This table prevents “later” from meaning either “implicitly available” or
“forgotten indefinitely.” A deferred capability has a named activation trigger
and stays absent until that trigger is proved.

| Capability | Earliest activation | Required trigger |
| --- | --- | --- |
| Public local MCP | G2.3 | G1.9 parity plus stable Gate 2 schemas/query responses and product support/readiness evidence; otherwise internal only. |
| Read-only hosted MCP | G3.3 | Stable target-tuple compatibility, hosted privacy/security/availability, and failure isolation. |
| Consumer-project validation | G2.2 | Packed fixtures, maintained parsers, bounded syntax/version support, false-positive policy. |
| Public composition planning | G2.4 | Stable bounded patterns with deterministic unsupported behavior. |
| Consumer templates/scaffolds and pattern validation | G3.11 | Stable planner, observed demand, parser precision/recall evidence, safe write preview. |
| Doctor and init | G2.5 | Project detection, dry-run/apply parity, confinement, journaling, confirmation, recovery. |
| Canonical proposal writes | G2.6 | Closed operation schema, complete review packet, owner, proof, digest-bound approval. |
| Migration | G3.2 | A real version-bounded need and a deterministic transform or maintained reviewed codemod. |
| Additional themes | G3.5 | Stable token contract plus profile/fallback/accessibility validation. |
| Design-tool interchange | G3.5 | Stable IDs, observed named workflow, export proof, loss policy, import as proposal. |
| Promptable semantic fields/relations | After G3.6 admission | Repeated task evidence, stable owner/meaning, deterministic consumer, measurable improvement. |
| Model evaluations as release gates | G3.4 | Repeated baseline, predeclared threshold, variance policy, failure owner. |
| Executable extensions or consumer overlays | G3.7 separately | Threat model, demand, namespace/integrity/permission/revocation proof. |
| Higher-order artifact kind | G3.8 | Patterns/guides proven insufficient for repeated design-system-owned workflows. |
| Additional framework | G3.9 | Demonstrated demand and conformance to stable web binding/CSS runtime. |
| Agent-to-UI protocol | G3.10 | Named protocol/workflow and proof it remains an optional compatible binding. |

## Risk and enforcement register

| Pressure point | Leading signal | Enforced response |
| --- | --- | --- |
| Infrastructure overtakes renderer work | Enabling work cannot name the active slice/fixture it unblocks. | Return it to `not-ready`; protect Gate 1 critical path. |
| Ontology inflation | New kind/revision/package appears before observed workflow and authoring/proof support. | Fail scope admission; use an existing projection/relation/field or defer. |
| Canonical/projection drift | Generated diff is fixed directly or site/MCP output diverges. | Reject change; repair canonical input/compiler; rerun parity and generation identity. |
| False cross-platform parity | Shared props/structure are treated as proof of native conformance. | Require explicit strategy, profile, binding deviations, and platform evidence. |
| Hosted/latest truth leak | Project guidance lacks exact installed tuple or is sourced from newer remote data. | Suppress applicable guidance; emit advisory or compatibility error. |
| Mutation scope expansion | Apply writes paths/effects absent from approved preview. | Abort before write; invalidate digest; regenerate intent and request approval. |
| Exception becomes bypass | Exception broadens support, patches output, hides integrity, or expires. | CI/release failure; narrow support, disable capability, fix, or roll back. |
| Evidence privacy leak | Public result exposes raw consumer data, credentials, paths, or restricted artifacts. | Block publication; sanitize/attest under disclosure policy; rotate/revoke as needed. |
| Model metric gaming | Threshold changes after results or model miss overrides deterministic proof. | Invalidate evaluation packet; restore predeclared policy and deterministic precedence. |
| Design-tool authority inversion | Tool nodes/variables become canonical or lossy import writes silently. | Reject import; report mapping/loss; produce proposal only against canonical owners. |
| Promptable semantics becomes vague layer | Terms lack stable owner, meaning, query behavior, or measurable benefit. | Keep editorial/unsupported; close discovery without new ontology. |
| Component-count pressure | Breadth rises while proof, retrieval quality, or maintainer throughput degrades. | Stop admissions; repair the addition path and metrics before resuming breadth. |

## Milestone activation and review packet

Before a milestone moves from `not-ready` to `ready`, its owner records:

- milestone ID and responsible product, renderer, schema/catalog, proof, and
  release roles;
- evidence that every entry condition is true;
- the locked deliverable list and explicit non-goals;
- dependency revisions and supported target/profile matrix;
- acceptance commands, fixtures, environments, disclosure/retention policy,
  and evidence owner;
- predeclared agent-evaluation model/settings/threshold policy where applicable;
- expected version/release effect;
- rollback or disable path; and
- any active allowed exception and its hard expiry.

The evidence reviewer must be independent of the result-producing automation
for manual accessibility, security, release integrity, and operational
exception approval. Specific people and mutable schedules belong in project
tracking, not this long-lived roadmap.

## Recommended first execution sequence

1. Activate G0.0 and establish the route map, owners, task graph, and generated
   boundaries.
2. Complete G0.1 before creating a broad catalog or renderer inventory.
3. Complete G0.2, then run G0.3, G0.4, and G0.5 in parallel over the same
   minimal artifact.
4. Close Gate 0 with the uninterrupted scaffold-to-query-to-repair evidence
   path.
5. Activate G1.0, G1.1, and G1.2 only for the fixed slice requirements.
6. Complete Button first, then TextField and Switch; use their proved substrate
   for Dialog and Select without forcing false shared behavior.
7. Complete the Form pattern/curriculum, then close the entire `0.1` matrix and
   change-intent/evidence fixtures in G1.9.
8. After Gate 1, productize packages/resolution first. Run docs, planning, and
   safe-operation milestones only when their own entries are ready.
9. Admit Gate 3 capabilities independently. Design-tool interchange,
   promptable-semantics activation, extensions, frameworks, and protocols never
   become implicit core prerequisites.

## Roadmap completion checklist

This roadmap is being followed only while all answers remain “yes”:

- Is the active milestone’s entry evidence complete?
- Does every enabling deliverable name the renderer slice or acceptance fixture
  it unblocks?
- Are canonical owners and generated projections still distinct?
- Does every supported target have an explicit lifecycle/strategy and current
  risk-proportionate evidence?
- Do local queries resolve against the exact installed tuple?
- Are CLI, API, dense, MCP, site, and explorer surfaces using the same enabled
  query/record sources?
- Are change previews complete, digest-bound, confirmed, and rejected on base
  drift or scope expansion?
- Are exceptions narrowing, visible, non-expired, and non-waivable rules intact?
- Are agent evaluations subordinate to deterministic proof?
- Is every new ontology/capability justified by observed workflows and equipped
  with authoring, migration, proof, and removal paths?
- Can later-gate work be disabled without changing canonical truth or blocking
  an earlier renderer milestone?

If any answer is “no,” stop the affected capability at its current gate, retain
the failure evidence, and repair the earliest authoritative owner. Do not patch
a projection, lower the evidence claim, or expand the milestone to hide the
failure.
