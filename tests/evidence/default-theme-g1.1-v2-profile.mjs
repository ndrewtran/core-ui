import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  DEFAULT_THEME_G11_ASSERTION_IDS as DEFAULT_THEME_G1_ASSERTION_IDS,
  DEFAULT_THEME_G11_BROWSER_TOOLCHAIN,
  DEFAULT_THEME_G11_EVIDENCE_KINDS as DEFAULT_THEME_G1_EVIDENCE_KINDS,
  DEFAULT_THEME_G11_EXPECTED_FACTS as DEFAULT_THEME_G1_EXPECTED_FACTS,
  DEFAULT_THEME_G11_EXPECTED_TEST_NAMES as DEFAULT_THEME_G1_EXPECTED_TEST_NAMES,
  DEFAULT_THEME_G11_RETAINED_COMMANDS as DEFAULT_THEME_G1_RETAINED_COMMANDS,
  DEFAULT_THEME_G11_VALIDATION_COMMANDS as DEFAULT_THEME_G1_VALIDATION_COMMANDS,
  assertDefaultThemeG11Environment as assertDefaultThemeG11V2Environment,
} from './default-theme-g1.1-profile.mjs';
import {
  DEFAULT_THEME_G10_V2_ROOT,
  assertDefaultThemeG10V2Root,
  pathManifestAtRevision,
} from './default-theme-g1.0-v2-profile.mjs';

const execFile = promisify(execFileCallback);

export {
  DEFAULT_THEME_G1_ASSERTION_IDS as DEFAULT_THEME_G11_V2_ASSERTION_IDS,
  DEFAULT_THEME_G1_EVIDENCE_KINDS as DEFAULT_THEME_G11_V2_EVIDENCE_KINDS,
  DEFAULT_THEME_G1_EXPECTED_FACTS as DEFAULT_THEME_G11_V2_EXPECTED_FACTS,
  DEFAULT_THEME_G1_EXPECTED_TEST_NAMES as DEFAULT_THEME_G11_V2_EXPECTED_TEST_NAMES,
  DEFAULT_THEME_G11_BROWSER_TOOLCHAIN as DEFAULT_THEME_G11_V2_BROWSER_TOOLCHAIN,
  assertDefaultThemeG11V2Environment,
  pathManifestAtRevision,
};

export const DEFAULT_THEME_G11_V2_ROOT = 'tests/evidence/default-theme-g1.1-v2';
export const DEFAULT_THEME_G11_V2_SCHEMA = 'core-ui-default-theme-g1.1-evidence-profile-v2';
export const DEFAULT_THEME_G11_V2_PRODUCT_SOURCE = Object.freeze({
  revision: 'd45f52a241624c9ff6a08638684720e9d31842a5',
  tree: '528ae016547593212c40b31c08166a5f9769f0c8',
});
export const DEFAULT_THEME_G11_V2_PROOF_FILES = Object.freeze([
  'tests/evidence/capture-default-theme-g1.1-v2.mjs',
  'tests/evidence/default-theme-g1.1-v2-profile.mjs',
  'tests/evidence/default-theme-g1.1-v2-profile.test.mjs',
  'tooling/audits/repository-policy/src/evidence-verify.mjs',
  'tooling/audits/repository-policy/test/default-theme-g1.1-v2.test.mjs',
]);
export const DEFAULT_THEME_G11_V2_UPSTREAM_G10 = Object.freeze({
  acceptedPacketSha256: 'sha256:59195089cbe2994bb2ad5469e0268bc897e702f365610c45c546907c130ca85b',
  authorAssociation: 'OWNER',
  captureTimestamp: '2026-08-15T06:51:59Z',
  commentId: 5301472350,
  commentNodeId: 'IC_kwDOTtLjcM8AAAABO_4MXg',
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
  mergeRevision: DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision,
  outcome: 'accepted',
  productRevision: '35676452ca44f4abb64c6211e05424361f9a6896',
  productTree: '03571985cc16305f6e4cff2cdce219e161237636',
  pullRequestNumber: 68,
  repository: 'ndrewtran/core-ui',
  url: 'https://github.com/ndrewtran/core-ui/issues/67#issuecomment-5301472350',
});

