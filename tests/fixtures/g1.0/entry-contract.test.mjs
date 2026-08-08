import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  consumeButtonStaticWebTransform,
} from './consumers/button-web.consumer.mjs';
import {
  consumeButtonStaticNativeTransform,
} from './consumers/button-native.consumer.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const inventoryPath = resolve(repositoryRoot, 'tests/fixtures/g1.0/fixed-slice-needs.json');

function walk(value, visit, path = '$') {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}/${index}`));
  } else if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => walk(item, visit, `${path}/${key}`));
  }
}

test('G1.0 entry inventory covers the fixed matrix without authoring canonical facts', async () => {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  assert.equal(inventory.schema, 'core-ui-g1.0-entry-inventory-v1');
  assert.equal(inventory.classification, 'non-normative-entry-evidence');
  assert.deepEqual(
    inventory.slices.map(({ slice }) => slice),
    ['Button', 'TextField', 'Switch', 'Dialog', 'Select', 'Form'],
  );
  for (const slice of inventory.slices) {
    assert.ok(slice.tokenNeeds.length > 0, `${slice.slice} must inventory token needs`);
    assert.ok(slice.semanticNeeds.length > 0, `${slice.slice} must inventory semantic needs`);
    assert.ok(slice.logicNeeds.length > 0, `${slice.slice} must decide its pure-logic need`);
    assert.equal(slice.interactionNeed, 'unproved-absent');
    for (const need of slice.tokenNeeds) {
      assert.ok(need.need.length > 0);
      assert.ok(need.ownerClass.length > 0);
      assert.deepEqual([...need.targetFamilies].sort(), ['native', 'web']);
    }
  }

  const forbiddenKeys = new Set([
    'alias',
    'fallback',
    'layer',
    'mode',
    'overridePolicy',
    'recipe',
    'requirementLevel',
    'tokenId',
    'tokenType',
    'tokenValue',
    'unit',
    'value',
  ]);
  walk(inventory, (value, path) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value)) {
        assert.ok(!forbiddenKeys.has(key), `${path}/${key} must remain non-normative`);
      }
    }
  });

  assert.deepEqual(
    inventory.targetConsumers.map(({ id }) => id),
    ['button-web', 'button-react', 'button-ios', 'button-android', 'button-react-native-web-disposition'],
  );
  assert.ok(inventory.targetConsumers.every(({ runtimeSwitching }) => runtimeSwitching === 'unavailable'));
  assert.deepEqual(
    inventory.platformSafetyNeeds.map(({ target }) => target),
    ['web.html', 'web.react', 'native.ios', 'native.android', 'native.react-native-web'],
  );
});

test('G1.0 entry consumers require complete static web and native transforms', async () => {
  const digest = `sha256:${'1'.repeat(64)}`;
  const webTransform = {
    kind: 'web.css.static',
    css: ':root { color-scheme: light; }',
    runtimeSwitching: false,
    provenance: { source: 'canonical-token-source', digest },
  };
  assert.equal(
    consumeButtonStaticWebTransform(webTransform, { target: 'web.html' }).sourceDigest,
    digest,
  );
  assert.equal(
    consumeButtonStaticWebTransform(webTransform, { target: 'web.react' }).stylesheet,
    webTransform.css,
  );
  assert.throws(
    () => consumeButtonStaticWebTransform({ ...webTransform, runtimeSwitching: true }, { target: 'web.html' }),
    /G1_0_ENTRY_WEB_TRANSFORM_INVALID/,
  );

  for (const profile of ['native.ios', 'native.android']) {
    const nativeTransform = {
      kind: 'native.theme.static',
      profile,
      theme: { syntheticButtonRole: 'entry-only' },
      runtimeSwitching: false,
      provenance: { source: 'canonical-token-source', digest },
    };
    assert.equal(
      consumeButtonStaticNativeTransform(nativeTransform, { profile }).sourceDigest,
      digest,
    );
    assert.throws(
      () => consumeButtonStaticNativeTransform(
        { ...nativeTransform, cssSource: webTransform.css },
        { profile },
      ),
      /G1_0_ENTRY_NATIVE_TRANSFORM_INVALID/,
    );
  }

  const disposition = JSON.parse(await readFile(
    resolve(repositoryRoot, 'tests/fixtures/g1.0/consumers/button-react-native-web.disposition.json'),
    'utf8',
  ));
  assert.equal(disposition.profile, 'native.react-native-web');
  assert.equal(disposition.state, 'binding-owner-decision-required');
  assert.equal(disposition.implementationClaim, 'none');
});
