import { createCatalogDiagnostic } from '@core-ui/catalog';
import { satisfies, valid, validRange } from 'semver';

export const RESOLVER_ERROR_PRECEDENCE = Object.freeze([
  'CORE_PROJECT_NOT_FOUND',
  'CORE_CATALOG_NOT_DECLARED',
  'CORE_CATALOG_NOT_INSTALLED',
  'CORE_CATALOG_DECLARATION_DRIFT',
  'CORE_CATALOG_INTEGRITY_MISMATCH',
  'CORE_CATALOG_RESOLUTION_AMBIGUOUS',
  'CORE_CATALOG_INCOMPATIBLE',
]);

const TOOLING_API_VERSION = '1.1.0';
const TOOLING_SCHEMA_VERSION = '2.0.0';
const TOOLING_VERSION = '0.0.0';

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareText);
}

function isRelativePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && /^[A-Za-z0-9._/-]+$/u.test(value)
    && !value.startsWith('/')
    && !/^[A-Za-z]:[\\/]/u.test(value)
    && !value.split('/').includes('..');
}

function safePackageName(value, fallback = '@core-ui/catalog') {
  return /^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/u.test(value ?? '')
    ? value
    : fallback;
}

function safePackageManager(value) {
  return /^[a-z0-9-]+@\d+\.\d+\.\d+$/u.test(value ?? '') ? value : 'pnpm@0.0.0';
}

function safeVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value ?? '')
    ? value
    : '0.0.0-invalid';
}

function safeDigest(value) {
  return /^sha256:[a-f0-9]{64}$/u.test(value ?? '') ? value : null;
}

function safeSpecifier(value) {
  if (value === null) return null;
  const normalized = value?.startsWith('workspace:') ? value.slice('workspace:'.length) : value;
  return value === 'workspace:*' || validRange(normalized) !== null ? value : 'unsupported';
}

function inputError(message) {
  throw new Error(`CORE_RESOLVER_INPUT_INVALID: ${message}`);
}

function assertClosed(value, allowed, context) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    inputError(`${context} must be an object`);
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) inputError(`${context} has unknown field ${unknown[0]}`);
}

function assertArray(value, context) {
  if (!Array.isArray(value)) inputError(`${context} must be an array`);
}

function assertUnique(values, key, context) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value[key])) inputError(`${context} has duplicate ${key} ${value[key]}`);
    seen.add(value[key]);
  }
}

