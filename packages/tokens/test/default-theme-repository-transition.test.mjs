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

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../../..');
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
  for (const relativePath of await candidatePaths()) {
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
}

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
