import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import {
  verifyDecision0009Amendment02SkillSuccessor,
  verifyDeliveryReviewReadinessAuthority,
  verifyDeliveryWorkflowAuthority,
} from '../src/delivery-workflow-authority-verify.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const decisionSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0007-delivery-workflow-authority.json'), 'utf8');
const acceptanceSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0007-delivery-workflow-authority-acceptance.json'), 'utf8');
const productScopeSource = fs.readFileSync(path.join(repositoryRoot, 'strategy/product-scope.md'), 'utf8');
const r1AcceptancePath = 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md';
const r1ManifestPath = 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json';
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const renderTemplate = (template, substitutions) => Object.entries(substitutions).reduce(
  (output, [name, value]) => output.replaceAll(`{${name}}`, value),
  template,
);

const writeR1Acceptance = (fixtureRoot) => {
  const manifestBytes = fs.readFileSync(path.join(fixtureRoot, r1ManifestPath));
  const manifest = parseJsonStrict(manifestBytes.toString('utf8'));
  const manifestSha256 = sha256(manifestBytes);
  const ownerCommentUrl = 'https://github.com/ndrewtran/core-ui/pull/87#issuecomment-1';
  const ownerStatement = renderTemplate(manifest.acceptanceRecordRenderer.ownerStatementTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
  });
  const acceptance = renderTemplate(manifest.acceptanceRecordRenderer.outputTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
    ownerCommentUrl,
    ownerStatement,
    ownerStatementSha256: sha256(ownerStatement),
  });
  fs.writeFileSync(path.join(fixtureRoot, r1AcceptancePath), acceptance);
};

const makeR1Fixture = (receiptState = 'staged') => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'core-ui-r1-authority-fixture-'));
  execFileSync('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, fixtureRoot], {
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', '--quiet', '--detach', 'HEAD'], {cwd: fixtureRoot, stdio: 'ignore'});
  const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  for (const relativePath of stagedPaths) {
    const destination = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(repositoryRoot, relativePath), destination);
  }
  writeR1Acceptance(fixtureRoot);
  if (receiptState === 'staged') {
    execFileSync('git', ['add', '--', r1AcceptancePath], {cwd: fixtureRoot, stdio: 'ignore'});
  } else if (receiptState === 'intent-to-add') {
    execFileSync('git', ['add', '-N', '--', r1AcceptancePath], {cwd: fixtureRoot, stdio: 'ignore'});
  }
  return fixtureRoot;
};

const rejectAt = (root, options, label) => {
  try {
    verifyDeliveryWorkflowAuthority(root, options);
  } catch (error) {
    if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
    throw error;
  }
  throw new Error(`negative accepted: ${label}`);
};
const reject = (options, label) => rejectAt(repositoryRoot, options, label);

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

reject({ productScopeSource: productScopeSource.replace('scopeVersion: 6.0.1', 'scopeVersion: 6.0.2') }, 'Product Scope');
reject({ architectureSource: 'not the accepted historical architecture' }, 'historical Architecture');
reject({ roadmapSource: 'not the accepted historical roadmap' }, 'historical roadmap');

