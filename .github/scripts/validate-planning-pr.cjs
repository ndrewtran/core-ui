'use strict';

const AUTHORITY_FILES = new Set([
  'strategy/monorepo-architecture.md',
  'strategy/milestone-roadmap.md',
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

function isProtectedPlanningFile(file) {
  return AUTHORITY_FILES.has(file)
    || PLANNING_CONTROL_FILES.has(file)
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

module.exports = {
  AUTHORITY_FILES,
  PLANNING_CONTROL_FILES,
  isProtectedPlanningFile,
  validatePlanningPullRequest,
};