// Product and authority inputs deliberately exclude this proof route. Their bytes
// must be identical at the product source and the reviewed proof-tool checkout.
export const DEFAULT_THEME_G11_V2_APPLICABILITY_PATHS = Object.freeze([
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
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/foundation',
  'packages/react',
  'packages/react-native',
  'packages/tokens',
  'packages/tooling',
  'packages/web',
  'tests/fixtures/g0.4',
  'tests/fixtures/g0.5',
  'tests/fixtures/g1.0',
  'tests/fixtures/g1.1',
  'tests/fixtures/g1.2',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
]);

const legacyProfileCommand = DEFAULT_THEME_G1_VALIDATION_COMMANDS[0];
const v2ProfileCommand = 'node --test tests/evidence/default-theme-g1.1-v2-profile.test.mjs';
export const DEFAULT_THEME_G11_V2_VALIDATION_COMMANDS = Object.freeze(
  DEFAULT_THEME_G1_VALIDATION_COMMANDS.map((command) => (
    command === legacyProfileCommand ? v2ProfileCommand : command
  )),
);
export const DEFAULT_THEME_G11_V2_RETAINED_COMMANDS = Object.freeze(Object.fromEntries(
  Object.entries(DEFAULT_THEME_G1_RETAINED_COMMANDS).map(([assertionId, commands]) => [
    assertionId,
    Object.freeze(commands.map((command) => command === legacyProfileCommand ? v2ProfileCommand : command)),
  ]),
));
export const DEFAULT_THEME_G11_V2_RESULT_KEYS = Object.freeze([
  'profile', 'web', 'react', 'generation', 'agent', 'release', 'evidence', 'check', 'check-all',
]);
export const DEFAULT_THEME_G11_V2_DISCLOSURE = 'public-sanitized';
export const DEFAULT_THEME_G11_V2_RETENTION = 'Content-addressed Git records retained by the evidence pull request and default-branch history after merge; issues and the Delivery Project are mutable locators';
export const DEFAULT_THEME_G11_V2_EXPIRY = 'Any accepted product source/tree, current G1.0 root or acceptance, applicability path, proof-tool byte, environment tuple, retained result, or human acceptance change';

const gitObject = /^[0-9a-f]{40}$/u;
const shaReference = /^sha256:[0-9a-f]{64}$/u;
const captureTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

function fail(message) {
  throw new Error(`DEFAULT_THEME_G11_V2_PROFILE_INVALID: ${message}`);
}