reject({}, 'untracked continuous-authority receipt');
for (const receiptState of ['worktree-only', 'intent-to-add']) {
  const fixtureRoot = makeR1Fixture(receiptState);
  try {
    rejectAt(fixtureRoot, {}, `${receiptState} continuous-authority receipt`);
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
}

const positiveFixture = makeR1Fixture();
let currentResult;
let comprehensiveResult;
try {
  currentResult = verifyDeliveryWorkflowAuthority(positiveFixture);
  comprehensiveResult = verifyDeliveryWorkflowAuthority(positiveFixture, { productScopeSource });
} finally {
  fs.rmSync(positiveFixture, {recursive: true, force: true});
}
if (currentResult.activationEvidence !== 8
    || currentResult.applicabilityTargets !== 28
    || currentResult.productScope.version !== '6.0.1'
    || currentResult.sourceMode !== 'current'
    || currentResult.r1Entry?.accepted !== true
    || currentResult.r1Entry?.activation?.permitted !== false) {
  throw new Error('canonical current R1.0 entry mismatch');
}
const result = verifyDeliveryWorkflowAuthority(repositoryRoot, { sourceMode: 'historical' });
if (result.activationEvidence !== 8
    || result.applicabilityTargets !== 28
    || result.productScope.version !== '4.0.2'
    || result.sourceMode !== 'historical'
    || result.r1Entry !== undefined) {
  throw new Error('positive result mismatch');
}
if (comprehensiveResult.productScope.version !== '6.0.1'
    || comprehensiveResult.productScope.bytes !== Buffer.byteLength(productScopeSource)
    || comprehensiveResult.r1Entry?.accepted !== true
    || comprehensiveResult.r1Entry?.stage1?.accepted !== true
    || comprehensiveResult.r1Entry?.applicability?.historicalEvidence?.sufficient !== false
    || comprehensiveResult.r1Entry?.applicability?.status !== 'pending-current-evidence'
    || comprehensiveResult.r1Entry?.activation?.permitted !== false) {
  throw new Error('current Product Scope positive result mismatch');
}

const oldOnlyProof = productScopeSource.replace('scopeVersion: 6.0.1', 'scopeVersion: 5.0.1');
reject({ productScopeSource: oldOnlyProof }, 'old-only current R1.0 proof');
const missingStage1Route = fs.readFileSync(path.join(repositoryRoot, 'strategy/milestone-roadmap.md'), 'utf8')
  .replace('react-aria-stage1-source-verify.mjs', 'react-aria-stage1-source-verify-replaced.mjs');
reject({ productScopeSource, roadmapSource: missingStage1Route }, 'missing current Stage 1 route');

const rejectCurrentWorkingTree = (mutate, label) => {
  const temporaryRepository = makeR1Fixture();
  try {
    mutate(temporaryRepository);
    try {
      verifyDeliveryWorkflowAuthority(temporaryRepository);
    } catch (error) {
      if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')
          || String(error.message).startsWith('REACT_ARIA_STAGE1_SOURCE_INVALID:')) return;
      throw error;
    }
    throw new Error(`canonical current entry accepted: ${label}`);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
};

rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, 'strategy/product-scope.md');
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace('scopeVersion: 6.0.1', 'scopeVersion: 5.0.1'));
}, 'replaced current Product Scope');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(
    temporaryRepository,
    'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  );
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace('issuecomment-1', 'issuecomment-0'));
}, 'invalid continuous-authority owner record');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(
    temporaryRepository,
    'decisions/0010-amendment-04-r1-continuous-execution-materialization.json',
  );
  const manifest = parseJsonStrict(fs.readFileSync(currentPath, 'utf8'));
  manifest.staticAfterImages = manifest.staticAfterImages.filter(({ path: relativePath }) => (
    relativePath !== 'strategy/product-scope.md'
  ));
  fs.writeFileSync(currentPath, canonicalJson(manifest));
}, 'continuous-authority manifest without Product Scope binding');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, 'strategy/milestone-roadmap.md');
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace('react-aria-stage1-source-verify.mjs', 'react-aria-stage1-source-verify-replaced.mjs'));
}, 'missing current Stage 1 route');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, 'catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json');
  const currentBytes = fs.readFileSync(currentPath);
  currentBytes[0] ^= 1;
  fs.writeFileSync(currentPath, currentBytes);
}, 'replaced current Stage 1 snapshot');

const reviewDecisionSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0009-delivery-review-readiness.json'), 'utf8');
const reviewAcceptanceSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0009-delivery-review-readiness-acceptance.json'), 'utf8');
const implementationClarificationSource = fs.readFileSync(
  path.join(repositoryRoot, 'decisions/0009-amendment-01-implementation-clarification.md'),
  'utf8',
);
const amendment02Source = fs.readFileSync(
  path.join(repositoryRoot, 'decisions/0009-amendment-02-skill-routing.md'),
  'utf8',
);
const amendment02AcceptanceSource = fs.readFileSync(
  path.join(repositoryRoot, 'decisions/0009-amendment-02-skill-routing-acceptance.md'),
  'utf8',
);
const successorSkillSource = fs.readFileSync(
  path.join(repositoryRoot, '.agents/skills/core-ui-delivery/SKILL.md'),
  'utf8',
);
const successorYamlSource = fs.readFileSync(
  path.join(repositoryRoot, '.agents/skills/core-ui-delivery/agents/openai.yaml'),
  'utf8',
);
const rejectAmendment02 = (options, label) => {
  try {
    verifyDecision0009Amendment02SkillSuccessor(repositoryRoot, options);
  } catch (error) {
    if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
    throw error;
  }
  throw new Error(`Decision 0009 amendment 02 negative accepted: ${label}`);
};
const amendment02Result = verifyDecision0009Amendment02SkillSuccessor(repositoryRoot);
if (!amendment02Result.accepted
    || amendment02Result.amendment.bytes !== 6976
    || amendment02Result.skill.bytes !== 7839
    || amendment02Result.interfaceMetadata.bytes !== 577) {
  throw new Error('Decision 0009 amendment 02 positive result mismatch');
}
rejectAmendment02({
  reviewAmendment02Source: amendment02Source.replace('Status: Candidate;', 'Status: Candidate changed;'),
}, 'candidate identity');
rejectAmendment02({
  reviewAmendment02AcceptanceSource: amendment02AcceptanceSource.replace(
    'Approval timestamp: Not recorded',
    'Approval timestamp: 2026-08-18T00:00:00Z',
  ),
}, 'acceptance identity');
rejectAmendment02({
  reviewSuccessorSkillSource: successorSkillSource.replace('Root implementation and routine', 'Root implementation and routine drift'),
}, 'successor SKILL identity');
rejectAmendment02({
  reviewSuccessorYamlSource: successorYamlSource.replace('Core UI Delivery', 'Core UI Delivery drift'),
}, 'successor interface metadata identity');
rejectAmendment02({ reviewSuccessorYamlSource: '' }, 'missing successor binding');
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

process.stdout.write('[delivery-authority] Decision 0007 preserved; Decision 0009 amendment 02 successor negatives rejected; positive candidates accepted\n');
