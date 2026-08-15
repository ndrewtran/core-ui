import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { nativeThemeProjection } from '../../packages/react-native/generated/native-themes.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  G12_ASSERTIONS,
  G12_EVIDENCE_KINDS,
  G12_EXPECTED_TEST_NAMES,
  G12_NONCLAIMS,
  createG12Facts,
  pathManifestAtRevision,
} from './g1.2-profile.mjs';
import {
  DEFAULT_THEME_G10_V2_ROOT,
  assertDefaultThemeG10V2Root,
} from './default-theme-g1.0-v2-profile.mjs';
import {
  DEFAULT_THEME_G11_V2_ROOT,
  assertDefaultThemeG11V2Root,
} from './default-theme-g1.1-v2-profile.mjs';

const execFile = promisify(execFileCallback);

export {
  G12_ASSERTIONS as G12_V2_ASSERTION_IDS,
  G12_EVIDENCE_KINDS as G12_V2_EVIDENCE_KINDS,
  G12_EXPECTED_TEST_NAMES as G12_V2_EXPECTED_TEST_NAMES,
  G12_NONCLAIMS as G12_V2_NONCLAIMS,
  pathManifestAtRevision,
};

export const G12_V2_ROOT = 'tests/evidence/g1.2-v2';
export const G12_V2_SCHEMA = 'core-ui-g1-2-evidence-profile-v2';
export const G12_V2_PRODUCT_SOURCE = Object.freeze({
  revision: '35f1e8d9cd451c30937a15d50ad730d7c109516a',
  tree: '85fea37de31d839219cfef8d3d21cd3fb68b8c94',
});
export const G12_V2_PROOF_FILES = Object.freeze([
  'tests/evidence/capture-g1.2-v2.mjs',
  'tests/evidence/g1.2-v2-profile.mjs',
  'tests/evidence/g1.2-v2-profile.test.mjs',
  'tooling/audits/repository-policy/src/evidence-verify.mjs',
  'tooling/audits/repository-policy/test/g1.2-v2.test.mjs',
]);

export const G12_V2_UPSTREAM_G10 = Object.freeze({
  acceptedPacketSha256: 'sha256:59195089cbe2994bb2ad5469e0268bc897e702f365610c45c546907c130ca85b',
  authorAssociation: 'OWNER',
  captureTimestamp: '2026-08-15T06:51:59Z',
  commentId: 5301472350,
  createdAt: '2026-08-15T08:54:42Z',
  decisionOwner: 'ndrewtran',
  evidenceRevision: '0be26f2bfc2b29015502ae65e3196cf22ebc652d',
  evidenceTree: '528ae016547593212c40b31c08166a5f9769f0c8',
  executedRevision: '746162eea6dd7b4b5e85202383b7cd09e724632a',
  executedTree: 'e62f475fc45567827eba077e2f0a3d8250eed169',
  index: Object.freeze({
    path: `${DEFAULT_THEME_G10_V2_ROOT}/index.json`,
    sha256: 'sha256:38ff3a1e20bc3215737b9e6e4043d394cac0f2a2dbf324b6faae371b832aceba',
  }),
  mergeRevision: 'd45f52a241624c9ff6a08638684720e9d31842a5',
  outcome: 'accepted',
  productRevision: '35676452ca44f4abb64c6211e05424361f9a6896',
  productTree: '03571985cc16305f6e4cff2cdce219e161237636',
  pullRequestNumber: 68,
  repository: 'ndrewtran/core-ui',
  url: 'https://github.com/ndrewtran/core-ui/issues/67#issuecomment-5301472350',
});

