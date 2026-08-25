import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseJsonStrict } from '@core-ui/schema';

const execFile = promisify(execFileCallback);

export const DEFAULT_THEME_REPOSITORY_STATES = Object.freeze({
  'phase-b': Object.freeze({
    artifactId: 'core:token:button-minimum',
    catalogPackageVersion: '0.2.0',
    reactPackageVersion: '0.0.0',
    sourcePath: 'catalog/tokens/button-minimum.json',
    tokenPackageVersion: '0.1.0',
    toolingPackageVersion: '0.2.0',
    webPackageVersion: '0.0.0',
  }),
  'decision-0004': Object.freeze({
    artifactId: 'core:token:button-minimum',
    catalogPackageVersion: '1.0.0',
    reactPackageVersion: '1.0.0',
    sourcePath: 'catalog/tokens/button-minimum.json',
    tokenPackageVersion: '1.0.0',
    toolingPackageVersion: '0.3.0',
    webPackageVersion: '1.0.0',
  }),
  'post-migration': Object.freeze({
    artifactId: 'core:token:default-theme',
    catalogPackageVersion: '2.0.0',
    reactPackageVersion: '1.0.1',
    sourcePath: 'catalog/tokens/default-theme.json',
    tokenPackageVersion: '2.0.0',
    toolingPackageVersion: '1.0.0',
    webPackageVersion: '1.0.1',
  }),
});

const SNAPSHOT_PATHS = Object.freeze([
  'catalog/components/button/artifact.json',
  'catalog/tokens/button-minimum.json',
  'catalog/tokens/default-theme.json',
  'packages/catalog/catalog-sources.json',
  'packages/catalog/generated',
  'packages/catalog/package.json',
  'packages/react/generated',
  'packages/react/package.json',
  'packages/tokens/package.json',
  'packages/tooling/command-registry.json',
  'packages/tooling/generated',
  'packages/tooling/package.json',
  'packages/tooling/src/local-resolver.mjs',
  'packages/tooling/src/pnpm-adapter.mjs',
  'packages/web/generated',
  'packages/web/package.json',
  'packages/web/src/generate.mjs',
]);

const TRANSITION_GENERATORS = Object.freeze([
  'packages/tokens/src/generate.mjs',
  'packages/catalog/src/generate.mjs',
  'packages/tooling/src/generate.mjs',
  'packages/web/src/generate.mjs',
  'packages/react/src/generate.mjs',
]);

async function exists(path) {
  return stat(path).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

async function json(path) {
  return parseJsonStrict(await readFile(path, 'utf8'));
}

const REACT_R1_PACKAGE_VERSION = /^(?:0\.1\.0-alpha\.(?:0|[1-9]\d*)|0\.1\.0-rc\.1)$/u;

function isReactR1PackageVersion(version) {
  return typeof version === 'string' && REACT_R1_PACKAGE_VERSION.test(version);
}

async function isReactR1PackageBaseline(repositoryRoot) {
  const packageSource = await readFile(join(repositoryRoot, 'packages/react/package.json')).catch(() => null);
  if (!packageSource) return false;
  const packageJson = parseJsonStrict(packageSource.toString('utf8'));
  return isReactR1PackageVersion(packageJson.version)
    && packageJson.dependencies?.['react-aria-components'] === '1.20.0';
}

/** The R1 package baseline is a product/package fact, not a delivery authority. */
export async function hasReactR1PackageBaseline(repositoryRoot) {
  return isReactR1PackageBaseline(repositoryRoot);
}

function replaceExact(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${label} expected one ${from}`);
  return source.replace(from, to);
}

async function setPackageVersion(repositoryRoot, relativePath, fromVersion, toVersion) {
  const path = join(repositoryRoot, relativePath);
  const source = await readFile(path, 'utf8');
  const current = parseJsonStrict(source).version;
  if (relativePath === 'packages/react/package.json' && isReactR1PackageVersion(current)
    && await isReactR1PackageBaseline(repositoryRoot)) return;
  if (current !== fromVersion) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath} expected ${fromVersion}`);
  }
  await writeFile(path, replaceExact(
    source,
    `\"version\": \"${fromVersion}\"`,
    `\"version\": \"${toVersion}\"`,
    `${relativePath} version`,
  ));
}

