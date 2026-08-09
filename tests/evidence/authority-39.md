# Authority change #39 applicability supersessions

This directory retains public-sanitized, content-addressed metadata recording
that the accepted Tale-to-Core authority change supersedes the current
applicability of the retained G0.1–G0.5, Gate 0, G1.0, and G1.1 evidence
generations.

The supersessions do not rewrite the historical indexes, records, artifacts, or
recertification chains. They do not recertify an assertion, satisfy a current
milestone, or claim replacement evidence. Each supersession binds the exact
historical index, exact terminal recertification when present, the superseded
applicability manifest, the current observed manifest, and the content-addressed
repository decision that records issue #39's exact owner, comment identity,
timestamp, and decision-body digest. Replacement remains pending through the
accepted `TALE-TOKEN-A`, `TALE-TOKEN-B`, and `TALE-TOKEN-C` sequence.

Regenerate the content-addressed index and records only from the exact source
commit with:

```sh
node tests/evidence/capture-authority-39-supersessions.mjs --source <source-commit>
```

After the evidence-only commit, use `--check` without `--source`; it reuses the
retained source commit/tree, verifies that the commit remains available, proves
that applicable working-tree paths still match it, and compares every retained
byte without rewriting files.
