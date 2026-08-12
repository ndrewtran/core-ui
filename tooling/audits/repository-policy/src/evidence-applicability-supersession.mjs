const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function exactKeys(value, required, optional, label, fail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const allowed = [...required, ...optional].sort();
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const unknown = actual.filter((key) => !allowed.includes(key));
  if (missing.length > 0 || unknown.length > 0) {
    fail(`${label} has missing keys [${missing.join(', ')}] and unknown keys [${unknown.join(', ')}]`);
  }
}

function string(value, label, fail, pattern) {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    fail(`${label} is invalid`);
  }
}

function timestamp(value, label, fail) {
  string(value, label, fail, RFC3339_PATTERN);
  if (typeof value === 'string' && Number.isNaN(Date.parse(value))) {
    fail(`${label} is not a real RFC3339 UTC timestamp`);
  }
}

function normalizedPath(value) {
  return (
    typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.endsWith('/')
    && !value.includes('\\')
    && !value.includes('//')
    && !value.split('/').some((segment) => segment === '.' || segment === '..')
  );
}

function reference(value, label, fail) {
  exactKeys(value, ['path', 'sha256'], [], label, fail);
  string(value?.path, `${label}.path`, fail);
  if (!normalizedPath(value?.path)) {
    fail(`${label}.path must be repository-relative and normalized`);
  }
  string(value?.sha256, `${label}.sha256`, fail, SHA256_PATTERN);
}

function manifest(value, label, fail) {
  exactKeys(value, ['algorithm', 'paths', 'profile', 'sha256'], [], label, fail);
  if (value?.algorithm !== 'sha256') fail(`${label}.algorithm must be sha256`);
  if (value?.profile !== 'core-ui-path-manifest-v1') {
    fail(`${label}.profile must be core-ui-path-manifest-v1`);
  }
  string(value?.sha256, `${label}.sha256`, fail, SHA256_PATTERN);
  if (
    !Array.isArray(value?.paths)
    || value.paths.length === 0
    || value.paths.some((path) => !normalizedPath(path))
    || new Set(value.paths).size !== value.paths.length
  ) fail(`${label}.paths must be a non-empty unique string array`);
}

