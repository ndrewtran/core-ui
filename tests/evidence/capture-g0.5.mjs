import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCatalogApi } from '../../packages/catalog/src/index.mjs';
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import {
  authoringMetadataDigest,
  bindingContentRevision,
  bindingSpecRevision,
  bindingSpecRevisionPreimage,
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
  resolveAuthoringField,
  validateAuthoringMetadata,
} from '../../packages/schema/src/index.mjs';
import {
  loadFamilySchema,
} from '../../packages/schema/src/contracts.mjs';
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

async function temporaryCatalogRepository() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'core-ui-g0-5-'));
  await Promise.all([
    mkdir(join(temporaryRoot, 'packages/tooling'), { recursive: true }),
    mkdir(join(temporaryRoot, 'packages/schema/schemas'), { recursive: true }),
    mkdir(join(temporaryRoot, 'tooling/audits/repository-policy'), { recursive: true }),
  ]);
  await Promise.all([
    cp(join(repositoryRoot, 'catalog'), join(temporaryRoot, 'catalog'), { recursive: true }),
    cp(
      join(repositoryRoot, 'packages/catalog'),
      join(temporaryRoot, 'packages/catalog'),
      { recursive: true },
    ),
    cp(
      join(repositoryRoot, 'packages/tooling/command-registry.json'),
      join(temporaryRoot, 'packages/tooling/command-registry.json'),
    ),
    cp(
      join(repositoryRoot, 'packages/schema/schemas/type-projection.json'),
      join(temporaryRoot, 'packages/schema/schemas/type-projection.json'),
    ),
    cp(
      join(repositoryRoot, 'tooling/audits/repository-policy/repository-policy.json'),
      join(temporaryRoot, 'tooling/audits/repository-policy/repository-policy.json'),
    ),
  ]);
  return temporaryRoot;
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
let compiledFromScaffold;
let retrieved;
let bundleDriftRule = null;
const temporaryRoot = await temporaryCatalogRepository();
try {
  await writeFile(join(temporaryRoot, sourcePath), scaffold.writeSet[0].bytes);
  compiledFromScaffold = await compileCatalog({ repositoryRoot: temporaryRoot });
  retrieved = createCatalogApi(compiledFromScaffold.bundle).getArtifact({
    id: scaffold.record.id,
    detail: 'full',
  });
  const driftedRecord = structuredClone(scaffold.record);
  driftedRecord.summary = `${driftedRecord.summary} Drift`;
  await writeFile(join(temporaryRoot, sourcePath), `${canonicalJson(driftedRecord)}\n`);
  try {
    await loadRepositoryAuthoringContext({
      repositoryRoot: temporaryRoot,
      expectedSourceRevision: compiled.bundle.sourceRevision,
    });
  } catch (error) {
    if (!(error instanceof AuthoringPolicyError)) throw error;
    bundleDriftRule = error.ruleId;
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
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
  || canonicalJson(Object.fromEntries(
    Object.keys(scaffold.record).map((key) => [key, retrieved.data.artifact[key]]),
  )) !== canonicalJson(scaffold.record)
  || undeclaredDiagnosis.valid
  || staleRevisionRule !== 'authoring.source.revision-stale'
  || bundleDriftRule !== 'authoring.source.bundle-drift'
  || brokenDiagnosis.diagnostics[0].details.source.path !== '$/summary'
  || brokenDiagnosis.diagnostics[0].details.owner.schemaPointer !== '#/properties/summary'
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

function firstProperty(pointer) {
  const match = /^#\/properties\/([^/]+)/u.exec(pointer);
  return match?.[1].replaceAll('~1', '/').replaceAll('~0', '~') ?? null;
}

function finalProperty(pointer) {
  const match = /\/properties\/([^/]+)$/u.exec(pointer);
  return match?.[1].replaceAll('~1', '/').replaceAll('~0', '~') ?? null;
}

const referencePreimage = bindingSpecRevisionPreimage({
  component: componentArtifact.record,
  bindingId: 'web.react',
  tokenSources,
});
const componentSpecFields = new Set(Object.keys(referencePreimage.component));
const bindingSpecFields = new Set(Object.keys(referencePreimage.binding));
const revisionAxisDeclarations = validateAuthoringMetadata().map((declaration) => {
  let expected;
  if (declaration.schema === 'component.schema.json') {
    const field = firstProperty(declaration.schemaPointer);
    expected = [
      'content',
      ...(componentSpecFields.has(field) || field === 'bindings' ? ['binding-spec'] : []),
    ];
  } else {
    const rootField = firstProperty(declaration.schemaPointer);
    const definitionField = declaration.schemaPointer.startsWith('#/$defs/runtimeProfile/')
      ? finalProperty(declaration.schemaPointer)
      : null;
    const inBindingSpec = bindingSpecFields.has(rootField)
      || definitionField !== null
      || bindingSpecFields.has(finalProperty(declaration.schemaPointer));
    expected = ['binding-content', ...(inBindingSpec ? ['binding-spec'] : [])];
  }
  const matched = canonicalJson(declaration.revisionAxes) === canonicalJson(expected);
  return {
    declared: declaration.revisionAxes,
    expected,
    matched,
    schema: declaration.schema,
    schemaPointer: declaration.schemaPointer,
  };
});
if (revisionAxisDeclarations.some(({ matched }) => !matched)) {
  throw new Error('EVIDENCE_REVISION_AXIS_DECLARATION_MISMATCH');
}

const observedRevisionCases = [];
const digest = (record, bindingId) => bindingSpecRevision({
  component: record,
  bindingId,
  tokenSources,
});
const renamedComponent = structuredClone(componentArtifact.record);
renamedComponent.id = 'core:component:button-renamed';
observedRevisionCases.push({
  id: 'component-id-binding-spec',
  axes: resolveAuthoringField('component', '$/id').revisionAxes,
  changed: digest(componentArtifact.record, 'web.react')
    !== digest(renamedComponent, 'web.react'),
});
const revisedRuntimeReason = structuredClone(componentArtifact.record);
revisedRuntimeReason.bindings['native.react-native']
  .runtimeProfiles['native.react-native-web'].reason += ' Reassessed.';
observedRevisionCases.push({
  id: 'runtime-profile-reason-binding-spec',
  axes: resolveAuthoringField(
    'component',
    '$/bindings/native.react-native/runtimeProfiles/native.react-native-web/reason',
  ).revisionAxes,
  changed: digest(componentArtifact.record, 'native.react-native')
    !== digest(revisedRuntimeReason, 'native.react-native'),
});
const addedRuntimeAlternative = structuredClone(componentArtifact.record);
addedRuntimeAlternative.bindings['native.react-native']
  .runtimeProfiles['native.react-native-web'].alternative = componentArtifact.id;
observedRevisionCases.push({
  id: 'runtime-profile-alternative-binding-spec',
  axes: resolveAuthoringField(
    'component',
    '$/bindings/native.react-native/runtimeProfiles/native.react-native-web/alternative',
  ).revisionAxes,
  changed: digest(componentArtifact.record, 'native.react-native')
    !== digest(addedRuntimeAlternative, 'native.react-native'),
});
const editorialBinding = structuredClone(componentArtifact.record.bindings['web.react']);
editorialBinding.editorialNotes = ['Clarified implementation note.'];
const editorialComponent = structuredClone(componentArtifact.record);
editorialComponent.bindings['web.react'] = editorialBinding;
observedRevisionCases.push({
  id: 'binding-editorial-content-only',
  axes: resolveAuthoringField(
    'component',
    '$/bindings/web.react/editorialNotes',
  ).revisionAxes,
  bindingContentChanged: bindingContentRevision(
    componentArtifact.record.bindings['web.react'],
  ) !== bindingContentRevision(editorialBinding),
  bindingSpecChanged: digest(componentArtifact.record, 'web.react')
    !== digest(editorialComponent, 'web.react'),
});
if (
  observedRevisionCases.slice(0, 3).some(({ changed }) => !changed)
  || !observedRevisionCases[3].bindingContentChanged
  || observedRevisionCases[3].bindingSpecChanged
) throw new Error('EVIDENCE_REVISION_AXIS_OBSERVATION_FAILED');

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

const emptyConcept = structuredClone(componentArtifact.record);
emptyConcept.extensions = {};
const emptyBinding = structuredClone(componentArtifact.record.bindings['web.react']);
emptyBinding.editorialNotes = [];
const emptySpec = structuredClone(componentArtifact.record);
emptySpec.bindings['web.react'].api.defaults.emptyContract = {};
const emptyContainerCases = [
  {
    axis: 'contentRevision',
    path: '$/extensions',
    before: explainRevisions({
      family: 'component',
      record: componentArtifact.record,
    }).axes.find(({ name }) => name === 'contentRevision'),
    after: explainRevisions({
      family: 'component',
      record: emptyConcept,
    }).axes.find(({ name }) => name === 'contentRevision'),
  },
  {
    axis: 'bindingContentRevision',
    path: '$/editorialNotes',
    before: explainRevisions({
      family: 'binding',
      record: componentArtifact.record.bindings['web.react'],
    }).axes.find(({ name }) => name === 'bindingContentRevision'),
    after: explainRevisions({
      family: 'binding',
      record: emptyBinding,
    }).axes.find(({ name }) => name === 'bindingContentRevision'),
  },
  {
    axis: 'bindingSpecRevision',
    path: '$/binding/api/defaults/emptyContract',
    before: revisionExplanation.axes.find(({ name }) => name === 'bindingSpecRevision'),
    after: explainRevisions({
      family: 'component',
      record: emptySpec,
      bindingId: 'web.react',
      ...revisionContext,
    }).axes.find(({ name }) => name === 'bindingSpecRevision'),
  },
];
const emptyContainerResults = emptyContainerCases.map(({ axis, path, before, after }) => {
  const beforeRow = before.normalizedInputs.find((row) => row.path === path);
  const afterRow = after.normalizedInputs.find((row) => row.path === path);
  if (before.digest === after.digest || beforeRow !== undefined || afterRow === undefined) {
    throw new Error(`EVIDENCE_EMPTY_CONTAINER_EXPLANATION_FAILED: ${axis}`);
  }
  return {
    afterDigest: after.digest,
    afterValue: afterRow.value,
    axis,
    beforeDigest: before.digest,
    path,
  };
});

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

componentSchema.properties.newStableField['x-core-ui-authoring'] = {
  effect: 'incompatible',
  revisionAxes: ['content'],
};
ownership.fields.push({
  class: 'authored',
  name: 'newStableField',
  owner: 'component-contract',
  schema: 'component.schema.json',
  schemaPointer: '#/properties/newStableField',
});
const injectedAuthoring = {
  schemas: {
    'binding.schema.json': bindingSchema,
    'component.schema.json': componentSchema,
  },
  ownership,
};
const injectedDecisions = structuredClone(decisions);
injectedDecisions.newStableField = 'baseline';
const injectedScaffold = scaffoldComponent({
  slug: 'button',
  recordPath: sourcePath,
  decisions: injectedDecisions,
  authoring: injectedAuthoring,
});
const injectedAfter = structuredClone(injectedScaffold.record);
injectedAfter.newStableField = 'changed';
const injectedDiff = semanticDiff({
  before: injectedScaffold.record,
  after: injectedAfter,
  revisionContext,
  authoring: injectedAuthoring,
});
const injectedInvalid = structuredClone(injectedScaffold.record);
injectedInvalid.newStableField = '';
const injectedDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: injectedInvalid,
  recordPath: sourcePath,
  authoring: injectedAuthoring,
});
const injectedClosure = affectedClosure({
  context,
  sourcePaths: ['packages/schema/schemas/component.schema.json'],
  authoring: injectedAuthoring,
});
const couplingSurfaces = {
  scaffold: injectedScaffold.record.newStableField === 'baseline',
  semanticDiff: injectedDiff.changes.some(({ path, owner }) => (
    path === '$/newStableField' && owner.name === 'component-contract'
  )),
  diagnostics: injectedDiagnosis.diagnostics.some(({ details }) => (
    details.source.path === '$/newStableField'
    && details.owner.name === 'component-contract'
  )),
  affectedClosure: injectedClosure.artifacts.includes(componentArtifact.id)
    && injectedClosure.canonicalSources.includes(sourcePath),
};
if (!Object.values(couplingSurfaces).every(Boolean)) {
  throw new Error('EVIDENCE_SCHEMA_AUTHORING_SURFACE_COUPLING_FAILED');
}

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
  || !schemaClosure.artifacts.includes(componentArtifact.id)
  || !schemaClosure.canonicalSources.includes(sourcePath)
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
  'tests/evidence/capture-g0.5.mjs',
  'tests/evidence/g0.5/README.md',
];
const manifest = await applicabilityManifest(paths);
const packageIdentities = await Promise.all([
  'packages/schema/package.json',
  'packages/catalog/package.json',
  'packages/tooling/package.json',
].map(async (path) => {
  const packageManifest = parseJsonStrict(await readFile(join(repositoryRoot, path), 'utf8'));
  return {
    name: packageManifest.name,
    path,
    private: packageManifest.private,
    version: packageManifest.version,
  };
}));
const fixturePath = 'tests/fixtures/g0.5/corpus.json';
const applicableIdentities = {
  artifact: {
    contentRevision: componentArtifact.contentRevision,
    id: componentArtifact.id,
    source: componentArtifact.source,
  },
  authoringTool: {
    metadataDigest: authoringMetadataDigest(),
    package: '@core-ui/tooling',
    version: packageIdentities.find(({ name }) => name === '@core-ui/tooling').version,
  },
  bindings: Object.entries(componentArtifact.record.bindings)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([platform, bindingRecord]) => ({
      bindingContentRevision: componentArtifact.bindingContentRevisions[platform],
      bindingSpecRevision: componentArtifact.bindingSpecRevisions[platform],
      id: `${componentArtifact.id}#${platform}`,
      platform,
      runtimeProfiles: Object.entries(bindingRecord.runtimeProfiles ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, profile]) => ({
          id,
          strategy: profile.strategy,
          ...(profile.lifecycle === undefined ? {} : { lifecycle: profile.lifecycle }),
          ...(profile.validationProfile === undefined
            ? {}
            : { validationProfile: profile.validationProfile }),
        })),
    })),
  catalog: {
    catalogDigest: compiled.bundle.catalogDigest,
    catalogVersion: compiled.bundle.catalogVersion,
    sourceRevision: compiled.bundle.sourceRevision,
  },
  examples: compiled.bundle.artifacts
    .filter(({ kind }) => kind === 'example')
    .map((artifact) => ({
      contentRevision: artifact.contentRevision,
      id: artifact.id,
      source: artifact.source,
    })),
  fixtures: [{
    path: fixturePath,
    sha256: sha256(await readFile(join(repositoryRoot, fixturePath))),
  }],
  packages: packageIdentities,
  tokenSources: compiled.bundle.artifacts
    .filter(({ kind }) => kind === 'token')
    .map((artifact) => ({ contentRevision: artifact.contentRevision, id: artifact.id })),
};
const rollbackOrDisable = {
  actions: [
    'Revert the exact G0.5 implementation and retained-evidence commits.',
    'Remove the private authoring exports from @core-ui/schema and @core-ui/tooling.',
    'Retain failed or superseded evidence as append-only diagnostic history.',
  ],
  packagePublication: 'prohibited',
  projectStatus: 'not-ready',
};
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
        {
          action: 'compile-scaffolded-bytes',
          catalogDigest: compiledFromScaffold.bundle.catalogDigest,
          sourceRevision: compiledFromScaffold.bundle.sourceRevision,
        },
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
      bundleDriftRule,
    },
  ],
  [
    'E-G0.5-02',
    'semantic-change-and-revision-golden-corpus',
    {
      semanticResults,
      emptyContainerResults,
      revisionAxisCoverage: {
        declarationCount: revisionAxisDeclarations.length,
        declarationDigest: canonicalDigest(revisionAxisDeclarations),
        everyDeclarationMatched: true,
        observedCases: observedRevisionCases,
      },
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
      couplingSurfaces,
      closure,
      injectedClosure,
      schemaClosure,
      undeclaredClosureRule,
      canonicalFamilyFiles: ['binding', 'component'].map((family) => ({
        family,
        fileName: loadFamilySchema(family).fileName,
      })),
      secondRegistryIntroduced: false,
    },
  ],
];

