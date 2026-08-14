import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  TALE_TOKEN_PHASE_C_PROFILE,
} from './capture-tale-token-phase-c.mjs';
import { pathManifestAtRevision as canonicalPathManifestAtRevision } from './g1.2-profile.mjs';

const execFile = promisify(execFileCallback);

export const TALE_TOKEN_PHASE_C_V2_ROOT_SPECS = Object.freeze([
  Object.freeze({ key: 'g0.1', milestone: 'G0.1', assertions: Object.freeze({
    'E-G0.1-01': 'schema-corpus-report',
    'E-G0.1-02': 'canonicalization-digest-comparison',
    'E-G0.1-03': 'revision-closure-report',
    'E-G0.1-04': 'field-ownership-and-generation-report',
    'E-G0.1-05': 'version-negotiation-matrix',
  }), resultKeys: Object.freeze(['schema', 'tokens']) }),
  Object.freeze({ key: 'g0.2', milestone: 'G0.2', assertions: Object.freeze({
    'E-G0.2-01': 'dual-build-digest-report',
    'E-G0.2-02': 'golden-api-corpus',
    'E-G0.2-03': 'digest-bound-cursor-fixture',
    'E-G0.2-04': 'response-size-and-relation-boundary-report',
    'E-G0.2-05': 'query-hermeticity-and-side-effect-audit',
  }), resultKeys: Object.freeze(['catalog', 'tokens']) }),
  Object.freeze({ key: 'g0.3', milestone: 'G0.3', assertions: Object.freeze({
    'E-G0.3-01': 'surface-parity-matrix',
    'E-G0.3-02': 'cross-renderer-golden-corpus',
    'E-G0.3-03': 'dense-token-count-report',
    'E-G0.3-04': 'command-registry-consistency-report',
    'E-G0.3-05': 'error-schema-exit-status-report',
    'E-G0.3-06': 'cold-start-smoke-transcript',
  }), resultKeys: Object.freeze(['tooling']) }),
  Object.freeze({ key: 'g0.4', milestone: 'G0.4', assertions: Object.freeze({
    'E-G0.4-01': 'multi-workspace-resolver-matrix',
    'E-G0.4-02': 'resolver-taxonomy-fixture',
    'E-G0.4-03': 'negative-package-graph-corpus',
    'E-G0.4-04': 'installed-local-query-metadata',
    'E-G0.4-05': 'privacy-scan',
  }), resultKeys: Object.freeze(['tooling']) }),
  Object.freeze({ key: 'g0.5', milestone: 'G0.5', assertions: Object.freeze({
    'E-G0.5-01': 'authoring-round-trip-transcript',
    'E-G0.5-02': 'semantic-change-and-revision-golden-corpus',
    'E-G0.5-03': 'negative-autofix-policy',
    'E-G0.5-04': 'schema-authoring-coupling-and-affected-closure',
  }), resultKeys: Object.freeze(['schema', 'tokens', 'tooling']) }),
  Object.freeze({ key: 'gate-0', milestone: 'Gate 0 exit', assertions: Object.freeze({
    'E-GATE0-01': 'gate-0-uninterrupted-integration-transcript',
  }), resultKeys: Object.freeze(['check-all', 'generation', 'release', 'agent']) }),
]);

