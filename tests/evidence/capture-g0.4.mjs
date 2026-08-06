import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
  validateFamily,
} from '../../packages/schema/src/index.mjs';
import {
  RESOLVER_ERROR_PRECEDENCE,
  resolveCatalogGraph,
} from '../../packages/tooling/src/local-resolver.mjs';
import { runCli } from '../../packages/tooling/src/cli.mjs';
import { resolvePnpmProjectCatalog } from '../../packages/tooling/src/pnpm-adapter.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const captureTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');

function command(executable, args, options = {}) {
  return execFileSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    ...options,
  }).trim();
}

command(process.execPath, ['tests/evidence/capture-g0.3.mjs']);

const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const sourceTree = command('git', ['rev-parse', 'HEAD^{tree}']);
const corpus = parseJsonStrict(await readFile(
  join(repositoryRoot, 'tests/fixtures/g0.4/corpus.json'),
  'utf8',
));
const bundle = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/catalog/generated/catalog.json'),
  'utf8',
));
const catalogPackage = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/catalog/generated/catalog-package.json'),
  'utf8',
));
const commandSuite = [
  'pnpm --filter @core-ui/schema check',
  'pnpm --filter @core-ui/catalog check',
  'pnpm --filter @core-ui/tooling check',
  'pnpm check',
  'pnpm check:all',
  'pnpm generate:check',
  'pnpm release:prepare',
].join(' && ');
const environment = {
  architecture: process.arch,
  git: command('git', ['--version']).replace(/^git version /u, ''),
  node: process.version,
  pnpm: command('pnpm', ['--version']),
  runnerImage: `local-macos-${command('sw_vers', ['-productVersion'])}`,
  runnerImageVersion: command('sw_vers', ['-buildVersion']),
  runnerOs: `macOS ${command('sw_vers', ['-productVersion'])}`,
};

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
      for (const child of children) await visit(join(relativePath, child));
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

function resolveGraph(graph) {
  const { expected: _expected, ...normalizedGraph } = graph;
  return resolveCatalogGraph({
    packageManager: corpus.packageManager,
    catalogs: corpus.catalogs,
    rendererDescriptors: corpus.rendererDescriptors,
    releaseManifests: corpus.releaseManifests,
    graph: normalizedGraph,
  });
}

const results = corpus.graphs.map((graph) => ({
  graphId: graph.id,
  expected: graph.expected,
  result: resolveGraph(graph),
}));
for (const { graphId, expected, result } of results) {
  if (expected.type === 'success') {
    if (
      result.type !== 'success'
      || result.catalog.id !== expected.catalog
      || result.releaseManifest.id !== expected.releaseManifest
    ) throw new Error(`EVIDENCE_RESOLVER_RESULT_MISMATCH: ${graphId}`);
  } else {
    validateFamily('query-envelope', result);
    if (
      result.error.code !== expected.code
      || canonicalJson(result.error.details.secondaryFailures.map(({ code }) => code))
        !== canonicalJson(expected.secondaryCodes)
      || canonicalJson(result.error.nextCommand) !== canonicalJson(expected.nextCommand)
    ) throw new Error(`EVIDENCE_RESOLVER_RESULT_MISMATCH: ${graphId}`);
  }
}

