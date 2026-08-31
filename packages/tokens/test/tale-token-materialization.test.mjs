import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalDigest, parseJsonStrict } from '@muxui/schema';
import {
  correctTaleTokenClassification,
  loadTaleTokenMaterialization,
  materializeDefaultThemeTokenSource,
  materializeTaleTokenSource,
  projectTaleBaselineOccurrences,
  TaleTokenMaterializationError,
  TALE_TOKEN_MATERIALIZATION_IDENTITIES,
  TALE_TOKEN_MATERIALIZATION_PATHS,
} from '../src/tale-token-materialization.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

async function value(path) {
  return parseJsonStrict(await readFile(resolve(repositoryRoot, path), 'utf8'));
}

async function inputs() {
  return {
    phaseBSource: await value(TALE_TOKEN_MATERIALIZATION_PATHS.phaseBSource),
    parentDecision: await value(TALE_TOKEN_MATERIALIZATION_PATHS.parentDecision),
    resetDecision: await value(TALE_TOKEN_MATERIALIZATION_PATHS.resetDecision),
  };
}

function expectCode(code, operation) {
  assert.throws(operation, (error) => (
    error instanceof TaleTokenMaterializationError && error.code === code
  ));
}

test('TALE-TOKEN-C materializes the accepted 312-token source and exact crosswalk', async () => {
  const source = materializeTaleTokenSource(await inputs());
  const ids = Object.keys(source.tokens);
  assert.equal(canonicalDigest(source), TALE_TOKEN_MATERIALIZATION_IDENTITIES.decision0004FinalSource);
  assert.equal(ids.length, 312);
  assert.equal(ids.filter((id) => id.startsWith('reference.')).length, 296);
  assert.equal(ids.filter((id) => id.startsWith('semantic.')).length, 11);
  assert.equal(ids.filter((id) => id.startsWith('component.')).length, 5);
  assert.equal(source.tokenContractVersion, '2.0.0');
  assert.equal(canonicalDigest(source.sourceCrosswalk), 'sha256:7835e06c02297e667b4fd2cf9076d5c604de5a37bb64a7d587b4a0fa7cd5e45e');
  assert.equal(source.sourceCrosswalk.entries.length, 693);
  assert.equal(source.sourceCrosswalk.groups.length, 41);
  assert.deepEqual(
    Object.fromEntries(['adopt', 'adapt', 'defer', 'reject'].map((disposition) => [
      disposition,
      source.sourceCrosswalk.entries.filter((entry) => entry.disposition === disposition).length,
    ])),
    { adopt: 209, adapt: 95, defer: 328, reject: 61 },
  );
  for (const id of [
    'reference.color.action-dark', 'reference.color.action-light', 'reference.color.focus',
    'reference.color.invalid', 'reference.color.surface', 'reference.color.text-dark',
    'reference.color.text-light', 'reference.dimension.control-height',
    'reference.dimension.radius-medium', 'reference.dimension.space-inline',
  ]) assert.equal(Object.hasOwn(source.tokens, id), false, id);
  assert.equal(source.tokens['semantic.feedback.invalid'].alias, 'reference.color.error-60');
  assert.equal(Object.hasOwn(source.tokens, 'semantic.feedback.warning'), false);
  assert.equal(Object.hasOwn(source.tokens, 'semantic.feedback.success'), false);
});

test('TALE-TOKEN-C applies the accepted default-theme artifact identity without changing tokens', async () => {
  const decision0004Source = materializeTaleTokenSource(await inputs());
  const source = materializeDefaultThemeTokenSource(await inputs());
  assert.equal(source.id, 'core:token:default-theme');
  assert.equal(canonicalDigest(source), TALE_TOKEN_MATERIALIZATION_IDENTITIES.finalSource);
  assert.deepEqual(source.tokens, decision0004Source.tokens);
  assert.deepEqual(source.sourceCrosswalk, decision0004Source.sourceCrosswalk);
});

test('TALE-TOKEN-C occurrence projection is exact, ordered, and media-free', async () => {
  const { parentDecision } = await inputs();
  const occurrences = projectTaleBaselineOccurrences(parentDecision);
  assert.equal(occurrences.length, 693);
  assert.deepEqual(occurrences.map(({ ordinal }) => ordinal), Array.from({ length: 693 }, (_, index) => index + 1));
  assert.ok(occurrences.every((occurrence) => (
    Object.keys(occurrence).sort().join(',') === 'file,name,ordinal,selector,value'
  )));
  assert.equal(occurrences.some((occurrence) => Object.hasOwn(occurrence, 'media')), false);
});

