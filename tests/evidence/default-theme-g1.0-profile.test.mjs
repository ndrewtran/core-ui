import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
  DEFAULT_THEME_G1_ACCEPTANCE,
  DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
  DEFAULT_THEME_G1_ASSERTION_IDS,
  DEFAULT_THEME_G1_EXPECTED_FACTS,
  DEFAULT_THEME_G1_EXECUTION_PARENT,
  DEFAULT_THEME_G1_EVIDENCE_KINDS,
  DEFAULT_THEME_G1_EXPIRY,
  DEFAULT_THEME_G1_MAINTENANCE_CONTEXT,
  DEFAULT_THEME_G1_PHASE_C_ROOTS,
  DEFAULT_THEME_G1_PRODUCT_SOURCE,
  DEFAULT_THEME_G1_PROOF_TOOL_FILES,
  DEFAULT_THEME_G1_RETAINED_COMMANDS,
  DEFAULT_THEME_G1_RETENTION_POLICY,
  DEFAULT_THEME_G1_ROOT,
  assertDefaultThemeG1IndexShape,
  assertDefaultThemeG1ExecutionFiles,
  assertDefaultThemeG1ExecutionTopology,
  assertDefaultThemeG1EvidenceMetadata,
  assertDefaultThemeG1Profile,
  assertDefaultThemeG1Root,
  createDefaultThemeG1Profile,
} from './default-theme-g1.0-profile.mjs';
import {
  assertTruthfulDefaultThemeG1Timestamp,
  compareDefaultThemeG1Trees,
  parseDefaultThemeG1Arguments,
  publishDefaultThemeG1Atomically,
} from './capture-default-theme-g1.0.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const fakeSha = `sha256:${'a'.repeat(64)}`;
const fakeRevision = 'b'.repeat(40);
const fakeTree = 'c'.repeat(40);
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

function profile() {
  return createDefaultThemeG1Profile({
    executedRevision: fakeRevision,
    executedTree: fakeTree,
    toolFiles: DEFAULT_THEME_G1_PROOF_TOOL_FILES.map((path) => ({ path, sha256: fakeSha })),
  });
}

function index() {
  return {
    applicabilityManifest: DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
    applicabilityProfile: profile(),
    captureTimestamp: '2026-08-11T03:00:00Z',
    disclosureClass: 'public-sanitized',
    executedRevision: fakeRevision,
    executedTree: fakeTree,
    milestone: 'G1.0',
    owner: 'ndrewtran',
    records: DEFAULT_THEME_G1_ASSERTION_IDS.map((assertionId) => ({
      assertionId,
      path: `${DEFAULT_THEME_G1_ROOT}/records/${assertionId}.json`,
      sha256: fakeSha,
    })),
    recertifications: [],
    retentionPolicy: DEFAULT_THEME_G1_RETENTION_POLICY,
    schema: 'core-ui-evidence-index-v1',
    sourceRevision: DEFAULT_THEME_G1_PRODUCT_SOURCE.revision,
    sourceTree: DEFAULT_THEME_G1_PRODUCT_SOURCE.tree,
    supersessions: [],
    validation: { path: `${DEFAULT_THEME_G1_ROOT}/validation.json`, sha256: fakeSha },
  };
}

function expectProfileFailure(mutate) {
  const value = structuredClone(profile());
  mutate(value);
  assert.throws(() => assertDefaultThemeG1Profile(value), /DEFAULT_THEME_G1_PROFILE_INVALID/u);
}

function expectIndexFailure(mutate) {
  const value = structuredClone(index());
  mutate(value);
  assert.throws(() => assertDefaultThemeG1IndexShape(value), /DEFAULT_THEME_G1_PROFILE_INVALID/u);
}

test('DEFAULT-THEME-G1.0 profile binds exact product, execution, acceptance, and Phase C identities', () => {
  assert.doesNotThrow(() => assertDefaultThemeG1Profile(profile()));
  assert.equal(DEFAULT_THEME_G1_PHASE_C_ROOTS.length, 6);
  assert.equal(DEFAULT_THEME_G1_MAINTENANCE_CONTEXT.role, 'non-proof fourteen-successor integrity topology');
  assert.equal(DEFAULT_THEME_G1_ACCEPTANCE.commentId, 5248490977);
  assert.equal(typeof DEFAULT_THEME_G1_ACCEPTANCE.commentId, 'number');
  assert.equal(DEFAULT_THEME_G1_APPLICABILITY_MANIFEST.sha256, 'sha256:6183881420791463b2f415fb399c75207c4316f9632b6b25c6dae92c3659290a');
  assert.equal(Object.keys(DEFAULT_THEME_G1_EXPECTED_FACTS).length, 8);
});

