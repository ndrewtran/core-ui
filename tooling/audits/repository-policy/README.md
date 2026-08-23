# Repository policy audit

This package owns Core UI's deterministic repository-policy checks. For delivery
work, begin with the repository [route map](../../../AGENTS.md), then load
`delivery-workflow-profile.json`. The profile links every workflow field to its
canonical owner, applicability rule, invalidation domain, reviewer route, and
recovery step; this README does not repeat those values.

The internal delivery modules validate authored records, classify exact field
changes, validate raw task-local invocation preimages, and render rollback
status. Source inspection, deterministic operation verification, post-proof
review clearance, and ready-merge clearance remain separate gates. The
repository entrypoint never authenticates reviewer assignment, review result,
or review clearance. The package-internal callable path is:

`node tooling/audits/repository-policy/src/delivery-advisory.mjs --invocation <task-local-invocation.json>`

Descriptor-free execution always performs read-only `source-inspection` after
validating authority, prerequisite lineage, source, policy, generation
identity, and the deterministic workspace graph. It authorizes no operation,
review, Git or Project transition, evidence acceptance, merge, publication,
release, or completion. Explicit operation execution requires a task-local
descriptor and exact ChangeIntent; it is fail-closed and authorizes only the
named operation against its exact preimage. A successful operation result is
not post-proof review clearance or ready-merge clearance.

Exit `0` is valid and satisfied, `1` is valid and unsatisfied with a non-dispatch
rewind, and `2` is malformed, stale, unowned, unsafe, or noncanonical input.
The output is task-local and non-evidentiary. These modules do not dispatch
reviewers, mutate GitHub or the Delivery Project, record human decisions, or
claim post-proof or ready-merge clearance. Run the existing root `pnpm check`
and `pnpm generate:check` commands selected by the active owner.

Evidence capture and disclosure remain owned by the architecture and Product
Scope references linked from the profile. See
[`tests/evidence/README.md`](../../../tests/evidence/README.md) before retaining
proof.
