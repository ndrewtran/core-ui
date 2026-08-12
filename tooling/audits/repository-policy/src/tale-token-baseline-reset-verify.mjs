import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict, validateFamily } from '@core-ui/schema';
import {
  correctTaleTokenClassification,
  materializeTaleTokenSource,
  TaleTokenMaterializationError,
} from '@core-ui/tokens/materialization';
import { migrateDefaultThemeIdentityValue } from '@core-ui/tokens/identity-migration';
import { RESOLVER_ERROR_PRECEDENCE } from '@core-ui/tooling/resolver';
import { verifyDefaultThemeIdentityCorrection } from './default-theme-identity-correction-verify.mjs';
import { sha256 } from './policy.mjs';

const ANNEX_PATH = 'decisions/0004-tale-only-reference-baseline-annex.json';
const ACCEPTANCE_PATH = 'decisions/0004-tale-only-reference-baseline-acceptance.json';
const ARCHITECTURE_PATH = 'strategy/monorepo-architecture.md';
const PRODUCT_SCOPE_PATH = 'strategy/product-scope.md';
const ACCEPTED_PRODUCT_SCOPE_BYTES = 73816;
const ACCEPTED_PRODUCT_SCOPE_SHA256 = 'sha256:c691b0bf0c3933ac7b91121f99904e911ea6439ad79badea9a491085bfe6f0e8';
const ACCEPTED_ARCHITECTURE_BYTES = 120566;
const ACCEPTED_ARCHITECTURE_SHA256 = 'sha256:5ce3f23769daf1a6b51f46ebf83ee38bf3b1c4f622f427b2d68ebf5966eecf04';
const PARENT_ANNEX_PATH = 'decisions/0003-tale-token-classification-annex.json';
const PARENT_ACCEPTANCE_PATH = 'decisions/0003-tale-token-classification-acceptance.json';
const TOKEN_SOURCE_PATH = 'catalog/tokens/default-theme.json';
const PHASE_B_SOURCE_PATH = 'packages/tokens/fixtures/button-minimum-phase-b.json';
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const SCOPE_ID = /^SCOPE-[A-Z0-9-]+$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const OWNER_NODE_ID = 'MDQ6VXNlcjc0MzE0OTg0';
const COMMENT_NODE_ID = /^IC_[A-Za-z0-9_-]+$/u;
const RESOLVER_FAILURE_DIMENSIONS = new Set([
  'binding-spec', 'catalog-digest', 'catalog-package-version',
  'catalog-provenance', 'export', 'lockfile', 'platform-safety', 'query-api',
  'release-manifest', 'renderer-package', 'schema', 'token',
]);

const TOP_LEVEL_KEYS = [
  'schema', 'decisionId', 'state', 'humanDecisionOwner', 'parentIssue',
  'observedWorkflow', 'productOutcome', 'parentDecision', 'supersession',
  'fieldOwnership', 'classificationDelta', 'removals', 'semanticMappings', 'semanticRecipeEffect',
  'versions', 'compatibility', 'migration', 'affectedScopeIds',
  'scopeEffectRationale', 'roadmapImpact', 'evidenceTopology',
  'trackerMigration', 'nonGoals', 'summary', 'digests', 'acceptanceTopology',
];

export class TaleTokenBaselineResetError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'TaleTokenBaselineResetError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new TaleTokenBaselineResetError(code, message);
}

function exactKeys(value, expected, path) {
  const actual = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  if (canonicalJson(actual) !== canonicalJson([...expected].sort())) {
    fail('TALE_RESET_UNKNOWN_FIELD', `${path} has an invalid closed shape`);
  }
}

function exact(value, expected, code, path) {
  if (canonicalJson(value) !== canonicalJson(expected)) fail(code, `${path} is not exact`);
}

function digest(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function strict(source, path) {
  try {
    return parseJsonStrict(source);
  } catch (error) {
    fail(error?.code === 'JSON_DUPLICATE_KEY' ? 'TALE_RESET_DUPLICATE_KEY' : 'TALE_RESET_JSON_INVALID', `${path}: ${error.message}`);
  }
}

async function strictFile(path, label) {
  const bytes = await readFile(path, 'utf8');
  return { bytes, value: strict(bytes, label) };
}

function nonEmpty(value, path) {
  if (typeof value !== 'string' || value.length === 0) fail('TALE_RESET_VALUE_INVALID', `${path} must be a non-empty string`);
}

function stringArray(value, path, { sorted = false, pattern = null } = {}) {
  if (!Array.isArray(value) || value.length === 0) fail('TALE_RESET_VALUE_INVALID', `${path} must be a non-empty array`);
  for (const [index, item] of value.entries()) {
    nonEmpty(item, `${path}[${index}]`);
    if (pattern && !pattern.test(item)) fail('TALE_RESET_VALUE_INVALID', `${path}[${index}] has an invalid value`);
  }
  if (new Set(value).size !== value.length) fail('TALE_RESET_VALUE_INVALID', `${path} contains duplicates`);
  if (sorted && canonicalJson(value) !== canonicalJson([...value].sort(bytewise))) fail('TALE_RESET_VALUE_INVALID', `${path} must be bytewise sorted`);
}

function safePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) fail('TALE_RESET_VALUE_INVALID', `${path} must be a positive safe integer`);
}

function semver(value, path) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/u.test(value)) fail('TALE_RESET_VERSION_MISMATCH', `${path} must be SemVer`);
}

function transition(value, path, { nullable = false } = {}) {
  exactKeys(value, ['from', 'to', 'effect'], path);
  for (const key of ['from', 'to']) {
    if (nullable && value[key] === null) continue;
    semver(value[key], `${path}.${key}`);
  }
  nonEmpty(value.effect, `${path}.effect`);
}

