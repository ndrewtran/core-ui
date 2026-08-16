import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import {
  assertAuthorityDecisionShape,
} from './evidence-applicability-supersession.mjs';
import { sha256 } from './policy.mjs';

const DECISION_PATH = 'decisions/0008-g1-2-applicability-continuity.json';
const ACCEPTANCE_PATH = 'decisions/0008-g1-2-applicability-continuity-acceptance.json';
const PREDECESSOR_ROOT_PATH = 'tests/evidence/authority-54-delivery-workflow/index.json';
const PRODUCT_SCOPE_PATH = 'strategy/product-scope.md';
const ARCHITECTURE_PATH = 'strategy/monorepo-architecture.md';
const ROADMAP_PATH = 'strategy/milestone-roadmap.md';
const DECISION_0007_PATH = 'decisions/0007-delivery-workflow-authority.json';
const DECISION_0007_ACCEPTANCE_PATH = 'decisions/0007-delivery-workflow-authority-acceptance.json';

const DECISION_BYTES = 52927;
const DECISION_SHA256 = 'sha256:91181e70d5a6239e4eaa48d759a31af2c14422964d475af1917d005783b752af';
const ACCEPTANCE_BYTES = 558;
const ACCEPTANCE_SHA256 = 'sha256:5f0ce9837775f508bf1453f201df74b5972444801f4cee283bbdc8a67f27bc7a';
const PREDECESSOR_ROOT_SHA256 = 'sha256:79a1f3ad9a7aa7a05507074c60f9875b779350132cd56b1f2c7f5556dcf07f05';
const ARCHITECTURE_SHA256 = 'sha256:bdf8eb132fcdace479a05569020fd91acb0bde02dd1b24b33ce0f96ceaf39371';
const ROADMAP_SHA256 = 'sha256:808a972cf2d92064aacb0a10560ac512c0ac878b9c960098d9ddc7d84354f4c0';
const HISTORICAL_AUTHORITY_SOURCE = 'b27cb4fb3d71f8feca9505684201286d76f62d42';
const PRODUCT_SCOPE_SHA256 = 'sha256:7c8404e20d01f6a0cc975b17a7893f5594f6f0d313806a6fced9d0c62d886873';
const DECISION_0007_SHA256 = 'sha256:97aa9d33adb4da0cd9b6bf4d692993b8b8938401d73cb7cb20912c3f6e382c8f';
const DECISION_0007_ACCEPTANCE_SHA256 = 'sha256:282defb18bd1d897c14dc62e3ebc44cabf0d3cdbf4cd8c0419d71b9d1d03ed8d';
const TARGET_MANIFEST_SHA256 = 'sha256:30b1b7b06212bb59fe2e69ee12d6897997e6a0e6ba9e3e56e0d009fce3047f32';
const MAINTENANCE_ROOT_PATH = 'tests/evidence/authority-11-g1-2-applicability-v1/index.json';
const G12_ROOT_PATH = 'tests/evidence/g1.2/index.json';

const ASSERTIONS = ['E-G1.2-01', 'E-G1.2-02', 'E-G1.2-03', 'E-G1.2-04', 'E-G1.2-05'];
const SCOPE_IDS = [
  'SCOPE-PLATFORM-NATIVE-RN',
  'SCOPE-PKG-REACT-NATIVE',
  'SCOPE-PROFILE-ANDROID',
  'SCOPE-PROFILE-IOS',
  'SCOPE-PROFILE-RNW',
  'SCOPE-QUALITY-GENERATOR-CONTRACT',
  'SCOPE-SYSTEM-NATIVE',
  'SCOPE-THEME-ACCESSIBILITY',
  'SCOPE-THEME-PLATFORM-SAFETY',
  'SCOPE-TRUST-DISCLOSURE',
  'SCOPE-TRUST-EVIDENCE',
  'SCOPE-TRUST-EVIDENCE-PRIVACY',
];
const TOP_LEVEL_KEYS = [
  'acceptanceTopology', 'affectedScopeIds', 'authority', 'changeControlEffects',
  'commitmentTransitions', 'continuityTopology', 'createdAt', 'decision', 'decisionId',
  'g12ProofTopology', 'implementationOrder', 'nonGoals', 'owner', 'rollback', 'schema',
  'sourceBoundary', 'state', 'trackerReconciliation', 'validationContract',
];

