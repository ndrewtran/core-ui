import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { isIgnoredRepositoryEntry, sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';

export const DEFAULT_THEME_G11_ROOT = 'tests/evidence/default-theme-g1.1';
export const DEFAULT_THEME_G11_PROFILE_SCHEMA = 'core-ui-default-theme-g1.1-evidence-profile-v1';
export const DEFAULT_THEME_G11_PRODUCT_SOURCE = Object.freeze({
  revision: 'f27b8a7ff43d08e2febc3fe5803ffa99377be773',
  tree: 'eb7432f20e4c57c3a86c298d0d838097a4beb3bd',
});
export const DEFAULT_THEME_G11_ASSERTION_IDS = Object.freeze([
  'E-G1.1-01',
  'E-G1.1-02',
  'E-G1.1-03',
  'E-G1.1-04',
  'E-G1.1-05',
  'E-G1.1-06',
]);
export const DEFAULT_THEME_G11_BROWSER_TOOLCHAIN = Object.freeze({
  axe: '4.13.0',
  playwright: '1.62.1',
});
export const DEFAULT_THEME_G11_PROOF_TOOL_FILES = Object.freeze([
  'tests/evidence/capture-default-theme-g1.1.mjs',
  'tests/evidence/default-theme-g1.1-profile.mjs',
  'tests/evidence/default-theme-g1.1-profile.test.mjs',
]);
export const DEFAULT_THEME_G11_EXECUTION_PARENT = '3da8ee392e6904f29ac3bd64e3162dd61ee21c83';
export const DEFAULT_THEME_G11_DISCLOSURE_CLASS = 'public-sanitized';
export const DEFAULT_THEME_G11_RETENTION_POLICY = 'Content-addressed Git records retained by issue #46 pull-request and default-branch history after merge; issue #46 is a mutable locator';
export const DEFAULT_THEME_G11_EXPIRY = 'Any accepted product source, execution tool, G1.0 acceptance, accepted G1.0 evidence root, applicability manifest, environment tuple, retained result, or later G1.1 withdrawal, rejection, or accepted-digest mismatch';
export const DEFAULT_THEME_G11_EVIDENCE_KINDS = Object.freeze({
  'E-G1.1-01': 'javascript-disabled-progressive-html-browser-fixture',
  'E-G1.1-02': 'binding-derived-css-dom-surface-conformance',
  'E-G1.1-03': 'realm-scoped-runtime-ownership-and-cleanup',
  'E-G1.1-04': 'react-ssr-hydration-and-effect-replay',
  'E-G1.1-05': 'typed-react-web-cross-binding-conformance',
  'E-G1.1-06': 'platform-safety-web-browser-matrix',
});
export const DEFAULT_THEME_G11_ACCEPTANCE = Object.freeze({
  acceptedPacket: Object.freeze({
    id: 'fresh-default-theme-g1.0-acceptance-v2',
    sha256: 'sha256:a6ad0e788cb1159545544d2b54286c683bb9f1178b586d5c4b2091b0af9bed64',
  }),
  authorAssociation: 'OWNER',
  bodySha256: 'sha256:ca2ce97aba2aa1e1d4c545897d7f4ef609f0b893991ae41e7e174d7a9683f86e',
  commentId: 5250457646,
  commentNodeId: 'IC_kwDOTtLjcM8AAAABOPOgLg',
  createdAt: '2026-08-11T07:49:18Z',
  decisionOwner: 'ndrewtran',
  evidenceHead: 'f2aa8a32bd0f939b69f8504319a68266299b968f',
  evidenceTree: '7a97f09975cfacb6ad2bc5dee637e678629104d1',
  indexSha256: 'sha256:a87c2aa4393362e8a97787b26ad141b78a1a4ff4d8a5411695386ad48b9d8ba2',
  mergedMain: '3da8ee392e6904f29ac3bd64e3162dd61ee21c83',
  outcome: 'accepted',
  ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
  provider: 'github',
  profileSha256: 'sha256:a1835bf7d29c153d74c3b4d32ae9cbe0619675667a68c841895519ebdaa35643',
  proofSource: 'b8d9b5dc5663b7182bbd361295c6ad8549f894e7',
  proofTree: '771ec93f6251efeb3c956ada769dcb768efb601a',
  pullRequestNumber: 52,
  repository: 'ndrewtran/core-ui',
  updatedAt: '2026-08-11T07:49:18Z',
  url: 'https://github.com/ndrewtran/core-ui/pull/52#issuecomment-5250457646',
});
export const DEFAULT_THEME_G11_UPSTREAM_G1_ROOT = Object.freeze({
  path: 'tests/evidence/default-theme-g1.0/index.json',
  sha256: 'sha256:a87c2aa4393362e8a97787b26ad141b78a1a4ff4d8a5411695386ad48b9d8ba2',
});
export const DEFAULT_THEME_G11_APPLICABILITY_PATHS = Object.freeze([
  'catalog',
  'decisions/0003-tale-token-classification-acceptance.json',
  'decisions/0003-tale-token-classification-annex.json',
  'decisions/0004-tale-only-reference-baseline-acceptance.json',
  'decisions/0004-tale-only-reference-baseline-annex.json',
  'decisions/0005-default-theme-token-source-identity-acceptance.json',
  'decisions/0005-default-theme-token-source-identity.json',
  'decisions/0006-phase-c-applicability-topology-acceptance.json',
  'decisions/0006-phase-c-applicability-topology.json',
  'package.json',
  'packages/catalog',
  'packages/foundation',
  'packages/react',
  'packages/schema',
  'packages/tokens',
  'packages/tooling',
  'packages/web',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'strategy/milestone-roadmap.md',
  'strategy/monorepo-architecture.md',
  'strategy/platform-safety-contract.json',
  'strategy/product-scope.md',
  'tests/fixtures/g0.4',
  'tests/fixtures/g1.0',
  'tests/fixtures/g1.1',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
  'tooling/audits/repository-policy',
]);
export const DEFAULT_THEME_G11_APPLICABILITY_MANIFEST = Object.freeze({
  algorithm: 'sha256',
  paths: DEFAULT_THEME_G11_APPLICABILITY_PATHS,
  profile: 'core-ui-path-manifest-v1',
  sha256: 'sha256:0a730086a7104d577968d4b490372cb410548fff0592571230e41a90eb1abf0e',
});
export const DEFAULT_THEME_G11_EXPECTED_TEST_NAMES = Object.freeze({
  'E-G1.1-01': Object.freeze([
    'E-G1.1-01 progressive fixture keeps native semantics with JavaScript disabled',
  ]),
  'E-G1.1-02': Object.freeze([
    'E-G1.1-02 machine-enumerates only binding and token-policy derived hooks',
    'E-G1.1-02 refuses nonexistent exports and non-component identities',
    'E-G1.1-02 canonical examples consume no undocumented topology',
  ]),
  'E-G1.1-03': Object.freeze([
    'E-G1.1-03 vanilla reconnect is idempotent and mixed ownership is rejected',
    'E-G1.1-03 concurrent roots share listeners and global leases then clean up',
    'E-G1.1-03 failed setup rolls every resource and root claim back',
    'E-G1.1-03 resource releases are idempotent before final teardown',
    'E-G1.1-03 duplicate package module identities share the realm coordinator',
    'E-G1.1-03 StrictMode replay and concurrent roots share effects and fully clean up',
    'E-G1.1-03 React cannot claim a vanilla-owned root',
  ]),
  'E-G1.1-04': Object.freeze([
    'E-G1.1-04 imports and server renders without browser globals',
    'E-G1.1-04 hydration claims after commit without changing public markup',
  ]),
  'E-G1.1-05': Object.freeze([
    'E-G1.1-05 React preserves the web surface and exact web stylesheet identity',
  ]),
  'E-G1.1-06': Object.freeze([
    'E-G1.1-06 binds two exact safety sets and proves web-owned browser adaptation',
  ]),
});
export const DEFAULT_THEME_G11_VALIDATION_COMMANDS = Object.freeze([
  'node --test tests/evidence/default-theme-g1.1-profile.test.mjs',
  'pnpm --filter @core-ui/web check',
  'pnpm --filter @core-ui/react check',
  'pnpm generate:check',
  'pnpm test:agent',
  'pnpm release:prepare',
  'node tooling/audits/repository-policy/src/evidence-verify.mjs',
  'pnpm check',
  'pnpm check:all',
]);
export const DEFAULT_THEME_G11_RESULT_KEYS = Object.freeze([
  'profile', 'web', 'react', 'generation', 'agent', 'release', 'evidence', 'check', 'check-all',
]);
const profileCommand = DEFAULT_THEME_G11_VALIDATION_COMMANDS[0];
export const DEFAULT_THEME_G11_RETAINED_COMMANDS = Object.freeze(Object.fromEntries(
  DEFAULT_THEME_G11_ASSERTION_IDS.map((assertionId) => [assertionId, Object.freeze([
    profileCommand,
    ...(['E-G1.1-01', 'E-G1.1-02', 'E-G1.1-03', 'E-G1.1-06'].includes(assertionId)
      ? ['pnpm --filter @core-ui/web check'] : []),
    ...(['E-G1.1-02', 'E-G1.1-03', 'E-G1.1-04', 'E-G1.1-05', 'E-G1.1-06'].includes(assertionId)
      ? ['pnpm --filter @core-ui/react check'] : []),
  ])]),
));
export const DEFAULT_THEME_G11_EXPECTED_FACTS = Object.freeze({
  'E-G1.1-01': Object.freeze({
    baseElement: 'button',
    controllerState: 'disabled',
    fixtureId: 'fixture:platform-safety-web#web.html',
    observed: Object.freeze(['native role and accessible name', 'keyboard focus', 'enabled base state']),
  }),
  'E-G1.1-02': Object.freeze({
    compilerExported: false,
    hooks: Object.freeze({
      cascadeLayers: Object.freeze(['core.tokens', 'core.components', 'core.utilities']),
      events: Object.freeze(['core:activate']),
      publicCustomProperties: Object.freeze(['--core-component-button-background', '--core-component-button-foreground']),
      rootClass: '.core-button',
      slots: Object.freeze(['[data-core-slot="label"]']),
      states: Object.freeze(['data-core-state-disabled']),
      styleExport: '@core-ui/web/button.css',
    }),
    internalTopologyAdvertised: false,
    webHtmlSpecRevision: 'sha256:15e31198000068d6dd2cece6a40a14f036c22368c6f058a2616340f6d78391b0',
    webReactSpecRevision: 'sha256:8d37bc27dcdf3d71b8662514f4178308a057770e68003299c06218a840dcc011',
  }),
  'E-G1.1-03': Object.freeze({
    coordinatorScope: 'per realm through Symbol.for',
    negativePaths: Object.freeze([
      'mixed vanilla token denied', 'vanilla and React mixed ownership denied',
      'failed setup full rollback', 'duplicate module copy shares coordinator',
      'early release and final destroy idempotent',
    ]),
    ownedResources: Object.freeze(['document listeners', 'focus restoration', 'portals', 'inert/background', 'scroll locks']),
    states: Object.freeze(['unclaimed', 'claimed:vanilla', 'claimed:react']),
  }),
  'E-G1.1-04': Object.freeze({
    hydrationMarkupMutation: false,
    importTimeBrowserGlobalRead: false,
    ownershipClaimPhase: 'commit effect',
    strictModeReplay: 'pass',
  }),
  'E-G1.1-05': Object.freeze({
    generatedBindingType: '@core-ui/web/bindings ButtonWebReactBinding',
    hostRefinement: '@core-ui/react CoreButtonReactHostProps over HTMLButtonElement and binding-owned core:activate type',
    styleSource: '@core-ui/web/button.css',
    surfaceParity: true,
    webStyleSourceCopied: false,
  }),
  'E-G1.1-06': Object.freeze({
    browserMatrix: Object.freeze(['forced-colors active/none', 'prefers-contrast more/no-preference', 'direction ltr/rtl']),
    componentSupportClaim: 'none',
    platformSafetyContractDigest: 'sha256:4ce80ab4d5ee2ebd9db45265b0ab9e5ce56dc18f3c59f17548bc680648705d97',
    reactUsesExactWebStylesheetDigest: true,
    requirementSetDigests: Object.freeze({
      'web.html': 'sha256:472c0ffe34597ba24cafd0bef70c71ecb8d137f08b89193d8571fb51629d05cf',
      'web.react': 'sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25',
    }),
    requiredAssertions: Object.freeze(['system.forced-colors', 'system.high-contrast', 'layout.direction']),
    stylesheetDigest: 'sha256:7a7a339f1d820f7594638382fa99f98beb38b170d5f8d1e50b0bbe1a6c5d772e',
  }),
});

export function defaultThemeG11CaptureProcedure({
  sourceRevision, sourceTree, executedRevision, executedTree, timestamp: captureTimestamp,
}) {
  return [
    'node tests/evidence/capture-default-theme-g1.1.mjs',
    `--source ${sourceRevision}`,
    `--tree ${sourceTree}`,
    `--executed ${executedRevision}`,
    `--executed-tree ${executedTree}`,
    `--timestamp ${captureTimestamp}`,
  ].join(' ');
}

const shaReference = /^sha256:[0-9a-f]{64}$/u;
const gitObject = /^[0-9a-f]{40}$/u;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const exactKeys = (value, keys) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort())
);