function validateNormalizedInput(input) {
  assertClosed(
    input,
    ['packageManager', 'catalogs', 'rendererDescriptors', 'releaseManifests', 'graph'],
    'resolver input',
  );
  assertClosed(input.packageManager, ['name', 'version', 'lockfileVersion'], 'packageManager');
  for (const name of ['catalogs', 'rendererDescriptors', 'releaseManifests']) {
    assertArray(input[name], name);
    assertUnique(input[name], 'id', name);
  }
  for (const catalog of input.catalogs) {
    assertClosed(catalog, [
      'id', 'name', 'version', 'catalogVersion', 'catalogDigest', 'queryApiVersion',
      'schemaRange', 'sourceRevision', 'provenance', 'releaseManifest',
    ], `catalog ${catalog.id ?? '<unknown>'}`);
    assertClosed(catalog.provenance, ['kind', 'value'], `${catalog.id}.provenance`);
  }
  for (const descriptor of input.rendererDescriptors) {
    assertClosed(descriptor, [
      'id', 'descriptorVersion', 'package', 'version', 'bindingSchemaRange',
      'tokenContractRange', 'releaseProvenance', 'bindings',
    ], `descriptor ${descriptor.id ?? '<unknown>'}`);
    if (
      descriptor.bindings === null
      || typeof descriptor.bindings !== 'object'
      || Array.isArray(descriptor.bindings)
    ) inputError(`${descriptor.id}.bindings must be an object`);
    for (const [binding, definition] of Object.entries(descriptor.bindings)) {
      assertClosed(definition, [
        'specRevision', 'export', 'lifecycle', 'strategy', 'tokenRequirementsDigest',
        'platformSafetyRequirementsDigest',
      ], `${descriptor.id}.${binding}`);
    }
  }
  for (const release of input.releaseManifests) {
    assertClosed(release, [
      'id', 'releaseVersion', 'schemaVersion', 'queryApiVersion', 'tokenContractVersion',
      'sourceRevision', 'catalog', 'bindings',
    ], `release ${release.id ?? '<unknown>'}`);
    assertClosed(release.catalog, ['id', 'version', 'digest'], `${release.id}.catalog`);
    assertArray(release.bindings, `${release.id}.bindings`);
    assertUnique(release.bindings, 'binding', `${release.id}.bindings`);
    for (const binding of release.bindings) {
      assertClosed(binding, [
        'descriptor', 'binding', 'package', 'version', 'export', 'specRevision',
        'tokenRequirementsDigest', 'platformSafetyRequirementsDigest',
      ], `${release.id}.binding`);
    }
  }
  const { graph } = input;
  assertClosed(graph, [
    'id', 'selectedWorkspace', 'workspaceRoot', 'workspaces', 'lockfile',
    'installed', 'caches', 'request',
  ], `graph ${graph.id ?? '<unknown>'}`);
  for (const name of ['workspaces', 'lockfile', 'installed', 'caches']) {
    assertArray(graph[name], `graph.${name}`);
  }
  assertUnique(graph.workspaces, 'path', 'graph.workspaces');
  assertUnique(graph.installed, 'relativePath', 'graph.installed');
  for (const workspace of graph.workspaces) {
    assertClosed(workspace, ['path', 'name', 'packageManager', 'catalogRange'], 'workspace');
  }
  for (const lock of graph.lockfile) {
    assertClosed(lock, ['workspace', 'name', 'version', 'integrity'], 'lockfile entry');
  }
  for (const installed of graph.installed) {
    assertClosed(installed, [
      'workspace', 'name', 'version', 'kind', 'fixture', 'relativePath', 'observedDigest',
      'integrity', 'integrityFailures',
    ], 'installed entry');
  }
  for (const cache of graph.caches) {
    assertClosed(
      cache,
      [
        'catalog', 'version', 'digest', 'relativePath', 'provenanceVerified',
        'observedDigest', 'integrityFailures',
      ],
      'cache entry',
    );
  }
  assertClosed(graph.request, ['bindings', 'cache'], 'resolver request');
  assertArray(graph.request.bindings, 'resolver request bindings');
  if (new Set(graph.request.bindings).size !== graph.request.bindings.length) {
    inputError('resolver request bindings must be unique');
  }
  if (graph.request.cache !== null) {
    assertClosed(graph.request.cache, ['version', 'digest'], 'resolver cache request');
  }
}

function rangeAllows(range, version) {
  if (!valid(version)) return false;
  if (range === 'workspace:*') return true;
  const normalized = range?.startsWith('workspace:') ? range.slice('workspace:'.length) : range;
  if (normalized === '*') return true;
  if (['workspace:^', 'workspace:~'].includes(range)) return true;
  if (['^', '~'].includes(normalized)) return false;
  return validRange(normalized) !== null
    && satisfies(version, normalized, { includePrerelease: true });
}

function releaseFor(catalog, releases) {
  const release = releases.get(catalog.releaseManifest);
  return release
    && release.sourceRevision === catalog.sourceRevision
    && release.catalog.id === catalog.id
    && release.catalog.version === catalog.version
    && release.catalog.digest === catalog.catalogDigest
    ? release
    : null;
}

function integrityReasons(candidate, catalog, release) {
  const reasons = [...(candidate.integrityFailures ?? [])];
  if (!catalog) reasons.push('catalog-package-metadata-missing');
  if (catalog && candidate.observedDigest !== catalog.catalogDigest) {
    reasons.push('catalog-digest-mismatch');
  }
  if (catalog && candidate.version !== catalog.version) reasons.push('catalog-version-mismatch');
  if (
    catalog
    && (
      catalog.provenance?.kind !== 'source-revision'
      || catalog.provenance.value !== catalog.sourceRevision
    )
  ) {
    reasons.push('catalog-provenance-mismatch');
  }
  if (!release) reasons.push('release-manifest-mismatch');
  return uniqueSorted(reasons);
}

