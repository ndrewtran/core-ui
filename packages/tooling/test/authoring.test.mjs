import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { createCatalogApi } from '@core-ui/catalog';
import { compileCatalog } from '@core-ui/catalog/compiler';
import { canonicalJson } from '@core-ui/schema';
import {
  AuthoringPolicyError,
  affectedClosure,
  diagnoseCanonicalSource,
  explainRevisions,
  loadRepositoryAuthoringContext,
  previewAutofix,
  scaffoldComponent,
  semanticDiff,
} from '../src/index.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

async function corpus() {
  return JSON.parse(await readFile(
    resolve(repositoryRoot, 'tests/fixtures/g0.5/corpus.json'),
    'utf8',
  ));
}

async function setup() {
  const compiled = await compileCatalog({ repositoryRoot });
  const context = await loadRepositoryAuthoringContext({
    repositoryRoot,
    expectedSourceRevision: compiled.bundle.sourceRevision,
  });
  const component = compiled.bundle.artifacts.find(
    ({ id }) => id === 'core:component:button',
  );
  const examples = compiled.bundle.artifacts
    .filter(({ kind }) => kind === 'example')
    .map(({ record }) => record);
  const tokenSources = compiled.bundle.artifacts
    .filter(({ kind }) => kind === 'token')
    .map(({ record }) => record);
  const exampleSources = {};
  for (const artifact of compiled.bundle.artifacts.filter(({ kind }) => kind === 'example')) {
    exampleSources[artifact.id] = await readFile(
      resolve(repositoryRoot, artifact.source.content),
      'utf8',
    );
  }
  return {
    compiled,
    context,
    component,
    revisionContext: { examples, tokenSources, exampleSources },
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

test('E-G0.5-01: scaffold, validation, compilation, retrieval, diagnosis, and repair stay canonical', async () => {
  const { compiled, context, component } = await setup();
  const sourcePath = component.source.record;
  const sourceBefore = await readFile(resolve(repositoryRoot, sourcePath), 'utf8');
  const { schemaVersion: _schemaVersion, id: _id, kind: _kind, ...decisions } =
    component.record;
  const preview = scaffoldComponent({
    slug: 'button',
    recordPath: sourcePath,
    decisions,
  });
  assert.equal(preview.mode, 'preview-only');
  assert.equal(preview.writeSet[0].path, sourcePath);
  assert.equal(canonicalJson(preview.record), canonicalJson(component.record));
  assert.equal(diagnoseCanonicalSource({
    context,
    family: 'component',
    record: preview.record,
    recordPath: sourcePath,
  }).valid, true);

  const retrieved = createCatalogApi(compiled.bundle).getArtifact({
    id: preview.record.id,
    detail: 'full',
  });
  assert.equal(retrieved.type, 'artifact.detail');
  assert.equal(retrieved.data.artifact.source.record, sourcePath);

  const broken = structuredClone(preview.record);
  delete broken.summary;
  const diagnosed = diagnoseCanonicalSource({
    context,
    family: 'component',
    record: broken,
    recordPath: sourcePath,
  });
  assert.equal(diagnosed.valid, false);
  assert.equal(diagnosed.diagnostics[0].ruleId, 'authoring.source.schema-invalid');
  assert.equal(diagnosed.diagnostics[0].details.source.record, sourcePath);
  assert.equal(diagnosed.diagnostics[0].details.owner.name, 'component-contract');
  assert.equal(diagnoseCanonicalSource({
    context,
    family: 'component',
    record: preview.record,
    recordPath: sourcePath,
  }).valid, true);
  assert.equal(await readFile(resolve(repositoryRoot, sourcePath), 'utf8'), sourceBefore);
  assert.equal(preview.writeSet.some(({ path }) => path.includes('/generated/')), false);
});

test('E-G0.5-01 negative: diagnostics require an exact manifest source and source revision', async () => {
  const { compiled, context, component } = await setup();
  await assert.rejects(
    loadRepositoryAuthoringContext({
      repositoryRoot,
      expectedSourceRevision: `sha256:${'0'.repeat(64)}`,
    }),
    (error) => {
      assert.ok(error instanceof AuthoringPolicyError);
      assert.equal(error.ruleId, 'authoring.source.revision-stale');
      return true;
    },
  );
  const undeclared = diagnoseCanonicalSource({
    context,
    family: 'component',
    record: component.record,
    recordPath: 'catalog/components/button/inferred.json',
  });
  assert.equal(undeclared.valid, false);
  assert.equal(undeclared.diagnostics[0].ruleId, 'authoring.source.declared-owner');
  assert.equal(context.sourceRevision, compiled.bundle.sourceRevision);
});

test('E-G0.5-02: semantic golden corpus reports owning fields and exact revision effects', async () => {
  const value = await corpus();
  const { component, revisionContext } = await setup();
  for (const change of value.semanticCases) {
    const after = applyCase(component.record, change);
    const result = semanticDiff({
      before: component.record,
      after,
      revisionContext,
    });
    assert.equal(result.changes.length, 1, change.id);
    assert.equal(result.changes[0].path, change.path, change.id);
    assert.equal(result.changes[0].effect, change.effect, change.id);
    assert.equal(result.versionEffect, change.versionEffect, change.id);
    assert.equal(result.revisions.contentRevision.changed, true, change.id);
    assert.equal(
      result.revisions.bindings['web.react'].bindingSpecRevision.changed,
      change.bindingSpecChanged,
      change.id,
    );
    assert.match(result.changes[0].owner.schemaPointer, /^#\//u, change.id);
  }
});

test('E-G0.5-02: revision explainer lists the normalized inputs behind each digest', async () => {
  const { component, revisionContext } = await setup();
  const explanation = explainRevisions({
    family: 'component',
    record: component.record,
    bindingId: 'web.react',
    ...revisionContext,
  });
  assert.deepEqual(explanation.axes.map(({ name }) => name), [
    'contentRevision',
    'bindingContentRevision',
    'bindingSpecRevision',
  ]);
  assert.ok(explanation.axes.every(({ digest, normalizedInputs }) => (
    /^sha256:[a-f0-9]{64}$/u.test(digest)
    && normalizedInputs.length > 0
    && normalizedInputs.every(({ path }) => path.startsWith('$'))
  )));
  assert.equal(
    explanation.axes.find(({ name }) => name === 'contentRevision').digest,
    component.contentRevision,
  );
  assert.equal(
    explanation.axes.find(({ name }) => name === 'bindingSpecRevision').digest,
    component.bindingSpecRevisions['web.react'],
  );
});

test('E-G0.5-03: autofix is preview-only and denies every product-meaning category', async () => {
  const value = await corpus();
  const { component } = await setup();
  const record = structuredClone(component.record);
  record.summary = '  Triggers an immediate action.  ';
  const preview = previewAutofix({ record, path: '$/summary' });
  assert.equal(preview.mode, 'preview-only');
  assert.deepEqual(preview.changedPaths, ['$/summary']);
  assert.equal(preview.record.summary, 'Triggers an immediate action.');
  assert.equal(record.summary, '  Triggers an immediate action.  ');

  for (const denied of value.autofixDenied) {
    assert.throws(
      () => previewAutofix({ record: component.record, path: denied.path }),
      (error) => {
        assert.ok(error instanceof AuthoringPolicyError, denied.category);
        assert.match(error.ruleId, /^authoring\.autofix\./u, denied.category);
        return true;
      },
    );
  }
});

test('E-G0.5-04: affected closure is graph-derived, declared, and bounded to Gate 0', async () => {
  const { context, component } = await setup();
  const closure = affectedClosure({
    context,
    sourcePaths: [component.source.record],
  });
  assert.equal(closure.sourceRevision, context.sourceRevision);
  assert.ok(closure.artifacts.includes('core:component:button'));
  assert.ok(closure.artifacts.includes('core:example:button-basic-react'));
  assert.ok(closure.artifacts.includes('core:token:button-minimum'));
  assert.ok(closure.canonicalSources.includes(component.source.record));
  assert.ok(closure.projections.includes('packages/catalog/generated/catalog.json'));
  assert.deepEqual(closure.packages.map(({ name }) => name), [
    '@core-ui/catalog',
    '@core-ui/tooling',
  ]);
  assert.ok(closure.requiredChecks.includes('pnpm --filter @core-ui/catalog check'));
  assert.ok(closure.requiredChecks.includes('pnpm --filter @core-ui/tooling check'));
  assert.deepEqual(closure.deferred, [{
    capability: 'renderer-proof-evaluation-closure',
    readiness: 'unavailable',
    earliestBoundary: 'Gate 1',
  }]);

  const schemaClosure = affectedClosure({
    context,
    sourcePaths: ['packages/schema/schemas/component.schema.json'],
  });
  assert.ok(schemaClosure.projections.includes('packages/schema/generated/types.d.ts'));
  assert.deepEqual(schemaClosure.packages.map(({ name }) => name), [
    '@core-ui/catalog',
    '@core-ui/schema',
    '@core-ui/tooling',
  ]);
  assert.throws(
    () => affectedClosure({ context, sourcePaths: ['catalog/components/inferred.json'] }),
    (error) => error instanceof AuthoringPolicyError
      && error.ruleId === 'authoring.closure.source-undeclared',
  );
});