function defaultFail(message) {
  throw new Error(`DEFAULT_THEME_G11_PROFILE_INVALID: ${message}`);
}

export function assertDefaultThemeG11ExecutionTopology({ changes, parents, revision, tree }, fail = defaultFail) {
  const expectedChanges = DEFAULT_THEME_G11_PROOF_TOOL_FILES.map((path) => `A\t${path}`);
  if (
    !gitObject.test(revision)
    || !gitObject.test(tree)
    || canonicalJson(parents) !== canonicalJson([DEFAULT_THEME_G11_EXECUTION_PARENT])
    || canonicalJson(changes) !== canonicalJson(expectedChanges)
  ) fail('execution must be one exact three-file child of the accepted merged main');
  return { revision, tree };
}

export function assertDefaultThemeG11ExecutionFiles({ committedDigests, currentDigests, references }, fail = defaultFail) {
  for (const reference of references) {
    if (
      committedDigests[reference.path] !== reference.sha256
      || currentDigests[reference.path] !== reference.sha256
    ) fail(`${reference.path} does not match retained and current proof-tool bytes`);
  }
  return references;
}

export function assertDefaultThemeG11EvidenceMetadata({
  artifact, assertionId, environment, expectedRetainedResults, record,
}, fail = defaultFail) {
  const command = DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId]?.join(' && ');
  if (
    !Array.isArray(record.activeExceptionRefs)
    || record.activeExceptionRefs.length !== 0
    || !Array.isArray(record.advisoryRefs)
    || record.advisoryRefs.length !== 0
    || record.command !== command
    || artifact.command !== command
    || record.evidenceKind !== DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId]
    || artifact.evidenceKind !== DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId]
    || canonicalJson(record.environment) !== canonicalJson(environment)
    || canonicalJson(artifact.environment) !== canonicalJson(environment)
    || record.retentionPolicy !== DEFAULT_THEME_G11_RETENTION_POLICY
    || record.expiry !== DEFAULT_THEME_G11_EXPIRY
    || canonicalJson(artifact.observations.retainedResults) !== canonicalJson(expectedRetainedResults)
  ) fail(`${assertionId} procedure, environment, ontology, retention, or result relation is invalid`);
  return { artifact, record };
}

