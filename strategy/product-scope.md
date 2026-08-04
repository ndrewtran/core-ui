---
scopeVersion: 1.0.0
status: execution-baseline
product: Core UI
architecture: ./monorepo-architecture.md
roadmap: ./milestone-roadmap.md
---

# Core UI product scope

## Purpose and authority

This document defines **what Core UI is intended to ship**. It turns the
architecture and milestone roadmap into a product portfolio with stable scope
IDs, release commitments, platform coverage, public surfaces, and explicit
non-goals.

The authority order is:

1. [`monorepo-architecture.md`](./monorepo-architecture.md) defines what must
   remain true.
2. [`milestone-roadmap.md`](./milestone-roadmap.md) defines how those truths are
   built and proved.
3. This document defines which product outcomes and capabilities are committed,
   admitted, deferred, or rejected.
4. The project tracker records live work, owners, pull requests, blockers, and
   schedules.

If this document conflicts with the architecture, the architecture wins. If a
committed scope item lacks an adequate roadmap milestone or evidence assertion,
the roadmap must be corrected before the item moves into implementation. The
tracker may reference scope and milestone IDs but cannot change product scope.

This is not a status report. Git history records changes to product commitment;
the tracker records delivery progress.

## Scope vocabulary

### Commitment states

| State | Meaning |
| --- | --- |
| `candidate` | A plausible product item awaiting workflow evidence and scope admission. It must not be advertised or treated as a dependency. |
| `admitted` | The product direction is approved and bounded, but activation conditions or release commitment are not yet satisfied. |
| `committed` | The item is required for its named release boundary. It can be removed only through an explicit product-scope change. |
| `deferred` | The item is intentionally unavailable until its named trigger is proved. |
| `rejected` | The item conflicts with Core UI's authority, safety, platform, or product boundaries. |

Commitment state is not implementation status and is not artifact lifecycle.
For example, a component can be `committed` to the `0.1` scope while its
binding lifecycle remains `experimental` until promotion evidence passes.

### Delivery boundaries

| Boundary | Meaning |
| --- | --- |
| Foundation | Internal Gate 0 operability spine; no public product-completeness claim. |
| `0.1` | Fixed Gate 1 prerelease acceptance matrix proving real multi-platform renderer slices. |
| Productization | Gate 2 packages, local authority, consumer validation, documentation surfaces, and enabled safe operations. |
| Capability release | Independently admitted Gate 3 breadth or integration; there is no global “all Gate 3 complete” state. |

### Scope-item contract

Every product-scope item has:

- one immutable scope ID;
- one product outcome and authoritative owner;
- one commitment state and earliest delivery boundary;
- applicable platforms or an explicit non-platform disposition;
- roadmap milestone and evidence references;
- dependencies and activation conditions;
- explicit exclusions; and
- a removal, replacement, or deferral rule where applicable.

Scope IDs are never reused. Renaming a display label does not change the ID.
Splitting or replacing an item creates new IDs and records the relationship in
the change that updates this document.

## Product definition

Core UI is an AI-ready, multi-platform design system and component library for:

- framework-free web using HTML, CSS, and optional vanilla JavaScript;
- React web using Core UI's shared web styles and externally observable web
  semantics;
- React Native on iOS and Android using native primitives; and
- React Native Web as an explicit runtime profile with an honest per-binding
  strategy rather than assumed React-web parity.

The CLI is the primary documentation interface. Human output, dense output,
typed JSON, MCP, the documentation site, explorers, and generated agent context
are projections of the same canonical artifact graph and query engine.

Core UI is AI-ready only when agents can discover capabilities, retrieve exact
installed-version guidance, select deterministic examples, compose bounded
patterns, validate results, and recover from structured diagnostics without
scraping prose or guessing unsupported APIs.

## Product outcomes

| Scope ID | Commitment | Outcome |
| --- | --- | --- |
| `SCOPE-OUTCOME-001` | `committed` | A consumer can implement supported UI on web, React, iOS, and Android from one shared semantic system with explicit platform binding differences. |
| `SCOPE-OUTCOME-002` | `committed` | A human, agent, or tool can discover and retrieve exact locally compatible Core UI guidance through a self-describing CLI without repository crawling. |
| `SCOPE-OUTCOME-003` | `committed` | Every public fact has one canonical owner and every package, documentation surface, example, and proof projection can be regenerated and verified against it. |
| `SCOPE-OUTCOME-004` | `committed` | Maintainers can add and evolve components through owner-linked scaffolds, semantic diffs, revision explanations, affected closures, and structured proof. |
| `SCOPE-OUTCOME-005` | `committed` | Stable releases expose exact package, catalog, binding, token, runtime-profile, evidence, and exception identity. |
| `SCOPE-OUTCOME-006` | `admitted` | Agents can propose a small allowlist of canonical changes through deterministic review packets and explicit approval without receiving arbitrary patch authority. |
| `SCOPE-OUTCOME-007` | `admitted` | Selected design-tool workflows can round-trip supported semantics as provenance-rich import proposals without making design-tool files authoritative. |
| `SCOPE-OUTCOME-008` | `admitted` | Repeated synthesis and transformation tasks can justify narrowly owned promptable semantics without creating a parallel interpretation ontology. |

## Primary users and jobs

| Scope ID | User | Core job |
| --- | --- | --- |
| `SCOPE-USER-001` | Framework-free web consumer | Install Core UI, retrieve compatible HTML/CSS/JS guidance, implement accessible UI, and validate supported source without adopting React. |
| `SCOPE-USER-002` | React consumer | Use typed React bindings that preserve the applicable Core web styling and observable semantics without learning a second visual system. |
| `SCOPE-USER-003` | React Native consumer | Use platform-appropriate native components, tokens, accessibility obligations, and alternatives without importing CSS or DOM assumptions. |
| `SCOPE-USER-004` | Product engineer working with an agent | Give intent, let the agent discover exact capabilities and examples, generate compatible code, validate it, and repair it from structured diagnostics. |
| `SCOPE-USER-005` | Design-system maintainer | Author one canonical fact, see its semantic and compatibility effects, implement affected bindings, and produce the required evidence without repairing projections manually. |
| `SCOPE-USER-006` | Release and evidence steward | Verify package/catalog identity, compatibility, support claims, evidence retention, advisories, exceptions, and rollback before publication. |
| `SCOPE-USER-007` | Documentation consumer | Read human-oriented guidance generated from the same catalog responses and canonical guides available to agents. |
| `SCOPE-USER-008` | Future adapter author | Add a demanded framework, design-tool, protocol, or extension only through an admitted binding/capability that cannot fork Core UI truth. |