function compatibilityFor({
  catalog,
  release,
  bindings,
  installedRenderers,
  descriptors,
  locks,
}) {
  const failures = [];
  let failingPackage = '@core-ui/catalog';
  if (catalog.queryApiVersion !== TOOLING_API_VERSION) {
    failures.push({
      dimension: 'tooling-api',
      required: TOOLING_API_VERSION,
      actual: catalog.queryApiVersion,
    });
  }
  if (!rangeAllows(catalog.schemaRange, TOOLING_SCHEMA_VERSION)) {
    failures.push({
      dimension: 'schema',
      required: TOOLING_SCHEMA_VERSION,
      actual: catalog.schemaRange,
    });
  }
  if (!release || release.queryApiVersion !== catalog.queryApiVersion) {
    failures.push({
      dimension: 'release-manifest',
      required: catalog.releaseManifest,
      actual: release?.id ?? 'missing',
    });
  }
  if (release && release.schemaVersion !== TOOLING_SCHEMA_VERSION) {
    failures.push({
      dimension: 'schema',
      required: TOOLING_SCHEMA_VERSION,
      actual: release.schemaVersion,
    });
  }

  for (const binding of bindings) {
    const expected = release?.bindings.find((item) => item.binding === binding);
    const installed = installedRenderers
      .filter((item) => descriptors.get(item.fixture)?.bindings[binding])
      .sort((left, right) => compareText(left.relativePath, right.relativePath));
    const descriptor = descriptors.get(installed[0]?.fixture);
    if (!expected || !descriptor || installed.length !== 1) {
      failures.push({
        dimension: 'renderer-package',
        required: expected?.package ?? binding,
        actual: installed.length === 0 ? 'missing' : `ambiguous:${installed.length}`,
      });
      failingPackage = expected?.package ?? '@core-ui/catalog';
      continue;
    }
    failingPackage = expected.package;
    const installedVersion = installed[0].version;
    if (descriptor.id !== expected.descriptor) {
      failures.push({
        dimension: 'release-manifest',
        required: expected.descriptor,
        actual: descriptor.id,
      });
    }
    const packageLocks = locks.filter((item) => item.name === expected.package);
    if (
      packageLocks.length !== 1
      || packageLocks[0].version !== installedVersion
      || (
        typeof packageLocks[0].integrity === 'string'
        && typeof installed[0].integrity === 'string'
        && packageLocks[0].integrity !== installed[0].integrity
      )
    ) {
      failures.push({
        dimension: 'renderer-package',
        required: `${expected.package}@${expected.version}:locked`,
        actual: packageLocks.length === 1
          ? `${expected.package}@${installedVersion}:drift`
          : `${expected.package}@${installedVersion}:unlocked`,
      });
    }
    if (descriptor.package !== expected.package || installedVersion !== expected.version) {
      failures.push({
        dimension: 'renderer-package',
        required: `${expected.package}@${expected.version}`,
        actual: `${descriptor.package}@${installedVersion}`,
      });
    }
    const described = descriptor.bindings[binding];
    if (described.export !== expected.export) {
      failures.push({ dimension: 'export', required: expected.export, actual: described.export });
    }
    if (described.specRevision !== expected.specRevision) {
      failures.push({
        dimension: 'binding-spec',
        required: expected.specRevision,
        actual: described.specRevision,
      });
    }
    if (
      descriptor.releaseProvenance !== release.id
      || !rangeAllows(descriptor.bindingSchemaRange, release.schemaVersion)
    ) {
      failures.push({
        dimension: 'release-manifest',
        required: release.id,
        actual: descriptor.releaseProvenance,
      });
    }
    if (!rangeAllows(descriptor.tokenContractRange, release.tokenContractVersion)) {
      failures.push({
        dimension: 'token',
        required: release.tokenContractVersion,
        actual: descriptor.tokenContractRange,
      });
    }
    if (described.tokenRequirementsDigest !== expected.tokenRequirementsDigest) {
      failures.push({
        dimension: 'token',
        required: expected.tokenRequirementsDigest,
        actual: described.tokenRequirementsDigest,
      });
    }
    if (
      described.platformSafetyRequirementsDigest
      !== expected.platformSafetyRequirementsDigest
    ) {
      failures.push({
        dimension: 'platform-safety',
        required: expected.platformSafetyRequirementsDigest,
        actual: described.platformSafetyRequirementsDigest,
      });
    }
  }
  failures.sort((left, right) => (
    compareText(left.dimension, right.dimension)
    || compareText(left.required, right.required)
    || compareText(left.actual, right.actual)
  ));
  return { failures, failingPackage };
}