export function assertDefaultThemeG11Environment(value, fail = defaultFail) {
  if (!exactKeys(value, [
    'architecture', 'axe', 'browser', 'browserExecutableSha256', 'browserResolution',
    'git', 'node', 'playwright', 'pnpm', 'runnerImage', 'runnerImageVersion', 'runnerOs',
  ])) fail('environment keys must be exact');
  if (
    Object.values(value).some((entry) => typeof entry !== 'string' || entry.length === 0)
    || value.axe !== DEFAULT_THEME_G11_BROWSER_TOOLCHAIN.axe
    || value.playwright !== DEFAULT_THEME_G11_BROWSER_TOOLCHAIN.playwright
    || !/^(?:Google Chrome|Chromium) \d+\.\d+\.\d+\.\d+$/u.test(value.browser)
    || !shaReference.test(value.browserExecutableSha256)
    || !['environment-override', 'system-google-chrome'].includes(value.browserResolution)
  ) fail('browser and toolchain environment identity is invalid');
  return value;
}

export function createDefaultThemeG11Profile({ executedRevision, executedTree, toolFiles }) {
  return {
    acceptance: DEFAULT_THEME_G11_ACCEPTANCE,
    applicabilityManifest: DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
    assertionIds: DEFAULT_THEME_G11_ASSERTION_IDS,
    execution: { files: toolFiles, revision: executedRevision, tree: executedTree },
    id: 'DEFAULT-THEME-G1.1',
    productSource: DEFAULT_THEME_G11_PRODUCT_SOURCE,
    schema: DEFAULT_THEME_G11_PROFILE_SCHEMA,
    upstreamG1Root: DEFAULT_THEME_G11_UPSTREAM_G1_ROOT,
  };
}