async function setAuthoredState(repositoryRoot, from, to) {
  const buttonPath = join(repositoryRoot, 'catalog/components/button/artifact.json');
  const button = await readFile(buttonPath, 'utf8');
  if (Object.values(parseJsonStrict(button).bindings).some(({ tokenRecipe }) => tokenRecipe.source !== from.artifactId)) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${buttonPath}`);
  }
  if (from.artifactId !== to.artifactId) await writeFile(buttonPath, button.replaceAll(from.artifactId, to.artifactId));

  const sourcesPath = join(repositoryRoot, 'packages/catalog/catalog-sources.json');
  let sources = await readFile(sourcesPath, 'utf8');
  if (parseJsonStrict(sources).records.find(({ family }) => family === 'token-source')?.path !== from.sourcePath) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${sourcesPath}`);
  }
  if (from.sourcePath !== to.sourcePath) {
    sources = replaceExact(sources, `\"path\": \"${from.sourcePath}\"`, `\"path\": \"${to.sourcePath}\"`, sourcesPath);
  }
  const baselineLine = ',\n      "baselineOccurrencesPath": "packages/tokens/generated/tale-token-occurrences.json"';
  if (to === DEFAULT_THEME_REPOSITORY_STATES['phase-b']) {
    sources = replaceExact(sources, baselineLine, '', `${sourcesPath} baseline`);
  } else if (from === DEFAULT_THEME_REPOSITORY_STATES['phase-b']) {
    sources = replaceExact(
      sources,
      `\"path\": \"${to.sourcePath}\"`,
      `\"path\": \"${to.sourcePath}\"${baselineLine}`,
      `${sourcesPath} baseline`,
    );
  }
  await writeFile(sourcesPath, sources);

  await Promise.all([
    setPackageVersion(repositoryRoot, 'packages/catalog/package.json', from.catalogPackageVersion, to.catalogPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/react/package.json', from.reactPackageVersion, to.reactPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/tokens/package.json', from.tokenPackageVersion, to.tokenPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/tooling/package.json', from.toolingPackageVersion, to.toolingPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/web/package.json', from.webPackageVersion, to.webPackageVersion),
  ]);

  const registryPath = join(repositoryRoot, 'packages/tooling/command-registry.json');
  let registry = await readFile(registryPath, 'utf8');
  if (parseJsonStrict(registry).cli.version !== from.toolingPackageVersion) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${registryPath} version`);
  }
  registry = replaceExact(
    registry,
    `\"version\": \"${from.toolingPackageVersion}\"`,
    `\"version\": \"${to.toolingPackageVersion}\"`,
    `${registryPath} version`,
  );
  if (from.artifactId !== to.artifactId) {
    registry = replaceExact(registry, from.artifactId, to.artifactId, `${registryPath} artifact ID`);
  }
  await writeFile(registryPath, registry);

  for (const relativePath of [
    'packages/tooling/src/local-resolver.mjs',
    'packages/tooling/src/pnpm-adapter.mjs',
  ]) {
    const path = join(repositoryRoot, relativePath);
    const source = await readFile(path, 'utf8');
    await writeFile(path, replaceExact(
      source,
      `const TOOLING_VERSION = '${from.toolingPackageVersion}';`,
      `const TOOLING_VERSION = '${to.toolingPackageVersion}';`,
      relativePath,
    ));
  }
  const webGeneratorPath = join(repositoryRoot, 'packages/web/src/generate.mjs');
  const webGenerator = await readFile(webGeneratorPath, 'utf8');
  if (from.artifactId !== to.artifactId) {
    await writeFile(webGeneratorPath, replaceExact(
      webGenerator,
      `id }) => id === '${from.artifactId}'`,
      `id }) => id === '${to.artifactId}'`,
      'packages/web/src/generate.mjs',
    ));
  }
}

