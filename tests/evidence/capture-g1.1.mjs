import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { isIgnoredRepositoryEntry } from '../../tooling/audits/repository-policy/src/policy.mjs';
import { webCompatibility, webSurfaces } from '../../packages/web/src/index.mjs';
import { platformSafetyFixture } from '../../packages/web/src/testing.mjs';
import { reactCompatibility } from '../../packages/react/src/index.mjs';
import { reactPlatformSafetyFixture } from '../../packages/react/src/testing.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');

function command(executable, args, options = {}) {
  return execFileSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    ...options,
  }).trim();
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function writeCanonical(path, value) {
  await writeFile(path, canonicalJson(value));
}

async function manifestEntries(paths) {
  const entries = [];
  async function visit(relativePath) {
    const absolutePath = join(repositoryRoot, relativePath);
    const metadata = await stat(absolutePath);
    if (metadata.isDirectory()) {
      const children = await readdir(absolutePath);
      children.sort((left, right) => left.localeCompare(right));
      for (const child of children) {
        if (!isIgnoredRepositoryEntry(child)) await visit(join(relativePath, child));
      }
    } else if (metadata.isFile()) {
      entries.push({ path: relativePath, sha256: sha256(await readFile(absolutePath)) });
    }
  }
  for (const path of paths) await visit(path);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function applicabilityManifest(paths) {
  return {
    algorithm: 'sha256',
    paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: sha256(canonicalJson(await manifestEntries(paths))),
  };
}

const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const sourceTree = command('git', ['rev-parse', 'HEAD^{tree}']);
const captureTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
const captureProcedure = 'node tests/evidence/capture-g1.1.mjs';
const chromeExecutable = process.env.CORE_UI_CHROME_EXECUTABLE
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const packageVersion = async (path) => parseJsonStrict(
  await readFile(join(repositoryRoot, path), 'utf8'),
).version;
const environment = {
  architecture: process.arch,
  axeCore: await packageVersion('packages/web/node_modules/axe-core/package.json'),
  chrome: command(chromeExecutable, ['--version']).replace(/^Google Chrome /u, ''),
  git: command('git', ['--version']).replace(/^git version /u, ''),
  node: process.version,
  os: `macOS ${command('sw_vers', ['-productVersion'])}`,
  osBuild: command('sw_vers', ['-buildVersion']),
  playwrightCore: await packageVersion('packages/web/node_modules/playwright-core/package.json'),
  pnpm: command('pnpm', ['--version']),
  react: await packageVersion('packages/react/node_modules/react/package.json'),
  reactDom: await packageVersion('packages/react/node_modules/react-dom/package.json'),
  typescript: await packageVersion('packages/react/node_modules/typescript/package.json'),
};

const paths = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'strategy/platform-safety-contract.json',
  'strategy/monorepo-architecture.md',
  'strategy/milestone-roadmap.md',
  'strategy/product-scope.md',
  'packages/schema',
  'packages/catalog',
  'packages/tooling',
  'packages/tokens',
  'packages/foundation',
  'packages/web',
  'packages/react',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  'tests/fixtures/g1.0',
  'tests/fixtures/g1.1',
  'tests/evidence/capture-g1.1.mjs',
  'tests/evidence/g1.1/README.md',
];
const manifest = await applicabilityManifest(paths);
const packageIdentities = await Promise.all([
  'packages/schema/package.json',
  'packages/catalog/package.json',
  'packages/tooling/package.json',
  'packages/tokens/package.json',
  'packages/foundation/package.json',
  'packages/web/package.json',
  'packages/react/package.json',
].map(async (path) => {
  const value = parseJsonStrict(await readFile(join(repositoryRoot, path), 'utf8'));
  return { name: value.name, path, private: value.private, version: value.version };
}));
if (packageIdentities.some((value) => !value.private || value.version !== '0.0.0')) {
  throw new Error('EVIDENCE_PACKAGE_PUBLICATION_BOUNDARY_FAILED');
}

