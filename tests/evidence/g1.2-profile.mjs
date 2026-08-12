import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { catalogJson } from '@core-ui/catalog/bundle';
import { nativeThemeProjection } from '../../packages/react-native/generated/native-themes.mjs';
import { nativeProfileProjection } from '../../packages/react-native/generated/native-profiles.mjs';
import { assertG12PlatformSafetyFixture } from '../fixtures/g1.2/profile.mjs';
import { isIgnoredRepositoryEntry, sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';

const execFile = promisify(execFileCallback);
export const G12_ROOT = 'tests/evidence/g1.2';
export const G12_MAINTENANCE_ROOT = 'tests/evidence/authority-11-g1-2-applicability-v1';
export const G12_PROFILE = 'core-ui-g1-2-evidence-v1';
export const G12_CONTINUITY_PROFILE = 'core-ui-g1-2-applicability-continuity-capture-v1';
export const G12_SOURCE_PARENT = '9c82e330df5f7da4fde68118c5df265277e40b26';
export const G12_ASSERTIONS = Object.freeze([
  'E-G1.2-01', 'E-G1.2-02', 'E-G1.2-03', 'E-G1.2-04', 'E-G1.2-05',
]);
export const G12_PROOF_FILES = Object.freeze([
  'tests/evidence/capture-g1.2.mjs',
  'tests/evidence/g1.2-profile.mjs',
  'tests/evidence/g1.2-profile.test.mjs',
  'tests/fixtures/g1.2/profile.mjs',
  'tests/fixtures/g1.2/profile.test.mjs',
]);
export const G12_APPLICABILITY_PATHS = Object.freeze([
  'catalog',
  'decisions/0003-tale-token-classification-acceptance.json',
  'decisions/0003-tale-token-classification-annex.json',
  'decisions/0004-tale-only-reference-baseline-acceptance.json',
  'decisions/0004-tale-only-reference-baseline-annex.json',
  'decisions/0005-default-theme-token-source-identity-acceptance.json',
  'decisions/0005-default-theme-token-source-identity.json',
  'decisions/0006-phase-c-applicability-topology-acceptance.json',
  'decisions/0006-phase-c-applicability-topology.json',
  'decisions/0007-delivery-workflow-authority-acceptance.json',
  'decisions/0007-delivery-workflow-authority.json',
  'decisions/0008-g1-2-applicability-continuity-acceptance.json',
  'decisions/0008-g1-2-applicability-continuity.json',
  'package.json',
  'packages/catalog',
  'packages/foundation',
  'packages/react-native',
  'packages/schema',
  'packages/tokens',
  'packages/tooling',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'strategy/milestone-roadmap.md',
  'strategy/monorepo-architecture.md',
  'strategy/platform-safety-contract.json',
  'strategy/product-scope.md',
  'tests/fixtures/g0.4',
  'tests/fixtures/g1.0',
  'tests/fixtures/g1.2',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
  'tooling/audits/repository-policy',
]);
export const G12_DISCLOSURE_CLASS = 'public-sanitized';
export const G12_NONCLAIMS = Object.freeze([
  'component support',
  'simulator or device execution',
  'native OS behavior',
  'manual accessibility acceptance',
  'visual parity',
  'behavioral parity',
  'cross-platform equivalence',
  'React Native Web support',
  'support range',
  'package publication or release',
]);
export const G12_RETENTION = 'Content-addressed Git records retained by issue #11 pull-request and default-branch history after merge; issue #11 is a mutable locator';
export const G12_EXPIRY = 'Any accepted source/tree, Decision 0008 acceptance, applicability manifest, execution tool, environment tuple, retained result, or later G1.2 withdrawal, rejection, or accepted-digest mismatch';
export const G12_EVIDENCE_KINDS = Object.freeze({
  'E-G1.2-01': 'react-native-package-dependency-and-host-boundary-audit',
  'E-G1.2-02': 'react-native-javascript-adapter-and-accessibility-smoke-matrix',
  'E-G1.2-03': 'react-native-web-unsupported-profile-query',
  'E-G1.2-04': 'native-token-provenance-and-transform-identity',
  'E-G1.2-05': 'native-platform-safety-substrate-matrix',
});
export const G12_EXPECTED_TEST_NAMES = Object.freeze({
  'E-G1.2-01': Object.freeze(['E-G1.2-01 package graph and exports exclude web and host accidents']),
  'E-G1.2-02': Object.freeze([
    'E-G1.2-02 production React Native JavaScript substrate composes the production view primitive in the Jest native host',
    'E-G1.2-02 production React Native JavaScript substrate composes the production text primitive in the Jest native host',
    'E-G1.2-02 production React Native JavaScript substrate composes the production pressable primitive in the Jest native host',
    'E-G1.2-02 production React Native JavaScript substrate maps accessibility, announcements, focus, and responder ownership',
    'E-G1.2-02 production React Native JavaScript substrate binds every declared accessibility action to a validated handler',
    'E-G1.2-02 production React Native JavaScript substrate observes profile-specific native-module calls without claiming native OS execution',
    'E-G1.2-02 production React Native JavaScript substrate does not expose consumer switches for required native safety adaptations',
  ]),
  'E-G1.2-03': Object.freeze(['E-G1.2-03 React Native Web remains an explicit unsupported profile']),
  'E-G1.2-04': Object.freeze(['E-G1.2-04 native themes are exact @core-ui/tokens projections with no CSS authority']),
  'E-G1.2-05': Object.freeze(['E-G1.2-05 test-only fixture binds the exact compiled three-profile safety matrix']),
});
export const G12_COMMANDS = Object.freeze([
  'node --test tests/evidence/g1.2-profile.test.mjs',
  'pnpm --filter @core-ui/react-native check',
  'pnpm --filter @core-ui/react-native exec jest --config test/jest.config.cjs --runInBand --json',
  'pnpm generate:check',
  'node tooling/audits/repository-policy/src/g1-2-applicability-continuity-verify.mjs',
]);
export const G12_RESULT_KEYS = Object.freeze(['profile', 'react-native', 'native-jest', 'generation', 'continuity']);
export const G12_RETAINED_RESULT_INDEXES = Object.freeze({
  'E-G1.2-01': Object.freeze([0, 1]),
  'E-G1.2-02': Object.freeze([0, 1, 2]),
  'E-G1.2-03': Object.freeze([0, 1]),
  'E-G1.2-04': Object.freeze([0, 1, 3]),
  'E-G1.2-05': Object.freeze([0, 1]),
});

function prefixed(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new Error(`G12_PROFILE_INVALID: ${label} keys`);
  }
}