export const TALE_TOKEN_PHASE_C_V2_ROOT_NAMES = Object.freeze(
  TALE_TOKEN_PHASE_C_V2_ROOT_SPECS.map(({ key }) => `tale-token-phase-c-${key}-v2`),
);
export const TALE_TOKEN_PHASE_C_V2_ROOT_PATHS = Object.freeze(
  TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.map((name) => `tests/evidence/${name}`),
);
export const TALE_TOKEN_PHASE_C_V2_PROOF_FILES = Object.freeze([
  'tests/evidence/README.md',
  'tests/evidence/capture-tale-token-phase-c.mjs',
  'tests/evidence/capture-tale-token-phase-c-v2.mjs',
  'tests/evidence/g1.2-profile.mjs',
  'tests/evidence/tale-token-phase-c-v2-profile.mjs',
  'tests/evidence/tale-token-phase-c-v2-profile.test.mjs',
  'tooling/audits/repository-policy/src/evidence-verify.mjs',
  'tooling/audits/repository-policy/test/tale-token-phase-c-v2.test.mjs',
]);
export const TALE_TOKEN_PHASE_C_V2_APPLICABILITY_PATHS = Object.freeze([
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
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  'tests/fixtures/g0.5',
  'tests/fixtures/g1.0',
  'tests/fixtures/g1.1',
  'tests/fixtures/g1.2',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
  ...TALE_TOKEN_PHASE_C_V2_PROOF_FILES,
]);
export const TALE_TOKEN_PHASE_C_V2_COMMANDS = Object.freeze({
  schema: Object.freeze(['pnpm', '--filter', '@core-ui/schema', 'check']),
  catalog: Object.freeze(['pnpm', '--filter', '@core-ui/catalog', 'check']),
  tokens: Object.freeze(['pnpm', '--filter', '@core-ui/tokens', 'check']),
  tooling: Object.freeze(['pnpm', '--filter', '@core-ui/tooling', 'check']),
  'check-all': Object.freeze(['pnpm', 'check:all']),
  generation: Object.freeze(['pnpm', 'generate:check']),
  release: Object.freeze(['node', 'tooling/audits/repository-policy/src/release-prepare.mjs']),
  agent: Object.freeze(['pnpm', 'test:agent']),
});
export const TALE_TOKEN_PHASE_C_V2_PROFILE_DIGEST = canonicalDigest(TALE_TOKEN_PHASE_C_PROFILE);
export const TALE_TOKEN_PHASE_C_V2_RETENTION = 'Content-addressed Git records retained by the evidence pull request and default-branch history after merge; issues and the Delivery Project are mutable locators';
export const TALE_TOKEN_PHASE_C_V2_EXPIRY = 'Any accepted source/tree, authority byte, applicability path, proof-tool byte, environment tuple, retained result, or human acceptance change';

