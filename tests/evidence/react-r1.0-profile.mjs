import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import { pathManifestAtRevision } from './g1.2-profile.mjs';

const execFile = promisify(execFileCallback);

export const REACT_R10_ROOT = 'tests/evidence/react-r1.0';
export const REACT_R10_PROFILE = 'core-ui-react-r1.0-evidence-profile-v1';
export const REACT_R10_SOURCE_REVISION = 'e0bbf0d28e19e6a8f11eb20644a93c30c330d68b';
export const REACT_R10_SOURCE_TREE = '258ce3d576a518a728eff0d61f66a175df80138e';
export const REACT_R10_SCOPE_LOCK_DIGEST = 'sha256:0e2734a7fccd5164344efb1565a043c8c9632ef496adbecf051153327599699b';
export const REACT_R10_DISCLOSURE = 'public-sanitized';
export const REACT_R10_RETENTION = 'Content-addressed Git records retained after merge; Issue #75 is a mutable locator';
export const REACT_R10_EXPIRY = 'Any source, tool, environment, result, authority, or acceptance change';
export const REACT_R10_ASSERTION_IDS = Object.freeze([
  'E-R1.0-01', 'E-R1.0-02', 'E-R1.0-03', 'E-R1.0-04', 'E-R1.0-05',
]);
export const REACT_R10_PROOF_FILES = Object.freeze([
  'tests/evidence/capture-react-r1.0.mjs',
  'tests/evidence/react-r1.0-profile.mjs',
  'tests/evidence/react-r1.0-profile.test.mjs',
  'tooling/audits/repository-policy/src/evidence-verify.mjs',
  'tooling/audits/repository-policy/test/react-r1.0.test.mjs',
]);
export const REACT_R10_APPLICABILITY_PATHS = Object.freeze([
  'apps/react-playground', 'catalog',
  'decisions/0010-react-and-native-default-starting-points.md',
  'decisions/0010-amendment-01-react-primary-delivery.md',
  'decisions/0010-amendment-02-tale-styling-donor.md',
  'package.json', 'packages/react', 'packages/schema', 'packages/tokens', 'packages/tooling',
  'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'strategy/milestone-roadmap.md',
  'strategy/monorepo-architecture.md', 'strategy/platform-safety-contract.json',
  'strategy/product-scope.md',
  'tooling/audits/repository-policy/delivery-workflow-profile.json',
  'tooling/audits/repository-policy/delivery-workflow-profile.schema.json',
  'tooling/audits/repository-policy/repository-policy.json',
  'tooling/audits/repository-policy/src/release-prepare.mjs',
]);

