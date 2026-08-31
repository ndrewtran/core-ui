import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@muxui/schema';
import { sha256 } from './policy.mjs';
import { verifyPhaseCApplicabilityTopologyCorrection } from './phase-c-applicability-topology-correction-verify.mjs';

const DECISION_PATH = 'decisions/0005-default-theme-token-source-identity.json';
const ACCEPTANCE_PATH = 'decisions/0005-default-theme-token-source-identity-acceptance.json';
const PRODUCT_SCOPE_PATH = 'strategy/product-scope.md';
const PARENT_PATH = 'decisions/0004-tale-only-reference-baseline-annex.json';
const PARENT_ACCEPTANCE_PATH = 'decisions/0004-tale-only-reference-baseline-acceptance.json';
const DECISION_SHA256 = 'sha256:747eb372d7cb53351d1cc30f4092cd703feb7986d3ea12814da6974616b85262';
const DECISION_BYTES = 26344;
const PRODUCT_SCOPE_SHA256 = 'sha256:eb55e5c7493a419fef2f81d7809270c9c1ed8ec201b84d068cc5a7c7c56d1e9c';
const PRODUCT_SCOPE_BYTES = 80429;
const OWNER_NODE_ID = 'MDQ6VXNlcjc0MzE0OTg0';
const COMMENT_NODE_ID = /^IC_[A-Za-z0-9_-]+$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const TOP_LEVEL_KEYS = [
  'acceptanceTopology', 'affectedScopeIds', 'changeControlEffects', 'compatibility',
  'correction', 'decisionId', 'evidenceTopology', 'fieldOwnership',
  'humanDecisionOwner', 'implementation', 'lifecycle', 'migration', 'nonGoals',
  'observedProblem', 'parentDecision', 'roadmapImpact', 'schema', 'state',
  'summary', 'supersession', 'trackerMigration', 'validation', 'versions',
];
const EXCLUDED_CAPTURE_SCRIPTS = [
  'tests/evidence/capture-g0.5.mjs',
  'tests/evidence/capture-g1.0.mjs',
  'tests/evidence/capture-g1.1.mjs',
];
const PHASE_C_ROOTS = [
  'tests/evidence/tale-token-phase-c-g0.1/index.json',
  'tests/evidence/tale-token-phase-c-g0.2/index.json',
  'tests/evidence/tale-token-phase-c-g0.3/index.json',
  'tests/evidence/tale-token-phase-c-g0.4/index.json',
  'tests/evidence/tale-token-phase-c-g0.5/index.json',
  'tests/evidence/tale-token-phase-c-gate-0/index.json',
];
const PROOF_PATHS = [
  'packages/catalog/test',
  'packages/schema/test',
  'packages/tokens/test',
  'packages/tooling/test',
  'packages/web/test',
  'tests/evidence/capture-authority-39-default-theme-identity-supersessions.mjs',
  'tests/evidence/capture-g0.5.mjs',
  'tests/evidence/capture-g1.0.mjs',
  'tests/evidence/capture-g1.1.mjs',
  'tests/evidence/capture-tale-token-phase-c.mjs',
  'tests/fixtures/g1.0',
  'tooling/audits/repository-policy/test',
];
const AUTHORITY_SUPERSESSION_TARGETS = [
  'historical-g0.1', 'historical-g0.2', 'historical-g0.3', 'historical-g0.4',
  'historical-g0.5', 'historical-g1.0', 'historical-g1.1', 'historical-gate-0',
  'phase-a-g0.1', 'phase-a-g0.2', 'phase-a-g0.3', 'phase-a-g0.4',
  'phase-a-g0.5', 'phase-a-gate-0', 'phase-b-g0.1', 'phase-b-g0.2',
  'phase-b-g0.3', 'phase-b-g0.4', 'phase-b-g0.5', 'phase-b-gate-0',
];

export class DefaultThemeIdentityCorrectionError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'DefaultThemeIdentityCorrectionError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new DefaultThemeIdentityCorrectionError(code, message);
}

function exactKeys(value, expected, path) {
  const actual = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  if (canonicalJson(actual) !== canonicalJson([...expected].sort())) {
    fail('DEFAULT_THEME_IDENTITY_UNKNOWN_FIELD', `${path} has an invalid closed shape`);
  }
}

