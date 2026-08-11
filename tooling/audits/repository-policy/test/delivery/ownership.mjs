import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { deriveDeliveryOutput, validateDeliveryWorkflow } from '../../src/delivery-workflow.mjs';
import { buildAuthoredRecord, clone } from './fixtures.mjs';

export function registerOwnershipTests(repositoryRoot) {
  test('E-DELIVERY-01 loads one closed schema/profile/owner graph', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    assert.equal(contract.fields.length, 383);
    assert.equal(new Set(contract.fields.map(({ domain }) => domain)).size, 24);
    assert.equal(contract.owners.size, 15);
    assert.equal(contract.dependencyPreparation.value.profile, 'core-ui-dependency-preparation-command-v1');
    assert.ok(contract.commands.has('check'));
  });

  test('E-DELIVERY-02 validates the authored stage and owner-input matrix', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const { record, records } = buildAuthoredRecord(contract);
    assert.equal(validateDeliveryWorkflow(contract, record, { records }).record, record);
    const output = deriveDeliveryOutput(contract, record, { records });
    assert.equal(output.lifecycleState, 'INTAKE');
    assert.equal(output.profile, 'core-ui-delivery-workflow-output-v1');
  });

  test('E-DELIVERY-02 rejects unknown, contradictory, unowned, and unavailable facts', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const { record, records } = buildAuthoredRecord(contract);
    const unknown = clone(record);
    unknown.unknown = true;
    assert.throws(() => validateDeliveryWorkflow(contract, unknown, { records }), /DELIVERY_SCHEMA_INVALID/);
    const route = clone(record);
    route.applicability.evidenceRoute = 'not-applicable';
    assert.throws(() => validateDeliveryWorkflow(contract, route, { records }), /DELIVERY_APPLICABILITY_INVALID/);
    const owner = clone(record);
    owner.ownerInputs.source.ownerRef = 'unknown-owner';
    assert.throws(() => validateDeliveryWorkflow(contract, owner, { records }), /DELIVERY_OWNER_INPUT_INVALID/);
    const g19 = clone(record);
    g19.intent = {
      changeIntentDigest: `sha256:${'1'.repeat(64)}`,
      changeIntentProfile: 'not-admitted-before-g1.9',
      changeIntentRecordRef: 'architecture-change-intent',
      changeIntentSchema: 'not-admitted-before-g1.9',
      humanDecisionRecordRef: 'decision-0007-decision-owner',
      mode: 'g1.9-envelope',
    };
    assert.throws(() => validateDeliveryWorkflow(contract, g19, { records }), /DELIVERY_CHANGE_INTENT_NOT_ADMITTED/);
  });
}
