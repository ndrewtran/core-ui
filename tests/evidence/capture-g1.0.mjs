import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  TokenContractError,
  compileNativeTheme,
  compileTokenGraph,
  compileTokenRequirementSet,
  compileWebTheme,
  validateThemeForRequirementSet,
} from '../../packages/tokens/src/index.mjs';
import { isIgnoredRepositoryEntry } from '../../tooling/audits/repository-policy/src/policy.mjs';

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

function observedCode(operation) {
  try {
    operation();
  } catch (error) {
    if (error instanceof TokenContractError) return error.code;
    throw error;
  }
  throw new Error('EVIDENCE_EXPECTED_TOKEN_DENIAL_MISSING');
}

const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const sourceTree = command('git', ['rev-parse', 'HEAD^{tree}']);
const captureTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
const captureProcedure = 'node tests/evidence/capture-g1.0.mjs';
const environment = {
  architecture: process.arch,
  git: command('git', ['--version']).replace(/^git version /u, ''),
  node: process.version,
  pnpm: command('pnpm', ['--version']),
  runnerImage: `local-macos-${command('sw_vers', ['-productVersion'])}`,
  runnerImageVersion: command('sw_vers', ['-buildVersion']),
  runnerOs: `macOS ${command('sw_vers', ['-productVersion'])}`,
};

const tokenSourcePath = 'catalog/tokens/button-minimum.json';
const componentPath = 'catalog/components/button/artifact.json';
const tokenSource = parseJsonStrict(await readFile(join(repositoryRoot, tokenSourcePath), 'utf8'));
const component = parseJsonStrict(await readFile(join(repositoryRoot, componentPath), 'utf8'));
const compiled = await compileCatalog({ repositoryRoot });
const componentArtifact = compiled.bundle.artifacts.find(({ id }) => id === component.id);
const packedDescriptor = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/catalog/generated/catalog-package.json'),
  'utf8',
));

const cycle = structuredClone(tokenSource);
cycle.tokens['semantic.test.a'] = {
  layer: 'semantic',
  type: 'color',
  unit: 'hex',
  meaning: 'Cycle A.',
  overridePolicy: 'fixed',
  alias: 'semantic.test.b',
  equivalence: 'semantic-equivalence',
};
cycle.tokens['semantic.test.b'] = {
  layer: 'semantic',
  type: 'color',
  unit: 'hex',
  meaning: 'Cycle B.',
  overridePolicy: 'fixed',
  alias: 'semantic.test.a',
  equivalence: 'semantic-equivalence',
};
const reverse = structuredClone(tokenSource);
delete reverse.tokens['reference.color.action-dark'].value;
reverse.tokens['reference.color.action-dark'].alias = 'semantic.action.background';
const incompatible = structuredClone(tokenSource);
incompatible.tokens['semantic.action.background'].unit = 'px';
const denialCodes = {
  aliasCycle: observedCode(() => compileTokenGraph(cycle)),
  incompatibleTypeOrUnit: observedCode(() => compileTokenGraph(incompatible)),
  reverseLayer: observedCode(() => compileTokenGraph(reverse)),
  unauthorizedOverride: observedCode(() => compileTokenGraph(tokenSource, {
    overrides: {
      'reference.color.action-dark': { type: 'color', unit: 'hex', value: '#000000' },
    },
  })),
};

const web = compileWebTheme(tokenSource);
const react = compileWebTheme(tokenSource);
const ios = compileNativeTheme(tokenSource, { profile: 'native.ios' });
const android = compileNativeTheme(tokenSource, { profile: 'native.android' });
if (
  web.css !== react.css
  || web.css.includes('--core-reference-')
  || Object.keys(ios.theme).some((id) => id.startsWith('reference.'))
  || Object.hasOwn(ios, 'css')
  || new Set([web, ios, android].map(({ provenance }) => provenance.digest)).size !== 1
) throw new Error('EVIDENCE_TRANSFORM_PROVENANCE_FAILED');