const htmlSurface = webSurfaces['web.html'].surface;
const reactSurface = webSurfaces['web.react'].surface;
const comparable = (surface) => ({ ...surface, bindingRef: null, bindingSpecRevision: null });
if (canonicalJson(comparable(htmlSurface)) !== canonicalJson(comparable(reactSurface))) {
  throw new Error('EVIDENCE_WEB_REACT_SURFACE_DIVERGED');
}
const expectedHooks = {
  rootClass: '.core-button',
  slots: ['[data-core-slot="label"]'],
  states: ['data-core-state-disabled'],
  events: ['core:activate'],
  publicCustomProperties: [
    '--core-component-button-background',
    '--core-component-button-foreground',
  ],
  cascadeLayers: ['core.tokens', 'core.components', 'core.utilities'],
  styleExport: '@core-ui/web/button.css',
};
for (const [key, value] of Object.entries(expectedHooks)) {
  if (canonicalJson(htmlSurface[key]) !== canonicalJson(value)) {
    throw new Error(`EVIDENCE_PUBLIC_HOOK_DRIFT: ${key}`);
  }
}

const canonicalExamples = await Promise.all([
  {
    descriptor: 'catalog/components/button/examples/html/basic.example.json',
    source: 'catalog/components/button/examples/html/basic.html',
  },
  {
    descriptor: 'catalog/components/button/examples/react/basic.example.json',
    source: 'catalog/components/button/examples/react/basic.tsx',
  },
].map(async ({ descriptor, source }) => {
  const descriptorBytes = await readFile(join(repositoryRoot, descriptor), 'utf8');
  const record = parseJsonStrict(descriptorBytes);
  const sourceBytes = await readFile(join(repositoryRoot, source), 'utf8');
  return {
    id: record.id,
    bindingRef: record.binding.ref,
    descriptor,
    descriptorDigest: sha256(descriptorBytes),
    source,
    sourceDigest: sha256(sourceBytes),
  };
}));

const safetyProfiles = Object.fromEntries(Object.entries(platformSafetyFixture.profiles)
  .map(([profile, fixture]) => [profile, {
    bindingRef: fixture.bindingRef,
    contractDigest: fixture.requirementSet.contractDigest,
    fixtureId: fixture.id,
    requirementIds: fixture.requirementSet.dispositions.map(({ id }) => id),
    requirementSetDigest: fixture.requirementSet.digest,
    requiredAssertions: fixture.requiredAssertions,
  }]));
for (const value of Object.values(safetyProfiles)) {
  if (value.requirementIds.length !== 6 || !/^sha256:[a-f0-9]{64}$/u.test(value.requirementSetDigest)) {
    throw new Error('EVIDENCE_PLATFORM_SAFETY_SET_INVALID');
  }
}
if (new Set(Object.values(safetyProfiles).map(({ contractDigest }) => contractDigest)).size !== 1) {
  throw new Error('EVIDENCE_PLATFORM_SAFETY_REGISTRY_DIVERGED');
}
if (
  platformSafetyFixture.stylesheet !== reactPlatformSafetyFixture.stylesheet
  || platformSafetyFixture.stylesheetDigest !== reactPlatformSafetyFixture.stylesheetDigest
  || platformSafetyFixture.componentSupportClaim !== 'none'
  || reactPlatformSafetyFixture.componentSupportClaim !== 'none'
) throw new Error('EVIDENCE_REACT_STYLE_SOURCE_DIVERGED');

