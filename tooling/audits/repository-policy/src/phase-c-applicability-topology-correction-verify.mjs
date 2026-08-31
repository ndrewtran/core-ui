import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, parseJsonStrict } from '@muxui/schema';

const root = path.resolve(import.meta.dirname, '../../../..');
const parentPath = path.join(root, 'decisions/0005-default-theme-token-source-identity.json');

const hash = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const fail = (message) => { throw new Error(`PHASE_C_APPLICABILITY_CORRECTION_INVALID: ${message}`); };
const exact = (actual, expected, label) => {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label);
};
const bytewise = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const exactKeys = (value, expected, label) => exact(Object.keys(value ?? {}).sort(bytewise), [...expected].sort(bytewise), `${label} keys`);
const expectedTopLevelKeys = [
  'acceptanceTopology', 'affectedScopeIds', 'changeControlEffects',
  'decisionId', 'deferredCurrentStateProjection', 'fieldOwnership',
  'humanDecisionOwner', 'nonGoals', 'observedProblem', 'parentDecision',
  'proofTopology', 'roadmapImpact', 'schema', 'state', 'summary',
  'supersession', 'trackerMigration', 'validation', 'versions',
];
const expectedSupersededPointers = [
  '/acceptanceTopology/implementationBoundary',
  '/acceptanceTopology/requiredOwnerComment',
  '/acceptanceTopology/validator',
  '/evidenceTopology/captureRule',
  '/evidenceTopology/requiredAuthorityBindings',
  '/implementation/pathClassification/immutableHistory/prePhaseCEvidenceImmutableManifest/rule',
  '/trackerMigration/issue46',
  '/trackerMigration/projectReadme',
  '/validation/closedChecks',
  '/validation/negativeCorpus',
  '/versions/scopeVersion',
];
const expectedPreservedPointers = [
  '/affectedScopeIds', '/changeControlEffects', '/compatibility', '/correction',
  '/evidenceTopology/acceptanceSequence', '/evidenceTopology/authorityApplicabilitySupersession',
  '/evidenceTopology/captureScript', '/evidenceTopology/captureScriptOwner',
  '/evidenceTopology/phaseCProfile', '/evidenceTopology/rootPaths',
  '/implementation/pathClassification/proofAndFixtures', '/lifecycle', '/migration',
  '/nonGoals', '/roadmapImpact', '/versions/catalogVersion', '/versions/packages',
  '/versions/publicationClaim', '/versions/queryApiVersion', '/versions/tokenContractVersion',
  '/versions/tokenSourceSchemaVersion',
];
const expectedAuthorityBindings = [
  'decisions/0003-tale-token-classification-annex.json and decisions/0003-tale-token-classification-acceptance.json exact accepted bytes/digests',
  'decisions/0004-tale-only-reference-baseline-annex.json and decisions/0004-tale-only-reference-baseline-acceptance.json exact accepted bytes/digests',
  'decisions/0005-default-theme-token-source-identity.json and decisions/0005-default-theme-token-source-identity-acceptance.json exact accepted bytes/digests',
  'decisions/0006-phase-c-applicability-topology.json and decisions/0006-phase-c-applicability-topology-acceptance.json exact accepted bytes/digests',
  'strategy/product-scope.md at scopeVersion 4.0.1 with exact accepted bytes/digest',
];
const expectedDecisionSha256 = 'sha256:5451cad5a62d9acf2bf53bfe7cbda6419a982232f062d926130cab7ebba39c6c';
const expectedProductScopeSha256 = 'sha256:0346e60bc4e7e448fc50723604f51ae6796bcd77ddb799773a95029db21bd309';
const expectedAcceptanceBodySha256 = 'sha256:deb022ec1ff847b4621d00eb231aa4b534d4e746accb2bc4748ee274ba50d6fd';
const expectedPhaseCRootPaths = [
  'tests/evidence/tale-token-phase-c-g0.1/index.json',
  'tests/evidence/tale-token-phase-c-g0.2/index.json',
  'tests/evidence/tale-token-phase-c-g0.3/index.json',
  'tests/evidence/tale-token-phase-c-g0.4/index.json',
  'tests/evidence/tale-token-phase-c-g0.5/index.json',
  'tests/evidence/tale-token-phase-c-gate-0/index.json',
];
const acceptanceKeys = [
  'bodySha256', 'commentId', 'commentNodeId', 'createdAt', 'decisionId',
  'issueNumber', 'outcome', 'owner', 'ownerNodeId', 'provider', 'repository',
  'schema', 'url',
];