## Product boundary

### In scope

- Canonical component, pattern, token, foundation, guide, example, pitfall,
  migration, and capability knowledge.
- First-party framework-free web, React web, and React Native renderer products.
- A first-party default theme with deterministic web and native transforms.
- A compiled catalog and pure query engine.
- CLI-as-documentation with human, dense, and JSON output.
- Installed-local compatibility resolution and bounded validation.
- Documentation, explorer, local MCP, and small static-agent projections.
- Deterministic proof, retained evidence, compatibility, lifecycle, migrations,
  and release identity.
- Maintainer authoring workflows and bounded, explicitly approved project or
  canonical operations when their capabilities are enabled.
- Independently admitted later capabilities that preserve kernel authority.

### Permanently outside the product boundary

| Scope ID | State | Exclusion |
| --- | --- | --- |
| `SCOPE-NONGOAL-001` | `rejected` | React source, stories, the website, MCP, or design-tool files as the canonical component inventory. |
| `SCOPE-NONGOAL-002` | `rejected` | A shared renderer implementation that forces DOM, CSS, web focus, portal, navigation, or transition behavior onto native platforms. |
| `SCOPE-NONGOAL-003` | `rejected` | A second documentation, search, example, or component registry owned by an adapter or application. |
| `SCOPE-NONGOAL-004` | `rejected` | Silent fallback to hosted latest, ancestor packages, a highest-compatible catalog, or an undeclared cache for project guidance. |
| `SCOPE-NONGOAL-005` | `rejected` | Generated projections repaired directly or accepted as independent authoring inputs. |
| `SCOPE-NONGOAL-006` | `rejected` | Arbitrary LLM-generated repository, consumer-project, migration, or design-tool patches. |
| `SCOPE-NONGOAL-007` | `rejected` | A universal prompt-only design-intent object, free-standing interpretation graph, or model-selected example ranking. |
| `SCOPE-NONGOAL-008` | `rejected` | Application-owned routes, navigation flows, business state, analytics, product content, or screen-specific logic represented as Core UI truth. |
| `SCOPE-NONGOAL-009` | `rejected` | A static full-catalog context file as the primary agent interface. |
| `SCOPE-NONGOAL-010` | `rejected` | Multi-framework abstraction before a second demanded framework binding proves repeated shape. |
| `SCOPE-NONGOAL-011` | `rejected` | Hosted execution of consumer code, project mutation, migration, extensions, or local-filesystem diagnostics. |
| `SCOPE-NONGOAL-012` | `rejected` | Component-count growth as a substitute for workflow value, platform honesty, accessibility, compatibility, or proof. |

## Release portfolio

### Foundation boundary

Gate 0 is a committed internal foundation, not a component-library release.

| Scope ID | Commitment | Product deliverable | Roadmap |
| --- | --- | --- | --- |
| `SCOPE-FOUNDATION-001` | `committed` | Predictable repository topology, ownership boundaries, task graph, navigation, and generated-file policy. | G0.0 |
| `SCOPE-FOUNDATION-002` | `committed` | Closed source/response schemas, stable identities, field ownership, relations, lifecycle/strategy, and revision semantics. | G0.1 |
| `SCOPE-FOUNDATION-003` | `committed` | Deterministic catalog compiler, relation graph, search index, digest, and pure query kernel. | G0.2 |
| `SCOPE-FOUNDATION-004` | `committed` | Self-describing CLI documentation baseline with `manifest`, `list`, `search`, and `get`. | G0.3 |
| `SCOPE-FOUNDATION-005` | `committed` | Exact project-local catalog package and deterministic resolver with typed failure taxonomy. | G0.4 |
| `SCOPE-FOUNDATION-006` | `committed` | Schema-aware scaffold, source-linked diagnostics, semantic diff, revision explainer, and affected-closure view. | G0.5 |

Foundation completion does not advertise component breadth, public MCP, a
documentation application, consumer mutation, composition planning, migration,
hosted services, design-tool integration, or another framework.

### `0.1` prerelease boundary

The `0.1` product commitment is the complete fixed Gate 1 matrix. No later
component or integration can substitute for a missing cell.

| Scope ID | Commitment | Item | Product outcome | Roadmap |
| --- | --- | --- | --- | --- |
| `SCOPE-COMP-BUTTON` | `committed` | Button | Immediate-action semantics, pending/disabled behavior, naming, direct bindings, and complete addition workflow. | G1.3 |
| `SCOPE-COMP-TEXTFIELD` | `committed` | TextField | Value ownership, controlled/uncontrolled behavior, validation, labels, descriptions, errors, and form relations. | G1.4 |
| `SCOPE-COMP-SWITCH` | `committed` | Switch | Boolean state, groups, native-control semantics, and distinction from Checkbox and Button. | G1.5 |
| `SCOPE-COMP-DIALOG` | `committed` | Dialog | Composite overlay ownership, focus/dismissal, global-effect cleanup, native adaptation, and retained manual accessibility evidence. | G1.6 |
| `SCOPE-COMP-SELECT` | `committed` | Select | Complex web selection behavior and explicit native-alternative picker strategy. | G1.7 |
| `SCOPE-PATTERN-FORM` | `committed` | Form pattern | Bounded composition, validation, submission, deterministic examples, and grounded planning inputs without a public planner. | G1.8 |

#### `0.1` platform matrix

| Item | `web.html` | `web.react` | iOS | Android | React Native Web |
| --- | --- | --- | --- | --- | --- |
| Button | Implemented `direct` | Implemented `direct` | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Explicit strategy; evidence if implemented |
| TextField | Implemented `direct` | Implemented `direct` | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Explicit strategy; evidence if implemented |
| Switch | Implemented `direct` | Implemented `direct` | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Explicit strategy; evidence if implemented |
| Dialog | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Proved `adapted` or `native-alternative` | Proved `adapted` or `native-alternative` | Explicit strategy; evidence if implemented |
| Select | Implemented `direct` or `adapted` | Implemented `direct` or `adapted` | Proved `native-alternative` | Proved `native-alternative` | Explicit strategy; evidence if implemented |
| Form pattern | Applicable composition and example | Applicable composition and example | Applicable composition and example | Applicable composition and example | Explicit applicability/disposition |

An `unsupported` disposition can satisfy only a cell asking for an explicit
strategy. It cannot satisfy an `Implemented` or `Proved` cell.

#### Shared `0.1` deliverable contract

Every committed component supplies:

- one concept record with intent, anatomy, states, accessibility obligations,
  lifecycle, risk class, alternatives, and bounded decision context where
  useful;
- binding specs for framework-free web, React web, and React Native plus a
  React Native Web runtime-profile disposition;