export const G12_V2_UPSTREAM_G11 = Object.freeze({
  acceptedPacketSha256: 'sha256:069d8f40eefed6b62cb990f044713b679d56c0a76991c259abcbe3f4f3912f4c',
  authorAssociation: 'OWNER',
  captureTimestamp: '2026-08-15T12:13:06Z',
  commentId: 5302695194,
  createdAt: '2026-08-15T14:34:56Z',
  decisionOwner: 'ndrewtran',
  evidenceRevision: '8f574a565ec079a8a37c8072dca6ec915b860e0b',
  evidenceTree: '85fea37de31d839219cfef8d3d21cd3fb68b8c94',
  executedRevision: '68bfe3a66de3607015111377913eaede56335e91',
  executedTree: '9943db6c446e20d2033c4d30b2626e724248b99c',
  index: Object.freeze({
    path: `${DEFAULT_THEME_G11_V2_ROOT}/index.json`,
    sha256: 'sha256:8e293d7be0bb80c41031b09c6f19e6745e05e3022d68270df403110e79dedc80',
  }),
  mergeRevision: G12_V2_PRODUCT_SOURCE.revision,
  outcome: 'accepted',
  productRevision: 'd45f52a241624c9ff6a08638684720e9d31842a5',
  productTree: '528ae016547593212c40b31c08166a5f9769f0c8',
  pullRequestNumber: 70,
  repository: 'ndrewtran/core-ui',
  url: 'https://github.com/ndrewtran/core-ui/issues/69#issuecomment-5302695194',
});

// Product and authority inputs exclude the proof route itself. The bytes must
// be identical at the product source and the reviewed proof-tool checkout.
export const G12_V2_APPLICABILITY_PATHS = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'strategy/monorepo-architecture.md',
  'strategy/milestone-roadmap.md',
  'strategy/product-scope.md',
  'strategy/platform-safety-contract.json',
  'decisions/0001-workspace-runtime-and-repository-policy.md',
  'decisions/0002-tale-token-authority.json',
  'decisions/0003-tale-token-classification-annex.json',
  'decisions/0003-tale-token-classification-acceptance.json',
  'decisions/0004-tale-only-reference-baseline-annex.json',
  'decisions/0004-tale-only-reference-baseline-acceptance.json',
  'decisions/0005-default-theme-token-source-identity.json',
  'decisions/0005-default-theme-token-source-identity-acceptance.json',
  'decisions/0006-phase-c-applicability-topology.json',
  'decisions/0006-phase-c-applicability-topology-acceptance.json',
  'decisions/0007-delivery-workflow-authority.json',
  'decisions/0007-delivery-workflow-authority-acceptance.json',
  'decisions/0008-g1-2-applicability-continuity.json',
  'decisions/0008-g1-2-applicability-continuity-acceptance.json',
  'decisions/0009-delivery-review-readiness.json',
  'decisions/0009-delivery-review-readiness-acceptance.json',
  'decisions/0009-amendment-01-descendant-source-resolution.md',
  'decisions/0009-amendment-01-descendant-source-resolution-acceptance.md',
  'decisions/0009-amendment-01-implementation-clarification.md',
  'decisions/0010-react-and-native-default-starting-points.md',
  'catalog',
  'packages/catalog',
  'packages/foundation',
  'packages/react-native',
  'packages/schema',
  'packages/tokens',
  'packages/tooling',
  'tests/fixtures/g0.4',
  'tests/fixtures/g1.0',
  'tests/fixtures/g1.2',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
]);

