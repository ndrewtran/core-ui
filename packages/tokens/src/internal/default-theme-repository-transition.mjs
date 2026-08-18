import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';

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

const REACT_PRIMARY_AUTHORITY = Object.freeze([
  ['strategy/product-scope.md', 'b645bedfad6427f18535898938d2551ce8f6005a0e636c1288f60b8199578b73'],
  ['decisions/0010-amendment-01-react-primary-delivery.md', 'd91e01f48df64c3c0eeb334f64e2b615dbc836867670d4862868138d7ca34341'],
  ['decisions/0010-amendment-02-tale-styling-donor.md', 'd3631a416d3184707222955404c576c10f13f7621296708eb1a3bbc576255d6d'],
]);
const REACT_COMPREHENSIVE_AUTHORITY = Object.freeze([
  ['strategy/product-scope.md', '0cafc0218f0e6795a5d600acb424b4bf514972295c89b48e9042d7faa69a261f'],
  ['decisions/0010-amendment-01-react-primary-delivery.md', 'd91e01f48df64c3c0eeb334f64e2b615dbc836867670d4862868138d7ca34341'],
  ['decisions/0010-amendment-02-tale-styling-donor.md', 'd3631a416d3184707222955404c576c10f13f7621296708eb1a3bbc576255d6d'],
  ['decisions/0010-amendment-03-comprehensive-react-0-1.md', '8ad4be538ad7a35a8c03e01af573cad27a06225e4c91eba61bb7e693e498544a'],
]);
const REACT_PRIMARY_AUTHORITIES = Object.freeze([
  REACT_PRIMARY_AUTHORITY,
  REACT_COMPREHENSIVE_AUTHORITY,
]);

const R1_CONTINUOUS_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  candidatePath: 'decisions/0010-amendment-04-r1-continuous-execution-envelope.md',
  decisionPath: 'decisions/0010-amendment-04-r1-continuous-execution.md',
  decisionSha256: '321fefef4e723ee2d636a4ea6917436bf0babb5c6c7da2a5450e1ffc5c37871f',
  manifestPath: 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json',
  productScopePath: 'strategy/product-scope.md',
  productScopeSha256: 'add747d5986c9039029a99b558ae719969fd18ac113051bbec478bd291da8632',
});

const R1_OWNER_COMMENT_URL = /^https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*$/u;

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

function renderTemplate(template, substitutions) {
  return Object.entries(substitutions).reduce(
    (output, [name, value]) => output.replaceAll(`{${name}}`, value),
    template,
  );
}

