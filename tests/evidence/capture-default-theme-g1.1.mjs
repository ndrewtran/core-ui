import { execFile as execFileCallback, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { reactCompatibility } from '../../packages/react/src/index.mjs';
import { reactPlatformSafetyFixture } from '../../packages/react/src/testing.mjs';
import { webCompatibility, webSurfaces } from '../../packages/web/src/index.mjs';
import { platformSafetyFixture } from '../../packages/web/src/testing.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  DEFAULT_THEME_G11_ACCEPTANCE,
  DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
  DEFAULT_THEME_G11_APPLICABILITY_PATHS,
  DEFAULT_THEME_G11_ASSERTION_IDS,
  DEFAULT_THEME_G11_BROWSER_TOOLCHAIN,
  DEFAULT_THEME_G11_DISCLOSURE_CLASS,
  DEFAULT_THEME_G11_EVIDENCE_KINDS,
  DEFAULT_THEME_G11_EXPIRY,
  DEFAULT_THEME_G11_EXPECTED_FACTS,
  DEFAULT_THEME_G11_EXPECTED_TEST_NAMES,
  DEFAULT_THEME_G11_PRODUCT_SOURCE,
  DEFAULT_THEME_G11_PROOF_TOOL_FILES,
  DEFAULT_THEME_G11_RETAINED_COMMANDS,
  DEFAULT_THEME_G11_RETENTION_POLICY,
  DEFAULT_THEME_G11_RESULT_KEYS,
  DEFAULT_THEME_G11_ROOT,
  DEFAULT_THEME_G11_UPSTREAM_G1_ROOT,
  assertDefaultThemeG11Root,
  assertDefaultThemeG11ExecutionTopology,
  createDefaultThemeG11Profile,
  defaultThemeG11CaptureProcedure,
  manifestEntries,
  manifestEntriesAtRevision,
} from './default-theme-g1.1-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const checkOnly = process.argv.includes('--check');