const requiredRecipe = {
  source: tokenSource.id,
  requirements: [
    { token: 'component.button.background', requirement: 'required' },
    { token: 'component.button.foreground', requirement: 'required' },
  ],
};
const missingByProfile = Object.fromEntries([
  'web.html',
  'web.react',
  'native.ios',
  'native.android',
].map((profile) => {
  const requirementSet = compileTokenRequirementSet({
    source: tokenSource,
    recipe: requiredRecipe,
    bindingId: 'button',
    profile,
  });
  return [profile, observedCode(() => validateThemeForRequirementSet({
    requirementSet,
    values: {},
  }))];
}));
const fallbackRecipe = structuredClone(requiredRecipe);
fallbackRecipe.requirements[0].fallback = {
  kind: 'value',
  profiles: ['web.html'],
  evidenceIds: ['E-G1.0-03'],
  type: 'color',
  unit: 'hex',
  value: '#000000',
};
const fallbackSet = compileTokenRequirementSet({
  source: tokenSource,
  recipe: fallbackRecipe,
  bindingId: 'web.html',
  profile: 'web.html',
});
const fallbackResult = validateThemeForRequirementSet({
  requirementSet: fallbackSet,
  values: { 'component.button.foreground': '#ffffff' },
});
if (fallbackResult.diagnostics[0]?.code !== 'CORE_TOKEN_FALLBACK_USED') {
  throw new Error('EVIDENCE_FALLBACK_DIAGNOSTIC_MISSING');
}

const baseSet = compileTokenRequirementSet({
  source: tokenSource,
  recipe: requiredRecipe,
  bindingId: 'web.html',
  profile: 'web.html',
});
const unrelatedSource = structuredClone(tokenSource);
unrelatedSource.tokens['semantic.unrelated.value'] = {
  layer: 'semantic',
  type: 'string',
  unit: 'string',
  meaning: 'Unrelated value.',
  overridePolicy: 'theme',
  value: 'unrelated',
};
const unrelatedSet = compileTokenRequirementSet({
  source: unrelatedSource,
  recipe: requiredRecipe,
  bindingId: 'web.html',
  profile: 'web.html',
});
const dependencySource = structuredClone(tokenSource);
dependencySource.tokens['reference.color.action-dark'].value = '#000001';
const dependencySet = compileTokenRequirementSet({
  source: dependencySource,
  recipe: requiredRecipe,
  bindingId: 'web.html',
  profile: 'web.html',
});
const packedMatches = Object.entries(componentArtifact.tokenRequirementSets).map(([key, set]) => ({
  key,
  digest: set.digest,
  packedDigest: packedDescriptor.tokenRequirementSets[`${component.id}#${key}`],
  matched: set.digest === packedDescriptor.tokenRequirementSets[`${component.id}#${key}`],
}));
if (
  baseSet.digest !== unrelatedSet.digest
  || baseSet.sourceRevision === unrelatedSet.sourceRevision
  || baseSet.digest === dependencySet.digest
  || packedMatches.some(({ matched }) => !matched)
) throw new Error('EVIDENCE_REQUIREMENT_SET_CLOSURE_FAILED');

const foundationManifest = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/foundation/package.json'),
  'utf8',
));
const semanticSource = await readFile(
  join(repositoryRoot, 'packages/foundation/src/semantic/index.mjs'),
  'utf8',
);
const logicSource = await readFile(
  join(repositoryRoot, 'packages/foundation/src/logic/index.mjs'),
  'utf8',
);
const forbiddenFoundationInputs = [
  'document', 'window', 'navigator', 'react', 'selector', 'UIView', 'android.view',
];
if (
  canonicalJson(Object.keys(foundationManifest.exports).sort())
    !== canonicalJson(['./logic', './semantic'])
  || semanticSource.includes('../logic')
  || !logicSource.includes('../semantic/index.mjs')
  || forbiddenFoundationInputs.some((value) => (
    semanticSource.includes(value) || logicSource.includes(value)
  ))
) throw new Error('EVIDENCE_FOUNDATION_BOUNDARY_FAILED');

