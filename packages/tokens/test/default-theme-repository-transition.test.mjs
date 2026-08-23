import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { canonicalJson } from '@core-ui/schema';
import { hasAcceptedReactPrimaryAuthority } from '../src/internal/default-theme-repository-transition.mjs';
import { renderAmendment09AcceptanceStatement } from '../../../tooling/audits/repository-policy/src/r1-continuous-authority-compatibility.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../../..');
const amendment07DecisionPath = 'decisions/0010-amendment-07-r1-external-review-ci-recovery.md';
const amendment07AcceptancePath = 'decisions/0010-amendment-07-r1-external-review-ci-recovery-acceptance.md';
const amendment09DecisionPath = 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md';
const amendment09AcceptancePath = 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md';
const amendment09FixtureIdentity = Object.freeze({
  candidateBytes: '16,596',
  candidateSha256: '30189a4aabc58e2628856eb1a7f75e34f8549e08291ea71e89ae672ccc46472d',
  diffBytes: '70,841',
  diffSha256: '5920807d882e2d8d637cc03d25030df2bf79e7089a9d7f246d6ac8035b8172f6',
  manifestBytes: '12,040',
  manifestSha256: '161042eb0b707b6e9102becf2750545bebc92823a1b4f98bd125f0d2bdd07c62',
});
const renderAmendment09Acceptance = (identity = amendment09FixtureIdentity) => {
  const statement = renderAmendment09AcceptanceStatement({
    candidateSha256: identity.candidateSha256,
    diffSha256: identity.diffSha256,
    manifestSha256: identity.manifestSha256,
  });
  return [
    '# Acceptance: Decision 0010 amendment 09', '',
    '- Decision: `core-ui:decision:0010:amendment:09`',
    '- Parent decision: `core-ui:decision:0010`',
    '- Repository: `ndrewtran/core-ui`',
    '- Owner: Andrew / `ndrewtran`', '- Outcome: Accepted',
    `- Candidate: ${identity.candidateBytes} bytes, SHA-256 \`${identity.candidateSha256}\``,
    `- Pre-acceptance materialization diff: ${identity.diffBytes} bytes, SHA-256 \`${identity.diffSha256}\``,
    `- Execution manifest: ${identity.manifestBytes} bytes, SHA-256 \`${identity.manifestSha256}\``,
    `- Decision path: \`${amendment09DecisionPath}\``,
    `- Acceptance path: \`${amendment09AcceptancePath}\``,
    `- Approval instruction: “${statement}”`,
    `- Human acceptance: Andrew / \`ndrewtran\`: “${statement}”`,
    '- Approval timestamp: Not recorded',
    '- Protected authority PR/merge: Pending; not claimed by this record', '',
    'This record claims acceptance only; it records no PR, checks, review, merge, implementation, Project, publication, or release outcome.', '',
  ].join('\n');
};
const transitionPaths = [
  'catalog/components/button/artifact.json',
  'catalog/tokens',
  'packages/catalog/catalog-sources.json',
  'packages/catalog/generated',
  'packages/catalog/package.json',
  'packages/react/generated',
  'packages/react/package.json',
  'packages/tokens/package.json',
  'packages/tooling/command-registry.json',
  'packages/tooling/generated',
  'packages/tooling/package.json',
  'packages/tooling/src/local-resolver.mjs',
  'packages/tooling/src/pnpm-adapter.mjs',
  'packages/web/generated',
  'packages/web/package.json',
  'packages/web/src/generate.mjs',
];

async function pathsUnder(root, relativePath) {
  const path = join(root, relativePath);
  const metadata = await lstat(path).catch((error) => (error?.code === 'ENOENT' ? null : Promise.reject(error)));
  if (metadata === null) return [];
  if (!metadata.isDirectory()) return [relativePath];
  const output = [];
  for (const entry of (await readdir(path)).sort()) output.push(...await pathsUnder(root, join(relativePath, entry)));
  return output;
}

