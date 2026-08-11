import { execFile as execFileCallback, execFileSync } from 'node:child_process';
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
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  compileNativeTheme,
  compileWebTheme,
  validateSourceCrosswalk,
} from '../../packages/tokens/src/index.mjs';
import { sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import {
  DEFAULT_THEME_G1_ACCEPTANCE,
  DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
  DEFAULT_THEME_G1_APPLICABILITY_PATHS,
  DEFAULT_THEME_G1_ASSERTION_IDS,
  DEFAULT_THEME_G1_DISCLOSURE_CLASS,
  DEFAULT_THEME_G1_EVIDENCE_KINDS,
  DEFAULT_THEME_G1_EXPIRY,
  DEFAULT_THEME_G1_EXPECTED_FACTS,
  DEFAULT_THEME_G1_EXPECTED_TEST_NAMES,
  DEFAULT_THEME_G1_MAINTENANCE_CONTEXT,
  DEFAULT_THEME_G1_PHASE_C_ROOTS,
  DEFAULT_THEME_G1_PRODUCT_SOURCE,
  DEFAULT_THEME_G1_PROOF_TOOL_FILES,
  DEFAULT_THEME_G1_RETAINED_COMMANDS,
  DEFAULT_THEME_G1_RETENTION_POLICY,
  DEFAULT_THEME_G1_RESULT_KEYS,
  DEFAULT_THEME_G1_ROOT,
  assertDefaultThemeG1Root,
  assertDefaultThemeG1ExecutionTopology,
  createDefaultThemeG1Profile,
  defaultThemeG1CaptureProcedure,
  manifestEntries,
  manifestEntriesAtRevision,
} from './default-theme-g1.0-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const checkOnly = process.argv.includes('--check');
const targetTestArguments = Object.freeze([
  '--test',
  'packages/tokens/test/token-contract.test.mjs',
  'packages/tokens/test/tale-token-materialization.test.mjs',
  'packages/schema/test/platform-safety.test.mjs',
  'packages/catalog/test/catalog-package.test.mjs',
  'packages/foundation/test/foundation-boundary.test.mjs',
]);

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
    throw new Error(`DEFAULT_THEME_G1_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
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
  const [node, pnpm, gitVersion, architecture, product, build] = await Promise.all([
    exec('node', ['--version'], root),
    exec('pnpm', ['--version'], root),
    exec('git', ['--version'], root),
    exec('uname', ['-m'], root),
    exec('sw_vers', ['-productVersion'], root),
    exec('sw_vers', ['-buildVersion'], root),
  ]);
  return {
    architecture: architecture.output.trim(),
    git: gitVersion.output.trim().replace(/^git version /u, ''),
    node: node.output.trim(),
    pnpm: pnpm.output.trim(),
    runnerImage: `local-macos-${product.output.trim()}`,
    runnerImageVersion: build.output.trim(),
    runnerOs: `macOS ${product.output.trim()}`,
  };
}

export function parseDefaultThemeG1Arguments(args) {
  const allowed = new Set([
    '--source', '--tree', '--executed', '--executed-tree', '--timestamp',
  ]);
  if (args.length !== 10) throw new Error('DEFAULT_THEME_G1_ARGUMENT_INVALID');
  const values = {};
  for (let position = 0; position < args.length; position += 2) {
    const name = args[position];
    const value = args[position + 1];
    if (!allowed.has(name) || Object.hasOwn(values, name) || value?.startsWith('--')) {
      throw new Error('DEFAULT_THEME_G1_ARGUMENT_INVALID');
    }
    values[name] = value;
  }
  if (
    !/^[0-9a-f]{40}$/u.test(values['--source'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--tree'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--executed'] ?? '')
    || !/^[0-9a-f]{40}$/u.test(values['--executed-tree'] ?? '')
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(values['--timestamp'] ?? '')
  ) throw new Error('DEFAULT_THEME_G1_ARGUMENT_REQUIRED');
  return {
    executedRevision: values['--executed'],
    executedTree: values['--executed-tree'],
    sourceRevision: values['--source'],
    sourceTree: values['--tree'],
    timestamp: values['--timestamp'],
  };
}

export function assertTruthfulDefaultThemeG1Timestamp(value, executedCommitTime, now = new Date()) {
  const observed = new Date(value);
  const executed = new Date(executedCommitTime);
  if (
    Number.isNaN(observed.valueOf())
    || Number.isNaN(executed.valueOf())
    || observed.toISOString().replace('.000Z', 'Z') !== value
    || observed < executed
    || observed < new Date(DEFAULT_THEME_G1_ACCEPTANCE.updatedAt)
    || observed > now
  ) throw new Error('DEFAULT_THEME_G1_TIMESTAMP_INVALID');
}

async function assertProductFacts(root) {
  const source = parseJsonStrict(await readFile(join(root, 'catalog/tokens/default-theme.json'), 'utf8'));
  const occurrences = parseJsonStrict(await readFile(
    join(root, 'packages/tokens/generated/tale-token-occurrences.json'),
    'utf8',
  ));
  const web = compileWebTheme(source);
  const ios = compileNativeTheme(source, { profile: 'native.ios' });
  const android = compileNativeTheme(source, { profile: 'native.android' });
  const crosswalk = validateSourceCrosswalk(source, { baselineOccurrences: occurrences });
  const compiled = await compileCatalog({ repositoryRoot: root });
  const button = compiled.bundle.artifacts.find(({ id }) => id === 'core:component:button');
  const catalogPackage = parseJsonStrict(await readFile(
    join(root, 'packages/catalog/generated/catalog-package.json'),
    'utf8',
  ));
  const foundationPackage = parseJsonStrict(await readFile(
    join(root, 'packages/foundation/package.json'),
    'utf8',
  ));
  const semanticSource = await readFile(join(root, 'packages/foundation/src/semantic/index.mjs'), 'utf8');
  const logicSource = await readFile(join(root, 'packages/foundation/src/logic/index.mjs'), 'utf8');
  const layers = Object.values(source.tokens).reduce((result, token) => {
    result[token.layer] = (result[token.layer] ?? 0) + 1;
    return result;
  }, {});
  const dispositions = source.sourceCrosswalk.entries.reduce((result, entry) => {
    result[entry.disposition] = (result[entry.disposition] ?? 0) + 1;
    return result;
  }, {});
  const referenceIds = new Set(source.sourceCrosswalk.entries
    .filter(({ disposition }) => ['adopt', 'adapt'].includes(disposition))
    .map(({ coreTokenId }) => coreTokenId));
  const facts = structuredClone(DEFAULT_THEME_G1_EXPECTED_FACTS);
  const observed = {
    catalogDigest: compiled.bundle.catalogDigest,
    catalogSourceRevision: compiled.bundle.sourceRevision,
    catalogVersion: compiled.bundle.catalogVersion,
    crosswalkDigest: crosswalk.digest,
    crosswalkEntries: source.sourceCrosswalk.entries.length,
    crosswalkGroups: source.sourceCrosswalk.groups.length,
    dispositions,
    foundationExports: Object.keys(foundationPackage.exports).sort(),
    foundationLogicImportsSemantic: logicSource.includes('../semantic'),
    foundationSemanticImportsLogic: semanticSource.includes('../logic'),
    layers,
    bindingSpecRevisions: button.bindingSpecRevisions,
    nativeAndroidCount: Object.keys(android.theme).length,
    nativeCss: Object.hasOwn(ios, 'css') || Object.hasOwn(android, 'css'),
    nativeIosCount: Object.keys(ios.theme).length,
    packageSchema: catalogPackage.schema,
    packageVersion: catalogPackage.version,
    queryApiVersion: catalogPackage.queryApiVersion,
    referenceIds: referenceIds.size,
    sourceId: source.id,
    sourceRevision: canonicalDigest(source),
    supportedQueryApiVersions: catalogPackage.supportedQueryApiVersions,
    tokenContractVersion: source.tokenContractVersion,
    tokenRequirementSetDigests: Object.fromEntries(Object.entries(button.tokenRequirementSets)
      .map(([key, value]) => [key, value.digest])),
    platformSafetyRequirementSetDigests: Object.fromEntries(Object.entries(
      button.platformSafetyRequirementSets,
    ).map(([key, value]) => [key, value.digest])),
    rnwDispositions: (() => {
      const binding = button.record.bindings['native.react-native'];
      const declaration = binding.platformSafety.find(
        ({ profile }) => profile === 'native.react-native-web',
      );
      return binding.runtimeProfiles['native.react-native-web'].strategy === 'unsupported'
        && declaration.requirements.length > 0
        && declaration.requirements.every(({ disposition, reason }) => (
          disposition === 'not-applicable' && typeof reason === 'string' && reason.length > 0
        )) ? 'all-reasoned-not-applicable' : 'invalid';
    })(),
    webReferenceCount: (web.css.match(/--core-reference-/gu) ?? []).length,
    webStylesheetSha256: prefixedSha256(web.css),
  };
  const expected = {
    catalogDigest: facts['E-G1.0-04'].catalogDigest,
    catalogSourceRevision: facts['E-G1.0-04'].sourceRevision,
    catalogVersion: facts['E-G1.0-04'].catalogVersion,
    crosswalkDigest: facts['E-G1.0-08'].crosswalkDigest,
    crosswalkEntries: facts['E-G1.0-08'].entryCount,
    crosswalkGroups: facts['E-G1.0-08'].groupCount,
    dispositions: facts['E-G1.0-08'].dispositions,
    foundationExports: facts['E-G1.0-05'].exports,
    foundationLogicImportsSemantic: true,
    foundationSemanticImportsLogic: false,
    bindingSpecRevisions: facts['E-G1.0-07'].bindingSpecRevisions,
    layers: facts['E-G1.0-01'].layers,
    nativeAndroidCount: facts['E-G1.0-02'].native.tokenCount,
    nativeCss: false,
    nativeIosCount: facts['E-G1.0-02'].native.tokenCount,
    packageSchema: facts['E-G1.0-04'].packageSchema,
    packageVersion: facts['E-G1.0-04'].packageVersion,
    queryApiVersion: facts['E-G1.0-04'].queryApiVersion,
    referenceIds: facts['E-G1.0-08'].admittedReferenceCount,
    sourceId: facts['E-G1.0-01'].sourceId,
    sourceRevision: facts['E-G1.0-01'].sourceRevision,
    supportedQueryApiVersions: facts['E-G1.0-04'].supportedQueryApiVersions,
    tokenContractVersion: facts['E-G1.0-01'].tokenContractVersion,
    tokenRequirementSetDigests: facts['E-G1.0-04'].tokenRequirementSetDigests,
    platformSafetyRequirementSetDigests: facts['E-G1.0-07'].platformSafetyRequirementSetDigests,
    rnwDispositions: facts['E-G1.0-07'].rnwDispositions,
    webReferenceCount: facts['E-G1.0-02'].webReferenceCount,
    webStylesheetSha256: facts['E-G1.0-02'].webStylesheetSha256,
  };
  if (canonicalJson(observed) !== canonicalJson(expected)) {
    throw new Error(`DEFAULT_THEME_G1_PRODUCT_FACT_MISMATCH\nexpected ${canonicalJson(expected)}\nobserved ${canonicalJson(observed)}`);
  }
  return facts;
}

async function proofToolReferences(root, executedRevision) {
  return DEFAULT_THEME_G1_PROOF_TOOL_FILES.map((path) => ({
    path,
    sha256: prefixedSha256(execFileSync('git', ['show', `${executedRevision}:${path}`], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    })),
  }));
}

async function writeValidationOutput(root, key, result) {
  const relativePath = `${DEFAULT_THEME_G1_ROOT}/validation/${key}.txt`;
  await mkdir(resolve(join(root, relativePath), '..'), { recursive: true });
  await writeFile(join(root, relativePath), result.output);
  return {
    command: result.command,
    exitState: 0,
    rawOutput: { path: relativePath, sha256: prefixedSha256(result.output) },
  };
}

async function writeEvidence(root, context) {
  const validationPath = `${DEFAULT_THEME_G1_ROOT}/validation.json`;
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
  for (const assertionId of DEFAULT_THEME_G1_ASSERTION_IDS) {
    const selected = DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId]
      .map((command) => context.results.find((result) => result.command === command));
    if (selected.some((result) => result === undefined)) {
      throw new Error(`DEFAULT_THEME_G1_RESULT_SET_INVALID: ${assertionId}`);
    }
    const command = selected.map((result) => result.command).join(' && ');
    const artifactPath = `${DEFAULT_THEME_G1_ROOT}/artifacts/${assertionId}.json`;
    const artifactBytes = await writeCanonical(root, artifactPath, {
      applicabilityManifest: DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
      applicabilityProfile: context.profile,
      assertionId,
      captureTimestamp: context.timestamp,
      command,
      environment: context.environment,
      evidenceKind: DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId],
      executedRevision: context.executedRevision,
      executedTree: context.executedTree,
      exitState: 0,
      observations: {
        facts: DEFAULT_THEME_G1_EXPECTED_FACTS[assertionId],
        retainedResults: selected.map(({ command: name, rawOutput }) => ({
          command: name,
          outputSha256: rawOutput.sha256,
        })),
        testNames: DEFAULT_THEME_G1_EXPECTED_TEST_NAMES[assertionId],
      },
      outcome: 'pass',
      schema: 'core-ui-evidence-artifact-v1',
      sourceRevision: context.sourceRevision,
      sourceTree: context.sourceTree,
    });
    const recordPath = `${DEFAULT_THEME_G1_ROOT}/records/${assertionId}.json`;
    const recordBytes = await writeCanonical(root, recordPath, {
      activeExceptionRefs: [],
      advisoryRefs: [],
      applicabilityManifest: DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
      applicabilityProfile: context.profile,
      artifact: { path: artifactPath, sha256: prefixedSha256(artifactBytes) },
      assertionId,
      captureTimestamp: context.timestamp,
      command,
      disclosureClass: DEFAULT_THEME_G1_DISCLOSURE_CLASS,
      environment: context.environment,
      evidenceKind: DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId],
      executedRevision: context.executedRevision,
      executedTree: context.executedTree,
      expiry: DEFAULT_THEME_G1_EXPIRY,
      milestone: 'G1.0',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: DEFAULT_THEME_G1_RETENTION_POLICY,
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
  await writeCanonical(root, `${DEFAULT_THEME_G1_ROOT}/index.json`, {
    applicabilityManifest: DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
    applicabilityProfile: context.profile,
    captureTimestamp: context.timestamp,
    disclosureClass: DEFAULT_THEME_G1_DISCLOSURE_CLASS,
    executedRevision: context.executedRevision,
    executedTree: context.executedTree,
    milestone: 'G1.0',
    owner: 'ndrewtran',
    records: recordReferences,
    recertifications: [],
    retentionPolicy: DEFAULT_THEME_G1_RETENTION_POLICY,
    schema: 'core-ui-evidence-index-v1',
    sourceRevision: context.sourceRevision,
    sourceTree: context.sourceTree,
    supersessions: [],
    validation,
  });
}

async function runInitialCommands(root) {
  return {
    profile: await exec('node', ['--test', 'tests/evidence/default-theme-g1.0-profile.test.mjs'], root),
    focused: await exec('node', targetTestArguments, root),
    schema: await exec('pnpm', ['--filter', '@core-ui/schema', 'check'], root),
    catalog: await exec('pnpm', ['--filter', '@core-ui/catalog', 'check'], root),
    tokens: await exec('pnpm', ['--filter', '@core-ui/tokens', 'check'], root),
    foundation: await exec('pnpm', ['--filter', '@core-ui/foundation', 'check'], root),
    tooling: await exec('pnpm', ['--filter', '@core-ui/tooling', 'check'], root),
    web: await exec('pnpm', ['--filter', '@core-ui/web', 'check'], root),
    react: await exec('pnpm', ['--filter', '@core-ui/react', 'check'], root),
    generation: await exec('pnpm', ['generate:check'], root),
    agent: await exec('pnpm', ['test:agent'], root),
    release: await exec('pnpm', ['release:prepare'], root),
  };
}

function assertFocusedNames(output) {
  const expected = Object.values(DEFAULT_THEME_G1_EXPECTED_TEST_NAMES).flat();
  for (const name of expected) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const matches = output.match(new RegExp(escaped, 'gu')) ?? [];
    if (matches.length !== 1) {
      throw new Error(`DEFAULT_THEME_G1_FOCUSED_ASSERTION_INVALID: ${name} observed ${matches.length}`);
    }
  }
}

async function assertCapturePreconditions(root, identities) {
  if (
    identities.sourceRevision !== DEFAULT_THEME_G1_PRODUCT_SOURCE.revision
    || identities.sourceTree !== DEFAULT_THEME_G1_PRODUCT_SOURCE.tree
  ) throw new Error('DEFAULT_THEME_G1_PRODUCT_SOURCE_INVALID');
  if (await git(root, 'rev-parse', 'HEAD') !== identities.executedRevision) {
    throw new Error('DEFAULT_THEME_G1_EXECUTED_REVISION_INVALID');
  }
  if (
    await git(root, 'rev-parse', `${identities.executedRevision}^{tree}`) !== identities.executedTree
    || await git(root, 'rev-parse', `${identities.sourceRevision}^{tree}`) !== identities.sourceTree
  ) throw new Error('DEFAULT_THEME_G1_GIT_TREE_INVALID');
  const revisionLine = (await git(root, 'rev-list', '--parents', '-n', '1', identities.executedRevision))
    .split(' ');
  const changes = (await git(
    root,
    'diff-tree', '--no-commit-id', '--name-status', '-r', identities.executedRevision,
  )).split('\n').filter(Boolean);
  assertDefaultThemeG1ExecutionTopology({
    changes,
    parents: revisionLine.slice(1),
    revision: revisionLine[0],
    tree: identities.executedTree,
  });
  const status = await git(root, 'status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new Error(`DEFAULT_THEME_G1_WORKTREE_DRIFT: ${status}`);
  try {
    await access(join(root, DEFAULT_THEME_G1_ROOT));
    throw new Error('DEFAULT_THEME_G1_OUTPUT_EXISTS');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const executedCommitTime = await git(root, 'show', '-s', '--format=%cI', identities.executedRevision);
  assertTruthfulDefaultThemeG1Timestamp(identities.timestamp, executedCommitTime);
  const productEntries = manifestEntriesAtRevision(
    root,
    identities.sourceRevision,
    DEFAULT_THEME_G1_APPLICABILITY_PATHS,
  );
  const currentEntries = await manifestEntries(root, DEFAULT_THEME_G1_APPLICABILITY_PATHS);
  if (
    productEntries.length !== 192
    || Buffer.byteLength(canonicalJson(productEntries)) !== 26878
    || prefixedSha256(canonicalJson(productEntries)) !== DEFAULT_THEME_G1_APPLICABILITY_MANIFEST.sha256
    || canonicalJson(currentEntries) !== canonicalJson(productEntries)
  ) throw new Error('DEFAULT_THEME_G1_APPLICABILITY_DRIFT');
  for (const reference of [...DEFAULT_THEME_G1_PHASE_C_ROOTS, DEFAULT_THEME_G1_MAINTENANCE_CONTEXT]) {
    if (prefixedSha256(await readFile(join(root, reference.path))) !== reference.sha256) {
      throw new Error(`DEFAULT_THEME_G1_PHASE_C_BINDING_INVALID: ${reference.path}`);
    }
  }
}

async function captureAt(root, identities) {
  await assertCapturePreconditions(root, identities);
  const env = await environment(root);
  if (env.node !== 'v24.19.0') throw new Error(`DEFAULT_THEME_G1_RUNTIME_INVALID: ${env.node}`);
  const toolFiles = await proofToolReferences(root, identities.executedRevision);
  const profile = createDefaultThemeG1Profile({
    executedRevision: identities.executedRevision,
    executedTree: identities.executedTree,
    toolFiles,
  });
  await assertProductFacts(root);
  const initialCommands = await runInitialCommands(root);
  assertFocusedNames(`${initialCommands.profile.output}\n${initialCommands.focused.output}`);
  const captureProcedure = defaultThemeG1CaptureProcedure(identities);
  const context = {
    ...identities,
    captureProcedure,
    environment: env,
    profile,
    results: [],
  };
  await mkdir(join(root, DEFAULT_THEME_G1_ROOT), { recursive: true });
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
    !== canonicalJson(DEFAULT_THEME_G1_RESULT_KEYS)) {
    throw new Error('DEFAULT_THEME_G1_RESULT_SET_INVALID');
  }
  await writeEvidence(root, context);
  await assertDefaultThemeG1Root(root);
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

export async function compareDefaultThemeG1Trees(expectedRoot, actualRoot) {
  const expectedFiles = await listFiles(join(expectedRoot, DEFAULT_THEME_G1_ROOT));
  const actualFiles = await listFiles(join(actualRoot, DEFAULT_THEME_G1_ROOT));
  if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) {
    throw new Error('DEFAULT_THEME_G1_EVIDENCE_DRIFT: file set differs');
  }
  for (const path of expectedFiles) {
    const [expected, actual] = await Promise.all([
      readFile(join(expectedRoot, DEFAULT_THEME_G1_ROOT, path)),
      readFile(join(actualRoot, DEFAULT_THEME_G1_ROOT, path)),
    ]);
    if (!expected.equals(actual)) {
      throw new Error(`DEFAULT_THEME_G1_EVIDENCE_DRIFT: ${path}`);
    }
  }
}

async function withGeneratedOutput(identities, operation) {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-default-theme-g1-'));
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

export async function publishDefaultThemeG1Atomically({
  afterPublish = async () => {},
  destinationRoot,
  generatedRoot,
  renameOperation = rename,
}) {
  const transactionRoot = await mkdtemp(join(destinationRoot, 'tests/evidence/.default-theme-g1.transaction-'));
  const staged = join(transactionRoot, DEFAULT_THEME_G1_ROOT);
  const destination = join(destinationRoot, DEFAULT_THEME_G1_ROOT);
  let published = false;
  try {
    await mkdir(resolve(staged, '..'), { recursive: true });
    await cp(join(generatedRoot, DEFAULT_THEME_G1_ROOT), staged, { recursive: true });
    await compareDefaultThemeG1Trees(generatedRoot, transactionRoot);
    await renameOperation(staged, destination);
    published = true;
    await rm(transactionRoot, { recursive: true, force: true });
    await afterPublish();
  } catch (error) {
    const rollbackFailures = [];
    if (published) {
      try {
        await mkdir(resolve(staged, '..'), { recursive: true });
        await rename(destination, staged);
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
        `DEFAULT_THEME_G1_ROLLBACK_INTEGRITY: original=${error.message}; failures=${rollbackFailures.join(' | ') || 'none'}; residual=${residual}`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(transactionRoot, { recursive: true, force: true });
  }
}

async function publishGeneratedOutput(generatedRoot) {
  await publishDefaultThemeG1Atomically({
    afterPublish: async () => {
      await assertDefaultThemeG1Root(repositoryRoot);
      await exec('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], repositoryRoot);
    },
    destinationRoot: repositoryRoot,
    generatedRoot,
  });
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
  if (checkOnly) {
    if (process.argv.length !== 3) throw new Error('DEFAULT_THEME_G1_ARGUMENT_INVALID');
    const retained = (await readJson(repositoryRoot, `${DEFAULT_THEME_G1_ROOT}/index.json`)).value;
    const identities = {
      executedRevision: retained.executedRevision,
      executedTree: retained.executedTree,
      sourceRevision: retained.sourceRevision,
      sourceTree: retained.sourceTree,
      timestamp: retained.captureTimestamp,
    };
    await assertDefaultThemeG1Root(repositoryRoot);
    await withGeneratedOutput(identities, async (generatedRoot) => {
      await compareDefaultThemeG1Trees(repositoryRoot, generatedRoot);
    });
    console.log(`[G1.0] verified eight records at ${identities.sourceRevision} using ${identities.executedRevision}`);
  } else {
    const identities = parseDefaultThemeG1Arguments(process.argv.slice(2));
    if (await git(repositoryRoot, 'rev-parse', 'HEAD') !== identities.executedRevision) {
      throw new Error('DEFAULT_THEME_G1_EXECUTED_REVISION_INVALID');
    }
    if (await git(repositoryRoot, 'status', '--porcelain=v1', '--untracked-files=all')) {
      throw new Error('DEFAULT_THEME_G1_WORKTREE_DRIFT');
    }
    await withGeneratedOutput(identities, publishGeneratedOutput);
    console.log(`[G1.0] captured eight records at ${identities.sourceRevision} using ${identities.executedRevision}`);
  }
}