- a canonical token recipe and compiled requirement-set digest;
- structured pitfalls and typed repair guidance for known misuse;
- one normative executable example for every implemented target and an
  alternative example where `native-alternative` applies;
- implementation or an explicitly permitted target disposition;
- actual packed exports and compatibility descriptors;
- risk-proportionate behavior, accessibility, visual, package, and surface-
  parity evidence; and
- a semantic diff and read-only change-intent preview for a representative
  public change.

The `0.1` boundary also commits:

| Scope ID | Commitment | Deliverable | Roadmap |
| --- | --- | --- | --- |
| `SCOPE-SYSTEM-TOKENS` | `committed` | Minimum token, default-theme, target-transform, fallback, requirement-set, and override system needed by the fixed slices. | G1.0 |
| `SCOPE-SYSTEM-WEB` | `committed` | Framework-free CSS/HTML/JS substrate and React binding substrate with explicit runtime ownership. | G1.1 |
| `SCOPE-SYSTEM-NATIVE` | `committed` | Native substrate, iOS/Android behavior, native token output, and explicit React Native Web profile semantics. | G1.2 |
| `SCOPE-SYSTEM-CURRICULUM` | `committed` | Deterministic example selection by compatibility, binding/profile, purpose, prerequisites, preference, and complexity. | G1.3–G1.8 |
| `SCOPE-SYSTEM-PROOF` | `committed` | One reproducible `0.1` release manifest and complete fixed-matrix proof/evidence view. | G1.9 |
| `SCOPE-SYSTEM-VALIDATE-SOURCE` | `committed` | `core validate` for Core UI-owned catalog and canonical example sources only. | G1.9 |
| `SCOPE-SYSTEM-MCP-PROBE` | `committed` | Internal local MCP parity probe; not yet a public product. | G1.9 |
| `SCOPE-SYSTEM-AGENT-BASELINE` | `committed` | Informational cold-start and generation evaluations tied to canonical IDs. | G1.9 |

### Post-`0.1` renderer proof extension

Tabs and Toast are committed after Gate 1 and before broad component-family
expansion. They do not block unrelated package, resolver, or documentation
productization.

| Scope ID | Commitment | Item | Product outcome | Roadmap |
| --- | --- | --- | --- | --- |
| `SCOPE-COMP-TABS` | `committed` | Tabs | Keyboard/orientation/layout state, focus versus selection ownership, panels, direction, and honest native disposition. | G2.0 |
| `SCOPE-COMP-TOAST` | `committed` | Toast | Provider/host ownership, transactions, ordering, timers, interruption, announcements, teardown, and concurrent producers. | G2.0 |

### Productization boundary

The minimum Gate 2 productization release commits G2.1, G2.2, G2.3, and G2.7.
G2.4 through G2.6 are admitted product capabilities but may remain disabled in
a particular release when their own exit evidence is incomplete. Disabled
capabilities must be absent or explicitly unavailable in every manifest and
surface.

| Scope ID | Commitment | Product deliverable | Roadmap |
| --- | --- | --- | --- |
| `SCOPE-PRODUCT-001` | `committed` | Publishable public packages, packed compatibility descriptors, version policy, historical catalogs, and verifiable release manifests. | G2.1 |
| `SCOPE-PRODUCT-002` | `committed` | Official install profiles, real packed project-local resolution, offline guidance, and bounded consumer validation. | G2.2 |
| `SCOPE-PRODUCT-003` | `committed` | Documentation site, web/native explorers, small agent bootstrap files, and public installed-local MCP projections. | G2.3 |
| `SCOPE-PRODUCT-004` | `admitted` | Grounded read-only `core plan` over stable bounded patterns. | G2.4 |
| `SCOPE-PRODUCT-005` | `admitted` | Read-only `core doctor` and safe, previewed, confirmed, journalled `core init`. | G2.5 |
| `SCOPE-PRODUCT-006` | `admitted` | Four allowlisted agent-safe canonical proposal operations. | G2.6 |
| `SCOPE-PRODUCT-007` | `committed` | Productization release manifest, capability manifest, evidence index, install/rollback proof, and honest disabled-capability reporting. | G2.7 |

## Platform scope

| Scope ID | Commitment | Platform/binding | Product commitment |
| --- | --- | --- | --- |
| `SCOPE-PLATFORM-WEB-HTML` | `committed` | `web.html` | First-class HTML binding spec, CSS, semantic markup, progressive enhancement, and optional explicitly imported vanilla controllers. |
| `SCOPE-PLATFORM-WEB-REACT` | `committed` | `web.react` | First-class typed React bindings using the Core web styling source and preserving applicable observable web semantics. |
| `SCOPE-PLATFORM-NATIVE-RN` | `committed` | `native.react-native` | First-class React Native renderer using native primitives and platform-appropriate bindings. |
| `SCOPE-PROFILE-IOS` | `committed` | iOS | Explicit validation profile, lifecycle/strategy, native evidence, and adaptations. |
| `SCOPE-PROFILE-ANDROID` | `committed` | Android | Explicit validation profile, lifecycle/strategy, native evidence, and adaptations. |
| `SCOPE-PROFILE-RNW` | `committed` | React Native Web | Every native binding declares a strategy; implementation is required only where a scope matrix says so. It is never assumed equivalent to `web.react`. |
| `SCOPE-PLATFORM-FUTURE-WEB` | `deferred` | One additional web framework | Added only after demonstrated demand against stable web binding and styling contracts. |

Semantic parity means shared intent, applicable states, tokens, and
accessibility obligations. It does not promise identical props, anatomy,
transitions, events, focus behavior, or implementation across platforms.

## Component and public API scope

