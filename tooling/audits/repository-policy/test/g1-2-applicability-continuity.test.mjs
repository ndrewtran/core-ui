import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, parseJsonStrict } from '@muxui/schema';
import {
  assertG12ContinuityDecision,
  verifyG12ApplicabilityContinuityAuthority,
} from '../src/g1-2-applicability-continuity-verify.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const decisionPath = 'decisions/0008-g1-2-applicability-continuity.json';
const acceptancePath = 'decisions/0008-g1-2-applicability-continuity-acceptance.json';
const predecessorRootPath = 'tests/evidence/authority-54-delivery-workflow/index.json';
const read = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
const decisionSource = read(decisionPath);
const acceptanceSource = read(acceptancePath);
const decision = parseJsonStrict(decisionSource);
const predecessorRoot = parseJsonStrict(read(predecessorRootPath));
const loadPredecessor = (relativePath) => {
  const source = read(relativePath);
  return { source, value: parseJsonStrict(source) };
};

let rejected = 0;
const rejectDecision = (mutate, label) => {
  const candidate = structuredClone(decision);
  mutate(candidate);
  try {
    assertG12ContinuityDecision(candidate, predecessorRoot, loadPredecessor);
  } catch (error) {
    if (String(error.message).startsWith('G12_APPLICABILITY_CONTINUITY_INVALID:')) {
      rejected += 1;
      return;
    }
    throw error;
  }
  throw new Error(`negative accepted: ${label}`);
};
const rejectAuthority = (sources, label) => {
  try {
    verifyG12ApplicabilityContinuityAuthority(repositoryRoot, { sources });
  } catch (error) {
    if (String(error.message).startsWith('G12_APPLICABILITY_CONTINUITY_INVALID:')) {
      rejected += 1;
      return;
    }
    throw error;
  }
  throw new Error(`negative accepted: ${label}`);
};

rejectDecision((value) => { value.unknown = true; }, 'unknown decision key');
rejectDecision((value) => { value.affectedScopeIds.pop(); }, 'missing Scope ID');
rejectDecision((value) => { value.commitmentTransitions = 'changed'; }, 'commitment transition');
rejectDecision((value) => { value.continuityTopology.targets.pop(); }, 'missing target');
rejectDecision((value) => { value.continuityTopology.targets[0].predecessor.sha256 = `sha256:${'0'.repeat(64)}`; }, 'wrong predecessor');
rejectDecision((value) => { value.continuityTopology.targets[1].predecessorCurrentApplicabilityManifest.sha256 = `sha256:${'0'.repeat(64)}`; }, 'wrong predecessor manifest');
rejectDecision((value) => { value.continuityTopology.targets[1].successorPath = value.continuityTopology.targets[0].successorPath; }, 'duplicate successor');
rejectDecision((value) => { value.continuityTopology.evidenceRecords = 'allowed'; }, 'maintenance records');
rejectDecision((value) => { value.g12ProofTopology.assertionIds.pop(); }, 'missing G1.2 assertion');
rejectDecision((value) => { value.g12ProofTopology.componentSupportClaim = 'button'; }, 'component support claim');
rejectDecision((value) => { value.trackerReconciliation.scopeIds.pop(); }, 'tracker Scope ID');
rejectDecision((value) => { value.trackerReconciliation.preservedFields.status = 'complete'; }, 'tracker status');

const wrongAcceptance = parseJsonStrict(acceptanceSource);
wrongAcceptance.bodySha256 = `sha256:${'0'.repeat(64)}`;
rejectAuthority({ [acceptancePath]: canonicalJson(wrongAcceptance) }, 'acceptance body');
rejectAuthority({ 'strategy/product-scope.md': read('strategy/product-scope.md').replace('scopeVersion: 4.0.2', 'scopeVersion: 4.0.3') }, 'Product Scope drift');
rejectAuthority({ 'strategy/monorepo-architecture.md': 'not the accepted historical architecture' }, 'historical Architecture drift');
rejectAuthority({ 'strategy/milestone-roadmap.md': 'not the accepted historical roadmap' }, 'historical roadmap drift');
rejectAuthority({ [decisionPath]: `${decisionSource}\n` }, 'noncanonical decision');

const result = verifyG12ApplicabilityContinuityAuthority(repositoryRoot);
if (!result.accepted || result.targets !== 28 || result.g12Assertions !== 5 || result.affectedScopeIds !== 12) {
  throw new Error('positive result mismatch');
}
if (rejected !== 17) throw new Error(`expected 17 rejections, received ${rejected}`);

process.stdout.write('[g1.2-continuity] 17/17 negative mutations rejected; accepted authority verified\n');
