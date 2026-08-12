---
name: core-ui-delivery
description: Route Core UI repository delivery work through its canonical procedural profile, proof owners, disclosure gate, risk-based independent reviews, human decision boundaries, and deterministic recovery. Use for Core UI planning, implementation, evidence, PR, merge, rollback, or release-adjacent work.
---

# Core UI Delivery

Use this repository skill after the global `core-ui-delivery-guard`. It is a
route guide only: it owns no commands, mutable state, reviewer decisions,
clearance, dispatch, GitHub writes, or Project writes.

## Procedure

1. Read `/AGENTS.md`, then the nearest route map for each affected owner.
2. Load `/tooling/audits/repository-policy/delivery-workflow-profile.json` and
   validate it through the existing repository-policy check. Resolve commands,
   applicability, N/A reasons, invalidation domains, reviewer routes, disclosure
   owners, and rollback steps from that profile rather than copying literals.
3. Read the canonical authority and owner references named by the profile.
4. Keep source, executed, proof-tool, evidence, packet, hosted observation, and
   human decision identities separate. Record their exact commit/tree or
   digest-bearing owner records as applicable.
5. Change the earliest canonical owner, regenerate projections, and run only the
   active owner's declared closure. Finish with the repository's existing full
   deterministic checks when the profile requires them.
6. Apply the linked disclosure procedure before every operator-facing review or
   publication handoff. Dispatch and human decisions stay out of this skill and
   out of local workflow output.
7. Treat hosted success as candidate conformance only. Reconcile mutable tracker
   locators separately and never infer roadmap, evidence, or release acceptance.
8. On rollback ambiguity, stop at `ROLLBACK_RECOVERY_REQUIRED`; validate the
   fully materialized next command from the profile and do not execute it until
   the governing human/Git procedure authorizes the action.

## Evidence route

Read `/tests/evidence/README.md`. Retain only proof-owner outputs with exact
source/execution/tool/environment bindings and the linked privacy, retention,
expiry, exception, and advisory fields. Review packets and task-local logs are
not evidence unless an owner explicitly admits them.

## Boundaries

- Never add a second registry or duplicate profile enums in prompts or forms.
- Never accept a submitted clearance, dispatch, review-state, readiness, merge,
  tracker-state, release, or completion claim as workflow truth.
- Never expose an external mutation operation from repository-policy modules.
- Never weaken an active owner, protected branch rule, or historical evidence
  chain from candidate code.