function diagnosticSpec(code) {
  return {
    CORE_PROJECT_NOT_FOUND: {
      ruleId: 'resolver.project.exists',
      message: 'The selected project does not resolve to a supported workspace manifest.',
    },
    CORE_CATALOG_NOT_DECLARED: {
      ruleId: 'resolver.catalog.declared',
      message: 'The selected workspace does not directly declare @core-ui/catalog.',
    },
    CORE_CATALOG_NOT_INSTALLED: {
      ruleId: 'resolver.catalog.installed',
      message: 'The declared catalog is not installed for the selected workspace.',
    },
    CORE_CATALOG_DECLARATION_DRIFT: {
      ruleId: 'resolver.catalog.declaration-drift',
      message: 'The manifest, lockfile, and installed catalog do not describe one state.',
    },
    CORE_CATALOG_INTEGRITY_MISMATCH: {
      ruleId: 'resolver.catalog.integrity',
      message: 'The resolved catalog bytes do not match their package identity.',
    },
    CORE_CATALOG_RESOLUTION_AMBIGUOUS: {
      ruleId: 'resolver.catalog.ambiguous',
      message: 'The selected workspace yields more than one valid catalog resolution.',
    },
    CORE_CATALOG_INCOMPATIBLE: {
      ruleId: 'resolver.catalog.compatibility',
      message: 'The resolved catalog is incompatible with the requested local binding graph.',
    },
  }[code];
}

function resolverError(code, details, nextCommand, failures) {
  const spec = diagnosticSpec(code);
  const primaryIndex = RESOLVER_ERROR_PRECEDENCE.indexOf(code);
  const secondaryFailures = failures
    .filter((failure) => RESOLVER_ERROR_PRECEDENCE.indexOf(failure.code) > primaryIndex)
    .map((failure) => ({
      code: failure.code,
      ruleId: diagnosticSpec(failure.code).ruleId,
      reason: failure.reason,
    }));
  return createCatalogDiagnostic({
    code,
    ruleId: spec.ruleId,
    message: spec.message,
    retryable: true,
    details: { ...details, secondaryFailures },
    nextCommand: {
      command: nextCommand,
      effect: 'read-only',
      requiresConfirmation: false,
    },
  });
}

