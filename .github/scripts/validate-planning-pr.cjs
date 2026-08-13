'use strict';

const AUTHORITY_FILES = new Set([
  'strategy/monorepo-architecture.md',
  'strategy/milestone-roadmap.md',
  'strategy/platform-safety-contract.json',
  'strategy/product-scope.md',
]);

const AUTHORITY_LABELS = new Set([
  'type:architecture-maintenance',
  'type:decision',
]);

const PLANNING_CONTROL_FILES = new Set([
  '.github/CODEOWNERS',
  '.github/pull_request_template.md',
  '.github/workflows/repository-planning-policy.yml',
  '.github/scripts/validate-planning-pr.cjs',
  '.github/scripts/validate-planning-pr.test.cjs',
]);

const DELIVERY_CONTROL_FILES = new Set([
  '.github/scripts/validate-planning-pr.cjs',
  '.github/scripts/validate-planning-pr.test.cjs',
  '.agents/skills/core-ui-delivery/SKILL.md',
  'decisions/0009-delivery-review-readiness-acceptance.json',
  'decisions/0009-delivery-review-readiness.json',
  'tests/AGENTS.md',
  'tests/evidence/README.md',
  'tests/evidence/capture-0009-delivery-review-readiness-applicability.mjs',
  'tests/evidence/delivery-review-readiness-applicability-profile.mjs',
  'tests/evidence/delivery-review-readiness-applicability-profile.test.mjs',
  'tooling/AGENTS.md',
  'tooling/audits/repository-policy/README.md',
  'tooling/audits/repository-policy/delivery-workflow-diagnostics.json',
  'tooling/audits/repository-policy/delivery-workflow-profile.json',
  'tooling/audits/repository-policy/delivery-workflow-profile.schema.json',
  'tooling/audits/repository-policy/delivery-workflow.schema.json',
  'tooling/audits/repository-policy/package.json',
  'tooling/audits/repository-policy/src/delivery-advisory.mjs',
  'tooling/audits/repository-policy/src/delivery-conformance.mjs',
  'tooling/audits/repository-policy/src/delivery-handoff.mjs',
  'tooling/audits/repository-policy/src/delivery-invalidation.mjs',
  'tooling/audits/repository-policy/src/delivery-packet.mjs',
  'tooling/audits/repository-policy/src/delivery-profile.mjs',
  'tooling/audits/repository-policy/src/delivery-rollback.mjs',
  'tooling/audits/repository-policy/src/delivery-workflow-authority-verify.mjs',
  'tooling/audits/repository-policy/src/delivery-workflow.mjs',
  'tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs',
  'tooling/audits/repository-policy/src/evidence-verify.mjs',
  'tooling/audits/repository-policy/test/delivery-workflow-authority.test.mjs',
  'tooling/audits/repository-policy/test/delivery-workflow.test.mjs',
  'tooling/audits/repository-policy/test/delivery/advisory.mjs',
  'tooling/audits/repository-policy/test/delivery/conformance.mjs',
  'tooling/audits/repository-policy/test/delivery/disable.mjs',
  'tooling/audits/repository-policy/test/delivery/fixtures.mjs',
  'tooling/audits/repository-policy/test/delivery/guardrails.mjs',
  'tooling/audits/repository-policy/test/delivery/handoff.mjs',
  'tooling/audits/repository-policy/test/delivery/invalidation.mjs',
  'tooling/audits/repository-policy/test/delivery/operational-integrity.mjs',
  'tooling/audits/repository-policy/test/delivery/ownership.mjs',
  'tooling/audits/repository-policy/test/delivery/packet.mjs',
  'tooling/audits/repository-policy/test/delivery/review-routing.mjs',
  'tooling/audits/repository-policy/test/delivery/rollback.mjs',
  'tooling/audits/repository-policy/test/evidence-integrity.test.mjs',
  'tooling/audits/repository-policy/test/fixtures/delivery-workflow/scenarios.json',
]);

const DELIVERY_IDENTITY_FIELDS = [
  'Source identity',
  'Executed identity',
  'Proof-tool identity',
  'Identity correlation owner',
  'Evidence identity',
  'Review packet identity',
  'Invalidation domains',
];

function isProtectedPlanningFile(file) {
  return AUTHORITY_FILES.has(file)
    || PLANNING_CONTROL_FILES.has(file)
    || DELIVERY_CONTROL_FILES.has(file)
    || file.startsWith('.github/ISSUE_TEMPLATE/');
}

function fieldValue(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`^\\s*-?\\s*${escaped}:\\s*(.+?)\\s*$`, 'im'));
  return match ? match[1].trim() : '';
}

function hasSubstantiveValue(value) {
  return Boolean(value) && !/^(?:n\/?a|none|pending|tbd|not assigned)[\s.!-]*$/i.test(value);
}

function validatePlanningPullRequest({ files = [], labels = [], body = '' }) {
  const errors = [];
  const planningControlChanged = files.some(isProtectedPlanningFile);
  const productScopeChanged = files.includes('strategy/product-scope.md');
  const deliveryControlChanged = files.some((file) => DELIVERY_CONTROL_FILES.has(file));

  if (!planningControlChanged) return errors;

  if (!labels.some((label) => AUTHORITY_LABELS.has(label))) {
    errors.push(
      'Authority-source changes require the type:architecture-maintenance or type:decision label.',
    );
  }

  const changeRecord = fieldValue(body, 'Authority change record');
  if (!/^#\d+\b/.test(changeRecord)) {
    errors.push('Authority-source changes require an Authority change record: #… reference.');
  }

  errors.push(...validateDeliveryIdentities({ files, body }));

  if (!productScopeChanged) return errors;

  const scopeVersion = fieldValue(body, 'Scope version effect');
  if (!/^(?:none|patch|minor|major)\b/i.test(scopeVersion)) {
    errors.push('Product Scope changes require a valid Scope version effect.');
  }

  for (const label of [
    'Affected Scope IDs / commitment transitions',
    'Roadmap / evidence effect',
    'Release additions / removals',
    'Open tracker migration',
  ]) {
    if (!hasSubstantiveValue(fieldValue(body, label))) {
      errors.push(`Product Scope changes require a substantive ${label} entry.`);
    }
  }

  return errors;
}

function validateDeliveryIdentities({ files = [], body = '' }) {
  if (!files.some((file) => DELIVERY_CONTROL_FILES.has(file))) return [];
  const errors = [];
  for (const label of DELIVERY_IDENTITY_FIELDS) {
    if (!hasSubstantiveValue(fieldValue(body, label))) errors.push(`Delivery workflow changes require a substantive ${label} entry.`);
  }
  for (const prohibited of ['Clearance', 'Dispatch', 'Review state', 'Acceptance state', 'Readiness state', 'Merge state']) {
    if (fieldValue(body, prohibited)) errors.push(`Delivery workflow changes must not submit a local ${prohibited} claim.`);
  }
  return errors;
}

module.exports = {
  AUTHORITY_FILES,
  DELIVERY_CONTROL_FILES,
  DELIVERY_IDENTITY_FIELDS,
  PLANNING_CONTROL_FILES,
  isProtectedPlanningFile,
  validateDeliveryIdentities,
  validatePlanningPullRequest,
};
