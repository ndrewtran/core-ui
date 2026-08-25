import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import { sha256 } from './policy.mjs';
import { verifyHistoricalR1ContinuousAuthority } from './r1-continuous-authority-compatibility.mjs';

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
const REVIEW_AMENDMENT02_PATH = 'decisions/0009-amendment-02-skill-routing.md';
const REVIEW_AMENDMENT02_ACCEPTANCE_PATH = 'decisions/0009-amendment-02-skill-routing-acceptance.md';
const REVIEW_AMENDMENT02_BYTES = 6976;
const REVIEW_AMENDMENT02_SHA256 = 'sha256:eb9c906ba9fb72e58f596f876175c402909dab4998f12c2f14cbd26e5667d8b2';
const REVIEW_AMENDMENT02_ACCEPTANCE_BYTES = 984;
const REVIEW_AMENDMENT02_ACCEPTANCE_SHA256 = 'sha256:4f0b1f054497986cd1ac708aa3b94738b22bd26f9b8590065f7ec8e8488dfcd1';
const REVIEW_AMENDMENT04_PATH = 'decisions/0009-amendment-04-repository-policy-readme-historical-compatibility.md';
const REVIEW_AMENDMENT04_ACCEPTANCE_PATH = 'decisions/0009-amendment-04-repository-policy-readme-historical-compatibility-acceptance.md';
const REVIEW_AMENDMENT04_BYTES = 2948;
const REVIEW_AMENDMENT04_SHA256 = 'sha256:4269d3c8f43e00328c85e353ec0d08fb6e37dae9a72abc55c5918f600e3d089f';
const REVIEW_SUCCESSOR_SOURCE = '02b5aeab66013f2f04ee9847161b48a11c7cbd41';
const R1_README_RECOVERY_PATH = 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery.md';
const R1_README_RECOVERY_ACCEPTANCE_PATH = 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery-acceptance.md';
const R1_README_RECOVERY_BYTES = 3050;
const R1_README_RECOVERY_SHA256 = 'sha256:a8d9ea091430ca7b10f1ac9e05f98411b597207e4ae564a4f9e9a754d1c2235f';
const R1_README_RECOVERY_CANDIDATE_BYTES = 12193;
const R1_README_RECOVERY_CANDIDATE_SHA256 = '23fbb5acb55416a4079fe012b2f9c67b3df6e18ecdd8bbed2da1a1caa311d81a';
const REVIEW_README_PATH = 'tooling/audits/repository-policy/README.md';
const REVIEW_README_HISTORICAL_BYTES = 1429;
const REVIEW_README_HISTORICAL_SHA256 = 'sha256:d3a55d931f9e29e26fa76d0b38c139d1da28b0d73575d42d1457cd27b20f523b';
const REVIEW_SUCCESSOR_SKILL_PATH = '.agents/skills/core-ui-delivery/SKILL.md';
const REVIEW_SUCCESSOR_SKILL_BYTES = 7839;
const REVIEW_SUCCESSOR_SKILL_SHA256 = 'sha256:34007a84eb46ef979a663357bdca641ac3661e9276b5944de03143b7b7216db9';
const REVIEW_SUCCESSOR_YAML_PATH = '.agents/skills/core-ui-delivery/agents/openai.yaml';
const REVIEW_SUCCESSOR_YAML_BYTES = 577;
const REVIEW_SUCCESSOR_YAML_SHA256 = 'sha256:0cad2dfe963cdbca6b698415d0d9fe045d8e968bc198b505e7c83d24cc33869a';
const REVIEW_PREDECESSOR_SKILL_BYTES = 5789;
const REVIEW_PREDECESSOR_SKILL_SHA256 = 'sha256:5695b79539fd4cfe15e379cca448c6c35d59d3fa46c62044383e9381455cbae5';
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
const readCommittedArtifact = (repositoryRoot, commit, path) => execFileSync(
  'git',
  ['show', `${commit}:${path}`],
  { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const readHistoricalArtifact = (repositoryRoot, path) => {
  try {
    return execFileSync('git', ['show', `${REVIEW_HISTORICAL_SOURCE}:${path}`], {
      cwd: repositoryRoot,
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    fail(`historical artifact identity ${path}`);
  }
};

export function verifyDeliveryWorkflowAuthority(repositoryRoot, options = {}) {
  if (options.sourceMode !== 'historical') {
    fail('historical audit requires explicit sourceMode: historical');
  }
  let historicalR1Authority;
  try {
    historicalR1Authority = verifyHistoricalR1ContinuousAuthority(repositoryRoot);
  } catch {
    fail('R1 continuous authority compatibility');
  }
  const decisionSource = options.decisionSource
    ?? readFileSync(join(repositoryRoot, DECISION_PATH), 'utf8');
  const acceptanceSource = options.acceptanceSource
    ?? readFileSync(join(repositoryRoot, ACCEPTANCE_PATH), 'utf8');
  const productScopeSource = options.productScopeSource
    ?? readHistoricalAuthority(repositoryRoot, PRODUCT_SCOPE_PATH);
  const decision = parseJsonStrict(decisionSource);
  const acceptance = parseJsonStrict(acceptanceSource);

  if (decisionSource !== canonicalJson(decision)) fail('decision must be canonical JSON');
  if (acceptanceSource !== canonicalJson(acceptance)) fail('acceptance must be canonical JSON');
  if (Buffer.byteLength(decisionSource) !== DECISION_BYTES || digest(decisionSource) !== DECISION_SHA256) fail('decision identity');
  if (Buffer.byteLength(acceptanceSource) !== ACCEPTANCE_BYTES || digest(acceptanceSource) !== ACCEPTANCE_SHA256) fail('acceptance identity');
  const productScopeVersion = Buffer.byteLength(productScopeSource) === PRODUCT_SCOPE_BYTES
    && digest(productScopeSource) === PRODUCT_SCOPE_SHA256
    && productScopeSource.startsWith('---\nscopeVersion: 4.0.2\n')
    ? '4.0.2'
    : null;
  if (productScopeVersion === null) fail('historical Product Scope accepted identity');
  const architectureSource = options.architectureSource
    ?? readHistoricalAuthority(repositoryRoot, ARCHITECTURE_PATH);
  const roadmapSource = options.roadmapSource
    ?? readHistoricalAuthority(repositoryRoot, ROADMAP_PATH);
  if (digest(architectureSource) !== ARCHITECTURE_SHA256 || digest(roadmapSource) !== ROADMAP_SHA256) {
    fail('historical Architecture or roadmap identity');
  }

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

  const result = {
    accepted: true,
    activationEvidence: ACTIVATION_EVIDENCE.length,
    applicabilityTargets: decision.authorityApplicability.targets.length,
    decision: { bytes: Buffer.byteLength(decisionSource), sha256: digest(decisionSource) },
    productScope: { bytes: Buffer.byteLength(productScopeSource), sha256: digest(productScopeSource), version: productScopeVersion },
    sourceMode: 'historical',
  };
  result.r1Authority = historicalR1Authority;
  return result;
}

export function verifyDecision0009Amendment02SkillSuccessor(repositoryRoot, options = {}) {
  const amendmentSource = options.reviewAmendment02Source
    ?? readFileSync(join(repositoryRoot, REVIEW_AMENDMENT02_PATH), 'utf8');
  const acceptanceSource = options.reviewAmendment02AcceptanceSource
    ?? readFileSync(join(repositoryRoot, REVIEW_AMENDMENT02_ACCEPTANCE_PATH), 'utf8');
  const skillSource = options.reviewSuccessorSkillSource
    ?? readCommittedArtifact(repositoryRoot, REVIEW_SUCCESSOR_SOURCE, REVIEW_SUCCESSOR_SKILL_PATH);
  const yamlSource = options.reviewSuccessorYamlSource
    ?? readCommittedArtifact(repositoryRoot, REVIEW_SUCCESSOR_SOURCE, REVIEW_SUCCESSOR_YAML_PATH);

  if (Buffer.byteLength(amendmentSource) !== REVIEW_AMENDMENT02_BYTES
      || digest(amendmentSource) !== REVIEW_AMENDMENT02_SHA256) {
    fail('Decision 0009 amendment 02 candidate identity');
  }
  if (Buffer.byteLength(acceptanceSource) !== REVIEW_AMENDMENT02_ACCEPTANCE_BYTES
      || digest(acceptanceSource) !== REVIEW_AMENDMENT02_ACCEPTANCE_SHA256) {
    fail('Decision 0009 amendment 02 acceptance identity');
  }
  const requiredAcceptanceLines = [
    '# Acceptance: Decision 0009 amendment 02',
    '- Decision: `core-ui:decision:0009:amendment:02`',
    '- Parent decision: `core-ui:decision:0009`',
    '- Repository: `ndrewtran/core-ui`',
    '- Owner: Andrew / `ndrewtran`',
    '- Outcome: Accepted',
    '- Candidate: 6,976 bytes, SHA-256 `eb9c906ba9fb72e58f596f876175c402909dab4998f12c2f14cbd26e5667d8b2`',
    '- Approval instruction: `I approve Decision 0009 amendment 02, SHA-256 eb9c906ba9fb72e58f596f876175c402909dab4998f12c2f14cbd26e5667d8b2`',
    '- Approval timestamp: Not recorded',
    '- GitHub comment claimed: No',
    "The candidate's `Status: Candidate; pending the designated human owner's digest-specific acceptance.` line is frozen candidate-phase text; this separate receipt records the current accepted state.",
  ];
  if (requiredAcceptanceLines.some((line) => !acceptanceSource.includes(line))) {
    fail('Decision 0009 amendment 02 acceptance binding');
  }
  if (Buffer.byteLength(skillSource) !== REVIEW_SUCCESSOR_SKILL_BYTES
      || digest(skillSource) !== REVIEW_SUCCESSOR_SKILL_SHA256) {
    fail('Decision 0009 amendment 02 successor SKILL identity');
  }
  if (Buffer.byteLength(yamlSource) !== REVIEW_SUCCESSOR_YAML_BYTES
      || digest(yamlSource) !== REVIEW_SUCCESSOR_YAML_SHA256) {
    fail('Decision 0009 amendment 02 successor interface metadata identity');
  }
  return {
    accepted: true,
    amendment: { bytes: Buffer.byteLength(amendmentSource), sha256: digest(amendmentSource) },
    acceptance: { bytes: Buffer.byteLength(acceptanceSource), sha256: digest(acceptanceSource) },
    skill: { bytes: Buffer.byteLength(skillSource), sha256: digest(skillSource) },
    interfaceMetadata: { bytes: Buffer.byteLength(yamlSource), sha256: digest(yamlSource) },
  };
}

const parseRecoveryAcceptance = (source, expected) => {
  const text = source.toString('utf8');
  const nonclaims = 'This record claims acceptance only; no issue, PR, checks, review, merge, implementation, Project, publication, or release outcome is claimed.';
  const expectedFieldOrder = [
    'Decision',
    'Parent decision',
    'Repository',
    'Owner',
    'Outcome',
    'Candidate',
    'Pre-acceptance materialization diff',
    'Execution manifest',
    'Decision path',
    'Acceptance path',
    'Approval instruction',
    'Human acceptance',
    'Approval timestamp',
    'Protected authority PR/merge',
  ];
  if (!text.endsWith('\n')) fail(`${expected.label} acceptance final newline`);
  const lines = text.slice(0, -1).split('\n');
  if (lines.length !== 18
      || lines[0] !== `# Acceptance: ${expected.title}`
      || lines[1] !== ''
      || lines[16] !== ''
      || lines[17] !== nonclaims) {
    fail(`${expected.label} acceptance document shape`);
  }
  const fields = new Map();
  for (const [index, line] of lines.slice(2, 16).entries()) {
    const match = line.match(/^- ([^:\n]+):[ \t]*(.*)$/u);
    if (!match || match[1] !== expectedFieldOrder[index]) {
      fail(`${expected.label} acceptance field order`);
    }
    const [, name, value] = match;
    fields.set(name, value);
  }
  if (fields.get('Decision') !== `\`${expected.decisionId}\``
      || fields.get('Parent decision') !== `\`${expected.parentId}\``
      || fields.get('Repository') !== '`ndrewtran/core-ui`'
      || fields.get('Owner') !== 'Andrew / `ndrewtran`'
      || fields.get('Outcome') !== 'Accepted'
      || fields.get('Decision path') !== `\`${expected.decisionPath}\``
      || fields.get('Acceptance path') !== `\`${expected.acceptancePath}\``
      || fields.get('Protected authority PR/merge') !== 'Pending; not claimed by this record') {
    fail(`${expected.label} acceptance authority binding`);
  }
  const identity = (name) => fields.get(name)?.match(/^([\d,]+) bytes, SHA-256 `([0-9a-f]{64})`$/u);
  const candidate = identity('Candidate');
  const diff = identity('Pre-acceptance materialization diff');
  const manifest = identity('Execution manifest');
  if (!candidate || Number(candidate[1].replaceAll(',', '')) !== R1_README_RECOVERY_CANDIDATE_BYTES
      || candidate[2] !== R1_README_RECOVERY_CANDIDATE_SHA256
      || !diff || !manifest
      || !Number.isSafeInteger(Number(diff[1].replaceAll(',', '')))
      || !Number.isSafeInteger(Number(manifest[1].replaceAll(',', '')))) {
    fail(`${expected.label} acceptance candidate/diff/manifest binding`);
  }
  const approval = text.match(/^- Approval instruction: “([^”\n]+)”$/mu)?.[1];
  const human = text.match(/^- Human acceptance: Andrew \/ `ndrewtran`: “([^”\n]+)”$/mu)?.[1];
  const expectedStatement = `I accept Core UI R1 README historical compatibility recovery candidate v4, SHA-256 ${candidate[2]}; pre-acceptance materialization diff, SHA-256 ${diff[2]}; and execution manifest v4, SHA-256 ${manifest[2]}. I authorize the exact six-path authority materialization and owner acceptance records; its authority issue, protected non-draft PR, and merge after all named deterministic checks and external authority review pass; the exact ten-path PR #92 recovery, protected intermediate merge, postmerge verification, bounded Project README reconciliation, and continuation under the existing R1 continuous-execution envelope. Npm publication and the final R1-exit PR merge remain separate stops.`;
  if (!approval || !human || approval !== human || approval !== expectedStatement
      || text.split(approval).length - 1 !== 2) {
    fail(`${expected.label} acceptance statement binding`);
  }
  const timestamp = fields.get('Approval timestamp');
  if (timestamp !== 'Not recorded' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(timestamp)) {
    fail(`${expected.label} acceptance timestamp`);
  }
  return {
    candidate: candidate.slice(1),
    diff: diff.slice(1),
    manifest: manifest.slice(1),
    statement: approval,
  };
};

export function verifyDecision0009ReadmeHistoricalCompatibility(repositoryRoot, options = {}) {
  const decision0009Source = options.reviewAmendment04Source
    ?? readFileSync(join(repositoryRoot, REVIEW_AMENDMENT04_PATH), 'utf8');
  const decision0010Source = options.r1ReadmeRecoverySource
    ?? readFileSync(join(repositoryRoot, R1_README_RECOVERY_PATH), 'utf8');
  if (Buffer.byteLength(decision0009Source) !== REVIEW_AMENDMENT04_BYTES
      || digest(decision0009Source) !== REVIEW_AMENDMENT04_SHA256) {
    fail('Decision 0009 amendment 04 identity');
  }
  if (Buffer.byteLength(decision0010Source) !== R1_README_RECOVERY_BYTES
      || digest(decision0010Source) !== R1_README_RECOVERY_SHA256) {
    fail('Decision 0010 amendment 08 identity');
  }
  const acceptance0009 = parseRecoveryAcceptance(
    options.reviewAmendment04AcceptanceSource
      ?? readFileSync(join(repositoryRoot, REVIEW_AMENDMENT04_ACCEPTANCE_PATH), 'utf8'),
    {
      acceptancePath: REVIEW_AMENDMENT04_ACCEPTANCE_PATH,
      decisionId: 'core-ui:decision:0009:amendment:04',
      decisionPath: REVIEW_AMENDMENT04_PATH,
      label: 'Decision 0009 amendment 04',
      parentId: 'core-ui:decision:0009',
      title: 'Decision 0009 amendment 04',
    },
  );
  const acceptance0010 = parseRecoveryAcceptance(
    options.r1ReadmeRecoveryAcceptanceSource
      ?? readFileSync(join(repositoryRoot, R1_README_RECOVERY_ACCEPTANCE_PATH), 'utf8'),
    {
      acceptancePath: R1_README_RECOVERY_ACCEPTANCE_PATH,
      decisionId: 'core-ui:decision:0010:amendment:08',
      decisionPath: R1_README_RECOVERY_PATH,
      label: 'Decision 0010 amendment 08',
      parentId: 'core-ui:decision:0010',
      title: 'Decision 0010 amendment 08',
    },
  );
  if (canonicalJson(acceptance0009) !== canonicalJson(acceptance0010)) {
    fail('recovery acceptance records must bind one human statement and artifact set');
  }
  return {
    accepted: true,
    amendment0009: { bytes: Buffer.byteLength(decision0009Source), sha256: digest(decision0009Source) },
    amendment0010: { bytes: Buffer.byteLength(decision0010Source), sha256: digest(decision0010Source) },
    acceptance: acceptance0009,
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
  const amendment02 = verifyDecision0009Amendment02SkillSuccessor(repositoryRoot, options);
  const readmeCompatibility = verifyDecision0009ReadmeHistoricalCompatibility(repositoryRoot, options);
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
    if (entry.path === REVIEW_SUCCESSOR_SKILL_PATH) {
      if (entry.byteLength !== REVIEW_PREDECESSOR_SKILL_BYTES
          || entry.sha256 !== REVIEW_PREDECESSOR_SKILL_SHA256) {
        fail('Decision 0009 predecessor SKILL identity');
      }
    }
    const bytes = readHistoricalArtifact(repositoryRoot, entry.path);
    if (entry.path === REVIEW_README_PATH
        && (bytes.byteLength !== REVIEW_README_HISTORICAL_BYTES
          || digest(bytes) !== REVIEW_README_HISTORICAL_SHA256)) {
      fail(`historical artifact identity ${entry.path}`);
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
    readmeCompatibility,
    successor: amendment02,
    targets: decision.continuationTopology.targets.length,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  process.stdout.write(`${canonicalJson({
    deliveryReviewReadiness: verifyDeliveryReviewReadinessAuthority(repositoryRoot),
    deliveryWorkflow: verifyDeliveryWorkflowAuthority(repositoryRoot, { sourceMode: 'historical' }),
  })}\n`);
}
