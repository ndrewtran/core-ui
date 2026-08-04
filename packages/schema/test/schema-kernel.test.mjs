import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ARTIFACT_REF_PATTERN,
  ERROR_CODES,
  SchemaValidationError,
  assertAppendOnlyErrorCodes,
  bindingSpecRevision,
  canonicalDigest,
  canonicalJson,
  classifySchemaChange,
  contentRevision,
  negotiateSchemaVersion,
  parseArtifactRef,
  parseJsonStrict,
  relationEdges,
  validateCatalogRecords,
  validateFamily,
  validateFieldOwnershipRegistry,
  validateRelationRegistry,
} from '../src/index.mjs';
import {
  allRecords,
  capability,
  component,
  example,
  guide,
  tokenSource,
} from './fixtures.mjs';

const normativeExampleSource = '<Button disabled={false}>Save</Button>\n';

function revisionInput({
  concept,
  bindingId = 'web.react',
  examples = [],
  tokenSources = [],
  exampleSources = {},
}) {
  return { component: concept, bindingId, examples, tokenSources, exampleSources };
}

function expectCode(code) {
  return (error) => {
    assert.ok(error instanceof SchemaValidationError);
    assert.equal(error.code, code);
    return true;
  };
}

test('E-G0.1-01: minimum records, envelopes, diagnostics, ownership, and relations validate', () => {
  const graph = validateCatalogRecords(allRecords());
  assert.equal(graph.records.length, 5);
  assert.equal(relationEdges(graph.records).length, 8);
  assert.equal(validateRelationRegistry().relations.length, 4);
  assert.equal(validateFieldOwnershipRegistry().classes.length, 3);
  assert.deepEqual(parseArtifactRef('core:component:button'), {
    value: 'core:component:button',
    kind: 'component',
    slug: 'button',
  });
  assert.match('core:pattern:form', new RegExp(ARTIFACT_REF_PATTERN));
  assert.throws(
    () => parseArtifactRef('core:pattern:form', { requireEnabledRecordKind: true }),
    /record behavior is unavailable in G0\.1/,
  );

  validateFamily('query-envelope', {
    apiVersion: '1.0.0',
    type: 'artifact.detail',
    data: {},
    meta: { schemaVersion: '1.0.0', authority: 'advisory', revisions: {} },
    warnings: [],
    futureOptionalMember: true,
  });
  validateFamily('diagnostic', {
    code: 'CORE_SCHEMA_INVALID',
    ruleId: 'schema.record.valid',
    message: 'The record is invalid.',
    retryable: false,
    details: {},
  });
});

test('E-G0.1-01 negative: unknown, duplicate, invalid-relation, and unowned fields fail closed', () => {
  const unknown = component();
  unknown.unowned = true;
  assert.throws(() => validateFamily('component', unknown), expectCode('CORE_SCHEMA_INVALID'));

  const duplicate = component();
  assert.throws(
    () => validateCatalogRecords([duplicate, structuredClone(duplicate), tokenSource()]),
    expectCode('CORE_ARTIFACT_ID_INVALID'),
  );

  const badRelation = example();
  badRelation.binding.ref = 'core:component:missing#web.react';
  assert.throws(
    () => validateCatalogRecords([component(), badRelation, tokenSource()]),
    expectCode('CORE_RELATION_INVALID'),
  );

  const unowned = component();
  unowned.bindings['web.react'].contentRevision = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => validateFamily('component', unowned), expectCode('CORE_SCHEMA_INVALID'));

  const mismatchedValidationProfile = component();
  mismatchedValidationProfile.bindings['native.react-native'].runtimeProfiles.ios.validationProfile =
    'native.android';
  assert.throws(
    () => validateCatalogRecords([mismatchedValidationProfile, tokenSource()]),
    expectCode('CORE_SCHEMA_INVALID'),
  );

  const impossibleApplicability = example();
  impossibleApplicability.binding.runtimeProfiles = ['ios'];
  assert.throws(
    () => validateCatalogRecords([component(), impossibleApplicability, tokenSource()]),
    expectCode('CORE_RELATION_INVALID'),
  );

  const unsupportedApplicability = example();
  unsupportedApplicability.binding.ref = 'core:component:button#native.react-native';
  unsupportedApplicability.binding.runtimeProfiles = ['native.react-native-web'];
  assert.throws(
    () => validateCatalogRecords([component(), unsupportedApplicability, tokenSource()]),
    expectCode('CORE_RELATION_INVALID'),
  );
});

test('E-G0.1-02: canonical bytes ignore key order and whitespace but preserve meaning', () => {
  const first = parseJsonStrict('{"b":"line\\r\\nvalue","a":1}');
  const second = parseJsonStrict(' { "a" : 1, "b" : "line\\nvalue" } ');
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(canonicalDigest(first), canonicalDigest(second));
  assert.notEqual(canonicalDigest(first), canonicalDigest({ ...first, a: 2 }));
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'), /JSON_DUPLICATE_KEY/);
  assert.throws(() => parseJsonStrict('{\u00a0"a":1}'), /JSON_PARSE_INVALID/);
  assert.throws(() => parseJsonStrict('{\f"a":1}'), /JSON_PARSE_INVALID/);
  assert.throws(
    () => canonicalJson({ 'line\r\n': 1, 'line\n': 2 }),
    /CANONICAL_KEY_COLLISION/,
  );
});