function pointerSegments(pointer, path) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) fail('TALE_RESET_SUPERSESSION_MISMATCH', `${path} is not a JSON pointer`);
  const encodedSegments = pointer.slice(1).split('/');
  if (encodedSegments.some((segment) => /~(?![01])/u.test(segment))) fail('TALE_RESET_SUPERSESSION_MISMATCH', `${path} has an invalid JSON-pointer escape`);
  return encodedSegments.map((encoded) => encoded.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function pointerValue(value, pointer, path) {
  let cursor = value;
  for (const key of pointerSegments(pointer, path)) {
    if (!cursor || typeof cursor !== 'object' || !Object.hasOwn(cursor, key)) fail('TALE_RESET_SUPERSESSION_MISMATCH', `${path} does not resolve in decision 0003`);
    cursor = cursor[key];
  }
  return cursor;
}

function pointerContains(left, right) {
  const leftSegments = pointerSegments(left, left);
  const rightSegments = pointerSegments(right, right);
  return leftSegments.length <= rightSegments.length
    && leftSegments.every((segment, index) => segment === rightSegments[index]);
}

function packageNameForScope(scopeId) {
  return `@core-ui/${scopeId.slice('SCOPE-PKG-'.length).toLowerCase()}`;
}

function rendererPackageForScope(scopeId) {
  return {
    'SCOPE-PLATFORM-WEB-HTML': '@core-ui/web',
    'SCOPE-PLATFORM-WEB-REACT': '@core-ui/react',
    'SCOPE-PLATFORM-NATIVE-RN': '@core-ui/react-native',
  }[scopeId] ?? null;
}

function verifyClassificationDelta(delta, parent) {
  exactKeys(delta, ['profile', 'deferralReason', 'deferrals', 'renames', 'deferredTargets', 'retainedTargets', 'consumptionBoundary'], 'classificationDelta');
  for (const key of ['profile', 'deferralReason', 'consumptionBoundary']) nonEmpty(delta[key], `classificationDelta.${key}`);
  if (delta.profile !== 'core-ui-tale-reference-family-correction-v1') fail('TALE_RESET_CLASSIFICATION_MISMATCH', 'classificationDelta.profile');
  if (!Array.isArray(delta.deferrals) || delta.deferrals.length === 0 || !Array.isArray(delta.renames) || delta.renames.length === 0) fail('TALE_RESET_CLASSIFICATION_MISMATCH', 'classification delta families');
  const claimedOrdinals = new Set();
  for (const [index, rule] of delta.deferrals.entries()) {
    exactKeys(rule, ['family', 'ordinalFrom', 'ordinalTo', 'previousCoreIdPrefix'], `classificationDelta.deferrals[${index}]`);
    for (const key of ['family', 'previousCoreIdPrefix']) nonEmpty(rule[key], `classificationDelta.deferrals[${index}].${key}`);
    if (rule.previousCoreIdPrefix !== `reference.color.${rule.family}-`) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `classificationDelta.deferrals[${index}] family/prefix relation`);
    safePositiveInteger(rule.ordinalFrom, `classificationDelta.deferrals[${index}].ordinalFrom`);
    safePositiveInteger(rule.ordinalTo, `classificationDelta.deferrals[${index}].ordinalTo`);
    if (rule.ordinalTo < rule.ordinalFrom) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `classificationDelta.deferrals[${index}] range`);
    for (let ordinal = rule.ordinalFrom; ordinal <= rule.ordinalTo; ordinal += 1) {
      if (claimedOrdinals.has(ordinal)) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `ordinal ${ordinal} is changed twice`);
      claimedOrdinals.add(ordinal);
    }
  }
  for (const [index, rule] of delta.renames.entries()) {
    exactKeys(rule, ['family', 'ordinalFrom', 'ordinalTo', 'previousCoreIdPrefix', 'resultCoreIdPrefix', 'meaningTemplate'], `classificationDelta.renames[${index}]`);
    for (const key of ['family', 'previousCoreIdPrefix', 'resultCoreIdPrefix', 'meaningTemplate']) nonEmpty(rule[key], `classificationDelta.renames[${index}].${key}`);
    if (rule.resultCoreIdPrefix !== `reference.color.${rule.family}-`) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `classificationDelta.renames[${index}] family/prefix relation`);
    if (rule.previousCoreIdPrefix === rule.resultCoreIdPrefix || rule.meaningTemplate.split('{step}').length !== 3) fail('TALE_RESET_MEANING_MISMATCH', `classificationDelta.renames[${index}] template`);
    safePositiveInteger(rule.ordinalFrom, `classificationDelta.renames[${index}].ordinalFrom`);
    safePositiveInteger(rule.ordinalTo, `classificationDelta.renames[${index}].ordinalTo`);
    if (rule.ordinalTo < rule.ordinalFrom) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `classificationDelta.renames[${index}] range`);
    for (let ordinal = rule.ordinalFrom; ordinal <= rule.ordinalTo; ordinal += 1) {
      if (claimedOrdinals.has(ordinal)) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `ordinal ${ordinal} is changed twice`);
      claimedOrdinals.add(ordinal);
    }
  }
  for (const [label, values] of [
    ['deferral families', delta.deferrals.map(({ family }) => family)],
    ['deferral prefixes', delta.deferrals.map(({ previousCoreIdPrefix }) => previousCoreIdPrefix)],
    ['rename families', delta.renames.map(({ family }) => family)],
    ['rename previous prefixes', delta.renames.map(({ previousCoreIdPrefix }) => previousCoreIdPrefix)],
    ['rename result prefixes', delta.renames.map(({ resultCoreIdPrefix }) => resultCoreIdPrefix)],
  ]) if (new Set(values).size !== values.length) fail('TALE_RESET_CLASSIFICATION_MISMATCH', `duplicate ${label}`);
  const targetNames = Object.keys(parent.targetProfiles).filter((name) => name.includes('.')).sort(bytewise);
  exactKeys(delta.deferredTargets, targetNames, 'classificationDelta.deferredTargets');
  exactKeys(delta.retainedTargets, targetNames, 'classificationDelta.retainedTargets');
  for (const target of targetNames) {
    if (delta.deferredTargets[target] !== 'deferred') fail('TALE_RESET_TARGET_MISMATCH', `classificationDelta.deferredTargets.${target}`);
    const expectedRetained = target === 'native.react-native-web' ? 'deferred' : 'direct';
    if (delta.retainedTargets[target] !== expectedRetained) fail('TALE_RESET_TARGET_MISMATCH', `classificationDelta.retainedTargets.${target}`);
  }
}