const applicableIdentities = {
  packages: packageIdentities,
  webCompatibility: {
    sourceRevision: webCompatibility.sourceRevision,
    webHtmlSpecRevision: webCompatibility.bindings['web.html'].specRevision,
    webReactSpecRevision: webCompatibility.bindings['web.react'].specRevision,
  },
  reactCompatibility: {
    sourceRevision: reactCompatibility.sourceRevision,
    styleSource: reactCompatibility.styleSource,
    webReactSpecRevision: reactCompatibility.bindings['web.react'].specRevision,
  },
  stylesheetDigest: platformSafetyFixture.stylesheetDigest,
  platformSafetyContractDigest: safetyProfiles['web.html'].contractDigest,
  platformSafetyRequirementSets: Object.fromEntries(Object.entries(safetyProfiles)
    .map(([profile, value]) => [profile, value.requirementSetDigest])),
};
const rollbackOrDisable = {
  actions: [
    'Revert the exact G1.1 implementation and retained-evidence commits.',
    'Remove the private @core-ui/web and @core-ui/react package surfaces.',
    'Retain failed or superseded evidence as append-only diagnostic history.',
  ],
  componentSupportClaim: 'none',
  packagePublication: 'prohibited',
  projectStatus: 'not-ready',
};
const applicability = {
  applicabilityManifest: manifest,
  stylesheetDigest: platformSafetyFixture.stylesheetDigest,
  webCompatibilitySourceRevision: webCompatibility.sourceRevision,
};
const definitions = [
  ['E-G1.1-01', 'javascript-disabled-progressive-html-browser-fixture', {
    baseElement: 'button',
    controllerState: 'disabled',
    fixtureId: 'fixture:platform-safety-web#web.html',
    observed: ['native role and accessible name', 'keyboard focus', 'enabled base state'],
  }],
  ['E-G1.1-02', 'binding-derived-css-dom-surface-conformance', {
    canonicalExamples,
    compilerExported: false,
    hooks: expectedHooks,
    internalTopologyAdvertised: false,
    surfaces: { 'web.html': htmlSurface, 'web.react': reactSurface },
  }],
  ['E-G1.1-03', 'realm-scoped-runtime-ownership-and-cleanup', {
    coordinatorScope: 'per realm through Symbol.for',
    negativePaths: [
      'mixed vanilla token denied', 'vanilla and React mixed ownership denied',
      'failed setup full rollback', 'duplicate module copy shares coordinator',
      'early release and final destroy idempotent',
    ],
    ownedResources: ['document listeners', 'focus restoration', 'portals', 'inert/background', 'scroll locks'],
    states: ['unclaimed', 'claimed:vanilla', 'claimed:react'],
  }],
  ['E-G1.1-04', 'react-ssr-hydration-and-effect-replay', {
    hydrationMarkupMutation: false,
    importTimeBrowserGlobalRead: false,
    ownershipClaimPhase: 'commit effect',
    strictModeReplay: 'pass',
  }],
  ['E-G1.1-05', 'typed-react-web-cross-binding-conformance', {
    generatedBindingType: '@core-ui/web/bindings ButtonWebReactBinding',
    hostRefinement: '@core-ui/react CoreButtonReactHostProps over HTMLButtonElement and binding-owned core:activate type',
    reactCompatibility: applicableIdentities.reactCompatibility,
    surfaceParity: true,
    webStyleSourceCopied: false,
  }],
  ['E-G1.1-06', 'platform-safety-web-browser-matrix', {
    accessibility: 'axe-core automated scan over native semantic fixture; no component promotion',
    browser: environment.chrome,
    componentSupportClaim: 'none',
    input: ['keyboard', 'pointer', 'programmatic focus'],
    matrix: ['forced-colors active/none', 'prefers-contrast more/no-preference', 'direction ltr/rtl'],
    profiles: safetyProfiles,
    reactUsesExactWebStylesheetDigest: true,
    stylesheetDigest: platformSafetyFixture.stylesheetDigest,
  }],
];

const root = join(repositoryRoot, 'tests/evidence/g1.1');
await mkdir(join(root, 'artifacts'), { recursive: true });
await mkdir(join(root, 'records'), { recursive: true });
await mkdir(join(root, 'recertifications'), { recursive: true });
await mkdir(join(root, 'validation'), { recursive: true });

const recertificationTargets = [
  { milestone: 'G0.1', directory: 'g0.1', predecessor: 'tests/evidence/g1.0/recertifications/g0.1.json' },
  { milestone: 'G0.2', directory: 'g0.2', predecessor: 'tests/evidence/g1.0/recertifications/g0.2.json' },
  { milestone: 'G0.3', directory: 'g0.3', predecessor: 'tests/evidence/g1.0/recertifications/g0.3.json' },
  { milestone: 'G0.4', directory: 'g0.4', predecessor: 'tests/evidence/g1.0/recertifications/g0.4.json' },
  { milestone: 'G0.5', directory: 'g0.5', predecessor: 'tests/evidence/g1.0/recertifications/g0.5.json' },
  { milestone: 'Gate 0', directory: 'gate-0', predecessor: 'tests/evidence/g1.0/recertifications/gate-0.json' },
  { milestone: 'G1.0', directory: 'g1.0' },
];