export async function assertDefaultThemeRepositoryState(repositoryRoot, stateName) {
  const state = DEFAULT_THEME_REPOSITORY_STATES[stateName];
  if (!state) throw new Error(`CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: unknown repository state ${stateName}`);
  const button = await json(join(repositoryRoot, 'catalog/components/button/artifact.json'));
  if (Object.values(button.bindings).some(({ tokenRecipe }) => tokenRecipe.source !== state.artifactId)) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: component token recipe');
  }
  const sources = await json(join(repositoryRoot, 'packages/catalog/catalog-sources.json'));
  if (sources.records.find(({ family }) => family === 'token-source')?.path !== state.sourcePath) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: catalog source path');
  }
  const tokenSourceRecord = sources.records.find(({ family }) => family === 'token-source');
  const expectedBaseline = stateName === 'phase-b'
    ? undefined
    : 'packages/tokens/generated/tale-token-occurrences.json';
  if (tokenSourceRecord.baselineOccurrencesPath !== expectedBaseline) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: catalog baseline occurrence source');
  }
  for (const [relativePath, version] of [
    ['packages/catalog/package.json', state.catalogPackageVersion],
    ['packages/react/package.json', state.reactPackageVersion],
    ['packages/tokens/package.json', state.tokenPackageVersion],
    ['packages/tooling/package.json', state.toolingPackageVersion],
    ['packages/web/package.json', state.webPackageVersion],
  ]) {
    const actualVersion = (await json(join(repositoryRoot, relativePath))).version;
    const currentR1 = relativePath === 'packages/react/package.json'
      && isReactR1PackageVersion(actualVersion)
      && await isReactR1PackageBaseline(repositoryRoot);
    if (actualVersion !== version && !currentR1) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath} version`);
    }
  }
  const registry = await json(join(repositoryRoot, 'packages/tooling/command-registry.json'));
  const get = registry.commands.find(({ name }) => name === 'get');
  if (
    registry.cli.version !== state.toolingPackageVersion
    || !get.examples.some((example) => example.includes(state.artifactId))
  ) throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: command registry');
  for (const relativePath of [
    'packages/tooling/src/local-resolver.mjs',
    'packages/tooling/src/pnpm-adapter.mjs',
  ]) {
    const source = await readFile(join(repositoryRoot, relativePath), 'utf8');
    if (!source.includes(`const TOOLING_VERSION = '${state.toolingPackageVersion}';`)) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath}`);
    }
  }
  const webGenerator = await readFile(join(repositoryRoot, 'packages/web/src/generate.mjs'), 'utf8');
  if (!webGenerator.includes(`id }) => id === '${state.artifactId}'`)) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: packages/web/src/generate.mjs');
  }
  const bundle = await json(join(repositoryRoot, 'packages/catalog/generated/catalog.json'));
  const tokenArtifacts = bundle.artifacts.filter(({ kind }) => kind === 'token');
  if (
    bundle.catalogVersion !== state.catalogPackageVersion
    || tokenArtifacts.length !== 1
    || tokenArtifacts[0].id !== state.artifactId
  ) throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: generated catalog tuple');
  const reactPackageVersion = (await json(join(repositoryRoot, 'packages/react/package.json'))).version;
  for (const [relativePath, version] of [
    ['packages/react/generated/compatibility.mjs', state.reactPackageVersion],
    ['packages/web/generated/compatibility.mjs', state.webPackageVersion],
  ]) {
    const source = await readFile(join(repositoryRoot, relativePath), 'utf8');
    const expectedVersion = relativePath === 'packages/react/generated/compatibility.mjs'
      ? reactPackageVersion
      : version;
    const r1GeneratedCompatibility = relativePath === 'packages/react/generated/compatibility.mjs'
      && source.includes(`\"version\":\"${expectedVersion}\"`)
      && await isReactR1PackageBaseline(repositoryRoot);
    if (!source.includes(`\"version\":\"${expectedVersion}\"`) && !r1GeneratedCompatibility) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath}`);
    }
  }
  for (const script of TRANSITION_GENERATORS) {
    if (script === 'packages/react/src/generate.mjs'
      && await isReactR1PackageBaseline(repositoryRoot)) continue;
    await execFile(process.execPath, [script, '--check'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).catch((error) => {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${script}: ${error.message}`);
    });
  }
}

async function snapshot(repositoryRoot) {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-default-theme-transition-'));
  const present = [];
  for (const relativePath of SNAPSHOT_PATHS) {
    const source = join(repositoryRoot, relativePath);
    if (!await exists(source)) continue;
    present.push(relativePath);
    const target = join(root, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
  return { present, root };
}

async function restore(repositoryRoot, saved) {
  for (const relativePath of SNAPSHOT_PATHS) await rm(join(repositoryRoot, relativePath), { recursive: true, force: true });
  for (const relativePath of saved.present) {
    const source = join(saved.root, relativePath);
    const target = join(repositoryRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
}

export async function transitionDefaultThemeRepository(repositoryRoot, {
  fromState,
  toState,
  writeSource,
  validate,
}) {
  const from = DEFAULT_THEME_REPOSITORY_STATES[fromState];
  const to = DEFAULT_THEME_REPOSITORY_STATES[toState];
  if (!from || !to || fromState === toState) throw new Error('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: repository state transition');
  await assertDefaultThemeRepositoryState(repositoryRoot, fromState);
  const saved = await snapshot(repositoryRoot);
  try {
    await writeSource();
    await setAuthoredState(repositoryRoot, from, to);
    for (const generator of TRANSITION_GENERATORS) {
      if (generator === 'packages/react/src/generate.mjs'
        && await isReactR1PackageBaseline(repositoryRoot)) continue;
      await execFile(process.execPath, [generator], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
    }
    await assertDefaultThemeRepositoryState(repositoryRoot, toState);
    await validate();
  } catch (error) {
    await restore(repositoryRoot, saved);
    throw error;
  } finally {
    await rm(saved.root, { recursive: true, force: true });
  }
}
