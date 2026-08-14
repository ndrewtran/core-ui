import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import { sha256 } from './policy.mjs';

const DECISION_PATH = 'decisions/0007-delivery-workflow-authority.json';
const ACCEPTANCE_PATH = 'decisions/0007-delivery-workflow-authority-acceptance.json';
const PRODUCT_SCOPE_PATH = 'strategy/product-scope.md';
const ARCHITECTURE_PATH = 'strategy/monorepo-architecture.md';
const ROADMAP_PATH = 'strategy/milestone-roadmap.md';
const DECISION_BYTES = 40822;
const DECISION_SHA256 = 'sha256:97aa9d33adb4da0cd9b6bf4d692993b8b8938401d73cb7cb20912c3f6e382c8f';
const ACCEPTANCE_BYTES = 558;
const ACCEPTANCE_SHA256 = 'sha256:282defb18bd1d897c14dc62e3ebc44cabf0d3cdbf4cd8c0419d71b9d1d03ed8d';
const PRODUCT_SCOPE_BYTES = 90165;
const PRODUCT_SCOPE_SHA256 = 'sha256:7c8404e20d01f6a0cc975b17a7893f5594f6f0d313806a6fced9d0c62d886873';
const ARCHITECTURE_SHA256 = 'sha256:bdf8eb132fcdace479a05569020fd91acb0bde02dd1b24b33ce0f96ceaf39371';
const ROADMAP_SHA256 = 'sha256:808a972cf2d92064aacb0a10560ac512c0ac878b9c960098d9ddc7d84354f4c0';
const HISTORICAL_AUTHORITY_SOURCE = 'b27cb4fb3d71f8feca9505684201286d76f62d42';
const REVIEW_DECISION_PATH = 'decisions/0009-delivery-review-readiness.json';
const REVIEW_ACCEPTANCE_PATH = 'decisions/0009-delivery-review-readiness-acceptance.json';
const REVIEW_IMPLEMENTATION_CLARIFICATION_PATH = 'decisions/0009-amendment-01-implementation-clarification.md';
const REVIEW_IMPLEMENTATION_CLARIFICATION_BYTES = 2270;
const REVIEW_IMPLEMENTATION_CLARIFICATION_SHA256 = 'sha256:148c0426a78073776fa5b11598c2c789307c84788eb6c8c1646c585884f32dd1';
const REVIEW_HISTORICAL_SOURCE = '63dee2c988759ec803f71a0353a6630bf612826c';
const REVIEW_HISTORICAL_ARTIFACT_PATHS = new Set([
  'tests/evidence/delivery-review-readiness-applicability-profile.mjs',
  'tests/evidence/delivery-review-readiness-applicability-profile.test.mjs',
  'tooling/audits/repository-policy/src/delivery-workflow-authority-verify.mjs',
  'tooling/audits/repository-policy/src/evidence-verify.mjs',
  'tooling/audits/repository-policy/test/delivery-workflow-authority.test.mjs',
  'tooling/audits/repository-policy/test/evidence-integrity.test.mjs',
]);
const REVIEW_PLAN_SHA256 = 'sha256:43a7b1724b4e107e253703952ac4839f7c99880f4b96e56b8e73e56de1aded7d';
const REVIEW_TASK_ID = '019ff5d8-5a4b-7252-958d-bab8b0087c34';
const REVIEW_SCOPES = [
  'SCOPE-FOUNDATION-001',
  'SCOPE-QUALITY-GENERATOR-CONTRACT',
  'SCOPE-TRUST-DISCLOSURE',
  'SCOPE-TRUST-EVIDENCE',
  'SCOPE-TRUST-EVIDENCE-PRIVACY',
];
const ACTIVATION_EVIDENCE = [
  'E-DELIVERY-01', 'E-DELIVERY-02', 'E-DELIVERY-03', 'E-DELIVERY-04',
  'E-DELIVERY-05', 'E-DELIVERY-06', 'E-DELIVERY-07', 'E-DELIVERY-08',
];

