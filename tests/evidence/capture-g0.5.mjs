import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCatalogApi } from '../../packages/catalog/src/index.mjs';
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import {
  authoringMetadataDigest,
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
  validateAuthoringMetadata,
} from '../../packages/schema/src/index.mjs';
import {
  AuthoringPolicyError,
  affectedClosure,
  diagnoseCanonicalSource,
  explainRevisions,
  loadRepositoryAuthoringContext,
  previewAutofix,
  scaffoldComponent,
  semanticDiff,
} from '../../packages/tooling/src/authoring.mjs';
import {
  isIgnoredRepositoryEntry,
} from '../../tooling/audits/repository-policy/src/policy.mjs';

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
        if (isIgnoredRepositoryEntry(child)) continue;
        await visit(join(relativePath, child));
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

function applyCase(record, change) {
  const result = structuredClone(record);
  const segments = change.path.slice(2).split('/').map((segment) => (
    segment.replaceAll('~1', '/').replaceAll('~0', '~')
  ));
  const final = segments.pop();
  const parent = segments.reduce((value, segment) => value[segment], result);
  if (change.operation === 'add' && Array.isArray(parent)) {
    parent.splice(Number(final), 0, change.value);
  } else {
    parent[final] = change.value;
  }
  return result;
}

const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const sourceTree = command('git', ['rev-parse', 'HEAD^{tree}']);
const captureTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
const captureProcedure = 'node tests/evidence/capture-g0.5.mjs';
const environment = {
  architecture: process.arch,
  git: command('git', ['--version']).replace(/^git version /u, ''),
  node: process.version,
  pnpm: command('pnpm', ['--version']),
  runnerImage: `local-macos-${command('sw_vers', ['-productVersion'])}`,
  runnerImageVersion: command('sw_vers', ['-buildVersion']),
  runnerOs: `macOS ${command('sw_vers', ['-productVersion'])}`,
};
const corpus = parseJsonStrict(await readFile(
  join(repositoryRoot, 'tests/fixtures/g0.5/corpus.json'),
  'utf8',
));
const compiled = await compileCatalog({ repositoryRoot });
const context = await loadRepositoryAuthoringContext({
  repositoryRoot,
  expectedSourceRevision: compiled.bundle.sourceRevision,
});
const componentArtifact = compiled.bundle.artifacts.find(
  ({ id }) => id === 'core:component:button',
);
const sourcePath = componentArtifact.source.record;
const sourceBytesBefore = await readFile(join(repositoryRoot, sourcePath), 'utf8');
const { schemaVersion: _schemaVersion, id: _id, kind: _kind, ...decisions } =
  componentArtifact.record;
const scaffold = scaffoldComponent({ slug: 'button', recordPath: sourcePath, decisions });
const validDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: scaffold.record,
  recordPath: sourcePath,
});
const brokenRecord = structuredClone(scaffold.record);
delete brokenRecord.summary;
const brokenDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: brokenRecord,
  recordPath: sourcePath,
});
const repairedDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: scaffold.record,
  recordPath: sourcePath,
});
const retrieved = createCatalogApi(compiled.bundle).getArtifact({
  id: scaffold.record.id,
  detail: 'full',
});
const undeclaredDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: scaffold.record,
  recordPath: 'catalog/components/button/inferred.json',
});
let staleRevisionRule = null;
try {
  await loadRepositoryAuthoringContext({
    repositoryRoot,
    expectedSourceRevision: `sha256:${'0'.repeat(64)}`,
  });
} catch (error) {
  if (!(error instanceof AuthoringPolicyError)) throw error;
  staleRevisionRule = error.ruleId;
}
if (
  !validDiagnosis.valid
  || brokenDiagnosis.valid
  || !repairedDiagnosis.valid
  || retrieved.type !== 'artifact.detail'
  || retrieved.data.artifact.source.record !== sourcePath
  || undeclaredDiagnosis.valid
  || staleRevisionRule !== 'authoring.source.revision-stale'
  || await readFile(join(repositoryRoot, sourcePath), 'utf8') !== sourceBytesBefore
) {
  throw new Error('EVIDENCE_AUTHORING_ROUND_TRIP_FAILED');
}

const examples = compiled.bundle.artifacts
  .filter(({ kind }) => kind === 'example')
  .map(({ record }) => record);
const tokenSources = compiled.bundle.artifacts
  .filter(({ kind }) => kind === 'token')
  .map(({ record }) => record);