function exact(value, expected, code, path) {
  if (canonicalJson(value) !== canonicalJson(expected)) fail(code, `${path} is not exact`);
}

function strict(source, path) {
  try {
    return parseJsonStrict(source);
  } catch (error) {
    const code = error?.code === 'JSON_DUPLICATE_KEY'
      ? 'DEFAULT_THEME_IDENTITY_DUPLICATE_KEY'
      : 'DEFAULT_THEME_IDENTITY_JSON_INVALID';
    fail(code, `${path}: ${error.message}`);
  }
}

async function strictFile(path, label) {
  const source = await readFile(path, 'utf8');
  return { source, value: strict(source, label) };
}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function stringArray(value, path, { sorted = false } = {}) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    fail('DEFAULT_THEME_IDENTITY_VALUE_INVALID', `${path} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) fail('DEFAULT_THEME_IDENTITY_VALUE_INVALID', `${path} contains duplicates`);
  if (sorted && canonicalJson(value) !== canonicalJson([...value].sort(bytewise))) {
    fail('DEFAULT_THEME_IDENTITY_VALUE_INVALID', `${path} must be bytewise sorted`);
  }
}

function decodePointerSegment(segment) {
  if (/~(?![01])/u.test(segment)) fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', 'invalid JSON-pointer escape');
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function pointerSegments(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', `${pointer} is not a JSON pointer`);
  }
  return pointer.slice(1).split('/').map(decodePointerSegment);
}

function pointerValue(root, pointer) {
  let cursor = root;
  for (const segment of pointerSegments(pointer)) {
    if (cursor === null || typeof cursor !== 'object' || !Object.hasOwn(cursor, segment)) {
      fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', `${pointer} does not resolve in decision 0004`);
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function pointerContains(left, right) {
  const leftSegments = pointerSegments(left);
  const rightSegments = pointerSegments(right);
  return leftSegments.length <= rightSegments.length
    && leftSegments.every((segment, index) => segment === rightSegments[index]);
}

function gitBlobSha(source) {
  const bytes = Buffer.from(source);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function verifySupersession(decision, parent) {
  exactKeys(decision.supersession, ['profile', 'pointers', 'preservedPointers'], 'supersession');
  if (decision.supersession.profile !== 'core-ui-decision-json-pointer-supersession-v1') {
    fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', 'supersession.profile');
  }
  stringArray(decision.supersession.pointers, 'supersession.pointers', { sorted: true });
  stringArray(decision.supersession.preservedPointers, 'supersession.preservedPointers', { sorted: true });
  const pointers = [...decision.supersession.pointers, ...decision.supersession.preservedPointers];
  for (const pointer of pointers) pointerValue(parent, pointer);
  if (new Set(pointers).size !== pointers.length) fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', 'duplicate pointer');
  for (const [index, left] of pointers.entries()) {
    for (const right of pointers.slice(index + 1)) {
      if (pointerContains(left, right) || pointerContains(right, left)) {
        fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', `${left} overlaps ${right}`);
      }
    }
  }
  if (!decision.supersession.pointers.includes('/digests/finalTokenSource')) {
    fail('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', 'final source digest is not superseded');
  }
  exact(
    decision.compatibility.installedLocal.requiredFailures,
    parent.compatibility.installedLocal.requiredFailures,
    'DEFAULT_THEME_IDENTITY_COMPATIBILITY_INVALID',
    'referenced resolver failures',
  );
  exact(
    decision.compatibility.installedLocal.precedence,
    parent.compatibility.installedLocal.precedence,
    'DEFAULT_THEME_IDENTITY_COMPATIBILITY_INVALID',
    'referenced resolver precedence',
  );
}

async function verifyHistory(repositoryRoot, decision) {
  const history = decision.implementation.pathClassification.immutableHistory;
  const decision0002 = await readFile(join(repositoryRoot, history.decision0002.path), 'utf8');
  if (
    Buffer.byteLength(decision0002) !== history.decision0002.bytes
    || `sha256:${sha256(decision0002)}` !== history.decision0002.sha256
    || gitBlobSha(decision0002) !== history.decision0002.blob
  ) fail('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'decision 0002 identity');
  if (
    history.phaseBSource.path !== 'packages/tokens/fixtures/button-minimum-phase-b.json'
    || history.phaseBSource.blob !== '4a8069e92a1fc7b9240637342a60ea56af850d6f'
  ) fail('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'planned Phase B source identity');
  const phaseBSourcePath = join(repositoryRoot, history.phaseBSource.path);
  try {
    const phaseBSource = await readFile(phaseBSourcePath, 'utf8');
    if (gitBlobSha(phaseBSource) !== history.phaseBSource.blob) {
      fail('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'materialized Phase B source blob');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (
    history.phaseBInstalledCatalogTree.path !== 'tests/fixtures/tale-token-phase-b'
    || history.phaseBInstalledCatalogTree.tree !== 'b7368ec9a453dbe3fda5123a0280c4332c571094'
  ) fail('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'Phase B installed catalog tree');
  const manifest = history.prePhaseCEvidenceImmutableManifest;
  exactKeys(manifest, [
    'canonicalBytes', 'entryCount', 'excludedActiveCaptureScripts', 'profile',
    'repositoryRevision', 'repositoryTree', 'rule', 'sha256',
  ], 'immutable evidence manifest');
  if (
    manifest.profile !== 'core-ui-path-blob-manifest-v1'
    || manifest.entryCount !== 365
    || manifest.canonicalBytes !== 41967
    || manifest.sha256 !== 'sha256:b9d11445e282e5b86f85d1127deab667f5bfc41631675127bbb3b46cbf23bf18'
  ) fail('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'immutable evidence manifest identity');
  exact(manifest.excludedActiveCaptureScripts, EXCLUDED_CAPTURE_SCRIPTS, 'DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'editable capture scripts');
}

function verifyOwnershipAndTopology(decision) {
  const captureScript = 'tests/evidence/capture-tale-token-phase-c.mjs';
  exactKeys(decision.evidenceTopology, [
    'acceptanceSequence', 'authorityApplicabilitySupersession', 'captureRule',
    'captureScript', 'captureScriptOwner', 'phaseCProfile',
    'requiredAuthorityBindings', 'rootPaths',
  ], 'evidenceTopology');
  if (
    decision.evidenceTopology.captureScript !== captureScript
    || !decision.evidenceTopology.captureScriptOwner.startsWith('tests/ owns synthetic cross-package Phase C orchestration')
    || !decision.evidenceTopology.captureScriptOwner.endsWith('authors no product fact')
  ) fail('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', 'Phase C capture owner');
  const authority = decision.evidenceTopology.authorityApplicabilitySupersession;
  exactKeys(authority, [
    'authorizationPath', 'captureRule', 'captureScript', 'captureScriptOwner',
    'predecessorIndex', 'replacementPlan', 'rootPath', 'targetCount',
    'targetNames',
  ], 'evidenceTopology.authorityApplicabilitySupersession');
  if (
    !authority.captureScriptOwner.startsWith('tests/ owns append-only cross-package applicability-expiry orchestration')
    || !authority.captureScriptOwner.endsWith('authors no product fact')
  ) fail('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', 'authority applicability capture owner');
  if (
    authority.authorizationPath !== ACCEPTANCE_PATH
    || authority.captureScript !== 'tests/evidence/capture-authority-39-default-theme-identity-supersessions.mjs'
    || authority.predecessorIndex !== 'tests/evidence/authority-39-reset/index.json'
    || authority.rootPath !== 'tests/evidence/authority-39-default-theme-identity/index.json'
    || authority.targetCount !== AUTHORITY_SUPERSESSION_TARGETS.length
  ) fail('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'authority applicability topology');
  exact(authority.targetNames, AUTHORITY_SUPERSESSION_TARGETS, 'DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'authority supersession target names');
  exact(authority.replacementPlan, ['TALE-TOKEN-C', 'E-G1.0', 'E-G1.1'], 'DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'authority supersession replacement plan');
  if (decision.implementation.owner !== '@core-ui/tokens' || decision.implementation.module !== 'packages/tokens/src/default-theme-identity-migration.mjs') {
    fail('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', 'migration owner');
  }
  exact(decision.implementation.pathClassification.proofAndFixtures, PROOF_PATHS, 'DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', 'proofAndFixtures');
  stringArray(decision.implementation.pathClassification.proofAndFixtures, 'proofAndFixtures', { sorted: true });
  exact(decision.evidenceTopology.rootPaths, PHASE_C_ROOTS, 'DEFAULT_THEME_IDENTITY_HISTORY_INVALID', 'Phase C root paths');
}

function verifyIdentityAndVersions(decision) {
  if (
    decision.schema !== 'core-ui-token-source-identity-correction-v1'
    || decision.decisionId !== 'core-ui:decision:0005'
    || decision.state !== 'acceptance-candidate'
    || decision.humanDecisionOwner !== 'ndrewtran'
  ) fail('DEFAULT_THEME_IDENTITY_IDENTITY_INVALID', 'decision identity');
  const from = decision.correction.from;
  const to = decision.correction.to;
  if (
    from.path !== 'catalog/tokens/button-minimum.json'
    || from.artifactId !== 'core:token:button-minimum'
    || from.canonicalSourceSha256 !== 'sha256:670f2a45ada8c90b39e6de4bc4e6fef9e175313607c428067c21b7c2b1c5eac2'
    || to.path !== 'catalog/tokens/default-theme.json'
    || to.artifactId !== 'core:token:default-theme'
    || to.canonicalSourceSha256 !== 'sha256:01982f878f3f4b29bf889fcc0cc9577e1bde3fb69a646f1972e74dd8b9347757'
    || from.tokenCount !== 312
    || to.tokenCount !== 312
  ) fail('DEFAULT_THEME_IDENTITY_IDENTITY_INVALID', 'source identity transition');
  if (
    decision.versions.scopeVersion.from !== '3.0.0'
    || decision.versions.scopeVersion.to !== '4.0.0'
    || decision.versions.tokenContractVersion.from !== '2.0.0'
    || decision.versions.tokenContractVersion.to !== '2.0.0'
    || decision.versions.catalogVersion.from !== '1.0.0'
    || decision.versions.catalogVersion.to !== '2.0.0'
  ) fail('DEFAULT_THEME_IDENTITY_VERSION_INVALID', 'version transition');
  if (!decision.compatibility.installedLocal.historicalPositiveTuple.startsWith('tooling 1.0.0 + retained catalog package 0.2.0')) {
    fail('DEFAULT_THEME_IDENTITY_COMPATIBILITY_INVALID', 'historical installed tuple');
  }
  if (decision.affectedScopeIds.count !== 67 || decision.affectedScopeIds.sha256 !== 'sha256:c0c373a6efe0ca0355d7d6d6214dacc51a6f6a4c4c1c8a7fb61821663867eb65') {
    fail('DEFAULT_THEME_IDENTITY_SCOPE_INVALID', 'affected Scope ID identity');
  }
}

export function acceptanceCommentBody({ decisionSource, productScopeSource }) {
  return [
    'Accept default-theme token-source identity correction',
    `Decision path: ${DECISION_PATH}`,
    `Decision SHA-256: sha256:${sha256(decisionSource)}`,
    `Decision bytes: ${Buffer.byteLength(decisionSource)}`,
    `Product Scope path: ${PRODUCT_SCOPE_PATH}`,
    `Product Scope SHA-256: sha256:${sha256(productScopeSource)}`,
    `Product Scope bytes: ${Buffer.byteLength(productScopeSource)}`,
    'Decision: accepted',
    'Owner: ndrewtran',
    'Issue: #39',
  ].join('\n');
}

function acceptanceRecord(record, decisionSource, productScopeSource, acceptedSuccessor = false) {
  exactKeys(record, [
    'bodySha256', 'commentId', 'commentNodeId', 'createdAt', 'decisionId',
    'issueNumber', 'outcome', 'owner', 'ownerNodeId', 'provider', 'repository',
    'schema', 'url',
  ], 'acceptance record');
  const bodySha256 = acceptedSuccessor
    ? 'sha256:e80da20eae48bfb6347d520b7a13155e324c0d28dc46d1a6f8aee2798444c30a'
    : `sha256:${sha256(acceptanceCommentBody({ decisionSource, productScopeSource }))}`;
  if (
    record.schema !== 'core-ui-authority-decision-v1'
    || record.decisionId !== 'core-ui:decision:0005'
    || record.outcome !== 'accepted'
    || record.owner !== 'ndrewtran'
    || record.ownerNodeId !== OWNER_NODE_ID
    || record.provider !== 'github'
    || record.repository !== 'ndrewtran/core-ui'
    || record.issueNumber !== 39
    || record.bodySha256 !== bodySha256
  ) fail('DEFAULT_THEME_IDENTITY_ACCEPTANCE_INVALID', 'acceptance identity or digest binding');
  if (
    !Number.isSafeInteger(record.commentId)
    || record.commentId < 1
    || !COMMENT_NODE_ID.test(record.commentNodeId ?? '')
    || !RFC3339.test(record.createdAt ?? '')
    || Number.isNaN(Date.parse(record.createdAt))
    || record.url !== `https://github.com/ndrewtran/core-ui/issues/39#issuecomment-${record.commentId}`
  ) fail('DEFAULT_THEME_IDENTITY_ACCEPTANCE_INVALID', 'acceptance comment identity');
}

