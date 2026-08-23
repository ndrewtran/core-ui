import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import {
  verifyDecision0009Amendment02SkillSuccessor,
  verifyDecision0009ReadmeHistoricalCompatibility,
  verifyDeliveryReviewReadinessAuthority,
  verifyDeliveryWorkflowAuthority,
} from '../src/delivery-workflow-authority-verify.mjs';
import {
  verifyCurrentR1ContinuousAuthority,
  verifyHistoricalR1ContinuousAuthority,
} from '../src/r1-continuous-authority-compatibility.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const decisionSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0007-delivery-workflow-authority.json'), 'utf8');
const acceptanceSource = fs.readFileSync(path.join(repositoryRoot, 'decisions/0007-delivery-workflow-authority-acceptance.json'), 'utf8');
const productScopeSource = fs.readFileSync(path.join(repositoryRoot, 'strategy/product-scope.md'), 'utf8');
const pinnedCurrentAuthority = Object.freeze({
  authorityDecisionSource: fs.readFileSync(
    path.join(repositoryRoot, 'decisions/0010-amendment-06-r1-change-intent-owner.md'), 'utf8',
  ),
  authorityAcceptanceSource: fs.readFileSync(
    path.join(repositoryRoot, 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'), 'utf8',
  ),
  architectureSource: fs.readFileSync(path.join(repositoryRoot, 'strategy/monorepo-architecture.md'), 'utf8'),
  roadmapSource: fs.readFileSync(path.join(repositoryRoot, 'strategy/milestone-roadmap.md'), 'utf8'),
  productScopeSource,
});
const r1AcceptancePath = 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md';
const r1ManifestPath = 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json';
const amendment07DecisionPath = 'decisions/0010-amendment-07-r1-external-review-ci-recovery.md';
const amendment07AcceptancePath = 'decisions/0010-amendment-07-r1-external-review-ci-recovery-acceptance.md';
const amendment04DecisionPath = 'decisions/0009-amendment-04-repository-policy-readme-historical-compatibility.md';
const amendment04AcceptancePath = 'decisions/0009-amendment-04-repository-policy-readme-historical-compatibility-acceptance.md';
const amendment08DecisionPath = 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery.md';
const amendment08AcceptancePath = 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery-acceptance.md';
const amendment09DecisionPath = 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md';
const amendment09AcceptancePath = 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md';
const recoveryCandidateSha256 = '23fbb5acb55416a4079fe012b2f9c67b3df6e18ecdd8bbed2da1a1caa311d81a';
const readmePath = 'tooling/audits/repository-policy/README.md';
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const renderTemplate = (template, substitutions) => Object.entries(substitutions).reduce(
  (output, [name, value]) => output.replaceAll(`{${name}}`, value),
  template,
);

const recoveryStatement = `I accept Core UI R1 README historical compatibility recovery candidate v4, SHA-256 ${recoveryCandidateSha256}; pre-acceptance materialization diff, SHA-256 ${'1'.repeat(64)}; and execution manifest v4, SHA-256 ${'2'.repeat(64)}. I authorize the exact six-path authority materialization and owner acceptance records; its authority issue, protected non-draft PR, and merge after all named deterministic checks and external authority review pass; the exact ten-path PR #92 recovery, protected intermediate merge, postmerge verification, bounded Project README reconciliation, and continuation under the existing R1 continuous-execution envelope. Npm publication and the final R1-exit PR merge remain separate stops.`;
const recoveryAcceptance = ({ acceptancePath, decisionId, decisionPath, parentId, title }) => [
  `# Acceptance: ${title}`,
  '',
  `- Decision: \`${decisionId}\``,
  `- Parent decision: \`${parentId}\``,
  '- Repository: `ndrewtran/core-ui`',
  '- Owner: Andrew / `ndrewtran`',
  '- Outcome: Accepted',
  `- Candidate: 12,193 bytes, SHA-256 \`${recoveryCandidateSha256}\``,
  `- Pre-acceptance materialization diff: 1 bytes, SHA-256 \`${'1'.repeat(64)}\``,
  `- Execution manifest: 1 bytes, SHA-256 \`${'2'.repeat(64)}\``,
  `- Decision path: \`${decisionPath}\``,
  `- Acceptance path: \`${acceptancePath}\``,
  `- Approval instruction: “${recoveryStatement}”`,
  `- Human acceptance: Andrew / \`ndrewtran\`: “${recoveryStatement}”`,
  '- Approval timestamp: Not recorded',
  '- Protected authority PR/merge: Pending; not claimed by this record',
  '',
  'This record claims acceptance only; no issue, PR, checks, review, merge, implementation, Project, publication, or release outcome is claimed.',
  '',
].join('\n');
const recoveryOptions = Object.freeze({
  reviewAmendment04Source: fs.readFileSync(path.join(repositoryRoot, amendment04DecisionPath), 'utf8'),
  reviewAmendment04AcceptanceSource: recoveryAcceptance({
    acceptancePath: amendment04AcceptancePath,
    decisionId: 'core-ui:decision:0009:amendment:04',
    decisionPath: amendment04DecisionPath,
    parentId: 'core-ui:decision:0009',
    title: 'Decision 0009 amendment 04',
  }),
  r1ReadmeRecoverySource: fs.readFileSync(path.join(repositoryRoot, amendment08DecisionPath), 'utf8'),
  r1ReadmeRecoveryAcceptanceSource: recoveryAcceptance({
    acceptancePath: amendment08AcceptancePath,
    decisionId: 'core-ui:decision:0010:amendment:08',
    decisionPath: amendment08DecisionPath,
    parentId: 'core-ui:decision:0010',
    title: 'Decision 0010 amendment 08',
  }),
});

const writeR1Acceptance = (fixtureRoot) => {
  fs.writeFileSync(path.join(fixtureRoot, r1AcceptancePath), execFileSync(
    'git', ['show', `9a7cf99b0e74b2813998775138f0bc340e82c962:${r1AcceptancePath}`], {encoding: 'buffer'},
  ));
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
  if (stagedPaths.length > 0) {
    execFileSync('git', ['add', '--', ...stagedPaths], {cwd: fixtureRoot, stdio: 'ignore'});
  }
  execFileSync('git', ['rm', '--ignore-unmatch', '--', r1AcceptancePath], {
    cwd: fixtureRoot,
    stdio: 'ignore',
  });
  execFileSync('git', ['rm', '-f', '--ignore-unmatch', '--', amendment09AcceptancePath], {
    cwd: fixtureRoot,
    stdio: 'ignore',
  });
  if (receiptState !== 'absent') writeR1Acceptance(fixtureRoot);
  if (receiptState === 'staged') {
    execFileSync('git', ['add', '--', r1AcceptancePath], {cwd: fixtureRoot, stdio: 'ignore'});
  } else if (receiptState === 'intent-to-add') {
    execFileSync('git', ['add', '-N', '--', r1AcceptancePath], {cwd: fixtureRoot, stdio: 'ignore'});
  }
  return fixtureRoot;
};

const makeNonAncestorR1Fixture = () => {
  const fixtureRoot = makeR1Fixture();
  const tree = execFileSync('git', ['write-tree'], {cwd: fixtureRoot, encoding: 'utf8'}).trim();
  const commit = execFileSync('git', ['commit-tree', tree, '-m', 'non-ancestor authority fixture'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_AUTHOR_NAME: 'Core UI fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Core UI fixture',
    },
  }).trim();
  execFileSync('git', ['reset', '--hard', commit], {cwd: fixtureRoot, stdio: 'ignore'});
  return fixtureRoot;
};

