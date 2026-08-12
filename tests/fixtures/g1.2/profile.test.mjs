import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { catalogJson } from '@core-ui/catalog/bundle';
import { assertG12PlatformSafetyFixture } from './profile.mjs';

const fixture = JSON.parse(await readFile(new URL('./platform-safety-native.json', import.meta.url), 'utf8'));
const component = JSON.parse(catalogJson).artifacts.find(({ id }) => id === 'core:component:button');

test('G1.2 native safety fixture is an exact catalog-derived three-profile matrix', () => {
  assert.doesNotThrow(() => assertG12PlatformSafetyFixture(fixture, component));
});

for (const [name, mutate] of [
  ['unknown root key', (value) => { value.extra = true; }],
  ['missing root key', (value) => { delete value.bindingRef; }],
  ['unknown tuple key', (value) => { value.tuples[0].extra = true; }],
  ['missing tuple key', (value) => { delete value.tuples[0].validationProfile; }],
  ['duplicate tuple', (value) => { value.tuples[1] = structuredClone(value.tuples[0]); }],
  ['reordered tuple', (value) => { value.tuples.reverse(); }],
  ['wrong contract', (value) => { value.platformSafetyContractDigest = `sha256:${'0'.repeat(64)}`; }],
  ['wrong set digest', (value) => { value.tuples[0].platformSafetyRequirementSetDigest = `sha256:${'0'.repeat(64)}`; }],
  ['wrong validation profile', (value) => { value.tuples[0].validationProfile = 'native.android'; }],
]) test(`G1.2 native safety fixture rejects ${name}`, () => {
  const value = structuredClone(fixture);
  mutate(value);
  assert.throws(() => assertG12PlatformSafetyFixture(value, component), /G12_FIXTURE_INVALID/u);
});