test('E-G0.1-03: editorial content and normative binding closure affect the correct revision', () => {
  const concept = component();
  const token = tokenSource();
  const normative = example();
  const baseContent = contentRevision('component', concept);
  const baseSpec = bindingSpecRevision({
    ...revisionInput({
      concept,
      examples: [normative],
      tokenSources: [token],
      exampleSources: { [normative.id]: normativeExampleSource },
    }),
  });
  assert.throws(
    () => bindingSpecRevision({
      ...revisionInput({ concept, examples: [normative], tokenSources: [token] }),
    }),
    /missing executable source bytes/,
  );

  const editorialConcept = structuredClone(concept);
  editorialConcept.summary = 'Editorially clarified immediate-action guidance.';
  assert.notEqual(contentRevision('component', editorialConcept), baseContent);
  assert.equal(bindingSpecRevision({
    ...revisionInput({
      concept: editorialConcept,
      examples: [normative],
      tokenSources: [token],
      exampleSources: { [normative.id]: normativeExampleSource },
    }),
  }), baseSpec);

  const inertExtension = structuredClone(concept);
  inertExtension.extensions = { 'core.experimental.g01-proof': { note: 'inert' } };
  assert.notEqual(contentRevision('component', inertExtension), baseContent);
  assert.equal(bindingSpecRevision({
    ...revisionInput({
      concept: inertExtension,
      examples: [normative],
      tokenSources: [token],
      exampleSources: { [normative.id]: normativeExampleSource },
    }),
  }), baseSpec);

  const stableExtension = structuredClone(inertExtension);
  stableExtension.lifecycle = 'stable';
  assert.throws(() => validateFamily('component', stableExtension), /requires experimental lifecycle/);

  const normativeBinding = structuredClone(concept);
  normativeBinding.bindings['web.react'].api.defaults.disabled = true;
  assert.notEqual(bindingSpecRevision({
    ...revisionInput({
      concept: normativeBinding,
      examples: [normative],
      tokenSources: [token],
      exampleSources: { [normative.id]: normativeExampleSource },
    }),
  }), baseSpec);

  assert.notEqual(bindingSpecRevision({
    ...revisionInput({
      concept,
      examples: [normative],
      tokenSources: [token],
      exampleSources: { [normative.id]: `${normativeExampleSource}// normative change\n` },
    }),
  }), baseSpec);

  const editorialToken = structuredClone(token);
  editorialToken.summary = 'Editorially clarified token guidance.';
  editorialToken.tokens['semantic.action.background'].value = '#ffffff';
  assert.equal(bindingSpecRevision({
    ...revisionInput({
      concept,
      examples: [normative],
      tokenSources: [editorialToken],
      exampleSources: { [normative.id]: normativeExampleSource },
    }),
  }), baseSpec);

  const normativeTokenContract = structuredClone(token);
  normativeTokenContract.tokens['semantic.action.foreground'] = {
    type: 'color',
    value: '#ffffff',
  };
  assert.notEqual(bindingSpecRevision({
    ...revisionInput({
      concept,
      examples: [normative],
      tokenSources: [normativeTokenContract],
      exampleSources: { [normative.id]: normativeExampleSource },
    }),
  }), baseSpec);

  const editorialExample = example({ guidanceImpact: 'editorial', purposes: ['explanation'] });
  editorialExample.summary = 'An editorial explanation only.';
  assert.equal(bindingSpecRevision({
    ...revisionInput({
      concept,
      examples: [editorialExample],
      tokenSources: [token],
    }),
  }), bindingSpecRevision({
    ...revisionInput({ concept, examples: [], tokenSources: [token] }),
  }));

  const forbiddenDowngrade = example({ guidanceImpact: 'editorial', purposes: ['generation'] });
  assert.throws(
    () => validateFamily('example', forbiddenDowngrade),
    /implementation-relevant examples must be normative/,
  );
});

test('E-G0.1-04: package/source locations remain derived and generated types retain owner linkage', async () => {
  for (const record of [component(), example(), guide(), capability(), tokenSource()]) {
    record.sourceLocation = 'packages/incorrect';
    assert.throws(
      () => validateFamily(record.kind === 'token' ? 'token-source' : record.kind, record),
      expectCode('CORE_SCHEMA_INVALID'),
    );
  }
  const generated = await readFile(resolve(import.meta.dirname, '../generated/types.d.ts'), 'utf8');
  assert.match(generated, /@generated-from: packages\/schema\/schemas\/type-projection\.json/);
  assert.match(generated, /export type ArtifactKind/);
});

test('E-G0.1-05: schema evolution and append-only response policy enforce declared effects', () => {
  assert.equal(classifySchemaChange('description-or-annotation').versionEffect, 'patch');
  assert.equal(classifySchemaChange('optional-stable-field').versionEffect, 'minor');
  assert.equal(classifySchemaChange('required-field').versionEffect, 'major');
  assert.equal(classifySchemaChange('field-removal').migration, 'deprecate-in-minor-remove-next-major');
  assert.deepEqual(
    negotiateSchemaVersion('1.2.3', { minimum: '1.0.0', maximumExclusive: '2.0.0' }),
    { version: '1.2.3', compatibility: 'readable' },
  );
  assert.throws(
    () => negotiateSchemaVersion('2.0.0', { minimum: '1.0.0', maximumExclusive: '2.0.0' }),
    expectCode('CORE_SCHEMA_VERSION_UNSUPPORTED'),
  );
  assert.deepEqual(assertAppendOnlyErrorCodes(ERROR_CODES, [...ERROR_CODES, 'CORE_NEW_CODE']), [
    ...ERROR_CODES,
    'CORE_NEW_CODE',
  ]);
  assert.throws(
    () => assertAppendOnlyErrorCodes(ERROR_CODES, ERROR_CODES.slice(1)),
    expectCode('CORE_SCHEMA_VERSION_UNSUPPORTED'),
  );
});