| Scope ID | Commitment | Public requirement |
| --- | --- | --- |
| `SCOPE-API-NAMING` | `committed` | One preferred public concept name and consistent semantic state/variant names; convenience aliases and stringly typed modes are exceptional. |
| `SCOPE-API-DEFAULTS` | `committed` | Defaults are finite, deterministic, and present in the binding spec, query response, generated types where applicable, and canonical executable examples. |
| `SCOPE-API-BINDING` | `committed` | Each binding owns its exact Core UI props/attributes, events, slots/parts, defaults, behavior, deviations, validation profile, and example relations. |
| `SCOPE-API-COMPOSITION` | `committed` | Compound components expose explicit named parts, allowed parent/child relations, required labels/providers, and mutually exclusive structures without magical child inspection. |
| `SCOPE-API-WEB-HOOKS` | `committed` | Public web root classes, semantic slots, state attributes, events, custom properties, and cascade layers are enumerated; undocumented topology stays internal. |
| `SCOPE-API-REACT-ERGONOMICS` | `committed` | React owns typed composition, refs, state, effects, portals, and host-type refinements while preserving applicable web styles and observable semantics. |
| `SCOPE-API-NATIVE-ERGONOMICS` | `committed` | Native bindings may use platform-appropriate APIs and alternatives while preserving shared intent, tokens, applicable states, and accessibility obligations. |
| `SCOPE-API-PASSTHROUGH` | `committed` | Renderer host passthrough uses named supported profiles and hand-authored type refinements; it cannot introduce undocumented Core UI semantics. |
| `SCOPE-API-ESCAPE-HATCH` | `committed` | Every styling, validation, suppression, or composition escape hatch is named, typed, bounded, documented, and excluded from canonical defaults. |
| `SCOPE-API-RUNTIME-OWNERSHIP` | `committed` | Controllers, adapters, providers, focus restoration, dismissal, portals, global listeners, inert/background state, and scroll locks have one explicit lifecycle owner. |
| `SCOPE-API-A11Y` | `committed` | Accessible naming, roles, states, values, relationships, keyboard/input behavior, announcements, and platform deviations are binding obligations with risk-proportionate proof. |
| `SCOPE-API-DEPRECATION` | `committed` | Deprecation names a replacement or explicit no-replacement reason, notice window, version effect, retained retrieval, diagnostic, and migration path where applicable. |

Generated Core-owned types may represent serializable binding fields. Renderer
source remains responsible for host-language inference, generic constraints,
refs, narrowed events, and platform-owned props, with conformance checks
preventing those refinements from becoming undocumented product API.

## Canonical knowledge scope

| Scope ID | Commitment | Kind | Initial product scope |
| --- | --- | --- | --- |
| `SCOPE-KIND-COMPONENT` | `committed` | `component` | Shared concept semantics plus explicit platform binding specs and runtime-profile dispositions. |
| `SCOPE-KIND-PATTERN` | `committed` | `pattern` | Bounded composition with roles, relations, parameters, constraints, examples, alternatives, pitfalls, and unsupported cases. |
| `SCOPE-KIND-TOKEN` | `committed` | `token` | Addressable token sets and values with typed layers, modes, aliases, requirements, transforms, fallbacks, and override policies. |
| `SCOPE-KIND-FOUNDATION` | `committed` | `foundation` | Shared semantics, pure logic, and only evidence-backed optional portable interaction. |
| `SCOPE-KIND-GUIDE` | `committed` | `guide` | Portable Markdown guidance with strict identity/frontmatter and optional bounded decision context. |
| `SCOPE-KIND-EXAMPLE` | `committed` | `example` | Selection metadata plus exactly one executable source owner; normative/editorial impact is explicit. |
| `SCOPE-KIND-PITFALL` | `committed` | `pitfall` | Structured misuse, consequence, affected binding, and exact repair guidance. |
| `SCOPE-KIND-MIGRATION` | `deferred` | `migration` | Version-bounded migration knowledge activated only for a real supported change. |
| `SCOPE-KIND-CAPABILITY` | `committed` | `capability` | Exact surface availability, operation policy, schemas, and version context. |

All kinds share stable discovery and typed relations but retain dedicated
schemas and owners. A new kind requires an observed workflow that existing
records and relations cannot represent.

## Guidance and documentation scope

The CLI remains the primary documentation API. Narrative guides supplement
structured records; they do not duplicate API, variant, default, token,
example, compatibility, or lifecycle facts.

| Scope ID | Commitment | Guidance family | Boundary |
| --- | --- | --- | --- |
| `SCOPE-GUIDE-DISCOVERY` | `committed` | Discovery and installed authority | Manifest-first workflow, exact local catalog resolution, output modes, follow-up commands, and advisory-hosted distinction. |
| `SCOPE-GUIDE-AUTHORING` | `committed` | Maintainer authoring | Canonical ownership, scaffolding, semantic diff, affected closure, revision explanations, generation, validation, and proof workflow. |
| `SCOPE-GUIDE-THEMING` | `committed` | Tokens and theming | Token layers, modes, transforms, requirements, fallbacks, override policy, static output, runtime switching, and accessibility adaptations. |
| `SCOPE-GUIDE-ACCESSIBILITY` | `committed` | Accessibility | Shared obligations, platform fulfillment, interaction risk classes, required evidence, and unsupported claims. |
| `SCOPE-GUIDE-COMPOSITION` | `committed` | Composition and patterns | Explicit parts/relations, canonical examples, bounded patterns, unsupported planning requests, and consumer boundaries. |
| `SCOPE-GUIDE-PLATFORMS` | `committed` | Multi-platform strategy | Semantic parity versus binding conformance, web/React ownership, native alternatives, and runtime-profile dispositions. |
| `SCOPE-GUIDE-LIFECYCLE` | `committed` | Lifecycle, compatibility, and releases | Lifecycle/strategy, revisions, SemVer effects, installed tuple, evidence status, advisories, exceptions, and deprecation. |
| `SCOPE-GUIDE-MIGRATION` | `deferred` | Migration | Published only when a real migration capability and version-bounded migration record exist. |

Every guide has one stable artifact ID, summary, keywords, platform scope,
lifecycle, relationships, and canonical source returned by CLI and rendered by
the site.

## Public package scope

| Scope ID | Commitment | Package | Public responsibility | Must not own |
| --- | --- | --- | --- | --- |
| `SCOPE-PKG-SCHEMA` | `committed` | `@core-ui/schema` | Versioned source/response schemas, generated types, platform IDs, and authoring helpers. | Product semantics, renderer implementation, or site content. |
| `SCOPE-PKG-TOKENS` | `committed` | `@core-ui/tokens` | Canonical token data and deterministic web/native/design-tool transforms. | Component behavior or documentation rendering. |
| `SCOPE-PKG-FOUNDATION` | `committed` | `@core-ui/foundation` | Enforced semantic, pure-logic, and optional portable-interaction boundaries. | Selectors, React hooks, browser globals, native views, or mandatory transitions. |
| `SCOPE-PKG-WEB` | `committed` | `@core-ui/web` | HTML binding specs, CSS, themes, optional vanilla controllers, and web entry points. | React or native implementation. |
| `SCOPE-PKG-REACT` | `committed` | `@core-ui/react` | React bindings preserving applicable web semantics, styles, and observable hooks while owning React ergonomics. | Canonical component metadata or copied CSS. |
| `SCOPE-PKG-REACT-NATIVE` | `committed` | `@core-ui/react-native` | Native components, explicit platform files, native accessibility, gestures, and responder behavior. | CSS parsing, DOM, Expo, or explorer hosts. |
| `SCOPE-PKG-CATALOG` | `committed` | `@core-ui/catalog` | Immutable compiled catalog, search index, pure discovery/query/planning API, and package-level catalog identity. | CLI parsing, MCP transport, renderer runtime, or project mutation. |
| `SCOPE-PKG-TOOLING` | `committed` | `@core-ui/tooling` | CLI, adapters, local resolver/validation, maintainer authoring, change-intent previews, and enabled safe operations. | A second artifact index, product decisions, or renderer implementation. |

