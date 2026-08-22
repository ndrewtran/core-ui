import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { join } from 'node:path';
import {
  R1_ENTRY_BINDING,
  STAGE1_ARTIFACTS,
  STAGE1_SOURCE,
  verifyReactR1Entry,
  verifyReactAriaStage1Source,
} from '../src/react-aria-stage1-source-verify.mjs';

const repositoryRoot = join(import.meta.dirname, '../../../..');
const r1AcceptancePath = 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md';
const r1ManifestPath = 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json';
const amendment07DecisionPath = 'decisions/0010-amendment-07-r1-external-review-ci-recovery.md';
const amendment07AcceptancePath = 'decisions/0010-amendment-07-r1-external-review-ci-recovery-acceptance.md';
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const pinnedCurrentAuthority = Object.freeze({
  authorityDecisionSource: fs.readFileSync(join(repositoryRoot, 'decisions/0010-amendment-06-r1-change-intent-owner.md'), 'utf8'),
  authorityAcceptanceSource: fs.readFileSync(join(repositoryRoot, 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'), 'utf8'),
  architectureSource: fs.readFileSync(join(repositoryRoot, 'strategy/monorepo-architecture.md'), 'utf8'),
  roadmapSource: fs.readFileSync(join(repositoryRoot, 'strategy/milestone-roadmap.md'), 'utf8'),
  productScopeSource: fs.readFileSync(join(repositoryRoot, 'strategy/product-scope.md'), 'utf8'),
});
const renderTemplate = (template, substitutions) => Object.entries(substitutions).reduce(
  (output, [name, value]) => output.replaceAll(`{${name}}`, value),
  template,
);

const writeR1Acceptance = (fixtureRoot) => {
  fs.writeFileSync(join(fixtureRoot, r1AcceptancePath), execFileSync(
    'git', ['show', `9a7cf99b0e74b2813998775138f0bc340e82c962:${r1AcceptancePath}`], {encoding: 'buffer'},
  ));
};

const makeR1Fixture = (receiptState = 'staged') => {
  const fixtureRoot = fs.mkdtempSync(join(tmpdir(), 'core-ui-r1-entry-fixture-'));
  execFileSync('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, fixtureRoot], {
    stdio: 'ignore',
  });
  execFileSync('git', ['checkout', '--quiet', '--detach', 'HEAD'], {cwd: fixtureRoot, stdio: 'ignore'});
  const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  for (const relativePath of stagedPaths) {
    const destination = join(fixtureRoot, relativePath);
    fs.mkdirSync(join(destination, '..'), {recursive: true});
    fs.copyFileSync(join(repositoryRoot, relativePath), destination);
  }
  if (stagedPaths.length > 0) {
    execFileSync('git', ['add', '--', ...stagedPaths], {cwd: fixtureRoot, stdio: 'ignore'});
  }
  execFileSync('git', ['rm', '--ignore-unmatch', '--', r1AcceptancePath], {
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
  const fixtureRoot = fs.mkdtempSync(join(tmpdir(), 'core-ui-r1-baseline-fixture-'));
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
    const destination = join(fixtureRoot, relativePath);
    fs.mkdirSync(join(destination, '..'), {recursive: true});
    fs.copyFileSync(join(repositoryRoot, relativePath), destination);
  }
  if (state === 'intent-to-add') {
    execFileSync('git', ['add', '-N', '--', ...successorPaths], {cwd: fixtureRoot, stdio: 'ignore'});
  }
  return fixtureRoot;
};

test('Stage 1 verifier binds the committed source and accepted artifact identities', async () => {
  const result = verifyReactAriaStage1Source(repositoryRoot);
  assert.deepEqual(result.source, STAGE1_SOURCE);
  assert.deepEqual(result.counts, {families: 53, newImmutableIds: 45, reusedIds: 8, rawExports: 613});

  const decision = await readFile(join(repositoryRoot, 'decisions/0010-amendment-03-comprehensive-react-0-1.md'), 'utf8');
  assert.equal(decision.includes(
    'evaluation tool: '
      + `${STAGE1_ARTIFACTS.evaluator.bytes.toLocaleString('en-US')} bytes, SHA-256\n  \`${STAGE1_ARTIFACTS.evaluator.sha256}\``,
  ), true);
  assert.equal(decision.includes(
    'evaluation snapshot: '
      + `${STAGE1_ARTIFACTS.snapshot.bytes.toLocaleString('en-US')} bytes, SHA-256\n  \`${STAGE1_ARTIFACTS.snapshot.sha256}\``,
  ), true);
  assert.equal(decision.includes(
    'snapshot identity envelope: '
      + `${STAGE1_ARTIFACTS.envelope.bytes.toLocaleString('en-US')} bytes, SHA-256\n  \`${STAGE1_ARTIFACTS.envelope.sha256}\``,
  ), true);
});

test('Stage 1 verifier rejects moving and drifting source selectors', () => {
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, {sourceRef: 'origin/main'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
  assert.throws(
    () => verifyReactAriaStage1Source(repositoryRoot, {sourceRef: '0000000000000000000000000000000000000000'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: committed source/u,
  );
});

test('R1.0 entry gate accepts only current authority and remains closed pending current evidence', async () => {
  for (const receiptState of ['absent', 'worktree-only', 'intent-to-add']) {
    const fixtureRoot = makeR1Fixture(receiptState);
    try {
      assert.throws(
        () => verifyReactR1Entry(fixtureRoot),
        /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
      );
    } finally {
      fs.rmSync(fixtureRoot, {recursive: true, force: true});
    }
  }
  const fixtureRoot = makeR1Fixture();
  try {
  const result = verifyReactR1Entry(fixtureRoot);
  assert.equal(result.accepted, true);
  assert.equal(result.productScope.version, '6.0.1');
  assert.equal(result.decision.sha256, R1_ENTRY_BINDING.decision.sha256);
  assert.equal(result.stage1.accepted, true);
  assert.deepEqual(
    result.authority.successor?.paths.filter((path) => path.startsWith('decisions/0010-amendment-07-')).sort(),
    [amendment07AcceptancePath, amendment07DecisionPath].sort(),
  );
  assert.deepEqual(result.applicability, {
    currentEvidenceLocator: null,
    historicalEvidence: {sufficient: false, status: 'historical-only'},
    status: 'pending-current-evidence',
  });
  assert.equal(result.activation.permitted, false);

  const cleanBaselineFixture = makeBaselineFixture();
  try {
    const baselineResult = verifyReactR1Entry(cleanBaselineFixture);
    assert.equal(baselineResult.accepted, true);
    assert.equal(baselineResult.authority.baseline, true);
    assert.equal(baselineResult.authority.successor, null);
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
      () => verifyReactR1Entry(nonAncestorFixture),
      /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
    );
  } finally {
    fs.rmSync(nonAncestorFixture, {recursive: true, force: true});
  }

  for (const successorState of ['untracked', 'intent-to-add']) {
    const successorFixture = makeBaselineSuccessorFixture(successorState);
    try {
      assert.throws(
        () => verifyReactR1Entry(successorFixture),
        /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
      );
    } finally {
      fs.rmSync(successorFixture, {recursive: true, force: true});
    }
  }

  const rejectStagedSubstitution = (relativePath, mutate, optionName, label) => {
    const currentPath = join(fixtureRoot, relativePath);
    const original = fs.readFileSync(currentPath, 'utf8');
    fs.writeFileSync(currentPath, mutate(original));
    execFileSync('git', ['add', '--', relativePath], {cwd: fixtureRoot, stdio: 'ignore'});
    assert.throws(
      () => verifyReactR1Entry(fixtureRoot, {[optionName]: pinnedCurrentAuthority[optionName]}),
      /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
      label,
    );
    fs.writeFileSync(currentPath, original);
    execFileSync('git', ['add', '--', relativePath], {cwd: fixtureRoot, stdio: 'ignore'});
  };
  rejectStagedSubstitution(
    'decisions/0010-amendment-06-r1-change-intent-owner.md',
    (source) => source.replace('b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b', '0'.repeat(64)),
    'authorityDecisionSource',
    'changed staged amendment-06 decision must reject valid pinned override',
  );
  rejectStagedSubstitution(
    'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
    (source) => source.replace('b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b', '0'.repeat(64)),
    'authorityAcceptanceSource',
    'changed staged amendment-06 acceptance must reject valid pinned override',
  );
  rejectStagedSubstitution(
    'strategy/monorepo-architecture.md',
    (source) => `${source}\nsubstituted Architecture`,
    'architectureSource',
    'changed staged Architecture must reject valid pinned override',
  );
  rejectStagedSubstitution(
    'strategy/milestone-roadmap.md',
    (source) => `${source}\nsubstituted Roadmap`,
    'roadmapSource',
    'changed staged Roadmap must reject valid pinned override',
  );
  rejectStagedSubstitution(
    'strategy/product-scope.md',
    (source) => source.replace('scopeVersion: 6.0.1', 'scopeVersion: 6.0.2'),
    'productScopeSource',
    'changed staged Product Scope must reject valid pinned override',
  );

  const rejectAmendment07Mutation = (relativePath, mutate, label) => {
    const currentPath = join(fixtureRoot, relativePath);
    const original = fs.readFileSync(currentPath, 'utf8');
    fs.writeFileSync(currentPath, mutate(original));
    execFileSync('git', ['add', '--', relativePath], {cwd: fixtureRoot, stdio: 'ignore'});
    assert.throws(
      () => verifyReactR1Entry(fixtureRoot),
      /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
      label,
    );
    fs.writeFileSync(currentPath, original);
    execFileSync('git', ['add', '--', relativePath], {cwd: fixtureRoot, stdio: 'ignore'});
  };
  rejectAmendment07Mutation(
    amendment07DecisionPath,
    (source) => `${source}\nmutated amendment-07 decision\n`,
    'changed amendment-07 decision must reject the exact successor binding',
  );
  rejectAmendment07Mutation(
    amendment07AcceptancePath,
    (source) => source.replace(
      /^(- Candidate: [\d,]+ bytes, SHA-256 `)[0-9a-f]{64}`$/mu,
      `$1${'0'.repeat(64)}\``,
    ),
    'changed amendment-07 candidate digest must reject the successor binding',
  );
  rejectAmendment07Mutation(
    amendment07AcceptancePath,
    (source) => source.replace(
      /^- Pre-acceptance materialization diff: .*$/mu,
      '- Pre-acceptance materialization diff: malformed bytes, SHA-256 `not-a-digest`',
    ),
    'malformed amendment-07 materialization diff identity must reject',
  );
  rejectAmendment07Mutation(
    amendment07AcceptancePath,
    (source) => source.replace(
      /^- Execution manifest: .*$/mu,
      '- Execution manifest: malformed bytes, SHA-256 `not-a-digest`',
    ),
    'malformed amendment-07 execution manifest identity must reject',
  );

  const historicalProductScope = execFileSync(
    'git', ['show', `${STAGE1_SOURCE.commit}:strategy/product-scope.md`], {cwd: fixtureRoot, encoding: 'utf8'},
  );
  const acceptedRoadmap = execFileSync(
    'git', ['show', 'HEAD:strategy/milestone-roadmap.md'], {cwd: repositoryRoot, encoding: 'utf8'},
  );
  assert.throws(
    () => verifyReactR1Entry(fixtureRoot, {
      productScopeSource: historicalProductScope,
      roadmapSource: acceptedRoadmap,
    }),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Product Scope/u,
  );
  assert.throws(
    () => verifyReactR1Entry(fixtureRoot, {stage1SourceRef: 'origin/main'}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: source selector/u,
  );
  const replacedDecision = (await readFile(join(fixtureRoot, R1_ENTRY_BINDING.decision.path), 'utf8'))
    .replace(STAGE1_ARTIFACTS.snapshot.sha256, '0'.repeat(64));
  assert.throws(
    () => verifyReactR1Entry(fixtureRoot, {decisionSource: replacedDecision}),
    /REACT_ARIA_STAGE1_SOURCE_INVALID: R1\.0 Decision/u,
  );
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
});
