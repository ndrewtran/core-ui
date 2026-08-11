import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../packages/schema/src/index.mjs';
import {
  DEFAULT_THEME_G11_ACCEPTANCE,
  DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
  DEFAULT_THEME_G11_ASSERTION_IDS,
  DEFAULT_THEME_G11_BROWSER_TOOLCHAIN,
  DEFAULT_THEME_G11_EVIDENCE_KINDS,
  DEFAULT_THEME_G11_EXECUTION_PARENT,
  DEFAULT_THEME_G11_EXPECTED_FACTS,
  DEFAULT_THEME_G11_EXPIRY,
  DEFAULT_THEME_G11_PRODUCT_SOURCE,
  DEFAULT_THEME_G11_PROOF_TOOL_FILES,
  DEFAULT_THEME_G11_RETAINED_COMMANDS,
  DEFAULT_THEME_G11_RETENTION_POLICY,
  DEFAULT_THEME_G11_ROOT,
  DEFAULT_THEME_G11_UPSTREAM_G1_ROOT,
  assertDefaultThemeG11EvidenceMetadata,
  assertDefaultThemeG11Environment,
  assertDefaultThemeG11ExecutionFiles,
  assertDefaultThemeG11ExecutionTopology,
  assertDefaultThemeG11IndexShape,
  assertDefaultThemeG11Profile,
  createDefaultThemeG11Profile,
} from './default-theme-g1.1-profile.mjs';
import {
  assertTruthfulDefaultThemeG11Timestamp,
  parseDefaultThemeG11Arguments,
  publishDefaultThemeG11Atomically,
} from './capture-default-theme-g1.1.mjs';

const fakeSha = `sha256:${'a'.repeat(64)}`;
const fakeRevision = 'b'.repeat(40);
const fakeTree = 'c'.repeat(40);

function profile() {
  return createDefaultThemeG11Profile({
    executedRevision: fakeRevision,
    executedTree: fakeTree,
    toolFiles: DEFAULT_THEME_G11_PROOF_TOOL_FILES.map((path) => ({ path, sha256: fakeSha })),
  });
}

function index() {
  return {
    applicabilityManifest: DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
    applicabilityProfile: profile(),
    captureTimestamp: '2026-08-11T08:00:00Z',
    disclosureClass: 'public-sanitized',
    executedRevision: fakeRevision,
    executedTree: fakeTree,
    milestone: 'G1.1',
    owner: 'ndrewtran',
    records: DEFAULT_THEME_G11_ASSERTION_IDS.map((assertionId) => ({
      assertionId,
      path: `${DEFAULT_THEME_G11_ROOT}/records/${assertionId}.json`,
      sha256: fakeSha,
    })),
    recertifications: [],
    retentionPolicy: DEFAULT_THEME_G11_RETENTION_POLICY,
    schema: 'core-ui-evidence-index-v1',
    sourceRevision: DEFAULT_THEME_G11_PRODUCT_SOURCE.revision,
    sourceTree: DEFAULT_THEME_G11_PRODUCT_SOURCE.tree,
    supersessions: [],
    validation: { path: `${DEFAULT_THEME_G11_ROOT}/validation.json`, sha256: fakeSha },
  };
}

function expectProfileFailure(mutate) {
  const value = structuredClone(profile());
  mutate(value);
  assert.throws(() => assertDefaultThemeG11Profile(value), /DEFAULT_THEME_G11_PROFILE_INVALID/u);
}

function expectIndexFailure(mutate) {
  const value = structuredClone(index());
  mutate(value);
  assert.throws(() => assertDefaultThemeG11IndexShape(value), /DEFAULT_THEME_G11_PROFILE_INVALID/u);
}

test('DEFAULT-THEME-G1.1 profile binds exact product, G1.0 acceptance, execution, and upstream evidence identities', () => {
  assert.doesNotThrow(() => assertDefaultThemeG11Profile(profile()));
  assert.equal(DEFAULT_THEME_G11_ASSERTION_IDS.length, 6);
  assert.equal(DEFAULT_THEME_G11_ACCEPTANCE.commentId, 5250457646);
  assert.equal(typeof DEFAULT_THEME_G11_ACCEPTANCE.commentId, 'number');
  assert.equal(DEFAULT_THEME_G11_ACCEPTANCE.pullRequestNumber, 52);
  assert.equal(DEFAULT_THEME_G11_ACCEPTANCE.indexSha256, DEFAULT_THEME_G11_UPSTREAM_G1_ROOT.sha256);
  assert.equal(DEFAULT_THEME_G11_APPLICABILITY_MANIFEST.sha256, 'sha256:0a730086a7104d577968d4b490372cb410548fff0592571230e41a90eb1abf0e');
  assert.equal(Object.keys(DEFAULT_THEME_G11_EXPECTED_FACTS).length, 6);
});

