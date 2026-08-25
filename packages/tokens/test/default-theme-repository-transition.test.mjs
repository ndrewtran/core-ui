import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { hasReactR1PackageBaseline } from '../src/internal/default-theme-repository-transition.mjs';

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

test('R1 React package baseline is checked independently of delivery authority', async () => {
  assert.equal(await hasReactR1PackageBaseline(repositoryRoot), true);
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-react-package-baseline-'));
  try {
    const fixture = join(parent, 'packages/react');
    await mkdir(fixture, { recursive: true });
    const packagePath = join(fixture, 'package.json');
    const source = await readFile(join(repositoryRoot, 'packages/react/package.json'), 'utf8');
    const packageJson = JSON.parse(source);
    for (const version of ['0.1.0-alpha.1', '0.1.0-alpha.42', '0.1.0-rc.1']) {
      await writeFile(packagePath, JSON.stringify({ ...packageJson, version }));
      assert.equal(await hasReactR1PackageBaseline(parent), true, version);
    }
    for (const version of ['0.1.0', '0.1.0-rc.2', '0.2.0']) {
      await writeFile(packagePath, JSON.stringify({ ...packageJson, version }));
      assert.equal(await hasReactR1PackageBaseline(parent), false, version);
    }
    await writeFile(packagePath, JSON.stringify({
      ...packageJson,
      version: '0.1.0-alpha.42',
      dependencies: { ...packageJson.dependencies, 'react-aria-components': '1.21.0' },
    }));
    assert.equal(await hasReactR1PackageBaseline(parent), false, 'dependency drift');
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('TALE-TOKEN-C repository transition restores failed changes and replays idempotently', { timeout: 240_000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-token-transition-'));
  const worktree = join(parent, 'repository');
  try {
    await execFile('git', ['clone', '--no-local', '--no-tags', '--no-checkout', repositoryRoot, worktree], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    const revision = (await execFile('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' })).stdout.trim();
    await execFile('git', ['checkout', '--detach', revision], { cwd: worktree, encoding: 'utf8' });
    await overlayCandidate(worktree);
    await execFile('pnpm', ['install', '--offline', '--frozen-lockfile'], {
      cwd: worktree,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });

    const transition = await import(pathToFileURL(join(
      worktree,
      'packages/tokens/src/internal/default-theme-repository-transition.mjs',
    )).href);
    const identity = await import(pathToFileURL(join(
      worktree,
      'packages/tokens/src/default-theme-identity-migration.mjs',
    )).href);
    const originalDigest = await digestPaths(worktree);
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
        validate: async () => { throw new Error('INJECTED_TRANSITION_VALIDATION_FAILURE'); },
      }),
      /INJECTED_TRANSITION_VALIDATION_FAILURE/u,
    );
    assert.equal(await digestPaths(worktree), originalDigest, 'failed transition restores every consumer');

    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree, { mode: 'rollback' })).changed, true);
    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree, { mode: 'rollback' })).changed, false);
    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree)).changed, true);
    assert.equal((await identity.runDefaultThemeIdentityMigration(worktree)).changed, false);
    assert.equal(await digestPaths(worktree), originalDigest, 'rollback and replay are exact and idempotent');
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