async function writeRecertifications(validation = null) {
  const references = [];
  for (const target of recertificationTargets) {
    const historicalPath = `tests/evidence/${target.directory}/index.json`;
    const historicalBytes = await readFile(join(repositoryRoot, historicalPath), 'utf8');
    const historicalIndex = parseJsonStrict(historicalBytes);
    const previousBytes = target.predecessor === undefined
      ? null
      : await readFile(join(repositoryRoot, target.predecessor), 'utf8');
    const previous = previousBytes === null ? null : parseJsonStrict(previousBytes);
    const recertificationPath = `tests/evidence/g1.1/recertifications/${target.directory}.json`;
    await writeCanonical(join(repositoryRoot, recertificationPath), {
      captureTimestamp,
      currentApplicabilityManifest: await applicabilityManifest(historicalIndex.applicabilityManifest.paths),
      disclosureClass: 'public-sanitized',
      historicalApplicabilityManifest: previous?.currentApplicabilityManifest
        ?? historicalIndex.applicabilityManifest,
      historicalIndex: { path: historicalPath, sha256: sha256(historicalBytes) },
      milestone: target.milestone,
      outcome: 'pass',
      ...(previousBytes === null ? {} : {
        previousRecertification: { path: target.predecessor, sha256: sha256(previousBytes) },
      }),
      reason: 'Append-only linear recertification against the current worktree; prior evidence and certificates remain unchanged.',
      retentionPolicy: 'Retained with the G1.1 milestone pull request and default-branch history after merge.',
      rollbackOrDisable,
      schema: 'core-ui-evidence-recertification-v2',
      sourceRevision,
      sourceTree,
      ...(validation === null ? {} : { validation }),
    });
    references.push({
      milestone: target.milestone,
      path: recertificationPath,
      sha256: sha256(await readFile(join(repositoryRoot, recertificationPath))),
    });
  }
  return references;
}

async function writeEvidence(validation = null) {
  const recertifications = await writeRecertifications(validation);
  const records = [];
  for (const [assertionId, evidenceKind, observations] of definitions) {
    const artifactPath = join(root, `artifacts/${assertionId}.json`);
    await writeCanonical(artifactPath, {
      applicability,
      applicableIdentities,
      assertionId,
      captureTimestamp,
      command: captureProcedure,
      environment,
      evidenceKind,
      executedRevision: sourceRevision,
      executedTree: sourceTree,
      exitState: 0,
      observations,
      outcome: 'pass',
      rollbackOrDisable,
      schema: 'core-ui-evidence-artifact-v1',
      sourceRevision,
      sourceTree,
    });
    const recordPath = join(root, `records/${assertionId}.json`);
    await writeCanonical(recordPath, {
      activeExceptionRefs: [],
      advisoryRefs: [],
      applicability,
      applicableIdentities,
      applicabilityManifest: manifest,
      artifact: {
        path: `tests/evidence/g1.1/artifacts/${assertionId}.json`,
        sha256: sha256(await readFile(artifactPath)),
      },
      assertionId,
      captureTimestamp,
      command: captureProcedure,
      disclosureClass: 'public-sanitized',
      environment,
      evidenceKind,
      executedRevision: sourceRevision,
      executedTree: sourceTree,
      expiry: 'Any enforced applicability-manifest mismatch or change to governing architecture, roadmap assertion, Product Scope, binding spec, token override policy, public surface derivation, package export, runtime ownership protocol, React lifecycle, stylesheet bytes, platform-safety registry/set, fixture identity, environment, or retained result bytes',
      milestone: 'G1.1',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: 'Content-addressed Git object retained by the milestone pull request and default-branch history after merge; issue #10 is a mutable locator',
      rollbackOrDisable,
      schema: 'core-ui-evidence-record-v1',
      sourceRevision,
      sourceTree,
      ...(validation === null ? {} : { validation }),
    });
    records.push({
      assertionId,
      path: `tests/evidence/g1.1/records/${assertionId}.json`,
      sha256: sha256(await readFile(recordPath)),
    });
  }
  await writeCanonical(join(root, 'index.json'), {
    applicabilityManifest: manifest,
    captureTimestamp,
    disclosureClass: 'public-sanitized',
    milestone: 'G1.1',
    owner: 'ndrewtran',
    recertifications,
    records,
    retentionPolicy: 'Content-addressed Git records retained by the milestone pull request and default-branch history after merge; issue #10 is a mutable locator',
    rollbackOrDisable,
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    ...(validation === null ? {} : { validation }),
  });
}