export function assertDefaultThemeG11Profile(value, fail = defaultFail) {
  if (!exactKeys(value, [
    'acceptance', 'applicabilityManifest', 'assertionIds', 'execution', 'id',
    'productSource', 'schema', 'upstreamG1Root',
  ])) fail('profile keys must be exact');
  if (
    canonicalJson(value.acceptance) !== canonicalJson(DEFAULT_THEME_G11_ACCEPTANCE)
    || canonicalJson(value.applicabilityManifest) !== canonicalJson(DEFAULT_THEME_G11_APPLICABILITY_MANIFEST)
    || canonicalJson(value.assertionIds) !== canonicalJson(DEFAULT_THEME_G11_ASSERTION_IDS)
    || value.id !== 'DEFAULT-THEME-G1.1'
    || canonicalJson(value.productSource) !== canonicalJson(DEFAULT_THEME_G11_PRODUCT_SOURCE)
    || value.schema !== DEFAULT_THEME_G11_PROFILE_SCHEMA
    || canonicalJson(value.upstreamG1Root) !== canonicalJson(DEFAULT_THEME_G11_UPSTREAM_G1_ROOT)
  ) fail('profile fixed identity does not match');
  if (!exactKeys(value.execution, ['files', 'revision', 'tree'])) {
    fail('execution keys must be exact');
  }
  if (!gitObject.test(value.execution.revision) || !gitObject.test(value.execution.tree)) {
    fail('execution revision and tree must be full Git object IDs');
  }
  if (
    !Array.isArray(value.execution.files)
    || value.execution.files.length !== DEFAULT_THEME_G11_PROOF_TOOL_FILES.length
    || canonicalJson(value.execution.files.map(({ path }) => path))
      !== canonicalJson(DEFAULT_THEME_G11_PROOF_TOOL_FILES)
    || value.execution.files.some((reference) => (
      !exactKeys(reference, ['path', 'sha256']) || !shaReference.test(reference.sha256)
    ))
  ) fail('execution files must bind the exact proof-tool paths and digests');
  return value;
}