export function acceptanceRecordFromGitHubComment(comment, decisionSource, productScopeSource) {
  const body = acceptanceCommentBody({ decisionSource, productScopeSource });
  if (
    !Number.isSafeInteger(comment?.id)
    || comment.id < 1
    || !COMMENT_NODE_ID.test(comment?.node_id ?? '')
    || comment.body !== body
    || comment.user?.login !== 'ndrewtran'
    || comment.user?.node_id !== OWNER_NODE_ID
    || comment.author_association !== 'OWNER'
    || comment.issue_url !== 'https://api.github.com/repos/ndrewtran/core-ui/issues/39'
    || comment.html_url !== `https://github.com/ndrewtran/core-ui/issues/39#issuecomment-${comment.id}`
    || !RFC3339.test(comment.created_at ?? '')
    || Number.isNaN(Date.parse(comment.created_at))
  ) fail('DEFAULT_THEME_IDENTITY_ACCEPTANCE_INVALID', 'authenticated GitHub comment');
  return {
    bodySha256: `sha256:${sha256(body)}`,
    commentId: comment.id,
    commentNodeId: comment.node_id,
    createdAt: comment.created_at,
    decisionId: 'core-ui:decision:0005',
    issueNumber: 39,
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: OWNER_NODE_ID,
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-authority-decision-v1',
    url: comment.html_url,
  };
}