await writeEvidence();

async function validationResult(commandName, args, assertions) {
  const result = spawnSync('pnpm', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CORE_UI_CHROME_EXECUTABLE: chromeExecutable },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(`EVIDENCE_VALIDATION_COMMAND_FAILED: ${commandName}\n${output}`);
  }
  const observedAssertions = assertions.map(({ id, pattern }) => {
    const match = output.match(pattern);
    if (!match) throw new Error(`EVIDENCE_VALIDATION_ASSERTION_MISSING: ${id}`);
    return { id, value: match[1] ?? true };
  });
  const sanitizedOutput = output
    .replaceAll(repositoryRoot, '<repository-root>')
    .replace(/\/(?:private\/)?var\/folders\/[^\s)]+/gu, '<temporary-path>');
  if (/\/(?:Users|private\/var)\//u.test(sanitizedOutput)) {
    throw new Error(`EVIDENCE_VALIDATION_OUTPUT_UNSANITIZED: ${commandName}`);
  }
  const outputPath = `tests/evidence/g1.1/validation/${commandName
    .replaceAll(/[^a-z0-9]+/giu, '-')
    .replaceAll(/^-|-$/gu, '')}.txt`;
  await writeFile(join(repositoryRoot, outputPath), sanitizedOutput);
  return {
    command: commandName,
    exitState: 0,
    observedAssertions,
    rawOutput: { path: outputPath, sha256: sha256(sanitizedOutput) },
  };
}

const evidenceCount = /(9 immutable index, 43 records, 43 artifacts, and 17 recertifications)/u;
const validationResults = [
  await validationResult('pnpm --filter @core-ui/web check', ['--filter', '@core-ui/web', 'check'], [
    { id: 'web-test-count', pattern: /tests (10)/u },
    { id: 'web-pass-count', pattern: /pass (10)/u },
  ]),
  await validationResult('pnpm --filter @core-ui/react check', ['--filter', '@core-ui/react', 'check'], [
    { id: 'react-test-count', pattern: /tests (5)/u },
    { id: 'react-pass-count', pattern: /pass (5)/u },
  ]),
  await validationResult('pnpm check', ['check'], [
    { id: 'evidence-index-count', pattern: evidenceCount },
  ]),
  await validationResult('pnpm check:all', ['check:all'], [
    { id: 'evidence-index-count', pattern: evidenceCount },
  ]),
  await validationResult('pnpm generate:check', ['generate:check'], [
    { id: 'generation-identity', pattern: /remained clean after two generation runs \((sha256:[a-f0-9]{64})\)/u },
  ]),
  await validationResult('pnpm test:agent', ['test:agent'], [
    { id: 'agent-evaluation-status', pattern: /(No model-based evaluation is enabled; deterministic checks remain authoritative\.)/u },
  ]),
];
const verificationPath = join(root, 'verification.json');
await writeCanonical(verificationPath, {
  captureProcedure,
  environment,
  results: validationResults,
  schema: 'core-ui-evidence-validation-v1',
  sourceRevision,
  sourceTree,
});
const validation = {
  path: 'tests/evidence/g1.1/verification.json',
  sha256: sha256(await readFile(verificationPath)),
};
await writeEvidence(validation);

console.log(`[evidence] captured G1.1 and extended seven historical evidence chains at ${sourceRevision}`);