Renderer packages do not depend on the catalog at runtime. Official consumer
profiles install compatible renderer packages plus project-local catalog and
tooling development dependencies.

## Product surfaces and command scope

### Query and documentation surfaces

| Scope ID | Commitment | Surface | Earliest boundary | Product contract |
| --- | --- | --- | --- | --- |
| `SCOPE-SURFACE-API` | `committed` | Programmatic catalog API | Foundation | Pure manifest/list/search/get; planning only when enabled. |
| `SCOPE-SURFACE-CLI` | `committed` | CLI human/JSON/dense | Foundation | Primary documentation interface over the same response object. |
| `SCOPE-SURFACE-SITE` | `committed` | Documentation site | Productization | Catalog client rendering canonical records and guide sources. |
| `SCOPE-SURFACE-EXPLORER-WEB` | `committed` | Web/React explorer | Productization | Generated adapters over canonical executable examples. |
| `SCOPE-SURFACE-EXPLORER-NATIVE` | `committed` | Native explorer host | Productization | Expo/native host used outside runtime packages. |
| `SCOPE-SURFACE-BOOTSTRAP` | `committed` | Small static agent context | Productization | Route map and discovery loop, never a manually maintained catalog dump. |
| `SCOPE-SURFACE-MCP-LOCAL` | `committed` | Installed local MCP | Productization | Search/get and only enabled read-only capabilities over the shared query engine. |
| `SCOPE-SURFACE-MCP-HOSTED` | `deferred` | Hosted MCP | Capability release | Read-only advisory/target-tuple-aware discovery with failure isolation. |

### Command availability

| Scope ID | Commitment | Command | Earliest boundary | Availability rule |
| --- | --- | --- | --- | --- |
| `SCOPE-CMD-MANIFEST` | `committed` | `core manifest` | Foundation | Cold-start capability, schema, grammar, platform, output, and version discovery. |
| `SCOPE-CMD-LIST` | `committed` | `core list` | Foundation | Bounded deterministic artifact listing. |
| `SCOPE-CMD-SEARCH` | `committed` | `core search` | Foundation | Deterministic explainable local search with match reasons. |
| `SCOPE-CMD-GET` | `committed` | `core get` | Foundation | Exact artifact/binding/example/guidance retrieval with compatibility provenance. |
| `SCOPE-CMD-VALIDATE-SOURCE` | `committed` | `core validate` | `0.1` | Core UI-owned catalog/example validation first. |
| `SCOPE-CMD-VALIDATE-CONSUMER` | `committed` | `core validate` | Productization | Bounded supported consumer syntax/version analysis with false-positive policy. |
| `SCOPE-CMD-PLAN` | `admitted` | `core plan` | Productization | Read-only grounded composition over proved patterns; unavailable until G2.4. |
| `SCOPE-CMD-DOCTOR` | `admitted` | `core doctor` | Productization | Read-only project health before any setup operation; unavailable until G2.5. |
| `SCOPE-CMD-INIT` | `admitted` | `core init` | Productization | Previewed, confirmed, confined, atomic/journalled, idempotent, recoverable setup. |
| `SCOPE-CMD-MIGRATE` | `deferred` | `core migrate` | Capability release | Enabled only for a real version-bounded deterministic migration need. |

Every enabled query supports the applicable platform, detail, section,
example-purpose, limit, and cursor selectors. JSON writes one value to stdout;
diagnostics and progress use stderr. Dense output is deterministic,
section-selectable, token-budgeted, and round-trippable to the response object.

## Token and theme scope

| Scope ID | Commitment | Deliverable | Boundary |
| --- | --- | --- | --- |
| `SCOPE-THEME-DEFAULT` | `committed` | First-party brand-agnostic default theme | `0.1` |
| `SCOPE-TOKEN-LAYERS` | `committed` | Reference, semantic, and component token layers with acyclic allowed alias direction | `0.1` |
| `SCOPE-TOKEN-MODES` | `committed` | Applicable typed color-scheme, contrast, motion, density, and direction axes | `0.1` |
| `SCOPE-TOKEN-TRANSFORMS` | `committed` | Static web CSS and native theme-object transforms from canonical token sources | `0.1` |
| `SCOPE-TOKEN-REQUIREMENTS` | `committed` | Binding-specific required/optional/deprecated token requirement sets and digests | `0.1` |
| `SCOPE-TOKEN-FALLBACKS` | `committed` | Explicit typed fallback value/token policy with profile proof and structured diagnostics | `0.1` |
| `SCOPE-TOKEN-OVERRIDES` | `committed` | `fixed`, `theme`, and `instance` override policies with consumer-theme validation | `0.1` |
| `SCOPE-THEME-ACCESSIBILITY` | `committed` | Forced-colors/high-contrast web policy and native dynamic-color/accessibility mappings that consumers cannot disable | `0.1` |
| `SCOPE-THEME-RUNTIME` | `admitted` | Runtime theme switching per explicitly supported/proved profile; complete static output remains mandatory | Productization or capability release |
| `SCOPE-THEME-ADDITIONAL` | `deferred` | Additional first-party or consumer themes | Capability release after stable token contract |
| `SCOPE-DESIGN-TOOL` | `admitted` | One named design-tool interchange profile and proposal-only round-trip | Capability release through G3.5 |

CSS-derived values never become native authority. Consumer themes can assign
only permitted existing roles and cannot change Core token identity, type,
meaning, required modes, or canonical alias topology.

## Maintainer and agent-safe authoring scope

### Maintainer baseline