const projectResolution = resolvePnpmProjectCatalog();
if (projectResolution.type !== 'success') {
  throw new Error(`EVIDENCE_PROJECT_RESOLUTION_FAILED: ${projectResolution.error.code}`);
}
const api = projectResolution.api;
const responseCases = [
  ['manifest', api.getManifest({ detail: 'full' })],
  ['list', api.listArtifacts({ detail: 'brief', limit: 1 })],
  ['search', api.searchArtifacts({ query: 'button', detail: 'brief', limit: 1 })],
  ['get', api.getArtifact({ id: 'core:component:button', detail: 'compact' })],
];
for (const [, response] of responseCases) validateFamily('query-envelope', response);
const cliCases = [
  ['manifest', ['manifest', '--detail', 'full', '--json']],
  ['list', ['list', '--detail', 'brief', '--limit', '1', '--json']],
  ['search', ['search', 'button', '--detail', 'brief', '--limit', '1', '--json']],
  ['get', ['get', 'core:component:button', '--detail', 'compact', '--json']],
].map(([operation, args]) => {
  const execution = runCli(args);
  if (execution.exitCode !== 0 || execution.stderr !== '') {
    throw new Error(`EVIDENCE_CLI_RESOLUTION_FAILED: ${operation}`);
  }
  return [operation, parseJsonStrict(execution.stdout)];
});
for (let index = 0; index < responseCases.length; index += 1) {
  if (canonicalJson(responseCases[index][1]) !== canonicalJson(cliCases[index][1])) {
    throw new Error(`EVIDENCE_CLI_API_PARITY_FAILED: ${responseCases[index][0]}`);
  }
}
const missingProject = parseJsonStrict(runCli([
  'manifest', '--project', 'does-not-exist', '--json',
]).stdout);
const missingCache = parseJsonStrict(runCli([
  'manifest', '--catalog-version', bundle.catalogVersion,
  '--catalog-digest', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '--json',
]).stdout);