async function hasAcceptedR1ContinuousAuthority(repositoryRoot) {
  let acceptanceBytes;
  try {
    const { stdout: stageOutput } = await execFile('git', [
      '-C',
      repositoryRoot,
      'ls-files',
      '--stage',
      '-z',
      '--',
      R1_CONTINUOUS_AUTHORITY.acceptancePath,
    ], { encoding: 'buffer' });
    const records = stageOutput.toString('utf8').split('\0').filter(Boolean);
    if (records.length !== 1) return false;
    const separator = records[0].indexOf('\t');
    if (separator < 0 || records[0].slice(separator + 1) !== R1_CONTINUOUS_AUTHORITY.acceptancePath) return false;
    const [mode, blob, stage] = records[0].slice(0, separator).split(' ');
    if (mode !== '100644' || stage !== '0' || !/^[0-9a-f]{40}$/u.test(blob) || /^0{40}$/u.test(blob)) return false;
    const [{ stdout: indexedBytes }, worktreeBytes] = await Promise.all([
      execFile('git', ['-C', repositoryRoot, 'cat-file', 'blob', blob], { encoding: 'buffer' }),
      readFile(join(repositoryRoot, R1_CONTINUOUS_AUTHORITY.acceptancePath)),
    ]);
    if (!indexedBytes.equals(worktreeBytes)) return false;
    acceptanceBytes = worktreeBytes;
  } catch {
    return false;
  }
  const paths = Object.values(R1_CONTINUOUS_AUTHORITY).filter((value) => (
    typeof value === 'string' && value.includes('/')
  ));
  const sources = Object.fromEntries(await Promise.all(paths.map(async (relativePath) => [
    relativePath,
    relativePath === R1_CONTINUOUS_AUTHORITY.acceptancePath
      ? acceptanceBytes
      : await readFile(join(repositoryRoot, relativePath)).catch(() => null),
  ])));
  if (Object.values(sources).some((source) => source === null)) return false;

  const productScope = sources[R1_CONTINUOUS_AUTHORITY.productScopePath];
  const decision = sources[R1_CONTINUOUS_AUTHORITY.decisionPath];
  const candidate = sources[R1_CONTINUOUS_AUTHORITY.candidatePath];
  const manifestBytes = sources[R1_CONTINUOUS_AUTHORITY.manifestPath];
  const acceptance = sources[R1_CONTINUOUS_AUTHORITY.acceptancePath].toString('utf8');
  if (
    sha256(productScope) !== R1_CONTINUOUS_AUTHORITY.productScopeSha256
    || sha256(decision) !== R1_CONTINUOUS_AUTHORITY.decisionSha256
  ) return false;
  for (const [relativePath, expected] of REACT_COMPREHENSIVE_AUTHORITY.slice(1)) {
    const source = await readFile(join(repositoryRoot, relativePath)).catch(() => null);
    if (!source || sha256(source) !== expected) return false;
  }

  let manifest;
  try {
    manifest = parseJsonStrict(manifestBytes.toString('utf8'));
  } catch {
    return false;
  }
  if (canonicalJson(manifest) !== manifestBytes.toString('utf8')) return false;
  const renderer = manifest.acceptanceRecordRenderer;
  if (
    manifest.profile !== 'core-ui-r1-continuous-execution-materialization-manifest-v1'
    || manifest.selfPath !== R1_CONTINUOUS_AUTHORITY.manifestPath
    || manifest.candidate?.path !== R1_CONTINUOUS_AUTHORITY.candidatePath
    || manifest.candidate?.algorithm !== 'sha256'
    || manifest.candidate?.byteLength !== candidate.byteLength
    || manifest.candidate?.digest !== sha256(candidate)
    || renderer?.outputPath !== R1_CONTINUOUS_AUTHORITY.acceptancePath
    || renderer?.owner !== 'Andrew / ndrewtran'
    || renderer?.ownerComment?.author !== 'ndrewtran'
    || renderer?.ownerComment?.repository !== 'ndrewtran/core-ui'
    || renderer?.ownerComment?.body !== 'exact-rendered-owner-statement'
    || renderer?.ownerComment?.urlPattern !== 'https://github.com/ndrewtran/core-ui/pull/{authorityPrNumber}#issuecomment-{commentId}'
    || typeof renderer?.ownerStatementTemplate !== 'string'
    || typeof renderer?.outputTemplate !== 'string'
    || !Array.isArray(renderer?.substitutions)
    || canonicalJson(renderer?.substitutions) !== canonicalJson([
      'candidateSha256',
      'manifestSha256',
      'ownerCommentUrl',
      'ownerStatement',
      'ownerStatementSha256',
    ])
  ) return false;

  if (!Array.isArray(manifest.staticAfterImages)) return false;
  const imagePaths = new Set();
  for (const image of manifest.staticAfterImages) {
    if (
      image.algorithm !== 'sha256'
      || typeof image.path !== 'string'
      || image.path.startsWith('/')
      || image.path.split('/').includes('..')
      || imagePaths.has(image.path)
    ) return false;
    imagePaths.add(image.path);
    const source = await readFile(join(repositoryRoot, image.path)).catch(() => null);
    if (!source || image.byteLength !== source.byteLength || image.digest !== sha256(source)) return false;
  }
  const expectedWriteSet = new Set([
    R1_CONTINUOUS_AUTHORITY.acceptancePath,
    R1_CONTINUOUS_AUTHORITY.manifestPath,
    ...manifest.staticAfterImages.map(({ path }) => path),
  ]);
  if (
    !Array.isArray(manifest.writeSet)
    || manifest.writeSet.length !== expectedWriteSet.size
    || manifest.writeSet.some((path) => !expectedWriteSet.has(path))
  ) return false;

  const ownerCommentMatch = acceptance.match(/^Owner record: `(https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*)`$/mu);
  const ownerCommentUrl = ownerCommentMatch?.[1];
  if (!ownerCommentUrl || !R1_OWNER_COMMENT_URL.test(ownerCommentUrl)) return false;
  const manifestSha256 = sha256(manifestBytes);
  const ownerStatement = renderTemplate(renderer.ownerStatementTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
  });
  const expectedAcceptance = renderTemplate(renderer.outputTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
    ownerCommentUrl,
    ownerStatement,
    ownerStatementSha256: sha256(ownerStatement),
  });
  return acceptance === expectedAcceptance;
}

export async function hasAcceptedReactPrimaryAuthority(repositoryRoot) {
  for (const authority of REACT_PRIMARY_AUTHORITIES) {
    let matches = true;
    for (const [relativePath, expected] of authority) {
      const source = await readFile(join(repositoryRoot, relativePath)).catch(() => null);
      if (!source || createHash('sha256').update(source).digest('hex') !== expected) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return hasAcceptedR1ContinuousAuthority(repositoryRoot);
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
  if (relativePath === 'packages/react/package.json' && current === '0.1.0-alpha.0'
    && await hasAcceptedReactPrimaryAuthority(repositoryRoot)) return;
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
      && actualVersion === '0.1.0-alpha.0'
      && await hasAcceptedReactPrimaryAuthority(repositoryRoot);
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
  for (const [relativePath, version] of [
    ['packages/react/generated/compatibility.mjs', state.reactPackageVersion],
    ['packages/web/generated/compatibility.mjs', state.webPackageVersion],
  ]) {
    const source = await readFile(join(repositoryRoot, relativePath), 'utf8');
    const r1GeneratedCompatibility = relativePath === 'packages/react/generated/compatibility.mjs'
      && source.includes('0.1.0-alpha.0') && await hasAcceptedReactPrimaryAuthority(repositoryRoot);
    if (!source.includes(`\"version\":\"${version}\"`) && !r1GeneratedCompatibility) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath}`);
    }
  }
  for (const script of TRANSITION_GENERATORS) {
    if (script === 'packages/react/src/generate.mjs'
      && await hasAcceptedReactPrimaryAuthority(repositoryRoot)
      && (await json(join(repositoryRoot, 'packages/react/package.json'))).version === '0.1.0-alpha.0') continue;
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
        && await hasAcceptedReactPrimaryAuthority(repositoryRoot)
        && (await json(join(repositoryRoot, 'packages/react/package.json'))).version === '0.1.0-alpha.0') continue;
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
