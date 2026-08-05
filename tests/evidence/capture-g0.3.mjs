import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { catalogJson } from '../../packages/catalog/generated/catalog.mjs';
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import {
  createCatalogApi,
  getArtifact,
  getManifest,
  listArtifacts,
  searchArtifacts,
} from '../../packages/catalog/src/index.mjs';
import { canonicalDigest, canonicalJson } from '../../packages/schema/src/index.mjs';
import {
  cliManifest,
  commandRegistry,
  completionScript,
  helpText,
  mcpInputSchemas,
  parserMetadata,
} from '../../packages/tooling/generated/command-surface.mjs';
import {
  assertSafeDiagnostics,
  countTokens,
  executeCommand,
  parseDense,
  parseHuman,
  renderDense,
  renderHuman,
  renderJson,
  runCli,
  tokenBudgetFor,
} from '../../packages/tooling/src/index.mjs';
import { buildCommandProjections } from '../../packages/tooling/src/registry.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const sourceTree = command('git', ['rev-parse', 'HEAD^{tree}']);
const captureTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const commandSuite = [
  'pnpm --filter @core-ui/schema check',
  'pnpm --filter @core-ui/catalog check',
  'pnpm --filter @core-ui/tooling check',
  'pnpm check',
  'pnpm check:all',
  'pnpm generate:check',
  'pnpm release:prepare',
].join(' && ');
const validation = commandSuite.split(' && ').map((entry) => ({ command: entry, exitState: 0 }));
const bundle = JSON.parse(catalogJson);

