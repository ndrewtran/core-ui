import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parseJsonStrict } from '@core-ui/schema';
import {
  DEFAULT_THEME_IDENTITY,
  DEFAULT_THEME_IDENTITY_PATHS,
  DefaultThemeIdentityMigrationError,
  inspectDefaultThemeIdentity,
  migrateDefaultThemeIdentityValue,
  runDefaultThemeIdentityMigration,
} from '../src/default-theme-identity-migration.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const postMigration = {
  artifactId: DEFAULT_THEME_IDENTITY.postMigration.artifactId,
  bytes: DEFAULT_THEME_IDENTITY.postMigration.bytes,
  canonicalSha256: DEFAULT_THEME_IDENTITY.postMigration.canonicalSha256,
  path: DEFAULT_THEME_IDENTITY_PATHS.postMigration,
  rawSha256: DEFAULT_THEME_IDENTITY.postMigration.rawSha256,
};

async function temporaryRepository() {
  const root = await mkdtemp(join(process.cwd(), '.default-theme-identity-'));
  const oldPath = resolve(root, DEFAULT_THEME_IDENTITY_PATHS.preMigration);
  await mkdir(resolve(oldPath, '..'), { recursive: true });
  const currentPath = resolve(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.postMigration);
  const current = await readFile(currentPath, 'utf8');
  await writeFile(oldPath, current.replace('"id": "core:token:default-theme"', '"id": "core:token:button-minimum"'));
  return root;
}

test('default-theme identity is exact in the retained current source', async () => {
  assert.deepEqual(await inspectDefaultThemeIdentity(repositoryRoot), {
    bytes: await readFile(resolve(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.postMigration), 'utf8'),
    state: 'post-migration',
  });
  assert.deepEqual(await runDefaultThemeIdentityMigration(repositoryRoot, { mode: 'check' }), {
    changed: false, mode: 'check', postMigration, state: 'post-migration',
  });
  assert.deepEqual(await runDefaultThemeIdentityMigration(repositoryRoot, { mode: 'dry-run' }), {
    changed: false, mode: 'dry-run', postMigration, state: 'post-migration',
  });
});

test('default-theme identity migration rejects both, neither, and near-match states', async () => {
  const root = await temporaryRepository();
  try {
    const oldPath = resolve(root, DEFAULT_THEME_IDENTITY_PATHS.preMigration);
    const newPath = resolve(root, DEFAULT_THEME_IDENTITY_PATHS.postMigration);
    await cp(oldPath, newPath);
    await assert.rejects(inspectDefaultThemeIdentity(root), (error) => (
      error instanceof DefaultThemeIdentityMigrationError
      && error.code === 'CORE_TOKEN_IDENTITY_SOURCE_AMBIGUOUS'
    ));
    await rm(oldPath);
    await rm(newPath);
    await assert.rejects(inspectDefaultThemeIdentity(root), (error) => (
      error instanceof DefaultThemeIdentityMigrationError
      && error.code === 'CORE_TOKEN_IDENTITY_SOURCE_MISSING'
    ));
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const source = parseJsonStrict(await readFile(
    resolve(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.postMigration),
    'utf8',
  ));
  source.id = DEFAULT_THEME_IDENTITY.preMigration.artifactId;
  source.summary = `${source.summary} near-match`;
  assert.throws(
    () => migrateDefaultThemeIdentityValue(source),
    (error) => error instanceof DefaultThemeIdentityMigrationError
      && error.code === 'CORE_TOKEN_IDENTITY_SOURCE_DRIFT',
  );
});
