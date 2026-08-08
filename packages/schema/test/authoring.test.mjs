import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  SchemaValidationError,
  authoringMetadata,
  authoringMetadataDigest,
  bindingContentRevision,
  bindingContentRevisionPreimage,
  bindingSpecRevision,
  bindingSpecRevisionPreimage,
  canonicalDigest,
  contentRevision,
  contentRevisionPreimage,
  resolveAuthoringField,
  validateAuthoringMetadata,
} from '../src/index.mjs';
import { component, example, tokenSource } from './fixtures.mjs';

async function schemaDocument(name) {
  return JSON.parse(await readFile(
    resolve(import.meta.dirname, `../schemas/${name}`),
    'utf8',
  ));
}

test('E-G0.5-04: schema-owned metadata drives completion, effects, revisions, and owners', () => {
  const declarations = validateAuthoringMetadata();
  assert.ok(declarations.length > 30);
  assert.match(authoringMetadataDigest(), /^sha256:[a-f0-9]{64}$/u);
  assert.equal(authoringMetadata('component').some(({ field }) => field === 'summary'), true);

  const lifecycle = resolveAuthoringField('component', '$/lifecycle');
  assert.deepEqual(lifecycle.completion.values, [
    'experimental',
    'stable',
    'deprecated',
    'removed',
  ]);
  assert.equal(lifecycle.owner, 'component-contract');
  assert.equal(lifecycle.effects.replace, 'incompatible');

  const defaultValue = resolveAuthoringField(
    'component',
    '$/bindings/web.react/api/defaults/disabled',
  );
  assert.equal(defaultValue.field, 'defaults');
  assert.equal(defaultValue.owner, 'binding-contract');
  assert.deepEqual(defaultValue.revisionAxes, ['binding-content', 'binding-spec']);
});
test('E-G0.5-02: revision preimages are the exact inputs hashed by existing digest functions', () => {
  const concept = component();
  const binding = concept.bindings['web.react'];
  const normative = example();
  const token = tokenSource();
  const source = '<Button disabled={false}>Save</Button>\n';
  const specInput = {
    component: concept,
    bindingId: 'web.react',
    examples: [normative],
    exampleSources: { [normative.id]: source },
    tokenSources: [token],
  };
  assert.equal(
    contentRevision('component', concept),
    canonicalDigest(contentRevisionPreimage('component', concept)),
  );
  assert.equal(
    bindingContentRevision(binding),
    canonicalDigest(bindingContentRevisionPreimage(binding)),
  );
  assert.equal(
    bindingSpecRevision(specInput),
    canonicalDigest(bindingSpecRevisionPreimage(specInput)),
  );
});

test('E-G0.5-04 negative: a new stable field cannot bypass authoring and ownership coupling', async () => {
  const componentSchema = await schemaDocument('component.schema.json');
  const bindingSchema = await schemaDocument('binding.schema.json');
  const ownership = await schemaDocument('field-ownership.json');
  const baselineCount = validateAuthoringMetadata().length;
  componentSchema.required.push('newStableField');
  componentSchema.properties.newStableField = { type: 'string', minLength: 1 };
  assert.throws(
    () => validateAuthoringMetadata({
      schemas: {
        'binding.schema.json': bindingSchema,
        'component.schema.json': componentSchema,
      },
      ownership,
    }),
    (error) => {
      assert.ok(error instanceof SchemaValidationError);
      assert.equal(error.code, 'CORE_SCHEMA_INVALID');
      assert.match(error.message, /missing x-core-ui-authoring metadata/u);
      return true;
    },
  );

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
  const coupled = validateAuthoringMetadata({
    schemas: {
      'binding.schema.json': bindingSchema,
      'component.schema.json': componentSchema,
    },
    ownership,
  });
  assert.equal(coupled.length, baselineCount + 1);
  assert.deepEqual(
    coupled.find(({ field }) => field === 'newStableField').revisionAxes,
    ['content'],
  );
});
