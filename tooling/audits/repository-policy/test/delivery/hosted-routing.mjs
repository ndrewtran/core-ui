import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';

export function registerHostedRoutingTests(repositoryRoot) {
  test('E-DELIVERY-06 keeps hosted facts observational and acceptance external', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    assert.equal(contract.profile.fieldClassificationMap['/$defs/workflowRecord/properties/observations/properties/hosted/properties/observationDigest'], 'proved');
    assert.deepEqual(contract.profile.invalidationRoutes.HOSTED_RESULT, ['PACKET_RENDERED', 'hosted-observation', 'merge']);
    assert.deepEqual(contract.profile.invalidationRoutes.ACCEPTANCE, ['PACKET_RENDERED', 'acceptance']);
  });
}