| Scope ID | Commitment | Capability | Boundary |
| --- | --- | --- | --- |
| `SCOPE-AUTHOR-SCAFFOLD` | `committed` | Schema-aware canonical scaffold that never invents product decisions or writes projections | Foundation |
| `SCOPE-AUTHOR-DIAGNOSTICS` | `committed` | Source-linked stable rule IDs naming the earliest editable owner | Foundation |
| `SCOPE-AUTHOR-DIFF` | `committed` | Semantic diff distinguishing editorial, compatible, and incompatible change | Foundation |
| `SCOPE-AUTHOR-REVISION` | `committed` | Revision explainer for content, binding-spec, token requirement, and release digest inputs | Foundation |
| `SCOPE-AUTHOR-CLOSURE` | `committed` | Affected closure over canonical sources, renderers, projections, proof, packages, and evaluations | `0.1` |
| `SCOPE-AUTHOR-CHANGE-INTENT` | `committed` | Read-only `ChangeIntentEnvelope` with base, objective, write set, invalidation, version/proof effects, readiness, and confirmation policy | `0.1` |
| `SCOPE-AUTHOR-AUTOFIX` | `committed` | Preview-only semantics-preserving mechanical autofixes | Foundation |

### Initial allowlisted canonical proposals

The following are admitted for G2.6. They are not available until their closed
schemas, review packets, negative boundaries, digest-bound approval, apply,
recovery, and evidence pass.

| Scope ID | Commitment | Operation | Canonical owner |
| --- | --- | --- | --- |
| `SCOPE-PROPOSAL-EXAMPLE` | `admitted` | `example.create` | Example record/source and binding relation |
| `SCOPE-PROPOSAL-VARIANT` | `admitted` | `binding.variant.add` | Binding spec |
| `SCOPE-PROPOSAL-DEPRECATE` | `admitted` | `binding.prop.deprecate` | Binding lifecycle/migration data |
| `SCOPE-PROPOSAL-TOKEN-ALIAS` | `admitted` | `token.alias.propose` | Canonical token source |

Free-form patch requests, model-authored product decisions, automatic stable
promotion, automatic exception creation, write-set expansion, and unconfirmed
apply are rejected. Renderer implementation work can be identified by a
proposal but is not proved merely because canonical changes were approved.

## Compatibility, quality, and trust scope

### Committed proof layers

| Scope ID | Commitment | Proof area | Product claim |
| --- | --- | --- | --- |
| `SCOPE-PROOF-SCHEMA` | `committed` | Schema and relations | Records are closed, versioned, uniquely identified, owned, and relationally complete. |
| `SCOPE-PROOF-CONFORMANCE` | `committed` | Spec/code/export/token conformance | Generated types, renderer refinements, exports, CSS hooks, examples, and declarations match canonical specs. |
| `SCOPE-PROOF-BEHAVIOR` | `committed` | Unit, state, browser, and native behavior | Implementations satisfy binding transitions, runtime ownership, SSR/hydration, input, focus, and platform behavior. |
| `SCOPE-PROOF-A11Y` | `committed` | Accessibility | Automated and risk-proportionate retained manual evidence supports every stable interaction/profile claim. |
| `SCOPE-PROOF-VISUAL` | `committed` | Visual | Canonical examples are checked across applicable themes, modes, density, direction, and platforms. |
| `SCOPE-PROOF-PACKAGE` | `committed` | Packed consumers | Published artifacts resolve declared exports, types, styles, assets, descriptors, and engines. |
| `SCOPE-PROOF-PARITY` | `committed` | Surface parity | API, CLI, dense, MCP, site, explorer, and static projections agree where enabled. |
| `SCOPE-PROOF-GENERATION` | `committed` | Generation identity | Clean repeated builds produce the same catalog and release digests. |
| `SCOPE-PROOF-AGENT-INFO` | `committed` | Informational agent evaluations | Cold-start and generation evidence begins with Gate 1 and remains subordinate to deterministic proof. |
| `SCOPE-PROOF-AGENT-GATE` | `admitted` | Release-gating agent evaluations | Only selected metrics with repeated baselines, fixed thresholds, variance policy, and failure ownership can graduate through G3.4. |

### Cross-cutting product commitments

These requirements are mandatory even where the roadmap currently expresses
them only through a global cadence or an implicit assertion. They require exact
roadmap evidence ownership before the affected milestone becomes `ready`.

| Scope ID | Commitment | Requirement | Earliest proof boundary |
| --- | --- | --- | --- |
| `SCOPE-QUALITY-COMPAT-PROFILE` | `committed` | One versioned compatibility/evidence artifact covering exact browser, React/React Native, OS, device, assistive-technology, input, locale, direction, zoom, contrast, and motion support. | `0.1` claims, complete for stable productization |
| `SCOPE-QUALITY-GENERATOR-CONTRACT` | `committed` | Every generator supports `--check`, stable ordering, no wall-clock canonical-preimage fields, and owner-linked drift diagnostics. | Foundation and every later generator activation |
| `SCOPE-QUALITY-PERFORMANCE` | `committed` | Versioned performance policy, representative renderer/query/package baselines, predeclared regression budgets, and scheduled retained evidence. | Baseline by `0.1`; stable policy before stable productization |
| `SCOPE-TRUST-CACHE-PROVENANCE` | `committed` | Explicitly downloaded catalogs are content-addressed, signature or provenance verified, digest-isolated, and rejected when verification fails. | Foundation synthetic proof; real packed proof at productization |
| `SCOPE-TRUST-EVIDENCE-PRIVACY` | `committed` | Consumer code, prompts, screens, and traces are not collected by default; capture requires explicit scope, consent, redaction, disclosure class, and retention policy. | Before any evidence or evaluation capture involving consumer context |
| `SCOPE-THEME-PLATFORM-SAFETY` | `committed` | Default-theme forced-colors, high-contrast, dynamic native color, font metrics, direction, and applicable accessibility adaptations are binding-owned and cannot be disabled by consumer values. | `0.1` per supported profile |

### Evidence and release trust

| Scope ID | Commitment | Deliverable |
| --- | --- | --- |
| `SCOPE-TRUST-EVIDENCE` | `committed` | Immutable evidence records tied to exact source, artifact, binding, package, catalog, environment, input, result, retention, and owner identity. |
| `SCOPE-TRUST-DISCLOSURE` | `committed` | Public reproducibility, internal CI, restricted audit, and transient disclosure classes with sanitized public metadata. |
| `SCOPE-TRUST-ADVISORY` | `committed` | Signed append-only evidence advisories for supersession or withdrawal without rewriting historical evidence. |
| `SCOPE-TRUST-EXCEPTION` | `committed` | Scoped, approved, expiring operational exceptions that only narrow claims or defer explicitly waivable obligations. |
| `SCOPE-TRUST-RELEASE` | `committed` | Immutable release manifest correlating package, catalog, schema, token, query, binding, evidence, provenance, profile, and active-exception identity. |
| `SCOPE-TRUST-HISTORY` | `committed` | Historical compatible catalogs, binding specs, migrations, evidence, advisories, and release identities remain retrievable for supported windows. |