test('DEFAULT-THEME-G1.0 profile rejects unknown, missing, substituted, coerced, and edited identity', () => {
  for (const mutate of [
    (value) => { value.unknown = true; },
    (value) => { delete value.acceptance; },
    (value) => { value.productSource.revision = 'd'.repeat(40); },
    (value) => { value.execution.revision = 'short'; },
    (value) => { value.execution.files.reverse(); },
    (value) => { value.execution.files[0].sha256 = 'sha256:short'; },
    (value) => { value.upstreamPhaseCRoots.pop(); },
    (value) => { value.upstreamPhaseCRoots.push(structuredClone(value.maintenanceContext)); },
    (value) => { value.maintenanceContext.role = 'proof'; },
    (value) => { value.applicabilityManifest.paths.reverse(); },
    (value) => { value.applicabilityManifest.sha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.assertionIds.reverse(); },
    (value) => { value.assertionIds.push('E-G1.0-09'); },
    (value) => { value.acceptance.provider = 'gitlab'; },
    (value) => { value.acceptance.repository = 'other/core-ui'; },
    (value) => { value.acceptance.pullRequestNumber = 50; },
    (value) => { value.acceptance.outcome = 'pending'; },
    (value) => { value.acceptance.ownerNodeId = value.acceptance.commentNodeId; },
    (value) => { value.acceptance.commentNodeId = value.acceptance.ownerNodeId; },
    (value) => { value.acceptance.commentId = String(value.acceptance.commentId); },
    (value) => { value.acceptance.authorAssociation = 'MEMBER'; },
    (value) => { value.acceptance.createdAt = '2026-08-11T03:00:00Z'; },
    (value) => { value.acceptance.updatedAt = '2026-08-11T03:00:00Z'; },
    (value) => { value.acceptance.bodySha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.acceptance.acceptedPacket.id = 'other'; },
    (value) => { value.acceptance.extra = true; },
  ]) expectProfileFailure(mutate);
});

test('DEFAULT-THEME-G1.0 execution topology and current tool bytes fail closed', () => {
  const changes = DEFAULT_THEME_G1_PROOF_TOOL_FILES.map((path) => `A\t${path}`);
  assert.doesNotThrow(() => assertDefaultThemeG1ExecutionTopology({
    changes,
    parents: [DEFAULT_THEME_G1_EXECUTION_PARENT],
    revision: fakeRevision,
    tree: fakeTree,
  }));
  for (const value of [
    { changes, parents: ['d'.repeat(40)], revision: fakeRevision, tree: fakeTree },
    { changes: [...changes, 'A\ttests/evidence/extra.mjs'], parents: [DEFAULT_THEME_G1_EXECUTION_PARENT], revision: fakeRevision, tree: fakeTree },
    { changes, parents: [DEFAULT_THEME_G1_EXECUTION_PARENT], revision: fakeRevision, tree: 'short' },
  ]) assert.throws(() => assertDefaultThemeG1ExecutionTopology(value), /PROFILE_INVALID/u);
  const references = DEFAULT_THEME_G1_PROOF_TOOL_FILES.map((path) => ({ path, sha256: fakeSha }));
  const exact = Object.fromEntries(references.map(({ path, sha256: digest }) => [path, digest]));
  assert.doesNotThrow(() => assertDefaultThemeG1ExecutionFiles({
    committedDigests: exact,
    currentDigests: exact,
    references,
  }));
  assert.throws(() => assertDefaultThemeG1ExecutionFiles({
    committedDigests: exact,
    currentDigests: { ...exact, [references[0].path]: `sha256:${'0'.repeat(64)}` },
    references,
  }), /proof-tool bytes/u);
});