const exampleSources = {};
for (const artifact of compiled.bundle.artifacts.filter(({ kind }) => kind === 'example')) {
  exampleSources[artifact.id] = await readFile(
    join(repositoryRoot, artifact.source.content),
    'utf8',
  );
}
const revisionContext = { examples, tokenSources, exampleSources };
const semanticResults = corpus.semanticCases.map((change) => {
  const result = semanticDiff({
    before: componentArtifact.record,
    after: applyCase(componentArtifact.record, change),
    revisionContext,
  });
  if (
    result.changes.length !== 1
    || result.changes[0].effect !== change.effect
    || result.versionEffect !== change.versionEffect
    || result.revisions.bindings['web.react'].bindingSpecRevision.changed
      !== change.bindingSpecChanged
  ) throw new Error(`EVIDENCE_SEMANTIC_CASE_FAILED: ${change.id}`);
  return {
    id: change.id,
    path: result.changes[0].path,
    effect: result.changes[0].effect,
    versionEffect: result.versionEffect,
    owner: result.changes[0].owner,
    contentRevision: result.revisions.contentRevision,
    bindingSpecRevision: result.revisions.bindings['web.react'].bindingSpecRevision,
  };
});
const revisionExplanation = explainRevisions({
  family: 'component',
  record: componentArtifact.record,
  bindingId: 'web.react',
  ...revisionContext,
});
if (
  revisionExplanation.axes.find(({ name }) => name === 'contentRevision').digest
    !== componentArtifact.contentRevision
  || revisionExplanation.axes.find(({ name }) => name === 'bindingSpecRevision').digest
    !== componentArtifact.bindingSpecRevisions['web.react']
) throw new Error('EVIDENCE_REVISION_EXPLANATION_FAILED');

const whitespaceRecord = structuredClone(componentArtifact.record);
whitespaceRecord.summary = '  Triggers an immediate action.  ';
const allowedAutofix = previewAutofix({ record: whitespaceRecord, path: '$/summary' });
const deniedAutofixes = corpus.autofixDenied.map(({ category, path }) => {
  try {
    previewAutofix({ record: componentArtifact.record, path });
    return { category, path, rejected: false, ruleId: null };
  } catch (error) {
    if (!(error instanceof AuthoringPolicyError)) throw error;
    return { category, path, rejected: true, ruleId: error.ruleId };
  }
});
if (
  canonicalJson(allowedAutofix.changedPaths) !== canonicalJson(['$/summary'])
  || deniedAutofixes.some(({ rejected }) => !rejected)
) throw new Error('EVIDENCE_AUTOFIX_POLICY_FAILED');

const componentSchema = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/schema/schemas/component.schema.json'),
  'utf8',
));
const bindingSchema = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/schema/schemas/binding.schema.json'),
  'utf8',
));
const ownership = parseJsonStrict(await readFile(
  join(repositoryRoot, 'packages/schema/schemas/field-ownership.json'),
  'utf8',
));
componentSchema.required.push('newStableField');
componentSchema.properties.newStableField = { type: 'string', minLength: 1 };
let couplingFailure = null;
try {
  validateAuthoringMetadata({
    schemas: {
      'binding.schema.json': bindingSchema,
      'component.schema.json': componentSchema,
    },
    ownership,
  });
} catch (error) {
  couplingFailure = { code: error.code, message: error.message };
}
if (
  couplingFailure?.code !== 'CORE_SCHEMA_INVALID'
  || !couplingFailure.message.includes('missing x-core-ui-authoring metadata')
) throw new Error('EVIDENCE_SCHEMA_AUTHORING_COUPLING_FAILED');

const closure = affectedClosure({ context, sourcePaths: [sourcePath] });
const schemaClosure = affectedClosure({
  context,
  sourcePaths: ['packages/schema/schemas/component.schema.json'],
});
let undeclaredClosureRule = null;
try {
  affectedClosure({ context, sourcePaths: ['catalog/components/inferred.json'] });
} catch (error) {
  if (!(error instanceof AuthoringPolicyError)) throw error;
  undeclaredClosureRule = error.ruleId;
}
if (
  !closure.artifacts.includes('core:example:button-basic-react')
  || !closure.artifacts.includes('core:token:button-minimum')
  || !closure.projections.includes('packages/catalog/generated/catalog.json')
  || !schemaClosure.projections.includes('packages/schema/generated/types.d.ts')
  || undeclaredClosureRule !== 'authoring.closure.source-undeclared'
) throw new Error('EVIDENCE_AFFECTED_CLOSURE_FAILED');

