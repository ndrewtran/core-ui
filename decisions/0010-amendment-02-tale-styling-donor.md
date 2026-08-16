# Decision 0010 amendment 02: Tale styling donor and React visual harness

Status: Accepted.

Acceptance: Andrew / `ndrewtran` accepted Decision 0010 amendment 02 at
SHA-256
`c185284dc4665eb2923cd4dc1fd7a5b81c583400d72eb4bdc188b5943ed19d5c`,
the corrected React-primary/Tale-donor authority materialization diff at
SHA-256
`4bbd3fe9c6a432fc1de0a50f670f99bef1badf271fdb46549e031a90e39f6eec`,
and Project migration candidate v2 at SHA-256
`f187899174eb4b613328cc6cc5da15a718629b455459d815e3d090f2bcdd2dba`
with the instruction:

> I approve Decision 0010 amendment 02, SHA-256
> c185284dc4665eb2923cd4dc1fd7a5b81c583400d72eb4bdc188b5943ed19d5c;
> the corrected React-primary/Tale-donor authority materialization diff,
> SHA-256
> 4bbd3fe9c6a432fc1de0a50f670f99bef1badf271fdb46549e031a90e39f6eec;
> and the Project migration candidate v2, SHA-256
> f187899174eb4b613328cc6cc5da15a718629b455459d815e3d090f2bcdd2dba.

This append-only status recording changes none of the accepted human choices.
No GitHub comment or approval timestamp beyond 2026-08-16 is claimed.

Parent: `core-ui:decision:0010`

## Human decision

Every admitted Core UI React component uses the styling of its corresponding
component from Tale UI commit
`94bf62a26c02605c8928dfeb24f0ddc4be1c92fd` as the default visual
implementation starting point when an applicable donor exists.

Tale CSS, component wrappers, stories, themes, and the Scale application are
donor inputs only. Core UI owns every resulting CSS file, token mapping, class
name, styling hook, variant, behavior, accessibility obligation, package
export, compatibility promise, lifecycle, and release claim. Tale UI is not a
runtime, build, development, generated-source, or ongoing synchronization
dependency.

Components without an applicable Tale donor record an explicit
`no-applicable-donor` disposition. Exact copying is not required when the Core
binding contract, accessibility, platform safety, or responsible implementation
requires adaptation; the deviation and visual result remain explicit.

When an applicable donor exists, routine delivered/exportable closure is
limited to `adopt` or `adapt`. `defer` and `reject` leave the component
unexported and unreleasable until a separately accepted decision-bearing
exception supplies the alternate visual direction and reconciles the exact
tranche contract. `no-applicable-donor` cannot be used for an applicable donor.

A private Storybook-style React playground is established during R1 as a
generated projection over canonical Core examples for development, state and
theme coverage, automated accessibility checks, and visual donor comparison.
It is not the public P2.3 documentation/explorer surface and owns no product
truth.

Tale Scale remains a deferred donor candidate for a later separately admitted
Core theme-authoring capability. This amendment does not port, publish, or
depend on Scale.

## Pinned donor identity

- Repository: `Tale-UI/tale-ui`
- Commit: `94bf62a26c02605c8928dfeb24f0ddc4be1c92fd`
- Component-style tree: `packages/styles/src` / `aea4eadffe226656ef0ab012409ed39070975a76`
- Related React-source tree: `packages/react/src` / `d93f7c0a555066d8abbaff75cb8bd216938bcb2f`
- CSS-foundation tree: `packages/css/src` / `aa2a2d95214918794e9f463e063ceee0df3b4b1e`
- Theme-source tree: `packages/themes/src` / `3a8741a434a68b3aa043c674e91e04ca43f74d79`
- Scale tree: `playground/scale` / `85d594c05b32e473af4734ec18447a1d8df8ebdd`
- Storybook tree: `playground/storybook` / `4ce42f490f58489f9b06ffbeec784af37745b678`
- License file SHA-256: `9f6166bde2e7fdb22505c2526093dc61497159064814481584f928af048505bc`

The style/React/CSS trees form the R1 donor baseline. Theme, Scale, and
Storybook trees are provenance/reference inputs only and do not admit their
packages, applications, stories, or public surfaces.

R1.0 records the exact license/attribution disposition. Any `@core-ui/react`
artifact that distributes copied or adapted substantial portions preserves the
applicable Tale MIT notice, including the notice's stated third-party portions.
This notice is a Core-owned release input and not a Tale dependency.

## Delivery effect

R1.0 owns the donor snapshot, shared-primitives inventory, closed disposition
grammar, donor-to-Core token/style crosswalk, private generated playground,
license/notice boundary, and Button comparison baseline. Each R1 tranche
applies that baseline to its exact locked components. R1.5 closes both the
React Aria surface disposition and the
styling-donor disposition for every delivered component.

Routine style migration inside an accepted tranche requires no per-component
authority decision. A new public hook, token meaning, dependency, package,
support promise, exception, or release-boundary change remains decision-bearing.

## Product Scope effect

Product Scope advances from `5.0.0` to `5.0.1`. This is a patch clarification:
no Scope ID, commitment, platform, package, public surface, outcome, release
boundary, non-goal, artifact kind, durable relation, or compatibility promise
is added, removed, or redefined.

Affected existing commitments remain in their current states:

- `SCOPE-SYSTEM-REACT`, `SCOPE-REACT-BREADTH-001`, `SCOPE-PKG-REACT`, and
  `SCOPE-SURFACE-REACT-PACKAGE-GUIDANCE`;
- the eight React component/pattern commitments introduced by `5.0.0`;
- `SCOPE-THEME-DEFAULT`, `SCOPE-TOKEN-LAYERS`, `SCOPE-TOKEN-REQUIREMENTS`,
  `SCOPE-TOKEN-OVERRIDES`, `SCOPE-GUIDE-THEMING`, and
  `SCOPE-PROOF-VISUAL`;
- `SCOPE-SURFACE-EXPLORER-WEB`, whose public boundary remains P2.3; and
- `SCOPE-THEME-ADDITIONAL` and `SCOPE-CAP-DESIGN-TOOL`, which remain
  unavailable under their existing deferred/admitted activation rules.

There are no release additions or removals. The React prerelease still
publishes only `@core-ui/react` under `next`; the playground is private and
Scale is later.

## Non-goals

This amendment authorizes no component implementation, dependency
installation, token addition, CSS copy, playground implementation, Scale port,
package publication, Project mutation, support claim, stable promotion,
framework-free/native work, equivalence claim, release, or production change.

It does not rewrite Decision 0010 or amendment 01, Product Scope `5.0.0`,
historical evidence, Tale UI history, or PR #51. Reversal before implementation
is append-only supersession. After style migration begins, a donor-baseline or
ownership reversal requires a new accepted decision and bounded reproof of the
affected R1 baseline/tranches.
