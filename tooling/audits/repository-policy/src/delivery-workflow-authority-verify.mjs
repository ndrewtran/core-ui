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
const ACTIVATION_EVIDENCE = [
  'E-DELIVERY-01', 'E-DELIVERY-02', 'E-DELIVERY-03', 'E-DELIVERY-04',
  'E-DELIVERY-05', 'E-DELIVERY-06', 'E-DELIVERY-07', 'E-DELIVERY-08',
];

const digest = (source) => `sha256:${sha256(source)}`;
const fail = (message) => { throw new Error(`DELIVERY_WORKFLOW_AUTHORITY_INVALID: ${message}`); };
const exact = (actual, expected, label) => {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label);
};

export function verifyDeliveryWorkflowAuthority(repositoryRoot, options = {}) {
  const decisionSource = options.decisionSource
    ?? readFileSync(join(repositoryRoot, DECISION_PATH), 'utf8');
  const acceptanceSource = options.acceptanceSource
    ?? readFileSync(join(repositoryRoot, ACCEPTANCE_PATH), 'utf8');
  const productScopeSource = options.productScopeSource
    ?? readFileSync(join(repositoryRoot, PRODUCT_SCOPE_PATH), 'utf8');
  const architectureSource = options.architectureSource
    ?? readFileSync(join(repositoryRoot, ARCHITECTURE_PATH), 'utf8');
  const roadmapSource = options.roadmapSource
    ?? readFileSync(join(repositoryRoot, ROADMAP_PATH), 'utf8');
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

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${canonicalJson(verifyDeliveryWorkflowAuthority(resolve(import.meta.dirname, '../../../..')))}\n`);
}