test('DEFAULT-THEME-G1.0 evidence metadata rejects ontology procedure environment retention and result drift', () => {
  const assertionId = 'E-G1.0-01';
  const environment = { node: 'v24.19.0' };
  const retainedResults = DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].map((command) => ({
    command,
    outputSha256: fakeSha,
  }));
  const record = {
    command: DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].join(' && '),
    environment,
    evidenceKind: DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId],
    expiry: DEFAULT_THEME_G1_EXPIRY,
    retentionPolicy: DEFAULT_THEME_G1_RETENTION_POLICY,
  };
  const artifact = {
    command: record.command,
    environment,
    evidenceKind: record.evidenceKind,
    observations: { retainedResults },
  };
  assert.doesNotThrow(() => assertDefaultThemeG1EvidenceMetadata({
    artifact, assertionId, environment, expectedRetainedResults: retainedResults, record,
  }));
  for (const mutate of [
    ({ record: value }) => { value.command = 'pnpm check'; },
    ({ artifact: value }) => { value.evidenceKind = 'other'; },
    ({ record: value }) => { value.environment = { node: 'v0' }; },
    ({ record: value }) => { value.expiry = 'G1.0 human decision change'; },
    ({ record: value }) => { value.retentionPolicy = 'mutable'; },
    ({ artifact: value }) => { value.observations.retainedResults.reverse(); },
  ]) {
    const candidate = { artifact: structuredClone(artifact), record: structuredClone(record) };
    mutate(candidate);
    assert.throws(() => assertDefaultThemeG1EvidenceMetadata({
      ...candidate, assertionId, environment, expectedRetainedResults: retainedResults,
    }), /PROFILE_INVALID/u);
  }
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
    canonicalJson(DEFAULT_THEME_G1_EXPECTED_FACTS['E-G1.0-07'].bindingSpecRevisions),
  );
  const binding = button.record.bindings['native.react-native'];
  const rnw = binding.platformSafety.find(({ profile }) => profile === 'native.react-native-web');
  assert.equal(binding.runtimeProfiles['native.react-native-web'].strategy, 'unsupported');
  assert.equal(rnw.requirements.length > 0, true);
  assert.equal(rnw.requirements.every(({ disposition, reason }) => (
    disposition === 'not-applicable' && typeof reason === 'string' && reason.length > 0
  )), true);
});

test('DEFAULT-THEME-G1.0 index rejects missing, extra, duplicate, misordered, mixed, and historical topology', () => {
  assert.doesNotThrow(() => assertDefaultThemeG1IndexShape(index()));
  for (const mutate of [
    (value) => { value.unknown = true; },
    (value) => { value.records.pop(); },
    (value) => { value.records.push(structuredClone(value.records[0])); },
    (value) => { value.records.reverse(); },
    (value) => { value.records[0].assertionId = 'E-G1.0-02'; },
    (value) => { value.records[0].path = `${DEFAULT_THEME_G1_ROOT}/records/E-G1.0-02.json`; },
    (value) => { value.executedRevision = 'd'.repeat(40); },
    (value) => { value.sourceTree = 'd'.repeat(40); },
    (value) => { value.captureTimestamp = '2026-08-11T02:00:00Z'; },
    (value) => { value.recertifications.push({ path: 'legacy', sha256: fakeSha }); },
    (value) => { value.supersessions.push({ path: 'legacy', sha256: fakeSha }); },
  ]) expectIndexFailure(mutate);
});

