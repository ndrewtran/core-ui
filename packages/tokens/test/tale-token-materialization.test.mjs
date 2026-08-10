import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalDigest, parseJsonStrict } from '@core-ui/schema';
import {
  correctTaleTokenClassification,
  loadTaleTokenMaterialization,
  materializeTaleTokenSource,
  projectTaleBaselineOccurrences,
  runTaleTokenMaterialization,
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
  assert.equal(canonicalDigest(source), TALE_TOKEN_MATERIALIZATION_IDENTITIES.finalSource);
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

test('TALE-TOKEN-C current source is an independently verified final idempotent result', async () => {
  const loaded = await loadTaleTokenMaterialization(repositoryRoot);
  assert.equal(loaded.state, 'materialized');
  assert.equal(canonicalDigest(loaded.currentSource), TALE_TOKEN_MATERIALIZATION_IDENTITIES.finalSource);
  assert.deepEqual(await runTaleTokenMaterialization(repositoryRoot, { mode: 'check' }), {
    changed: false,
    mode: 'check',
    state: 'materialized',
  });
  assert.deepEqual(await runTaleTokenMaterialization(repositoryRoot, { mode: 'dry-run' }), {
    changed: false,
    mode: 'dry-run',
    state: 'materialized',
  });
});

async function temporaryRepository() {
  const root = await mkdtemp(join(process.cwd(), '.tale-token-materialization-'));
  for (const path of Object.values(TALE_TOKEN_MATERIALIZATION_PATHS)) {
    await mkdir(resolve(root, path, '..'), { recursive: true });
    await cp(resolve(repositoryRoot, path), resolve(root, path));
  }
  const phaseB = await readFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.phaseBSource), 'utf8');
  await writeFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource), phaseB);
  return root;
}

test('TALE-TOKEN-C replays Phase B, is idempotent, and rolls back byte-for-byte', async () => {
  const root = await temporaryRepository();
  try {
    const phaseB = await readFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.phaseBSource), 'utf8');
    assert.deepEqual(await runTaleTokenMaterialization(root, { mode: 'dry-run' }), {
      changed: true, mode: 'dry-run', state: 'phase-b',
    });
    assert.deepEqual(await runTaleTokenMaterialization(root), {
      changed: true, mode: 'write', state: 'materialized',
    });
    const firstFinal = await readFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource), 'utf8');
    assert.deepEqual(await runTaleTokenMaterialization(root), {
      changed: false, mode: 'write', state: 'materialized',
    });
    assert.equal(await readFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource), 'utf8'), firstFinal);
    assert.deepEqual(await runTaleTokenMaterialization(root, { mode: 'rollback' }), {
      changed: true, mode: 'rollback', state: 'phase-b',
    });
    assert.equal(await readFile(resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource), 'utf8'), phaseB);
    assert.deepEqual(await runTaleTokenMaterialization(root, { mode: 'rollback' }), {
      changed: false, mode: 'rollback', state: 'phase-b',
    });
    assert.deepEqual(await runTaleTokenMaterialization(root, { mode: 'rollback-check' }), {
      changed: false, mode: 'rollback-check', state: 'phase-b',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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
    const currentPath = resolve(root, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource);
    const current = parseJsonStrict(await readFile(currentPath, 'utf8'));
    current.tokens['semantic.action.background'].meaning = 'Near match.';
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