test('DEFAULT-THEME-G1.1 profile rejects unknown, missing, substituted, coerced, and edited identity', () => {
  for (const mutate of [
    (value) => { value.unknown = true; },
    (value) => { delete value.acceptance; },
    (value) => { value.productSource.revision = 'd'.repeat(40); },
    (value) => { value.execution.revision = 'short'; },
    (value) => { value.execution.files.reverse(); },
    (value) => { value.execution.files[0].sha256 = 'sha256:short'; },
    (value) => { value.upstreamG1Root.path = 'tests/evidence/g1.0/index.json'; },
    (value) => { value.applicabilityManifest.paths.reverse(); },
    (value) => { value.applicabilityManifest.sha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.assertionIds.reverse(); },
    (value) => { value.assertionIds.push('E-G1.1-07'); },
    (value) => { value.acceptance.provider = 'gitlab'; },
    (value) => { value.acceptance.repository = 'other/core-ui'; },
    (value) => { value.acceptance.pullRequestNumber = 51; },
    (value) => { value.acceptance.outcome = 'pending'; },
    (value) => { value.acceptance.ownerNodeId = value.acceptance.commentNodeId; },
    (value) => { value.acceptance.commentNodeId = value.acceptance.ownerNodeId; },
    (value) => { value.acceptance.commentId = String(value.acceptance.commentId); },
    (value) => { value.acceptance.authorAssociation = 'MEMBER'; },
    (value) => { value.acceptance.createdAt = '2026-08-11T08:00:00Z'; },
    (value) => { value.acceptance.updatedAt = '2026-08-11T08:00:00Z'; },
    (value) => { value.acceptance.bodySha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.acceptance.acceptedPacket.id = 'other'; },
    (value) => { value.acceptance.indexSha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.acceptance.extra = true; },
  ]) expectProfileFailure(mutate);
});

test('DEFAULT-THEME-G1.1 execution topology and current tool bytes fail closed', () => {
  const changes = DEFAULT_THEME_G11_PROOF_TOOL_FILES.map((path) => `A\t${path}`);
  assert.doesNotThrow(() => assertDefaultThemeG11ExecutionTopology({
    changes,
    parents: [DEFAULT_THEME_G11_EXECUTION_PARENT],
    revision: fakeRevision,
    tree: fakeTree,
  }));
  for (const value of [
    { changes, parents: ['d'.repeat(40)], revision: fakeRevision, tree: fakeTree },
    { changes: [...changes, 'A\ttests/evidence/extra.mjs'], parents: [DEFAULT_THEME_G11_EXECUTION_PARENT], revision: fakeRevision, tree: fakeTree },
    { changes, parents: [DEFAULT_THEME_G11_EXECUTION_PARENT], revision: fakeRevision, tree: 'short' },
  ]) assert.throws(() => assertDefaultThemeG11ExecutionTopology(value), /PROFILE_INVALID/u);
  const references = DEFAULT_THEME_G11_PROOF_TOOL_FILES.map((path) => ({ path, sha256: fakeSha }));
  const exact = Object.fromEntries(references.map(({ path, sha256 }) => [path, sha256]));
  assert.doesNotThrow(() => assertDefaultThemeG11ExecutionFiles({
    committedDigests: exact,
    currentDigests: exact,
    references,
  }));
  assert.throws(() => assertDefaultThemeG11ExecutionFiles({
    committedDigests: exact,
    currentDigests: { ...exact, [references[0].path]: `sha256:${'0'.repeat(64)}` },
    references,
  }), /proof-tool bytes/u);
});