export const REACT_R10_EVIDENCE_KINDS = Object.freeze({
  'E-R1.0-01': 'react-package-substrate-and-pinned-donor-identity',
  'E-R1.0-02': 'core-owned-contract-export-crosswalk-license-boundary',
  'E-R1.0-03': 'react-css-ssr-hydration-playground-donor-baseline',
  'E-R1.0-04': 'react-accessibility-compatibility-six-profile-baseline',
  'E-R1.0-05': 'react-packed-clean-consumer-guidance-runtime-edge-baseline',
});
export const REACT_R10_RESULT_KEYS = Object.freeze([
  'profile', 'react', 'playground', 'generate', 'generate-check', 'check',
  'check-all', 'release', 'evidence',
]);
export const REACT_R10_COMMANDS = Object.freeze([
  'node --test tests/evidence/react-r1.0-profile.test.mjs tooling/audits/repository-policy/test/react-r1.0.test.mjs',
  'pnpm --filter @core-ui/react check',
  'pnpm --dir apps/react-playground check',
  'pnpm generate', 'pnpm generate:check', 'pnpm check', 'pnpm check:all',
  'pnpm release:prepare',
  'node tooling/audits/repository-policy/src/evidence-verify.mjs',
]);
export const REACT_R10_RETAINED_COMMANDS = Object.freeze({
  'E-R1.0-01': Object.freeze([REACT_R10_COMMANDS[1], REACT_R10_COMMANDS[5], REACT_R10_COMMANDS[8]]),
  'E-R1.0-02': Object.freeze([REACT_R10_COMMANDS[1], REACT_R10_COMMANDS[7], REACT_R10_COMMANDS[8]]),
  'E-R1.0-03': Object.freeze([REACT_R10_COMMANDS[1], REACT_R10_COMMANDS[2], REACT_R10_COMMANDS[8]]),
  'E-R1.0-04': Object.freeze([REACT_R10_COMMANDS[1], REACT_R10_COMMANDS[2], REACT_R10_COMMANDS[8]]),
  'E-R1.0-05': Object.freeze([REACT_R10_COMMANDS[4], REACT_R10_COMMANDS[7], REACT_R10_COMMANDS[8]]),
});
export const REACT_R10_EXPECTED_TEST_NAMES = Object.freeze({
  'E-R1.0-01': Object.freeze([
    'R1.0 package has an exact standalone substrate identity',
    'R1.0 upstream inventory is complete, typed, and classified',
    'R1.0 upstream and catalog contracts reject complete-surface and shape drift',
    'R1.0 lockfile binds the accepted React Aria package integrity',
    'R1.0 binds current reusable token facts and keeps historical proof provenance-only',
  ]),
  'E-R1.0-02': Object.freeze([
    'R1.0 public surface does not export Button or upstream types',
    'R1.0 generated contracts reject missing, unknown, and publication drift',
    'R1.0 donor inputs are exact, fully crosswalked, licensed, and dependency-free',
  ]),
  'E-R1.0-03': Object.freeze([
    'R1.0 comparison fixture owns Core selectors and required token crosswalk',
    'R1.0 React Aria fixture proves SSR, hydration, disabled and pending state',
    'private playground is the bounded R1.0 theme and comparison host',
  ]),
  'E-R1.0-04': Object.freeze([
    'R1.0 React Aria fixture proves SSR, hydration, disabled and pending state',
    'R1.0 browser and axe matrix',
  ]),
  'E-R1.0-05': Object.freeze([
    'R1.0 public surface does not export Button or upstream types',
    'R1.0 is packable but direct publication fails closed',
    'R1.0 release boundary passed; @core-ui/react remains technically private and unpublished.',
  ]),
});
export const REACT_R10_DIRECT_EXPECTATIONS = Object.freeze({
  react: Object.freeze([
    'R1.0 package has an exact standalone substrate identity',
    'R1.0 public surface does not export Button or upstream types',
    'R1.0 upstream inventory is complete, typed, and classified',
    'R1.0 upstream and catalog contracts reject complete-surface and shape drift',
    'R1.0 generated contracts reject missing, unknown, and publication drift',
    'R1.0 donor inputs are exact, fully crosswalked, licensed, and dependency-free',
    'R1.0 lockfile binds the accepted React Aria package integrity',
    'R1.0 binds current reusable token facts and keeps historical proof provenance-only',
    'R1.0 comparison fixture owns Core selectors and required token crosswalk',
    'R1.0 React Aria fixture proves SSR, hydration, disabled and pending state',
    'R1.0 is packable but direct publication fails closed',
  ]),
  playground: Object.freeze([
    'R1.0 browser and axe matrix',
    'private playground is the bounded R1.0 theme and comparison host',
  ]),
  release: Object.freeze([
    'R1.0 release boundary passed; @core-ui/react remains technically private and unpublished.',
  ]),
});
export const REACT_R10_FACT_PATHS = Object.freeze({
  'E-R1.0-01': Object.freeze([
    'packages/react/package.json', 'packages/react/generated/compatibility.mjs',
    'catalog/react-r1-0/upstream-snapshot.json', 'catalog/react-r1-0/upstream-exports.json',
    'packages/schema/schemas/react-r1.schema.json', 'packages/react/src/r1-contracts.mjs',
    'catalog/tokens/default-theme.json',
    'tests/evidence/default-theme-g1.0-v2/index.json', 'pnpm-lock.yaml',
  ]),
  'E-R1.0-02': Object.freeze([
    'packages/react/generated/index.mjs', 'packages/react/generated/index.d.ts',
    'packages/react/generated/release.json', 'catalog/react-r1-0/donor-crosswalk.json',
    'catalog/react-r1-0/license.json', 'packages/react/LICENSE', 'packages/react/NOTICE',
    'packages/schema/schemas/react-r1.schema.json', 'packages/react/src/r1-contracts.mjs',
  ]),
  'E-R1.0-03': Object.freeze([
    'packages/react/generated/styles.css', 'packages/react/generated/button-donor-comparison.json',
    'packages/react/src/button-fixture.mjs', 'packages/react/test/fixture.test.mjs',
    'apps/react-playground/src/main.jsx', 'apps/react-playground/test/playground.test.mjs',
  ]),
  'E-R1.0-04': Object.freeze([
    'apps/react-playground/test/browser.test.mjs', 'apps/react-playground/package.json',
    'packages/react/src/button-fixture.mjs', 'packages/react/test/fixture.test.mjs',
  ]),
  'E-R1.0-05': Object.freeze([
    'packages/react/generated/descriptor.json', 'packages/react/generated/release.json',
    'packages/react/README.md', 'packages/react/package.json', 'packages/react/src/publish-guard.mjs',
    'tooling/audits/repository-policy/src/release-prepare.mjs',
  ]),
});