function verifyGrammar(annex, parent, productScopeBytes) {
  nonEmpty(annex.observedWorkflow, 'observedWorkflow');
  nonEmpty(annex.productOutcome, 'productOutcome');

  exactKeys(annex.supersession, ['profile', 'pointers', 'preservedPointers'], 'supersession');
  nonEmpty(annex.supersession.profile, 'supersession.profile');
  stringArray(annex.supersession.pointers, 'supersession.pointers', { sorted: true });
  stringArray(annex.supersession.preservedPointers, 'supersession.preservedPointers', { sorted: true });
  const superseded = new Set(annex.supersession.pointers);
  for (const [index, pointer] of annex.supersession.pointers.entries()) pointerValue(parent, pointer, `supersession.pointers[${index}]`);
  for (const [index, pointer] of annex.supersession.preservedPointers.entries()) {
    pointerValue(parent, pointer, `supersession.preservedPointers[${index}]`);
    if (superseded.has(pointer)) fail('TALE_RESET_SUPERSESSION_MISMATCH', `${pointer} is both preserved and superseded`);
  }
  const pointerClaims = [...annex.supersession.pointers, ...annex.supersession.preservedPointers];
  for (const [index, left] of pointerClaims.entries()) {
    for (const right of pointerClaims.slice(index + 1)) {
      if (pointerContains(left, right) || pointerContains(right, left)) fail('TALE_RESET_SUPERSESSION_MISMATCH', `${left} overlaps ${right}`);
    }
  }

  exactKeys(annex.fieldOwnership, ['authored', 'referenced', 'derived', 'proofRequired'], 'fieldOwnership');
  for (const name of Object.keys(annex.fieldOwnership)) stringArray(annex.fieldOwnership[name], `fieldOwnership.${name}`);
  const ownershipEntries = Object.values(annex.fieldOwnership).flat();
  if (new Set(ownershipEntries).size !== ownershipEntries.length) fail('TALE_RESET_OWNERSHIP_MISMATCH', 'field ownership categories overlap');
  if (!annex.fieldOwnership.authored.includes('classificationDelta')) fail('TALE_RESET_OWNERSHIP_MISMATCH', 'classificationDelta must be authored');

  verifyClassificationDelta(annex.classificationDelta, parent);

  exactKeys(annex.semanticRecipeEffect, ['authorizedExpansion', 'reason', 'newSemanticIds', 'newComponentIds'], 'semanticRecipeEffect');
  stringArray(annex.semanticRecipeEffect.authorizedExpansion, 'semanticRecipeEffect.authorizedExpansion');
  nonEmpty(annex.semanticRecipeEffect.reason, 'semanticRecipeEffect.reason');
  if (!Number.isSafeInteger(annex.semanticRecipeEffect.newSemanticIds) || !Number.isSafeInteger(annex.semanticRecipeEffect.newComponentIds)) fail('TALE_RESET_MODE_MISMATCH', 'recipe counts');

  exactKeys(annex.versions, ['scopeVersion', 'tokenContractVersion', 'catalogVersion', 'queryApiVersion', 'tokenSourceSchemaVersion', 'commandRegistrySchemaVersion', 'catalogPackageSchema', 'packages', 'publicationClaim'], 'versions');
  for (const name of ['scopeVersion', 'tokenContractVersion', 'catalogVersion', 'queryApiVersion', 'tokenSourceSchemaVersion', 'commandRegistrySchemaVersion']) transition(annex.versions[name], `versions.${name}`);
  exactKeys(annex.versions.catalogPackageSchema, ['from', 'to', 'effect'], 'versions.catalogPackageSchema');
  for (const name of ['from', 'to', 'effect']) nonEmpty(annex.versions.catalogPackageSchema[name], `versions.catalogPackageSchema.${name}`);
  const expectedPackageNames = annex.affectedScopeIds
    .filter((id) => id.startsWith('SCOPE-PKG-'))
    .map(packageNameForScope)
    .sort(bytewise);
  exact(Object.keys(annex.versions.packages).sort(bytewise), expectedPackageNames, 'TALE_RESET_VERSION_MISMATCH', 'versions.packages keys');
  for (const [name, value] of Object.entries(annex.versions.packages)) transition(value, `versions.packages.${name}`, { nullable: name === '@core-ui/react-native' });
  nonEmpty(annex.versions.publicationClaim, 'versions.publicationClaim');

  exactKeys(annex.compatibility, ['currentCatalog', 'historicalTokenContract', 'rendererTokenContractRanges', 'installedLocal'], 'compatibility');
  exactKeys(annex.compatibility.currentCatalog, ['catalogVersion', 'queryApiVersion', 'supportedQueryApiVersions', 'tokenContractVersion', 'tokenCount', 'behavior'], 'compatibility.currentCatalog');
  for (const key of ['catalogVersion', 'queryApiVersion', 'tokenContractVersion']) semver(annex.compatibility.currentCatalog[key], `compatibility.currentCatalog.${key}`);
  safePositiveInteger(annex.compatibility.currentCatalog.tokenCount, 'compatibility.currentCatalog.tokenCount');
  nonEmpty(annex.compatibility.currentCatalog.behavior, 'compatibility.currentCatalog.behavior');
  stringArray(annex.compatibility.currentCatalog.supportedQueryApiVersions, 'compatibility.currentCatalog.supportedQueryApiVersions');
  for (const [index, version] of annex.compatibility.currentCatalog.supportedQueryApiVersions.entries()) semver(version, `compatibility.currentCatalog.supportedQueryApiVersions[${index}]`);
  exact(annex.compatibility.currentCatalog.supportedQueryApiVersions, parent.queryCompatibility.request.allowed, 'TALE_RESET_COMPATIBILITY_MISMATCH', 'supported query API versions');
  if (!annex.compatibility.currentCatalog.supportedQueryApiVersions.includes(annex.compatibility.currentCatalog.queryApiVersion)) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'current query API version is not supported');
  exactKeys(annex.compatibility.historicalTokenContract, ['tokenContractVersion', 'catalogVersion', 'catalogPackageVersion', 'catalogDigest', 'catalogSourceRevision', 'repositoryRevision', 'repositoryTree', 'selection', 'behavior'], 'compatibility.historicalTokenContract');
  if (!SHA256.test(annex.compatibility.historicalTokenContract.catalogDigest) || !SHA256.test(annex.compatibility.historicalTokenContract.catalogSourceRevision)) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'historical catalog digest');
  for (const key of ['repositoryRevision', 'repositoryTree']) if (!/^[0-9a-f]{40}$/u.test(annex.compatibility.historicalTokenContract[key])) fail('TALE_RESET_COMPATIBILITY_MISMATCH', key);
  const rendererRangeNames = Object.keys(annex.compatibility.rendererTokenContractRanges).sort(bytewise);
  const expectedRendererNames = annex.affectedScopeIds.map(rendererPackageForScope).filter(Boolean).map((name) => {
    const transitionPlan = annex.versions.packages[name];
    if (!transitionPlan) fail('TALE_RESET_COMPATIBILITY_MISMATCH', `missing renderer package transition ${name}`);
    return transitionPlan.from === null && transitionPlan.to === null ? `future ${name}` : name;
  }).sort(bytewise);
  exact(rendererRangeNames, expectedRendererNames, 'TALE_RESET_COMPATIBILITY_MISMATCH', 'renderer token-contract range keys');
  const expectedRendererRange = `^${annex.versions.tokenContractVersion.to}`;
  for (const [name, value] of Object.entries(annex.compatibility.rendererTokenContractRanges)) {
    if (value !== expectedRendererRange) fail('TALE_RESET_COMPATIBILITY_MISMATCH', `renderer range ${name}`);
  }
  exactKeys(annex.compatibility.installedLocal, ['toolingPackageVersion', 'selectedCatalogPackageVersion', 'requiredPositiveTuples', 'requiredFailures', 'precedence'], 'compatibility.installedLocal');
  stringArray(annex.compatibility.installedLocal.requiredPositiveTuples, 'compatibility.installedLocal.requiredPositiveTuples');
  if (!Array.isArray(annex.compatibility.installedLocal.requiredFailures) || annex.compatibility.installedLocal.requiredFailures.length === 0) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'required failures');
  const failureCodes = [];
  for (const [index, failure] of annex.compatibility.installedLocal.requiredFailures.entries()) {
    exactKeys(failure, ['code', 'dimensions'], `compatibility.installedLocal.requiredFailures[${index}]`);
    if (!RESOLVER_ERROR_PRECEDENCE.includes(failure.code)) fail('TALE_RESET_COMPATIBILITY_MISMATCH', `unknown resolver code ${failure.code}`);
    stringArray(failure.dimensions, `compatibility.installedLocal.requiredFailures[${index}].dimensions`, { sorted: true });
    if (!failure.dimensions.every((dimension) => RESOLVER_FAILURE_DIMENSIONS.has(dimension))) fail('TALE_RESET_COMPATIBILITY_MISMATCH', `unknown resolver dimension for ${failure.code}`);
    failureCodes.push(failure.code);
  }
  if (new Set(failureCodes).size !== failureCodes.length) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'duplicate resolver failure code');
  exact(annex.compatibility.installedLocal.precedence, RESOLVER_ERROR_PRECEDENCE, 'TALE_RESET_COMPATIBILITY_MISMATCH', 'resolver error precedence');

  exactKeys(annex.migration, ['profile', 'owner', 'implementationOwner', 'input', 'procedure', 'failures', 'rollback'], 'migration');
  exactKeys(annex.migration.input, ['tokenSourcePath', 'tokenSourceFileSha256', 'tokenCount', 'tokenContractVersion', 'repositoryRevision', 'repositoryTree', 'parentDecisionAnnexSha256', 'parentDecisionAcceptanceSha256', 'historicalCatalogDigest', 'historicalCatalogSourceRevision', 'finalTokenSourceCanonicalDigest', 'finalTokenSourceCanonicalProfile'], 'migration.input');
  for (const key of ['tokenSourceFileSha256', 'parentDecisionAnnexSha256', 'parentDecisionAcceptanceSha256', 'historicalCatalogDigest', 'historicalCatalogSourceRevision', 'finalTokenSourceCanonicalDigest']) if (!SHA256.test(annex.migration.input[key])) fail('TALE_RESET_MIGRATION_MISMATCH', key);
  nonEmpty(annex.migration.input.finalTokenSourceCanonicalProfile, 'migration.input.finalTokenSourceCanonicalProfile');
  stringArray(annex.migration.procedure, 'migration.procedure');
  stringArray(annex.migration.failures, 'migration.failures');
  exactKeys(annex.migration.rollback, ['profile', 'input', 'result', 'repeatBehavior', 'idempotent', 'readRewrite'], 'migration.rollback');
  if (annex.migration.rollback.idempotent !== true || annex.migration.rollback.readRewrite !== false) fail('TALE_RESET_MIGRATION_MISMATCH', 'rollback behavior');

  stringArray(annex.affectedScopeIds, 'affectedScopeIds', { sorted: true, pattern: SCOPE_ID });
  if (!annex.affectedScopeIds.every((id) => productScopeBytes.includes(`\`${id}\``))) fail('TALE_RESET_SCOPE_MISMATCH', 'scope authority reference');
  for (const [id, reason] of Object.entries(annex.scopeEffectRationale)) {
    if (!annex.affectedScopeIds.includes(id)) fail('TALE_RESET_SCOPE_MISMATCH', `scope rationale ${id} is not affected`);
    nonEmpty(reason, `scopeEffectRationale.${id}`);
  }
  exactKeys(annex.roadmapImpact, ['textAmendment', 'affectedMilestones', 'downstreamEffect'], 'roadmapImpact');
  stringArray(annex.roadmapImpact.affectedMilestones, 'roadmapImpact.affectedMilestones');
  nonEmpty(annex.roadmapImpact.textAmendment, 'roadmapImpact.textAmendment');
  nonEmpty(annex.roadmapImpact.downstreamEffect, 'roadmapImpact.downstreamEffect');
  exactKeys(annex.evidenceTopology, ['phaseA', 'phaseB', 'draftPullRequest47', 'replacementPhaseC', 'afterPhaseC'], 'evidenceTopology');
  for (const [name, value] of Object.entries(annex.evidenceTopology)) nonEmpty(value, `evidenceTopology.${name}`);
  exactKeys(annex.trackerMigration, ['beforeAcceptance', 'afterAcceptance', 'statusSource'], 'trackerMigration');
  exactKeys(annex.trackerMigration.beforeAcceptance, ['issue39Status', 'issue46Status', 'issue46BlockedBy', 'pullRequest47'], 'trackerMigration.beforeAcceptance');
  exactKeys(annex.trackerMigration.afterAcceptance, ['issue39Status', 'issue46Status', 'pullRequest47', 'projectReadme', 'decisionBearingFields', 'linkedPullRequest'], 'trackerMigration.afterAcceptance');
  stringArray(annex.trackerMigration.afterAcceptance.decisionBearingFields, 'trackerMigration.afterAcceptance.decisionBearingFields');
  stringArray(annex.nonGoals, 'nonGoals');
  exactKeys(annex.summary, ['sourceOccurrenceCount', 'dispositionCounts', 'deferredNeutralOccurrenceCount', 'renamedReferenceTokenCount', 'addedTaleReferenceTokenCount', 'reusedExistingReferenceTokenCount', 'removedReferenceTokenCount', 'finalReferenceTokenCount', 'semanticTokenCount', 'componentTokenCount', 'finalTokenCount', 'newSemanticIds', 'newComponentIds', 'authorizedSemanticModeBranches', 'affectedScopeCount', 'affectedMilestoneCount', 'supersededPointerCount'], 'summary');
  exactKeys(annex.summary.dispositionCounts, ['adopt', 'adapt', 'defer', 'reject'], 'summary.dispositionCounts');
  exactKeys(annex.acceptanceTopology, ['annexPath', 'architecturePath', 'productScopePath', 'receiptPath', 'requiredOwnerComment', 'implementationBoundary'], 'acceptanceTopology');
  if (annex.acceptanceTopology.annexPath !== ANNEX_PATH || annex.acceptanceTopology.architecturePath !== ARCHITECTURE_PATH || annex.acceptanceTopology.productScopePath !== PRODUCT_SCOPE_PATH || annex.acceptanceTopology.receiptPath !== ACCEPTANCE_PATH) fail('TALE_RESET_ACCEPTANCE_INVALID', 'acceptance paths');
}