export function resolveCatalogGraph(input) {
  validateNormalizedInput(input);
  const {
    packageManager,
    catalogs: catalogValues,
    rendererDescriptors,
    releaseManifests,
    graph,
  } = input;
  const selectedPathIsSafe = isRelativePath(graph?.selectedWorkspace);
  const rootPathIsSafe = isRelativePath(graph?.workspaceRoot);
  if (!selectedPathIsSafe || !rootPathIsSafe) {
    const failures = [{ code: 'CORE_PROJECT_NOT_FOUND', reason: 'workspace path is not relative' }];
    return resolverError(
      failures[0].code,
      {
        workspacePackage: null,
        workspacePath: '.',
        packageManager: safePackageManager(`${packageManager.name}@${packageManager.version}`),
      },
      'pnpm --dir . list --depth 0',
      failures,
    );
  }
  const catalogs = new Map(catalogValues.map((catalog) => [catalog.id, catalog]));
  const descriptors = new Map(rendererDescriptors.map((descriptor) => [descriptor.id, descriptor]));
  const releases = new Map(releaseManifests.map((release) => [release.id, release]));
  const selected = graph.workspaces.find(({ path }) => path === graph.selectedWorkspace);
  const root = graph.workspaces.find(({ path }) => path === graph.workspaceRoot);
  const packageManagerId = safePackageManager(
    selected?.packageManager ?? root?.packageManager
      ?? `${packageManager.name}@${packageManager.version}`,
  );
  const baseDetails = {
    workspacePackage: selected ? safePackageName(selected.name, null) : null,
    workspacePath: graph.selectedWorkspace,
    packageManager: packageManagerId,
  };
  const failures = [];
  if (!selected || !packageManagerId.startsWith('pnpm@')) {
    failures.push({ code: 'CORE_PROJECT_NOT_FOUND', reason: 'workspace manifest was not found' });
    return resolverError(
      failures[0].code,
      baseDetails,
      `pnpm --dir ${graph.workspaceRoot} list --depth 0`,
      failures,
    );
  }

  const declaredRange = safeSpecifier(selected.catalogRange);
  const declaredDetails = { ...baseDetails, declaredRange };
  if (declaredRange === null) {
    failures.push({ code: 'CORE_CATALOG_NOT_DECLARED', reason: 'direct dependency is absent' });
    return resolverError(
      failures[0].code,
      declaredDetails,
      `pnpm --dir ${graph.selectedWorkspace} why @core-ui/catalog`,
      failures,
    );
  }

  const locks = graph.lockfile.filter((item) => (
    item.workspace === graph.selectedWorkspace && item.name === '@core-ui/catalog'
  ));
  const installedCatalogs = graph.installed.filter((item) => (
    item.workspace === graph.selectedWorkspace
    && item.name === '@core-ui/catalog'
    && item.kind === 'catalog'
  ));
  const explicitCache = graph.request.cache;
  let candidates;
  let catalogSource;
  if (explicitCache) {
    catalogSource = 'cache';
    candidates = graph.caches
      .filter((cache) => (
        cache.version === explicitCache.version && cache.digest === explicitCache.digest
      ))
      .map((cache) => ({
        fixture: cache.catalog,
        version: cache.version,
        relativePath: cache.relativePath,
        observedDigest: cache.observedDigest === undefined ? cache.digest : cache.observedDigest,
        integrityFailures: cache.integrityFailures,
      }));
  } else {
    catalogSource = 'project';
    candidates = installedCatalogs;
  }

  const versionDetails = {
    ...declaredDetails,
    lockfileVersions: uniqueSorted(locks.map(({ version }) => safeVersion(version))),
    installedVersions: uniqueSorted(installedCatalogs.map(({ version }) => safeVersion(version))),
  };
  if (candidates.length === 0) {
    failures.push({ code: 'CORE_CATALOG_NOT_INSTALLED', reason: 'no usable local candidate exists' });
    return resolverError(
      failures[0].code,
      versionDetails,
      `pnpm --dir ${graph.selectedWorkspace} why @core-ui/catalog`,
      failures,
    );
  }

  const lockVersions = uniqueSorted(locks.map(({ version }) => version));
  const installedVersions = uniqueSorted(installedCatalogs.map(({ version }) => version));
  const lockIntegrity = uniqueSorted(locks.map(({ integrity }) => integrity).filter(Boolean));
  const installedIntegrity = uniqueSorted(
    installedCatalogs.map(({ integrity }) => integrity).filter(Boolean),
  );
  const directStateDrifts = explicitCache
    ? (
      locks.length !== 1
      || locks[0].version !== explicitCache.version
      || !rangeAllows(declaredRange, explicitCache.version)
      || (
        installedCatalogs.length > 0
        && (
          installedCatalogs.length !== 1
          || installedCatalogs[0].version !== explicitCache.version
          || !rangeAllows(declaredRange, installedCatalogs[0].version)
          || (
            typeof locks[0].integrity === 'string'
            && typeof installedCatalogs[0].integrity === 'string'
            && locks[0].integrity !== installedCatalogs[0].integrity
          )
        )
      )
    )
    : (
      lockVersions.length === 0
      || installedVersions.some((version) => !rangeAllows(declaredRange, version))
      || lockVersions.some((version) => !rangeAllows(declaredRange, version))
      || JSON.stringify(lockVersions) !== JSON.stringify(installedVersions)
      || (
        lockIntegrity.length > 0
        && installedIntegrity.length > 0
        && JSON.stringify(lockIntegrity) !== JSON.stringify(installedIntegrity)
      )
    );
  if (directStateDrifts) {
    failures.push({
      code: 'CORE_CATALOG_DECLARATION_DRIFT',
      reason: explicitCache
        ? 'explicit cache, declaration, lockfile, and present installed catalog differ'
        : 'declared, locked, and installed versions differ',
    });
  }

  const evaluated = candidates.map((candidate) => {
    const catalog = catalogs.get(candidate.fixture);
    const release = catalog ? releaseFor(catalog, releases) : null;
    const rejectionReasons = integrityReasons(candidate, catalog, release);
    return { candidate, catalog, release, rejectionReasons };
  });
  const valid = evaluated.filter(({ rejectionReasons }) => rejectionReasons.length === 0);
  if (valid.length !== evaluated.length) {
    failures.push({ code: 'CORE_CATALOG_INTEGRITY_MISMATCH', reason: 'candidate identity is invalid' });
  }
  if (valid.length > 1) {
    failures.push({
      code: 'CORE_CATALOG_RESOLUTION_AMBIGUOUS',
      reason: `${valid.length} candidates remain valid`,
    });
  }

  let compatibility = { failures: [], failingPackage: '@core-ui/catalog' };
  if (valid.length === 1) {
    compatibility = compatibilityFor({
      catalog: valid[0].catalog,
      release: valid[0].release,
      bindings: graph.request.bindings,
      installedRenderers: graph.installed.filter((item) => (
        item.workspace === graph.selectedWorkspace && item.kind === 'renderer'
      )),
      descriptors,
      locks: graph.lockfile.filter((item) => item.workspace === graph.selectedWorkspace),
    });
    if (compatibility.failures.length > 0) {
      failures.push({
        code: 'CORE_CATALOG_INCOMPATIBLE',
        reason: compatibility.failures.map(({ dimension }) => dimension).join(', '),
      });
    }
  }

  failures.sort((left, right) => (
    RESOLVER_ERROR_PRECEDENCE.indexOf(left.code) - RESOLVER_ERROR_PRECEDENCE.indexOf(right.code)
  ));
  if (failures.length > 0) {
    const primary = failures[0].code;
    const selectedCandidate = valid[0] ?? evaluated[0];
    const details = {
      ...versionDetails,
      catalogVersion: selectedCandidate?.catalog?.version ?? null,
      catalogDigest: selectedCandidate?.catalog?.catalogDigest ?? null,
      expectedDigest: selectedCandidate?.catalog?.catalogDigest ?? null,
      actualDigest: selectedCandidate?.candidate?.observedDigest ?? null,
      candidates: evaluated.map(({ candidate, catalog, rejectionReasons }) => ({
        relativePath: isRelativePath(candidate.relativePath)
          ? candidate.relativePath
          : 'invalid-relative-path',
        version: safeVersion(candidate.version),
        catalogDigest: safeDigest(catalog?.catalogDigest),
        rejectionReasons,
      })).sort((left, right) => compareText(left.relativePath, right.relativePath)),
      compatibilityFailures: compatibility.failures,
    };
    const inspectedPackage = primary === 'CORE_CATALOG_INCOMPATIBLE'
      ? safePackageName(compatibility.failingPackage)
      : '@core-ui/catalog';
    return resolverError(
      primary,
      details,
      `pnpm --dir ${graph.selectedWorkspace} why ${inspectedPackage}`,
      failures,
    );
  }

  const [{ catalog, release }] = valid;
  const targetPackages = Object.fromEntries([
    ['@core-ui/catalog', catalog.version],
    ...release.bindings
      .filter(({ binding }) => graph.request.bindings.includes(binding))
      .map(({ package: name, version }) => [name, version]),
  ].sort(([left], [right]) => compareText(left, right)));
  return Object.freeze({
    type: 'success',
    catalog,
    releaseManifest: release,
    resolution: Object.freeze({
      authority: 'installed-local',
      compatibility: 'exact',
      catalogSource,
      sourceRevision: catalog.sourceRevision,
      targetPackages,
      coreVersion: TOOLING_VERSION,
    }),
  });
}