const oid = /^[0-9a-f]{40}$/u;
const digest = /^sha256:[0-9a-f]{64}$/u;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const fail = (message) => { throw new Error(`REACT_R10_PROFILE_INVALID: ${message}`); };
const prefixed = (bytes) => `sha256:${sha256(bytes)}`;
const exactKeys = (value, keys) => value !== null && typeof value === 'object'
  && !Array.isArray(value)
  && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());

async function git(root, args, encoding = 'utf8') {
  return (await execFile('git', args, { cwd: root, encoding, maxBuffer: 96 * 1024 * 1024 })).stdout;
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
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(root, path));
    else output.push(path);
  }
  return output.sort();
}

export function reactR10CaptureProcedure(values) {
  return [
    'node tests/evidence/capture-react-r1.0.mjs',
    `--source ${values.sourceRevision}`, `--tree ${values.sourceTree}`,
    `--tool ${values.toolRevision}`, `--tool-tree ${values.toolTree}`,
    `--timestamp ${values.timestamp}`,
  ].join(' ');
}

export function createReactR10Profile({ toolRevision, toolTree, toolFiles, applicabilityManifest }) {
  return {
    authority: { issue: '75', scopeLockDigest: REACT_R10_SCOPE_LOCK_DIGEST },
    applicabilityManifest,
    assertionIds: REACT_R10_ASSERTION_IDS,
    execution: { files: toolFiles, revision: toolRevision, tree: toolTree },
    id: 'R1.0-REACT-SUBSTRATE',
    productSource: { revision: REACT_R10_SOURCE_REVISION, tree: REACT_R10_SOURCE_TREE },
    schema: REACT_R10_PROFILE,
    upstream: {
      reactAriaComponents: '1.20.0',
      taleCommit: '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd',
      taleTree: 'e36c96f683772eedf4652d6adbe7dbcbd1d41f94',
    },
  };
}

export function assertReactR10Profile(value, reject = fail) {
  if (!exactKeys(value, ['applicabilityManifest', 'assertionIds', 'authority', 'execution', 'id', 'productSource', 'schema', 'upstream'])) reject('profile keys');
  if (value.id !== 'R1.0-REACT-SUBSTRATE' || value.schema !== REACT_R10_PROFILE
    || canonicalJson(value.assertionIds) !== canonicalJson(REACT_R10_ASSERTION_IDS)
    || canonicalJson(value.productSource) !== canonicalJson({ revision: REACT_R10_SOURCE_REVISION, tree: REACT_R10_SOURCE_TREE })
    || canonicalJson(value.authority) !== canonicalJson({ issue: '75', scopeLockDigest: REACT_R10_SCOPE_LOCK_DIGEST })
    || canonicalJson(value.upstream) !== canonicalJson({ reactAriaComponents: '1.20.0', taleCommit: '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd', taleTree: 'e36c96f683772eedf4652d6adbe7dbcbd1d41f94' })) reject('fixed identity');
  if (!exactKeys(value.execution, ['files', 'revision', 'tree'])
    || !oid.test(value.execution.revision ?? '') || !oid.test(value.execution.tree ?? '')
    || canonicalJson(value.execution.files?.map(({ path }) => path)) !== canonicalJson(REACT_R10_PROOF_FILES)
    || value.execution.files.some((entry) => !exactKeys(entry, ['path', 'sha256']) || !digest.test(entry.sha256))) reject('execution');
  if (!exactKeys(value.applicabilityManifest, ['algorithm', 'paths', 'profile', 'sha256'])
    || value.applicabilityManifest.algorithm !== 'sha256'
    || value.applicabilityManifest.profile !== 'core-ui-path-manifest-v1'
    || canonicalJson(value.applicabilityManifest.paths) !== canonicalJson(REACT_R10_APPLICABILITY_PATHS)
    || !digest.test(value.applicabilityManifest.sha256)) reject('applicability');
  return value;
}