test('DEFAULT-THEME-G1.1 evidence metadata rejects ontology procedure environment retention and result drift', () => {
  const assertionId = 'E-G1.1-01';
  const environment = { node: 'v24.19.0' };
  const retainedResults = DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].map((command) => ({
    command,
    outputSha256: fakeSha,
  }));
  const record = {
    activeExceptionRefs: [],
    advisoryRefs: [],
    command: DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].join(' && '),
    environment,
    evidenceKind: DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId],
    expiry: DEFAULT_THEME_G11_EXPIRY,
    retentionPolicy: DEFAULT_THEME_G11_RETENTION_POLICY,
  };
  const artifact = {
    command: record.command,
    environment,
    evidenceKind: record.evidenceKind,
    observations: { retainedResults },
  };
  assert.doesNotThrow(() => assertDefaultThemeG11EvidenceMetadata({
    artifact, assertionId, environment, expectedRetainedResults: retainedResults, record,
  }));
  for (const mutate of [
    ({ record: value }) => { value.command = 'pnpm check'; },
    ({ artifact: value }) => { value.evidenceKind = 'other'; },
    ({ record: value }) => { value.environment = { node: 'v0' }; },
    ({ record: value }) => { value.expiry = 'G1.1 human decision change'; },
    ({ record: value }) => { value.retentionPolicy = 'mutable'; },
    ({ record: value }) => { value.activeExceptionRefs = ''; },
    ({ record: value }) => { value.advisoryRefs = { length: 0 }; },
    ({ artifact: value }) => { value.observations.retainedResults.reverse(); },
  ]) {
    const candidate = { artifact: structuredClone(artifact), record: structuredClone(record) };
    mutate(candidate);
    assert.throws(() => assertDefaultThemeG11EvidenceMetadata({
      ...candidate, assertionId, environment, expectedRetainedResults: retainedResults,
    }), /PROFILE_INVALID/u);
  }
});

test('DEFAULT-THEME-G1.1 environment binds the browser executable and exact test toolchain', () => {
  const value = {
    architecture: 'arm64',
    axe: DEFAULT_THEME_G11_BROWSER_TOOLCHAIN.axe,
    browser: 'Google Chrome 151.0.7922.77',
    browserExecutableSha256: fakeSha,
    browserResolution: 'system-google-chrome',
    git: '2.50.1',
    node: 'v24.19.0',
    playwright: DEFAULT_THEME_G11_BROWSER_TOOLCHAIN.playwright,
    pnpm: '10.33.0',
    runnerImage: 'local-macos-26.0',
    runnerImageVersion: '25A354',
    runnerOs: 'macOS 26.0',
  };
  assert.doesNotThrow(() => assertDefaultThemeG11Environment(value));
  for (const mutate of [
    (candidate) => { candidate.browser = 'Google Chrome mutable'; },
    (candidate) => { candidate.browserExecutableSha256 = 'sha256:short'; },
    (candidate) => { candidate.browserResolution = 'channel-chrome'; },
    (candidate) => { candidate.playwright = 'latest'; },
    (candidate) => { candidate.axe = 'latest'; },
    (candidate) => { candidate.browserPath = '/Applications/Google Chrome.app'; },
  ]) {
    const candidate = structuredClone(value);
    mutate(candidate);
    assert.throws(() => assertDefaultThemeG11Environment(candidate), /PROFILE_INVALID/u);
  }
});