const digest = (source) => `sha256:${sha256(source)}`;
const fail = (message) => { throw new Error(`DELIVERY_WORKFLOW_AUTHORITY_INVALID: ${message}`); };
const exact = (actual, expected, label) => {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label);
};
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label);
  exact(Object.keys(value).sort(), [...keys].sort(), label);
};
const readHistoricalAuthority = (repositoryRoot, path) => execFileSync(
  'git',
  ['show', `${HISTORICAL_AUTHORITY_SOURCE}:${path}`],
  { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

export function verifyDeliveryWorkflowAuthority(repositoryRoot, options = {}) {
  const decisionSource = options.decisionSource
    ?? readFileSync(join(repositoryRoot, DECISION_PATH), 'utf8');
  const acceptanceSource = options.acceptanceSource
    ?? readFileSync(join(repositoryRoot, ACCEPTANCE_PATH), 'utf8');
  const productScopeSource = options.productScopeSource
    ?? readFileSync(join(repositoryRoot, PRODUCT_SCOPE_PATH), 'utf8');
  const architectureSource = options.architectureSource
    ?? readHistoricalAuthority(repositoryRoot, ARCHITECTURE_PATH);
  const roadmapSource = options.roadmapSource
    ?? readHistoricalAuthority(repositoryRoot, ROADMAP_PATH);
  const decision = parseJsonStrict(decisionSource);
  const acceptance = parseJsonStrict(acceptanceSource);

  if (decisionSource !== canonicalJson(decision)) fail('decision must be canonical JSON');
  if (acceptanceSource !== canonicalJson(acceptance)) fail('acceptance must be canonical JSON');
  if (Buffer.byteLength(decisionSource) !== DECISION_BYTES || digest(decisionSource) !== DECISION_SHA256) fail('decision identity');
  if (Buffer.byteLength(acceptanceSource) !== ACCEPTANCE_BYTES || digest(acceptanceSource) !== ACCEPTANCE_SHA256) fail('acceptance identity');
  if (Buffer.byteLength(productScopeSource) !== PRODUCT_SCOPE_BYTES || digest(productScopeSource) !== PRODUCT_SCOPE_SHA256) fail('Product Scope 4.0.2 identity');
  if (!productScopeSource.startsWith('---\nscopeVersion: 4.0.2\n')) fail('Product Scope version');
  if (digest(architectureSource) !== ARCHITECTURE_SHA256 || digest(roadmapSource) !== ROADMAP_SHA256) fail('Architecture or roadmap identity');

  if (decision.decisionId !== 'core-ui:decision:0007' || decision.state !== 'acceptance-candidate') fail('decision identity or state');
  if (decision.acceptanceTopology.owner !== 'ndrewtran' || decision.acceptanceTopology.issueNumber !== 54) fail('decision owner or issue');
  if (decision.acceptanceTopology.candidatePath !== DECISION_PATH || decision.acceptanceTopology.receiptPath !== ACCEPTANCE_PATH) fail('decision path binding');
  exact(decision.activationEvidence, ACTIVATION_EVIDENCE, 'activation evidence');
  exact(decision.authorityApplicability.replacementPlan, ACTIVATION_EVIDENCE, 'applicability replacement plan');
  if (decision.authorityApplicability.replacementStatus !== 'pending') fail('applicability replacement status');
  if (decision.authorityApplicability.targetCount !== 28 || decision.authorityApplicability.targets?.length !== 28) fail('applicability target count');
  const successorPaths = decision.authorityApplicability.targets.map(({ successorPath }) => successorPath);
  if (new Set(successorPaths).size !== 28) fail('applicability successor uniqueness');
  if (decision.authorityAmendment.architecture.sha256 !== ARCHITECTURE_SHA256
    || decision.authorityAmendment.roadmap.sha256 !== ROADMAP_SHA256
    || decision.authorityAmendment.productScope.sha256 !== PRODUCT_SCOPE_SHA256) fail('authority amendment binding');

  const expectedAcceptance = {
    authorAssociation: 'OWNER',
    bodySha256: 'sha256:3f8cd91a9bc2233d3736d6abecb53a138f0e10d794f0d74585f0b38a99da0abf',
    commentId: 5259468261,
    commentNodeId: 'IC_kwDOTtLjcM8AAAABOX0d5Q',
    createdAt: '2026-08-11T22:15:23Z',
    decisionId: 'core-ui:decision:0007',
    issueNumber: 54,
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-authority-decision-v1',
    updatedAt: '2026-08-11T22:15:23Z',
    url: 'https://github.com/ndrewtran/core-ui/issues/54#issuecomment-5259468261',
  };
  exact(acceptance, expectedAcceptance, 'acceptance receipt');

  return {
    accepted: true,
    activationEvidence: ACTIVATION_EVIDENCE.length,
    applicabilityTargets: decision.authorityApplicability.targets.length,
    decision: { bytes: Buffer.byteLength(decisionSource), sha256: digest(decisionSource) },
    productScope: { bytes: Buffer.byteLength(productScopeSource), sha256: digest(productScopeSource), version: '4.0.2' },
  };
}

export function proposedReviewReadinessManifest(decisionSource, decision) {
  return {
    acceptedBase: decision.sourceConstruction.acceptedBase,
    decision: {
      byteLength: Buffer.byteLength(decisionSource),
      path: REVIEW_DECISION_PATH,
      sha256: digest(decisionSource),
    },
    entries: decision.sourceConstruction.artifactEntries,
    profile: 'core-ui-proposed-source-artifact-manifest-v1',
    receipt: {
      grammar: decision.sourceConstruction.receiptGrammar,
      path: REVIEW_ACCEPTANCE_PATH,
    },
  };
}

export function verifyDeliveryReviewReadinessAuthority(repositoryRoot, options = {}) {
  const decisionSource = options.reviewDecisionSource
    ?? readFileSync(join(repositoryRoot, REVIEW_DECISION_PATH), 'utf8');
  const acceptanceSource = options.reviewAcceptanceSource
    ?? readFileSync(join(repositoryRoot, REVIEW_ACCEPTANCE_PATH), 'utf8');
  const implementationClarificationSource = options.implementationClarificationSource
    ?? readFileSync(join(repositoryRoot, REVIEW_IMPLEMENTATION_CLARIFICATION_PATH), 'utf8');
  const decision = parseJsonStrict(decisionSource);
  const acceptance = parseJsonStrict(acceptanceSource);
  if (decisionSource !== canonicalJson(decision) || acceptanceSource !== canonicalJson(acceptance)) {
    fail('Decision 0009 authority bytes must be canonical JSON without trailing LF');
  }
  if (Buffer.byteLength(implementationClarificationSource) !== REVIEW_IMPLEMENTATION_CLARIFICATION_BYTES
      || digest(implementationClarificationSource) !== REVIEW_IMPLEMENTATION_CLARIFICATION_SHA256) {
    fail('Decision 0009 amendment 01 implementation clarification identity');
  }
  exactKeys(decision, [
    'acceptanceTopology', 'affectedScopeIds', 'authority', 'choices', 'classification',
    'continuationTopology', 'decisionId', 'implementationBoundary', 'nonGoals',
    'operationalProof', 'rollback', 'schema', 'sourceConstruction', 'state', 'versionModel',
  ], 'Decision 0009 fields');
  if (decision.schema !== 'core-ui-delivery-review-readiness-authority-v1'
      || decision.decisionId !== 'core-ui:decision:0009'
      || decision.state !== 'accepted-via-bounded-task-provenance'
      || decision.classification !== 'decision-bearing-amendment-route-b') fail('Decision 0009 identity');
  exact(decision.affectedScopeIds, REVIEW_SCOPES, 'Decision 0009 Scope IDs');
  exact(decision.choices, {
    classification: 'decision-bearing-amendment-route-b',
    ownership: 'existing-repository-policy-delivery-profile',
    phaseContinuation: 'guidance-only-no-write-authority',
    pilot: 'none-selected',
    reviewerContinuity: 'conservative-byte-identical-complete-dependency-map-only',
  }, 'Decision 0009 choices');
  if (decision.acceptanceTopology.owner !== 'ndrewtran'
      || decision.acceptanceTopology.issueNumber !== 58
      || decision.acceptanceTopology.provider !== 'codex-task'
      || decision.acceptanceTopology.taskId !== REVIEW_TASK_ID
      || decision.acceptanceTopology.planSha256 !== REVIEW_PLAN_SHA256
      || decision.acceptanceTopology.candidatePath !== REVIEW_DECISION_PATH
      || decision.acceptanceTopology.receiptPath !== REVIEW_ACCEPTANCE_PATH
      || decision.acceptanceTopology.approvalTimestamp !== null
      || decision.acceptanceTopology.githubCommentClaimed !== false) fail('Decision 0009 task provenance');
  if (decision.sourceConstruction.acceptedBase !== '7ede0cbb758b8306ecab1a7cdcec55a1b3505a64'
      || decision.sourceConstruction.rule !== 'acceptance-first-single-source-commit-then-sole-parent-evidence-child'
      || decision.sourceConstruction.receiptGrammar !== 'core-ui-task-provenance-authority-acceptance-v1'
      || !Array.isArray(decision.sourceConstruction.artifactEntries)
      || decision.sourceConstruction.artifactEntries.length === 0) fail('Decision 0009 source-construction rule');
  const paths = decision.sourceConstruction.artifactEntries.map(({ path }) => path);
  if (new Set(paths).size !== paths.length
      || paths.includes(REVIEW_DECISION_PATH) || paths.includes(REVIEW_ACCEPTANCE_PATH)) fail('Decision 0009 artifact path manifest');
  for (const entry of decision.sourceConstruction.artifactEntries) {
    exactKeys(entry, ['byteLength', 'path', 'sha256'], `artifact entry ${entry.path}`);
    let bytes = readFileSync(join(repositoryRoot, entry.path));
    if (REVIEW_HISTORICAL_ARTIFACT_PATHS.has(entry.path)) {
      try {
        bytes = execFileSync('git', ['show', `${REVIEW_HISTORICAL_SOURCE}:${entry.path}`], {
          cwd: repositoryRoot,
          encoding: 'buffer',
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch {
        fail(`historical artifact identity ${entry.path}`);
      }
    }
    if (bytes.byteLength !== entry.byteLength || digest(bytes) !== entry.sha256) fail(`artifact identity ${entry.path}`);
  }
  const targetNames = decision.continuationTopology.targets.map(({ name }) => name);
  if (decision.continuationTopology.rootPath !== 'tests/evidence/authority-58-delivery-review-readiness-applicability-v1/index.json'
      || decision.continuationTopology.targetCount !== 29
      || decision.continuationTopology.targets.length !== 29
      || new Set(targetNames).size !== 29
      || decision.continuationTopology.targets.some(({ action, evidenceStatus, replacementStatus }) => (
        action !== 'supersede' || evidenceStatus !== 'superseded' || replacementStatus !== 'pending'
      ))) fail('Decision 0009 continuation topology');
  if (decision.implementationBoundary.guidanceOnly !== true
      || decision.implementationBoundary.enforcementIngress !== 'deferred-separate-decision'
      || decision.implementationBoundary.pilot !== 'none-selected'
      || decision.implementationBoundary.productionMutation !== 'forbidden') fail('Decision 0009 implementation boundary');
  if (decision.operationalProof.advisoryApplicability !== 'not-applicable'
      || decision.operationalProof.advisoryReason !== 'NO_RUNTIME_MUTATION'
      || decision.operationalProof.rollbackReason !== 'HUMAN_RENDER_ONLY_ROLLBACK'
      || decision.operationalProof.evidenceCapture !== 'required-transactional-owner-proof') fail('Decision 0009 operational applicability');
  if (decision.versionModel.documentVersion !== '1.1.0'
      || decision.versionModel.workflowRecordVersion !== '1.0.0'
      || decision.versionModel.compatibleMinorRange !== '>=1.1.0 <2.0.0') fail('Decision 0009 version model');
  const partition = [...decision.rollback.preservedPaths, ...Object.values(decision.rollback.removablePaths).flat()];
  if (new Set(partition).size !== partition.length
      || decision.rollback.preservedPaths.some((path) => Object.values(decision.rollback.removablePaths).flat().includes(path))) {
    fail('Decision 0009 rollback partition');
  }
  const manifest = proposedReviewReadinessManifest(decisionSource, decision);
  const manifestSha256 = digest(canonicalJson(manifest));
  exactKeys(acceptance, [
    'candidate', 'decisionId', 'issueNumber', 'manifest', 'outcome', 'owner', 'plan',
    'provider', 'repository', 'schema', 'taskProvenance',
  ], 'Decision 0009 acceptance fields');
  if (acceptance.schema !== 'core-ui-task-provenance-authority-acceptance-v1'
      || acceptance.decisionId !== decision.decisionId
      || acceptance.issueNumber !== 58
      || acceptance.outcome !== 'accepted'
      || acceptance.owner !== 'ndrewtran'
      || acceptance.provider !== 'codex-task'
      || acceptance.repository !== 'ndrewtran/core-ui') fail('Decision 0009 acceptance identity');
  exact(acceptance.candidate, manifest.decision, 'Decision 0009 accepted candidate');
  exact(acceptance.plan, {
    path: '/tmp/core-ui-review-readiness-proposal-v1.final.md',
    sha256: REVIEW_PLAN_SHA256,
  }, 'Decision 0009 accepted plan');
  exact(acceptance.taskProvenance, {
    approvalInstruction: 'exact-plan-approved-for-bounded-execution',
    approvalTimestamp: null,
    githubCommentClaimed: false,
    taskId: REVIEW_TASK_ID,
  }, 'Decision 0009 acceptance task provenance');
  exact(acceptance.manifest, {
    entryCount: decision.sourceConstruction.artifactEntries.length + 2,
    profile: manifest.profile,
    sha256: manifestSha256,
  }, 'Decision 0009 accepted artifact manifest');
  return {
    accepted: true,
    acceptance: { bytes: Buffer.byteLength(acceptanceSource), sha256: digest(acceptanceSource) },
    decision: manifest.decision,
    manifest: { entries: acceptance.manifest.entryCount, sha256: manifestSha256 },
    targets: decision.continuationTopology.targets.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  process.stdout.write(`${canonicalJson({
    deliveryReviewReadiness: verifyDeliveryReviewReadinessAuthority(repositoryRoot),
    deliveryWorkflow: verifyDeliveryWorkflowAuthority(repositoryRoot),
  })}\n`);
}