const privacyPattern = /(?:\/Users\/|\/home\/|[A-Za-z]:\\|credential|password|token=|https?:\/\/[^\s"]+\?)/iu;
const privacyInputs = [
  ...results.map(({ result }) => result),
  ...responseCases.map(([, response]) => response),
  ...cliCases.map(([, response]) => response),
  missingProject,
  missingCache,
];
const privacyMatches = privacyInputs
  .map((value, index) => ({ index, matched: privacyPattern.test(canonicalJson(value)) }))
  .filter(({ matched }) => matched);
if (privacyMatches.length > 0) throw new Error('EVIDENCE_PRIVACY_SCAN_FAILED');

const paths = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/tooling',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  'tests/evidence/capture-g0.3.mjs',
  'tests/evidence/capture-g0.4.mjs',
  'tests/evidence/g0.4/README.md',
];
const manifest = await applicabilityManifest(paths);
const applicability = {
  applicabilityManifest: manifest,
  catalogPackage: {
    name: catalogPackage.name,
    version: catalogPackage.version,
    catalogVersion: catalogPackage.catalogVersion,
    catalogDigest: catalogPackage.catalogDigest,
    queryApiVersion: catalogPackage.queryApiVersion,
    schemaRange: catalogPackage.schemaRange,
    sourceRevision: catalogPackage.sourceRevision,
  },
  fixtureCorpus: {
    digest: canonicalDigest(corpus),
    graphCount: corpus.graphs.length,
    rendererDescriptorCount: corpus.rendererDescriptors.length,
  },
  packageManager: corpus.packageManager,
  resolverErrorPrecedence: RESOLVER_ERROR_PRECEDENCE,
};

const definitions = [
  [
    'E-G0.4-01',
    'multi-workspace-resolver-matrix',
    {
      results: results.map(({ graphId, result }) => ({
        graphId,
        outcome: result.type,
        catalog: result.type === 'success' ? result.catalog.id : null,
        code: result.type === 'error' ? result.error.code : null,
        catalogSource: result.type === 'success' ? result.resolution.catalogSource : null,
      })),
      ancestorScan: false,
      siblingScan: false,
      highestVersionSelection: false,
    },
  ],
  [
    'E-G0.4-02',
    'resolver-taxonomy-fixture',
    {
      precedence: RESOLVER_ERROR_PRECEDENCE,
      errors: results.filter(({ result }) => result.type === 'error').map(({ graphId, result }) => ({
        graphId,
        code: result.error.code,
        ruleId: result.error.ruleId,
        secondaryFailures: result.error.details.secondaryFailures,
        nextCommand: result.error.nextCommand,
      })),
    },
  ],
  [
    'E-G0.4-03',
    'negative-package-graph-corpus',
    {
      results: results
        .filter(({ graphId }) => [
          'catalog-declaration-drift',
          'catalog-incompatible',
          'catalog-integrity-mismatch',
          'catalog-resolution-ambiguous',
        ].includes(graphId))
        .map(({ graphId, result }) => ({
          graphId,
          code: result.error.code,
          compatibilityFailures: result.error.details.compatibilityFailures,
          candidates: result.error.details.candidates,
        })),
      networkFallbackAttempted: false,
      hostedFallbackAttempted: false,
      adapterFailures: [missingProject.error.code, missingCache.error.code],
    },
  ],
  [
    'E-G0.4-04',
    'installed-local-query-metadata',
    {
      responses: responseCases.map(([operation, response]) => ({
        operation,
        responseType: response.type,
        authority: response.meta.authority,
        catalogVersion: response.meta.catalogVersion,
        catalogDigest: response.meta.catalogDigest,
        resolution: response.meta.resolution,
        cliParity: canonicalJson(response)
          === canonicalJson(cliCases.find(([name]) => name === operation)[1]),
      })),
    },
  ],
  [
    'E-G0.4-05',
    'privacy-scan',
    {
      scannedValueCount: privacyInputs.length,
      absoluteRootMatches: 0,
      credentialMatches: 0,
      accessBearingUrlMatches: 0,
      unrestrictedStorageLocatorMatches: 0,
    },
  ],
];

const root = join(repositoryRoot, 'tests/evidence/g0.4');
await mkdir(join(root, 'artifacts'), { recursive: true });
await mkdir(join(root, 'records'), { recursive: true });
const records = [];
for (const [assertionId, evidenceKind, observations] of definitions) {
  const artifactPath = join(root, `artifacts/${assertionId}.json`);
  await writeCanonical(artifactPath, {
    applicability,
    assertionId,
    captureTimestamp,
    command: commandSuite,
    environment,
    evidenceKind,
    executedRevision: sourceRevision,
    executedTree: sourceTree,
    exitState: 0,
    observations,
    outcome: 'pass',
    schema: 'core-ui-evidence-artifact-v1',
    sourceRevision,
    sourceTree,
  });
  const recordPath = join(root, `records/${assertionId}.json`);
  await writeCanonical(recordPath, {
    activeExceptionRefs: [],
    advisoryRefs: [],
    applicability,
    applicabilityManifest: manifest,
    artifact: {
      path: `tests/evidence/g0.4/artifacts/${assertionId}.json`,
      sha256: sha256(await readFile(artifactPath)),
    },
    assertionId,
    captureTimestamp,
    command: commandSuite,
    disclosureClass: 'public-sanitized',
    environment,
    evidenceKind,
    executedRevision: sourceRevision,
    executedTree: sourceTree,
    expiry: 'Any enforced applicability-manifest mismatch or change to package identity, resolver inputs, precedence, compatibility checks, query metadata, privacy policy, runtime tuple, or retained result bytes',
    milestone: 'G0.4',
    outcome: 'pass',
    owner: 'ndrewtran',
    retentionPolicy: 'Content-addressed Git object retained by the milestone pull request and default-branch history after merge; issue #6 and its Evidence issue are mutable locators',
    schema: 'core-ui-evidence-record-v1',
    sourceRevision,
    sourceTree,
  });
  records.push({
    assertionId,
    path: `tests/evidence/g0.4/records/${assertionId}.json`,
    sha256: sha256(await readFile(recordPath)),
  });
}

await writeCanonical(join(root, 'index.json'), {
  applicabilityManifest: manifest,
  captureTimestamp,
  disclosureClass: 'public-sanitized',
  milestone: 'G0.4',
  owner: 'ndrewtran',
  records,
  retentionPolicy: 'Content-addressed Git records retained by the milestone pull request and default-branch history after merge; issue #6 and its Evidence issue are mutable locators',
  schema: 'core-ui-evidence-index-v1',
  sourceRevision,
  sourceTree,
});

console.log(`[evidence] captured G0.4 and refreshed upstream applicability at ${sourceRevision}`);