test('DEFAULT-THEME-G1.1 facts remain closed to the six roadmap assertions and explicit nonclaims', () => {
  assert.deepEqual(Object.keys(DEFAULT_THEME_G11_EXPECTED_FACTS), DEFAULT_THEME_G11_ASSERTION_IDS);
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-01'].controllerState, 'disabled');
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-02'].compilerExported, false);
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-03'].negativePaths.length, 5);
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-04'].hydrationMarkupMutation, false);
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-05'].webStyleSourceCopied, false);
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-06'].componentSupportClaim, 'none');
  assert.equal(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-06'].requiredAssertions.length, 3);
});

test('DEFAULT-THEME-G1.1 index rejects missing, extra, duplicate, misordered, mixed, and historical topology', () => {
  assert.doesNotThrow(() => assertDefaultThemeG11IndexShape(index()));
  for (const mutate of [
    (value) => { value.unknown = true; },
    (value) => { value.records.pop(); },
    (value) => { value.records.push(structuredClone(value.records[0])); },
    (value) => { value.records.reverse(); },
    (value) => { value.records[0].assertionId = 'E-G1.1-02'; },
    (value) => { value.records[0].path = `${DEFAULT_THEME_G11_ROOT}/records/E-G1.1-02.json`; },
    (value) => { value.executedRevision = 'd'.repeat(40); },
    (value) => { value.sourceTree = 'd'.repeat(40); },
    (value) => { value.captureTimestamp = '2026-08-11T07:00:00Z'; },
    (value) => { value.recertifications.push({ path: 'legacy', sha256: fakeSha }); },
    (value) => { value.supersessions.push({ path: 'legacy', sha256: fakeSha }); },
  ]) expectIndexFailure(mutate);
});

test('DEFAULT-THEME-G1.1 capture arguments and timestamp are explicit and fail closed', () => {
  const args = [
    '--source', DEFAULT_THEME_G11_PRODUCT_SOURCE.revision,
    '--tree', DEFAULT_THEME_G11_PRODUCT_SOURCE.tree,
    '--executed', fakeRevision,
    '--executed-tree', fakeTree,
    '--timestamp', '2026-08-11T08:00:00Z',
  ];
  assert.deepEqual(parseDefaultThemeG11Arguments(args), {
    executedRevision: fakeRevision,
    executedTree: fakeTree,
    sourceRevision: DEFAULT_THEME_G11_PRODUCT_SOURCE.revision,
    sourceTree: DEFAULT_THEME_G11_PRODUCT_SOURCE.tree,
    timestamp: '2026-08-11T08:00:00Z',
  });
  assert.throws(() => parseDefaultThemeG11Arguments(args.slice(0, -2)), /ARGUMENT_INVALID/u);
  assert.throws(() => parseDefaultThemeG11Arguments([...args, '--source', fakeRevision]), /ARGUMENT_INVALID/u);
  assert.doesNotThrow(() => assertTruthfulDefaultThemeG11Timestamp(
    '2026-08-11T08:00:00Z',
    '2026-08-11T07:55:00Z',
    new Date('2026-08-11T08:05:00Z'),
  ));
  assert.throws(() => assertTruthfulDefaultThemeG11Timestamp(
    '2026-08-11T07:00:00Z',
    '2026-08-11T07:55:00Z',
    new Date('2026-08-11T08:05:00Z'),
  ), /TIMESTAMP_INVALID/u);
});

async function generatedRoot(parent) {
  const root = join(parent, 'generated');
  const output = join(root, DEFAULT_THEME_G11_ROOT);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'marker.txt'), 'exact');
  return root;
}

async function absent(path) {
  try {
    await access(path);
    return false;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return true;
  }
}

test('DEFAULT-THEME-G1.1 atomic publication rolls verifier and rename failure back and permits retry', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-g11-atomic-'));
  const destinationRoot = join(temporary, 'repository');
  const destination = join(destinationRoot, DEFAULT_THEME_G11_ROOT);
  await mkdir(join(destinationRoot, 'tests/evidence'), { recursive: true });
  const generated = await generatedRoot(temporary);
  try {
    await assert.rejects(publishDefaultThemeG11Atomically({
      destinationRoot,
      generatedRoot: generated,
      renameOperation: async () => { throw new Error('rename denied'); },
    }), /rename denied/u);
    assert.equal(await absent(destination), true);
    await assert.rejects(publishDefaultThemeG11Atomically({
      afterPublish: async () => { throw new Error('verifier denied'); },
      destinationRoot,
      generatedRoot: generated,
    }), /verifier denied/u);
    assert.equal(await absent(destination), true);
    await assert.rejects(publishDefaultThemeG11Atomically({
      afterPublish: async () => { throw new Error('verifier denied before rollback failure'); },
      destinationRoot,
      generatedRoot: generated,
      rollbackRenameOperation: async () => { throw new Error('rollback rename denied'); },
    }), (error) => (
      /DEFAULT_THEME_G11_ROLLBACK_INTEGRITY/u.test(error.message)
      && /verifier denied before rollback failure/u.test(error.message)
      && /rollback rename denied/u.test(error.message)
      && error.cause?.message === 'verifier denied before rollback failure'
    ));
    assert.equal(await absent(destination), true);
    await publishDefaultThemeG11Atomically({ destinationRoot, generatedRoot: generated });
    assert.equal(await readFile(join(destination, 'marker.txt'), 'utf8'), 'exact');
    assert.deepEqual((await readFile(join(destination, 'marker.txt'), 'utf8')), 'exact');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('DEFAULT-THEME-G1.1 constants serialize deterministically', () => {
  assert.equal(typeof canonicalJson({
    acceptance: DEFAULT_THEME_G11_ACCEPTANCE,
    facts: DEFAULT_THEME_G11_EXPECTED_FACTS,
    upstream: DEFAULT_THEME_G11_UPSTREAM_G1_ROOT,
  }), 'string');
});