export function assertG12ExactFileSet(actual, expected, label) {
  if (canonicalJson([...actual].sort()) !== canonicalJson([...expected].sort())) {
    throw new Error(`G12_PROFILE_INVALID: ${label} file set`);
  }
}

export function assertG12ExpectedValue(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`G12_PROFILE_INVALID: ${label}`);
}

export function assertG12ExternalIdentity(actual, expected, label) {
  if (actual.sourceRevision !== expected.sourceRevision || actual.sourceTree !== expected.sourceTree
    || (expected.timestamp !== undefined && actual.timestamp !== expected.timestamp)) {
    throw new Error(`G12_PROFILE_INVALID: externally bound ${label} identity`);
  }
}

async function git(root, args, encoding = 'utf8') {
  return (await execFile('git', args, { cwd: root, encoding, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

export async function manifestEntriesAtRevision(repositoryRoot, revision, declaredPaths) {
  const names = await git(repositoryRoot, ['ls-tree', '-r', '-z', '--name-only', revision, '--', ...declaredPaths], 'buffer');
  const paths = names.toString('utf8').split('\0').filter(Boolean)
    .filter((path) => !isIgnoredRepositoryEntry(path))
    .sort((left, right) => left.localeCompare(right));
  const entries = [];
  for (const path of paths) {
    const bytes = await git(repositoryRoot, ['show', `${revision}:${path}`], 'buffer');
    entries.push({ path, sha256: prefixed(bytes) });
  }
  return entries;
}

export async function pathManifestAtRevision(repositoryRoot, revision, declaredPaths) {
  const entries = await manifestEntriesAtRevision(repositoryRoot, revision, declaredPaths);
  return {
    algorithm: 'sha256',
    paths: [...declaredPaths],
    profile: 'core-ui-path-manifest-v1',
    sha256: prefixed(canonicalJson(entries)),
  };
}

export async function assertG12SourceTopology(repositoryRoot, revision, tree) {
  if (!/^[0-9a-f]{40}$/u.test(revision) || !/^[0-9a-f]{40}$/u.test(tree)) {
    throw new Error('G12_SOURCE_TOPOLOGY_INVALID: identity');
  }
  const [resolvedTree, parents, changed] = await Promise.all([
    git(repositoryRoot, ['rev-parse', `${revision}^{tree}`]),
    git(repositoryRoot, ['show', '-s', '--format=%P', revision]),
    git(repositoryRoot, ['diff-tree', '--no-commit-id', '--name-only', '-r', revision]),
  ]);
  if (resolvedTree.trim() !== tree || parents.trim() !== G12_SOURCE_PARENT) {
    throw new Error('G12_SOURCE_TOPOLOGY_INVALID: parent or tree');
  }
  const paths = changed.trim().split('\n').filter(Boolean);
  if (paths.some((path) => path.startsWith(`${G12_ROOT}/`) || path.startsWith(`${G12_MAINTENANCE_ROOT}/`))) {
    throw new Error('G12_SOURCE_TOPOLOGY_INVALID: evidence in source');
  }
  for (const path of G12_PROOF_FILES) {
    if (!paths.includes(path)) throw new Error(`G12_SOURCE_TOPOLOGY_INVALID: missing ${path}`);
  }
}

export async function proofFileReferences(repositoryRoot, revision) {
  return Promise.all(G12_PROOF_FILES.map(async (path) => {
    const bytes = await git(repositoryRoot, ['show', `${revision}:${path}`], 'buffer');
    return { path, sha256: prefixed(bytes) };
  }));
}

export function createG12ApplicabilityProfile({ sourceRevision, sourceTree, manifest, proofFiles }) {
  return {
    applicabilityManifest: manifest,
    assertions: G12_ASSERTIONS,
    authority: {
      acceptance: {
        path: 'decisions/0008-g1-2-applicability-continuity-acceptance.json',
        sha256: 'sha256:5f0ce9837775f508bf1453f201df74b5972444801f4cee283bbdc8a67f27bc7a',
      },
      decision: {
        path: 'decisions/0008-g1-2-applicability-continuity.json',
        sha256: 'sha256:91181e70d5a6239e4eaa48d759a31af2c14422964d475af1917d005783b752af',
      },
    },
    componentSupportClaim: 'none',
    execution: { files: proofFiles, revision: sourceRevision, tree: sourceTree },
    id: 'G1.2-REACT-NATIVE-SUBSTRATE',
    nonclaims: G12_NONCLAIMS,
    platformBoundary: {
      android: 'Jest-hosted JavaScript adapter and validation-profile observation only',
      ios: 'Jest-hosted JavaScript adapter and validation-profile observation only',
      reactNativeWeb: 'unsupported',
    },
    profile: G12_PROFILE,
    source: { revision: sourceRevision, tree: sourceTree },
  };
}

export function createG12Facts({ fixture, nativeProjection, packageManifest }) {
  return {
    'E-G1.2-01': {
      package: packageManifest.name,
      private: packageManifest.private,
      publicExports: Object.keys(packageManifest.exports),
      runtimeDependencies: packageManifest.dependencies,
      forbiddenRuntimeOwners: ['@core-ui/web', 'react-dom', 'expo', 'storybook', 'browser globals', 'CSS parsers'],
    },
    'E-G1.2-02': {
      actualNativeHostExecution: false,
      accessibilityActionsRequireHandler: true,
      host: 'Jest React Native mock',
      nonclaims: G12_NONCLAIMS,
      observed: ['JS primitive composition', 'accessibility prop mapping', 'responder ownership', 'native-module call mapping'],
      unproved: ['native OS color resolution', 'native focus execution', 'assistive technology announcements', 'font metrics on device'],
    },
    'E-G1.2-03': {
      profile: 'native.react-native-web',
      strategy: 'unsupported',
      webReactParity: false,
    },
    'E-G1.2-04': {
      componentSupportClaim: nativeProjection.componentSupportClaim,
      cssAuthority: false,
      source: nativeProjection.source,
      targets: Object.fromEntries(Object.entries(nativeProjection.profiles).map(([name, value]) => [name, {
        profile: value.profile,
        themeDigest: value.themeDigest,
        tokenRequirementSetDigest: nativeProfileProjection.profiles[name].tokenRequirementSetDigest,
      }])),
    },
    'E-G1.2-05': {
      bindingRef: fixture.bindingRef,
      componentSupportClaim: fixture.componentSupportClaim,
      fixtureId: fixture.id,
      platformSafetyContractDigest: fixture.platformSafetyContractDigest,
      profileProjection: {
        bindingContentRevision: nativeProfileProjection.bindingContentRevision,
        bindingSpecRevision: nativeProfileProjection.bindingSpecRevision,
        platformSafetyContractDigest: nativeProfileProjection.platformSafetyContractDigest,
      },
      tuples: fixture.tuples,
    },
  };
}

export function assertG12Root(root, { sourceRevision, sourceTree }) {
  exactKeys(root, ['records', 'recertifications', 'schema', 'sourceRevision', 'sourceTree', 'supersessions', 'validation'], 'index');
  if (root.schema !== 'core-ui-evidence-index-v1' || root.sourceRevision !== sourceRevision
    || root.sourceTree !== sourceTree || !Array.isArray(root.supersessions) || root.supersessions.length !== 0
    || !Array.isArray(root.recertifications) || root.recertifications.length !== 0
    || !Array.isArray(root.records) || root.records.length !== 5) {
    throw new Error('G12_PROFILE_INVALID: index identity');
  }
  if (canonicalJson(root.records.map(({ assertionId }) => assertionId)) !== canonicalJson(G12_ASSERTIONS)) {
    throw new Error('G12_PROFILE_INVALID: assertion coverage');
  }
  for (const [position, record] of root.records.entries()) {
    exactKeys(record, ['assertionId', 'path', 'sha256'], `record ref ${position}`);
    const id = G12_ASSERTIONS[position];
    if (record.assertionId !== id || record.path !== `${G12_ROOT}/records/${id}.json`
      || !/^sha256:[0-9a-f]{64}$/u.test(record.sha256)) throw new Error('G12_PROFILE_INVALID: record ref');
  }
  exactKeys(root.validation, ['path', 'sha256'], 'validation ref');
  if (root.validation.path !== `${G12_ROOT}/validation.json`
    || !/^sha256:[0-9a-f]{64}$/u.test(root.validation.sha256)) throw new Error('G12_PROFILE_INVALID: validation ref');
}

export async function assertG12RootDirectory(repositoryRoot, relativeRoot = G12_ROOT, expectedIdentity) {
  const indexBytes = await readFile(join(repositoryRoot, relativeRoot, 'index.json'), 'utf8');
  const index = parseJsonStrict(indexBytes);
  assertG12Root(index, { sourceRevision: index.sourceRevision, sourceTree: index.sourceTree });
  if (expectedIdentity) assertG12ExternalIdentity(index, {
    sourceRevision: expectedIdentity.sourceRevision,
    sourceTree: expectedIdentity.sourceTree,
  }, 'source');
  const expectedFiles = [
    'index.json',
    'validation.json',
    ...G12_ASSERTIONS.map((id) => `artifacts/${id}.json`),
    ...G12_ASSERTIONS.map((id) => `records/${id}.json`),
    ...G12_RESULT_KEYS.map((key) => `validation/${key}.txt`),
  ].sort();
  const actualFiles = (await directoryManifest(join(repositoryRoot, relativeRoot))).map(({ path }) => path).sort();
  assertG12ExactFileSet(actualFiles, expectedFiles, 'root');
  const loaded = new Map();
  for (const reference of [...index.records, index.validation]) {
    const relative = reference.path.replace(`${G12_ROOT}/`, '');
    const bytes = await readFile(join(repositoryRoot, relativeRoot, relative), 'utf8');
    if (prefixed(bytes) !== reference.sha256) throw new Error(`G12_PROFILE_INVALID: digest ${relative}`);
    loaded.set(relative, parseJsonStrict(bytes));
  }
  const validation = loaded.get('validation.json');
  exactKeys(validation, [
    'applicabilityProfile', 'captureProcedure', 'environment', 'executedRevision', 'executedTree',
    'results', 'schema', 'sourceRevision', 'sourceTree',
  ], 'validation');
  if (validation.schema !== 'core-ui-evidence-validation-v1'
    || validation.sourceRevision !== index.sourceRevision || validation.sourceTree !== index.sourceTree
    || validation.executedRevision !== index.sourceRevision || validation.executedTree !== index.sourceTree
    || !Array.isArray(validation.results) || validation.results.length !== G12_COMMANDS.length
    || canonicalJson(validation.results.map(({ command }) => command)) !== canonicalJson(G12_COMMANDS)
    || validation.applicabilityProfile.profile !== G12_PROFILE
    || canonicalJson(validation.applicabilityProfile.assertions) !== canonicalJson(G12_ASSERTIONS)
    || canonicalJson(validation.applicabilityProfile.nonclaims) !== canonicalJson(G12_NONCLAIMS)) {
    throw new Error('G12_PROFILE_INVALID: validation identity');
  }
  const fixture = parseJsonStrict(await readFile(join(repositoryRoot, 'tests/fixtures/g1.2/platform-safety-native.json'), 'utf8'));
  const packageManifest = parseJsonStrict(await readFile(join(repositoryRoot, 'packages/react-native/package.json'), 'utf8'));
  const component = JSON.parse(catalogJson).artifacts.find(({ id }) => id === 'core:component:button');
  assertG12PlatformSafetyFixture(fixture, component);
  const expectedFacts = createG12Facts({ fixture, nativeProjection: nativeThemeProjection, packageManifest });
  const expectedManifest = await pathManifestAtRevision(repositoryRoot, index.sourceRevision, G12_APPLICABILITY_PATHS);
  const expectedProofFiles = await proofFileReferences(repositoryRoot, index.sourceRevision);
  const expectedProfile = createG12ApplicabilityProfile({
    manifest: expectedManifest,
    proofFiles: expectedProofFiles,
    sourceRevision: index.sourceRevision,
    sourceTree: index.sourceTree,
  });
  const captureMatch = /^node tests\/evidence\/capture-g1\.2\.mjs --source ([0-9a-f]{40}) --tree ([0-9a-f]{40}) --timestamp (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/u.exec(validation.captureProcedure);
  if (canonicalJson(validation.applicabilityProfile) !== canonicalJson(expectedProfile)
    || captureMatch?.[1] !== index.sourceRevision || captureMatch?.[2] !== index.sourceTree) {
    throw new Error('G12_PROFILE_INVALID: source-derived validation');
  }
  const captureTimestamp = captureMatch[3];
  if (expectedIdentity?.timestamp) assertG12ExternalIdentity(
    { sourceRevision: index.sourceRevision, sourceTree: index.sourceTree, timestamp: captureTimestamp },
    expectedIdentity,
    'capture',
  );
  for (const [position, result] of validation.results.entries()) {
    exactKeys(result, ['command', 'exitState', 'rawOutput'], `validation result ${position}`);
    exactKeys(result.rawOutput, ['path', 'sha256'], `validation output ${position}`);
    if (result.exitState !== 0 || result.command !== G12_COMMANDS[position]
      || !/^sha256:[0-9a-f]{64}$/u.test(result.rawOutput.sha256)
      || result.rawOutput.path !== `${G12_ROOT}/validation/${G12_RESULT_KEYS[position]}.txt`) {
      throw new Error('G12_PROFILE_INVALID: validation result');
    }
    const raw = await readFile(join(repositoryRoot, result.rawOutput.path));
    if (prefixed(raw) !== result.rawOutput.sha256) throw new Error('G12_PROFILE_INVALID: validation raw digest');
  }
  for (const assertionId of G12_ASSERTIONS) {
    const record = loaded.get(`records/${assertionId}.json`);
    exactKeys(record, [
      'activeExceptionRefs', 'advisoryRefs', 'applicabilityManifest', 'applicabilityProfile', 'artifact',
      'assertionId', 'captureTimestamp', 'command', 'disclosureClass', 'environment', 'evidenceKind',
      'executedRevision', 'executedTree', 'expiry', 'milestone', 'outcome', 'owner', 'retentionPolicy',
      'schema', 'sourceRevision', 'sourceTree', 'validation',
    ], `record ${assertionId}`);
    if (!Array.isArray(record.activeExceptionRefs) || record.activeExceptionRefs.length !== 0
      || !Array.isArray(record.advisoryRefs) || record.advisoryRefs.length !== 0
      || record.assertionId !== assertionId || record.schema !== 'core-ui-evidence-record-v1'
      || record.milestone !== 'G1.2' || record.owner !== 'ndrewtran' || record.outcome !== 'pass'
      || record.disclosureClass !== G12_DISCLOSURE_CLASS || record.evidenceKind !== G12_EVIDENCE_KINDS[assertionId]
      || record.sourceRevision !== index.sourceRevision || record.sourceTree !== index.sourceTree
      || record.executedRevision !== index.sourceRevision || record.executedTree !== index.sourceTree
      || record.captureTimestamp !== captureTimestamp
      || record.retentionPolicy !== G12_RETENTION || record.expiry !== G12_EXPIRY
      || canonicalJson(record.applicabilityProfile) !== canonicalJson(validation.applicabilityProfile)
      || canonicalJson(record.applicabilityManifest) !== canonicalJson(validation.applicabilityProfile.applicabilityManifest)
      || canonicalJson(record.validation) !== canonicalJson(index.validation)) {
      throw new Error(`G12_PROFILE_INVALID: record ${assertionId}`);
    }
    exactKeys(record.artifact, ['path', 'sha256'], `artifact ref ${assertionId}`);
    if (record.artifact.path !== `${G12_ROOT}/artifacts/${assertionId}.json`) {
      throw new Error(`G12_PROFILE_INVALID: artifact path ${assertionId}`);
    }
    const artifactRelative = `artifacts/${assertionId}.json`;
    const artifactBytes = await readFile(join(repositoryRoot, relativeRoot, artifactRelative), 'utf8');
    if (prefixed(artifactBytes) !== record.artifact.sha256) throw new Error(`G12_PROFILE_INVALID: artifact digest ${assertionId}`);
    const artifact = parseJsonStrict(artifactBytes);
    exactKeys(artifact, [
      'applicabilityManifest', 'applicabilityProfile', 'assertionId', 'captureTimestamp', 'command',
      'environment', 'evidenceKind', 'executedRevision', 'executedTree', 'exitState', 'observations',
      'outcome', 'schema', 'sourceRevision', 'sourceTree',
    ], `artifact ${assertionId}`);
    exactKeys(artifact.observations, ['facts', 'retainedResults', 'testNames'], `artifact observations ${assertionId}`);
    if (artifact.schema !== 'core-ui-evidence-artifact-v1' || artifact.assertionId !== assertionId
      || artifact.evidenceKind !== G12_EVIDENCE_KINDS[assertionId] || artifact.exitState !== 0
      || artifact.outcome !== 'pass' || artifact.sourceRevision !== index.sourceRevision
      || artifact.sourceTree !== index.sourceTree || artifact.executedRevision !== index.sourceRevision
      || artifact.executedTree !== index.sourceTree
      || artifact.captureTimestamp !== captureTimestamp
      || canonicalJson(artifact.observations.testNames) !== canonicalJson(G12_EXPECTED_TEST_NAMES[assertionId])
      || canonicalJson(artifact.observations.facts) !== canonicalJson(expectedFacts[assertionId])
      || (assertionId === 'E-G1.2-02'
        && canonicalJson(artifact.observations.facts.nonclaims) !== canonicalJson(G12_NONCLAIMS))
      || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(validation.applicabilityProfile)
      || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(validation.applicabilityProfile.applicabilityManifest)) {
      throw new Error(`G12_PROFILE_INVALID: artifact ${assertionId}`);
    }
    const retained = G12_RETAINED_RESULT_INDEXES[assertionId].map((position) => ({
      command: validation.results[position].command,
      outputSha256: validation.results[position].rawOutput.sha256,
    }));
    const expectedCommand = retained.map(({ command }) => command).join(' && ');
    if (artifact.command !== expectedCommand || record.command !== expectedCommand
      || artifact.captureTimestamp !== record.captureTimestamp
      || canonicalJson(artifact.environment) !== canonicalJson(validation.environment)
      || canonicalJson(record.environment) !== canonicalJson(validation.environment)
      || canonicalJson(artifact.observations.retainedResults) !== canonicalJson(retained)) {
      throw new Error(`G12_PROFILE_INVALID: proof relation ${assertionId}`);
    }
  }
  return index;
}

export async function assertG12MaintenanceRootDirectory(repositoryRoot, relativeRoot = G12_MAINTENANCE_ROOT, expectedIdentity) {
  const [decisionBytes, receiptBytes, indexBytes] = await Promise.all([
    readFile(join(repositoryRoot, 'decisions/0008-g1-2-applicability-continuity.json'), 'utf8'),
    readFile(join(repositoryRoot, 'decisions/0008-g1-2-applicability-continuity-acceptance.json'), 'utf8'),
    readFile(join(repositoryRoot, relativeRoot, 'index.json'), 'utf8'),
  ]);
  const decision = parseJsonStrict(decisionBytes);
  const receipt = parseJsonStrict(receiptBytes);
  const index = parseJsonStrict(indexBytes);
  if (expectedIdentity) assertG12ExternalIdentity(index, {
    sourceRevision: expectedIdentity.sourceRevision,
    sourceTree: expectedIdentity.sourceTree,
  }, 'maintenance');
  const targetFiles = decision.continuityTopology.targets.map(({ successorPath }) => successorPath.replace(`${G12_MAINTENANCE_ROOT}/`, ''));
  const expectedFiles = ['index.json', ...targetFiles].sort();
  const actualFiles = (await directoryManifest(join(repositoryRoot, relativeRoot))).map(({ path }) => path).sort();
  assertG12ExactFileSet(actualFiles, expectedFiles, 'maintenance');
  exactKeys(index, ['records', 'schema', 'sourceRevision', 'sourceTree', 'supersessions'], 'maintenance index');
  if (index.schema !== 'core-ui-evidence-index-v1' || !Array.isArray(index.records) || index.records.length !== 0
    || !Array.isArray(index.supersessions) || index.supersessions.length !== 28) {
    throw new Error('G12_PROFILE_INVALID: maintenance index identity');
  }
  const resolvedTree = (await git(repositoryRoot, ['rev-parse', `${index.sourceRevision}^{tree}`])).trim();
  if (resolvedTree !== index.sourceTree) throw new Error('G12_PROFILE_INVALID: maintenance source tree');
  for (const [position, target] of decision.continuityTopology.targets.entries()) {
    const reference = index.supersessions[position];
    exactKeys(reference, ['milestone', 'path', 'sha256'], `maintenance ref ${position}`);
    if (reference.milestone !== target.milestone || reference.path !== target.successorPath) {
      throw new Error('G12_PROFILE_INVALID: maintenance ref');
    }
    const bytes = await readFile(join(repositoryRoot, reference.path), 'utf8');
    if (prefixed(bytes) !== reference.sha256) throw new Error('G12_PROFILE_INVALID: maintenance digest');
    const current = await pathManifestAtRevision(repositoryRoot, index.sourceRevision, target.predecessorCurrentApplicabilityManifest.paths);
    const expected = {
      affectedAssertions: target.affectedAssertions,
      authorization: { path: 'decisions/0008-g1-2-applicability-continuity-acceptance.json', sha256: prefixed(receiptBytes) },
      currentApplicabilityManifest: current,
      disclosureClass: G12_DISCLOSURE_CLASS,
      effectiveAt: receipt.updatedAt,
      evidenceStatus: 'superseded',
      historicalIndex: target.historicalIndex,
      owner: 'ndrewtran',
      previousSupersession: target.predecessor,
      reasonCode: 'governing-authority-changed',
      replacementPlan: target.replacementPlan,
      replacementStatus: 'pending',
      schema: 'core-ui-evidence-applicability-supersession-v1',
      sourceRevision: index.sourceRevision,
      sourceTree: index.sourceTree,
      supersededApplicabilityManifest: target.predecessorCurrentApplicabilityManifest,
    };
    assertG12ExpectedValue(parseJsonStrict(bytes), expected, 'maintenance certificate');
  }
  return index;
}

export async function directoryManifest(root) {
  const values = [];
  async function walk(path, relative = '') {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(child, childRelative);
      else {
        const bytes = await readFile(child);
        values.push({ bytes: bytes.length, path: childRelative, sha256: prefixed(bytes) });
      }
    }
  }
  if ((await stat(root)).isDirectory()) await walk(root);
  return values;
}

export function sha256Bytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