export const G12_V2_VALIDATION_COMMANDS = Object.freeze([
  'node --test tests/evidence/g1.2-v2-profile.test.mjs',
  'pnpm --filter @core-ui/react-native check',
  'pnpm --filter @core-ui/react-native exec jest --config test/jest.config.cjs --runInBand --json',
  'pnpm generate:check',
  'pnpm test:agent',
  'pnpm release:prepare',
  'node tooling/audits/repository-policy/src/evidence-verify.mjs',
  'pnpm check',
  'pnpm check:all',
]);
export const G12_V2_RESULT_KEYS = Object.freeze([
  'profile', 'react-native', 'native-jest', 'generation', 'agent', 'release', 'evidence', 'check', 'check-all',
]);
export const G12_V2_RETAINED_COMMANDS = Object.freeze({
  'E-G1.2-01': Object.freeze([G12_V2_VALIDATION_COMMANDS[0], G12_V2_VALIDATION_COMMANDS[1]]),
  'E-G1.2-02': Object.freeze([G12_V2_VALIDATION_COMMANDS[0], G12_V2_VALIDATION_COMMANDS[1], G12_V2_VALIDATION_COMMANDS[2]]),
  'E-G1.2-03': Object.freeze([G12_V2_VALIDATION_COMMANDS[0], G12_V2_VALIDATION_COMMANDS[1]]),
  'E-G1.2-04': Object.freeze([G12_V2_VALIDATION_COMMANDS[0], G12_V2_VALIDATION_COMMANDS[1], G12_V2_VALIDATION_COMMANDS[3]]),
  'E-G1.2-05': Object.freeze([G12_V2_VALIDATION_COMMANDS[0], G12_V2_VALIDATION_COMMANDS[1]]),
});
export const G12_V2_DISCLOSURE = 'public-sanitized';
export const G12_V2_RETENTION = 'Content-addressed Git records retained by the evidence pull request and default-branch history after merge; issues and the Delivery Project are mutable locators';
export const G12_V2_EXPIRY = 'Any accepted product source/tree, current G1.0 or G1.1 root or acceptance, applicability path, proof-tool byte, environment tuple, retained result, or human acceptance change';

const gitObject = /^[0-9a-f]{40}$/u;
const shaReference = /^sha256:[0-9a-f]{64}$/u;
const captureTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function fail(message) {
  throw new Error(`G12_V2_PROFILE_INVALID: ${message}`);
}