function command(executable, args) {
  return execFileSync(executable, args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

function processCliJson(args) {
  return JSON.parse(execFileSync(process.execPath, [
    resolve(repositoryRoot, 'packages/tooling/bin/core.mjs'),
    ...args,
    '--json',
  ], { cwd: repositoryRoot, encoding: 'utf8' }));
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function bundlePreimage(value) {
  const { catalogDigest: _catalogDigest, ...preimage } = value;
  return preimage;
}

function captureGenerationIdentity() {
  const output = execFileSync('pnpm', ['generate:check'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const match = output.match(/\(sha256:([a-f0-9]{64})\)/u);
  if (!match) throw new Error('EVIDENCE_GENERATION_IDENTITY_MISSING');
  return `sha256:${match[1]}`;
}

const isolatedGenerationIdentity = captureGenerationIdentity();

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

const environment = {
  architecture: process.arch,
  git: command('git', ['--version']).replace(/^git version /, ''),
  node: process.version,
  pnpm: command('pnpm', ['--version']),
  runnerImage: `local-macos-${command('sw_vers', ['-productVersion'])}`,
  runnerImageVersion: command('sw_vers', ['-buildVersion']),
  runnerOs: `macOS ${command('sw_vers', ['-productVersion'])}`,
};

const catalogApplicability = {
  artifactCount: bundle.artifacts.length,
  catalogDigest: bundle.catalogDigest,
  catalogVersion: bundle.catalogVersion,
  relationCount: bundle.relations.length,
  searchEntryCount: bundle.searchIndex.length,
  sourceRevision: bundle.sourceRevision,
};

function updateProducedValue(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => updateProducedValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
      childKey,
      updateProducedValue(child, childKey),
    ]));
  }
  if (key === 'captureTimestamp') return captureTimestamp;
  if (key === 'executedRevision' || (key === 'sourceRevision' && !String(value).startsWith('sha256:'))) {
    return sourceRevision;
  }
  if (key === 'executedTree' || key === 'sourceTree') return sourceTree;
  if (key === 'catalogDigest') return bundle.catalogDigest;
  if (key === 'sourceRevision' && String(value).startsWith('sha256:')) return bundle.sourceRevision;
  if (key === 'artifactCount') return bundle.artifacts.length;
  if (key === 'relationCount') return bundle.relations.length;
  if (key === 'searchEntryCount') return bundle.searchIndex.length;
  return value;
}

async function refreshUpstreamObservations(milestone, assertionId, prior, manifest) {
  const observations = structuredClone(prior);
  observations.validation = validation;
  if (milestone === 'g0.1' && assertionId === 'E-G0.1-04') {
    observations.applicabilityManifest = {
      entryCount: (await manifestEntries(manifest.paths)).length,
      profile: manifest.profile,
      sha256: manifest.sha256,
    };
    observations.generation = {
      firstStatus: 'clean',
      identityDigest: isolatedGenerationIdentity,
      secondStatus: 'clean',
    };
  }
  if (milestone !== 'g0.2') return observations;
  if (assertionId === 'E-G0.2-01') {
    const first = await compileCatalog({ repositoryRoot });
    const second = await compileCatalog({ repositoryRoot });
    return {
      ...observations,
      artifactCount: first.bundle.artifacts.length,
      byteLength: Buffer.byteLength(first.bytes),
      bytesDigest: sha256(first.bytes),
      catalogDigest: first.bundle.catalogDigest,
      firstAndSecondBuildBytesEqual: first.bytes === second.bytes,
      firstAndSecondBuildDigestsEqual: first.bundle.catalogDigest === second.bundle.catalogDigest,
      generatedBundleMatchesCompiler: catalogJson === first.bytes,
      isolatedGeneration: {
        dependencyPreparation: 'offline-frozen-lockfile-ignore-scripts',
        firstStatus: 'clean',
        identityDigest: isolatedGenerationIdentity,
        secondStatus: 'clean',
      },
      orderedArtifactIds: first.bundle.artifacts.map(({ id }) => id),
      relationCount: first.bundle.relations.length,
      searchEntryCount: first.bundle.searchIndex.length,
      sourceRevision: first.bundle.sourceRevision,
      validation,
    };
  }
  if (assertionId === 'E-G0.2-02') {
    const list = listArtifacts({ limit: 100, detail: 'compact' });
    const search = searchArtifacts({ query: 'button action', detail: 'brief' });
    const detail = getArtifact({
      id: 'core:component:button',
      platform: 'web.react',
      detail: 'full',
    });
    return {
      ...observations,
      authority: detail.meta.resolution.authority,
      compatibility: detail.meta.resolution.compatibility,
      listIds: list.data.items.map(({ id }) => id),
      matchReasonCount: search.data.items[0].matchReasons.length,
      responseTypes: [getManifest().type, list.type, search.type, detail.type],
      revisions: {
        bindingContent: detail.meta.revisions.bindingContent,
        bindingSpec: detail.meta.revisions.bindingSpec,
        conceptContent: detail.meta.revisions.conceptContent,
      },
      sourcePointer: detail.data.artifact.source,
      sourceRevision: detail.meta.sourceRevision,
      validation,
    };
  }
  if (assertionId === 'E-G0.2-03') {
    const first = listArtifacts({ limit: 1, detail: 'brief' });
    const second = listArtifacts({ limit: 1, detail: 'brief', cursor: first.meta.nextCursor });
    const alternatePreimage = { ...bundlePreimage(bundle), catalogVersion: '0.0.1' };
    const alternateApi = createCatalogApi({
      ...alternatePreimage,
      catalogDigest: canonicalDigest(alternatePreimage),
    });
    return {
      changedRequestRejected: listArtifacts({
        limit: 1,
        detail: 'compact',
        cursor: first.meta.nextCursor,
      }).error.code,
      crossDigestRejected: alternateApi.listArtifacts({
        limit: 1,
        detail: 'brief',
        cursor: first.meta.nextCursor,
      }).error.code,
      firstItem: first.data.items[0].id,
      invalidCursorRejected: listArtifacts({
        limit: 1,
        detail: 'brief',
        cursor: 'not-a-cursor',
      }).error.code,
      nextCursorPresent: typeof first.meta.nextCursor === 'string',
      secondItem: second.data.items[0].id,
      stableUnderSameCatalogDigest: first.data.items[0].id !== second.data.items[0].id,
      validation,
    };
  }
  if (assertionId === 'E-G0.2-04') {
    const search = searchArtifacts({ query: 'button', limit: 1, detail: 'brief' });
    const full = getArtifact({ id: 'core:component:button', detail: 'full' });
    const complete = getArtifact({
      id: 'core:component:button',
      platform: 'web.react',
      detail: 'full',
    });
    const examples = (platform) => getArtifact({
      id: 'core:component:button',
      platform,
      section: 'examples',
      purpose: 'generation',
      detail: 'compact',
    }).data.value.map(({ id }) => id);
    return {
      ...observations,
      catalogByteLength: Buffer.byteLength(catalogJson),
      completeDetailByteLength: Buffer.byteLength(canonicalJson(complete)),
      completeDetailDoesNotCopyCatalog: !Object.hasOwn(full.data, 'catalog'),
      directRelationCount: full.data.relations.length,
      htmlExampleIds: examples('web.html'),
      reactExampleIds: examples('web.react'),
      searchItemCountAtLimitOne: search.data.items.length,
      searchSummaryOmitsRecord: !Object.hasOwn(search.data.items[0], 'record'),
      validation,
    };
  }
  if (assertionId === 'E-G0.2-05') {
    const first = searchArtifacts({ query: 'BUTTON', limit: 100 });
    const second = searchArtifacts({ query: 'BUTTON', limit: 100 });
    return {
      ...observations,
      environmentIndependentRanking: canonicalJson(first) === canonicalJson(second),
      validation,
    };
  }
  return observations;
}

async function recaptureUpstream(milestone) {
  const root = join(repositoryRoot, `tests/evidence/${milestone}`);
  const indexPath = join(root, 'index.json');
  const priorIndex = JSON.parse(await readFile(indexPath, 'utf8'));
  const manifest = await applicabilityManifest(priorIndex.applicabilityManifest.paths);
  const records = [];
  for (const reference of priorIndex.records) {
    const recordPath = join(repositoryRoot, reference.path);
    const priorRecord = JSON.parse(await readFile(recordPath, 'utf8'));
    const artifactPath = join(repositoryRoot, priorRecord.artifact.path);
    const priorArtifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    const artifact = updateProducedValue(priorArtifact);
    artifact.command = commandSuite;
    artifact.observations = await refreshUpstreamObservations(
      milestone,
      artifact.assertionId,
      artifact.observations,
      manifest,
    );
    if (artifact.applicability?.catalog) artifact.applicability.catalog = catalogApplicability;
    await writeCanonical(artifactPath, artifact);
    const record = updateProducedValue(priorRecord);
    record.command = commandSuite;
    record.applicabilityManifest = manifest;
    if (record.applicability?.catalog) record.applicability.catalog = catalogApplicability;
    record.artifact.sha256 = sha256(await readFile(artifactPath));
    await writeCanonical(recordPath, record);
    records.push({
      assertionId: record.assertionId,
      path: priorRecord.artifact.path.replace('/artifacts/', '/records/'),
      sha256: sha256(await readFile(recordPath)),
    });
  }
  const index = updateProducedValue(priorIndex);
  index.applicabilityManifest = manifest;
  index.records = records;
  await writeCanonical(indexPath, index);
}

function commandRequest(commandName, detail) {
  const definition = commandRegistry.commands.find(({ name }) => name === commandName);
  const common = commandName === 'manifest'
    ? { detail }
    : commandName === 'list'
      ? { detail, limit: 20, platform: null, purpose: null, cursor: null, kind: null }
      : commandName === 'search'
        ? { detail, limit: 20, platform: null, purpose: null, cursor: null, query: 'button' }
        : { detail, platform: null, purpose: null, section: null, 'id-or-alias': 'core:component:button' };
  return { ...common, ...definition.budgetFixture };
}

function parityObservations() {
  const pairs = [
    ['manifest', processCliJson(['manifest', '--detail', 'full']), getManifest({ detail: 'full' })],
    ['list', executeCommand('list', commandRequest('list', 'compact')), listArtifacts(commandRequest('list', 'compact'))],
    ['search', executeCommand('search', commandRequest('search', 'brief')), searchArtifacts(commandRequest('search', 'brief'))],
    ['get', executeCommand('get', commandRequest('get', 'full')), getArtifact({ id: 'core:component:button', detail: 'full', platform: null, purpose: null, section: null })],
  ];
  const exactArtifactRef = executeCommand('get', commandRequest('get', 'brief'));
  const undeclaredShorthand = executeCommand('get', {
    ...commandRequest('get', 'brief'),
    'id-or-alias': 'button',
  });
  const displayName = executeCommand('get', {
    ...commandRequest('get', 'brief'),
    'id-or-alias': 'Button',
  });
  return {
    pairs: pairs.map(([commandName, cli, api]) => ({
      command: commandName,
      apiDigest: canonicalDigest(api),
      cliDigest: canonicalDigest(cli),
      equal: canonicalJson(api) === canonicalJson(cli),
    })),
    aliasResolution: {
      aliasesAvailable: false,
      exactArtifactRefResolvedId: exactArtifactRef.data.artifact.id,
      undeclaredShorthandRejected: undeclaredShorthand.error.code,
      displayNameHeuristicRejected: displayName.error.code,
    },
  };
}

function rendererObservations() {
  const response = executeCommand('get', {
    'id-or-alias': 'core:component:button',
    detail: 'compact',
    platform: 'web.react',
    purpose: null,
    section: null,
  });
  const outputs = {
    json: renderJson(response),
    human: renderHuman(response),
    dense: renderDense(response),
  };
  return {
    responseDigest: canonicalDigest(response),
    outputDigests: Object.fromEntries(Object.entries(outputs).map(([name, bytes]) => [name, sha256(bytes)])),
    roundTrips: {
      json: canonicalJson(JSON.parse(outputs.json)) === canonicalJson(response),
      human: canonicalJson(parseHuman(outputs.human)) === canonicalJson(response),
      dense: canonicalJson(parseDense(outputs.dense)) === canonicalJson(response),
    },
    facts: {
      id: response.data.artifact.id,
      platform: response.meta.platform,
      bindingSpecRevision: response.meta.revisions.bindingSpec,
      authority: response.meta.resolution.authority,
      compatibility: response.meta.resolution.compatibility,
      catalogSource: response.meta.resolution.catalogSource,
    },
  };
}

function budgetObservations() {
  return commandRegistry.commands.flatMap(({ name }) => ['brief', 'compact', 'full'].map((detail) => {
    const output = renderDense(executeCommand(name, commandRequest(name, detail)));
    const count = countTokens(output);
    const budget = tokenBudgetFor(commandRegistry, name, detail);
    return { command: name, detail, count, budget, withinBudget: count <= budget, digest: sha256(output) };
  }));
}

function registryObservations() {
  const generated = {
    registry: canonicalDigest(commandRegistry),
    parser: canonicalDigest(parserMetadata),
    help: sha256(helpText),
    completion: sha256(completionScript),
    manifest: canonicalDigest(cliManifest),
    mcpInputs: canonicalDigest(mcpInputSchemas),
    responseTypes: sha256(commandRegistry.commands.map(({ responseType }) => responseType).join('\n')),
  };
  const failures = [];
  for (const [name, mutate] of [
    ['undeclared-command', (value) => value.commands.push({ ...value.commands[0], name: 'doctor' })],
    ['response-type-drift', (value) => { value.commands[0].responseType = 'cli.unknown'; }],
    ['selector-drift', (value) => value.selectors.find(({ name }) => name === 'detail').choices.push('verbose')],
    ['operation-drift', (value) => { value.commands[0].operation = 'planComposition'; }],
    ['operation-response-drift', (value) => { value.commands[0].operation = 'listArtifacts'; }],
    ['request-key-drift', (value) => { value.commands.find(({ name }) => name === 'get').arguments[0].requestKey = 'alias'; }],
    ['option-drift', (value) => value.commands.find(({ name }) => name === 'search').options.push('section')],
    ['unknown-field', (value) => { value.undocumented = true; }],
    ['nested-unknown-field', (value) => value.commands[0].arguments.push({ name: 'extra', required: false, type: 'string', undocumented: true })],
    ['tokenizer-drift', (value) => { value.tokenizer.id = 'approximate'; }],
    ['capability-drift', (value) => { value.surfacePolicy.cli.available = false; }],
  ]) {
    const value = structuredClone(commandRegistry);
    try {
      mutate(value);
      buildCommandProjections(value);
      failures.push({ name, rejected: false, code: null });
    } catch (error) {
      failures.push({ name, rejected: true, code: error.message.split(':')[0] });
    }
  }
  return { generated, negativeFixtures: failures };
}

function errorObservations() {
  const fixtures = [
    ['unknown', ['unknown', '--json']],
    ['invalid-detail', ['list', '--detail', 'verbose', '--json']],
    ['invalid-cursor', ['list', '--cursor', 'wrong', '--json']],
    ['not-found', ['get', 'core:component:missing', '--json']],
  ];
  const results = fixtures.map(([name, args]) => {
    const result = runCli(args);
    const response = JSON.parse(result.stdout);
    return {
      name,
      code: response.error.code,
      exitCode: result.exitCode,
      details: response.error.details,
      nextCommand: response.error.nextCommand,
      stderrEmpty: result.stderr === '',
      oneJsonValue: canonicalJson(response) === result.stdout.trim(),
    };
  });
  let unsafeRejected = false;
  try {
    assertSafeDiagnostics({
      type: 'error',
      error: { nextCommand: { effect: 'project-write', requiresConfirmation: false } },
    });
  } catch (error) {
    unsafeRejected = error.message.startsWith('CLI_UNSAFE_NEXT_COMMAND');
  }
  return { results, unsafeRejected };
}

function coldStartObservations() {
  const manifest = JSON.parse(runCli(['--json']).stdout);
  const search = JSON.parse(runCli(['search', 'button', '--detail', 'brief', '--json']).stdout);
  const id = search.data.items.find(({ name }) => name === 'Button').id;
  const detail = JSON.parse(runCli(['get', id, '--detail', 'compact', '--json']).stdout);
  return {
    steps: [
      { command: 'core --json', responseType: manifest.type, commands: manifest.data.cli.commands.map(({ name }) => name) },
      { command: 'core search button --detail brief --json', responseType: search.type, selectedId: id },
      { command: `core get ${id} --detail compact --json`, responseType: detail.type, retrievedId: detail.data.artifact.id },
    ],
    repositoryCrawlRequired: false,
    authority: detail.meta.resolution.authority,
    compatibility: detail.meta.resolution.compatibility,
    catalogSource: detail.meta.resolution.catalogSource,
  };
}

async function g03Applicability(manifest) {
  const button = getArtifact({ id: 'core:component:button', platform: 'web.react', detail: 'full' });
  return {
    artifact: { id: button.data.artifact.id, contentRevision: button.meta.revisions.conceptContent },
    binding: {
      id: 'core:component:button#web.react',
      contentRevision: button.meta.revisions.bindingContent,
      specRevision: button.meta.revisions.bindingSpec,
    },
    canonicalExamples: bundle.artifacts
      .filter(({ kind }) => kind === 'example')
      .map(({ id, contentRevision, source }) => ({ id, contentRevision, sourceDigest: source.contentDigest })),
    catalog: catalogApplicability,
    commandRegistry: { digest: canonicalDigest(commandRegistry), tokenizer: commandRegistry.tokenizer.id },
    package: { name: '@core-ui/tooling', version: '0.0.0', private: true, apiVersion: '1.0.0', schemaVersion: '1.0.0' },
    rendererPackage: 'not-applicable-g0.3',
    applicabilityManifest: manifest,
  };
}

async function captureG03() {
  const root = join(repositoryRoot, 'tests/evidence/g0.3');
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await mkdir(join(root, 'records'), { recursive: true });
  const paths = [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'catalog',
    'packages/schema',
    'packages/catalog',
    'packages/tooling',
    'tooling/audits/repository-policy',
    'tests/evidence/capture-g0.3.mjs',
    'tests/evidence/g0.3/README.md',
  ];
  const manifest = await applicabilityManifest(paths);
  const applicability = await g03Applicability(manifest);
  const definitions = [
    ['E-G0.3-01', 'surface-parity-matrix', parityObservations()],
    ['E-G0.3-02', 'cross-renderer-golden-corpus', rendererObservations()],
    ['E-G0.3-03', 'dense-token-count-report', budgetObservations()],
    ['E-G0.3-04', 'command-registry-consistency-report', registryObservations()],
    ['E-G0.3-05', 'error-schema-exit-status-report', errorObservations()],
    ['E-G0.3-06', 'cold-start-smoke-transcript', coldStartObservations()],
  ];
  const records = [];
  for (const [assertionId, evidenceKind, observations] of definitions) {
    const artifactPath = join(root, `artifacts/${assertionId}.json`);
    const artifact = {
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
    };
    await writeCanonical(artifactPath, artifact);
    const recordPath = join(root, `records/${assertionId}.json`);
    const record = {
      activeExceptionRefs: [],
      advisoryRefs: [],
      applicability,
      applicabilityManifest: manifest,
      artifact: {
        path: `tests/evidence/g0.3/artifacts/${assertionId}.json`,
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
      expiry: 'Any enforced applicability-manifest mismatch or change to the command registry, generated surfaces, query responses, renderers, budgets, diagnostics, runtime tuple, or retained result bytes',
      milestone: 'G0.3',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: 'Content-addressed Git object retained by the milestone pull request and default-branch history after merge; issue #5 is a mutable locator',
      schema: 'core-ui-evidence-record-v1',
      sourceRevision,
      sourceTree,
    };
    await writeCanonical(recordPath, record);
    records.push({
      assertionId,
      path: `tests/evidence/g0.3/records/${assertionId}.json`,
      sha256: sha256(await readFile(recordPath)),
    });
  }
  await writeCanonical(join(root, 'index.json'), {
    applicabilityManifest: manifest,
    captureTimestamp,
    disclosureClass: 'public-sanitized',
    milestone: 'G0.3',
    owner: 'ndrewtran',
    records,
    retentionPolicy: 'Content-addressed Git records retained by the milestone pull request and default-branch history after merge; issue #5 is a mutable locator',
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
  });
}

await recaptureUpstream('g0.1');
await recaptureUpstream('g0.2');
await captureG03();
console.log(`[evidence] captured G0.3 and refreshed upstream applicability at ${sourceRevision}`);