const makeBaselineFixture = () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'core-ui-r1-baseline-fixture-'));
  execFileSync('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, fixtureRoot], {
    stdio: 'ignore',
  });
  execFileSync('git', [
    'checkout', '--quiet', '--detach', 'c0b7056b53d250251e703eabb0b37963cc99a013',
  ], {cwd: fixtureRoot, stdio: 'ignore'});
  return fixtureRoot;
};

const makeBaselineSuccessorFixture = (state) => {
  const fixtureRoot = makeBaselineFixture();
  const successorPaths = [
    'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
    'decisions/0010-amendment-06-r1-change-intent-owner.md',
  ];
  for (const relativePath of successorPaths) {
    const destination = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(repositoryRoot, relativePath), destination);
  }
  if (state === 'intent-to-add') {
    execFileSync('git', ['add', '-N', '--', ...successorPaths], {cwd: fixtureRoot, stdio: 'ignore'});
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

for (const receiptState of ['absent', 'worktree-only', 'intent-to-add']) {
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
    || currentResult.r1Entry?.accepted !== false
    || currentResult.r1Entry?.stage1?.accepted !== true
    || currentResult.r1Entry?.activation?.permitted !== false) {
  throw new Error('canonical current R1.0 entry mismatch');
}
if (canonicalJson(currentResult.r1Authority?.successor?.paths?.filter((relativePath) => (
  relativePath === amendment09DecisionPath
)).sort()) !== canonicalJson([amendment09DecisionPath])) {
  throw new Error('canonical amendment-09 successor path mismatch');
}
if (currentResult.r1Authority?.successor?.accepted !== false) {
  throw new Error('pre-acceptance amendment-09 authority must remain non-authorizing');
}
const result = verifyDeliveryWorkflowAuthority(repositoryRoot, { sourceMode: 'historical' });
if (result.activationEvidence !== 8
    || result.applicabilityTargets !== 28
    || result.productScope.version !== '4.0.2'
    || result.sourceMode !== 'historical'
    || result.r1Entry !== undefined) {
  throw new Error('positive result mismatch');
}
const historical = verifyHistoricalR1ContinuousAuthority(repositoryRoot);
if (historical.commit !== '9a7cf99b0e74b2813998775138f0bc340e82c962'
    || historical.tree !== '470d0f7bc6751b7f66d49fbf4fdc2d62f6cc89f0'
    || historical.parents.join(',') !== 'd4bba1a5f004d638936b79b673f0b1c4f9691426,374db5debff52c64929ad3255a6824ce42af756c') {
  throw new Error('historical R1 authority topology mismatch');
}

const cleanBaselineFixture = makeBaselineFixture();
try {
  const baselineResult = verifyCurrentR1ContinuousAuthority(cleanBaselineFixture);
  if (baselineResult.baseline !== true || baselineResult.successor !== null) {
    throw new Error('clean baseline compatibility result mismatch');
  }
  const baselineDeliveryResult = verifyDeliveryWorkflowAuthority(cleanBaselineFixture);
  if (baselineDeliveryResult.r1Entry?.accepted !== true
      || baselineDeliveryResult.sourceMode !== 'current') {
    throw new Error('clean baseline delivery result mismatch');
  }
} finally {
  fs.rmSync(cleanBaselineFixture, {recursive: true, force: true});
}

const nonAncestorFixture = makeNonAncestorR1Fixture();
try {
  assert.equal(execFileSync('git', [
    'cat-file', '-e', '9a7cf99b0e74b2813998775138f0bc340e82c962^{commit}',
  ], {cwd: nonAncestorFixture, encoding: 'utf8'}), '');
  assert.equal(
    (() => {
      try {
        execFileSync('git', [
          'merge-base', '--is-ancestor', '9a7cf99b0e74b2813998775138f0bc340e82c962', 'HEAD',
        ], {cwd: nonAncestorFixture, encoding: 'utf8'});
        return true;
      } catch {
        return false;
      }
    })(),
    false,
  );
  assert.throws(
    () => verifyCurrentR1ContinuousAuthority(nonAncestorFixture),
    (error) => error?.code === 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID'
      && /historical protected merge must be an ancestor/u.test(error.message),
  );
  rejectAt(nonAncestorFixture, {}, 'historical protected merge outside current ancestry');
} finally {
  fs.rmSync(nonAncestorFixture, {recursive: true, force: true});
}

for (const relativePath of ['strategy/monorepo-architecture.md', 'strategy/milestone-roadmap.md']) {
  const baselineFixture = makeBaselineFixture();
  try {
    const baselineBytes = execFileSync('git', ['show', `HEAD:${relativePath}`], {
      cwd: baselineFixture,
      encoding: 'buffer',
    });
    fs.writeFileSync(path.join(baselineFixture, relativePath), Buffer.concat([
      baselineBytes,
      Buffer.from('\nstaged baseline substitution\n'),
    ]));
    execFileSync('git', ['add', '--', relativePath], {cwd: baselineFixture, stdio: 'ignore'});
    fs.writeFileSync(path.join(baselineFixture, relativePath), baselineBytes);
    rejectAt(baselineFixture, {}, `baseline staged ${relativePath} masked by restored worktree`);
  } finally {
    fs.rmSync(baselineFixture, {recursive: true, force: true});
  }
}

for (const successorState of ['untracked', 'intent-to-add']) {
  const successorFixture = makeBaselineSuccessorFixture(successorState);
  try {
    assert.throws(
      () => verifyCurrentR1ContinuousAuthority(successorFixture),
      /R1_CONTINUOUS_AUTHORITY_INVALID: current successor paths must be absent for baseline/u,
    );
    rejectAt(successorFixture, {}, `baseline with amendment-06 paths ${successorState}`);
  } finally {
    fs.rmSync(successorFixture, {recursive: true, force: true});
  }
}

if (comprehensiveResult.productScope.version !== '6.0.1'
    || comprehensiveResult.productScope.bytes !== Buffer.byteLength(productScopeSource)
    || comprehensiveResult.r1Entry?.accepted !== false
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

const rejectCurrentWorkingTree = (mutate, label, options = {}) => {
  const temporaryRepository = makeR1Fixture();
  try {
    mutate(temporaryRepository);
    try {
      verifyDeliveryWorkflowAuthority(temporaryRepository, options);
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
}, 'replaced current Product Scope with valid pinned override', {
  productScopeSource: pinnedCurrentAuthority.productScopeSource,
});
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(
    temporaryRepository,
    'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  );
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace('issuecomment-5336305421', 'issuecomment-0'));
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
  const currentPath = path.join(
    temporaryRepository,
    'decisions/0010-amendment-06-r1-change-intent-owner.md',
  );
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace(
    'b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b',
    '0'.repeat(64),
  ));
  execFileSync('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner.md'], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'changed amendment-06 decision with valid pinned override', {
  authorityDecisionSource: pinnedCurrentAuthority.authorityDecisionSource,
});
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(
    temporaryRepository,
    'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
  );
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace(
    'b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b',
    '0'.repeat(64),
  ));
  execFileSync('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'changed amendment-06 acceptance with valid pinned override', {
  authorityAcceptanceSource: pinnedCurrentAuthority.authorityAcceptanceSource,
});
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, amendment07DecisionPath);
  fs.writeFileSync(currentPath, `${fs.readFileSync(currentPath, 'utf8')}\nmutated amendment-07 decision\n`);
  execFileSync('git', ['add', '--', amendment07DecisionPath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'changed amendment-07 decision successor binding');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, amendment07AcceptancePath);
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace(
    /^(- Candidate: [\d,]+ bytes, SHA-256 `)[0-9a-f]{64}`$/mu,
    `$1${'0'.repeat(64)}\``,
  ));
  execFileSync('git', ['add', '--', amendment07AcceptancePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'changed amendment-07 candidate digest successor binding');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, amendment07AcceptancePath);
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace(
    /^- Pre-acceptance materialization diff: .*$/mu,
    '- Pre-acceptance materialization diff: malformed bytes, SHA-256 `not-a-digest`',
  ));
  execFileSync('git', ['add', '--', amendment07AcceptancePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'malformed amendment-07 materialization diff identity');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, amendment07AcceptancePath);
  fs.writeFileSync(currentPath, fs.readFileSync(currentPath, 'utf8').replace(
    /^- Execution manifest: .*$/mu,
    '- Execution manifest: malformed bytes, SHA-256 `not-a-digest`',
  ));
  execFileSync('git', ['add', '--', amendment07AcceptancePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'malformed amendment-07 execution manifest identity');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, amendment09DecisionPath);
  fs.writeFileSync(currentPath, `${fs.readFileSync(currentPath, 'utf8')}\nmutated amendment-09 decision\n`);
  execFileSync('git', ['add', '--', amendment09DecisionPath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'changed amendment-09 decision successor binding');
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, 'strategy/monorepo-architecture.md');
  const historicalBytes = execFileSync(
    'git', ['show', '9a7cf99b0e74b2813998775138f0bc340e82c962:strategy/monorepo-architecture.md'],
    {cwd: temporaryRepository, encoding: 'buffer'},
  );
  fs.writeFileSync(currentPath, historicalBytes);
  execFileSync('git', ['add', '--', 'strategy/monorepo-architecture.md'], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'historical Architecture bytes on current ancestry with valid pinned override', {
  architectureSource: pinnedCurrentAuthority.architectureSource,
});
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, 'strategy/milestone-roadmap.md');
  fs.writeFileSync(currentPath, `${fs.readFileSync(currentPath, 'utf8')}\nwrong successor`);
  execFileSync('git', ['add', '--', 'strategy/milestone-roadmap.md'], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'substituted Roadmap with valid pinned override', {
  roadmapSource: pinnedCurrentAuthority.roadmapSource,
});
rejectCurrentWorkingTree((temporaryRepository) => {
  const currentPath = path.join(temporaryRepository, 'strategy/monorepo-architecture.md');
  fs.writeFileSync(currentPath, `${fs.readFileSync(currentPath, 'utf8')}\nworktree drift`);
}, 'current source/index/worktree mismatch with valid pinned override', {
  architectureSource: pinnedCurrentAuthority.architectureSource,
});
rejectCurrentWorkingTree((temporaryRepository) => {
  const extraPath = path.join(temporaryRepository, 'decisions/0010-amendment-06-extra.md');
  fs.writeFileSync(extraPath, 'unexpected successor');
  execFileSync('git', ['add', '--', 'decisions/0010-amendment-06-extra.md'], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'extra amendment-06 successor path');
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
    verifyDeliveryReviewReadinessAuthority(repositoryRoot, { ...recoveryOptions, ...options });
  } catch (error) {
    if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
    throw error;
  }
  throw new Error(`Decision 0009 negative accepted: ${label}`);
};
const rejectReadmeCompatibility = (options, label) => {
  try {
    verifyDecision0009ReadmeHistoricalCompatibility(repositoryRoot, { ...recoveryOptions, ...options });
  } catch (error) {
    if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
    throw error;
  }
  throw new Error(`Decision 0009 amendment 04 negative accepted: ${label}`);
};
const rejectReadinessWorkingTree = (mutate, label) => {
  const temporaryRepository = makeR1Fixture();
  try {
    mutate(temporaryRepository);
    try {
      verifyDeliveryReviewReadinessAuthority(temporaryRepository, recoveryOptions);
    } catch (error) {
      if (String(error.message).startsWith('DELIVERY_WORKFLOW_AUTHORITY_INVALID:')) return;
      throw error;
    }
    throw new Error(`README compatibility accepted: ${label}`);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
};
const recoveryResult = verifyDecision0009ReadmeHistoricalCompatibility(repositoryRoot, recoveryOptions);
if (!recoveryResult.accepted
    || recoveryResult.amendment0009.bytes !== 2948
    || recoveryResult.amendment0010.bytes !== 3050
    || recoveryResult.acceptance.statement !== recoveryStatement) {
  throw new Error('Decision 0009 amendment 04 positive result mismatch');
}
const mutableReadmeFixture = makeR1Fixture();
try {
  const currentReadmePath = path.join(mutableReadmeFixture, readmePath);
  fs.appendFileSync(currentReadmePath, '\nmutable current README bytes\n');
  const mutableReadmeResult = verifyDeliveryReviewReadinessAuthority(mutableReadmeFixture, recoveryOptions);
  if (mutableReadmeResult.readmeCompatibility?.accepted !== true) {
    throw new Error('mutable current README worktree bytes were rejected');
  }
} finally {
  fs.rmSync(mutableReadmeFixture, { recursive: true, force: true });
}
const emptyReadmeFixture = makeR1Fixture();
try {
  const currentReadmePath = path.join(emptyReadmeFixture, readmePath);
  fs.writeFileSync(currentReadmePath, '');
  execFileSync('git', ['add', '--', readmePath], {
    cwd: emptyReadmeFixture,
    stdio: 'ignore',
  });
  const emptyReadmeResult = verifyDeliveryReviewReadinessAuthority(emptyReadmeFixture, recoveryOptions);
  if (emptyReadmeResult.readmeCompatibility?.accepted !== true) {
    throw new Error('tracked empty current README was rejected');
  }
} finally {
  fs.rmSync(emptyReadmeFixture, { recursive: true, force: true });
}
rejectReadinessWorkingTree((temporaryRepository) => {
  execFileSync('git', ['rm', '--cached', '--', readmePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'staged README index deletion');
rejectReadinessWorkingTree((temporaryRepository) => {
  const currentReadmePath = path.join(temporaryRepository, readmePath);
  execFileSync('git', ['rm', '--cached', '--', readmePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
  fs.writeFileSync(currentReadmePath, 'untracked regular-file replacement\n');
}, 'untracked regular-file README replacement');
rejectReadinessWorkingTree((temporaryRepository) => {
  const currentReadmePath = path.join(temporaryRepository, readmePath);
  execFileSync('git', ['rm', '--cached', '--', readmePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
  fs.writeFileSync(currentReadmePath, 'intent-to-add regular-file replacement\n');
  execFileSync('git', ['add', '-N', '--', readmePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'README intent-to-add regular-file replacement');
rejectReadinessWorkingTree((temporaryRepository) => {
  execFileSync('git', ['update-index', '--chmod=+x', '--', readmePath], {
    cwd: temporaryRepository,
    stdio: 'ignore',
  });
}, 'README stage-0 mode 100755');
rejectReadmeCompatibility({
  reviewAmendment04Source: `${recoveryOptions.reviewAmendment04Source}\ndrift`,
}, 'Decision 0009 amendment 04 identity');
rejectReadmeCompatibility({
  r1ReadmeRecoverySource: `${recoveryOptions.r1ReadmeRecoverySource}\ndrift`,
}, 'Decision 0010 amendment 08 identity');
rejectReadmeCompatibility({
  reviewAmendment04AcceptanceSource: recoveryOptions.reviewAmendment04AcceptanceSource.replace(
    recoveryStatement,
    `${recoveryStatement} drift`,
  ),
}, 'acceptance statement mismatch');
rejectReadmeCompatibility({
  r1ReadmeRecoveryAcceptanceSource: recoveryOptions.r1ReadmeRecoveryAcceptanceSource.replace(
    `SHA-256 \`${'2'.repeat(64)}\``,
    `SHA-256 \`${'3'.repeat(64)}\``,
  ),
}, 'acceptance manifest mismatch');
rejectReadmeCompatibility({
  reviewAmendment04AcceptanceSource: recoveryOptions.reviewAmendment04AcceptanceSource.replaceAll(
    recoveryStatement,
    'I accept an unrelated recovery without artifact identities.',
  ),
  r1ReadmeRecoveryAcceptanceSource: recoveryOptions.r1ReadmeRecoveryAcceptanceSource.replaceAll(
    recoveryStatement,
    'I accept an unrelated recovery without artifact identities.',
  ),
}, 'acceptance statement without artifact identities');
rejectReadmeCompatibility({
  reviewAmendment04AcceptanceSource: recoveryOptions.reviewAmendment04AcceptanceSource.replace(
    `SHA-256 \`${recoveryCandidateSha256}\``,
    `SHA-256 \`${recoveryCandidateSha256}\` with suffix`,
  ),
}, 'acceptance identity suffix');
rejectReadmeCompatibility({
  reviewAmendment04AcceptanceSource: `${recoveryOptions.reviewAmendment04AcceptanceSource}Publication completed.\n`,
}, 'acceptance appended outcome claim');
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
const reviewResult = verifyDeliveryReviewReadinessAuthority(repositoryRoot, recoveryOptions);
if (!reviewResult.accepted || reviewResult.targets !== 29 || reviewResult.manifest.entries < 20) {
  throw new Error('Decision 0009 positive result mismatch');
}

for (const currentReadmeState of ['changed', 'missing', 'symlink']) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'core-ui-review-readme-fixture-'));
  execFileSync('git', ['clone', '--no-local', '--no-tags', repositoryRoot, fixtureRoot], { stdio: 'ignore' });
  const readmePath = path.join(fixtureRoot, 'tooling/audits/repository-policy/README.md');
  try {
    if (currentReadmeState === 'changed') {
      fs.writeFileSync(readmePath, `${fs.readFileSync(readmePath, 'utf8')}\naccepted successor runbook\n`);
      const changedResult = verifyDeliveryReviewReadinessAuthority(fixtureRoot, recoveryOptions);
      if (!changedResult.readmeCompatibility?.accepted) {
        throw new Error('changed current README did not preserve historical compatibility');
      }
    } else {
      fs.rmSync(readmePath);
      if (currentReadmeState === 'symlink') fs.symlinkSync('delivery-workflow-authority-verify.mjs', readmePath);
      assert.throws(
        () => verifyDeliveryReviewReadinessAuthority(fixtureRoot, recoveryOptions),
        /DELIVERY_WORKFLOW_AUTHORITY_INVALID: current artifact identity tooling\/audits\/repository-policy\/README\.md/u,
      );
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

process.stdout.write('[delivery-authority] Decision 0007 preserved; Decision 0009 amendments 02 and 04 successor negatives rejected; positive candidates accepted\n');