export function assertReactR10DirectoryNames(names, reject = fail) {
  const candidates = names.filter((name) => name === 'react-r1.0' || name.startsWith('react-r1.0-'));
  if (candidates.length === 0) return false;
  if (canonicalJson(candidates) !== canonicalJson(['react-r1.0'])) reject('must contain one exact R1.0 root');
  return true;
}

export async function proofToolIdentityAtRevision(root, revision, tree) {
  const files = [];
  for (const path of REACT_R10_PROOF_FILES) {
    files.push({ path, sha256: prefixed(await git(root, ['show', `${revision}:${path}`], 'buffer')) });
  }
  return { files, revision, tree };
}

export async function reactR10FactsAtRevision(root, revision) {
  return Object.fromEntries(await Promise.all(REACT_R10_ASSERTION_IDS.map(async (assertionId) => [
    assertionId,
    {
      inputs: await Promise.all(REACT_R10_FACT_PATHS[assertionId].map(async (path) => ({
        path, sha256: prefixed(await git(root, ['show', `${revision}:${path}`], 'buffer')),
      }))),
      supportClaim: 'none',
    },
  ])));
}

export function assertReactR10SourceTopology({ changes, parents, revision, tree }, reject = fail) {
  const expected = REACT_R10_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`).sort();
  if (!oid.test(revision) || !oid.test(tree)
    || canonicalJson(parents) !== canonicalJson([REACT_R10_SOURCE_REVISION])
    || canonicalJson([...changes].sort()) !== canonicalJson(expected)) reject('proof tool must be the sole-parent exact five-path child');
  return { revision, tree };
}

export async function assertReactR10CommitTopology(root, expected, { allowUncommitted = false } = {}) {
  if ((await git(root, ['rev-parse', `${expected.toolRevision}^{tree}`])).trim() !== expected.toolTree) fail('tool tree mismatch');
  const line = (await git(root, ['rev-list', '--parents', '-n', '1', expected.toolRevision])).trim().split(' ');
  const changes = (await git(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', expected.toolRevision])).trim().split('\n').filter(Boolean);
  assertReactR10SourceTopology({ changes, parents: line.slice(1), revision: line[0], tree: expected.toolTree });
  if (allowUncommitted && (await git(root, ['rev-parse', 'HEAD'])).trim() === expected.toolRevision) return { state: 'uncommitted-capture' };
  const additions = (await git(root, ['log', '--full-history', '--format=%H', '--diff-filter=A', 'HEAD', '--', `${REACT_R10_ROOT}/index.json`])).trim().split('\n').filter(Boolean);
  if (new Set(additions).size !== 1) fail('root must have one reachable introduction commit');
  const evidenceRevision = additions[0];
  if ((await git(root, ['show', '-s', '--format=%P', evidenceRevision])).trim() !== expected.toolRevision) fail('evidence commit must be sole child of proof tool');
  const evidenceChanges = (await git(root, ['diff-tree', '--no-commit-id', '--name-status', '-r', evidenceRevision])).trim().split('\n').filter(Boolean);
  if (evidenceChanges.length === 0 || evidenceChanges.some((entry) => !entry.startsWith(`A\t${REACT_R10_ROOT}/`))) fail('evidence commit must add only R1.0 root');
  const introduced = (await git(root, ['rev-parse', `${evidenceRevision}:${REACT_R10_ROOT}`])).trim();
  const current = (await git(root, ['rev-parse', `HEAD:${REACT_R10_ROOT}`])).trim();
  if (introduced !== current) fail('retained root changed after introduction');
  return { evidenceRevision, state: 'committed' };
}

export async function assertReactR10Root(root, expected, options = {}) {
  const expectedFiles = [
    'index.json', 'validation.json',
    ...REACT_R10_RESULT_KEYS.map((key) => `validation/${key}.txt`),
    ...REACT_R10_ASSERTION_IDS.map((id) => `artifacts/${id}.json`),
    ...REACT_R10_ASSERTION_IDS.map((id) => `records/${id}.json`),
  ].sort();
  if (canonicalJson(await listFiles(join(root, REACT_R10_ROOT))) !== canonicalJson(expectedFiles)) fail('root file set');
  const index = (await readCanonical(root, `${REACT_R10_ROOT}/index.json`)).value;
  if (!exactKeys(index, ['applicabilityManifest', 'applicabilityProfile', 'captureTimestamp', 'disclosureClass', 'executedRevision', 'executedTree', 'milestone', 'owner', 'records', 'recertifications', 'retentionPolicy', 'schema', 'sourceRevision', 'sourceTree', 'supersessions', 'validation'])
    || index.schema !== 'core-ui-evidence-index-v1' || index.milestone !== 'R1.0'
    || index.owner !== 'ndrewtran' || index.disclosureClass !== REACT_R10_DISCLOSURE
    || index.retentionPolicy !== REACT_R10_RETENTION || index.sourceRevision !== REACT_R10_SOURCE_REVISION
    || index.sourceTree !== REACT_R10_SOURCE_TREE || index.executedRevision !== expected.toolRevision
    || index.executedTree !== expected.toolTree || index.captureTimestamp !== expected.timestamp
    || !timestamp.test(index.captureTimestamp)
    || index.validation?.path !== `${REACT_R10_ROOT}/validation.json`
    || !digest.test(index.validation?.sha256 ?? '')
    || canonicalJson(index.recertifications) !== '[]'
    || canonicalJson(index.supersessions) !== '[]') fail('index identity');
  const manifest = await pathManifestAtRevision(root, REACT_R10_SOURCE_REVISION, REACT_R10_APPLICABILITY_PATHS);
  if (canonicalJson(index.applicabilityManifest) !== canonicalJson(manifest)) fail('index applicability');
  const proofTool = await proofToolIdentityAtRevision(root, expected.toolRevision, expected.toolTree);
  const profile = createReactR10Profile({ applicabilityManifest: manifest, toolRevision: expected.toolRevision, toolTree: expected.toolTree, toolFiles: proofTool.files });
  assertReactR10Profile(index.applicabilityProfile);
  if (canonicalJson(index.applicabilityProfile) !== canonicalJson(profile)) fail('profile identity');
  const validation = await verifyReference(root, index.validation);
  if (!exactKeys(validation, ['applicabilityProfile', 'captureProcedure', 'environment', 'executedRevision', 'executedTree', 'proofTool', 'results', 'schema', 'sourceRevision', 'sourceTree'])
    || validation.schema !== 'core-ui-evidence-validation-v1'
    || validation.sourceRevision !== REACT_R10_SOURCE_REVISION
    || validation.sourceTree !== REACT_R10_SOURCE_TREE
    || validation.executedRevision !== expected.toolRevision
    || validation.executedTree !== expected.toolTree
    || validation.captureProcedure !== reactR10CaptureProcedure({ ...expected, sourceRevision: index.sourceRevision, sourceTree: index.sourceTree })
    || canonicalJson(validation.applicabilityProfile) !== canonicalJson(profile)
    || canonicalJson(validation.proofTool) !== canonicalJson(proofTool)
    || canonicalJson(validation.results.map(({ command }) => command)) !== canonicalJson(REACT_R10_COMMANDS)
    || !exactKeys(validation.environment, ['architecture', 'axeCore', 'browser', 'git', 'node', 'playwrightCore', 'pnpm', 'runnerImage', 'runnerImageVersion', 'runnerOs'])
    || !exactKeys(validation.environment.browser, ['executableSha256', 'version'])
    || !digest.test(validation.environment.browser.executableSha256 ?? '')) fail('validation identity');
  const resultMap = new Map();
  const outputs = new Map();
  for (const [position, result] of validation.results.entries()) {
    const key = REACT_R10_RESULT_KEYS[position];
    if (!exactKeys(result, ['command', 'exitState', 'rawOutput']) || result.exitState !== 0
      || !exactKeys(result.rawOutput, ['path', 'sha256'])
      || result.rawOutput.path !== `${REACT_R10_ROOT}/validation/${key}.txt` || !digest.test(result.rawOutput.sha256)) fail('validation result');
    const bytes = await readFile(join(root, result.rawOutput.path));
    if (prefixed(bytes) !== result.rawOutput.sha256) fail(`${key} output digest`);
    const output = bytes.toString('utf8');
    if (/\/(?:Users|Volumes|home|root|tmp|private(?:\/(?:tmp|var\/folders))?|var\/folders)\//u.test(output)
      || /(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential)\s*[:=]\s*\S+/iu.test(output)
      || /\b(?:https?|ssh):\/\/[^\s/@:]+:[^\s/@]+@/iu.test(output)) fail(`${key} output privacy`);
    outputs.set(key, output);
    resultMap.set(result.command, result);
  }
  for (const [key, names] of Object.entries(REACT_R10_DIRECT_EXPECTATIONS)) {
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      if ((outputs.get(key)?.match(new RegExp(escaped, 'gu')) ?? []).length !== 1) fail(`expected result ${name}`);
    }
  }
  const expectedFacts = await reactR10FactsAtRevision(root, REACT_R10_SOURCE_REVISION);
  if (canonicalJson(index.records.map(({ assertionId }) => assertionId)) !== canonicalJson(REACT_R10_ASSERTION_IDS)) fail('record order');
  for (const [position, reference] of index.records.entries()) {
    const assertionId = REACT_R10_ASSERTION_IDS[position];
    if (!exactKeys(reference, ['assertionId', 'path', 'sha256']) || reference.assertionId !== assertionId
      || reference.path !== `${REACT_R10_ROOT}/records/${assertionId}.json`) fail('record reference');
    const record = await verifyReference(root, reference);
    const artifact = await verifyReference(root, record.artifact);
    const commands = REACT_R10_RETAINED_COMMANDS[assertionId];
    const retainedResults = commands.map((command) => ({ command, outputSha256: resultMap.get(command)?.rawOutput.sha256 }));
    const command = commands.join(' && ');
    if (!exactKeys(record, ['activeExceptionRefs', 'advisoryRefs', 'applicabilityManifest', 'applicabilityProfile', 'artifact', 'assertionId', 'captureTimestamp', 'command', 'disclosureClass', 'environment', 'evidenceKind', 'executedRevision', 'executedTree', 'expiry', 'milestone', 'outcome', 'owner', 'retentionPolicy', 'schema', 'sourceRevision', 'sourceTree', 'validation'])
      || !exactKeys(artifact, ['applicabilityManifest', 'applicabilityProfile', 'assertionId', 'captureTimestamp', 'command', 'environment', 'evidenceKind', 'executedRevision', 'executedTree', 'exitState', 'observations', 'outcome', 'schema', 'sourceRevision', 'sourceTree'])
      || record.schema !== 'core-ui-evidence-record-v1' || artifact.schema !== 'core-ui-evidence-artifact-v1'
      || record.assertionId !== assertionId || artifact.assertionId !== assertionId
      || record.evidenceKind !== REACT_R10_EVIDENCE_KINDS[assertionId] || artifact.evidenceKind !== record.evidenceKind
      || record.command !== command || artifact.command !== command || record.outcome !== 'pass'
      || artifact.outcome !== 'pass' || artifact.exitState !== 0 || record.captureTimestamp !== expected.timestamp
      || artifact.captureTimestamp !== expected.timestamp || record.disclosureClass !== REACT_R10_DISCLOSURE
      || record.sourceRevision !== REACT_R10_SOURCE_REVISION || artifact.sourceRevision !== REACT_R10_SOURCE_REVISION
      || record.sourceTree !== REACT_R10_SOURCE_TREE || artifact.sourceTree !== REACT_R10_SOURCE_TREE
      || record.executedRevision !== expected.toolRevision || artifact.executedRevision !== expected.toolRevision
      || record.executedTree !== expected.toolTree || artifact.executedTree !== expected.toolTree
      || record.milestone !== 'R1.0' || record.owner !== 'ndrewtran'
      || record.artifact?.path !== `${REACT_R10_ROOT}/artifacts/${assertionId}.json`
      || !digest.test(record.artifact?.sha256 ?? '')
      || record.retentionPolicy !== REACT_R10_RETENTION || record.expiry !== REACT_R10_EXPIRY
      || canonicalJson(record.advisoryRefs) !== '[]' || canonicalJson(record.activeExceptionRefs) !== '[]'
      || canonicalJson(record.validation) !== canonicalJson(index.validation)
      || canonicalJson(record.environment) !== canonicalJson(validation.environment)
      || canonicalJson(artifact.environment) !== canonicalJson(validation.environment)
      || canonicalJson(record.applicabilityManifest) !== canonicalJson(manifest)
      || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(manifest)
      || canonicalJson(record.applicabilityProfile) !== canonicalJson(profile)
      || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(profile)
      || canonicalJson(artifact.observations) !== canonicalJson({
        facts: expectedFacts[assertionId], retainedResults,
        testNames: REACT_R10_EXPECTED_TEST_NAMES[assertionId],
      })) fail(`${assertionId} proof relation`);
  }
  await assertReactR10CommitTopology(root, expected, options);
  return index;
}

export { canonicalJson, parseJsonStrict, pathManifestAtRevision };