const digest = (source) => `sha256:${sha256(source)}`;
const fail = (message) => { throw new Error(`G12_APPLICABILITY_CONTINUITY_INVALID: ${message}`); };
const exact = (actual, expected, label) => {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label);
};
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} shape`);
  exact(Object.keys(value).sort(), [...keys].sort(), `${label} keys`);
};
const identity = (source, bytes, sha, label) => {
  if (Buffer.byteLength(source) !== bytes || digest(source) !== sha) fail(`${label} identity`);
};

const EXPECTED_ACCEPTANCE = {
  authorAssociation: 'OWNER',
  bodySha256: 'sha256:ee6ddd2c28a5495e1bcbdf2c56b2524c5badec8a228c1957cbb032e1b234c084',
  commentId: 5263020048,
  commentNodeId: 'IC_kwDOTtLjcM8AAAABObNQEA',
  createdAt: '2026-08-12T06:08:37Z',
  decisionId: 'core-ui:decision:0008',
  issueNumber: 11,
  outcome: 'accepted',
  owner: 'ndrewtran',
  ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
  provider: 'github',
  repository: 'ndrewtran/core-ui',
  schema: 'core-ui-authority-decision-v1',
  updatedAt: '2026-08-12T06:08:37Z',
  url: 'https://github.com/ndrewtran/core-ui/issues/11#issuecomment-5263020048',
};

export function assertG12ContinuityDecision(decision, predecessorRoot, loadPredecessor) {
  exactKeys(decision, TOP_LEVEL_KEYS, 'decision');
  if (decision.schema !== 'core-ui-g1-2-applicability-continuity-authority-v1'
    || decision.decisionId !== 'core-ui:decision:0008'
    || decision.state !== 'proposed-digest-specific-acceptance-required'
    || decision.owner !== 'ndrewtran') fail('decision header');

  exact(decision.affectedScopeIds, SCOPE_IDS, 'affected Scope IDs');
  if (decision.commitmentTransitions
    !== 'none; all 12 affectedScopeIds remain committed at their existing Product Scope 4.0.2 meanings') {
    fail('commitment transitions');
  }
  if (decision.acceptanceTopology.candidatePath !== DECISION_PATH
    || decision.acceptanceTopology.receiptPath !== ACCEPTANCE_PATH
    || decision.acceptanceTopology.issueNumber !== 11
    || decision.acceptanceTopology.owner !== 'ndrewtran'
    || decision.acceptanceTopology.repository !== 'ndrewtran/core-ui') fail('acceptance topology');

  if (decision.continuityTopology.rootPath !== MAINTENANCE_ROOT_PATH
    || decision.continuityTopology.targetCount !== 28
    || decision.continuityTopology.targets?.length !== 28
    || decision.continuityTopology.evidenceRecords !== 'forbidden; index.records must be []'
    || decision.continuityTopology.reasonCode !== 'governing-authority-changed'
    || decision.continuityTopology.replacementStatus !== 'pending') fail('continuity topology');
  if (decision.continuityTopology.predecessorRoot.path !== PREDECESSOR_ROOT_PATH
    || decision.continuityTopology.predecessorRoot.sha256 !== PREDECESSOR_ROOT_SHA256) {
    fail('predecessor root binding');
  }
  if (predecessorRoot.supersessions?.length !== 28) fail('predecessor root target count');

  const successors = new Set();
  for (let index = 0; index < 28; index += 1) {
    const reference = predecessorRoot.supersessions[index];
    const target = decision.continuityTopology.targets[index];
    const { source, value } = loadPredecessor(reference.path);
    if (digest(source) !== reference.sha256) fail(`predecessor ${index} digest`);
    const expectedSuccessor = `tests/evidence/authority-11-g1-2-applicability-v1/supersessions/${basename(reference.path)}`;
    exact(target.predecessor, { path: reference.path, sha256: reference.sha256 }, `target ${index} predecessor`);
    if (target.milestone !== reference.milestone || target.successorPath !== expectedSuccessor) {
      fail(`target ${index} route`);
    }
    exact(target.historicalIndex, value.historicalIndex, `target ${index} historical index`);
    exact(target.affectedAssertions, value.affectedAssertions, `target ${index} assertions`);
    exact(target.replacementPlan, value.replacementPlan, `target ${index} replacement plan`);
    exact(
      target.predecessorCurrentApplicabilityManifest,
      value.currentApplicabilityManifest,
      `target ${index} current manifest`,
    );
    if (successors.has(target.successorPath)) fail(`target ${index} duplicate successor`);
    successors.add(target.successorPath);
  }

  if (decision.g12ProofTopology.rootPath !== G12_ROOT_PATH
    || decision.g12ProofTopology.profile !== 'core-ui-g1-2-evidence-v1'
    || decision.g12ProofTopology.recordCount !== 5
    || decision.g12ProofTopology.artifactCount !== 5
    || decision.g12ProofTopology.supersessions !== 'forbidden'
    || decision.g12ProofTopology.componentSupportClaim !== 'none') fail('G1.2 proof topology');
  exact(decision.g12ProofTopology.assertionIds, ASSERTIONS, 'G1.2 assertions');
  exact(decision.trackerReconciliation.scopeIds, SCOPE_IDS, 'tracker Scope IDs');
  if (decision.trackerReconciliation.issue !== 11
    || decision.trackerReconciliation.preservedFields.status !== 'active'
    || decision.trackerReconciliation.preservedFields.workType !== 'Milestone'
    || decision.trackerReconciliation.statusEffect
      !== 'none; preserve G1.2 active and do not infer evidence acceptance, completion, support, release, readiness, or merge') {
    fail('tracker reconciliation boundary');
  }
}

export function verifyG12ApplicabilityContinuityAuthority(repositoryRoot, options = {}) {
  const read = (path) => options.sources?.[path]
    ?? ([ARCHITECTURE_PATH, ROADMAP_PATH, PRODUCT_SCOPE_PATH].includes(path)
      ? execFileSync('git', ['show', `${HISTORICAL_AUTHORITY_SOURCE}:${path}`], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
      : readFileSync(join(repositoryRoot, path), 'utf8'));
  const decisionSource = read(DECISION_PATH);
  const acceptanceSource = read(ACCEPTANCE_PATH);
  const decision = parseJsonStrict(decisionSource);
  const acceptance = parseJsonStrict(acceptanceSource);
  if (decisionSource !== canonicalJson(decision)) fail('decision must be canonical JSON');
  if (acceptanceSource !== canonicalJson(acceptance)) fail('acceptance must be canonical JSON');
  identity(decisionSource, DECISION_BYTES, DECISION_SHA256, 'decision');
  identity(acceptanceSource, ACCEPTANCE_BYTES, ACCEPTANCE_SHA256, 'acceptance');

  const authoritySources = {
    [ARCHITECTURE_PATH]: [ARCHITECTURE_SHA256, decision.authority.architecture],
    [ROADMAP_PATH]: [ROADMAP_SHA256, decision.authority.milestoneRoadmap],
    [PRODUCT_SCOPE_PATH]: [PRODUCT_SCOPE_SHA256, decision.authority.productScope],
    [DECISION_0007_PATH]: [DECISION_0007_SHA256, decision.authority.decision0007],
    [DECISION_0007_ACCEPTANCE_PATH]: [
      DECISION_0007_ACCEPTANCE_SHA256,
      decision.authority.decision0007Acceptance,
    ],
    [PREDECESSOR_ROOT_PATH]: [PREDECESSOR_ROOT_SHA256, decision.authority.predecessorRoot],
  };
  for (const [path, [expectedSha, reference]] of Object.entries(authoritySources)) {
    const source = read(path);
    if (digest(source) !== expectedSha
      || reference.path !== path
      || reference.sha256 !== expectedSha
      || reference.bytes !== Buffer.byteLength(source)) fail(`${path} authority binding`);
  }
  if (!read(PRODUCT_SCOPE_PATH).startsWith('---\nscopeVersion: 4.0.2\n')) fail('Product Scope version');

  const predecessorRootSource = read(PREDECESSOR_ROOT_PATH);
  const predecessorRoot = parseJsonStrict(predecessorRootSource);
  assertG12ContinuityDecision(decision, predecessorRoot, (path) => {
    const source = read(path);
    return { source, value: parseJsonStrict(source) };
  });

  const acceptanceErrors = [];
  assertAuthorityDecisionShape(acceptance, (message) => acceptanceErrors.push(message));
  if (acceptanceErrors.length > 0) fail(`acceptance grammar: ${acceptanceErrors.join('; ')}`);
  exact(acceptance, EXPECTED_ACCEPTANCE, 'acceptance receipt');

  return {
    accepted: true,
    affectedScopeIds: SCOPE_IDS.length,
    decision: { bytes: DECISION_BYTES, sha256: DECISION_SHA256 },
    g12Assertions: ASSERTIONS.length,
    maintenanceRoot: MAINTENANCE_ROOT_PATH,
    predecessorTargetManifest: TARGET_MANIFEST_SHA256,
    targets: 28,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.stdout.write(`${canonicalJson(verifyG12ApplicabilityContinuityAuthority(resolve(import.meta.dirname, '../../../..')))}\n`);
}