export function assertAuthorityDecisionShape(value, fail) {
  exactKeys(
    value,
    [
      'bodySha256',
      'commentId',
      'commentNodeId',
      'createdAt',
      'decisionId',
      'issueNumber',
      'outcome',
      'owner',
      'ownerNodeId',
      'provider',
      'repository',
      'schema',
      'url',
    ],
    ['authorAssociation', 'updatedAt'],
    'authority decision',
    fail,
  );
  if (value?.schema !== 'core-ui-authority-decision-v1') {
    fail('authority decision.schema must be core-ui-authority-decision-v1');
  }
  if (value?.provider !== 'github') fail('authority decision.provider must be github');
  if (value?.outcome !== 'accepted') fail('authority decision.outcome must be accepted');
  string(value?.decisionId, 'authority decision.decisionId', fail, /^core-ui:decision:\d{4}$/u);
  string(value?.repository, 'authority decision.repository', fail, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
  if (!Number.isSafeInteger(value?.issueNumber) || value.issueNumber < 1) {
    fail('authority decision.issueNumber must be a positive integer');
  }
  if (!Number.isSafeInteger(value?.commentId) || value.commentId < 1) {
    fail('authority decision.commentId must be a positive integer');
  }
  string(value?.commentNodeId, 'authority decision.commentNodeId', fail, IDENTIFIER_PATTERN);
  timestamp(value?.createdAt, 'authority decision.createdAt', fail);
  if (value?.updatedAt !== undefined) timestamp(value.updatedAt, 'authority decision.updatedAt', fail);
  if (value?.authorAssociation !== undefined && value.authorAssociation !== 'OWNER') {
    fail('authority decision.authorAssociation must be OWNER when present');
  }
  string(value?.bodySha256, 'authority decision.bodySha256', fail, SHA256_PATTERN);
  string(value?.url, 'authority decision.url', fail, /^https:\/\/github\.com\//u);
  string(value?.owner, 'authority decision.owner', fail, IDENTIFIER_PATTERN);
  string(value?.ownerNodeId, 'authority decision.ownerNodeId', fail, IDENTIFIER_PATTERN);
  if (
    typeof value?.repository === 'string'
    && Number.isSafeInteger(value?.issueNumber)
    && Number.isSafeInteger(value?.commentId)
    && value?.url
      !== `https://github.com/${value.repository}/issues/${value.issueNumber}`
        + `#issuecomment-${value.commentId}`
  ) fail('authority decision.url must match repository, issueNumber, and commentId');
}

export function assertApplicabilitySupersessionReference(referenceValue, fail) {
  exactKeys(referenceValue, ['milestone', 'path', 'sha256'], [], 'supersession reference', fail);
  string(referenceValue?.milestone, 'supersession reference.milestone', fail);
  reference(
    { path: referenceValue?.path, sha256: referenceValue?.sha256 },
    'supersession reference',
    fail,
  );
}

export function assertApplicabilitySupersessionShape(value, fail) {
  exactKeys(
    value,
    [
      'affectedAssertions',
      'authorization',
      'currentApplicabilityManifest',
      'disclosureClass',
      'effectiveAt',
      'evidenceStatus',
      'historicalIndex',
      'owner',
      'reasonCode',
      'replacementPlan',
      'replacementStatus',
      'schema',
      'sourceRevision',
      'sourceTree',
      'supersededApplicabilityManifest',
    ],
    ['previousSupersession', 'supersededRecertification'],
    'applicability supersession',
    fail,
  );
  if (value?.schema !== 'core-ui-evidence-applicability-supersession-v1') {
    fail('schema must be core-ui-evidence-applicability-supersession-v1');
  }
  if (value?.evidenceStatus !== 'superseded') fail('evidenceStatus must be superseded');
  if (value?.reasonCode !== 'governing-authority-changed') {
    fail('reasonCode must be governing-authority-changed');
  }
  if (value?.replacementStatus !== 'pending') fail('replacementStatus must be pending');
  if (value?.disclosureClass !== 'public-sanitized') {
    fail('disclosureClass must be public-sanitized');
  }
  string(value?.owner, 'owner', fail, IDENTIFIER_PATTERN);
  timestamp(value?.effectiveAt, 'effectiveAt', fail);
  string(value?.sourceRevision, 'sourceRevision', fail, GIT_OBJECT_PATTERN);
  string(value?.sourceTree, 'sourceTree', fail, GIT_OBJECT_PATTERN);
  if (
    !Array.isArray(value?.affectedAssertions)
    || value.affectedAssertions.length === 0
    || value.affectedAssertions.some((id) => typeof id !== 'string' || id.length === 0)
    || [...value.affectedAssertions].sort().join('\0') !== value.affectedAssertions.join('\0')
    || new Set(value.affectedAssertions).size !== value.affectedAssertions.length
  ) fail('affectedAssertions must be a non-empty sorted unique string array');
  if (
    !Array.isArray(value?.replacementPlan)
    || value.replacementPlan.length === 0
    || value.replacementPlan.some((id) => typeof id !== 'string' || !IDENTIFIER_PATTERN.test(id))
    || new Set(value.replacementPlan).size !== value.replacementPlan.length
  ) fail('replacementPlan must be a non-empty unique identifier array');
  reference(value?.authorization, 'authorization', fail);
  reference(value?.historicalIndex, 'historicalIndex', fail);
  manifest(value?.currentApplicabilityManifest, 'currentApplicabilityManifest', fail);
  manifest(value?.supersededApplicabilityManifest, 'supersededApplicabilityManifest', fail);
  if (value?.previousSupersession !== undefined) {
    reference(value.previousSupersession, 'previousSupersession', fail);
  }
  if (value?.supersededRecertification !== undefined) {
    reference(value.supersededRecertification, 'supersededRecertification', fail);
  }
  if (
    value?.previousSupersession !== undefined
    && value?.supersededRecertification !== undefined
  ) fail('a continuation cannot also bind a superseded recertification');
}
