import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parseJsonStrict } from '@core-ui/schema';
import { materializeDefaultThemeTokenSource, TALE_TOKEN_MATERIALIZATION_PATHS } from '../src/tale-token-materialization.mjs';
import {
  DEFAULT_THEME_IDENTITY,
  DEFAULT_THEME_IDENTITY_PATHS,
  DefaultThemeIdentityMigrationError,
  inspectDefaultThemeIdentity,
  migrateDefaultThemeIdentityValue,
} from '../src/default-theme-identity-migration.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

async function historicalSource() {
  const inputs = {};
  for (const path of [
    TALE_TOKEN_MATERIALIZATION_PATHS.phaseBSource,
    TALE_TOKEN_MATERIALIZATION_PATHS.parentDecision,
    TALE_TOKEN_MATERIALIZATION_PATHS.resetDecision,
  ]) inputs[path] = parseJsonStrict(await readFile(resolve(repositoryRoot, path), 'utf8'));
  const source = materializeDefaultThemeTokenSource({
    phaseBSource: inputs[TALE_TOKEN_MATERIALIZATION_PATHS.phaseBSource],
    parentDecision: inputs[TALE_TOKEN_MATERIALIZATION_PATHS.parentDecision],
    resetDecision: inputs[TALE_TOKEN_MATERIALIZATION_PATHS.resetDecision],
  });
  return `${JSON.stringify(source, null, 2)}\n`;
}

async function temporaryRepository({ preMigration = false } = {}) {
  const root = await mkdtemp(join(process.cwd(), '.default-theme-identity-'));
  const path = preMigration ? DEFAULT_THEME_IDENTITY_PATHS.preMigration : DEFAULT_THEME_IDENTITY_PATHS.postMigration;
  const targetPath = resolve(root, path);
  await mkdir(resolve(targetPath, '..'), { recursive: true });
  const source = await historicalSource();
  await writeFile(targetPath, preMigration
    ? source.replace('"id": "core:token:default-theme"', '"id": "core:token:button-minimum"')
    : source);
  return root;
}

test('default-theme identity remains exact in a frozen historical fixture', async () => {
  const root = await temporaryRepository();
  try {
    assert.deepEqual(await inspectDefaultThemeIdentity(root), {
      bytes: await readFile(resolve(root, DEFAULT_THEME_IDENTITY_PATHS.postMigration), 'utf8'),
      state: 'post-migration',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('default-theme identity CLI audits by default and rejects legacy writes without mutation', async () => {
  const sourcePath = resolve(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.postMigration);
  const scriptPath = resolve(repositoryRoot, 'packages/tokens/src/default-theme-identity-migration.mjs');
  const before = await readFile(sourcePath, 'utf8');
  const audit = spawnSync(process.execPath, [scriptPath], {
    cwd: resolve(repositoryRoot, 'packages/tokens'),
    encoding: 'utf8',
  });
  assert.equal(audit.status, 0, audit.stderr);
  assert.match(audit.stdout, /"mode":"audit"/u);

  for (const legacyFlag of ['--write', '--migrate', '--rollback']) {
    const legacy = spawnSync(process.execPath, [scriptPath, legacyFlag], {
      cwd: resolve(repositoryRoot, 'packages/tokens'),
      encoding: 'utf8',
    });
    assert.notEqual(legacy.status, 0, legacyFlag);
    assert.match(`${legacy.stdout}${legacy.stderr}`, /CORE_TOKEN_HISTORICAL_AUDIT_ONLY/u, legacyFlag);
  }
  assert.equal(await readFile(sourcePath, 'utf8'), before);
});

test('default-theme identity migration rejects both, neither, and near-match states', async () => {
  const root = await temporaryRepository({ preMigration: true });
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

  const source = parseJsonStrict(await historicalSource());
  source.id = DEFAULT_THEME_IDENTITY.preMigration.artifactId;
  source.summary = `${source.summary} near-match`;
  assert.throws(
    () => migrateDefaultThemeIdentityValue(source),
    (error) => error instanceof DefaultThemeIdentityMigrationError
      && error.code === 'CORE_TOKEN_IDENTITY_SOURCE_DRIFT',
  );
});