function prefixed(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

async function git(root, args, encoding = 'utf8') {
  return (await execFile('git', args, { cwd: root, encoding, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

async function readCanonical(root, relativePath) {
  const bytes = await readFile(join(root, relativePath), 'utf8');
  const value = parseJsonStrict(bytes);
  if (bytes !== canonicalJson(value)) fail(`${relativePath} is not canonical JSON`);
  return { bytes, value };
}

async function verifyReference(root, reference) {
  const result = await readCanonical(root, reference.path);
  if (prefixed(result.bytes) !== reference.sha256) fail(`${reference.path} digest mismatch`);
  return result.value;
}

async function listFiles(root, relative = '') {
  const output = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(root, path));
    else output.push(path);
  }
  return output.sort();
}

export function assertG12V2DirectoryNames(names, reject = fail) {
  const candidates = names.filter((name) => name.startsWith('g1.2-v2'));
  if (candidates.length === 0) return false;
  if (canonicalJson(candidates) !== canonicalJson(['g1.2-v2'])) reject('must contain exactly one current G1.2 v2 root');
  return true;
}

export function g12V2CaptureProcedure(values) {
  return [
    'node tests/evidence/capture-g1.2-v2.mjs',
    `--source ${values.sourceRevision}`,
    `--tree ${values.sourceTree}`,
    `--executed ${values.executedRevision}`,
    `--executed-tree ${values.executedTree}`,
    `--timestamp ${values.timestamp}`,
  ].join(' ');
}

export function createG12V2Profile({ manifest, executedRevision, executedTree, toolFiles }) {
  return {
    applicabilityManifest: manifest,
    assertionIds: G12_ASSERTIONS,
    componentSupportClaim: 'none',
    execution: { files: toolFiles, revision: executedRevision, tree: executedTree },
    id: 'G1.2-REACT-NATIVE-SUBSTRATE-V2',
    nonclaims: G12_NONCLAIMS,
    platformBoundary: {
      android: 'Jest-hosted JavaScript adapter and validation-profile observation only',
      ios: 'Jest-hosted JavaScript adapter and validation-profile observation only',
      reactNativeWeb: 'unsupported',
    },
    productSource: G12_V2_PRODUCT_SOURCE,
    schema: G12_V2_SCHEMA,
    upstreamG10: G12_V2_UPSTREAM_G10,
    upstreamG11: G12_V2_UPSTREAM_G11,
  };
}

export function assertG12V2SourceTopology({ changes, parents, revision, tree }, reject = fail) {
  const expected = G12_V2_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`).sort();
  if (!gitObject.test(revision) || !gitObject.test(tree)
    || canonicalJson(parents) !== canonicalJson([G12_V2_PRODUCT_SOURCE.revision])
    || canonicalJson([...changes].sort()) !== canonicalJson(expected)) {
    reject('executed source must be the sole-parent exact five-path proof-tool child');
  }
  return { revision, tree };
}

export function hasUnsanitizedG12V2Output(text, root) {
  const withoutPublicTokenIds = text.replace(/"core:token:[a-z0-9]+(?:-[a-z0-9]+)*"/gu, '"core:<public-token-id>"');
  return withoutPublicTokenIds.includes(root)
    || /\/(?:Users|Volumes|home|root|tmp|private(?:\/(?:tmp|var\/folders))?|var\/folders)\//u.test(withoutPublicTokenIds)
    || /(?:authorization|api[-_]?key|token)\s*[:=]\s*\S+/iu.test(withoutPublicTokenIds);
}

export function assertG12V2Environment(value, reject = fail) {
  const keys = ['architecture', 'git', 'node', 'pnpm', 'runnerImage', 'runnerImageVersion', 'runnerOs'];
  if (!exactKeys(value, keys) || value.node !== 'v24.19.0' || value.pnpm !== '10.33.0'
    || !value.architecture || !value.git || !value.runnerImage || !value.runnerImageVersion || !value.runnerOs) {
    reject('environment identity');
  }
  return value;
}

export async function proofToolIdentityAtRevision(root, revision, tree) {
  const files = [];
  for (const path of G12_V2_PROOF_FILES) files.push({ path, sha256: prefixed(await git(root, ['show', `${revision}:${path}`], 'buffer')) });
  return { files, revision, tree };
}

export function assertG12V2Upstream(reference, expected, label, reject = fail) {
  if (canonicalJson(reference) !== canonicalJson(expected)) reject(`${label} must bind the exact accepted current root and owner acceptance`);
  return reference;
}

export async function assertG12V2CurrentDependencies(root) {
  for (const [label, upstream] of [['G1.0', G12_V2_UPSTREAM_G10], ['G1.1', G12_V2_UPSTREAM_G11]]) {
    assertG12V2Upstream(upstream, upstream, label);
    if (prefixed(await readFile(join(root, upstream.index.path))) !== upstream.index.sha256) fail(`${upstream.index.path} does not match accepted current ${label}`);
  }
  await assertDefaultThemeG10V2Root(root, {
    executedRevision: G12_V2_UPSTREAM_G10.executedRevision,
    executedTree: G12_V2_UPSTREAM_G10.executedTree,
    sourceRevision: G12_V2_UPSTREAM_G10.productRevision,
    sourceTree: G12_V2_UPSTREAM_G10.productTree,
    timestamp: G12_V2_UPSTREAM_G10.captureTimestamp,
  });
  await assertDefaultThemeG11V2Root(root, {
    executedRevision: G12_V2_UPSTREAM_G11.executedRevision,
    executedTree: G12_V2_UPSTREAM_G11.executedTree,
    sourceRevision: G12_V2_UPSTREAM_G11.productRevision,
    sourceTree: G12_V2_UPSTREAM_G11.productTree,
    timestamp: G12_V2_UPSTREAM_G11.captureTimestamp,
  });
}

export async function expectedG12V2Facts(root) {
  const fixture = parseJsonStrict(await readFile(join(root, 'tests/fixtures/g1.2/platform-safety-native.json'), 'utf8'));
  const packageManifest = parseJsonStrict(await readFile(join(root, 'packages/react-native/package.json'), 'utf8'));
  return createG12Facts({ fixture, nativeProjection: nativeThemeProjection, packageManifest });
}

export async function assertG12V2CommitTopology(root, expected, { allowUncommitted = false } = {}) {
  const sourceTree = (await git(root, ['rev-parse', `${expected.executedRevision}^{tree}`])).trim();
  if (sourceTree !== expected.executedTree) fail('executed revision/tree mismatch');
  const revisionLine = (await git(root, ['rev-list', '--parents', '-n', '1', expected.executedRevision])).trim().split(' ');
  const sourceChanges = (await git(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', expected.executedRevision])).trim().split('\n').filter(Boolean);
  assertG12V2SourceTopology({ changes: sourceChanges, parents: revisionLine.slice(1), revision: revisionLine[0], tree: sourceTree });
  const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
  if (allowUncommitted && head === expected.executedRevision) return { sourceRevision: expected.executedRevision, state: 'uncommitted-capture' };
  const indexPath = `${G12_V2_ROOT}/index.json`;
  const additions = (await git(root, ['log', '--full-history', '--format=%H', '--diff-filter=A', 'HEAD', '--', indexPath])).trim().split('\n').filter(Boolean);
  if (new Set(additions).size !== 1) fail('root must have one reachable introduction commit');
  const evidenceRevision = additions[0];
  const parents = (await git(root, ['show', '-s', '--format=%P', evidenceRevision])).trim().split(' ').filter(Boolean);
  if (canonicalJson(parents) !== canonicalJson([expected.executedRevision])) fail('evidence commit must be the sole child of executed source');
  const changed = (await git(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', evidenceRevision])).trim().split('\n').filter(Boolean);
  if (changed.length === 0 || changed.some((line) => !line.startsWith(`A\t${G12_V2_ROOT}/`))) fail('evidence commit must add only the v2 root');
  const introduced = (await git(root, ['rev-parse', `${evidenceRevision}:${G12_V2_ROOT}`])).trim();
  const current = (await git(root, ['rev-parse', `HEAD:${G12_V2_ROOT}`])).trim();
  if (introduced !== current) fail('v2 root must remain byte-identical to introduction');
  return { evidenceRevision, sourceRevision: expected.executedRevision, state: 'committed' };
}

export function assertG12V2EvidenceNodeRelations({
  artifact,
  assertionId,
  command,
  environment,
  expectedFacts,
  index,
  record,
  retainedResults,
}, reject = fail) {
  const recordKeys = [
    'activeExceptionRefs', 'advisoryRefs', 'applicabilityManifest', 'applicabilityProfile',
    'artifact', 'assertionId', 'captureTimestamp', 'command', 'disclosureClass',
    'environment', 'evidenceKind', 'executedRevision', 'executedTree', 'expiry',
    'milestone', 'outcome', 'owner', 'retentionPolicy', 'schema', 'sourceRevision',
    'sourceTree', 'validation',
  ];
  const artifactKeys = [
    'applicabilityManifest', 'applicabilityProfile', 'assertionId', 'captureTimestamp',
    'command', 'environment', 'evidenceKind', 'executedRevision', 'executedTree',
    'exitState', 'observations', 'outcome', 'schema', 'sourceRevision', 'sourceTree',
  ];
  if (!exactKeys(record, recordKeys) || !exactKeys(artifact, artifactKeys)
    || !exactKeys(record.artifact, ['path', 'sha256'])
    || !exactKeys(artifact.observations, ['facts', 'retainedResults', 'testNames'])
    || !Array.isArray(artifact.observations.retainedResults)
    || artifact.observations.retainedResults.some((result) => (
      !exactKeys(result, ['command', 'outputSha256']) || !shaReference.test(result.outputSha256)
    ))
    || record.schema !== 'core-ui-evidence-record-v1'
    || artifact.schema !== 'core-ui-evidence-artifact-v1'
    || record.assertionId !== assertionId || artifact.assertionId !== assertionId
    || record.artifact.path !== `${G12_V2_ROOT}/artifacts/${assertionId}.json`
    || !shaReference.test(record.artifact.sha256)
    || record.evidenceKind !== G12_EVIDENCE_KINDS[assertionId]
    || artifact.evidenceKind !== record.evidenceKind
    || record.captureTimestamp !== index.captureTimestamp
    || artifact.captureTimestamp !== index.captureTimestamp
    || record.sourceRevision !== index.sourceRevision || artifact.sourceRevision !== index.sourceRevision
    || record.sourceTree !== index.sourceTree || artifact.sourceTree !== index.sourceTree
    || record.executedRevision !== index.executedRevision || artifact.executedRevision !== index.executedRevision
    || record.executedTree !== index.executedTree || artifact.executedTree !== index.executedTree
    || canonicalJson(record.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
    || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
    || canonicalJson(record.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
    || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
    || canonicalJson(record.validation) !== canonicalJson(index.validation)
    || canonicalJson(record.environment) !== canonicalJson(environment)
    || canonicalJson(artifact.environment) !== canonicalJson(environment)
    || record.command !== command || artifact.command !== command
    || record.disclosureClass !== G12_V2_DISCLOSURE
    || record.retentionPolicy !== G12_V2_RETENTION || record.expiry !== G12_V2_EXPIRY
    || record.milestone !== 'G1.2' || record.owner !== 'ndrewtran'
    || record.outcome !== 'pass' || artifact.outcome !== 'pass' || artifact.exitState !== 0
    || canonicalJson(record.activeExceptionRefs) !== '[]' || canonicalJson(record.advisoryRefs) !== '[]'
    || canonicalJson(artifact.observations.facts) !== canonicalJson(expectedFacts[assertionId])
    || canonicalJson(artifact.observations.testNames) !== canonicalJson(G12_EXPECTED_TEST_NAMES[assertionId])
    || canonicalJson(artifact.observations.retainedResults) !== canonicalJson(retainedResults)) {
    reject(`${assertionId} proof relation`);
  }
  return { artifact, record };
}

export async function assertG12V2Root(root, expected, options = {}) {
  const index = (await readCanonical(root, `${G12_V2_ROOT}/index.json`)).value;
  const manifest = await pathManifestAtRevision(root, G12_V2_PRODUCT_SOURCE.revision, G12_V2_APPLICABILITY_PATHS);
  const expectedFiles = [
    'index.json', 'validation.json',
    ...G12_V2_RESULT_KEYS.map((key) => `validation/${key}.txt`),
    ...G12_ASSERTIONS.map((id) => `artifacts/${id}.json`),
    ...G12_ASSERTIONS.map((id) => `records/${id}.json`),
  ].sort();
  if (canonicalJson(await listFiles(join(root, G12_V2_ROOT))) !== canonicalJson(expectedFiles)) fail('root file set is not exact');
  if (!exactKeys(index, ['applicabilityManifest', 'applicabilityProfile', 'captureTimestamp', 'disclosureClass', 'executedRevision', 'executedTree', 'milestone', 'owner', 'records', 'recertifications', 'retentionPolicy', 'schema', 'sourceRevision', 'sourceTree', 'supersessions', 'validation'])
    || index.schema !== 'core-ui-evidence-index-v1' || index.milestone !== 'G1.2' || index.owner !== 'ndrewtran'
    || index.disclosureClass !== G12_V2_DISCLOSURE || index.retentionPolicy !== G12_V2_RETENTION
    || index.sourceRevision !== G12_V2_PRODUCT_SOURCE.revision || index.sourceTree !== G12_V2_PRODUCT_SOURCE.tree
    || index.executedRevision !== expected.executedRevision || index.executedTree !== expected.executedTree
    || index.captureTimestamp !== expected.timestamp || !captureTimestamp.test(index.captureTimestamp)
    || canonicalJson(index.applicabilityManifest) !== canonicalJson(manifest)
    || !Array.isArray(index.records) || index.records.length !== G12_ASSERTIONS.length
    || index.records.some((reference, position) => (
      !exactKeys(reference, ['assertionId', 'path', 'sha256'])
      || reference.assertionId !== G12_ASSERTIONS[position]
      || reference.path !== `${G12_V2_ROOT}/records/${reference.assertionId}.json`
      || !shaReference.test(reference.sha256)
    ))
    || !exactKeys(index.validation, ['path', 'sha256'])
    || index.validation.path !== `${G12_V2_ROOT}/validation.json`
    || !shaReference.test(index.validation.sha256)
    || canonicalJson(index.recertifications) !== '[]' || canonicalJson(index.supersessions) !== '[]') fail('index identity');
  const proofTool = await proofToolIdentityAtRevision(root, expected.executedRevision, expected.executedTree);
  const expectedProfile = createG12V2Profile({ manifest, executedRevision: expected.executedRevision, executedTree: expected.executedTree, toolFiles: proofTool.files });
  if (canonicalJson(index.applicabilityProfile) !== canonicalJson(expectedProfile)) fail('profile identity');
  const validation = await verifyReference(root, index.validation);
  if (!exactKeys(validation, ['applicabilityProfile', 'captureProcedure', 'environment', 'executedRevision', 'executedTree', 'proofTool', 'results', 'schema', 'sourceRevision', 'sourceTree'])
    || validation.schema !== 'core-ui-evidence-validation-v1'
    || canonicalJson(validation.applicabilityProfile) !== canonicalJson(expectedProfile)
    || canonicalJson(validation.proofTool) !== canonicalJson(proofTool)
    || validation.sourceRevision !== index.sourceRevision || validation.sourceTree !== index.sourceTree
    || validation.executedRevision !== index.executedRevision || validation.executedTree !== index.executedTree
    || validation.captureProcedure !== g12V2CaptureProcedure({ ...expected, sourceRevision: index.sourceRevision, sourceTree: index.sourceTree })
    || !Array.isArray(validation.results)
    || canonicalJson(validation.results.map(({ command }) => command)) !== canonicalJson(G12_V2_VALIDATION_COMMANDS)) fail('validation identity');
  for (const [position, result] of validation.results.entries()) {
    const key = G12_V2_RESULT_KEYS[position];
    if (!exactKeys(result, ['command', 'exitState', 'rawOutput']) || result.exitState !== 0
      || !exactKeys(result.rawOutput, ['path', 'sha256'])
      || result.rawOutput.path !== `${G12_V2_ROOT}/validation/${key}.txt`
      || !shaReference.test(result.rawOutput.sha256)) fail('validation result shape');
    const bytes = await readFile(join(root, result.rawOutput.path));
    if (prefixed(bytes) !== result.rawOutput.sha256 || hasUnsanitizedG12V2Output(bytes.toString('utf8'), root)) fail(`${key} validation output invalid`);
  }
  const expectedFacts = await expectedG12V2Facts(root);
  const results = new Map(validation.results.map((result) => [result.command, result]));
  for (const [position, reference] of index.records.entries()) {
    const assertionId = G12_ASSERTIONS[position];
    if (reference.assertionId !== assertionId || reference.path !== `${G12_V2_ROOT}/records/${assertionId}.json`) fail('record reference order');
    const record = await verifyReference(root, reference);
    const artifact = await verifyReference(root, record.artifact);
    const commands = G12_V2_RETAINED_COMMANDS[assertionId];
    const retainedResults = commands.map((command) => ({ command, outputSha256: results.get(command)?.rawOutput.sha256 }));
    const command = commands.join(' && ');
    assertG12V2EvidenceNodeRelations({
      artifact, assertionId, command, environment: validation.environment,
      expectedFacts, index, record, retainedResults,
    });
  }
  assertG12V2Environment(validation.environment);
  await assertG12V2CurrentDependencies(root);
  await assertG12V2CommitTopology(root, expected, options);
  return index;
}