const staticModes = {
  defaultWeb: web.modes,
  darkWeb: compileWebTheme(tokenSource, { modes: { colorScheme: 'dark' } }).modes,
  reducedNative: compileNativeTheme(tokenSource, {
    profile: 'native.ios',
    modes: { motion: 'reduced' },
  }).modes,
};
if (
  tokenSource.theme.runtimeSwitching !== 'unavailable'
  || [web, ios, android].some(({ runtimeSwitching }) => runtimeSwitching !== false)
) throw new Error('EVIDENCE_STATIC_THEME_BOUNDARY_FAILED');

const paths = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/tooling',
  'packages/tokens',
  'packages/foundation',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  'tests/fixtures/g1.0',
  'tests/evidence/capture-g1.0.mjs',
  'tests/evidence/g1.0/README.md',
];
const manifest = await applicabilityManifest(paths);
const packageIdentities = await Promise.all([
  'packages/schema/package.json',
  'packages/catalog/package.json',
  'packages/tooling/package.json',
  'packages/tokens/package.json',
  'packages/foundation/package.json',
].map(async (path) => {
  const packageManifest = parseJsonStrict(await readFile(join(repositoryRoot, path), 'utf8'));
  return {
    name: packageManifest.name,
    path,
    private: packageManifest.private,
    version: packageManifest.version,
  };
}));
if (packageIdentities.some(({ private: isPrivate, version }) => !isPrivate || version !== '0.0.0')) {
  throw new Error('EVIDENCE_PACKAGE_BOUNDARY_FAILED');
}

const applicableIdentities = {
  catalog: {
    catalogDigest: compiled.bundle.catalogDigest,
    catalogVersion: compiled.bundle.catalogVersion,
    sourceRevision: compiled.bundle.sourceRevision,
  },
  component: {
    id: componentArtifact.id,
    contentRevision: componentArtifact.contentRevision,
    bindingSpecRevisions: componentArtifact.bindingSpecRevisions,
  },
  packages: packageIdentities,
  tokenSource: {
    id: tokenSource.id,
    contentRevision: canonicalDigest(tokenSource),
    schemaVersion: tokenSource.schemaVersion,
    tokenContractVersion: tokenSource.tokenContractVersion,
  },
  tokenRequirementSets: Object.fromEntries(Object.entries(
    componentArtifact.tokenRequirementSets,
  ).map(([key, set]) => [key, set.digest])),
};
const rollbackOrDisable = {
  actions: [
    'Revert the exact G1.0 implementation and retained-evidence commits.',
    'Remove the private @core-ui/tokens and @core-ui/foundation package surfaces.',
    'Retain failed or superseded evidence as append-only diagnostic history.',
  ],
  packagePublication: 'prohibited',
  projectStatus: 'not-ready',
};
const applicability = {
  applicabilityManifest: manifest,
  catalog: applicableIdentities.catalog,
  tokenSource: applicableIdentities.tokenSource,
};
const definitions = [
  ['E-G1.0-01', 'token-schema-and-graph-denial-corpus', { denialCodes }],
  ['E-G1.0-02', 'cross-target-transform-provenance-audit', {
    canonicalSourceDigest: web.provenance.digest,
    nativeContainsCss: false,
    publicReferenceTokenCount: 0,
    transforms: [web, ios, android].map(({ kind, sourceId, sourceRevision: revision }) => ({
      kind,
      sourceId,
      sourceRevision: revision,
    })),
    webAndReactCssMatched: true,
  }],
  ['E-G1.0-03', 'profile-exact-fallback-denial-fixture', {
    fallbackDiagnostic: fallbackResult.diagnostics[0],
    missingByProfile,
  }],
  ['E-G1.0-04', 'requirement-set-digest-closure-fixture', {
    dependencyChangeDigest: dependencySet.digest,
    exactClosureDigest: baseSet.digest,
    packedMatches,
    unrelatedChangeDigest: unrelatedSet.digest,
    unrelatedSourceRevisionChanged: true,
  }],
  ['E-G1.0-05', 'foundation-import-boundary-and-portability-matrix', {
    exports: Object.keys(foundationManifest.exports).sort(),
    forbiddenInputs: forbiddenFoundationInputs,
    interactionAvailability: 'unproved-absent',
    logicImportsSemantic: true,
    semanticImportsLogic: false,
    sourceDigests: {
      logic: sha256(logicSource),
      semantic: sha256(semanticSource),
    },
  }],
  ['E-G1.0-06', 'static-web-native-theme-smoke-fixtures', {
    runtimeSwitching: 'unavailable',
    staticModes,
    transforms: [web, ios, android].map(({ kind, runtimeSwitching, sourceRevision: revision }) => ({
      kind,
      runtimeSwitching,
      sourceRevision: revision,
    })),
  }],
];