test('DEFAULT-THEME-G1.0 capture arguments and timestamp are explicit and fail closed', () => {
  const args = [
    '--source', DEFAULT_THEME_G1_PRODUCT_SOURCE.revision,
    '--tree', DEFAULT_THEME_G1_PRODUCT_SOURCE.tree,
    '--executed', fakeRevision,
    '--executed-tree', fakeTree,
    '--timestamp', '2026-08-11T03:00:00Z',
  ];
  assert.deepEqual(parseDefaultThemeG1Arguments(args), {
    executedRevision: fakeRevision,
    executedTree: fakeTree,
    sourceRevision: DEFAULT_THEME_G1_PRODUCT_SOURCE.revision,
    sourceTree: DEFAULT_THEME_G1_PRODUCT_SOURCE.tree,
    timestamp: '2026-08-11T03:00:00Z',
  });
  assert.throws(() => parseDefaultThemeG1Arguments(args.slice(0, -2)), /ARGUMENT_INVALID/u);
  assert.throws(() => parseDefaultThemeG1Arguments([...args, '--source', fakeRevision]), /ARGUMENT_INVALID/u);
  assert.throws(() => parseDefaultThemeG1Arguments(args.toReversed().toReversed().map((value, position) => (
    position === 1 ? 'HEAD' : value
  ))), /ARGUMENT_REQUIRED/u);
  assert.doesNotThrow(() => assertTruthfulDefaultThemeG1Timestamp(
    '2026-08-11T03:00:00Z',
    '2026-08-11T02:59:30Z',
    new Date('2026-08-11T03:00:30Z'),
  ));
  for (const [value, commitTime, now] of [
    ['2026-08-11T02:59:00Z', '2026-08-11T02:59:30Z', '2026-08-11T03:00:30Z'],
    ['2026-08-11T03:01:00Z', '2026-08-11T02:59:30Z', '2026-08-11T03:00:30Z'],
    ['not-a-time', '2026-08-11T02:59:30Z', '2026-08-11T03:00:30Z'],
  ]) assert.throws(() => assertTruthfulDefaultThemeG1Timestamp(value, commitTime, new Date(now)), /TIMESTAMP_INVALID/u);
});

async function createGeneratedRoot(parent) {
  const root = join(parent, 'generated');
  const output = join(root, DEFAULT_THEME_G1_ROOT);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'marker.txt'), 'exact');
  return root;
}

async function isAbsent(path) {
  try {
    await access(path);
    return false;
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
}

test('DEFAULT-THEME-G1.0 atomic publication rejects copy, rename, and verifier failures without residue and permits retry', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-g1-profile-'));
  const destinationRoot = join(temporary, 'destination');
  await mkdir(join(destinationRoot, 'tests/evidence'), { recursive: true });
  const generatedRoot = await createGeneratedRoot(temporary);
  const destination = join(destinationRoot, DEFAULT_THEME_G1_ROOT);
  try {
    await assert.rejects(
      publishDefaultThemeG1Atomically({
        destinationRoot,
        generatedRoot: join(temporary, 'missing'),
      }),
      /ENOENT/u,
    );
    assert.equal(await isAbsent(destination), true);

    await assert.rejects(
      publishDefaultThemeG1Atomically({
        destinationRoot,
        generatedRoot,
        renameOperation: async () => { throw new Error('injected rename failure'); },
      }),
      /injected rename failure/u,
    );
    assert.equal(await isAbsent(destination), true);

    await assert.rejects(
      publishDefaultThemeG1Atomically({
        afterPublish: async () => { throw new Error('injected verifier failure'); },
        destinationRoot,
        generatedRoot,
      }),
      /injected verifier failure/u,
    );
    assert.equal(await isAbsent(destination), true);

    await publishDefaultThemeG1Atomically({
      afterPublish: async () => {
        const directories = await readdir(join(destinationRoot, 'tests/evidence'));
        assert.equal(directories.some((name) => name.startsWith('.default-theme-g1.transaction-')), false);
      },
      destinationRoot,
      generatedRoot,
    });
    assert.equal(await readFile(join(destination, 'marker.txt'), 'utf8'), 'exact');
    await rm(destination, { recursive: true, force: true });

    await publishDefaultThemeG1Atomically({ destinationRoot, generatedRoot });
    assert.equal(await readFile(join(destination, 'marker.txt'), 'utf8'), 'exact');
    await compareDefaultThemeG1Trees(generatedRoot, destinationRoot);
    await assert.rejects(
      publishDefaultThemeG1Atomically({ destinationRoot, generatedRoot }),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('DEFAULT-THEME-G1.0 validates a retained root when present and otherwise proves source-only state', async () => {
  try {
    await access(join(repositoryRoot, DEFAULT_THEME_G1_ROOT, 'index.json'));
    const result = await assertDefaultThemeG1Root(repositoryRoot);
    assert.equal(result.assertionCount, 8);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    assert.equal(await isAbsent(join(repositoryRoot, DEFAULT_THEME_G1_ROOT)), true);
  }
});