function assertReference(reference, expectedPath, fail) {
  if (
    !exactKeys(reference, ['path', 'sha256'])
    || reference.path !== expectedPath
    || !shaReference.test(reference.sha256)
  ) fail(`${expectedPath} reference is invalid`);
}

export function assertDefaultThemeG11IndexShape(index, fail = defaultFail) {
  if (!exactKeys(index, [
    'applicabilityManifest', 'applicabilityProfile', 'captureTimestamp', 'disclosureClass',
    'executedRevision', 'executedTree', 'milestone', 'owner', 'records',
    'recertifications', 'retentionPolicy', 'schema', 'sourceRevision', 'sourceTree',
    'supersessions', 'validation',
  ])) fail('index keys must be exact');
  assertDefaultThemeG11Profile(index.applicabilityProfile, fail);
  if (
    canonicalJson(index.applicabilityManifest) !== canonicalJson(DEFAULT_THEME_G11_APPLICABILITY_MANIFEST)
    || index.sourceRevision !== DEFAULT_THEME_G11_PRODUCT_SOURCE.revision
    || index.sourceTree !== DEFAULT_THEME_G11_PRODUCT_SOURCE.tree
    || index.executedRevision !== index.applicabilityProfile.execution.revision
    || index.executedTree !== index.applicabilityProfile.execution.tree
    || !timestamp.test(index.captureTimestamp)
    || index.captureTimestamp < DEFAULT_THEME_G11_ACCEPTANCE.updatedAt
    || index.disclosureClass !== DEFAULT_THEME_G11_DISCLOSURE_CLASS
    || index.milestone !== 'G1.1'
    || index.owner !== 'ndrewtran'
    || index.schema !== 'core-ui-evidence-index-v1'
    || !Array.isArray(index.recertifications)
    || index.recertifications.length !== 0
    || !Array.isArray(index.supersessions)
    || index.supersessions.length !== 0
    || index.retentionPolicy !== DEFAULT_THEME_G11_RETENTION_POLICY
  ) fail('index identity or topology is invalid');
  if (
    !Array.isArray(index.records)
    || canonicalJson(index.records.map(({ assertionId }) => assertionId))
      !== canonicalJson(DEFAULT_THEME_G11_ASSERTION_IDS)
  ) fail('index must bind six exact ordered assertion IDs');
  for (const [position, assertionId] of DEFAULT_THEME_G11_ASSERTION_IDS.entries()) {
    const reference = index.records[position];
    if (
      !exactKeys(reference, ['assertionId', 'path', 'sha256'])
      || reference.path !== `${DEFAULT_THEME_G11_ROOT}/records/${assertionId}.json`
      || !shaReference.test(reference.sha256)
      || reference.assertionId !== assertionId
    ) {
      fail(`${assertionId} record reference must own its assertion ID`);
    }
  }
  assertReference(index.validation, `${DEFAULT_THEME_G11_ROOT}/validation.json`, fail);
  return index;
}

