import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requiredDeliveryReviewers } from '../../src/delivery-packet.mjs';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';

export function registerReviewRoutingTests(repositoryRoot) {
  test('E-DELIVERY-05 routes only the risk-triggered independent reviewers', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'planning-only'), ['core-ui-authority-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'renderer-behavior'), ['core-ui-evidence-reviewer', 'core-ui-renderer-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'package-release'), ['core-ui-evidence-reviewer', 'core-ui-release-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'explanation-only'), []);
  });
}
