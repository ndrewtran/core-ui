---
name: core-ui-delivery
description: Triage and route Core UI repository work through its canonical delivery profile, proof owners, disclosure gate, risk-based independent reviews, human decision boundaries, and deterministic recovery. Use automatically for every Core UI planning, implementation, evidence, PR, merge, rollback, tracker, or release-adjacent task, including requests to decide the next permitted operation.
---

# Core UI Delivery

Use this repository skill after the global `core-ui-delivery-guard` for every
Core UI delivery task. It is the activation and triage scaffold for the private
delivery procedure. It owns no commands, mutable state, reviewer decisions,
clearance, dispatch, GitHub writes, or Project writes.

## Start every task

1. Resolve the repository root, exact source state, and clean working boundary.
   Preserve unrelated or user-owned changes; prefer a dedicated topic branch or
   worktree for authored changes.
2. Apply the global guard's authority map, live Project read, alignment
   preflight, and deviation gate. Read `/AGENTS.md`, then the nearest route map
   for each affected canonical owner.
3. Load `/tooling/audits/repository-policy/delivery-workflow-profile.json` and
   validate it through the existing repository-policy check. Derive the active
   stage, applicability, N/A reasons, invalidation domains, reviewer routes,
   disclosure owners, and recovery route from the profile. Never copy its enums
   or command strings into prompts, forms, or this skill.
4. Read the canonical authority and owner references selected by the profile.
   Classify the task as aligned, a required correction, an adjacent improvement,
   a potential deviation, or unverified before writing.
5. Report a compact task route: primary owner and milestone relationship;
   Project item and workflow status source; active profile stage and
   applicability; required owner checks; triggered reviewers and independence;
   freeze boundary; human decision state; and exact next permitted operation.
6. Stop before writes when an owner, dependency, tracker fact, disclosure route,
   or required human decision is missing or contradictory.

## Fast aligned route

1. Keep one task to one bounded canonical-owner slice. Change the earliest owner
   and regenerate projections rather than repairing derived output.
2. During development, run the active owner's declared closure. Defer broad
   workspace checks until the profile requires them for the frozen candidate.
3. Freeze the exact commit/tree, diff or complete artifact set, deterministic
   results, and disclosure boundary before constructing a review packet. Do not
   edit the candidate while independent review is active.
4. Dispatch only reviewers selected by the profile and actual risk. Batch
   findings against the same immutable candidate; after a correction, rewind
   only to the earliest invalidated domain and rebuild downstream identities.
5. Treat hosted checks as candidate conformance only. Before every external
   transition, re-read the bound remote, PR, check, review, and tracker state;
   perform only the separately authorized operation.
6. Reconcile routine tracker locators after the authoritative event. Never infer
   roadmap, product, evidence, lifecycle, capability, or release acceptance from
   a Project transition, PR state, or reviewer verdict.

## Identity and handoff

Keep source, executed, proof-tool, evidence, packet, hosted observation, and
human decision identities separate. Record exact commit/tree or digest-bearing
owner records when the active profile requires them. At each handoff, report
the current stage, satisfied postcondition, invalidated identities, outstanding
human decision, and one exact next permitted operation. Do not create packets or
full-proof runs for explanation-only work unless the profile selects them.

## Evidence route

Read `/tests/evidence/README.md`. Retain only proof-owner outputs with exact
source/execution/tool/environment bindings and the linked privacy, retention,
expiry, exception, and advisory fields. Review packets and task-local logs are
not evidence unless an owner explicitly admits them.

Apply the profile-linked disclosure procedure before every reviewer or
publication handoff. Reviewer dispatch, reviewer outcomes, and human decisions
remain external inputs; local workflow output cannot manufacture them.

## Recovery

On rollback ambiguity, stop at `ROLLBACK_RECOVERY_REQUIRED`. Validate and render
the fully materialized next instruction from the profile, but do not execute a
repository or provider mutation until the governing human and Git procedure
authorize that exact action.

## Boundaries

- Never add a second registry or duplicate profile enums in prompts or forms.
- Never accept a submitted clearance, dispatch, review-state, readiness, merge,
  tracker-state, release, or completion claim as workflow truth.
- Never expose an external mutation operation from repository-policy modules.
- Never weaken an active owner, protected branch rule, or historical evidence
  chain from candidate code.
- Never let guidance convenience become a second workflow registry, authority
  source, proof result, reviewer assignment, human decision, or tracker fact.