function tokenOwned(operation) {
  try {
    return operation();
  } catch (error) {
    if (!(error instanceof TaleTokenMaterializationError)) throw error;
    const code = {
      CORE_TALE_RESET_ALIAS_MISMATCH: 'TALE_RESET_ALIAS_MISMATCH',
      CORE_TALE_RESET_ALIAS_STALE: 'TALE_RESET_ALIAS_MISMATCH',
      CORE_TALE_RESET_CLASSIFICATION_MISMATCH: 'TALE_RESET_CLASSIFICATION_MISMATCH',
      CORE_TALE_RESET_DECISION_MISMATCH: 'TALE_RESET_PARENT_MISMATCH',
      CORE_TALE_RESET_FINAL_IDENTITY_MISMATCH: 'TALE_RESET_DIGEST_MISMATCH',
      CORE_TALE_RESET_MEANING_MISMATCH: 'TALE_RESET_MEANING_MISMATCH',
      CORE_TALE_RESET_MODE_MISMATCH: 'TALE_RESET_MODE_MISMATCH',
      CORE_TALE_RESET_REMOVAL_EXTRA: 'TALE_RESET_REMOVAL_SET_MISMATCH',
      CORE_TALE_RESET_REMOVAL_MISSING: 'TALE_RESET_REMOVAL_MISSING',
      CORE_TALE_RESET_TARGET_MISMATCH: 'TALE_RESET_TARGET_MISMATCH',
      CORE_TALE_RESET_TOKEN_COLLISION: 'TALE_RESET_TOKEN_COLLISION',
    }[error.code] ?? 'TALE_RESET_PARENT_MISMATCH';
    fail(code, error.message);
  }
}

