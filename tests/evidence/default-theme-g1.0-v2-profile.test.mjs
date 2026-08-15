import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  compileTokenGraph,
  compileTokenRequirementSet,
} from '../../packages/tokens/src/index.mjs';
import {
  assertPackedCompatibilityFixture,
  createPackedCompatibilityFixture,
} from '../fixtures/g1.0/packed-compatibility.mjs';
import {
  DEFAULT_THEME_G10_V2_ACCEPTANCE,
  DEFAULT_THEME_G10_V2_APPLICABILITY_PATHS,
  DEFAULT_THEME_G10_V2_ASSERTION_IDS,
  DEFAULT_THEME_G10_V2_EXPECTED_FACTS,
  DEFAULT_THEME_G10_V2_PHASE_C_ROOTS,
  DEFAULT_THEME_G10_V2_PRODUCT_SOURCE,
  DEFAULT_THEME_G10_V2_PROOF_FILES,
  DEFAULT_THEME_G10_V2_ROOT,
  assertDefaultThemeG10V2DirectoryNames,
  assertDefaultThemeG10V2PhaseC,
  assertDefaultThemeG10V2PhaseCReferences,
  assertDefaultThemeG10V2SourceTopology,
  hasUnsanitizedDefaultThemeG10V2Output,
  pathManifestAtRevision,
} from './default-theme-g1.0-v2-profile.mjs';
import {
  DefaultThemeG10V2PostValidationDriftError,
  assertDefaultThemeG10V2PostValidationClean,
  normalizeDefaultThemeG10V2Output,
  parseDefaultThemeG10V2Arguments,
  publishDefaultThemeG10V2Atomically,
} from './capture-default-theme-g1.0-v2.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const execFile = promisify(execFileCallback);
const source = parseJsonStrict(await readFile(
  new URL('../../catalog/tokens/default-theme.json', import.meta.url),
  'utf8',
));
const recipe = {
  source: source.id,
  requirements: [
    { token: 'component.button.background', requirement: 'required' },
    { token: 'component.button.foreground', requirement: 'required' },
  ],
};

function expectCode(code, operation) {
  assert.throws(operation, (error) => error?.code === code);
}

async function absent(path) {
  return access(path).then(() => false, (error) => {
    if (error?.code === 'ENOENT') return true;
    throw error;
  });
}

test('DEFAULT-THEME-G1.0-V2 owns exact current identities and eight assertions', () => {
  assert.deepEqual(DEFAULT_THEME_G10_V2_PRODUCT_SOURCE, {
    revision: '35676452ca44f4abb64c6211e05424361f9a6896',
    tree: '03571985cc16305f6e4cff2cdce219e161237636',
  });
  assert.equal(DEFAULT_THEME_G10_V2_ACCEPTANCE.commentId, 5299853210);
  assert.equal(DEFAULT_THEME_G10_V2_ACCEPTANCE.acceptedPacketSha256, 'sha256:f2952c17ea4a8b1944d07aff087f2250187885d906de9735feb1113f498e9684');
  assert.deepEqual(DEFAULT_THEME_G10_V2_ASSERTION_IDS, [
    'E-G1.0-01', 'E-G1.0-02', 'E-G1.0-03', 'E-G1.0-04',
    'E-G1.0-05', 'E-G1.0-06', 'E-G1.0-07', 'E-G1.0-08',
  ]);
  assert.equal(DEFAULT_THEME_G10_V2_PHASE_C_ROOTS.length, 6);
});