async function optionalAcceptance(repositoryRoot) {
  const path = join(repositoryRoot, ACCEPTANCE_PATH);
  try {
    await access(path);
  } catch {
    return null;
  }
  return strictFile(path, ACCEPTANCE_PATH);
}

export async function verifyDefaultThemeIdentityCorrection(repositoryRoot, options = {}) {
  const decisionDocument = options.decisionSource !== undefined
    ? { source: options.decisionSource, value: strict(options.decisionSource, DECISION_PATH) }
    : options.decisionValue !== undefined
      ? { source: canonicalJson(options.decisionValue), value: options.decisionValue }
      : await strictFile(join(repositoryRoot, DECISION_PATH), DECISION_PATH);
  const productScopeSource = options.productScopeSource
    ?? await readFile(join(repositoryRoot, PRODUCT_SCOPE_PATH), 'utf8');
  const parentDocument = await strictFile(join(repositoryRoot, PARENT_PATH), PARENT_PATH);
  const parentAcceptanceDocument = await strictFile(join(repositoryRoot, PARENT_ACCEPTANCE_PATH), PARENT_ACCEPTANCE_PATH);
  const decision = decisionDocument.value;
  exactKeys(decision, TOP_LEVEL_KEYS, '$');
  verifyIdentityAndVersions(decision);
  if (decisionDocument.source !== canonicalJson(decision)) {
    fail('DEFAULT_THEME_IDENTITY_JSON_INVALID', 'decision must use Core canonical JSON');
  }
  const originalProductScope = Buffer.byteLength(productScopeSource) === PRODUCT_SCOPE_BYTES
    && `sha256:${sha256(productScopeSource)}` === PRODUCT_SCOPE_SHA256
    && productScopeSource.startsWith('---\nscopeVersion: 4.0.0\n');
  if (!originalProductScope) {
    try {
      verifyPhaseCApplicabilityTopologyCorrection({ productScopeSource });
    } catch (error) {
      fail('DEFAULT_THEME_IDENTITY_AUTHORITY_MISMATCH', `Product Scope authority successor: ${error.message}`);
    }
  }
  if (
    decision.parentDecision.annexSha256 !== `sha256:${sha256(parentDocument.source)}`
    || decision.parentDecision.acceptanceSha256 !== `sha256:${sha256(parentAcceptanceDocument.source)}`
  ) fail('DEFAULT_THEME_IDENTITY_AUTHORITY_MISMATCH', 'decision 0004 identity');
  verifySupersession(decision, parentDocument.value);
  verifyOwnershipAndTopology(decision);
  await verifyHistory(repositoryRoot, decision);
  if (
    Buffer.byteLength(decisionDocument.source) !== DECISION_BYTES
    || `sha256:${sha256(decisionDocument.source)}` !== DECISION_SHA256
  ) fail('DEFAULT_THEME_IDENTITY_AUTHORITY_MISMATCH', 'decision candidate identity');

  let acceptanceDocument;
  if (options.acceptanceValue === null) acceptanceDocument = null;
  else if (options.acceptanceValue !== undefined) acceptanceDocument = { value: options.acceptanceValue };
  else acceptanceDocument = await optionalAcceptance(repositoryRoot);
  if (acceptanceDocument) acceptanceRecord(acceptanceDocument.value, decisionDocument.source, productScopeSource, !originalProductScope);
  if (options.requireAcceptance && !acceptanceDocument) {
    fail('DEFAULT_THEME_IDENTITY_ACCEPTANCE_REQUIRED', ACCEPTANCE_PATH);
  }
  return {
    accepted: Boolean(acceptanceDocument),
    authoritySupersessionRoot: decision.evidenceTopology.authorityApplicabilitySupersession.rootPath,
    authoritySupersessionTargets: decision.evidenceTopology.authorityApplicabilitySupersession.targetCount,
    currentArtifactId: decision.correction.to.artifactId,
    currentPath: decision.correction.to.path,
    immutableEvidenceEntries: decision.implementation.pathClassification.immutableHistory.prePhaseCEvidenceImmutableManifest.entryCount,
    phaseCRoots: decision.evidenceTopology.rootPaths.length,
    scopeVersion: decision.versions.scopeVersion.to,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  if (process.argv.includes('--acceptance-body')) {
    await verifyDefaultThemeIdentityCorrection(repositoryRoot, { acceptanceValue: null });
    const decisionSource = await readFile(join(repositoryRoot, DECISION_PATH), 'utf8');
    const productScopeSource = await readFile(join(repositoryRoot, PRODUCT_SCOPE_PATH), 'utf8');
    process.stdout.write(`${acceptanceCommentBody({ decisionSource, productScopeSource })}\n`);
  } else if (process.argv.includes('--record-from-comment')) {
    const index = process.argv.indexOf('--record-from-comment');
    const commentPath = process.argv[index + 1];
    if (!commentPath) fail('DEFAULT_THEME_IDENTITY_ACCEPTANCE_INVALID', 'missing comment JSON path');
    await verifyDefaultThemeIdentityCorrection(repositoryRoot, { acceptanceValue: null });
    const comment = strict(await readFile(commentPath, 'utf8'), commentPath);
    const decisionSource = await readFile(join(repositoryRoot, DECISION_PATH), 'utf8');
    const productScopeSource = await readFile(join(repositoryRoot, PRODUCT_SCOPE_PATH), 'utf8');
    process.stdout.write(`${canonicalJson(acceptanceRecordFromGitHubComment(comment, decisionSource, productScopeSource))}\n`);
  } else {
    const result = await verifyDefaultThemeIdentityCorrection(repositoryRoot, {
      requireAcceptance: process.argv.includes('--require-acceptance'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}
