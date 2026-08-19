# Decision 0010 amendment 05: R1 policy-entrypoint authority correction

Status: Accepted upon materialization under Andrew / `ndrewtran`'s exact
digest-specific acceptance of the candidate below. The authority issue is
`#88`; the protected authority PR and merge remain pending and are not claimed
by this record.

Decision: `core-ui:decision:0010:amendment:05`

Parent decision: `core-ui:decision:0010`

Repository: `ndrewtran/core-ui`

Owner: Andrew / `ndrewtran`

Issue: `#88`

Accepted candidate: `cd67bbff022ffb0cc34c530dba2bfc3a9fddfca79a21c0f4220129357b309430`

Human acceptance: Andrew / `ndrewtran`: “I accept Core UI R1 policy-entrypoint authority correction candidate v1, SHA-256 cd67bbff022ffb0cc34c530dba2bfc3a9fddfca79a21c0f4220129357b309430. I authorize its minimum append-only Decision 0010 amendment materialization and acceptance record; its protected authority PR and merge after required checks and independent reviews pass; and continuation of the corrected five-path verifier bootstrap under the previously accepted continuous-execution envelope. The npm-publication and final R1-exit merge boundaries remain unchanged.”

Acceptance record: `decisions/0010-amendment-05-r1-policy-entrypoint-acceptance.md`

## Decision

Decision 0010 amendment 04 remains authoritative except for this narrow
bootstrap write-set correction.

The one-time R1 continuous-execution verifier bootstrap may additionally
change:

- `tooling/audits/repository-policy/src/cli.mjs`.

This path is admitted only so the existing production repository-policy
entrypoint can invoke the private R1 continuous-execution policy gate. The
entrypoint must preserve its current navigation, repository-policy, and
delivery-profile checks. In ordinary non-operation mode the R1 gate may return
the explicitly defined ready/no-op result. When an R1 operation is declared,
the entrypoint must consume the exact operation descriptor, execute the private
verifier, and fail the command unless the verifier returns the exact passing
result for that operation.

The corrected bootstrap must also, within its already admitted owner and test
paths:

- use closed, unknown-field-rejecting record contracts;
- bind authority to the exact committed protected authority merge and bytes;
- bind review, evidence, lock, proof, Project, PR, check, and merge inputs to
  their canonical owner or authenticated observation and exact source;
- derive and compare phase-appropriate observed repository or Project effects
  with the authorized write set;
- admit the bootstrap only from the exact non-default sole-child topology and
  reject any second bootstrap after its protected merge; and
- distinguish intermediate protected merges from the final R1-exit merge and
  reject the final merge without the separately reserved human authorization.

The corrected bootstrap source and every later operation remain subject to the
existing frozen-source, deterministic-check, independent-review, hosted-check,
protected-merge, postmerge-verification, privacy, evidence, invalidation, and
stop-boundary rules.

## Authority and scope effect

This is an append-only delivery-control correction. It does not change the 53
families, Product Scope 6.0.1, Architecture product ownership, Roadmap tranche
membership or exits, public commands, packages, dependencies, components,
renderers, support, evidence meaning, Project state, publication, or release
authority. The repository-policy CLI remains private tooling and gains no new
public command or API.

The previously reviewed bootstrap source at commit
`3562c5fd616e686b6e462a82e6e3c06b771b11d4` is rejected and retained only as
local audit history. After this correction is accepted and materialized, the
bootstrap must be rebuilt as a new exact sole child of the resulting authority
merge and pass fresh deterministic checks and independent review.

## Acceptance effect

“I accept Core UI R1 policy-entrypoint authority correction candidate v1, SHA-256 cd67bbff022ffb0cc34c530dba2bfc3a9fddfca79a21c0f4220129357b309430. I authorize its minimum append-only Decision 0010 amendment materialization and acceptance record; its protected authority PR and merge after required checks and independent reviews pass; and continuation of the corrected five-path verifier bootstrap under the previously accepted continuous-execution envelope. The npm-publication and final R1-exit merge boundaries remain unchanged.”

This decision does not claim that the protected PR exists, that its review or
checks passed, or that it merged.

## Non-goals and stop boundary

This decision does not authorize npm publication or the final R1-exit PR
merge. Any path beyond the five-path bootstrap grant, any product or release
effect, or any weakening of the required verifier predicates remains a new
decision-bearing stop condition.

Decision 0010 amendments 01-04 remain preserved and authoritative for their
original claims. Reversal is append-only and cannot rewrite those amendments,
their acceptance records, or retained history.