function prefixed(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function fail(message) {
  throw new Error(`TALE_TOKEN_PHASE_C_V2_PROFILE_INVALID: ${message}`);
}

export function isTaleTokenPhaseCV2Name(name) {
  return TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.includes(name);
}

export function isTaleTokenPhaseCV2Path(path) {
  return TALE_TOKEN_PHASE_C_V2_ROOT_PATHS.some((root) => path === `${root}/index.json` || path.startsWith(`${root}/`));
}

export function assertTaleTokenPhaseCV2DirectoryNames(names, reject = fail) {
  const candidates = names.filter((name) => name.startsWith('tale-token-phase-c-') && name.includes('-v2'));
  if (candidates.length === 0) return false;
  if (canonicalJson([...candidates].sort()) !== canonicalJson([...TALE_TOKEN_PHASE_C_V2_ROOT_NAMES].sort())) {
    reject('must contain exactly the six versioned Phase C roots');
  }
  return true;
}

export function assertTaleTokenPhaseCV2IndexSet(values, reject = fail) {
  const names = values.map(({ name }) => name).sort();
  const identities = new Set(values.map(({ index }) => `${index.sourceRevision}:${index.sourceTree}:${index.captureTimestamp}`));
  if (canonicalJson(names) !== canonicalJson([...TALE_TOKEN_PHASE_C_V2_ROOT_NAMES].sort()) || identities.size !== 1) {
    reject('must retain six exact v2 sibling roots with one source/tree/timestamp');
  }
}

async function git(root, args, encoding = 'utf8') {
  return (await execFile('git', args, { cwd: root, encoding, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

export async function pathManifestAtRevision(root, revision, paths) {
  for (const path of paths) {
    try {
      await git(root, ['cat-file', '-e', `${revision}:${path}`]);
    } catch {
      fail(`applicability path is missing at ${revision}: ${path}`);
    }
  }
  return canonicalPathManifestAtRevision(root, revision, paths);
}

export async function proofToolIdentityAtRevision(root, revision, tree) {
  const files = [];
  for (const path of TALE_TOKEN_PHASE_C_V2_PROOF_FILES) files.push({
    path,
    sha256: prefixed(await git(root, ['show', `${revision}:${path}`], 'buffer')),
  });
  return { files, revision, tree };
}

export async function listTaleTokenPhaseCV2Files(root, relative = '') {
  const output = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listTaleTokenPhaseCV2Files(root, path));
    else output.push(path);
  }
  return output.sort();
}

export async function assertTaleTokenPhaseCV2Root(root, relativeRoot, expected) {
  const name = relativeRoot.split('/').at(-1);
  const position = TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.indexOf(name);
  if (position < 0) fail(`unknown root ${relativeRoot}`);
  const spec = TALE_TOKEN_PHASE_C_V2_ROOT_SPECS[position];
  const index = parseJsonStrict(await readFile(join(root, relativeRoot, 'index.json'), 'utf8'));
  if (index.schema !== 'core-ui-evidence-index-v1' || index.sourceRevision !== expected.sourceRevision
    || index.sourceTree !== expected.sourceTree || index.captureTimestamp !== expected.timestamp
    || canonicalJson(index.applicabilityProfile) !== canonicalJson(TALE_TOKEN_PHASE_C_PROFILE)
    || index.milestone !== spec.milestone || index.owner !== 'ndrewtran'
    || index.disclosureClass !== 'public-sanitized'
    || canonicalJson(index.supersessions) !== '[]' || canonicalJson(index.recertifications) !== '[]') fail(`${name} index identity`);
  const assertions = Object.keys(spec.assertions);
  if (canonicalJson(index.records.map(({ assertionId }) => assertionId)) !== canonicalJson(assertions)) fail(`${name} assertions`);
  const expectedFiles = ['index.json', 'validation.json', ...spec.resultKeys.map((key) => `validation/${key}.txt`),
    ...assertions.map((id) => `artifacts/${id}.json`), ...assertions.map((id) => `records/${id}.json`)].sort();
  if (canonicalJson(await listTaleTokenPhaseCV2Files(join(root, relativeRoot))) !== canonicalJson(expectedFiles)) fail(`${name} file set`);
  const manifest = await pathManifestAtRevision(root, expected.sourceRevision, TALE_TOKEN_PHASE_C_V2_APPLICABILITY_PATHS);
  if (canonicalJson(index.applicabilityManifest) !== canonicalJson(manifest)) fail(`${name} applicability`);
  const validationBytes = await readFile(join(root, index.validation.path));
  if (prefixed(validationBytes) !== index.validation.sha256) fail(`${name} validation digest`);
  const validation = parseJsonStrict(validationBytes.toString('utf8'));
  const proofTool = await proofToolIdentityAtRevision(root, expected.sourceRevision, expected.sourceTree);
  if (validation.sourceRevision !== expected.sourceRevision || validation.sourceTree !== expected.sourceTree
    || validation.executedRevision !== expected.sourceRevision || validation.executedTree !== expected.sourceTree
    || canonicalJson(validation.proofTool) !== canonicalJson(proofTool)
    || canonicalJson(validation.applicabilityProfile) !== canonicalJson(TALE_TOKEN_PHASE_C_PROFILE)
    || validation.captureProcedure !== `node tests/evidence/capture-tale-token-phase-c-v2.mjs --source ${expected.sourceRevision} --tree ${expected.sourceTree} --timestamp ${expected.timestamp}`
    || canonicalJson(validation.results.map(({ command }) => command)) !== canonicalJson(spec.resultKeys.map((key) => TALE_TOKEN_PHASE_C_V2_COMMANDS[key].join(' ')))) fail(`${name} validation identity`);
  for (const reference of index.records) {
    const recordBytes = await readFile(join(root, reference.path));
    if (prefixed(recordBytes) !== reference.sha256) fail(`${name} record digest`);
    const record = parseJsonStrict(recordBytes.toString('utf8'));
    const artifactBytes = await readFile(join(root, record.artifact.path));
    if (prefixed(artifactBytes) !== record.artifact.sha256) fail(`${name} artifact digest`);
    const artifact = parseJsonStrict(artifactBytes.toString('utf8'));
    if (record.assertionId !== reference.assertionId || artifact.assertionId !== reference.assertionId
      || record.evidenceKind !== spec.assertions[reference.assertionId] || artifact.evidenceKind !== record.evidenceKind
      || record.sourceRevision !== expected.sourceRevision || record.executedRevision !== expected.sourceRevision
      || artifact.sourceRevision !== expected.sourceRevision || artifact.executedRevision !== expected.sourceRevision
      || record.sourceTree !== expected.sourceTree || record.executedTree !== expected.sourceTree
      || artifact.sourceTree !== expected.sourceTree || artifact.executedTree !== expected.sourceTree
      || canonicalJson(record.applicabilityProfile) !== canonicalJson(TALE_TOKEN_PHASE_C_PROFILE)
      || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(TALE_TOKEN_PHASE_C_PROFILE)
      || canonicalJson(record.applicabilityManifest) !== canonicalJson(manifest)
      || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(manifest)
      || canonicalJson(record.validation) !== canonicalJson(index.validation)
      || record.retentionPolicy !== TALE_TOKEN_PHASE_C_V2_RETENTION || record.expiry !== TALE_TOKEN_PHASE_C_V2_EXPIRY
      || record.captureTimestamp !== expected.timestamp || artifact.captureTimestamp !== expected.timestamp) fail(`${name} proof relation`);
  }
  return index;
}

export async function assertTaleTokenPhaseCV2RootSet(root, expected) {
  const indexes = [];
  for (const relativeRoot of TALE_TOKEN_PHASE_C_V2_ROOT_PATHS) indexes.push({
    name: relativeRoot.split('/').at(-1),
    index: await assertTaleTokenPhaseCV2Root(root, relativeRoot, expected),
  });
  assertTaleTokenPhaseCV2IndexSet(indexes);
  const gate = indexes.at(-1).index;
  const gateRecord = parseJsonStrict(await readFile(join(root, gate.records[0].path), 'utf8'));
  const artifact = parseJsonStrict(await readFile(join(root, gateRecord.artifact.path), 'utf8'));
  const expectedPaths = ['tests/evidence/g0.0/index.json', ...TALE_TOKEN_PHASE_C_V2_ROOT_PATHS.slice(0, 5).map((path) => `${path}/index.json`)];
  if (canonicalJson(artifact.observations?.upstreamEvidence?.indexes?.map(({ path }) => path)) !== canonicalJson(expectedPaths)) fail('Gate 0 upstream root set');
  let assertionCount = 0;
  for (const reference of artifact.observations.upstreamEvidence.indexes) {
    const bytes = await readFile(join(root, reference.path));
    assertionCount += parseJsonStrict(bytes.toString('utf8')).records.length;
    const profileDigest = reference.path === 'tests/evidence/g0.0/index.json' ? null : TALE_TOKEN_PHASE_C_V2_PROFILE_DIGEST;
    if (reference.sha256 !== prefixed(bytes) || reference.profileDigest !== profileDigest) fail('Gate 0 upstream digest');
  }
  if (artifact.observations.upstreamEvidence.assertionCount !== assertionCount) fail('Gate 0 upstream assertion count');
  return indexes;
}

export async function assertTaleTokenPhaseCV2CommitTopology(root, expected, { allowUncommitted = false } = {}) {
  const sourceTree = (await git(root, ['rev-parse', `${expected.sourceRevision}^{tree}`])).trim();
  if (sourceTree !== expected.sourceTree) fail('source revision/tree mismatch');
  const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
  if (allowUncommitted && head === expected.sourceRevision) {
    return { state: 'uncommitted-capture', sourceRevision: expected.sourceRevision, sourceTree };
  }
  const indexPaths = TALE_TOKEN_PHASE_C_V2_ROOT_PATHS.map((path) => `${path}/index.json`);
  const additions = (await git(root, [
    'log', '--full-history', '--format=%H', '--diff-filter=A', 'HEAD', '--', ...indexPaths,
  ])).trim().split('\n').filter(Boolean);
  const uniqueAdditions = [...new Set(additions)];
  if (uniqueAdditions.length !== 1) fail('roots must have one reachable introduction commit');
  const evidenceRevision = uniqueAdditions[0];
  const parents = (await git(root, ['show', '-s', '--format=%P', evidenceRevision])).trim().split(' ').filter(Boolean);
  if (canonicalJson(parents) !== canonicalJson([expected.sourceRevision])) {
    fail('evidence introduction must have the frozen source as its sole parent');
  }
  const changed = (await git(root, [
    'diff-tree', '--no-commit-id', '--name-status', '-r', evidenceRevision,
  ])).trim().split('\n').filter(Boolean).map((line) => {
    const [status, path] = line.split('\t');
    return { path, status };
  });
  if (changed.length === 0 || changed.some(({ path, status }) => (
    status !== 'A' || !TALE_TOKEN_PHASE_C_V2_ROOT_PATHS.some((rootPath) => path?.startsWith(`${rootPath}/`))
  ))) fail('evidence introduction must add only the six v2 roots');
  for (const rootPath of TALE_TOKEN_PHASE_C_V2_ROOT_PATHS) {
    const introductionTree = (await git(root, ['rev-parse', `${evidenceRevision}:${rootPath}`])).trim();
    const reviewedTree = (await git(root, ['rev-parse', `HEAD:${rootPath}`])).trim();
    if (introductionTree !== reviewedTree) fail('v2 roots must remain byte-identical to their introduction');
  }
  return { evidenceRevision, sourceRevision: expected.sourceRevision, sourceTree, state: 'committed' };
}
