import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import {
  verifyDeliveryReviewReadinessAuthority,
  verifyDeliveryWorkflowAuthority,
} from '../src/delivery-workflow-authority-verify.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const decisionSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0007-delivery-workflow-authority.json'), 'utf8');
const acceptanceSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0007-delivery-workflow-authority-acceptance.json'), 'utf8');
const productScopeSource = fs.readFileSync(path.join(repositoryRoot, 'strategy/product-scope.md'), 'utf8');

const reject = (options, label) => {
  try {
    verifyDeliveryWorkflowAuthority(repositoryRoot, options);
  } catch (error) {
    if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
    throw error;
  }
  throw new Error(`negative accepted: ${label}`);
};

const decision = parseJsonStrict(decisionSource);
const wrongPlan = structuredClone(decision);
wrongPlan.authorityApplicability.replacementPlan = ['E-DELIVERY-01'];
reject({ decisionSource: canonicalJson(wrongPlan) }, 'replacement plan');

const wrongStatus = structuredClone(decision);
wrongStatus.authorityApplicability.replacementStatus = 'complete';
reject({ decisionSource: canonicalJson(wrongStatus) }, 'replacement status');

const acceptance = parseJsonStrict(acceptanceSource);
acceptance.bodySha256 = `sha256:${'0'.repeat(64)}`;
reject({ acceptanceSource: canonicalJson(acceptance) }, 'acceptance receipt');

reject({ productScopeSource: productScopeSource.replace('scopeVersion: 4.0.2', 'scopeVersion: 4.0.3') }, 'Product Scope');
reject({ architectureSource: 'not the accepted historical architecture' }, 'historical Architecture');
reject({ roadmapSource: 'not the accepted historical roadmap' }, 'historical roadmap');

const result = verifyDeliveryWorkflowAuthority(repositoryRoot);
if (result.activationEvidence !== 8 || result.applicabilityTargets !== 28 || result.productScope.version !== '4.0.2') {
  throw new Error('positive result mismatch');
}

const reviewDecisionSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0009-delivery-review-readiness.json'), 'utf8');
const reviewAcceptanceSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0009-delivery-review-readiness-acceptance.json'), 'utf8');
const implementationClarificationSource = fs.readFileSync(
  path.join(repositoryRoot, 'decisions/0009-amendment-01-implementation-clarification.md'),
  'utf8',
);
const rejectReview = (options, label) => {
  try {
    verifyDeliveryReviewReadinessAuthority(repositoryRoot, options);
  } catch (error) {
    if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
    throw error;
  }
  throw new Error(`Decision 0009 negative accepted: ${label}`);
};
const reviewDecision = parseJsonStrict(reviewDecisionSource);
const mutations = [
  ['plan', (value) => { value.acceptanceTopology.planSha256 = `sha256:${'0'.repeat(64)}`; }],
  ['base', (value) => { value.sourceConstruction.acceptedBase = '0'.repeat(40); }],
  ['future source', (value) => { value.sourceConstruction.futureSourceCommit = '0'.repeat(40); }],
  ['write authority', (value) => { value.implementationBoundary.guidanceOnly = false; }],
  ['target omission', (value) => { value.continuationTopology.targets.pop(); }],
  ['continuation status', (value) => { value.continuationTopology.targets[0].replacementStatus = 'complete'; }],
  ['artifact digest', (value) => { value.sourceConstruction.artifactEntries[0].sha256 = `sha256:${'f'.repeat(64)}`; }],
  ['historical resolver digest', (value) => {
    value.sourceConstruction.artifactEntries
      .find(({ path: artifactPath }) => artifactPath === 'tests/evidence/delivery-review-readiness-applicability-profile.mjs')
      .sha256 = `sha256:${'f'.repeat(64)}`;
  }],
];
for (const [label, mutate] of mutations) {
  const value = structuredClone(reviewDecision);
  mutate(value);
  rejectReview({ reviewDecisionSource: canonicalJson(value), reviewAcceptanceSource }, label);
}
rejectReview({
  implementationClarificationSource: implementationClarificationSource.replace('Every other', 'Each other'),
  reviewAcceptanceSource,
  reviewDecisionSource,
}, 'implementation clarification');
const reviewAcceptance = parseJsonStrict(reviewAcceptanceSource);
for (const [label, mutate] of [
  ['receipt owner', (value) => { value.owner = 'someone-else'; }],
  ['receipt timestamp claim', (value) => { value.taskProvenance.approvalTimestamp = '2026-08-12T00:00:00Z'; }],
  ['receipt comment claim', (value) => { value.taskProvenance.githubCommentClaimed = true; }],
  ['receipt manifest', (value) => { value.manifest.sha256 = `sha256:${'f'.repeat(64)}`; }],
]) {
  const value = structuredClone(reviewAcceptance);
  mutate(value);
  rejectReview({ reviewDecisionSource, reviewAcceptanceSource: canonicalJson(value) }, label);
}
const reviewResult = verifyDeliveryReviewReadinessAuthority(repositoryRoot);
if (!reviewResult.accepted || reviewResult.targets !== 29 || reviewResult.manifest.entries < 20) {
  throw new Error('Decision 0009 positive result mismatch');
}

process.stdout.write('[delivery-authority] Decision 0007 preserved; 13 Decision 0009 negative mutations rejected; positive candidates accepted\n');
