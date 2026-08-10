import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve as resolvePath } from 'node:path';
import test from 'node:test';
import { canonicalJson, parseJsonStrict, validateFamily } from '@core-ui/schema';
import {
  RESOLVER_ERROR_PRECEDENCE,
  resolveCatalogGraph,
} from '../src/local-resolver.mjs';
import { resolvePnpmProjectCatalog } from '../src/pnpm-adapter.mjs';
import { runCli } from '../src/cli.mjs';

const repositoryRoot = resolvePath(import.meta.dirname, '../../..');

async function corpus() {
  return parseJsonStrict(await readFile(
    new URL('../../../tests/fixtures/g0.4/corpus.json', import.meta.url),
    'utf8',
  ));
}

function resolve(value, graph) {
  const { expected: _expected, ...normalizedGraph } = graph;
  return resolveCatalogGraph({
    packageManager: value.packageManager,
    catalogs: value.catalogs,
    rendererDescriptors: value.rendererDescriptors,
    releaseManifests: value.releaseManifests,
    graph: normalizedGraph,
  });
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function writeJson(path, value) {
  await writeFile(path, `${canonicalJson(value)}\n`);
}

async function writeProjection(path, canonicalPath, value) {
  const bytes = `${canonicalJson(value)}\n`;
  const body = `${canonicalJson({ path: canonicalPath, sha256: sha256(bytes) })}\n`;
  await writeFile(path, bytes);
  await writeFile(
    `${path}.provenance`,
    `// @generated-from: synthetic-g0.4-adapter-fixture\n// @generated-content-sha256: ${sha256(body)}\n${body}`,
  );
}

test('E-G0.4 resolver matrix selects only direct or explicitly addressed catalog authority', async () => {
  const value = await corpus();
  for (const graph of value.graphs) {
    const first = resolve(value, graph);
    const second = resolve(value, graph);
    assert.deepEqual(first, second, `${graph.id} must be deterministic`);
    if (graph.expected.type === 'success') {
      assert.equal(first.type, 'success', graph.id);
      assert.equal(first.resolution.authority, graph.expected.authority, graph.id);
      assert.equal(first.resolution.compatibility, 'exact', graph.id);
      assert.equal(first.catalog.id, graph.expected.catalog, graph.id);
      assert.equal(first.releaseManifest.id, graph.expected.releaseManifest, graph.id);
      assert.equal(first.catalog.id, graph.request.cache ? 'catalog-compatible' : graph.expected.catalog);
      continue;
    }
    assert.equal(first.type, 'error', graph.id);
    assert.equal(first.error.code, graph.expected.code, graph.id);
    assert.deepEqual(
      first.error.details.secondaryFailures.map(({ code }) => code),
      graph.expected.secondaryCodes,
      graph.id,
    );
    assert.equal(
      JSON.stringify(first.error.nextCommand),
      JSON.stringify(graph.expected.nextCommand),
      graph.id,
    );
    validateFamily('query-envelope', first);
  }
  assert.deepEqual(value.errorPrecedence, RESOLVER_ERROR_PRECEDENCE);
});

test('E-G0.4 resolver verifies provenance material instead of trusting fixture flags', async () => {
  const value = await corpus();
  const graph = structuredClone(value.graphs.find(({ id }) => id === 'explicit-cache-compatible'));
  graph.caches.forEach((cache) => { cache.provenanceVerified = false; });
  const resolved = resolve(value, graph);
  assert.equal(resolved.type, 'success');

  const catalog = value.catalogs.find(({ id }) => id === resolved.catalog.id);
  catalog.provenance.value = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const rejected = resolve(value, graph);
  assert.equal(rejected.error.code, 'CORE_CATALOG_INTEGRITY_MISMATCH');
});

test('E-G1.0-07 resolver rejects a weakened platform-safety requirement digest', async () => {
  const value = await corpus();
  const descriptor = value.rendererDescriptors.find(
    ({ id }) => id === 'renderer-react-compatible',
  );
  descriptor.bindings['core:component:button#web.react']
    .platformSafetyRequirementSetDigests['web.react'] = `sha256:${'0'.repeat(64)}`;
  const graph = value.graphs.find(({ id }) => id === 'selected-direct-compatible');
  const result = resolve(value, graph);
  assert.equal(result.error.code, 'CORE_CATALOG_INCOMPATIBLE');
  assert.equal(
    result.error.details.compatibilityFailures.some(
      ({ dimension }) => dimension === 'platform-safety',
    ),
    true,
  );
});

test('E-G1.0-04 compatibility rejects one changed native profile digest', async () => {
  for (const [field, profile, dimension] of [
    ['tokenRequirementSetDigests', 'native.ios', 'token'],
    ['platformSafetyRequirementSetDigests', 'android', 'platform-safety'],
  ]) {
    const value = await corpus();
    value.rendererDescriptors.find(({ id }) => id === 'renderer-native-compatible')
      .bindings['core:component:button#native.react-native'][field][profile]
      = `sha256:${'0'.repeat(64)}`;
    const graph = value.graphs.find(({ id }) => id === 'selected-direct-compatible');
    const result = resolve(value, graph);
    assert.equal(result.error.code, 'CORE_CATALOG_INCOMPATIBLE');
    assert.equal(
      result.error.details.compatibilityFailures.some((failure) => failure.dimension === dimension),
      true,
    );
  }
});

test('E-G1.0-04 compatibility rejects jointly stale descriptor and release maps', async () => {
  for (const [field, profile, dimension] of [
    ['tokenRequirementSetDigests', 'web.react', 'token'],
    ['platformSafetyRequirementSetDigests', 'web.react', 'platform-safety'],
  ]) {
    const value = await corpus();
    const staleDigest = `sha256:${'0'.repeat(64)}`;
    value.rendererDescriptors.find(({ id }) => id === 'renderer-react-compatible')
      .bindings['core:component:button#web.react'][field][profile] = staleDigest;
    value.releaseManifests.find(({ id }) => id === 'release-compatible')
      .bindings.find(({ binding }) => binding === 'core:component:button#web.react')
      [field][profile] = staleDigest;
    const graph = value.graphs.find(({ id }) => id === 'selected-direct-compatible');
    const result = resolve(value, graph);
    assert.equal(result.error.code, 'CORE_CATALOG_INCOMPATIBLE');
    assert.equal(
      result.error.details.compatibilityFailures.some((failure) => failure.dimension === dimension),
      true,
    );
  }
});

test('E-G0.4 explicit cache remains subordinate to manifest and lock authority', async () => {
  const value = await corpus();
  const baseline = value.graphs.find(({ id }) => id === 'explicit-cache-compatible');
  const cases = [
    ['out-of-range', (graph) => {
      graph.workspaces.find(({ path }) => path === graph.selectedWorkspace).catalogRange = '^2.0.0';
    }],
    ['lock-mismatch', (graph) => {
      graph.lockfile.find(({ name }) => name === '@core-ui/catalog').version = '1.1.0';
    }],
    ['installed-mismatch', (graph) => {
      graph.installed.push({
        workspace: graph.selectedWorkspace,
        name: '@core-ui/catalog',
        version: '1.1.0',
        kind: 'catalog',
        fixture: 'catalog-newer',
        relativePath: `${graph.selectedWorkspace}/node_modules/@core-ui/catalog`,
        observedDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
    }],
    ['duplicate-lock', (graph) => {
      graph.lockfile.push(structuredClone(
        graph.lockfile.find(({ name }) => name === '@core-ui/catalog'),
      ));
    }],
    ['duplicate-installed', (graph) => {
      for (const suffix of ['a', 'b']) graph.installed.push({
        workspace: graph.selectedWorkspace,
        name: '@core-ui/catalog',
        version: '1.0.0',
        kind: 'catalog',
        fixture: 'catalog-compatible',
        relativePath: `${graph.selectedWorkspace}/node_modules-${suffix}/@core-ui/catalog`,
        observedDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
    }],
    ['installed-integrity-mismatch', (graph) => {
      graph.lockfile.find(({ name }) => name === '@core-ui/catalog').integrity = 'sha512:locked';
      graph.installed.push({
        workspace: graph.selectedWorkspace,
        name: '@core-ui/catalog',
        version: '1.0.0',
        kind: 'catalog',
        fixture: 'catalog-compatible',
        relativePath: `${graph.selectedWorkspace}/node_modules/@core-ui/catalog`,
        observedDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        integrity: 'sha512:installed',
      });
    }],
  ];
  for (const [name, mutate] of cases) {
    const graph = structuredClone(baseline);
    mutate(graph);
    const result = resolve(value, graph);
    assert.equal(result.type, 'error', name);
    assert.equal(result.error.code, 'CORE_CATALOG_DECLARATION_DRIFT', name);
  }
});

test('G0.4 production resolver input rejects duplicate or undeclared normalized identities', async () => {
  const value = await corpus();
  const duplicate = structuredClone(value);
  duplicate.catalogs.push(structuredClone(duplicate.catalogs[0]));
  assert.throws(
    () => resolve(duplicate, duplicate.graphs[0]),
    /CORE_RESOLVER_INPUT_INVALID/,
  );
  const unknown = structuredClone(value.graphs[0]);
  unknown.undocumented = true;
  assert.throws(() => resolve(value, unknown), /CORE_RESOLVER_INPUT_INVALID/);

  const tilde = structuredClone(value.graphs.find(({ id }) => id === 'selected-direct-compatible'));
  tilde.workspaces.find(({ path }) => path === tilde.selectedWorkspace).catalogRange = '~1.0.0';
  assert.equal(resolve(value, tilde).type, 'success');

  const duplicateBinding = structuredClone(value);
  duplicateBinding.releaseManifests[0].bindings.push(
    structuredClone(duplicateBinding.releaseManifests[0].bindings[0]),
  );
  assert.throws(
    () => resolve(duplicateBinding, duplicateBinding.graphs[0]),
    /CORE_RESOLVER_INPUT_INVALID/,
  );
  const descriptorDrift = structuredClone(value);
  descriptorDrift.releaseManifests[0].bindings[0].descriptor = 'renderer-unknown';
  const descriptorDriftGraph = descriptorDrift.graphs.find(
    ({ id }) => id === 'selected-direct-compatible',
  );
  assert.equal(
    resolve(descriptorDrift, descriptorDriftGraph).error.code,
    'CORE_CATALOG_INCOMPATIBLE',
  );
});

test('E-G0.4 resolver diagnostics are relative and privacy-safe', async () => {
  const value = await corpus();
  for (const graph of value.graphs) {
    const bytes = JSON.stringify(resolve(value, graph));
    assert.doesNotMatch(bytes, /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\|credential|password|token=)/iu);
    assert.doesNotMatch(bytes, /https?:\/\/[^\s"]+\?/iu);
  }
  const hostile = structuredClone(value.graphs[0]);
  hostile.selectedWorkspace = '/Users/example/private-consumer';
  const hostileBytes = JSON.stringify(resolve(value, hostile));
  assert.doesNotMatch(hostileBytes, /private-consumer|\/Users\//u);
  assert.equal(JSON.parse(hostileBytes).error.code, 'CORE_PROJECT_NOT_FOUND');
});

test('E-G0.4 pnpm adapter resolves the selected direct package and drives the CLI', () => {
  const root = resolvePnpmProjectCatalog();
  assert.equal(root.type, 'success');
  assert.equal(root.package.name, '@core-ui/catalog');
  assert.equal(root.package.version, root.package.catalogVersion);
  const response = JSON.parse(runCli(['manifest', '--json']).stdout);
  assert.equal(response.meta.authority, 'installed-local');
  assert.equal(response.meta.resolution.catalogSource, 'project');
  assert.equal(
    response.meta.resolution.targetPackages['@core-ui/catalog'],
    root.package.version,
  );

  const selected = JSON.parse(runCli([
    'manifest', '--project', '.', '--json',
  ]).stdout);
  assert.equal(selected.meta.authority, 'installed-local');
  assert.equal(selected.meta.catalogDigest, root.package.catalogDigest);
});

test('TALE-TOKEN-C installed-local selection retains the exact Phase B catalog tuple', async () => {
  await mkdir(join(process.cwd(), 'fixtures'), { recursive: true });
  const fixtureRoot = await mkdtemp(join(process.cwd(), 'fixtures/.tale-phase-b-installed-'));
  const catalogRoot = join(fixtureRoot, 'catalog');
  const schemaRoot = join(fixtureRoot, 'schema');
  const tokensRoot = join(fixtureRoot, 'tokens');
  const fixtureCatalogRoot = join(
    repositoryRoot,
    'tests/fixtures/tale-token-phase-b/installed-catalog',
  );
  try {
    await cp(fixtureCatalogRoot, catalogRoot, { recursive: true });
    await mkdir(schemaRoot, { recursive: true });
    await mkdir(tokensRoot, { recursive: true });
    await writeJson(join(fixtureRoot, 'package.json'), {
      name: 'core-ui-tale-phase-b-installed-fixture',
      version: '1.0.0',
      private: true,
      packageManager: 'pnpm@10.33.0',
      dependencies: { '@core-ui/catalog': 'workspace:*' },
    });
    await writeFile(
      join(fixtureRoot, 'pnpm-workspace.yaml'),
      "packages:\n  - catalog\n  - schema\n  - tokens\n",
    );
    await writeJson(join(schemaRoot, 'package.json'), {
      name: '@core-ui/schema', version: '0.2.0', private: true,
    });
    await writeJson(join(tokensRoot, 'package.json'), {
      name: '@core-ui/tokens', version: '0.1.0', private: true,
    });
    const install = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
    assert.equal(install.status, 0, install.stderr);

    const project = relative(process.cwd(), fixtureRoot).split('\\').join('/');
    const historical = resolvePnpmProjectCatalog({ project });
    const historicalIdentity = JSON.parse(await readFile(
      join(catalogRoot, 'generated/catalog-package.json'),
      'utf8',
    ));
    assert.equal(historical.type, 'success');
    assert.equal(historical.package.version, '0.2.0');
    assert.equal(historical.package.catalogVersion, '0.2.0');
    assert.equal(historicalIdentity.queryApiVersion, '2.0.0');
    assert.deepEqual(
      historicalIdentity.supportedQueryApiVersions,
      ['1.1.0', '1.2.0', '2.0.0'],
    );
    assert.equal(historicalIdentity.releaseManifest.tokenContractVersion, '1.1.0');

    const historicalV11 = historical.api.getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.1.0', detail: 'full',
    });
    assert.equal(historicalV11.apiVersion, '1.1.0');
    assert.equal(historicalV11.data.artifact.tokenContractVersion, '1.1.0');
    assert.equal(Object.hasOwn(
      historicalV11.data.artifact.tokens,
      'reference.color.action-dark',
    ), true);
    for (const queryApiVersion of ['1.1.0', '1.2.0', '2.0.0']) {
      assert.equal(historical.api.getArtifact({
        id: 'core:token:button-minimum', queryApiVersion, detail: 'full',
      }).data.artifact.id, 'core:token:button-minimum');
      assert.equal(historical.api.getArtifact({
        id: 'core:token:default-theme', queryApiVersion, detail: 'full',
      }).error.code, 'CORE_ARTIFACT_NOT_FOUND');
    }

    const current = resolvePnpmProjectCatalog();
    assert.equal(current.type, 'success');
    const currentV11 = current.api.getArtifact({
      id: 'core:token:default-theme', queryApiVersion: '1.1.0', detail: 'full',
    });
    assert.equal(currentV11.apiVersion, '1.1.0');
    assert.equal(currentV11.data.artifact.tokenContractVersion, '2.0.0');
    assert.equal(Object.hasOwn(
      currentV11.data.artifact.tokens,
      'reference.color.action-dark',
    ), false);
    assert.equal(Object.hasOwn(
      currentV11.data.artifact.tokens,
      'reference.color.neutral-50',
    ), true);
    for (const queryApiVersion of ['1.1.0', '1.2.0', '2.0.0']) {
      assert.equal(current.api.getArtifact({
        id: 'core:token:default-theme', queryApiVersion, detail: 'full',
      }).data.artifact.id, 'core:token:default-theme');
      assert.equal(current.api.getArtifact({
        id: 'core:token:button-minimum', queryApiVersion, detail: 'full',
      }).error.code, 'CORE_ARTIFACT_NOT_FOUND');
    }

    const bundlePath = join(catalogRoot, 'generated/catalog.json');
    const bundleBytes = await readFile(bundlePath, 'utf8');
    await writeFile(bundlePath, `${bundleBytes} `);
    assert.equal(
      resolvePnpmProjectCatalog({ project }).error.code,
      'CORE_CATALOG_INTEGRITY_MISMATCH',
    );
    await writeFile(bundlePath, bundleBytes);

    const fixtureManifest = JSON.parse(await readFile(join(fixtureRoot, 'package.json'), 'utf8'));
    fixtureManifest.dependencies['@core-ui/catalog'] = 'workspace:^1.0.0';
    await writeJson(join(fixtureRoot, 'package.json'), fixtureManifest);
    assert.equal(
      resolvePnpmProjectCatalog({ project }).error.code,
      'CORE_CATALOG_DECLARATION_DRIFT',
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('E-G0.4 CLI requires exact bindings and filters project-wide discovery', () => {
  const detail = runCli([
    'get', 'core:component:button', '--platform', 'web.react', '--json',
  ]);
  assert.equal(detail.exitCode, 16);
  assert.equal(JSON.parse(detail.stdout).error.code, 'CORE_CATALOG_INCOMPATIBLE');

  const discovery = runCli(['list', '--platform', 'web.react', '--json']);
  assert.equal(discovery.exitCode, 0);
  const response = JSON.parse(discovery.stdout);
  assert.equal(response.meta.authority, 'installed-local');
  assert.deepEqual(response.meta.resolution.targetPackages, { '@core-ui/catalog': '2.0.0' });
  assert.equal(response.data.items.some(({ id }) => id === 'core:component:button'), false);
  assert.equal(response.data.items.some(({ id }) => id === 'core:example:button-basic-react'), false);
});

test('E-G0.4 pnpm adapter fails closed for missing projects and cache tuples', () => {
  const missing = runCli(['manifest', '--project', 'does-not-exist', '--json']);
  assert.equal(missing.exitCode, 10);
  assert.equal(JSON.parse(missing.stdout).error.code, 'CORE_PROJECT_NOT_FOUND');
  const absolute = runCli([
    'manifest', '--project', '/Users/example/private-consumer', '--json',
  ]);
  assert.equal(absolute.exitCode, 2);
  assert.equal(JSON.parse(absolute.stdout).error.code, 'CORE_QUERY_INVALID');
  assert.doesNotMatch(absolute.stdout, /\/Users\/|private-consumer/u);
  const hostile = runCli([
    'manifest', '--project', 'does-not-exist;echo-unsafe', '--json',
  ]);
  assert.equal(hostile.exitCode, 2);
  assert.doesNotMatch(hostile.stdout, /echo-unsafe|;/u);

  const selected = resolvePnpmProjectCatalog();
  assert.equal(selected.type, 'success');
  const cache = runCli([
    'manifest',
    '--catalog-version', selected.package.version,
    '--catalog-digest', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--json',
  ]);
  assert.equal(cache.exitCode, 14);
  assert.equal(JSON.parse(cache.stdout).error.code, 'CORE_CATALOG_INTEGRITY_MISMATCH');
  assert.doesNotMatch(cache.stdout, /\/Users\//u);
});

test('E-G0.4 pnpm adapter translates malformed project JSON into one typed response', async () => {
  await mkdir(join(process.cwd(), 'fixtures'), { recursive: true });
  const fixtureRoot = await mkdtemp(join(process.cwd(), 'fixtures/.g0-4-malformed-'));
  try {
    await writeFile(join(fixtureRoot, 'package.json'), '{not-json\n');
    const project = relative(process.cwd(), fixtureRoot).split('\\').join('/');
    const result = runCli(['manifest', '--project', project, '--json']);
    assert.equal(result.exitCode, 10);
    assert.equal(JSON.parse(result.stdout).error.code, 'CORE_PROJECT_NOT_FOUND');
    assert.doesNotMatch(result.stdout, /\/Users\//u);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('E-G0.4 pnpm adapter admits only an exact verified cache tuple', async () => {
  const toolingRoot = resolvePath(import.meta.dirname, '..');
  const catalogRoot = resolvePath(import.meta.dirname, '../../catalog');
  const project = relative(process.cwd(), toolingRoot).split('\\').join('/') || '.';
  const identity = JSON.parse(await readFile(
    join(catalogRoot, 'generated/catalog-package.json'),
    'utf8',
  ));
  const cachePath = join(
    toolingRoot,
    '.cache/core-ui/catalogs',
    identity.version,
    identity.catalogDigest.replace(/^sha256:/u, ''),
  );
  const created = !existsSync(cachePath);
  try {
    if (created) {
      await mkdir(join(cachePath, 'generated'), { recursive: true });
      await cp(join(catalogRoot, 'package.json'), join(cachePath, 'package.json'));
      await cp(
        join(catalogRoot, 'generated/catalog-package.json'),
        join(cachePath, 'generated/catalog-package.json'),
      );
      await cp(
        join(catalogRoot, 'generated/catalog-package.json.provenance'),
        join(cachePath, 'generated/catalog-package.json.provenance'),
      );
      await cp(
        join(catalogRoot, 'generated/catalog.json'),
        join(cachePath, 'generated/catalog.json'),
      );
      await cp(
        join(catalogRoot, 'generated/catalog.json.provenance'),
        join(cachePath, 'generated/catalog.json.provenance'),
      );
    }
    const result = runCli([
      'manifest', '--project', project,
      '--catalog-version', identity.version,
      '--catalog-digest', identity.catalogDigest,
      '--json',
    ]);
    assert.equal(result.exitCode, 0);
    const response = JSON.parse(result.stdout);
    assert.equal(response.meta.resolution.catalogSource, 'cache');
    assert.equal(response.meta.catalogDigest, identity.catalogDigest);
    if (created) {
      await appendFile(join(cachePath, 'generated/catalog.json'), ' ');
      const tampered = runCli([
        'manifest', '--project', project,
        '--catalog-version', identity.version,
        '--catalog-digest', identity.catalogDigest,
        '--json',
      ]);
      assert.equal(tampered.exitCode, 14);
      assert.equal(JSON.parse(tampered.stdout).error.code, 'CORE_CATALOG_INTEGRITY_MISMATCH');
    }
  } finally {
    if (created) await rm(cachePath, { recursive: true, force: true });
  }
});

test('E-G0.4 pnpm adapter normalizes renderer packages into the single resolver', async () => {
  await mkdir(join(process.cwd(), 'fixtures'), { recursive: true });
  const fixtureRoot = await mkdtemp(join(process.cwd(), 'fixtures/.g0-4-pnpm-fixture-'));
  const catalogRoot = join(fixtureRoot, 'catalog');
  const rendererRoot = join(fixtureRoot, 'renderer');
  const generatedCatalog = join(catalogRoot, 'generated');
  const generatedRenderer = join(rendererRoot, 'generated');
  const binding = 'core:component:button#web.react';
  try {
    await mkdir(generatedCatalog, { recursive: true });
    await mkdir(generatedRenderer, { recursive: true });
    await writeJson(join(fixtureRoot, 'package.json'), {
      name: 'g0-4-pnpm-fixture',
      version: '1.0.0',
      private: true,
      packageManager: 'pnpm@10.33.0',
      dependencies: {
        '@core-ui/catalog': 'workspace:*',
        '@core-ui/react': 'workspace:*',
      },
    });
    await writeFile(join(fixtureRoot, 'pnpm-workspace.yaml'), "packages:\n  - catalog\n  - renderer\n");
    await writeJson(join(catalogRoot, 'package.json'), {
      name: '@core-ui/catalog',
      version: '2.0.0',
      private: true,
      coreUi: { catalogPackage: './generated/catalog-package.json' },
    });
    await writeJson(join(rendererRoot, 'package.json'), {
      name: '@core-ui/react',
      version: '1.0.1',
      private: true,
      exports: { './button': './button.mjs' },
      coreUi: { rendererDescriptor: './generated/renderer-descriptor.json' },
    });
    const sourceCatalogRoot = resolvePath(import.meta.dirname, '../../catalog');
    const bundle = JSON.parse(await readFile(
      join(sourceCatalogRoot, 'generated/catalog.json'),
      'utf8',
    ));
    await cp(
      join(sourceCatalogRoot, 'generated/catalog.json'),
      join(generatedCatalog, 'catalog.json'),
    );
    await cp(
      join(sourceCatalogRoot, 'generated/catalog.json.provenance'),
      join(generatedCatalog, 'catalog.json.provenance'),
    );
    const descriptor = {
      id: 'renderer-react-compatible',
      descriptorVersion: '1.0.0',
      package: '@core-ui/react',
      version: '1.0.1',
      bindingSchemaRange: '^2.0.0',
      tokenContractRange: '^2.0.0',
      releaseProvenance: `core-ui-release:1.0.1:${bundle.sourceRevision}`,
      bindings: {
        [binding]: {
          specRevision: bundle.artifacts.find(({ id }) => id === 'core:component:button')
            .bindingSpecRevisions['web.react'],
          export: '@core-ui/react/button',
          lifecycle: 'experimental',
          strategy: 'direct',
          tokenRequirementSetDigests: {
            'web.react': 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          },
          platformSafetyRequirementSetDigests: {
            'web.react': 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          },
        },
      },
    };
    const identity = {
      schema: 'core-ui-catalog-package-v2',
      name: '@core-ui/catalog',
      version: '2.0.0',
      catalogVersion: '2.0.0',
      catalogDigest: bundle.catalogDigest,
      queryApiVersion: bundle.apiVersion,
      supportedQueryApiVersions: ['1.1.0', '1.2.0', '2.0.0'],
      schemaRange: '^2.0.0',
      sourceRevision: bundle.sourceRevision,
      provenance: { kind: 'source-revision', value: bundle.sourceRevision },
      tokenRequirementSets: {
        [`${binding}:web.react`]: descriptor.bindings[binding]
          .tokenRequirementSetDigests['web.react'],
      },
      platformSafetyContract: {
        version: bundle.platformSafetyContract.contractVersion,
        digest: bundle.platformSafetyContractDigest,
      },
      platformSafetyRequirementSets: {
        [`${binding}:web.react`]: descriptor.bindings[binding]
          .platformSafetyRequirementSetDigests['web.react'],
      },
      releaseManifest: {
        id: descriptor.releaseProvenance,
        releaseVersion: '1.0.1',
        schemaVersion: '2.1.0',
        queryApiVersion: '2.0.0',
        tokenContractVersion: '2.0.0',
        sourceRevision: bundle.sourceRevision,
        catalog: {
          id: `@core-ui/catalog@2.0.0:${bundle.catalogDigest}`,
          version: '2.0.0',
          digest: bundle.catalogDigest,
        },
        bindings: [{
          descriptor: descriptor.id,
          binding,
          package: '@core-ui/react',
          version: '1.0.1',
          export: descriptor.bindings[binding].export,
          specRevision: descriptor.bindings[binding].specRevision,
          tokenRequirementSetDigests: descriptor.bindings[binding].tokenRequirementSetDigests,
          platformSafetyRequirementSetDigests:
            descriptor.bindings[binding].platformSafetyRequirementSetDigests,
        }],
      },
      bundle: './catalog.json',
    };
    await writeProjection(
      join(generatedCatalog, 'catalog-package.json'),
      'packages/catalog/generated/catalog-package.json',
      identity,
    );
    await writeProjection(
      join(generatedRenderer, 'renderer-descriptor.json'),
      'packages/react/generated/renderer-descriptor.json',
      descriptor,
    );
    const install = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });
    assert.equal(install.status, 0, install.stderr);
    const project = relative(process.cwd(), fixtureRoot).split('\\').join('/');
    const resolved = resolvePnpmProjectCatalog({ project, bindings: [binding] });
    assert.equal(resolved.type, 'success');
    const response = resolved.api.getArtifact({
      id: 'core:component:button',
      platform: 'web.react',
      detail: 'compact',
      purpose: null,
      section: null,
    });
    assert.equal(response.meta.resolution.targetPackages['@core-ui/react'], '1.0.1');
    const cliSuccess = runCli([
      'get', 'core:component:button', '--project', project,
      '--platform', 'web.react', '--json',
    ]);
    assert.equal(cliSuccess.exitCode, 0);
    assert.equal(
      JSON.parse(cliSuccess.stdout).meta.resolution.targetPackages['@core-ui/react'],
      '1.0.1',
    );

    descriptor.bindings[binding].export = '@core-ui/react/unsafe-drift';
    await writeProjection(
      join(generatedRenderer, 'renderer-descriptor.json'),
      'packages/react/generated/renderer-descriptor.json',
      descriptor,
    );
    const incompatible = resolvePnpmProjectCatalog({ project, bindings: [binding] });
    assert.equal(incompatible.type, 'error');
    assert.equal(incompatible.error.code, 'CORE_CATALOG_INCOMPATIBLE');
    const cliIncompatible = runCli([
      'get', 'core:component:button', '--project', project,
      '--platform', 'web.react', '--json',
    ]);
    assert.equal(cliIncompatible.exitCode, 16);

    descriptor.bindings[binding].export = '@core-ui/react/button';
    await writeProjection(
      join(generatedRenderer, 'renderer-descriptor.json'),
      'packages/react/generated/renderer-descriptor.json',
      descriptor,
    );
    identity.schema = 'core-ui-catalog-package-v2-unknown';
    await writeProjection(
      join(generatedCatalog, 'catalog-package.json'),
      'packages/catalog/generated/catalog-package.json',
      identity,
    );
    const unknownIdentity = resolvePnpmProjectCatalog({ project, bindings: [binding] });
    assert.equal(unknownIdentity.type, 'error');
    assert.equal(unknownIdentity.error.code, 'CORE_CATALOG_INTEGRITY_MISMATCH');
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