function verifyRemovalAndMappingClosure(annex, base, parent) {
  const baseReferenceIds = Object.keys(base.tokens).filter((id) => id.startsWith('reference.')).sort(bytewise);
  const removalIds = annex.removals.map(({ id }) => id);
  exact(removalIds, baseReferenceIds.filter((id) => id !== 'reference.duration.fast'), 'TALE_RESET_REMOVAL_SET_MISMATCH', 'removals');
  if (new Set(removalIds).size !== removalIds.length) fail('TALE_RESET_REMOVAL_SET_MISMATCH', 'duplicate removal');
  const correctedParent = tokenOwned(() => correctTaleTokenClassification(parent, annex));
  const admittedDefinitions = new Map(correctedParent.coreTokens.map(({ id, definition }) => [id, definition]));
  for (const [index, removal] of annex.removals.entries()) {
    exactKeys(removal, removal.modeReplacements ? ['id', 'replacement', 'modeReplacements'] : ['id', 'replacement'], `removals[${index}]`);
    if (!admittedDefinitions.has(removal.replacement)) fail('TALE_RESET_REPLACEMENT_INVALID', removal.replacement);
    if (removal.modeReplacements !== undefined) {
      exactKeys(removal.modeReplacements, Object.keys(removal.modeReplacements), `removals[${index}].modeReplacements`);
      for (const [mode, target] of Object.entries(removal.modeReplacements)) {
        const [axis, value] = mode.split('.');
        if (!base.theme.modeAxes[axis]?.includes(value) || !admittedDefinitions.has(target)) fail('TALE_RESET_MODE_MISMATCH', mode);
      }
    }
  }
  const semanticIds = Object.keys(base.tokens).filter((id) => id.startsWith('semantic.')).sort(bytewise);
  const mappedIds = annex.semanticMappings.map(({ id }) => id);
  exact(mappedIds, semanticIds, 'TALE_RESET_ALIAS_SET_MISMATCH', 'semanticMappings');
  for (const [index, mapping] of annex.semanticMappings.entries()) {
    exactKeys(mapping, ['id', 'alias', 'modes'], `semanticMappings[${index}]`);
    const semantic = base.tokens[mapping.id];
    const defaultTarget = admittedDefinitions.get(mapping.alias);
    if (!defaultTarget || defaultTarget.type !== semantic.type || defaultTarget.unit !== semantic.unit) fail('TALE_RESET_ALIAS_MISMATCH', mapping.alias);
    exactKeys(mapping.modes, Object.keys(mapping.modes), `semanticMappings[${index}].modes`);
    for (const [mode, branch] of Object.entries(mapping.modes)) {
      const [axis, value] = mode.split('.');
      if (!base.theme.modeAxes[axis]?.includes(value)) fail('TALE_RESET_MODE_MISMATCH', mode);
      exactKeys(branch, ['alias'], `semanticMappings[${index}].modes.${mode}`);
      const target = admittedDefinitions.get(branch.alias);
      if (!target || target.type !== semantic.type || target.unit !== semantic.unit) fail('TALE_RESET_ALIAS_MISMATCH', branch.alias);
    }
  }
  const expansions = annex.semanticMappings.flatMap((mapping) => Object.keys(mapping.modes)
    .filter((mode) => !Object.hasOwn(base.tokens[mapping.id].modes ?? {}, mode))
    .map((mode) => `${mapping.id}#/modes/${mode}`));
  exact(annex.semanticRecipeEffect.authorizedExpansion, expansions, 'TALE_RESET_MODE_MISMATCH', 'authorized semantic expansion');
  return { authorizedExpansionCount: expansions.length };
}