async function digestPaths(root) {
  const paths = [];
  for (const path of transitionPaths) paths.push(...await pathsUnder(root, path));
  const hash = createHash('sha256');
  for (const path of [...new Set(paths)].sort()) {
    hash.update(path);
    hash.update('\0');
    hash.update(await readFile(join(root, path)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function pathDigests(root) {
  const paths = [];
  for (const path of transitionPaths) paths.push(...await pathsUnder(root, path));
  return Object.fromEntries(await Promise.all([...new Set(paths)].sort().map(async (path) => [
    path,
    createHash('sha256').update(await readFile(join(root, path))).digest('hex'),
  ])));
}

async function committedManifest(root, revision, declaredPaths) {
  const names = await execFile(
    'git',
    ['ls-tree', '-r', '-z', '--name-only', revision, '--', ...declaredPaths],
    { cwd: root, encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 },
  );
  const paths = names.stdout.toString('utf8').split('\0').filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(paths.map(async (path) => {
    const bytes = await execFile('git', ['show', `${revision}:${path}`], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
    });
    return {
      path,
      sha256: `sha256:${createHash('sha256').update(bytes.stdout).digest('hex')}`,
    };
  }));
}

async function candidatePaths() {
  const [changed, untracked] = await Promise.all([
    execFile('git', ['diff', '--name-only', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }),
    execFile('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repositoryRoot, encoding: 'utf8' }),
  ]);
  return [...new Set([
    ...`${changed.stdout}\n${untracked.stdout}`.trim().split('\n').filter(Boolean),
    'catalog/tokens/button-minimum.json',
    'catalog/tokens/default-theme.json',
  ])].sort();
}

async function overlayCandidate(target) {
  const paths = await candidatePaths();
  for (const relativePath of paths) {
    const source = join(repositoryRoot, relativePath);
    const destination = join(target, relativePath);
    const metadata = await lstat(source).catch((error) => (error?.code === 'ENOENT' ? null : Promise.reject(error)));
    if (metadata === null) {
      await rm(destination, { recursive: true, force: true });
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
  }
  const present = [];
  for (const relativePath of paths) {
    if (await lstat(join(target, relativePath)).then(() => true).catch((error) => error?.code === 'ENOENT' ? false : Promise.reject(error))) {
      present.push(relativePath);
    }
  }
  if (present.length > 0) await execFile('git', ['add', '--', ...present], {cwd: target, encoding: 'utf8'});
  await writeFile(join(target, amendment09AcceptancePath), renderAmendment09Acceptance());
  await execFile('git', ['add', '--', amendment09AcceptancePath], {cwd: target, encoding: 'utf8'});
}

async function makeNonAncestorAuthorityFixture() {
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-r1-lineage-fixture-'));
  const worktree = join(parent, 'repository');
  try {
    await execFile('git', ['clone', '--no-local', '--no-tags', repositoryRoot, worktree], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    const stagedPaths = (await execFile('git', ['diff', '--cached', '--name-only'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })).stdout.trim().split('\n').filter(Boolean);
    for (const relativePath of stagedPaths) {
      await mkdir(dirname(join(worktree, relativePath)), {recursive: true});
      await cp(join(repositoryRoot, relativePath), join(worktree, relativePath), {force: true});
    }
    await execFile('git', ['add', '--', ...stagedPaths], {cwd: worktree, encoding: 'utf8'});
    const tree = (await execFile('git', ['write-tree'], {cwd: worktree, encoding: 'utf8'})).stdout.trim();
    const commit = (await execFile('git', ['commit-tree', tree, '-m', 'non-ancestor authority fixture'], {
      cwd: worktree,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_AUTHOR_NAME: 'Core UI fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Core UI fixture',
      },
    })).stdout.trim();
    await execFile('git', ['reset', '--hard', commit], {cwd: worktree, encoding: 'utf8'});
    return {parent, worktree};
  } catch (error) {
    await rm(parent, {recursive: true, force: true});
    throw error;
  }
}

async function makeBaselineSuccessorFixture(state) {
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-r1-baseline-successor-fixture-'));
  const worktree = join(parent, 'repository');
  try {
    await execFile('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, worktree], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    await execFile('git', [
      'checkout', '--quiet', '--detach', 'c0b7056b53d250251e703eabb0b37963cc99a013',
    ], {cwd: worktree, encoding: 'utf8'});
    const successorPaths = [
      'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
      'decisions/0010-amendment-06-r1-change-intent-owner.md',
    ];
    for (const relativePath of successorPaths) {
      await mkdir(dirname(join(worktree, relativePath)), {recursive: true});
      await cp(join(repositoryRoot, relativePath), join(worktree, relativePath), {force: true});
    }
    if (state === 'intent-to-add') {
      await execFile('git', ['add', '-N', '--', ...successorPaths], {cwd: worktree, encoding: 'utf8'});
    }
    return {parent, worktree};
  } catch (error) {
    await rm(parent, {recursive: true, force: true});
    throw error;
  }
}

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

function renderTemplate(template, substitutions) {
  return Object.entries(substitutions).reduce(
    (output, [name, value]) => output.replaceAll(`{${name}}`, value),
    template,
  );
}

async function writeContinuousAcceptance(root, ownerCommentUrl = 'https://github.com/ndrewtran/core-ui/pull/87#issuecomment-1') {
  const acceptancePath = 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md';
  const acceptance = await new Promise((resolve, reject) => execFile(
    'git', ['show', `9a7cf99b0e74b2813998775138f0bc340e82c962:${acceptancePath}`],
    {cwd: root, encoding: 'utf8'},
    (error, stdout) => (error ? reject(error) : resolve(stdout)),
  ));
  await writeFile(join(root, acceptancePath), acceptance);
  return acceptance;
}

test('R1 authority accepts the fixed current baseline and exact amendment-06 through amendment-09 successors', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-react-authority-proof-'));
  const baseline = join(parent, 'baseline');
  const worktree = join(parent, 'authority');
  try {
    for (const root of [baseline, worktree]) {
      await execFile('git', ['clone', '--no-local', '--no-tags', repositoryRoot, root], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      });
    }
    assert.equal(await hasAcceptedReactPrimaryAuthority(baseline), true);
    const stagedPaths = (await execFile('git', ['diff', '--cached', '--name-only'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })).stdout.trim().split('\n').filter(Boolean);
    for (const relativePath of stagedPaths) {
      await mkdir(dirname(join(worktree, relativePath)), {recursive: true});
      await cp(join(repositoryRoot, relativePath), join(worktree, relativePath), {force: true});
    }
    await execFile('git', ['add', '--', ...stagedPaths], {cwd: worktree, encoding: 'utf8'});
    await execFile('git', ['rm', '-f', '--ignore-unmatch', '--', amendment09AcceptancePath], {
      cwd: worktree,
      encoding: 'utf8',
    });
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false, 'A09 pre-acceptance must remain non-authorizing');
    await writeFile(join(worktree, amendment09AcceptancePath), renderAmendment09Acceptance());
    await execFile('git', ['add', '--', amendment09AcceptancePath], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), true, 'A09 exact acceptance enables authority');

    const rejectAmendment09AcceptanceMutation = async (mutate, label) => {
      const acceptancePath = join(worktree, amendment09AcceptancePath);
      const original = await readFile(acceptancePath, 'utf8');
      await writeFile(acceptancePath, mutate(original));
      await execFile('git', ['add', '--', amendment09AcceptancePath], {cwd: worktree, encoding: 'utf8'});
      assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false, label);
      await writeFile(acceptancePath, original);
      await execFile('git', ['add', '--', amendment09AcceptancePath], {cwd: worktree, encoding: 'utf8'});
    };
    const changedDiffSha256 = '0'.repeat(64);
    await rejectAmendment09AcceptanceMutation(
      (source) => source
        .replace(
          `- Pre-acceptance materialization diff: ${amendment09FixtureIdentity.diffBytes} bytes, SHA-256 \`${amendment09FixtureIdentity.diffSha256}\``,
          `- Pre-acceptance materialization diff: 70,842 bytes, SHA-256 \`${changedDiffSha256}\``,
        )
        .replaceAll(
          `pre-acceptance materialization diff, SHA-256 ${amendment09FixtureIdentity.diffSha256}`,
          `pre-acceptance materialization diff, SHA-256 ${changedDiffSha256}`,
        ),
      'coherently changed materialization diff identity must reject',
    );
    const changedManifestSha256 = 'f'.repeat(64);
    await rejectAmendment09AcceptanceMutation(
      (source) => source
        .replace(
          `- Execution manifest: ${amendment09FixtureIdentity.manifestBytes} bytes, SHA-256 \`${amendment09FixtureIdentity.manifestSha256}\``,
          `- Execution manifest: 12,041 bytes, SHA-256 \`${changedManifestSha256}\``,
        )
        .replaceAll(
          `execution manifest v1, SHA-256 ${amendment09FixtureIdentity.manifestSha256}`,
          `execution manifest v1, SHA-256 ${changedManifestSha256}`,
        ),
      'coherently changed execution manifest identity must reject',
    );

    const nonAncestorFixture = await makeNonAncestorAuthorityFixture();
    try {
      assert.equal(await execFile('git', [
        'cat-file', '-e', '9a7cf99b0e74b2813998775138f0bc340e82c962^{commit}',
      ], {cwd: nonAncestorFixture.worktree, encoding: 'utf8'}).then(() => true), true);
      assert.equal(
        await execFile('git', [
          'merge-base', '--is-ancestor', '9a7cf99b0e74b2813998775138f0bc340e82c962', 'HEAD',
        ], {cwd: nonAncestorFixture.worktree, encoding: 'utf8'}).then(() => true).catch(() => false),
        false,
      );
      await assert.rejects(
        hasAcceptedReactPrimaryAuthority(nonAncestorFixture.worktree),
        (error) => error?.code === 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID'
          && /historical protected merge must be an ancestor/u.test(error.message),
      );
    } finally {
      await rm(nonAncestorFixture.parent, {recursive: true, force: true});
    }

    for (const successorState of ['untracked', 'intent-to-add']) {
      const successorFixture = await makeBaselineSuccessorFixture(successorState);
      try {
        assert.equal(await hasAcceptedReactPrimaryAuthority(successorFixture.worktree), false);
      } finally {
        await rm(successorFixture.parent, {recursive: true, force: true});
      }
    }

    await execFile('git', ['rm', '--cached', '--', 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await execFile('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });
    await writeFile(join(worktree, 'strategy/product-scope.md'), `${await readFile(join(worktree, 'strategy/product-scope.md'), 'utf8')}\ndrift`);
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await execFile('git', ['checkout', '--', 'strategy/product-scope.md'], {cwd: worktree, encoding: 'utf8'});
    const historicalArchitecture = (await execFile(
      'git', ['show', '9a7cf99b0e74b2813998775138f0bc340e82c962:strategy/monorepo-architecture.md'],
      {cwd: worktree, encoding: 'utf8'},
    )).stdout;
    await writeFile(join(worktree, 'strategy/monorepo-architecture.md'), historicalArchitecture);
    await execFile('git', ['add', '--', 'strategy/monorepo-architecture.md'], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);

    await execFile('git', ['checkout', '--', 'strategy/monorepo-architecture.md'], {cwd: worktree, encoding: 'utf8'});
    const currentDecisionPath = join(
      worktree,
      'decisions/0010-amendment-06-r1-change-intent-owner.md',
    );
    const currentDecision = await readFile(currentDecisionPath, 'utf8');
    await writeFile(currentDecisionPath, currentDecision.replace(
      'b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b',
      '0'.repeat(64),
    ));
    await execFile('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await writeFile(currentDecisionPath, currentDecision);
    await execFile('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });

    const currentAcceptancePath = join(
      worktree,
      'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
    );
    const currentAcceptance = await readFile(currentAcceptancePath, 'utf8');
    await writeFile(currentAcceptancePath, currentAcceptance.replace(
      'b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b',
      '0'.repeat(64),
    ));
    await execFile('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await writeFile(currentAcceptancePath, currentAcceptance);
    await execFile('git', ['add', '--', 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });

    const currentAmendment07DecisionPath = join(worktree, amendment07DecisionPath);
    const currentAmendment07Decision = await readFile(currentAmendment07DecisionPath, 'utf8');
    await writeFile(currentAmendment07DecisionPath, `${currentAmendment07Decision}\nmutated amendment-07 decision\n`);
    await execFile('git', ['add', '--', amendment07DecisionPath], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await writeFile(currentAmendment07DecisionPath, currentAmendment07Decision);
    await execFile('git', ['add', '--', amendment07DecisionPath], {cwd: worktree, encoding: 'utf8'});

    const currentAmendment07AcceptancePath = join(worktree, amendment07AcceptancePath);
    const currentAmendment07Acceptance = await readFile(currentAmendment07AcceptancePath, 'utf8');
    await writeFile(currentAmendment07AcceptancePath, currentAmendment07Acceptance.replace(
      /^(- Candidate: [\d,]+ bytes, SHA-256 `)[0-9a-f]{64}`$/mu,
      `$1${'0'.repeat(64)}\``,
    ));
    await execFile('git', ['add', '--', amendment07AcceptancePath], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await writeFile(currentAmendment07AcceptancePath, currentAmendment07Acceptance);
    await execFile('git', ['add', '--', amendment07AcceptancePath], {cwd: worktree, encoding: 'utf8'});

    const currentAmendment09DecisionPath = join(worktree, amendment09DecisionPath);
    const currentAmendment09Decision = await readFile(currentAmendment09DecisionPath, 'utf8');
    await writeFile(currentAmendment09DecisionPath, `${currentAmendment09Decision}\nmutated amendment-09 decision\n`);
    await execFile('git', ['add', '--', amendment09DecisionPath], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await writeFile(currentAmendment09DecisionPath, currentAmendment09Decision);
    await execFile('git', ['add', '--', amendment09DecisionPath], {cwd: worktree, encoding: 'utf8'});

    for (const [label, field, value] of [
      ['materialization diff', 'Pre-acceptance materialization diff', 'malformed bytes, SHA-256 `not-a-digest`'],
      ['execution manifest', 'Execution manifest', 'malformed bytes, SHA-256 `not-a-digest`'],
    ]) {
      await writeFile(currentAmendment07AcceptancePath, currentAmendment07Acceptance.replace(
        new RegExp(`^- ${field}: .*$`, 'mu'),
        `- ${field}: ${value}`,
      ));
      await execFile('git', ['add', '--', amendment07AcceptancePath], {cwd: worktree, encoding: 'utf8'});
      assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false, `malformed ${label} identity`);
      await writeFile(currentAmendment07AcceptancePath, currentAmendment07Acceptance);
      await execFile('git', ['add', '--', amendment07AcceptancePath], {cwd: worktree, encoding: 'utf8'});
    }

    const currentRoadmapPath = join(worktree, 'strategy/milestone-roadmap.md');
    const currentRoadmap = await readFile(currentRoadmapPath, 'utf8');
    await writeFile(currentRoadmapPath, `${currentRoadmap}\nstrategy drift`);
    await execFile('git', ['add', '--', 'strategy/milestone-roadmap.md'], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await writeFile(currentRoadmapPath, currentRoadmap);
    await execFile('git', ['add', '--', 'strategy/milestone-roadmap.md'], {cwd: worktree, encoding: 'utf8'});

    const extraSuccessorPath = join(worktree, 'decisions/0010-amendment-06-extra.md');
    await writeFile(extraSuccessorPath, 'unexpected successor');
    await execFile('git', ['add', '--', 'decisions/0010-amendment-06-extra.md'], {cwd: worktree, encoding: 'utf8'});
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
    await execFile('git', ['rm', '--cached', '--', 'decisions/0010-amendment-06-extra.md'], {
      cwd: worktree,
      encoding: 'utf8',
    });
    await unlink(extraSuccessorPath);

    await writeFile(join(worktree, 'strategy/milestone-roadmap.md'), `${currentRoadmap}\nworktree drift`);
    assert.equal(await hasAcceptedReactPrimaryAuthority(worktree), false);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('TALE-TOKEN-C repository transition is reversible and idempotent across generated consumers', { timeout: 240_000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-transition-proof-'));
  const worktree = join(parent, 'repository');
  try {
    await execFile('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, worktree], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    const sourceRevision = (await execFile('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })).stdout.trim();
    await execFile('git', ['checkout', '--detach', sourceRevision], {
      cwd: worktree,
      encoding: 'utf8',
    });
    const acceptedManifestRevision = JSON.parse(await readFile(
      join(repositoryRoot, 'decisions/0005-default-theme-token-source-identity.json'),
      'utf8',
    )).implementation.pathClassification.immutableHistory
      .prePhaseCEvidenceImmutableManifest.repositoryRevision;
    assert.equal(
      await execFile('git', ['cat-file', '-e', `${acceptedManifestRevision}^{commit}`], {
        cwd: worktree,
        encoding: 'utf8',
      }).then(() => true).catch(() => false),
      false,
      'the transition validates from a fresh object store without the unreachable manifest commit',
    );
    await overlayCandidate(worktree);
    await execFile('pnpm', ['install', '--offline', '--frozen-lockfile'], {
      cwd: worktree,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const module = await import(pathToFileURL(join(worktree, 'packages/tokens/src/tale-token-materialization.mjs')).href);
    const identity = await import(pathToFileURL(join(
      worktree,
      'packages/tokens/src/default-theme-identity-migration.mjs',
    )).href);
    const transition = await import(pathToFileURL(join(
      worktree,
      'packages/tokens/src/internal/default-theme-repository-transition.mjs',
    )).href);
    const originalDigest = await digestPaths(worktree);
    const originalPaths = await pathDigests(worktree);

    const postSourcePath = join(worktree, 'catalog/tokens/default-theme.json');
    const preSourcePath = join(worktree, 'catalog/tokens/button-minimum.json');
    const postSource = await readFile(postSourcePath, 'utf8');
    const preSource = postSource.replace(
      '"id": "core:token:default-theme"',
      '"id": "core:token:button-minimum"',
    );
    await assert.rejects(
      transition.transitionDefaultThemeRepository(worktree, {
        fromState: 'post-migration',
        toState: 'decision-0004',
        writeSource: async () => {
          await writeFile(preSourcePath, preSource);
          await unlink(postSourcePath);
        },
        validate: async () => {
          throw new Error('INJECTED_TRANSITION_VALIDATION_FAILURE');
        },
      }),
      /INJECTED_TRANSITION_VALIDATION_FAILURE/u,
    );
    assert.equal(await digestPaths(worktree), originalDigest, 'a failed transition restores every path');

    const tokenPackagePath = join(worktree, 'packages/tokens/package.json');
    const tokenPackage = await readFile(tokenPackagePath, 'utf8');
    const mixedPackage = tokenPackage.replace('"version": "2.0.0"', '"version": "9.0.0"');
    await writeFile(tokenPackagePath, mixedPackage);
    await assert.rejects(
      module.runTaleTokenMaterialization(worktree, { mode: 'dry-run' }),
      /CORE_TOKEN_IDENTITY_REFERENCE_STALE/u,
    );
    assert.equal(await readFile(tokenPackagePath, 'utf8'), mixedPackage, 'mixed state is rejected, not healed');
    await writeFile(tokenPackagePath, tokenPackage);

    for (const [relativePath, mutate] of [
      ['packages/catalog/generated/catalog.json.provenance', (source) => source.replace(
        /([0-9a-f])(?="\}\n?$)/u,
        (value) => (value === '0' ? '1' : '0'),
      )],
      ['packages/tooling/generated/command-surface.mjs', (source) => `${source}\n// drift`],
    ]) {
      const path = join(worktree, relativePath);
      const original = await readFile(path, 'utf8');
      const drifted = mutate(original);
      await writeFile(path, drifted);
      await assert.rejects(
        module.runTaleTokenMaterialization(worktree, { mode: 'dry-run' }),
        /CORE_TOKEN_IDENTITY_REFERENCE_STALE/u,
      );
      assert.equal(await readFile(path, 'utf8'), drifted, `${relativePath} is rejected, not healed`);
      await writeFile(path, original);
    }

    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree, { mode: 'rollback' })).changed, true);
    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree, { mode: 'rollback' })).changed, false);
    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree)).changed, true);
    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree)).changed, false);
    assert.equal(await digestPaths(worktree), originalDigest, 'identity-only rollback and replay are exact');

    assert.deepEqual(await module.runTaleTokenMaterialization(worktree, { mode: 'rollback' }), {
      changed: true, mode: 'rollback', state: 'phase-b',
    });
    assert.deepEqual(await module.runTaleTokenMaterialization(worktree, { mode: 'rollback' }), {
      changed: false, mode: 'rollback', state: 'phase-b',
    });
    const phaseBCatalog = JSON.parse(await readFile(join(worktree, 'packages/catalog/generated/catalog.json'), 'utf8'));
    assert.equal(phaseBCatalog.catalogVersion, '0.2.0');
    assert.deepEqual(phaseBCatalog.artifacts.filter(({ kind }) => kind === 'token').map(({ id }) => id), [
      'core:token:button-minimum',
    ]);

    assert.deepEqual(await module.runTaleTokenMaterialization(worktree), {
      changed: true, mode: 'write', state: 'materialized',
    });
    assert.deepEqual(await module.runTaleTokenMaterialization(worktree), {
      changed: false, mode: 'write', state: 'materialized',
    });
    assert.deepEqual(await pathDigests(worktree), originalPaths);
    assert.equal(await digestPaths(worktree), originalDigest);

    const stageIndexPath = join(
      worktree,
      'tests/evidence/authority-39-phase-c-applicability-topology/index.json',
    );
    const stageIndexBytes = await readFile(stageIndexPath, 'utf8');
    const firstSuccessorPath = JSON.parse(stageIndexBytes).supersessions[0].path;
    const firstSuccessorAbsolute = join(worktree, firstSuccessorPath);
    const firstSuccessorBytes = await readFile(firstSuccessorAbsolute, 'utf8');
    async function rejectsAuthorityMutation(path, mutate) {
      const original = await readFile(path, 'utf8');
      const value = JSON.parse(original);
      mutate(value);
      await writeFile(path, canonicalJson(value));
      await assert.rejects(
        module.runTaleTokenMaterialization(worktree, { mode: 'check' }),
        /CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH/u,
      );
      await writeFile(path, original);
    }
    await rejectsAuthorityMutation(stageIndexPath, (index) => {
      index.sourceTree = '0'.repeat(40);
    });
    await rejectsAuthorityMutation(stageIndexPath, (index) => {
      index.supersessions.reverse();
    });
    const additionCommit = (await execFile('git', [
      'log', '--format=%H', '--diff-filter=A', '--',
      'tests/evidence/authority-39-phase-c-applicability-topology/index.json',
    ], { cwd: worktree, encoding: 'utf8' })).stdout.trim();
    const additionTree = (await execFile('git', ['rev-parse', `${additionCommit}^{tree}`], {
      cwd: worktree,
      encoding: 'utf8',
    })).stdout.trim();
    await rejectsAuthorityMutation(stageIndexPath, (index) => {
      index.sourceRevision = additionCommit;
      index.sourceTree = additionTree;
    });
    await rejectsAuthorityMutation(firstSuccessorAbsolute, (successor) => {
      successor.unexpected = true;
    });
    await rejectsAuthorityMutation(firstSuccessorAbsolute, (successor) => {
      successor.authorization.unexpected = true;
    });
    await rejectsAuthorityMutation(
      join(worktree, 'decisions/0007-delivery-workflow-authority.json'),
      (deliveryDecision) => {
        deliveryDecision.authorityAmendment.productScope.sha256 = `sha256:${'0'.repeat(64)}`;
      },
    );
    await rejectsAuthorityMutation(
      join(worktree, 'decisions/0007-delivery-workflow-authority-acceptance.json'),
      (deliveryAcceptance) => {
        deliveryAcceptance.owner = 'not-the-decision-owner';
      },
    );
    await rejectsAuthorityMutation(firstSuccessorAbsolute, (successor) => {
      successor.supersededApplicabilityManifest.sha256 = `sha256:${'0'.repeat(64)}`;
    });

    const topology = JSON.parse(await readFile(
      join(worktree, 'decisions/0006-phase-c-applicability-topology.json'),
      'utf8',
    )).proofTopology;
    const completeTargets = [
      ...topology.phaseC.successorTargets,
      ...topology.maintenance.targets,
    ];
    const phaseTargets = topology.phaseC.successorTargets;
    const maintenanceTargets = topology.maintenance.targets;
    const phaseRootPaths = topology.phaseC.rootPaths;
    const gateRootPath = phaseRootPaths.at(-1);
    const maintenanceRootPath = topology.maintenance.rootPath;
    const outputRootPaths = [...phaseRootPaths, maintenanceRootPath];

    const authorityIndex = JSON.parse(stageIndexBytes);
    const authorityReferences = new Map(
      authorityIndex.supersessions.map((reference) => [reference.path, reference]),
    );
    const outputRootPresence = await Promise.all(outputRootPaths.map(async (rootPath) => (
      await lstat(dirname(join(worktree, rootPath))).then(() => true).catch((error) => (
        error?.code === 'ENOENT' ? false : Promise.reject(error)
      ))
    )));
    const presentOutputRootCount = outputRootPresence.filter(Boolean).length;
    assert.ok(
      presentOutputRootCount === 0 || presentOutputRootCount === outputRootPaths.length,
      'the outer fixture starts with either no Phase C roots or the complete seven-root set',
    );
    const declaredPhaseCIndex = presentOutputRootCount === 0
      ? null
      : JSON.parse(await readFile(join(worktree, gateRootPath), 'utf8'));
    const pendingSourceRevision = declaredPhaseCIndex?.sourceRevision
      ?? (await execFile('git', ['rev-parse', 'HEAD'], { cwd: worktree, encoding: 'utf8' })).stdout.trim();
    const pendingSourceTree = declaredPhaseCIndex?.sourceTree
      ?? (await execFile('git', ['rev-parse', 'HEAD^{tree}'], { cwd: worktree, encoding: 'utf8' })).stdout.trim();
    const resolvedPendingSourceTree = (await execFile('git', ['rev-parse', `${pendingSourceRevision}^{tree}`], {
      cwd: worktree,
      encoding: 'utf8',
    })).stdout.trim();
    assert.equal(resolvedPendingSourceTree, pendingSourceTree, 'the Phase C index binds the pending source tree');

    async function writeSuccessorFixtures({ malformed = false, targetRoot = worktree, valid = false } = {}) {
      const references = new Map();
      for (const target of completeTargets) {
        let successor = malformed
          ? { previousSupersession: { path: target.predecessorPath } }
          : {
            ...JSON.parse(firstSuccessorBytes),
            affectedAssertions: target.affectedAssertions,
            historicalIndex: target.historicalIndex,
            previousSupersession: {
              path: target.predecessorPath,
              sha256: `sha256:${'0'.repeat(64)}`,
            },
          };
        const historical = JSON.parse(await readFile(join(targetRoot, target.historicalIndex.path), 'utf8'));
        if (valid) {
          const predecessorReference = authorityReferences.get(target.predecessorPath);
          const predecessor = JSON.parse(await readFile(join(worktree, target.predecessorPath), 'utf8'));
          const entries = await committedManifest(
            targetRoot,
            pendingSourceRevision,
            historical.applicabilityManifest.paths,
          );
          successor = {
            ...predecessor,
            currentApplicabilityManifest: {
              algorithm: 'sha256',
              paths: historical.applicabilityManifest.paths,
              profile: 'core-ui-path-manifest-v1',
              sha256: `sha256:${createHash('sha256').update(canonicalJson(entries)).digest('hex')}`,
            },
            previousSupersession: {
              path: target.predecessorPath,
              sha256: predecessorReference.sha256,
            },
            sourceRevision: pendingSourceRevision,
            sourceTree: pendingSourceTree,
            supersededApplicabilityManifest: predecessor.currentApplicabilityManifest,
          };
        }
        const bytes = canonicalJson(successor);
        const path = join(targetRoot, target.successorPath);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
        references.set(target.successorPath, {
          milestone: valid ? historical.milestone : 'test',
          path: target.successorPath,
          sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
        });
      }
      return references;
    }

    async function writeDecisionOwnedRoots(
      references,
      { sourceRevision = 'test', sourceTree = 'test', targetRoot = worktree, wrongOwner = false } = {},
    ) {
      for (const rootPath of phaseRootPaths.slice(0, -1)) {
        await mkdir(dirname(join(targetRoot, rootPath)), { recursive: true });
        await writeFile(join(targetRoot, rootPath), canonicalJson({
          milestone: 'test',
          records: [],
          schema: 'core-ui-evidence-index-v1',
          sourceRevision,
          sourceTree,
        }));
      }
      const gateTargets = [...phaseTargets];
      const maintenanceOwnedTargets = [...maintenanceTargets];
      if (wrongOwner) {
        [gateTargets[0], maintenanceOwnedTargets[0]] = [maintenanceOwnedTargets[0], gateTargets[0]];
      }
      for (const [rootPath, targets] of [
        [gateRootPath, gateTargets],
        [maintenanceRootPath, maintenanceOwnedTargets],
      ]) {
        await mkdir(dirname(join(targetRoot, rootPath)), { recursive: true });
        await writeFile(join(targetRoot, rootPath), canonicalJson({
          records: [],
          schema: 'core-ui-evidence-index-v1',
          sourceRevision,
          sourceTree,
          supersessions: targets.map(({ successorPath }) => references.get(successorPath)),
        }));
      }
    }

    let references = await writeSuccessorFixtures();
    await writeDecisionOwnedRoots(references, { wrongOwner: true });
    await assert.rejects(
      module.runTaleTokenMaterialization(worktree, { mode: 'check' }),
      /CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: .* supersession ownership/u,
    );
    for (const rootPath of outputRootPaths) {
      await rm(dirname(join(worktree, rootPath)), { recursive: true, force: true });
    }

    references = await writeSuccessorFixtures({ malformed: true });
    await writeDecisionOwnedRoots(references);
    await assert.rejects(
      module.runTaleTokenMaterialization(worktree, { mode: 'check' }),
      /CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH/u,
    );
    for (const rootPath of outputRootPaths) {
      await rm(dirname(join(worktree, rootPath)), { recursive: true, force: true });
    }

    const pendingWorktree = join(parent, 'pending-repository');
    await execFile('git', ['worktree', 'add', '--detach', pendingWorktree, pendingSourceRevision], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    try {
      await execFile('pnpm', ['install', '--offline', '--frozen-lockfile'], {
        cwd: pendingWorktree,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      const pendingModule = await import(pathToFileURL(join(
        pendingWorktree,
        'packages/tokens/src/tale-token-materialization.mjs',
      )).href);
      references = await writeSuccessorFixtures({ targetRoot: pendingWorktree, valid: true });
      await writeDecisionOwnedRoots(references, {
        sourceRevision: pendingSourceRevision,
        sourceTree: pendingSourceTree,
        targetRoot: pendingWorktree,
      });
      assert.equal(
        (await pendingModule.runTaleTokenMaterialization(pendingWorktree, { mode: 'check' })).changed,
        false,
        'an exact wholly-untracked pending capture validates before its evidence commit',
      );
      await execFile('git', ['add', '--', ...outputRootPaths.map((path) => dirname(path))], {
        cwd: pendingWorktree,
        encoding: 'utf8',
      });
      await assert.rejects(
        pendingModule.runTaleTokenMaterialization(pendingWorktree, { mode: 'check' }),
        /CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: .* pending capture state/u,
      );
      await execFile('git', ['restore', '--staged', '--', ...outputRootPaths.map((path) => dirname(path))], {
        cwd: pendingWorktree,
        encoding: 'utf8',
      });
      await execFile('git', ['add', '--', gateRootPath], { cwd: pendingWorktree, encoding: 'utf8' });
      await assert.rejects(
        pendingModule.runTaleTokenMaterialization(pendingWorktree, { mode: 'check' }),
        /CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: .* pending capture state/u,
      );
      await execFile('git', ['restore', '--staged', '--', gateRootPath], {
        cwd: pendingWorktree,
        encoding: 'utf8',
      });
      await execFile('git', [
        '-c', 'user.name=Core UI Test',
        '-c', 'user.email=core-ui-test@example.invalid',
        'commit', '--allow-empty', '-m', 'test: drift pending capture head',
      ], {
        cwd: pendingWorktree,
        encoding: 'utf8',
      });
      await assert.rejects(
        pendingModule.runTaleTokenMaterialization(pendingWorktree, { mode: 'check' }),
        /CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: .* pending capture state/u,
      );
      assert.equal(await readFile(join(pendingWorktree, firstSuccessorPath), 'utf8'), firstSuccessorBytes);
    } finally {
      await execFile('git', ['worktree', 'remove', '--force', pendingWorktree], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).catch(() => {});
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