No exception may patch a projection, broaden support, bypass integrity, create
proof, suppress mandatory accessibility/safety evidence, or authorize an
unconfirmed mutation.

## Conditional capability portfolio

Gate 3 is not a monolithic commitment. Each scope item remains unavailable
until its activation conditions and evidence pass. An item can close with an
explicit no-activation decision without making Core UI incomplete.

| Scope ID | State | Capability | Activation trigger | Roadmap |
| --- | --- | --- | --- | --- |
| `SCOPE-CAP-BREADTH` | `admitted` | Deliberate component and pattern breadth | Gate 2 plus Tabs/Toast for comparable risk; every candidate has observed workflow demand, owner, platform disposition, risk class, and proof path. | G3.1 |
| `SCOPE-CAP-MIGRATION` | `deferred` | Declarative migrations and reviewed codemods | A real version-bounded supported migration need with retrievable old/new specs and bounded transformation. | G3.2 |
| `SCOPE-CAP-MCP-HOSTED` | `deferred` | Read-only hosted MCP | Stable query/compatibility policy plus privacy, security, availability, cache isolation, and failure separation. | G3.3 |
| `SCOPE-CAP-AGENT-GATES` | `admitted` | Promote selected agent evaluations | Repeated baseline, predeclared threshold/variance/retry policy, canonical prompt IDs, and a failure owner. | G3.4 |
| `SCOPE-CAP-DESIGN-TOOL` | `admitted` | Additional themes and one named design-tool interchange | Stable identities across a real release, observed workflow, export proof, loss policy, and proposal-only imports. | G3.5 |
| `SCOPE-CAP-PROMPT-SEMANTICS` | `admitted` | Promptable-semantics discovery | Privacy-safe task corpus and baseline over existing tokens, variants, patterns, decision context, and examples. Activation of any field remains separately admitted. | G3.6 |
| `SCOPE-CAP-EXTENSIONS` | `deferred` | Extension or consumer-overlay trust model | Observed demand plus threat model, namespace, integrity, permission, confinement, timeout, revocation, and compatibility proof. | G3.7 |
| `SCOPE-CAP-HIGHER-ORDER` | `deferred` | Page, flow, journey, or other higher-order artifact kind | Repeated unsupported design-system-owned workflows prove patterns/guides insufficient and full ontology admission passes. | G3.8 |
| `SCOPE-CAP-FRAMEWORK` | `deferred` | One additional framework binding | Demonstrated demand and conformance to stable web HTML/CSS/controller contracts. | G3.9 |
| `SCOPE-CAP-A2UI` | `deferred` | Agent-to-UI protocol binding | Named protocol/workflow and proof that it remains an optional compatibility-aware adapter. | G3.10 |
| `SCOPE-CAP-CONSUMER-PATTERN` | `deferred` | Consumer pattern validation and pattern-derived scaffolds | Stable planner, observed demand, maintained parser/version boundaries, precision/recall budget, and safe write preview. | G3.11 |

### Component and pattern breadth admission

`SCOPE-CAP-BREADTH` does not commit an unnamed component inventory. Each future
item must enter this document with its own scope ID before implementation and
record:

- the user workflow and unmet intent;
- component versus pattern ownership;
- platform target/disposition matrix;
- interaction risk class and evidence requirements;
- canonical example and pitfall needs;
- required token/foundation/runtime changes;
- package, compatibility, query, and migration effects;
- expected effect on discovery precision, dense budgets, package policy,
  maintainer throughput, and agent generation; and
- explicit non-goals.

Raw component count is never a scope objective.

## Roadmap alignment and reconciliation

| Product-scope family | Roadmap realization |
| --- | --- |
| Foundation, canonical knowledge, CLI baseline, local resolver, and maintainer authoring | G0.0–G0.5 and the Gate 0 integration exit |
| Default tokens/theme and web/React/native substrates | G1.0–G1.2 |
| `0.1` components, Form pattern, examples, proof, source validation, and internal MCP | G1.3–G1.9 and the Gate 1 integration exit |
| Tabs and Toast proof extension | G2.0 |
| Public packages, descriptors, compatibility, releases, and historical catalogs | G2.1 |
| Consumer installation, local authority, and bounded validation | G2.2 |
| Site, explorers, static bootstrap, guides, and public installed-local MCP | G2.3 |
| Grounded composition planning | G2.4 when enabled |
| Project health and initialization | G2.5 when enabled |
| Allowlisted canonical proposals | G2.6 when enabled |
| Productization release and capability honesty | G2.7 |
| Conditional breadth, migration, hosted MCP, model-evaluation gates, themes/design-tool interchange, promptable semantics, extensions, higher-order artifacts, frameworks, agent-to-UI, and consumer-pattern tooling | G3.1–G3.11 independently |

Before the affected milestone becomes `ready`, the roadmap must assign explicit
deliverables and evidence IDs to these architecture-derived product
commitments that are currently expressed mainly through global or implicit
rules:

| Scope item | Required roadmap placement |
| --- | --- |
| Compatibility/evidence profile (`SCOPE-QUALITY-COMPAT-PROFILE`) | G1.9 creates the tested profile; G2.1/G2.7 publish and enforce the stable compatibility artifact. |
| Generator contract (`SCOPE-QUALITY-GENERATOR-CONTRACT`) | G0.0/G0.2 establish the contract; every later generator-owning milestone inherits a release-blocking fixture. |
| Performance policy (`SCOPE-QUALITY-PERFORMANCE`) | G1.9 captures representative baselines; G2.7 owns stable policy; G3.1 guards breadth regressions. |
| Cached-catalog provenance (`SCOPE-TRUST-CACHE-PROVENANCE`) | G0.4 proves synthetic verification and rejection; G2.1/G2.2 prove real packed/cached catalogs. |
| Evidence-capture privacy (`SCOPE-TRUST-EVIDENCE-PRIVACY`) | G1.9 evidence policy and every evaluation/integration capture milestone enforce default-off collection and consent/redaction. |
| Platform theme safety (`SCOPE-THEME-PLATFORM-SAFETY`) | G1.0 and affected Gate 1 slices prove default-theme platform safety; G3.5 extends the same rule to additional themes. |

No tracker issue can substitute for this roadmap reconciliation because the
roadmap, not the tracker, owns milestone proof.

## Success measures

Threshold values live in versioned evidence or release policy and are fixed
before the relevant candidate is measured. This document owns the measures,
not mutable numeric values.

### Product and renderer measures