const root = join(repositoryRoot, 'tests/evidence/g0.5');
await mkdir(join(root, 'artifacts'), { recursive: true });
await mkdir(join(root, 'records'), { recursive: true });
await mkdir(join(root, 'recertifications'), { recursive: true });
await mkdir(join(root, 'validation'), { recursive: true });

async function writeRecertifications(validation = null) {
  const references = [];
  for (const milestone of ['G0.1', 'G0.2', 'G0.3', 'G0.4']) {
    const historicalPath = `tests/evidence/${milestone.toLowerCase()}/index.json`;
    const historicalBytes = await readFile(join(repositoryRoot, historicalPath), 'utf8');
    const historicalIndex = parseJsonStrict(historicalBytes);
    const recertificationPath = `tests/evidence/g0.5/recertifications/${milestone}.json`;
    await writeCanonical(join(repositoryRoot, recertificationPath), {
      captureTimestamp,
      currentApplicabilityManifest: await applicabilityManifest(
        historicalIndex.applicabilityManifest.paths,
      ),
      disclosureClass: 'public-sanitized',
      historicalApplicabilityManifest: historicalIndex.applicabilityManifest,
      historicalIndex: {
        path: historicalPath,
        sha256: sha256(historicalBytes),
      },
      milestone,
      outcome: 'pass',
      reason: 'Append-only recertification against the current worktree; historical evidence bytes remain unchanged.',
      retentionPolicy: 'Retained with the G0.5 milestone pull request and default-branch history after merge.',
      rollbackOrDisable,
      schema: 'core-ui-evidence-recertification-v1',
      sourceRevision,
      sourceTree,
      ...(validation === null ? {} : { validation }),
    });
    references.push({
      milestone,
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
      rollbackOrDisable,
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
    recertifications,
    records,
    rollbackOrDisable,
    retentionPolicy: 'Content-addressed Git records retained by the milestone pull request and default-branch history after merge; issue #7 and its Evidence issues are mutable locators',
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
  const outputPath = `tests/evidence/g0.5/validation/${commandName
    .replaceAll(/[^a-z0-9]+/giu, '-')
    .replaceAll(/^-|-$/gu, '')}.txt`;
  await writeFile(join(repositoryRoot, outputPath), sanitizedOutput);
  return {
    command: commandName,
    exitState: 0,
    observedAssertions,
    rawOutput: {
      path: outputPath,
      sha256: sha256(sanitizedOutput),
    },
  };
}

const validationResults = [
  await validationResult('pnpm check', ['check'], [
    { id: 'evidence-index-count', pattern: /\[evidence\] verified (6 immutable index, 29 records, 29 artifacts, and 4 recertifications)/u },
  ]),
  await validationResult('pnpm check:all', ['check:all'], [
    { id: 'evidence-index-count', pattern: /\[evidence\] verified (6 immutable index, 29 records, 29 artifacts, and 4 recertifications)/u },
  ]),
  await validationResult('pnpm generate:check', ['generate:check'], [
    { id: 'generation-identity', pattern: /remained clean after two generation runs \((sha256:[a-f0-9]{64})\)/u },
  ]),
  await validationResult('pnpm release:prepare', ['release:prepare'], [
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

console.log(`[evidence] captured G0.5 and append-only recertified G0.1-G0.4 at ${sourceRevision}`);
