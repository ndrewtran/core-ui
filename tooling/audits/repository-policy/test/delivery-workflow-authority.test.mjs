import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import { verifyDeliveryWorkflowAuthority } from '../src/delivery-workflow-authority-verify.mjs';

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

const result = verifyDeliveryWorkflowAuthority(repositoryRoot);
if (result.activationEvidence !== 8 || result.applicabilityTargets !== 28 || result.productScope.version !== '4.0.2') {
  throw new Error('positive result mismatch');
}

process.stdout.write('[delivery-authority] 4/4 negative mutations rejected; positive candidate accepted\n');