const root = join(repositoryRoot, 'tests/evidence/g1.0');
await mkdir(join(root, 'artifacts'), { recursive: true });
await mkdir(join(root, 'records'), { recursive: true });
await mkdir(join(root, 'recertifications'), { recursive: true });
await mkdir(join(root, 'validation'), { recursive: true });

const recertificationTargets = [
  { milestone: 'G0.1', directory: 'g0.1', predecessor: 'tests/evidence/g0.5/recertifications/G0.1.json' },
  { milestone: 'G0.2', directory: 'g0.2', predecessor: 'tests/evidence/g0.5/recertifications/G0.2.json' },
  { milestone: 'G0.3', directory: 'g0.3', predecessor: 'tests/evidence/g0.5/recertifications/G0.3.json' },
  { milestone: 'G0.4', directory: 'g0.4', predecessor: 'tests/evidence/g0.5/recertifications/G0.4.json' },
  { milestone: 'G0.5', directory: 'g0.5' },
  { milestone: 'Gate 0', directory: 'gate-0' },
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
    const recertificationPath = `tests/evidence/g1.0/recertifications/${target.directory}.json`;
    await writeCanonical(join(repositoryRoot, recertificationPath), {
      captureTimestamp,
      currentApplicabilityManifest: await applicabilityManifest(
        historicalIndex.applicabilityManifest.paths,
      ),
      disclosureClass: 'public-sanitized',
      historicalApplicabilityManifest: previous?.currentApplicabilityManifest
        ?? historicalIndex.applicabilityManifest,
      historicalIndex: {
        path: historicalPath,
        sha256: sha256(historicalBytes),
      },
      milestone: target.milestone,
      outcome: 'pass',
      ...(previousBytes === null ? {} : {
        previousRecertification: {
          path: target.predecessor,
          sha256: sha256(previousBytes),
        },
      }),
      reason: 'Append-only linear recertification against the current worktree; prior evidence and certificates remain unchanged.',
      retentionPolicy: 'Retained with the G1.0 milestone pull request and default-branch history after merge.',
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
        path: `tests/evidence/g1.0/artifacts/${assertionId}.json`,
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
      expiry: 'Any enforced applicability-manifest mismatch or change to token identity, layer, type, unit, meaning, modes, override policy, binding recipe, fallback evidence, requirement closure, transform policy, foundation boundary, runtime-switching state, or retained result bytes',
      milestone: 'G1.0',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: 'Content-addressed Git object retained by the milestone pull request and default-branch history after merge; issue #9 is a mutable locator',
      rollbackOrDisable,
      schema: 'core-ui-evidence-record-v1',
      sourceRevision,
      sourceTree,
      ...(validation === null ? {} : { validation }),
    });
    records.push({
      assertionId,
      path: `tests/evidence/g1.0/records/${assertionId}.json`,
      sha256: sha256(await readFile(recordPath)),
    });
  }
  await writeCanonical(join(root, 'index.json'), {
    applicabilityManifest: manifest,
    captureTimestamp,
    disclosureClass: 'public-sanitized',
    milestone: 'G1.0',
    owner: 'ndrewtran',
    recertifications,
    records,
    retentionPolicy: 'Content-addressed Git records retained by the milestone pull request and default-branch history after merge; issue #9 is a mutable locator',
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
  const outputPath = `tests/evidence/g1.0/validation/${commandName
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

const evidenceCount = /(8 immutable index, 36 records, 36 artifacts, and 10 recertifications)/u;
const validationResults = [
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
  path: 'tests/evidence/g1.0/verification.json',
  sha256: sha256(await readFile(verificationPath)),
};
await writeEvidence(validation);

console.log(`[evidence] captured G1.0 and extended six historical evidence chains at ${sourceRevision}`);