export function acceptanceCommentBody({ annexBytes, annexSha256, architectureBytes, architectureSha256, productScopeBytes, productScopeSha256 }) {
  return [
    'Accept Tale-only Core reference baseline correction',
    `Annex path: ${ANNEX_PATH}`,
    `Annex SHA-256: ${annexSha256}`,
    `Annex bytes: ${annexBytes}`,
    `Architecture path: ${ARCHITECTURE_PATH}`,
    `Architecture SHA-256: ${architectureSha256}`,
    `Architecture bytes: ${architectureBytes}`,
    `Product Scope path: ${PRODUCT_SCOPE_PATH}`,
    `Product Scope SHA-256: ${productScopeSha256}`,
    `Product Scope bytes: ${productScopeBytes}`,
    'Decision: accepted',
    'Owner: ndrewtran',
    'Issue: #39',
  ].join('\n');
}

function verifyAcceptance(record, annexBytes, architectureBytes, acceptedSuccessor = false) {
  exactKeys(record, ['schema', 'decisionId', 'outcome', 'owner', 'ownerNodeId', 'provider', 'repository', 'issueNumber', 'commentId', 'commentNodeId', 'createdAt', 'url', 'bodySha256'], 'acceptance record');
  const body = acceptanceCommentBody({
    annexBytes: Buffer.byteLength(annexBytes), annexSha256: `sha256:${sha256(annexBytes)}`,
    architectureBytes: acceptedSuccessor ? ACCEPTED_ARCHITECTURE_BYTES : Buffer.byteLength(architectureBytes),
    architectureSha256: acceptedSuccessor ? ACCEPTED_ARCHITECTURE_SHA256 : `sha256:${sha256(architectureBytes)}`,
    productScopeBytes: ACCEPTED_PRODUCT_SCOPE_BYTES,
    productScopeSha256: ACCEPTED_PRODUCT_SCOPE_SHA256,
  });
  if (record.schema !== 'core-ui-authority-decision-v1' || record.decisionId !== 'core-ui:decision:0004' || record.outcome !== 'accepted' || record.owner !== 'ndrewtran' || record.ownerNodeId !== OWNER_NODE_ID || record.provider !== 'github' || record.repository !== 'ndrewtran/core-ui' || record.issueNumber !== 39 || record.bodySha256 !== `sha256:${sha256(body)}`) fail('TALE_RESET_ACCEPTANCE_INVALID', 'identity or digest binding');
  if (!Number.isSafeInteger(record.commentId) || record.commentId < 1 || !COMMENT_NODE_ID.test(record.commentNodeId ?? '') || !RFC3339.test(record.createdAt ?? '') || Number.isNaN(Date.parse(record.createdAt)) || record.url !== `https://github.com/ndrewtran/core-ui/issues/39#issuecomment-${record.commentId}`) fail('TALE_RESET_ACCEPTANCE_INVALID', 'comment identity');
}

