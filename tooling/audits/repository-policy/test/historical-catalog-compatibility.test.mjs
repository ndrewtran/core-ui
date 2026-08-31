import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyHistoricalCatalogCompatibility } from './historical-catalog-compatibility.mjs';

test('private historical catalog verifier preserves immutable response meanings', async () => {
  assert.equal(await verifyHistoricalCatalogCompatibility(), true);
});