export function acceptanceCommentBody({ decisionSource, productScopeSource }) {
  return [
    'Accept Phase C applicability topology correction',
    'Decision path: decisions/0006-phase-c-applicability-topology.json',
    `Decision SHA-256: ${hash(decisionSource)}`,
    `Decision bytes: ${Buffer.byteLength(decisionSource)}`,
    'Product Scope path: strategy/product-scope.md',
    `Product Scope SHA-256: ${hash(productScopeSource)}`,
    `Product Scope bytes: ${Buffer.byteLength(productScopeSource)}`,
    'Decision: accepted',
    'Owner: ndrewtran',
    'Issue: #39',
  ].join('\n');
}

function pointerSegments(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || /~(?![01])/u.test(pointer)) fail(`invalid pointer ${pointer}`);
  return pointer.slice(1).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function pointerValue(value, pointer) {
  let cursor = value;
  for (const segment of pointerSegments(pointer)) {
    if (!cursor || typeof cursor !== 'object' || !Object.hasOwn(cursor, segment)) fail(`unresolved parent pointer ${pointer}`);
    cursor = cursor[segment];
  }
  return cursor;
}

function pointerContains(left, right) {
  const a = pointerSegments(left);
  const b = pointerSegments(right);
  return a.length <= b.length && a.every((segment, index) => segment === b[index]);
}

function checkSortedUnique(values, label) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string' || value.length === 0)) fail(`${label} shape`);
  if (new Set(values).size !== values.length) fail(`${label} duplicate`);
  exact(values, [...values].sort(bytewise), `${label} order`);
}

