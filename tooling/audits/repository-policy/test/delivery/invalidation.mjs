import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyDeliveryInvalidation } from '../../src/delivery-invalidation.mjs';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { buildAuthoredRecord, clone } from './fixtures.mjs';

export function registerInvalidationTests(repositoryRoot) {
  test('E-DELIVERY-03 derives invalidation from exact schema pointers and unions domains', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const { record } = buildAuthoredRecord(contract);
    const after = clone(record);
    after.intent.expectedPathSet = ['tooling/example'];
    after.authority.scopeIds = ['SCOPE-FOUNDATION-001', 'SCOPE-FOUNDATION-002'];
    const result = classifyDeliveryInvalidation(contract, record, after);
    assert.deepEqual(result.domains, ['AUTHORITY', 'INTENT']);
    assert.equal(result.earliestRewind, 'AUTHORITY_ALIGNED');
    assert.ok(result.invalidatedIdentities.includes('acceptance'));
    assert.ok(result.invalidatedIdentities.includes('proof'));
  });

  test('E-DELIVERY-03 maps fixed packet and reviewer fields without heuristic messages', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    assert.equal(contract.profile.fieldDomainMap['/$defs/workflowRecord/properties/packet/properties/reviewScopeDigest'], 'PACKET');
    assert.equal(contract.profile.fieldDomainMap['/$defs/workflowRecord/properties/reviews/properties/results/items/properties/resultDigest'], 'REVIEW');
  });
}