const paths = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/tooling',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.5',
  'tests/evidence/capture-g0.4.mjs',
  'tests/evidence/capture-g0.5.mjs',
  'tests/evidence/g0.5/README.md',
];
const manifest = await applicabilityManifest(paths);
const applicability = {
  applicabilityManifest: manifest,
  authoringMetadata: {
    declarationCount: validateAuthoringMetadata().length,
    digest: authoringMetadataDigest(),
  },
  catalog: {
    catalogDigest: compiled.bundle.catalogDigest,
    catalogVersion: compiled.bundle.catalogVersion,
    sourceRevision: compiled.bundle.sourceRevision,
  },
  fixtureCorpus: {
    autofixDeniedCount: corpus.autofixDenied.length,
    digest: canonicalDigest(corpus),
    semanticCaseCount: corpus.semanticCases.length,
  },
};
const definitions = [
  [
    'E-G0.5-01',
    'authoring-round-trip-transcript',
    {
      steps: [
        { action: 'scaffold-preview', mode: scaffold.mode, path: scaffold.recordPath },
        { action: 'validate', valid: validDiagnosis.valid },
        { action: 'compile', catalogDigest: compiled.bundle.catalogDigest },
        { action: 'retrieve', type: retrieved.type, id: retrieved.data.artifact.id },
        {
          action: 'break-and-diagnose',
          ruleId: brokenDiagnosis.diagnostics[0].ruleId,
          source: brokenDiagnosis.diagnostics[0].details.source,
          owner: brokenDiagnosis.diagnostics[0].details.owner,
        },
        { action: 'repair', valid: repairedDiagnosis.valid },
      ],
      sourceBytesChanged: false,
      projectionEdits: [],
      undeclaredSourceRule: undeclaredDiagnosis.diagnostics[0].ruleId,
      staleRevisionRule,
    },
  ],
  [
    'E-G0.5-02',
    'semantic-change-and-revision-golden-corpus',
    {
      semanticResults,
      revisionAxes: revisionExplanation.axes.map(({ name, digest, normalizedInputs }) => ({
        name,
        digest,
        normalizedInputCount: normalizedInputs.length,
        normalizedInputDigest: canonicalDigest(normalizedInputs),
      })),
    },
  ],
  [
    'E-G0.5-03',
    'negative-autofix-policy',
    {
      allowed: {
        changedPaths: allowedAutofix.changedPaths,
        mode: allowedAutofix.mode,
        sourceRecordChanged: false,
      },
      denied: deniedAutofixes,
      automaticMutationAttempted: false,
    },
  ],
  [
    'E-G0.5-04',
    'schema-authoring-coupling-and-affected-closure',
    {
      couplingFailure,
      closure,
      schemaClosure,
      undeclaredClosureRule,
      secondRegistryIntroduced: false,
    },
  ],
];

const root = join(repositoryRoot, 'tests/evidence/g0.5');
await mkdir(join(root, 'artifacts'), { recursive: true });
await mkdir(join(root, 'records'), { recursive: true });

async function writeEvidence(validation = null) {
  const records = [];
  for (const [assertionId, evidenceKind, observations] of definitions) {
    const artifactPath = join(root, `artifacts/${assertionId}.json`);
    await writeCanonical(artifactPath, {
      applicability,
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
        path: `tests/evidence/g0.5/artifacts/${assertionId}.json`,
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
      expiry: 'Any enforced applicability-manifest mismatch or change to schema authoring metadata, revision preimages, source manifest, catalog identity, affected graph, autofix policy, runtime tuple, or retained result bytes',
      milestone: 'G0.5',
      outcome: 'pass',
      owner: 'ndrewtran',
      retentionPolicy: 'Content-addressed Git object retained by the milestone pull request and default-branch history after merge; issue #7 and its Evidence issues are mutable locators',
      schema: 'core-ui-evidence-record-v1',
      sourceRevision,
      sourceTree,
      ...(validation === null ? {} : { validation }),
    });
    records.push({
      assertionId,
      path: `tests/evidence/g0.5/records/${assertionId}.json`,
      sha256: sha256(await readFile(recordPath)),
    });
  }
  await writeCanonical(join(root, 'index.json'), {
    applicabilityManifest: manifest,
    captureTimestamp,
    disclosureClass: 'public-sanitized',
    milestone: 'G0.5',
    owner: 'ndrewtran',
    records,
    retentionPolicy: 'Content-addressed Git records retained by the milestone pull request and default-branch history after merge; issue #7 and its Evidence issues are mutable locators',
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    ...(validation === null ? {} : { validation }),
  });
}

await writeEvidence();
command(process.execPath, ['tests/evidence/capture-g0.4.mjs']);

function validationResult(commandName, args, assertions) {
  const output = execFileSync('pnpm', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const observedAssertions = assertions.map(({ id, pattern }) => {
    const match = output.match(pattern);
    if (!match) throw new Error(`EVIDENCE_VALIDATION_ASSERTION_MISSING: ${id}`);
    return { id, value: match[1] ?? true };
  });
  return { command: commandName, exitState: 0, observedAssertions };
}

const validationResults = [
  validationResult('pnpm check', ['check'], [
    { id: 'evidence-index-count', pattern: /\[evidence\] verified (6 immutable index, 29 records, and 29 artifacts)/u },
  ]),
  validationResult('pnpm check:all', ['check:all'], [
    { id: 'evidence-index-count', pattern: /\[evidence\] verified (6 immutable index, 29 records, and 29 artifacts)/u },
  ]),
  validationResult('pnpm generate:check', ['generate:check'], [
    { id: 'generation-identity', pattern: /remained clean after two generation runs \((sha256:[a-f0-9]{64})\)/u },
  ]),
  validationResult('pnpm release:prepare', ['release:prepare'], [
    { id: 'release-boundary', pattern: /(Foundation checks passed; no publishable package or public release candidate exists\.)/u },
    { id: 'generation-identity', pattern: /remained clean after two generation runs \((sha256:[a-f0-9]{64})\)/u },
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
  path: 'tests/evidence/g0.5/verification.json',
  sha256: sha256(await readFile(verificationPath)),
};
await writeEvidence(validation);

console.log(`[evidence] captured G0.5 and refreshed upstream applicability at ${sourceRevision}`);
