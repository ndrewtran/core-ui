import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ARTIFACT_REF_PATTERN,
  ERROR_CODES,
  SchemaValidationError,
  assertAppendOnlyErrorCodes,
  bindingContentRevision,
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
  const ownership = validateFieldOwnershipRegistry();
  assert.equal(ownership.classes.length, 3);
  assert.ok(ownership.fields.length > 100);
  const nestedStrategy = component();
  nestedStrategy.bindings['web.react'].api.defaults.strategy = 'compact';
  nestedStrategy.bindings['web.react'].extensions = {
    'core.experimental.g01-proof': { strategy: 'memo' },
  };
  assert.equal(validateCatalogRecords([nestedStrategy, tokenSource()]).records.length, 2);
  const missingOwnership = structuredClone(ownership);
  missingOwnership.fields.pop();
  assert.throws(
    () => validateFieldOwnershipRegistry(missingOwnership),
    expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
  );
  const duplicateOwnership = structuredClone(ownership);
  duplicateOwnership.fields.push(structuredClone(duplicateOwnership.fields[0]));
  assert.throws(
    () => validateFieldOwnershipRegistry(duplicateOwnership),
    expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
  );
  const misowned = structuredClone(ownership);
  misowned.fields[0].owner = 'not-the-canonical-owner';
  assert.throws(
    () => validateFieldOwnershipRegistry(misowned),
    expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
  );
  for (const schema of [
    'binding.schema.json',
    'component.schema.json',
    'query-envelope.schema.json',
  ]) {
    const missingSchema = structuredClone(ownership);
    missingSchema.governedSchemas = missingSchema.governedSchemas.filter(
      (entry) => entry.file !== schema,
    );
    missingSchema.fields = missingSchema.fields.filter((field) => field.schema !== schema);
    assert.throws(
      () => validateFieldOwnershipRegistry(missingSchema),
      expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
    );
  }
  for (const name of ownership.reservedFields.map((field) => field.name)) {
    const missingReserved = structuredClone(ownership);
    missingReserved.reservedFields = missingReserved.reservedFields.filter(
      (field) => field.name !== name,
    );
    assert.throws(
      () => validateFieldOwnershipRegistry(missingReserved),
      expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
    );
    for (const mutation of [
      { owner: 'not-the-canonical-owner' },
      { class: 'authored' },
      { forbiddenInAuthoredSource: false },
    ]) {
      const mutatedReserved = structuredClone(ownership);
      Object.assign(
        mutatedReserved.reservedFields.find((field) => field.name === name),
        mutation,
      );
      assert.throws(
        () => validateFieldOwnershipRegistry(mutatedReserved),
        expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
      );
    }
  }
  for (const mutation of [
    { owner: 'coordinated-mutated-owner' },
    { class: 'proved' },
  ]) {
    const coordinatedMutation = structuredClone(ownership);
    Object.assign(
      coordinatedMutation.governedSchemas.find(
        (context) => context.file === 'component.schema.json',
      ),
      mutation,
    );
    for (const field of coordinatedMutation.fields.filter(
      (entry) => entry.schema === 'component.schema.json',
    )) {
      Object.assign(field, mutation);
    }
    assert.throws(
      () => validateFieldOwnershipRegistry(coordinatedMutation),
      expectCode('CORE_FIELD_OWNERSHIP_INVALID'),
    );
  }
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

  const bindingContent = bindingContentRevision(component().bindings['web.react']);
  assert.match(bindingContent, /^sha256:[a-f0-9]{64}$/);
  validateFamily('query-envelope', {
    apiVersion: '1.0.0',
    type: 'artifact.detail',
    data: {
      artifact: {
        id: 'core:component:button',
        kind: 'component',
        source: { record: 'catalog/components/button/artifact.json' },
      },
    },
    meta: {
      schemaVersion: '1.0.0',
      authority: 'advisory',
      revisions: {
        conceptContent: `sha256:${'1'.repeat(64)}`,
        bindingContent,
        bindingSpec: `sha256:${'2'.repeat(64)}`,
      },
      coreVersion: '0.0.0',
      catalogVersion: '0.0.0',
      catalogDigest: `sha256:${'3'.repeat(64)}`,
      sourceRevision: `sha256:${'4'.repeat(64)}`,
      resolution: {
        authority: 'advisory',
        compatibility: 'unresolved',
        catalogSource: 'package',
        sourceRevision: `sha256:${'4'.repeat(64)}`,
        revisions: {
          conceptContent: `sha256:${'1'.repeat(64)}`,
          bindingContent,
          bindingSpec: `sha256:${'2'.repeat(64)}`,
        },
        targetPackages: {},
      },
      platform: 'web.react',
      detail: 'full',
      truncated: false,
      nextCursor: null,
    },
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

  for (const hostileKind of ['toString', 'constructor', '__proto__']) {
    const invalidKind = component();
    invalidKind.kind = hostileKind;
    assert.throws(
      () => validateCatalogRecords([invalidKind, tokenSource()]),
      expectCode('CORE_SCHEMA_INVALID'),
    );
  }

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

  const crossBindingProfile = component();
  crossBindingProfile.bindings['web.react'].runtimeProfiles.ios = {
    strategy: 'adapted',
    lifecycle: 'experimental',
    validationProfile: 'native.ios',
  };
  assert.throws(
    () => validateCatalogRecords([crossBindingProfile, tokenSource()]),
    expectCode('CORE_SCHEMA_INVALID'),
  );

  const missingNativeDisposition = component();
  delete missingNativeDisposition.bindings['native.react-native'].runtimeProfiles.android;
  assert.throws(
    () => validateCatalogRecords([missingNativeDisposition, tokenSource()]),
    expectCode('CORE_SCHEMA_INVALID'),
  );

  const unsupportedBinding = {
    schemaVersion: '1.0.0',
    strategy: 'unsupported',
    reason: 'No responsible implementation exists.',
  };
  assert.deepEqual(validateFamily('binding', unsupportedBinding), unsupportedBinding);
  const componentWithUnsupportedBinding = component();
  componentWithUnsupportedBinding.bindings['web.react'] = unsupportedBinding;
  assert.equal(
    validateCatalogRecords([componentWithUnsupportedBinding, tokenSource()]).records.length,
    2,
  );
  assert.throws(
    () => validateCatalogRecords([
      componentWithUnsupportedBinding,
      example(),
      tokenSource(),
    ]),
    expectCode('CORE_RELATION_INVALID'),
  );
  assert.throws(
    () => validateFamily('binding', {
      schemaVersion: '1.0.0',
      strategy: 'unsupported',
      alternative: 'core:component:button',
    }),
    expectCode('CORE_SCHEMA_INVALID'),
  );
  assert.throws(
    () => validateFamily('binding', { schemaVersion: '1.0.0', strategy: 'unsupported' }),
    expectCode('CORE_SCHEMA_INVALID'),
  );
  assert.throws(
    () => validateFamily('binding', { ...unsupportedBinding, lifecycle: 'experimental' }),
    expectCode('CORE_SCHEMA_INVALID'),
  );
  for (const field of ['reason', 'alternative']) {
    assert.throws(
      () => validateFamily('binding', {
        ...component().bindings['web.react'],
        [field]: field === 'reason' ? 'Not applicable.' : 'core:component:button',
      }),
      expectCode('CORE_SCHEMA_INVALID'),
    );
    const implementedProfile = component().bindings['native.react-native'].runtimeProfiles.ios;
    assert.throws(
      () => validateFamily('binding', {
        ...component().bindings['native.react-native'],
        runtimeProfiles: {
          ...component().bindings['native.react-native'].runtimeProfiles,
          ios: {
            ...implementedProfile,
            [field]: field === 'reason' ? 'Not applicable.' : 'core:component:button',
          },
        },
      }),
      expectCode('CORE_SCHEMA_INVALID'),
    );
  }
  const alternativeOnlyProfile = component().bindings['native.react-native'];
  alternativeOnlyProfile.runtimeProfiles['native.react-native-web'] = {
    strategy: 'unsupported',
    alternative: 'core:component:button',
  };
  assert.throws(
    () => validateFamily('binding', alternativeOnlyProfile),
    expectCode('CORE_SCHEMA_INVALID'),
  );
  const forbiddenUnsupportedFields = {
    api: { props: [], events: [], parts: [], defaults: {} },
    behavior: [],
    accessibility: [],
    tokenSources: [],
    runtimeProfiles: {
      ios: {
        strategy: 'adapted',
        lifecycle: 'experimental',
        validationProfile: 'native.ios',
      },
    },
  };
  for (const [field, fieldValue] of Object.entries(forbiddenUnsupportedFields)) {
    assert.throws(
      () => validateFamily('binding', { ...unsupportedBinding, [field]: fieldValue }),
      expectCode('CORE_SCHEMA_INVALID'),
    );
  }

  const danglingPrerequisite = example();
  danglingPrerequisite.prerequisites = ['core:component:missing'];
  assert.throws(
    () => validateCatalogRecords([component(), danglingPrerequisite, tokenSource()]),
    expectCode('CORE_RELATION_INVALID'),
  );

  const danglingAlternative = component();
  danglingAlternative.bindings['web.react'] = {
    schemaVersion: '1.0.0',
    strategy: 'unsupported',
    reason: 'No responsible implementation exists.',
    alternative: 'core:component:missing',
  };
  assert.throws(
    () => validateCatalogRecords([danglingAlternative, tokenSource()]),
    expectCode('CORE_RELATION_INVALID'),
  );

  const unsupportedProfileExample = example();
  unsupportedProfileExample.binding.runtimeProfiles = ['ios'];
  assert.throws(
    () => validateCatalogRecords([
      componentWithUnsupportedBinding,
      unsupportedProfileExample,
      tokenSource(),
    ]),
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
  assert.throws(() => parseJsonStrict('{"value":9007199254740993}'), /JSON_NUMBER_LOSSY/);
  assert.throws(() => parseJsonStrict('{"value":0.10000000000000001}'), /JSON_NUMBER_LOSSY/);
  const prototypeObject = parseJsonStrict('{"__proto__":{"polluted":true}}');
  assert.equal(Object.getPrototypeOf(prototypeObject), null);
  assert.equal(Object.hasOwn(prototypeObject, '__proto__'), true);
  const topLevelPrototype = parseJsonStrict(
    `${JSON.stringify(component()).slice(0, -1)},"__proto__":{"polluted":true}}`,
  );
  assert.throws(
    () => validateFamily('component', topLevelPrototype),
    expectCode('CORE_SCHEMA_INVALID'),
  );
  const nestedPrototype = parseJsonStrict(
    JSON.stringify(component()).replace(
      '"defaults":{"disabled":false}',
      '"defaults":{"disabled":false,"__proto__":{"polluted":true}}',
    ),
  );
  assert.throws(
    () => validateFamily('component', nestedPrototype),
    expectCode('CORE_SCHEMA_INVALID'),
  );
  for (const inheritedKey of [
    'toString',
    'valueOf',
    'hasOwnProperty',
    '__defineGetter__',
    '__lookupSetter__',
  ]) {
    const hostileRecord = parseJsonStrict(
      `${JSON.stringify(component()).slice(0, -1)},${JSON.stringify(inheritedKey)}:true}`,
    );
    assert.throws(
      () => validateFamily('component', hostileRecord),
      expectCode('CORE_SCHEMA_INVALID'),
    );

    const hostileBinding = component();
    hostileBinding.bindings[inheritedKey] = structuredClone(
      hostileBinding.bindings['web.react'],
    );
    assert.throws(
      () => validateFamily('component', hostileBinding),
      expectCode('CORE_SCHEMA_INVALID'),
    );

    const hostileRuntimeProfile = component();
    hostileRuntimeProfile.bindings['native.react-native'].runtimeProfiles[inheritedKey] = {
      strategy: 'adapted',
      lifecycle: 'experimental',
      validationProfile: 'native.ios',
    };
    assert.throws(
      () => validateFamily('component', hostileRuntimeProfile),
      expectCode('CORE_SCHEMA_INVALID'),
    );
  }
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
  inertExtension.extensions = {
    'core.experimental.g01-proof': { note: 'inert', strategy: 'memo' },
  };
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

  const unsafeTokenNumber = structuredClone(token);
  unsafeTokenNumber.tokens['semantic.action.background'].value = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(
    () => contentRevision('token-source', unsafeTokenNumber),
    /CANONICAL_NUMBER_INVALID/,
  );

  const unsafeDefault = structuredClone(concept);
  unsafeDefault.bindings['web.react'].api.defaults.disabled = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(
    () => bindingSpecRevision({
      ...revisionInput({
        concept: unsafeDefault,
        examples: [normative],
        tokenSources: [token],
        exampleSources: { [normative.id]: normativeExampleSource },
      }),
    }),
    /CANONICAL_NUMBER_INVALID/,
  );

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
  for (const inheritedChangeType of ['toString', 'constructor', '__proto__']) {
    assert.throws(
      () => classifySchemaChange(inheritedChangeType),
      expectCode('CORE_SCHEMA_VERSION_UNSUPPORTED'),
    );
  }
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
