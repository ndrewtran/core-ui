# Repository policy audit

This package owns Core UI's deterministic repository-policy checks. For delivery
work, begin with the repository [route map](../../../AGENTS.md), then load
`delivery-workflow-profile.json`. The profile links every workflow field to its
canonical owner, applicability rule, invalidation domain, reviewer route, and
recovery step; this README does not repeat those values.

The internal delivery modules validate authored records, classify exact field
changes, render advisory review packets, and render rollback status. They do not
dispatch reviewers, mutate GitHub or the Delivery Project, record human
decisions, or claim clearance. Run the existing root `pnpm check` and
`pnpm generate:check` commands selected by the active owner.

Evidence capture and disclosure remain owned by the architecture and Product
Scope references linked from the profile. See
[`tests/evidence/README.md`](../../../tests/evidence/README.md) before retaining
proof.