| Scope ID | Measure |
| --- | --- |
| `SCOPE-METRIC-001` | Required target-matrix implementation and evidence coverage by binding and runtime profile. |
| `SCOPE-METRIC-002` | Packed consumer install, export, type, style, asset, engine, descriptor, and offline-resolution success. |
| `SCOPE-METRIC-003` | Behavior, accessibility, visual, and performance regression results by interaction risk and supported profile. |
| `SCOPE-METRIC-004` | Canonical-to-projection parity and clean regeneration identity. |
| `SCOPE-METRIC-005` | Maintainer scaffold-to-valid-source success, diagnostic repair success, affected-closure completeness, and zero direct projection fixes. |
| `SCOPE-METRIC-006` | Component/pattern usefulness and supported-workflow coverage rather than raw inventory count. |

### Agent-operability measures

| Scope ID | Measure |
| --- | --- |
| `SCOPE-METRIC-AGENT-001` | Manifest discovery success. |
| `SCOPE-METRIC-AGENT-002` | Artifact-selection precision and recall. |
| `SCOPE-METRIC-AGENT-003` | Wrong-prop and invented-prop rate. |
| `SCOPE-METRIC-AGENT-004` | Invalid-composition rate. |
| `SCOPE-METRIC-AGENT-005` | Compile and validation pass rate. |
| `SCOPE-METRIC-AGENT-006` | Accessibility-obligation pass rate. |
| `SCOPE-METRIC-AGENT-007` | Repair success after one structured diagnostic. |
| `SCOPE-METRIC-AGENT-008` | Context tokens used per successful task. |
| `SCOPE-METRIC-AGENT-009` | Stability across repeated runs and model families. |

Model metrics cannot override deterministic schema, type, behavior,
accessibility, package, compatibility, integrity, or generation failures.

## Release acceptance scope

### `0.1` is product-complete only when

- every fixed matrix cell has the required implementation, proof, or explicitly
  permitted disposition;
- Button, TextField, Switch, Dialog, Select, and Form exist under their
  canonical owners with required examples, pitfalls, renderers, descriptors,
  and evidence;
- the first-party default token/theme system satisfies every binding/profile
  requirement and platform accessibility adaptation;
- framework-free web, React, and native runtime ownership is explicit and
  leak-free;
- human, JSON, dense, API, and internal MCP views agree on exact records and
  applicability;
- packed artifacts, not source-tree assumptions, prove exports and
  compatibility;
- required manual accessibility evidence exists for every supported high-risk
  interaction/profile;
- the compatibility/evidence profile states the exact tested environment;
- generator, privacy, provenance, exception, advisory, performance-baseline,
  and change-intent requirements pass; and
- the same release manifest correlates all catalog, package, binding, token,
  evidence, profile, provenance, and exception identity.

Later productization or Gate 3 capability work cannot compensate for a missing
`0.1` requirement.

### Productization is product-complete only when

- public packages install from packed artifacts and their descriptors match
  actual exports and canonical revisions;
- a clean supported consumer resolves exact local guidance offline against its
  installed tuple;
- supported consumer validation is syntax/version bounded and meets its
  declared false-positive policy;
- the docs site, explorers, bootstrap files, public local MCP, API, and CLI use
  the same enabled catalog/query sources;
- historical catalogs and compatibility negotiation answer for supported
  installed versions;
- stable support has current risk/profile evidence, performance policy,
  compatibility review, retention, privacy, provenance, and no expired
  exception;
- disabled optional capabilities are absent or explicitly unavailable;
- every enabled plan, doctor, init, or canonical proposal operation passes its
  own manifest, confirmation, confinement, idempotency, and recovery rules; and
- release rollback restores the prior verifiable tuple without rewriting
  historical records.

### A conditional capability is product-complete only when

- its observed workflow and owner pass scope admission;
- it declares its public surface, versioning, compatibility, lifecycle,
  security/privacy, evidence, and migration effects;
- positive and negative fixtures prove its bounded protocol;
- it is represented honestly in capability manifests and documentation;
- it has rollback or disable behavior that leaves canonical truth intact; and
- disabling or rejecting it does not block an earlier renderer or release
  boundary.

## Product-scope change control

### Scope-version effects

| Change | `scopeVersion` effect |
| --- | --- |
| Clarification that changes no scope ID, commitment, boundary, or meaning | Patch |
| Add or revise a `candidate`, `admitted`, or `deferred` item without changing a committed release | Minor |
| Add, remove, replace, or materially redefine a committed outcome, platform, release boundary, package, public surface, or non-goal | Major |

Changing a tracker status, assignee, priority, iteration, or target date never
changes `scopeVersion`.

A product-scope change is required when a proposal would:

- add, remove, split, or replace a committed scope item;
- change a release boundary or platform commitment;
- add an artifact kind, durable relation, package, public command, adapter, or
  operation type;
- broaden support or compatibility;
- move a deferred capability into admitted or committed scope;
- change an explicit non-goal; or
- claim a new form of product completeness.

Every change must include:

1. observed user workflow and product outcome;
2. affected scope IDs and commitment transitions;
3. architecture compatibility;
4. roadmap milestone/evidence coverage or required roadmap amendment;
5. platform, package, version, migration, authoring, proof, privacy, security,
   and rollback effects;
6. explicit additions and removals from release scope; and
7. tracker migration for open work without rewriting completed evidence.

An adjacent implementation detail that does not alter product outcome,
platform support, public surface, ownership, compatibility, or proof remains a
tracker decision and does not require this document to change.

## Tracker reference contract

Every implementation issue must reference:

```text
Scope ID(s):
Roadmap milestone:
Architecture requirements:
Evidence ID(s):
Dependencies:
Deliverables:
Acceptance commands:
Explicit non-goals:
Pull request or change record:
```

The tracker owns assignee, priority, workflow status, iteration, target date,
blockers, and pull-request linkage. This document owns product commitment. The
roadmap owns milestone completion and evidence. None may copy another's live
state as an independently editable field.

## Product-scope integrity checklist

This product scope remains valid only while:

- every `committed` item has a named roadmap realization and evidence path;
- every `admitted` or `deferred` item remains unavailable until its own trigger
  passes;
- every public surface reports capability availability honestly;
- the fixed `0.1` matrix remains unchanged unless product scope and architecture
  are explicitly revised;
- future component breadth receives stable scope IDs before implementation;
- platform divergence is expressed through binding strategy and evidence rather
  than hidden substitutions;
- product scope does not duplicate live tracker status;
- optional capability failure cannot block an earlier renderer milestone;
- no item introduces a second owner or generated-source repair path; and
- all product claims remain subordinate to canonical identity, installed-local
  authority, deterministic proof, accessibility, compatibility, privacy, and
  explicit mutation approval.

If any statement becomes false, stop the affected scope item, retain the
failure evidence, and correct the earliest authoritative document or source.
