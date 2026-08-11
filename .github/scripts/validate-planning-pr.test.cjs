'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validatePlanningPullRequest } = require('./validate-planning-pr.cjs');

const completeBody = `
- Authority change record: #1
- Scope version effect: none — publishes accepted scopeVersion 1.0.0 unchanged
- Affected Scope IDs / commitment transitions: all accepted IDs; no commitment transitions
- Roadmap / evidence effect: no semantic changes; tracker references are reconciled
- Release additions / removals: None — accepted release boundary remains unchanged
- Open tracker migration: issues #1–#19 and the Core UI Delivery Project
`;

const deliveryBody = `${completeBody}
- Source identity: 1111111111111111111111111111111111111111 / 2222222222222222222222222222222222222222
- Executed identity: 1111111111111111111111111111111111111111 / 2222222222222222222222222222222222222222
- Proof-tool identity: 3333333333333333333333333333333333333333 / 4444444444444444444444444444444444444444
- Identity correlation owner: repository-policy-owner
- Evidence identity: owner-declared N/A record core-ui-evidence-binding-v1:no-evidence-route
- Review packet identity: packet-1 / core-ui-review-packet-v1 / sha256 / sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa / 1024
- Invalidation domains: AUTHORITY, PROOF_TOOL, PACKET
`;

test('ignores pull requests outside authority sources', () => {
  assert.deepEqual(
    validatePlanningPullRequest({
      files: ['README.md'],
      labels: [],
      body: '',
    }),
    [],
  );
});

test('accepts a complete Product Scope authority publication', () => {
  assert.deepEqual(
    validatePlanningPullRequest({
      files: ['strategy/product-scope.md'],
      labels: ['type:architecture-maintenance'],
      body: completeBody,
    }),
    [],
  );
});

test('rejects an authority change without a label or change record', () => {
  const errors = validatePlanningPullRequest({
    files: ['strategy/milestone-roadmap.md'],
    labels: [],
    body: '',
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /label/);
  assert.match(errors[1], /change record/);
});

test('protects the executable platform-safety registry as architecture authority', () => {
  const errors = validatePlanningPullRequest({
    files: ['strategy/platform-safety-contract.json'],
    labels: [],
    body: '',
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /label/);
  assert.match(errors[1], /change record/);
});

test('rejects a planning-control-only change without governance metadata', () => {
  const errors = validatePlanningPullRequest({
    files: ['.github/workflows/repository-planning-policy.yml'],
    labels: [],
    body: '',
  });

  assert.equal(errors.length, 2);
  assert.match(errors[0], /label/);
  assert.match(errors[1], /change record/);
});

test('rejects incomplete Product Scope change metadata', () => {
  const errors = validatePlanningPullRequest({
    files: ['strategy/product-scope.md'],
    labels: ['type:decision'],
    body: `
- Authority change record: #12
- Scope version effect: someday
- Affected Scope IDs / commitment transitions: Pending
- Roadmap / evidence effect: TBD
- Release additions / removals: None
- Open tracker migration: N/A
`,
  });

  assert.equal(errors.length, 5);
  assert.match(errors[0], /Scope version effect/);
  assert.match(errors[1], /Affected Scope IDs/);
  assert.match(errors[2], /Roadmap \/ evidence effect/);
  assert.match(errors[3], /Release additions \/ removals/);
  assert.match(errors[4], /Open tracker migration/);
});

test('accepts complete delivery workflow identities without local clearance', () => {
  assert.deepEqual(validatePlanningPullRequest({
    files: ['tooling/audits/repository-policy/delivery-workflow-profile.json'],
    labels: ['type:architecture-maintenance'],
    body: deliveryBody,
  }), []);
});

test('rejects omitted and substituted delivery identities', () => {
  const errors = validatePlanningPullRequest({
    files: ['.agents/skills/core-ui-delivery/SKILL.md'],
    labels: ['type:decision'],
    body: `${completeBody}\n- Source identity: one identity for everything`,
  });
  assert.equal(errors.length, 6);
  assert.match(errors[0], /Executed identity/);
  assert.match(errors[5], /Invalidation domains/);
});

test('rejects local clearance and dispatch claims for delivery controls', () => {
  const errors = validatePlanningPullRequest({
    files: ['tests/evidence/README.md'],
    labels: ['type:architecture-maintenance'],
    body: `${deliveryBody}\n- Clearance: clear\n- Dispatch: complete`,
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Clearance/);
  assert.match(errors[1], /Dispatch/);
});