export async function verifyTaleTokenBaselineReset(repositoryRoot, options = {}) {
  const annexDocument = options.annexValue
    ? { value: options.annexValue, bytes: options.annexBytes ?? canonicalJson(options.annexValue) }
    : await strictFile(join(repositoryRoot, ANNEX_PATH), ANNEX_PATH);
  const parentDocument = await strictFile(join(repositoryRoot, PARENT_ANNEX_PATH), PARENT_ANNEX_PATH);
  const parentAcceptance = await strictFile(join(repositoryRoot, PARENT_ACCEPTANCE_PATH), PARENT_ACCEPTANCE_PATH);
  const baseDocument = await strictFile(join(repositoryRoot, PHASE_B_SOURCE_PATH), PHASE_B_SOURCE_PATH);
  const currentDocument = await strictFile(join(repositoryRoot, TOKEN_SOURCE_PATH), TOKEN_SOURCE_PATH);
  const base = baseDocument.value;
  const architectureBytes = await readFile(join(repositoryRoot, ARCHITECTURE_PATH), 'utf8');
  const productScopeBytes = await readFile(join(repositoryRoot, PRODUCT_SCOPE_PATH), 'utf8');
  const annex = annexDocument.value;

  exactKeys(annex, TOP_LEVEL_KEYS, '$');
  if (annex.schema !== 'core-ui-tale-token-baseline-reset-annex-v1' || annex.decisionId !== 'core-ui:decision:0004' || annex.state !== 'acceptance-candidate' || annex.humanDecisionOwner !== 'ndrewtran' || annex.parentIssue !== 39) fail('TALE_RESET_IDENTITY_INVALID', 'candidate identity');
  exactKeys(annex.parentDecision, ['decisionId', 'annexPath', 'annexSha256', 'acceptancePath', 'acceptanceSha256'], 'parentDecision');
  if (annex.parentDecision.decisionId !== 'core-ui:decision:0003' || annex.parentDecision.annexPath !== PARENT_ANNEX_PATH || annex.parentDecision.acceptancePath !== PARENT_ACCEPTANCE_PATH || annex.parentDecision.annexSha256 !== `sha256:${sha256(parentDocument.bytes)}` || annex.parentDecision.acceptanceSha256 !== `sha256:${sha256(parentAcceptance.bytes)}`) fail('TALE_RESET_PARENT_MISMATCH', 'decision 0003 identity');
  verifyGrammar(annex, parentDocument.value, productScopeBytes);
  const mappingClosure = verifyRemovalAndMappingClosure(annex, base, parentDocument.value);

  if (annex.versions.tokenContractVersion.from !== base.tokenContractVersion) fail('TALE_RESET_VERSION_MISMATCH', 'source token-contract version relation');
  if (annex.compatibility.currentCatalog.catalogVersion !== annex.versions.catalogVersion.to || annex.compatibility.currentCatalog.queryApiVersion !== annex.versions.queryApiVersion.to || annex.compatibility.currentCatalog.tokenContractVersion !== annex.versions.tokenContractVersion.to || annex.compatibility.historicalTokenContract.tokenContractVersion !== annex.versions.tokenContractVersion.from || annex.compatibility.historicalTokenContract.catalogVersion !== annex.versions.catalogVersion.from) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'current/historical version relation');
  if (annex.versions.packages['@core-ui/catalog']?.to !== annex.versions.catalogVersion.to || annex.compatibility.installedLocal.selectedCatalogPackageVersion !== annex.versions.packages['@core-ui/catalog']?.to || annex.compatibility.installedLocal.toolingPackageVersion !== annex.versions.packages['@core-ui/tooling']?.to) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'package/catalog relation');
  if (annex.migration.input.tokenSourceFileSha256 !== `sha256:${sha256(baseDocument.bytes)}` || annex.migration.input.tokenCount !== Object.keys(base.tokens).length || annex.migration.input.tokenContractVersion !== base.tokenContractVersion || annex.migration.input.parentDecisionAnnexSha256 !== annex.parentDecision.annexSha256 || annex.migration.input.parentDecisionAcceptanceSha256 !== annex.parentDecision.acceptanceSha256 || annex.migration.input.historicalCatalogDigest !== annex.compatibility.historicalTokenContract.catalogDigest || annex.migration.input.historicalCatalogSourceRevision !== annex.compatibility.historicalTokenContract.catalogSourceRevision || annex.migration.input.finalTokenSourceCanonicalDigest !== annex.digests.finalTokenSource || annex.migration.input.finalTokenSourceCanonicalProfile !== 'Core canonical JSON SHA-256 over the complete token-source object') fail('TALE_RESET_MIGRATION_MISMATCH', 'migration input relation');

  const finalSource = tokenOwned(() => materializeTaleTokenSource({
    phaseBSource: base,
    parentDecision: parentDocument.value,
    resetDecision: annex,
  }));
  const currentFinalSource = tokenOwned(() => migrateDefaultThemeIdentityValue(finalSource));
  const correctedParent = tokenOwned(() => correctTaleTokenClassification(parentDocument.value, annex));
  if (
    currentDocument.bytes !== baseDocument.bytes
    && canonicalJson(currentDocument.value) !== canonicalJson(currentFinalSource)
  ) fail('TALE_RESET_MIGRATION_MISMATCH', 'current token source is neither exact Phase B nor accepted final');
  validateFamily('token-source', finalSource);
  const finalIds = Object.keys(finalSource.tokens).sort(bytewise);
  const dispositionCounts = correctedParent.entries.reduce((counts, entry) => ({ ...counts, [entry.disposition]: counts[entry.disposition] + 1 }), { adopt: 0, adapt: 0, defer: 0, reject: 0 });
  const counts = {
    sourceOccurrenceCount: correctedParent.entries.length,
    deferredNeutralOccurrenceCount: annex.classificationDelta.deferrals.reduce((count, rule) => count + rule.ordinalTo - rule.ordinalFrom + 1, 0),
    renamedReferenceTokenCount: annex.classificationDelta.renames.reduce((count, rule) => count + rule.ordinalTo - rule.ordinalFrom + 1, 0),
    addedTaleReferenceTokenCount: correctedParent.coreTokens.filter(({ action }) => action === 'add').length,
    reusedExistingReferenceTokenCount: correctedParent.coreTokens.filter(({ action }) => action === 'reuse').length,
    finalTokenCount: finalIds.length,
    finalReferenceTokenCount: finalIds.filter((id) => id.startsWith('reference.')).length,
    semanticTokenCount: finalIds.filter((id) => id.startsWith('semantic.')).length,
    componentTokenCount: finalIds.filter((id) => id.startsWith('component.')).length,
    removedReferenceTokenCount: annex.removals.length,
    newSemanticIds: finalIds.filter((id) => id.startsWith('semantic.') && !base.tokens[id]).length,
    newComponentIds: finalIds.filter((id) => id.startsWith('component.') && !base.tokens[id]).length,
    authorizedSemanticModeBranches: mappingClosure.authorizedExpansionCount,
  };
  for (const [key, value] of Object.entries(counts)) if (annex.summary[key] !== value) fail('TALE_RESET_SUMMARY_MISMATCH', key);
  exact(annex.summary.dispositionCounts, dispositionCounts, 'TALE_RESET_SUMMARY_MISMATCH', 'disposition counts');
  if (annex.semanticRecipeEffect.newSemanticIds !== counts.newSemanticIds || annex.semanticRecipeEffect.newComponentIds !== counts.newComponentIds) fail('TALE_RESET_SUMMARY_MISMATCH', 'recipe effect counts');
  if (annex.summary.affectedScopeCount !== annex.affectedScopeIds.length || annex.summary.affectedMilestoneCount !== annex.roadmapImpact.affectedMilestones.length || annex.summary.supersededPointerCount !== annex.supersession.pointers.length) fail('TALE_RESET_SUMMARY_MISMATCH', 'authority closure counts');
  exactKeys(annex.digests, ['profile', 'correctedSourceCrosswalk', 'addedCoreTokenIds', 'removalIds', 'semanticMappings', 'affectedScopeIds', 'supersededPointers', 'finalTokenIds', 'finalTokenSource'], 'digests');
  const addedCoreTokenIds = correctedParent.coreTokens.filter(({ action }) => action === 'add').map(({ id }) => id).sort(bytewise);
  const expectedDigests = {
    correctedSourceCrosswalk: digest(finalSource.sourceCrosswalk), addedCoreTokenIds: digest(addedCoreTokenIds),
    removalIds: digest(annex.removals.map(({ id }) => id)), semanticMappings: digest(annex.semanticMappings),
    affectedScopeIds: digest(annex.affectedScopeIds), supersededPointers: digest(annex.supersession.pointers),
    finalTokenIds: digest(finalIds), finalTokenSource: digest(finalSource),
  };
  for (const [name, expected] of Object.entries(expectedDigests)) {
    if (!SHA256.test(annex.digests[name]) || annex.digests[name] !== expected) fail('TALE_RESET_DIGEST_MISMATCH', name);
  }
  if (annex.compatibility.currentCatalog.tokenCount !== finalIds.length) fail('TALE_RESET_COMPATIBILITY_MISMATCH', 'current catalog token count');
  const acceptedProductScope = Buffer.byteLength(productScopeBytes) === ACCEPTED_PRODUCT_SCOPE_BYTES
    && `sha256:${sha256(productScopeBytes)}` === ACCEPTED_PRODUCT_SCOPE_SHA256
    && productScopeBytes.startsWith(`---\nscopeVersion: ${annex.versions.scopeVersion.to}\n`)
    && productScopeBytes.includes(`### Tale-only reference-baseline correction (\`${annex.versions.scopeVersion.to}\`)`)
    && productScopeBytes.includes(ANNEX_PATH);
  if (!acceptedProductScope) {
    try {
      await verifyDefaultThemeIdentityCorrection(repositoryRoot, { requireAcceptance: true });
    } catch (error) {
      fail('TALE_RESET_SCOPE_MISMATCH', `Product Scope authority successor: ${error.message}`);
    }
  }

  const acceptanceOverrideProvided = Object.hasOwn(options, 'acceptanceValue');
  let acceptance = acceptanceOverrideProvided ? options.acceptanceValue : undefined;
  if (!acceptanceOverrideProvided) {
    try { await access(join(repositoryRoot, ACCEPTANCE_PATH)); acceptance = (await strictFile(join(repositoryRoot, ACCEPTANCE_PATH), ACCEPTANCE_PATH)).value; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  if (acceptance !== undefined && acceptance !== null) verifyAcceptance(acceptance, annexDocument.bytes, architectureBytes, !acceptedProductScope);
  if (options.requireAcceptance && (acceptance === undefined || acceptance === null)) fail('TALE_RESET_ACCEPTANCE_REQUIRED', ACCEPTANCE_PATH);
  return { accepted: acceptance !== undefined && acceptance !== null, finalTokenCount: finalIds.length, finalTokenSourceDigest: expectedDigests.finalTokenSource, removed: annex.removals.length, affectedScopeIds: annex.affectedScopeIds.length };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
  const result = await verifyTaleTokenBaselineReset(resolve(import.meta.dirname, '../../../..'), { requireAcceptance: process.argv.includes('--require-acceptance') });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