export function verifyPhaseCApplicabilityTopologyCorrection({
  decisionPath = path.join(root, 'decisions/0006-phase-c-applicability-topology.json'),
  scopePath = path.join(root, 'strategy/product-scope.md'),
  acceptancePath = path.join(root, 'decisions/0006-phase-c-applicability-topology-acceptance.json'),
  productScopeSource,
} = {}) {
const decisionSource = fs.readFileSync(decisionPath, 'utf8');
const scopeSource = productScopeSource ?? fs.readFileSync(scopePath, 'utf8');
const parentSource = fs.readFileSync(parentPath, 'utf8');
const acceptanceSource = fs.readFileSync(acceptancePath, 'utf8');
const decision = parseJsonStrict(decisionSource);
const parent = parseJsonStrict(parentSource);
const acceptance = parseJsonStrict(acceptanceSource);

if (decisionSource !== canonicalJson(decision)) fail('decision is not Core canonical JSON or has terminal LF');
if (hash(decisionSource) !== expectedDecisionSha256) fail('decision digest differs from reviewed acceptance candidate');
const originalProductScope = hash(scopeSource) === expectedProductScopeSha256
  && scopeSource.startsWith('---\nscopeVersion: 4.0.1\n');
const successorProductScopeVersion = scopeSource.match(/^---\nscopeVersion: ([^\n]+)\n/u)?.[1] ?? null;
if (!originalProductScope) {
  if (successorProductScopeVersion === null) fail('Product Scope successor version');
}
exactKeys(decision, expectedTopLevelKeys, 'decision');
if ((scopeSource.match(/### Phase C applicability-chain topology correction \(`4\.0\.1`\)/gu) ?? []).length !== 1) fail('Product Scope correction section');
if (!scopeSource.includes('The maintenance root is not a seventh Phase C root.')) fail('Product Scope proof boundary');
if (!scopeSource.includes('A deterministic current-state projection remains deferred.')) fail('Product Scope deferred projection');
if (scopeSource.split('\n').some((line) => line.startsWith('+'))) fail('Product Scope contains patch markers');

if (decision.schema !== 'core-ui-phase-c-applicability-topology-correction-v1') fail('schema');
if (decision.decisionId !== 'core-ui:decision:0006' || decision.state !== 'acceptance-candidate') fail('identity/state');
if (decision.humanDecisionOwner !== 'ndrewtran') fail('decision owner');
if (decision.parentDecision.decisionSha256 !== hash(parentSource)) fail('parent digest');
if (decision.parentDecision.acceptanceSha256 !== hash(fs.readFileSync(path.join(root, decision.parentDecision.acceptancePath)))) fail('parent receipt digest');
exactKeys(acceptance, acceptanceKeys, 'acceptance');
if (
  acceptance.bodySha256 !== (originalProductScope
    ? hash(acceptanceCommentBody({ decisionSource, productScopeSource: scopeSource }))
    : expectedAcceptanceBodySha256)
  || acceptance.commentId !== 5240422975
  || acceptance.commentNodeId !== 'IC_kwDOTtLjcM8AAAABOFqCPw'
  || acceptance.createdAt !== '2026-08-10T12:42:16Z'
  || acceptance.decisionId !== 'core-ui:decision:0006'
  || acceptance.issueNumber !== 39
  || acceptance.outcome !== 'accepted'
  || acceptance.owner !== 'ndrewtran'
  || acceptance.ownerNodeId !== 'MDQ6VXNlcjc0MzE0OTg0'
  || acceptance.provider !== 'github'
  || acceptance.repository !== 'ndrewtran/core-ui'
  || acceptance.schema !== 'core-ui-authority-decision-v1'
  || acceptance.url !== 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-5240422975'
) fail('acceptance receipt identity');

checkSortedUnique(decision.supersession.pointers, 'supersession.pointers');
checkSortedUnique(decision.supersession.preservedPointers, 'supersession.preservedPointers');
exact(decision.supersession.pointers, expectedSupersededPointers, 'superseded pointer set');
exact(decision.supersession.preservedPointers, expectedPreservedPointers, 'preserved pointer set');
const pointers = [...decision.supersession.pointers, ...decision.supersession.preservedPointers];
if (new Set(pointers).size !== pointers.length) fail('duplicate supersession pointer');
for (const pointer of pointers) pointerValue(parent, pointer);
for (const [index, left] of pointers.entries()) {
  for (const right of pointers.slice(index + 1)) {
    if (pointerContains(left, right) || pointerContains(right, left)) fail(`overlapping pointers ${left} ${right}`);
  }
}

const affectedIds = parseJsonStrict(fs.readFileSync(path.join(root, 'decisions/0004-tale-only-reference-baseline-annex.json'), 'utf8')).affectedScopeIds;
if (affectedIds.length !== 67 || hash(canonicalJson(affectedIds)) !== decision.affectedScopeIds.sha256) fail('affected Scope IDs');
for (const scopeId of affectedIds) {
  if (!scopeSource.includes(`\`${scopeId}\``) && !fs.readFileSync(path.join(root, 'strategy/product-scope.md'), 'utf8').includes(`\`${scopeId}\``)) fail(`missing Scope ID ${scopeId}`);
}

const phaseC = decision.proofTopology.phaseC;
const maintenance = decision.proofTopology.maintenance;
const authorityStage = decision.proofTopology.authorityStage;
exactKeys(decision.proofTopology, ['authorization', 'authorityStage', 'capture', 'completeTerminalPartition', 'maintenance', 'phaseC', 'sourceBinding'], 'proofTopology');
exactKeys(decision.proofTopology.authorization, ['decisionPath', 'productScopeVersion', 'receiptPath', 'requiredAuthorityBindings'], 'proofTopology.authorization');
exact(decision.proofTopology.authorization, {
  decisionPath: 'decisions/0006-phase-c-applicability-topology.json',
  productScopeVersion: '4.0.1',
  receiptPath: 'decisions/0006-phase-c-applicability-topology-acceptance.json',
  requiredAuthorityBindings: expectedAuthorityBindings,
}, 'proofTopology.authorization values');
exact(decision.proofTopology.authorization.requiredAuthorityBindings, expectedAuthorityBindings, 'required authority bindings');
exactKeys(decision.proofTopology.capture, ['checkMode', 'script', 'writeMode'], 'proofTopology.capture');
if (decision.proofTopology.capture.script !== 'tests/evidence/capture-tale-token-phase-c.mjs') fail('capture script');
if (!decision.proofTopology.capture.checkMode.includes('writes nothing')) fail('capture check-mode boundary');
if (!decision.proofTopology.capture.writeMode.includes('all seven output directories or none')) fail('atomic capture boundary');
exactKeys(decision.proofTopology.completeTerminalPartition, ['overlapCount', 'targetCount', 'targetNames'], 'completeTerminalPartition');
exactKeys(authorityStage, ['captureScript', 'evidenceRecords', 'profile', 'rootPath', 'sourceBoundary', 'targetCount', 'targets'], 'authorityStage');
exactKeys(phaseC, ['gateOwnsSupersessions', 'profile', 'rootCount', 'rootPaths', 'successorCount', 'successorTargets'], 'phaseC');
exactKeys(maintenance, ['evidenceRecords', 'phaseCProfileClaim', 'profile', 'reasonCode', 'replacementPlan', 'replacementStatus', 'rootPath', 'targetCount', 'targets'], 'maintenance');
if (phaseC.profile !== 'TALE-TOKEN-C' || phaseC.gateOwnsSupersessions !== true) fail('Phase C profile/ownership');
if (authorityStage.captureScript !== 'tests/evidence/capture-authority-39-phase-c-applicability-topology-supersessions.mjs') fail('authority-stage capture script');
if (authorityStage.profile !== 'core-ui-authority-applicability-continuation-v1' || authorityStage.evidenceRecords !== 'forbidden; index.records must be []') fail('authority-stage profile/records');
if (authorityStage.rootPath !== 'tests/evidence/authority-39-phase-c-applicability-topology/index.json' || authorityStage.targetCount !== 20 || authorityStage.targets.length !== 20) fail('authority-stage boundary');
exact(phaseC.rootPaths, expectedPhaseCRootPaths, 'Phase C root paths');
if (phaseC.rootCount !== 6 || phaseC.successorCount !== 6 || phaseC.successorTargets.length !== 6) fail('six-root/six-successor Phase C boundary');
if (maintenance.profile !== 'core-ui-phase-c-source-applicability-maintenance-v1' || maintenance.reasonCode !== 'governing-authority-changed') fail('maintenance profile/reason');
if (maintenance.phaseCProfileClaim !== 'forbidden' || maintenance.replacementStatus !== 'pending') fail('maintenance proof/status boundary');
exact(maintenance.replacementPlan, ['TALE-TOKEN-C', 'E-G1.0', 'E-G1.1'], 'maintenance replacement plan');
if (maintenance.targetCount !== 14 || maintenance.targets.length !== 14 || maintenance.evidenceRecords !== 'forbidden; index.records must be []') fail('maintenance boundary');
if (maintenance.rootPath !== 'tests/evidence/authority-46-phase-c-applicability/index.json') fail('maintenance root');

const targetNames = [...phaseC.successorTargets, ...maintenance.targets].map(({ name }) => name).sort(bytewise);
if (targetNames.length !== 20 || new Set(targetNames).size !== 20) fail('target partition cardinality');
exact(targetNames, decision.proofTopology.completeTerminalPartition.targetNames, 'target partition identity');
if (decision.proofTopology.completeTerminalPartition.overlapCount !== 0) fail('target partition overlap');

const parentRootPath = path.join(root, 'tests/evidence/authority-39-default-theme-identity/index.json');
const parentRoot = parseJsonStrict(fs.readFileSync(parentRootPath, 'utf8'));
const expectedTargets = parentRoot.supersessions.map((reference) => {
  const name = path.basename(reference.path, '.json');
  const predecessorBytes = fs.readFileSync(path.join(root, reference.path));
  const predecessor = parseJsonStrict(predecessorBytes.toString('utf8'));
  if (hash(predecessorBytes) !== reference.sha256) fail(`${name} parent-root predecessor digest`);
  const phaseB = name.startsWith('phase-b-');
  const authorityTarget = {
    affectedAssertions: predecessor.affectedAssertions,
    historicalIndex: predecessor.historicalIndex,
    name,
    predecessor: { path: reference.path, sha256: reference.sha256 },
    predecessorCurrentApplicabilityManifest: predecessor.currentApplicabilityManifest,
    successorPath: `tests/evidence/authority-39-phase-c-applicability-topology/supersessions/${name}.json`,
  };
  return {
    owner: phaseB ? 'phase-c' : 'maintenance',
    authorityTarget,
    futureTarget: {
      affectedAssertions: predecessor.affectedAssertions,
      historicalIndex: predecessor.historicalIndex,
      name,
      predecessorPath: authorityTarget.successorPath,
      successorPath: phaseB
        ? `tests/evidence/tale-token-phase-c-gate-0/supersessions/${name.replace('phase-b-', '')}.json`
        : `tests/evidence/authority-46-phase-c-applicability/supersessions/${name}.json`,
    },
  };
});
exact(authorityStage.targets, expectedTargets.map(({ authorityTarget }) => authorityTarget).sort((left, right) => bytewise(left.name, right.name)), 'authority-stage targets derived from parent root');
exact(phaseC.successorTargets, expectedTargets.filter(({ owner }) => owner === 'phase-c').map(({ futureTarget }) => futureTarget), 'Phase C targets derived from authority stage');
exact(maintenance.targets, expectedTargets.filter(({ owner }) => owner === 'maintenance').map(({ futureTarget }) => futureTarget), 'maintenance targets derived from authority stage');

if (decision.versions.scopeVersion.from !== '4.0.0' || decision.versions.scopeVersion.to !== '4.0.1') fail('scope version relation');
for (const [name, relation] of Object.entries(decision.versions.packages)) {
  if (relation.from !== relation.to) fail(`package version changed ${name}`);
}
for (const key of ['catalogVersion', 'queryApiVersion', 'tokenContractVersion', 'tokenSourceSchemaVersion']) {
  if (decision.versions[key].from !== decision.versions[key].to) fail(`version changed ${key}`);
}

const result = {
  accepted: true,
  affectedScopeIdCount: 67,
  authorityStageSuccessors: authorityStage.targets.length,
  decision: { bytes: Buffer.byteLength(decisionSource), sha256: hash(decisionSource) },
  maintenanceRecords: 0,
  maintenanceSuccessors: maintenance.targets.length,
  parentDecision: { bytes: Buffer.byteLength(parentSource), sha256: hash(parentSource) },
  phaseCRoots: phaseC.rootPaths.length,
  phaseBSuccessors: phaseC.successorTargets.length,
  productScope: {
    bytes: Buffer.byteLength(scopeSource),
    sha256: hash(scopeSource),
    version: originalProductScope ? '4.0.1' : successorProductScopeVersion,
  },
  terminalPartition: targetNames.length,
};

return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = verifyPhaseCApplicabilityTopologyCorrection({
    decisionPath: process.argv[2],
    scopePath: process.argv[3],
    acceptancePath: process.argv[4],
  });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