function prefixedSha256(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function normalizeOutput(value, root) {
  return value
    .replaceAll(`/private${root}`, '<repository>')
    .replaceAll(root, '<repository>')
    .replace(/\/private\/var\/folders\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\((?:\d+\.)?\d+ms\)/gu, '(duration)')
    .replace(/duration_ms (?:\d+\.)?\d+/gu, 'duration_ms <duration>')
    .replace(/Done in [^\n]+/gu, 'Done in <duration>')
    .replace(/Took: [^\n]+/gu, 'Took: <duration>')
    .replace(/\r\n/gu, '\n');
}

async function exec(command, args, cwd) {
  try {
    const result = await execFile(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 96 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    return {
      command: [command, ...args].join(' '),
      exitState: 0,
      output: normalizeOutput(result.stdout + result.stderr, cwd),
    };
  } catch (error) {
    const output = normalizeOutput(`${error.stdout ?? ''}${error.stderr ?? ''}`, cwd);
    throw new Error(`DEFAULT_THEME_G11_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
  }
}

async function git(cwd, ...args) {
  return (await exec('git', args, cwd)).output.trim();
}

async function writeCanonical(root, relativePath, value) {
  const bytes = canonicalJson(value);
  const destination = join(root, relativePath);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await writeFile(destination, bytes);
  return bytes;
}

async function readJson(root, relativePath) {
  const bytes = await readFile(join(root, relativePath), 'utf8');
  return { bytes, value: parseJsonStrict(bytes) };
}

async function environment(root) {
  const configuredChrome = process.env.CORE_UI_CHROME_EXECUTABLE;
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = configuredChrome && existsSync(configuredChrome)
    ? { path: configuredChrome, resolution: 'environment-override' }
    : existsSync(systemChrome)
      ? { path: systemChrome, resolution: 'system-google-chrome' }
      : null;
  if (chrome === null) throw new Error('DEFAULT_THEME_G11_BROWSER_UNRESOLVED');
  const requireFromWeb = createRequire(join(root, 'packages/web/package.json'));
  const [node, pnpm, gitVersion, architecture, product, build, browser, browserBytes] = await Promise.all([
    exec('node', ['--version'], root),
    exec('pnpm', ['--version'], root),
    exec('git', ['--version'], root),
    exec('uname', ['-m'], root),
    exec('sw_vers', ['-productVersion'], root),
    exec('sw_vers', ['-buildVersion'], root),
    exec(chrome.path, ['--version'], root),
    readFile(chrome.path),
  ]);
  const playwright = parseJsonStrict(await readFile(requireFromWeb.resolve('playwright-core/package.json'), 'utf8'));
  const axe = parseJsonStrict(await readFile(requireFromWeb.resolve('axe-core/package.json'), 'utf8'));
  if (
    playwright.version !== DEFAULT_THEME_G11_BROWSER_TOOLCHAIN.playwright
    || axe.version !== DEFAULT_THEME_G11_BROWSER_TOOLCHAIN.axe
  ) throw new Error('DEFAULT_THEME_G11_BROWSER_TOOLCHAIN_INVALID');
  return {
    architecture: architecture.output.trim(),
    axe: axe.version,
    browser: browser.output.trim(),
    browserExecutableSha256: prefixedSha256(browserBytes),
    browserResolution: chrome.resolution,
    git: gitVersion.output.trim().replace(/^git version /u, ''),
    node: node.output.trim(),
    playwright: playwright.version,
    pnpm: pnpm.output.trim(),
    runnerImage: `local-macos-${product.output.trim()}`,
    runnerImageVersion: build.output.trim(),
    runnerOs: `macOS ${product.output.trim()}`,
  };
}

export function parseDefaultThemeG11Arguments(args) {
  const allowed = new Set([
    '--source', '--tree', '--executed', '--executed-tree', '--timestamp',
  ]);
  if (args.length !== 10) throw new Error('DEFAULT_THEME_G11_ARGUMENT_INVALID');
  const values = {};
  for (let position = 0; position < args.length; position += 2) {
    const name = args[position];
    const value = args[position + 1];
    if (!allowed.has(name) || Object.hasOwn(values, name) || value?.startsWith('--')) {
      throw new Error('DEFAULT_THEME_G11_ARGUMENT_INVALID');
    }
    values[name] = value;
  }
  if (
    !/^[0-9a-f]{40}$/u.test(values['--source'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--tree'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--executed'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--executed-tree'] ?? '')
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(values['--timestamp'] ?? '')
  ) throw new Error('DEFAULT_THEME_G11_ARGUMENT_REQUIRED');
  return {
    executedRevision: values['--executed'],
    executedTree: values['--executed-tree'],
    sourceRevision: values['--source'],
    sourceTree: values['--tree'],
    timestamp: values['--timestamp'],
  };
}

export function assertTruthfulDefaultThemeG11Timestamp(value, executedCommitTime, now = new Date()) {
  const observed = new Date(value);
  const executed = new Date(executedCommitTime);
  if (
    Number.isNaN(observed.valueOf())
    || Number.isNaN(executed.valueOf())
    || observed.toISOString().replace('.000Z', 'Z') !== value
    || observed < executed
    || observed < new Date(DEFAULT_THEME_G11_ACCEPTANCE.updatedAt)
    || observed > now
  ) throw new Error('DEFAULT_THEME_G11_TIMESTAMP_INVALID');
}

async function assertProductFacts(root) {
  const source = parseJsonStrict(await readFile(join(root, 'catalog/tokens/default-theme.json'), 'utf8'));
  const compiled = await compileCatalog({ repositoryRoot: root });
  const button = compiled.bundle.artifacts.find(({ id }) => id === 'core:component:button');
  if (button === undefined) throw new Error('DEFAULT_THEME_G11_COMPONENT_MISSING');
  const htmlSurface = webSurfaces['web.html'].surface;
  const reactSurface = webSurfaces['web.react'].surface;
  const comparable = (surface) => ({ ...surface, bindingRef: null, bindingSpecRevision: null });
  if (canonicalJson(comparable(htmlSurface)) !== canonicalJson(comparable(reactSurface))) {
    throw new Error('DEFAULT_THEME_G11_SURFACE_DIVERGED');
  }
  const requirementSetDigests = Object.fromEntries(Object.entries(platformSafetyFixture.profiles)
    .map(([profile, fixture]) => [profile, fixture.requirementSet.digest]));
  const requiredAssertions = platformSafetyFixture.profiles['web.html'].requiredAssertions;
  const observed = {
    catalogDigest: compiled.bundle.catalogDigest,
    catalogSourceRevision: compiled.bundle.sourceRevision,
    catalogVersion: compiled.bundle.catalogVersion,
    componentContentRevision: button.contentRevision,
    componentId: button.id,
    reactSourceRevision: reactCompatibility.sourceRevision,
    reactStyleSource: reactCompatibility.styleSource,
    reactWebSpecRevision: reactCompatibility.bindings['web.react'].specRevision,
    sourceId: source.id,
    sourceRevision: canonicalDigest(source),
    stylesheetDigest: platformSafetyFixture.stylesheetDigest,
    tokenContractVersion: source.tokenContractVersion,
    webHtmlSpecRevision: webCompatibility.bindings['web.html'].specRevision,
    webReactSpecRevision: webCompatibility.bindings['web.react'].specRevision,
    webSourceRevision: webCompatibility.sourceRevision,
  };
  const expected = {
    catalogDigest: 'sha256:0fef5d4d60ba03b9bcdc64ac04acb5253eff17f0aad1e71df4f12f7e0907ebe7',
    catalogSourceRevision: 'sha256:579decd13cd6440e7ecf520d6318f5ba5222fb45943d76c1f6705d1fc5d071eb',
    catalogVersion: '2.0.0',
    componentContentRevision: 'sha256:bf8b32628c13bd33da48df165dae9db396f62497c027be5dd81f5d886d9e2e2b',
    componentId: 'core:component:button',
    reactSourceRevision: 'sha256:579decd13cd6440e7ecf520d6318f5ba5222fb45943d76c1f6705d1fc5d071eb',
    reactStyleSource: '@core-ui/web/button.css',
    reactWebSpecRevision: DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-02'].webReactSpecRevision,
    sourceId: 'core:token:default-theme',
    sourceRevision: 'sha256:01982f878f3f4b29bf889fcc0cc9577e1bde3fb69a646f1972e74dd8b9347757',
    stylesheetDigest: DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-06'].stylesheetDigest,
    tokenContractVersion: '2.0.0',
    webHtmlSpecRevision: DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-02'].webHtmlSpecRevision,
    webReactSpecRevision: DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-02'].webReactSpecRevision,
    webSourceRevision: 'sha256:579decd13cd6440e7ecf520d6318f5ba5222fb45943d76c1f6705d1fc5d071eb',
  };
  if (canonicalJson(observed) !== canonicalJson(expected)) {
    throw new Error(`DEFAULT_THEME_G11_PRODUCT_FACT_MISMATCH\nexpected ${canonicalJson(expected)}\nobserved ${canonicalJson(observed)}`);
  }
  if (
    canonicalJson(requirementSetDigests) !== canonicalJson(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-06'].requirementSetDigests)
    || canonicalJson(requiredAssertions) !== canonicalJson(DEFAULT_THEME_G11_EXPECTED_FACTS['E-G1.1-06'].requiredAssertions)
    || platformSafetyFixture.componentSupportClaim !== 'none'
    || reactPlatformSafetyFixture.componentSupportClaim !== 'none'
    || reactPlatformSafetyFixture.stylesheetDigest !== platformSafetyFixture.stylesheetDigest
  ) throw new Error('DEFAULT_THEME_G11_PLATFORM_SAFETY_FACT_MISMATCH');
  return structuredClone(DEFAULT_THEME_G11_EXPECTED_FACTS);
}

async function proofToolReferences(root, executedRevision) {
  return DEFAULT_THEME_G11_PROOF_TOOL_FILES.map((path) => ({
    path,
    sha256: prefixedSha256(execFileSync('git', ['show', `${executedRevision}:${path}`], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    })),
  }));
}

async function writeValidationOutput(root, key, result) {
  const relativePath = `${DEFAULT_THEME_G11_ROOT}/validation/${key}.txt`;
  await mkdir(resolve(join(root, relativePath), '..'), { recursive: true });
  await writeFile(join(root, relativePath), result.output);
  return {
    command: result.command,
    exitState: 0,
    rawOutput: { path: relativePath, sha256: prefixedSha256(result.output) },
  };
}

async function writeEvidence(root, context) {
  const validationPath = `${DEFAULT_THEME_G11_ROOT}/validation.json`;
  const validationBytes = await writeCanonical(root, validationPath, {
    applicabilityProfile: context.profile,
    captureProcedure: context.captureProcedure,
    environment: context.environment,
    executedRevision: context.executedRevision,
    executedTree: context.executedTree,
    results: context.results,
    schema: 'core-ui-evidence-validation-v1',
    sourceRevision: context.sourceRevision,
    sourceTree: context.sourceTree,
  });
  const validation = { path: validationPath, sha256: prefixedSha256(validationBytes) };
  const recordReferences = [];
  for (const assertionId of DEFAULT_THEME_G11_ASSERTION_IDS) {
    const selected = DEFAULT_THEME_G11_RETAINED_COMMANDS[assertionId]
      .map((command) => context.results.find((result) => result.command === command));
    if (selected.some((result) => result === undefined)) {
      throw new Error(`DEFAULT_THEME_G11_RESULT_SET_INVALID: ${assertionId}`);
    }
    const command = selected.map((result) => result.command).join(' && ');
    const artifactPath = `${DEFAULT_THEME_G11_ROOT}/artifacts/${assertionId}.json`;
    const artifactBytes = await writeCanonical(root, artifactPath, {
      applicabilityManifest: DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
      applicabilityProfile: context.profile,
      assertionId,
      captureTimestamp: context.timestamp,
      command,
      environment: context.environment,
      evidenceKind: DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId],
      executedRevision: context.executedRevision,
      executedTree: context.executedTree,
      exitState: 0,
      observations: {
        facts: DEFAULT_THEME_G11_EXPECTED_FACTS[assertionId],
        retainedResults: selected.map(({ command: name, rawOutput }) => ({
          command: name,
          outputSha256: rawOutput.sha256,
        })),
        testNames: DEFAULT_THEME_G11_EXPECTED_TEST_NAMES[assertionId],
      },
      outcome: 'pass',
      schema: 'core-ui-evidence-artifact-v1',
      sourceRevision: context.sourceRevision,
      sourceTree: context.sourceTree,
    });
    const recordPath = `${DEFAULT_THEME_G11_ROOT}/records/${assertionId}.json`;
    const recordBytes = await writeCanonical(root, recordPath, {
      activeExceptionRefs: [],
      advisoryRefs: [],
      applicabilityManifest: DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
      applicabilityProfile: context.profile,
      artifact: { path: artifactPath, sha256: prefixedSha256(artifactBytes) },
      assertionId,
      captureTimestamp: context.timestamp,
      command,
      disclosureClass: DEFAULT_THEME_G11_DISCLOSURE_CLASS,
      environment: context.environment,
      evidenceKind: DEFAULT_THEME_G11_EVIDENCE_KINDS[assertionId],
      executedRevision: context.executedRevision,
      executedTree: context.executedTree,
      expiry: DEFAULT_THEME_G11_EXPIRY,
      milestone: 'G1.1',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: DEFAULT_THEME_G11_RETENTION_POLICY,
      schema: 'core-ui-evidence-record-v1',
      sourceRevision: context.sourceRevision,
      sourceTree: context.sourceTree,
      validation,
    });
    recordReferences.push({
      assertionId,
      path: recordPath,
      sha256: prefixedSha256(recordBytes),
    });
  }
  await writeCanonical(root, `${DEFAULT_THEME_G11_ROOT}/index.json`, {
    applicabilityManifest: DEFAULT_THEME_G11_APPLICABILITY_MANIFEST,
    applicabilityProfile: context.profile,
    captureTimestamp: context.timestamp,
    disclosureClass: DEFAULT_THEME_G11_DISCLOSURE_CLASS,
    executedRevision: context.executedRevision,
    executedTree: context.executedTree,
    milestone: 'G1.1',
    owner: 'ndrewtran',
    records: recordReferences,
    recertifications: [],
    retentionPolicy: DEFAULT_THEME_G11_RETENTION_POLICY,
    schema: 'core-ui-evidence-index-v1',
    sourceRevision: context.sourceRevision,
    sourceTree: context.sourceTree,
    supersessions: [],
    validation,
  });
}

async function runInitialCommands(root) {
  return {
    profile: await exec('node', ['--test', 'tests/evidence/default-theme-g1.1-profile.test.mjs'], root),
    web: await exec('pnpm', ['--filter', '@core-ui/web', 'check'], root),
    react: await exec('pnpm', ['--filter', '@core-ui/react', 'check'], root),
    generation: await exec('pnpm', ['generate:check'], root),
    agent: await exec('pnpm', ['test:agent'], root),
    release: await exec('pnpm', ['release:prepare'], root),
  };
}

function assertFocusedNames(output) {
  const expected = Object.values(DEFAULT_THEME_G11_EXPECTED_TEST_NAMES).flat();
  for (const name of expected) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const matches = output.match(new RegExp(escaped, 'gu')) ?? [];
    if (matches.length !== 1) {
      throw new Error(`DEFAULT_THEME_G11_FOCUSED_ASSERTION_INVALID: ${name} observed ${matches.length}`);
    }
  }
}

async function assertCapturePreconditions(root, identities) {
  if (
    identities.sourceRevision !== DEFAULT_THEME_G11_PRODUCT_SOURCE.revision
    || identities.sourceTree !== DEFAULT_THEME_G11_PRODUCT_SOURCE.tree
  ) throw new Error('DEFAULT_THEME_G11_PRODUCT_SOURCE_INVALID');
  if (await git(root, 'rev-parse', 'HEAD') !== identities.executedRevision) {
    throw new Error('DEFAULT_THEME_G11_EXECUTED_REVISION_INVALID');
  }
  if (
    await git(root, 'rev-parse', `${identities.executedRevision}^{tree}`) !== identities.executedTree
    || await git(root, 'rev-parse', `${identities.sourceRevision}^{tree}`) !== identities.sourceTree
  ) throw new Error('DEFAULT_THEME_G11_GIT_TREE_INVALID');
  const revisionLine = (await git(root, 'rev-list', '--parents', '-n', '1', identities.executedRevision))
    .split(' ');
  const changes = (await git(
    root,
    'diff-tree', '--no-commit-id', '--name-status', '-r', identities.executedRevision,
  )).split('\n').filter(Boolean);
  assertDefaultThemeG11ExecutionTopology({
    changes,
    parents: revisionLine.slice(1),
    revision: revisionLine[0],
    tree: identities.executedTree,
  });
  const status = await git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new Error(`DEFAULT_THEME_G11_WORKTREE_DRIFT: ${status}`);
  try {
    await access(join(root, DEFAULT_THEME_G11_ROOT));
    throw new Error('DEFAULT_THEME_G11_OUTPUT_EXISTS');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const executedCommitTime = await git(root, 'show', '-s', '--format=%cI', identities.executedRevision);
  assertTruthfulDefaultThemeG11Timestamp(identities.timestamp, executedCommitTime);
  const productEntries = manifestEntriesAtRevision(
    root,
    identities.sourceRevision,
    DEFAULT_THEME_G11_APPLICABILITY_PATHS,
  );
  const currentEntries = await manifestEntries(root, DEFAULT_THEME_G11_APPLICABILITY_PATHS);
  if (
    productEntries.length !== 194
    || Buffer.byteLength(canonicalJson(productEntries)) !== 27146
    || prefixedSha256(canonicalJson(productEntries)) !== DEFAULT_THEME_G11_APPLICABILITY_MANIFEST.sha256
    || canonicalJson(currentEntries) !== canonicalJson(productEntries)
  ) throw new Error('DEFAULT_THEME_G11_APPLICABILITY_DRIFT');
  for (const reference of [DEFAULT_THEME_G11_UPSTREAM_G1_ROOT]) {
    if (prefixedSha256(await readFile(join(root, reference.path))) !== reference.sha256) {
      throw new Error(`DEFAULT_THEME_G11_UPSTREAM_BINDING_INVALID: ${reference.path}`);
    }
  }
}

async function captureAt(root, identities) {
  await assertCapturePreconditions(root, identities);
  const env = await environment(root);
  if (env.node !== 'v24.19.0') throw new Error(`DEFAULT_THEME_G11_RUNTIME_INVALID: ${env.node}`);
  const toolFiles = await proofToolReferences(root, identities.executedRevision);
  const profile = createDefaultThemeG11Profile({
    executedRevision: identities.executedRevision,
    executedTree: identities.executedTree,
    toolFiles,
  });
  await assertProductFacts(root);
  const initialCommands = await runInitialCommands(root);
  assertFocusedNames(`${initialCommands.profile.output}\n${initialCommands.web.output}\n${initialCommands.react.output}`);
  const captureProcedure = defaultThemeG11CaptureProcedure(identities);
  const context = {
    ...identities,
    captureProcedure,
    environment: env,
    profile,
    results: [],
  };
  await mkdir(join(root, DEFAULT_THEME_G11_ROOT), { recursive: true });
  for (const key of Object.keys(initialCommands)) {
    context.results.push(await writeValidationOutput(root, key, initialCommands[key]));
  }
  await writeEvidence(root, context);
  const finalCommands = {
    evidence: await exec('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], root),
    check: await exec('pnpm', ['check'], root),
    'check-all': await exec('pnpm', ['check:all'], root),
  };
  for (const key of Object.keys(finalCommands)) {
    context.results.push(await writeValidationOutput(root, key, finalCommands[key]));
  }
  if (canonicalJson(context.results.map(({ rawOutput }) => rawOutput.path.split('/').at(-1).replace(/\.txt$/u, '')))
    !== canonicalJson(DEFAULT_THEME_G11_RESULT_KEYS)) {
    throw new Error('DEFAULT_THEME_G11_RESULT_SET_INVALID');
  }
  await writeEvidence(root, context);
  await assertDefaultThemeG11Root(root);
  await exec('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], root);
  return context;
}

async function listFiles(root, relative = '') {
  const output = [];
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(root, path));
    else output.push(path);
  }
  return output;
}

export async function compareDefaultThemeG11Trees(expectedRoot, actualRoot) {
  const expectedFiles = await listFiles(join(expectedRoot, DEFAULT_THEME_G11_ROOT));
  const actualFiles = await listFiles(join(actualRoot, DEFAULT_THEME_G11_ROOT));
  if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) {
    throw new Error('DEFAULT_THEME_G11_EVIDENCE_DRIFT: file set differs');
  }
  for (const path of expectedFiles) {
    const [expected, actual] = await Promise.all([
      readFile(join(expectedRoot, DEFAULT_THEME_G11_ROOT, path)),
      readFile(join(actualRoot, DEFAULT_THEME_G11_ROOT, path)),
    ]);
    if (!expected.equals(actual)) {
      throw new Error(`DEFAULT_THEME_G11_EVIDENCE_DRIFT: ${path}`);
    }
  }
}

async function withGeneratedOutput(identities, operation) {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-default-theme-g1-1-'));
  const checkout = join(temporary, 'checkout');
  try {
    await exec('git', ['worktree', 'add', '--detach', checkout, identities.executedRevision], repositoryRoot);
    await exec('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], checkout);
    await captureAt(checkout, identities);
    return await operation(checkout);
  } finally {
    await exec('git', ['worktree', 'remove', '--force', checkout], repositoryRoot).catch(() => null);
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function publishDefaultThemeG11Atomically({
  afterPublish = async () => {},
  destinationRoot,
  generatedRoot,
  renameOperation = rename,
  rollbackRenameOperation = rename,
}) {
  const transactionRoot = await mkdtemp(join(destinationRoot, 'tests/evidence/.default-theme-g1-1.transaction-'));
  const staged = join(transactionRoot, DEFAULT_THEME_G11_ROOT);
  const destination = join(destinationRoot, DEFAULT_THEME_G11_ROOT);
  let published = false;
  try {
    await mkdir(resolve(staged, '..'), { recursive: true });
    await cp(join(generatedRoot, DEFAULT_THEME_G11_ROOT), staged, { recursive: true });
    await compareDefaultThemeG11Trees(generatedRoot, transactionRoot);
    await renameOperation(staged, destination);
    published = true;
    await rm(transactionRoot, { recursive: true, force: true });
    await afterPublish();
  } catch (error) {
    const rollbackFailures = [];
    if (published) {
      try {
        await mkdir(resolve(staged, '..'), { recursive: true });
        await rollbackRenameOperation(destination, staged);
      } catch (rollbackError) {
        rollbackFailures.push(rollbackError.message);
        await rm(destination, { recursive: true, force: true }).catch((cleanupError) => {
          rollbackFailures.push(cleanupError.message);
        });
      }
    }
    let residual = false;
    try {
      await access(destination);
      residual = true;
    } catch (accessError) {
      if (accessError?.code !== 'ENOENT') rollbackFailures.push(accessError.message);
    }
    if (rollbackFailures.length > 0 || residual) {
      throw new Error(
        `DEFAULT_THEME_G11_ROLLBACK_INTEGRITY: original=${error.message}; failures=${rollbackFailures.join(' | ') || 'none'}; residual=${residual}`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(transactionRoot, { recursive: true, force: true });
  }
}

async function publishGeneratedOutput(generatedRoot) {
  await publishDefaultThemeG11Atomically({
    afterPublish: async () => {
      await assertDefaultThemeG11Root(repositoryRoot);
      await exec('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], repositoryRoot);
    },
    destinationRoot: repositoryRoot,
    generatedRoot,
  });
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
  if (checkOnly) {
    if (process.argv.length !== 3) throw new Error('DEFAULT_THEME_G11_ARGUMENT_INVALID');
    const retained = (await readJson(repositoryRoot, `${DEFAULT_THEME_G11_ROOT}/index.json`)).value;
    const identities = {
      executedRevision: retained.executedRevision,
      executedTree: retained.executedTree,
      sourceRevision: retained.sourceRevision,
      sourceTree: retained.sourceTree,
      timestamp: retained.captureTimestamp,
    };
    await assertDefaultThemeG11Root(repositoryRoot);
    await withGeneratedOutput(identities, async (generatedRoot) => {
      await compareDefaultThemeG11Trees(repositoryRoot, generatedRoot);
    });
    console.log(`[G1.1] verified six records at ${identities.sourceRevision} using ${identities.executedRevision}`);
  } else {
    const identities = parseDefaultThemeG11Arguments(process.argv.slice(2));
    if (await git(repositoryRoot, 'rev-parse', 'HEAD') !== identities.executedRevision) {
      throw new Error('DEFAULT_THEME_G11_EXECUTED_REVISION_INVALID');
    }
    if (await git(repositoryRoot, 'status', '--porcelain=v1', '--untracked-files=all')) {
      throw new Error('DEFAULT_THEME_G11_WORKTREE_DRIFT');
    }
    await withGeneratedOutput(identities, publishGeneratedOutput);
    console.log(`[G1.1] captured six records at ${identities.sourceRevision} using ${identities.executedRevision}`);
  }
}