async function readCanonicalJson(repositoryRoot, relativePath) {
  const bytes = await readFile(join(repositoryRoot, relativePath), 'utf8');
  const value = parseJsonStrict(bytes);
  if (bytes !== canonicalJson(value)) defaultFail(`${relativePath} is not canonical JSON`);
  return { bytes, value };
}

async function verifyReference(repositoryRoot, reference) {
  const result = await readCanonicalJson(repositoryRoot, reference.path);
  if (`sha256:${sha256(result.bytes)}` !== reference.sha256) {
    defaultFail(`${reference.path} digest does not match`);
  }
  return result.value;
}

function git(repositoryRoot, ...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

export async function manifestEntries(repositoryRoot, declaredPaths) {
  const entries = [];
  async function visit(relativePath) {
    const absolutePath = join(repositoryRoot, relativePath);
    const metadata = await stat(absolutePath);
    if (metadata.isDirectory()) {
      for (const child of (await readdir(absolutePath)).sort((left, right) => left.localeCompare(right))) {
        if (!isIgnoredRepositoryEntry(child)) await visit(join(relativePath, child));
      }
      return;
    }
    entries.push({ path: relativePath, sha256: `sha256:${sha256(await readFile(absolutePath))}` });
  }
  for (const path of declaredPaths) await visit(path);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function manifestEntriesAtRevision(repositoryRoot, revision, declaredPaths) {
  const names = git(repositoryRoot, 'ls-tree', '-r', '--name-only', revision, '--', ...declaredPaths)
    .split('\n').filter(Boolean).sort((left, right) => left.localeCompare(right));
  return names.map((path) => ({
    path,
    sha256: `sha256:${sha256(execFileSync('git', ['show', `${revision}:${path}`], {
      cwd: repositoryRoot,
    }))}`,
  }));
}

export async function assertDefaultThemeG11Root(repositoryRootInput) {
  const repositoryRoot = resolve(repositoryRootInput);
  const index = (await readCanonicalJson(repositoryRoot, `${DEFAULT_THEME_G11_ROOT}/index.json`)).value;
  assertDefaultThemeG11IndexShape(index);
  if (
    git(repositoryRoot, 'rev-parse', `${index.sourceRevision}^{tree}`) !== index.sourceTree
    || git(repositoryRoot, 'rev-parse', `${index.executedRevision}^{tree}`) !== index.executedTree
  ) defaultFail('source or execution Git tree does not match');
  const revisionLine = git(repositoryRoot, 'rev-list', '--parents', '-n', '1', index.executedRevision)
    .split(' ');
  const changes = git(
    repositoryRoot,
    'diff-tree', '--no-commit-id', '--name-status', '-r', index.executedRevision,
  ).split('\n').filter(Boolean);
  assertDefaultThemeG11ExecutionTopology({
    changes,
    parents: revisionLine.slice(1),
    revision: revisionLine[0],
    tree: index.executedTree,
  });
  const productEntries = manifestEntriesAtRevision(
    repositoryRoot,
    index.sourceRevision,
    DEFAULT_THEME_G11_APPLICABILITY_PATHS,
  );
  if (
    productEntries.length !== 194
    || Buffer.byteLength(canonicalJson(productEntries)) !== 27146
    || `sha256:${sha256(canonicalJson(productEntries))}`
      !== DEFAULT_THEME_G11_APPLICABILITY_MANIFEST.sha256
  ) defaultFail('product applicability preimage does not match');
  const currentEntries = await manifestEntries(repositoryRoot, DEFAULT_THEME_G11_APPLICABILITY_PATHS);
  if (canonicalJson(currentEntries) !== canonicalJson(productEntries)) {
    defaultFail('executed checkout has product-source applicability drift');
  }
  const committedDigests = {};
  const currentDigests = {};
  for (const reference of index.applicabilityProfile.execution.files) {
    const committed = execFileSync('git', ['show', `${index.executedRevision}:${reference.path}`], {
      cwd: repositoryRoot,
    });
    committedDigests[reference.path] = `sha256:${sha256(committed)}`;
    const current = await readFile(join(repositoryRoot, reference.path));
    currentDigests[reference.path] = `sha256:${sha256(current)}`;
  }
  assertDefaultThemeG11ExecutionFiles({
    committedDigests,
    currentDigests,
    references: index.applicabilityProfile.execution.files,
  });
  for (const reference of [DEFAULT_THEME_G11_UPSTREAM_G1_ROOT]) {
    const bytes = await readFile(join(repositoryRoot, reference.path));
    if (`sha256:${sha256(bytes)}` !== reference.sha256) {
      defaultFail(`${reference.path} does not match accepted G1.0`);
    }
  }
  const validation = await verifyReference(repositoryRoot, index.validation);
  if (!exactKeys(validation, [
    'applicabilityProfile', 'captureProcedure', 'environment', 'executedRevision',
    'executedTree', 'results', 'schema', 'sourceRevision', 'sourceTree',
  ])) defaultFail('validation keys must be exact');
  if (
    canonicalJson(validation.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
    || validation.sourceRevision !== index.sourceRevision
    || validation.sourceTree !== index.sourceTree
    || validation.executedRevision !== index.executedRevision
    || validation.executedTree !== index.executedTree
    || validation.captureProcedure !== defaultThemeG11CaptureProcedure({
      sourceRevision: index.sourceRevision,
      sourceTree: index.sourceTree,
      executedRevision: index.executedRevision,
      executedTree: index.executedTree,
      timestamp: index.captureTimestamp,
    })
    || validation.schema !== 'core-ui-evidence-validation-v1'
    || !Array.isArray(validation.results)
    || validation.results.length !== DEFAULT_THEME_G11_RESULT_KEYS.length
    || canonicalJson(validation.results.map(({ command }) => command))
      !== canonicalJson(DEFAULT_THEME_G11_VALIDATION_COMMANDS)
  ) defaultFail('validation identity or exact result count is invalid');
  assertDefaultThemeG11Environment(validation.environment);
  for (const [position, result] of validation.results.entries()) {
    if (
      !exactKeys(result, ['command', 'exitState', 'rawOutput'])
      || result.exitState !== 0
      || !exactKeys(result.rawOutput, ['path', 'sha256'])
      || !shaReference.test(result.rawOutput.sha256)
      || result.rawOutput.path !== `${DEFAULT_THEME_G11_ROOT}/validation/${DEFAULT_THEME_G11_RESULT_KEYS[position]}.txt`
    ) {
      defaultFail('validation result shape or exit state is invalid');
    }
    const bytes = await readFile(join(repositoryRoot, result.rawOutput.path));
    if (`sha256:${sha256(bytes)}` !== result.rawOutput.sha256) {
      defaultFail(`${result.rawOutput.path} does not match validation digest`);
    }
  }
  const validationResults = new Map(validation.results.map((result) => [result.command, result]));
  for (const [position, reference] of index.records.entries()) {
    const assertionId = DEFAULT_THEME_G11_ASSERTION_IDS[position];
    const record = await verifyReference(repositoryRoot, reference);
    if (!exactKeys(record, [
      'activeExceptionRefs', 'advisoryRefs', 'applicabilityManifest',
      'applicabilityProfile', 'artifact', 'assertionId', 'captureTimestamp', 'command',
      'disclosureClass', 'environment', 'evidenceKind', 'executedRevision', 'executedTree',
      'expiry', 'milestone', 'outcome', 'owner', 'retentionPolicy', 'schema',
      'sourceRevision', 'sourceTree', 'validation',
    ])) defaultFail(`${assertionId} record keys must be exact`);
    if (
      record.assertionId !== assertionId
      || record.captureTimestamp !== index.captureTimestamp
      || record.sourceRevision !== index.sourceRevision
      || record.sourceTree !== index.sourceTree
      || record.executedRevision !== index.executedRevision
      || record.executedTree !== index.executedTree
      || canonicalJson(record.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
      || canonicalJson(record.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
      || canonicalJson(record.validation) !== canonicalJson(index.validation)
      || record.command !== DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].join(' && ')
      || canonicalJson(record.environment) !== canonicalJson(validation.environment)
      || record.evidenceKind !== DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId]
      || record.retentionPolicy !== DEFAULT_THEME_G11_RETENTION_POLICY
      || record.expiry !== DEFAULT_THEME_G11_EXPIRY
      || record.outcome !== 'pass'
      || record.milestone !== 'G1.1'
      || record.schema !== 'core-ui-evidence-record-v1'
      || record.owner !== 'ndrewtran'
      || record.disclosureClass !== DEFAULT_THEME_G11_DISCLOSURE_CLASS
      || record.activeExceptionRefs.length !== 0
      || record.advisoryRefs.length !== 0
    ) defaultFail(`${assertionId} record identity is invalid`);
    assertReference(record.artifact, `${DEFAULT_THEME_G11_ROOT}/artifacts/${assertionId}.json`, defaultFail);
    const artifact = await verifyReference(repositoryRoot, record.artifact);
    if (!exactKeys(artifact, [
      'applicabilityManifest', 'applicabilityProfile', 'assertionId', 'captureTimestamp',
      'command', 'environment', 'evidenceKind', 'executedRevision', 'executedTree',
      'exitState', 'observations', 'outcome', 'schema', 'sourceRevision', 'sourceTree',
    ])) defaultFail(`${assertionId} artifact keys must be exact`);
    if (
      artifact.assertionId !== assertionId
      || artifact.captureTimestamp !== index.captureTimestamp
      || artifact.sourceRevision !== index.sourceRevision
      || artifact.sourceTree !== index.sourceTree
      || artifact.executedRevision !== index.executedRevision
      || artifact.executedTree !== index.executedTree
      || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
      || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
      || artifact.command !== record.command
      || canonicalJson(artifact.environment) !== canonicalJson(validation.environment)
      || artifact.evidenceKind !== DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId]
      || artifact.exitState !== 0
      || artifact.outcome !== 'pass'
      || artifact.schema !== 'core-ui-evidence-artifact-v1'
      || !exactKeys(artifact.observations, ['facts', 'retainedResults', 'testNames'])
      || !Array.isArray(artifact.observations.retainedResults)
      || artifact.observations.retainedResults.length
        !== DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].length
      || artifact.observations.retainedResults.some((result) => (
        !exactKeys(result, ['command', 'outputSha256'])
        || !DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].includes(result.command)
        || !shaReference.test(result.outputSha256)
      ))
      || canonicalJson(artifact.observations.retainedResults)
        !== canonicalJson(DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].map((command) => ({
          command,
          outputSha256: validationResults.get(command)?.rawOutput.sha256,
        })))
      || canonicalJson(artifact.observations.testNames)
        !== canonicalJson(DEFAULT_THEME_G11_EXPECTED_TEST_NAMES[assertionId])
      || canonicalJson(artifact.observations.facts)
        !== canonicalJson(DEFAULT_THEME_G11_EXPECTED_FACTS[assertionId])
    ) defaultFail(`${assertionId} artifact identity or observations are invalid`);
    assertDefaultThemeG11EvidenceMetadata({
      artifact,
      assertionId,
      environment: validation.environment,
      expectedRetainedResults: DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId].map((command) => ({
        command,
        outputSha256: validationResults.get(command)?.rawOutput.sha256,
      })),
      record,
    });
  }
  return {
    assertionCount: DEFAULT_THEME_G11_ASSERTION_IDS.length,
    executedRevision: index.executedRevision,
    profileDigest: canonicalDigest(index.applicabilityProfile),
    sourceRevision: index.sourceRevision,
  };
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  try {
    const result = await assertDefaultThemeG11Root(repositoryRoot);
    console.log(`[G1.1] verified ${result.assertionCount} exact records at ${result.sourceRevision} using ${result.executedRevision}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