test('TALE-TOKEN-C historical materialization fixture is independently verified', async () => {
  const root = await materializedFixtureRepository();
  try {
    const loaded = await loadTaleTokenMaterialization(root);
    assert.equal(loaded.state, 'materialized');
    assert.equal(canonicalDigest(loaded.currentSource), TALE_TOKEN_MATERIALIZATION_IDENTITIES.finalSource);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('TALE-TOKEN-C CLI audits by default and rejects legacy writes without mutation', async () => {
  const sourcePath = resolve(repositoryRoot, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource);
  const scriptPath = resolve(repositoryRoot, 'packages/tokens/src/tale-token-materialization.mjs');
  const before = await readFile(sourcePath, 'utf8');
  const audit = spawnSync(process.execPath, [scriptPath], {
    cwd: resolve(repositoryRoot, 'packages/tokens'),
    encoding: 'utf8',
  });
  assert.equal(audit.status, 0, audit.stderr);
  assert.match(audit.stdout, /"mode":"audit"/u);

  for (const legacyFlag of ['--write', '--materialize', '--rollback', '--rollback-check']) {
    const legacy = spawnSync(process.execPath, [scriptPath, legacyFlag], {
      cwd: resolve(repositoryRoot, 'packages/tokens'),
      encoding: 'utf8',
    });
    assert.notEqual(legacy.status, 0, legacyFlag);
    assert.match(`${legacy.stdout}${legacy.stderr}`, /CORE_TOKEN_HISTORICAL_AUDIT_ONLY/u, legacyFlag);
  }
  assert.equal(await readFile(sourcePath, 'utf8'), before);
});

async function temporaryRepository() {
  const root = await mkdtemp(join(process.cwd(), '.tale-token-materialization-'));
  for (const path of Object.values(TALE_TOKEN_MATERIALIZATION_PATHS).filter(
    (path) => path !== TALE_TOKEN_MATERIALIZATION_PATHS.preIdentitySource
      && path !== TALE_TOKEN_MATERIALIZATION_PATHS.currentSource,
  )) {
    await mkdir(resolve(root, path, '..'), { recursive: true });
    await cp(resolve(repositoryRoot, path), resolve(root, path));
  }
  const phaseB = await readFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.phaseBSource), 'utf8');
  const preIdentityPath = resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.preIdentitySource);
  await mkdir(resolve(preIdentityPath, '..'), { recursive: true });
  await writeFile(preIdentityPath, phaseB);
  return root;
}

async function materializedFixtureRepository() {
  const root = await temporaryRepository();
  await unlink(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.preIdentitySource));
  const sourcePath = resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource);
  await mkdir(resolve(sourcePath, '..'), { recursive: true });
  const source = materializeDefaultThemeTokenSource(await inputs());
  await writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
  return root;
}

test('TALE-TOKEN-C rejects base, target, meaning, collision, and final near-match drift', async () => {
  const input = await inputs();
  const wrongTarget = structuredClone(input);
  wrongTarget.parentDecision.entries[320].targets['native.ios'] = 'deferred';
  expectCode('CORE_TALE_RESET_TARGET_MISMATCH', () => materializeTaleTokenSource(wrongTarget));

  const wrongMeaning = structuredClone(input);
  wrongMeaning.resetDecision.classificationDelta.renames[0].meaningTemplate = 'Error step.';
  expectCode('CORE_TALE_RESET_MEANING_MISMATCH', () => materializeTaleTokenSource(wrongMeaning));

  const collision = structuredClone(input);
  collision.parentDecision.coreTokens.find(({ id }) => id === 'reference.color.red-muted-10').id = 'reference.duration.fast';
  expectCode('CORE_TALE_RESET_TOKEN_COLLISION', () => materializeTaleTokenSource(collision));

  const root = await temporaryRepository();
  try {
    const prePath = resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.preIdentitySource);
    const currentPath = resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource);
    await unlink(prePath);
    const current = materializeDefaultThemeTokenSource(input);
    current.tokens['semantic.action.background'].meaning = 'Near match.';
    await mkdir(resolve(currentPath, '..'), { recursive: true });
    await writeFile(currentPath, `${JSON.stringify(current, null, 2)}\n`);
    await assert.rejects(
      loadTaleTokenMaterialization(root),
      (error) => error instanceof TaleTokenMaterializationError
        && error.code === 'CORE_TALE_RESET_BASE_DRIFT',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