test('DEFAULT-THEME-G1.0-V2 source topology is the exact five-path sole child', () => {
  const changes = DEFAULT_THEME_G10_V2_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`);
  assert.doesNotThrow(() => assertDefaultThemeG10V2SourceTopology({
    changes, parents: [DEFAULT_THEME_G10_V2_PRODUCT_SOURCE.revision],
    revision: '1'.repeat(40), tree: '2'.repeat(40),
  }));
  for (const mutation of [
    { changes: [...changes, 'A\ttests/evidence/unbounded.mjs'] },
    { changes, parents: [] },
    { changes: changes.slice(1) },
  ]) {
    assert.throws(() => assertDefaultThemeG10V2SourceTopology({
      changes: mutation.changes, parents: mutation.parents ?? [DEFAULT_THEME_G10_V2_PRODUCT_SOURCE.revision],
      revision: '1'.repeat(40), tree: '2'.repeat(40),
    }), /five-path proof-tool child/u);
  }
});

test('DEFAULT-THEME-G1.0-V2 binds the six exact accepted Phase C v2 roots', async () => {
  assert.deepEqual(DEFAULT_THEME_G10_V2_PHASE_C_ROOTS.map(({ path }) => path), [
    'tests/evidence/tale-token-phase-c-g0.1-v2/index.json',
    'tests/evidence/tale-token-phase-c-g0.2-v2/index.json',
    'tests/evidence/tale-token-phase-c-g0.3-v2/index.json',
    'tests/evidence/tale-token-phase-c-g0.4-v2/index.json',
    'tests/evidence/tale-token-phase-c-g0.5-v2/index.json',
    'tests/evidence/tale-token-phase-c-gate-0-v2/index.json',
  ]);
  assert.throws(() => assertDefaultThemeG10V2PhaseCReferences(
    DEFAULT_THEME_G10_V2_PHASE_C_ROOTS.map((reference, index) => (
      index === 0 ? { ...reference, sha256: `sha256:${'0'.repeat(64)}` } : reference
    )),
  ), /six exact accepted index paths and digests/u);
  await assertDefaultThemeG10V2PhaseC(repositoryRoot);
});

test('DEFAULT-THEME-G1.0-V2 applicability is identical at product source and current checkout', async () => {
  const [product, current] = await Promise.all([
    pathManifestAtRevision(repositoryRoot, DEFAULT_THEME_G10_V2_PRODUCT_SOURCE.revision, DEFAULT_THEME_G10_V2_APPLICABILITY_PATHS),
    pathManifestAtRevision(repositoryRoot, 'HEAD', DEFAULT_THEME_G10_V2_APPLICABILITY_PATHS),
  ]);
  assert.equal(canonicalJson(current), canonicalJson(product));
});

test('DEFAULT-THEME-G1.0-V2 arguments are exact', () => {
  const values = parseDefaultThemeG10V2Arguments([
    '--source', '1'.repeat(40), '--tree', '2'.repeat(40), '--executed', '3'.repeat(40),
    '--executed-tree', '4'.repeat(40), '--timestamp', '2026-08-15T02:00:00Z',
  ]);
  assert.equal(values.executedRevision, '3'.repeat(40));
  assert.throws(() => parseDefaultThemeG10V2Arguments(['--source', '1'.repeat(40)]), /ARGUMENT_INVALID/u);
});

test('DEFAULT-THEME-G1.0 observes the separate literal unit denial', () => {
  const invalid = structuredClone(source);
  invalid.tokens['reference.duration.fast'].unit = 'px';
  expectCode('CORE_TOKEN_UNIT_MISMATCH', () => compileTokenGraph(invalid));
});

test('DEFAULT-THEME-G1.0 rejects direct reference consumption in component recipes', () => {
  const invalid = structuredClone(recipe);
  invalid.requirements[0].token = 'reference.color.neutral-90';
  expectCode('CORE_TOKEN_RECIPE_INVALID', () => compileTokenRequirementSet({
    source,
    recipe: invalid,
    bindingId: 'web.html',
    profile: 'web.html',
  }));
});

test('DEFAULT-THEME-G1.0 rejects unproved and incompatible fallbacks', () => {
  const fallback = (value) => {
    const candidate = structuredClone(recipe);
    candidate.requirements[0].fallback = value;
    return () => compileTokenRequirementSet({
      source,
      recipe: candidate,
      bindingId: 'web.html',
      profile: 'web.html',
    });
  };
  expectCode('CORE_TOKEN_FALLBACK_UNPROVED', fallback({
    kind: 'value', profiles: ['web.html'], evidenceIds: [], type: 'color', unit: 'hex', value: '#000000',
  }));
  expectCode('CORE_TOKEN_FALLBACK_INVALID', fallback({
    kind: 'value', profiles: ['web.html'], evidenceIds: ['E-G1.0-03'], type: 'dimension', unit: 'px', value: 1,
  }));
  expectCode('CORE_TOKEN_FALLBACK_INVALID', fallback({
    kind: 'token', profiles: ['web.html'], evidenceIds: ['E-G1.0-03'], token: 'reference.color.neutral-90',
  }));
});

test('DEFAULT-THEME-G1.0 rejects independent catalog descriptor and release drift', async () => {
  const [catalogBundle, catalogPackage, packedSource] = await Promise.all([
    readFile(new URL('../../packages/catalog/generated/catalog.json', import.meta.url), 'utf8').then(parseJsonStrict),
    readFile(new URL('../../packages/catalog/generated/catalog-package.json', import.meta.url), 'utf8').then(parseJsonStrict),
    readFile(new URL('../fixtures/g1.0/packed-compatibility-source.json', import.meta.url), 'utf8').then(parseJsonStrict),
  ]);
  const fixture = createPackedCompatibilityFixture({ source: packedSource, catalogPackage, catalogBundle });
  const binding = fixture.release.bindings.find(({ binding: id }) => id === 'core:component:button#web.react');
  const descriptor = fixture.descriptors.find(({ id }) => id === binding.descriptor).bindings[binding.binding];
  const profile = Object.keys(binding.tokenRequirementSetDigests)[0];
  const invalidDigest = `sha256:${'0'.repeat(64)}`;
  for (const mutate of [
    (value) => { value.catalog.tokenRequirementSets[`core:component:button#web.react:${profile}`] = invalidDigest; },
    (value) => { value.descriptors.find(({ id }) => id === binding.descriptor).bindings[binding.binding].specRevision = invalidDigest; },
    (value) => { value.release.bindings.find(({ binding: id }) => id === binding.binding).specRevision = invalidDigest; },
  ]) {
    const invalid = structuredClone(fixture);
    mutate(invalid);
    assert.throws(() => assertPackedCompatibilityFixture(invalid), /G1_0_PACKED_COMPATIBILITY_INVALID/u);
  }
  assert.notEqual(descriptor.specRevision, invalidDigest);
});