export function assertDefaultThemeG11V2DirectoryNames(names, reject = fail) {
  const candidates = names.filter((name) => name.startsWith('default-theme-g1.1-v2'));
  if (candidates.length === 0) return false;
  if (canonicalJson(candidates) !== canonicalJson(['default-theme-g1.1-v2'])) {
    reject('must contain exactly one current G1.1 v2 root');
  }
  return true;
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

export function defaultThemeG11V2CaptureProcedure(values) {
  return [
    'node tests/evidence/capture-default-theme-g1.1-v2.mjs',
    `--source ${values.sourceRevision}`,
    `--tree ${values.sourceTree}`,
    `--executed ${values.executedRevision}`,
    `--executed-tree ${values.executedTree}`,
    `--timestamp ${values.timestamp}`,
  ].join(' ');
}

export function createDefaultThemeG11V2Profile({ manifest, executedRevision, executedTree, toolFiles }) {
  return {
    applicabilityManifest: manifest,
    assertionIds: DEFAULT_THEME_G1_ASSERTION_IDS,
    execution: { files: toolFiles, revision: executedRevision, tree: executedTree },
    id: 'DEFAULT-THEME-G1.1-V2',
    productSource: DEFAULT_THEME_G11_V2_PRODUCT_SOURCE,
    schema: DEFAULT_THEME_G11_V2_SCHEMA,
    upstreamG10: DEFAULT_THEME_G11_V2_UPSTREAM_G10,
  };
}

export function assertDefaultThemeG11V2SourceTopology({ changes, parents, revision, tree }, reject = fail) {
  const expected = DEFAULT_THEME_G11_V2_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`).sort();
  if (!gitObject.test(revision) || !gitObject.test(tree)
    || canonicalJson(parents) !== canonicalJson([DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision])
    || canonicalJson([...changes].sort()) !== canonicalJson(expected)) {
    reject('executed source must be the sole-parent exact five-path proof-tool child');
  }
  return { revision, tree };
}

export function hasUnsanitizedDefaultThemeG11V2Output(text, root) {
  const withoutPublicTokenIds = text.replace(/"core:token:[a-z0-9]+(?:-[a-z0-9]+)*"/gu, '"core:<public-token-id>"');
  return withoutPublicTokenIds.includes(root)
    || /\/(?:Users|Volumes|home|root|tmp|private(?:\/(?:tmp|var\/folders))?|var\/folders)\//u.test(withoutPublicTokenIds)
    || /(?:authorization|api[-_]?key|token)\s*[:=]\s*\S+/iu.test(withoutPublicTokenIds);
}

export async function proofToolIdentityAtRevision(root, revision, tree) {
  const files = [];
  for (const path of DEFAULT_THEME_G11_V2_PROOF_FILES) {
    files.push({ path, sha256: prefixed(await git(root, ['show', `${revision}:${path}`], 'buffer')) });
  }
  return { files, revision, tree };
}

export function assertDefaultThemeG11V2UpstreamG10(reference, reject = fail) {
  if (canonicalJson(reference) !== canonicalJson(DEFAULT_THEME_G11_V2_UPSTREAM_G10)) {
    reject('upstream G1.0 must bind the exact accepted current root and owner acceptance');
  }
  return reference;
}

export async function assertDefaultThemeG11V2CurrentG10(root) {
  assertDefaultThemeG11V2UpstreamG10(DEFAULT_THEME_G11_V2_UPSTREAM_G10);
  const { index } = DEFAULT_THEME_G11_V2_UPSTREAM_G10;
  if (prefixed(await readFile(join(root, index.path))) !== index.sha256) {
    fail(`${index.path} does not match the accepted current G1.0 index`);
  }
  await assertDefaultThemeG10V2Root(root, {
    executedRevision: DEFAULT_THEME_G11_V2_UPSTREAM_G10.executedRevision,
    executedTree: DEFAULT_THEME_G11_V2_UPSTREAM_G10.executedTree,
    sourceRevision: DEFAULT_THEME_G11_V2_UPSTREAM_G10.productRevision,
    sourceTree: DEFAULT_THEME_G11_V2_UPSTREAM_G10.productTree,
    timestamp: DEFAULT_THEME_G11_V2_UPSTREAM_G10.captureTimestamp,
  });
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

export async function assertDefaultThemeG11V2CommitTopology(root, expected, { allowUncommitted = false } = {}) {
  const sourceTree = (await git(root, ['rev-parse', `${expected.executedRevision}^{tree}`])).trim();
  if (sourceTree !== expected.executedTree) fail('executed revision/tree mismatch');
  const revisionLine = (await git(root, ['rev-list', '--parents', '-n', '1', expected.executedRevision])).trim().split(' ');
  const sourceChanges = (await git(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', expected.executedRevision])).trim().split('\n').filter(Boolean);
  assertDefaultThemeG11V2SourceTopology({ changes: sourceChanges, parents: revisionLine.slice(1), revision: revisionLine[0], tree: sourceTree });
  const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
  if (allowUncommitted && head === expected.executedRevision) return { sourceRevision: expected.executedRevision, state: 'uncommitted-capture' };
  const indexPath = `${DEFAULT_THEME_G11_V2_ROOT}/index.json`;
  const additions = (await git(root, ['log', '--full-history', '--format=%H', '--diff-filter=A', 'HEAD', '--', indexPath])).trim().split('\n').filter(Boolean);
  if (new Set(additions).size !== 1) fail('root must have one reachable introduction commit');
  const evidenceRevision = additions[0];
  const parents = (await git(root, ['show', '-s', '--format=%P', evidenceRevision])).trim().split(' ').filter(Boolean);
  if (canonicalJson(parents) !== canonicalJson([expected.executedRevision])) fail('evidence commit must be the sole child of the executed source');
  const changed = (await git(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', evidenceRevision])).trim().split('\n').filter(Boolean);
  if (changed.length === 0 || changed.some((line) => !line.startsWith(`A\t${DEFAULT_THEME_G11_V2_ROOT}/`))) fail('evidence commit must add only the v2 root');
  const introduced = (await git(root, ['rev-parse', `${evidenceRevision}:${DEFAULT_THEME_G11_V2_ROOT}`])).trim();
  const current = (await git(root, ['rev-parse', `HEAD:${DEFAULT_THEME_G11_V2_ROOT}`])).trim();
  if (introduced !== current) fail('v2 root must remain byte-identical to introduction');
  return { evidenceRevision, sourceRevision: expected.executedRevision, state: 'committed' };
}

export async function assertDefaultThemeG11V2Root(root, expected, options = {}) {
  const index = (await readCanonical(root, `${DEFAULT_THEME_G11_V2_ROOT}/index.json`)).value;
  const manifest = await pathManifestAtRevision(root, DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision, DEFAULT_THEME_G11_V2_APPLICABILITY_PATHS);
  const expectedFiles = [
    'index.json', 'validation.json',
    ...DEFAULT_THEME_G11_V2_RESULT_KEYS.map((key) => `validation/${key}.txt`),
    ...DEFAULT_THEME_G1_ASSERTION_IDS.map((id) => `artifacts/${id}.json`),
    ...DEFAULT_THEME_G1_ASSERTION_IDS.map((id) => `records/${id}.json`),
  ].sort();
  if (canonicalJson(await listFiles(join(root, DEFAULT_THEME_G11_V2_ROOT))) !== canonicalJson(expectedFiles)) fail('root file set is not exact');
  if (!exactKeys(index, ['applicabilityManifest', 'applicabilityProfile', 'captureTimestamp', 'disclosureClass', 'executedRevision', 'executedTree', 'milestone', 'owner', 'records', 'recertifications', 'retentionPolicy', 'schema', 'sourceRevision', 'sourceTree', 'supersessions', 'validation'])
    || index.schema !== 'core-ui-evidence-index-v1' || index.milestone !== 'G1.1' || index.owner !== 'ndrewtran'
    || index.disclosureClass !== DEFAULT_THEME_G11_V2_DISCLOSURE || index.retentionPolicy !== DEFAULT_THEME_G11_V2_RETENTION
    || index.sourceRevision !== DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision || index.sourceTree !== DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.tree
    || index.executedRevision !== expected.executedRevision || index.executedTree !== expected.executedTree
    || index.captureTimestamp !== expected.timestamp || !captureTimestamp.test(index.captureTimestamp)
    || canonicalJson(index.applicabilityManifest) !== canonicalJson(manifest)
    || canonicalJson(index.records.map(({ assertionId }) => assertionId)) !== canonicalJson(DEFAULT_THEME_G1_ASSERTION_IDS)
    || canonicalJson(index.recertifications) !== '[]' || canonicalJson(index.supersessions) !== '[]') fail('index identity');
  const proofTool = await proofToolIdentityAtRevision(root, expected.executedRevision, expected.executedTree);
  const expectedProfile = createDefaultThemeG11V2Profile({ manifest, executedRevision: expected.executedRevision, executedTree: expected.executedTree, toolFiles: proofTool.files });
  if (canonicalJson(index.applicabilityProfile) !== canonicalJson(expectedProfile)) fail('profile identity');
  const validation = await verifyReference(root, index.validation);
  if (!exactKeys(validation, ['applicabilityProfile', 'captureProcedure', 'environment', 'executedRevision', 'executedTree', 'proofTool', 'results', 'schema', 'sourceRevision', 'sourceTree'])
    || validation.schema !== 'core-ui-evidence-validation-v1'
    || canonicalJson(validation.applicabilityProfile) !== canonicalJson(expectedProfile)
    || canonicalJson(validation.proofTool) !== canonicalJson(proofTool)
    || validation.captureProcedure !== defaultThemeG11V2CaptureProcedure({ ...expected, sourceRevision: index.sourceRevision, sourceTree: index.sourceTree })
    || canonicalJson(validation.results.map(({ command }) => command)) !== canonicalJson(DEFAULT_THEME_G11_V2_VALIDATION_COMMANDS)) fail('validation identity');
  for (const [position, result] of validation.results.entries()) {
    const key = DEFAULT_THEME_G11_V2_RESULT_KEYS[position];
    if (!exactKeys(result, ['command', 'exitState', 'rawOutput']) || result.exitState !== 0
      || result.rawOutput.path !== `${DEFAULT_THEME_G11_V2_ROOT}/validation/${key}.txt`
      || !shaReference.test(result.rawOutput.sha256)) fail('validation result shape');
    const bytes = await readFile(join(root, result.rawOutput.path));
    if (prefixed(bytes) !== result.rawOutput.sha256 || hasUnsanitizedDefaultThemeG11V2Output(bytes.toString('utf8'), root)) fail(`${key} validation output invalid`);
  }
  const results = new Map(validation.results.map((result) => [result.command, result]));
  for (const [position, reference] of index.records.entries()) {
    const assertionId = DEFAULT_THEME_G1_ASSERTION_IDS[position];
    if (reference.assertionId !== assertionId || reference.path !== `${DEFAULT_THEME_G11_V2_ROOT}/records/${assertionId}.json`) fail('record reference order');
    const record = await verifyReference(root, reference);
    const artifact = await verifyReference(root, record.artifact);
    const commands = DEFAULT_THEME_G11_V2_RETAINED_COMMANDS[assertionId];
    const retainedResults = commands.map((command) => ({ command, outputSha256: results.get(command)?.rawOutput.sha256 }));
    const command = commands.join(' && ');
    if (record.assertionId !== assertionId || artifact.assertionId !== assertionId
      || record.evidenceKind !== DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId] || artifact.evidenceKind !== record.evidenceKind
      || record.sourceRevision !== index.sourceRevision || artifact.sourceRevision !== index.sourceRevision
      || record.sourceTree !== index.sourceTree || artifact.sourceTree !== index.sourceTree
      || record.executedRevision !== index.executedRevision || artifact.executedRevision !== index.executedRevision
      || record.executedTree !== index.executedTree || artifact.executedTree !== index.executedTree
      || canonicalJson(record.applicabilityManifest) !== canonicalJson(manifest) || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(manifest)
      || canonicalJson(record.applicabilityProfile) !== canonicalJson(expectedProfile) || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(expectedProfile)
      || canonicalJson(record.validation) !== canonicalJson(index.validation) || record.command !== command || artifact.command !== command
      || record.disclosureClass !== DEFAULT_THEME_G11_V2_DISCLOSURE || record.retentionPolicy !== DEFAULT_THEME_G11_V2_RETENTION
      || record.expiry !== DEFAULT_THEME_G11_V2_EXPIRY || record.outcome !== 'pass' || artifact.outcome !== 'pass'
      || canonicalJson(artifact.observations?.facts) !== canonicalJson(DEFAULT_THEME_G1_EXPECTED_FACTS[assertionId])
      || canonicalJson(artifact.observations?.testNames) !== canonicalJson(DEFAULT_THEME_G1_EXPECTED_TEST_NAMES[assertionId])
      || canonicalJson(artifact.observations?.retainedResults) !== canonicalJson(retainedResults)) fail(`${assertionId} proof relation`);
  }
  assertDefaultThemeG11V2Environment(validation.environment);
  await assertDefaultThemeG11V2CurrentG10(root);
  await assertDefaultThemeG11V2CommitTopology(root, expected, options);
  return index;
}