test('DEFAULT-THEME-G1.0 rejects runtime-source drift and undeclared compiler options', () => {
  const runtime = structuredClone(source);
  runtime.theme.runtimeSwitching = 'available';
  expectCode('CORE_SCHEMA_INVALID', () => compileTokenGraph(runtime));
  expectCode('CORE_TOKEN_OPTIONS_INVALID', () => compileTokenGraph(source, { runtimeSwitching: true }));
});

test('DEFAULT-THEME-G1.0 observes exact binding revisions and the complete RNW disposition', async () => {
  const catalog = parseJsonStrict(await readFile(
    new URL('../../packages/catalog/generated/catalog.json', import.meta.url),
    'utf8',
  ));
  const button = catalog.artifacts.find(({ id }) => id === 'core:component:button');
  assert.equal(
    canonicalJson(button.bindingSpecRevisions),
    canonicalJson(DEFAULT_THEME_G10_V2_EXPECTED_FACTS['E-G1.0-07'].bindingSpecRevisions),
  );
  const binding = button.record.bindings['native.react-native'];
  const rnw = binding.platformSafety.find(({ profile }) => profile === 'native.react-native-web');
  assert.equal(binding.runtimeProfiles['native.react-native-web'].strategy, 'unsupported');
  assert.equal(rnw.requirements.length > 0, true);
  assert.equal(rnw.requirements.every(({ disposition, reason }) => (
    disposition === 'not-applicable' && typeof reason === 'string' && reason.length > 0
  )), true);
});

test('DEFAULT-THEME-G1.0-V2 normalization and privacy checks reject local and credential output', () => {
  const normalized = normalizeDefaultThemeG10V2Output(
    `${repositoryRoot}/file (12.3ms)\r\nTime:        0.311 s, estimated 1 s\r\n`,
    repositoryRoot,
  );
  assert.equal(normalized, '<repository>/file (duration)\nTime: <duration>\n');
  assert.equal(hasUnsanitizedDefaultThemeG10V2Output(normalized, repositoryRoot), false);
  assert.equal(hasUnsanitizedDefaultThemeG10V2Output('/Users/admin/private', repositoryRoot), true);
  assert.equal(hasUnsanitizedDefaultThemeG10V2Output('api_key=secret', repositoryRoot), true);
});

test('DEFAULT-THEME-G1.0-V2 directory routing is absent-safe and fail-closed', () => {
  assert.equal(assertDefaultThemeG10V2DirectoryNames(['g0.0']), false);
  assert.equal(assertDefaultThemeG10V2DirectoryNames(['default-theme-g1.0-v2']), true);
  assert.throws(() => assertDefaultThemeG10V2DirectoryNames([
    'default-theme-g1.0-v2', 'default-theme-g1.0-v2-copy',
  ]), /exactly one/u);
});

test('DEFAULT-THEME-G1.0-V2 publication is atomic and rolls back after failure', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'default-theme-g10-v2-atomic-'));
  const repository = join(temporary, 'repository');
  const generated = join(temporary, 'generated');
  const generatedRoot = join(generated, DEFAULT_THEME_G10_V2_ROOT);
  const destination = join(repository, DEFAULT_THEME_G10_V2_ROOT);
  try {
    await mkdir(generatedRoot, { recursive: true });
    await mkdir(join(repository, 'tests/evidence'), { recursive: true });
    await writeFile(join(generatedRoot, 'marker.txt'), 'exact');
    await assert.rejects(publishDefaultThemeG10V2Atomically({
      repository, generatedRoot: generated, afterPublish: async () => { throw new Error('injected'); },
    }), /injected/u);
    assert.equal(await absent(destination), true);
    await publishDefaultThemeG10V2Atomically({ repository, generatedRoot: generated });
    assert.equal(await readFile(join(destination, 'marker.txt'), 'utf8'), 'exact');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('DEFAULT-THEME-G1.0-V2 rejects post-validation drift before publication', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'default-theme-g10-v2-drift-'));
  const output = join(repository, DEFAULT_THEME_G10_V2_ROOT);
  try {
    await execFile('git', ['init', '--quiet'], { cwd: repository });
    await writeFile(join(repository, 'tracked.txt'), 'before');
    await execFile('git', ['add', 'tracked.txt'], { cwd: repository });
    await execFile('git', [
      '-c', 'user.name=Core UI Test',
      '-c', 'user.email=core-ui@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ], { cwd: repository });
    await writeFile(join(repository, 'tracked.txt'), 'validation mutation');
    await assert.rejects(
      assertDefaultThemeG10V2PostValidationClean(repository),
      (error) => error instanceof DefaultThemeG10V2PostValidationDriftError
        && error.code === 'DEFAULT_THEME_G10_V2_POST_VALIDATION_DRIFT',
    );
    assert.equal(await absent(output), true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('DEFAULT-THEME-G1.0-V2 retained root is absent before capture', async () => {
  assert.equal(await absent(join(repositoryRoot, DEFAULT_THEME_G10_V2_ROOT)), true);
});
