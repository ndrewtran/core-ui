import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyDeliveryInvalidation, classifyReviewerInvalidation } from '../../src/delivery-invalidation.mjs';
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

  test('E-DELIVERY-03 preserves reviewer results only when every declared dependency is byte-identical', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const dependencies = Object.fromEntries(Object.keys(contract.profile.reviewerDependencyRelations)
      .map((key) => [key, { digest: `sha256:${key.padEnd(64, '0').slice(0, 64)}` }]));
    assert.deepEqual(classifyReviewerInvalidation(contract, dependencies, clone(dependencies)), {
      changedPointers: [], invalidated: [], rewind: null,
    });
    const source = clone(dependencies);
    source.source.digest = `sha256:${'f'.repeat(64)}`;
    const sourceResult = classifyReviewerInvalidation(contract, dependencies, source);
    assert.deepEqual(sourceResult.invalidated, ['all-reviews', 'dependent-acceptance', 'packet']);
    const proof = clone(dependencies);
    proof.proof.digest = `sha256:${'e'.repeat(64)}`;
    assert.deepEqual(classifyReviewerInvalidation(contract, dependencies, proof).invalidated,
      ['dependent-acceptance', 'evidence-review', 'packet', 'release-review']);
  });

  test('E-DELIVERY-03 uses broad PACKET rewind for missing, unknown, wildcard, or contradictory dependency relations', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const dependencies = Object.fromEntries(Object.keys(contract.profile.reviewerDependencyRelations)
      .map((key) => [key, { digest: `sha256:${'0'.repeat(64)}` }]));
    for (const mutate of [
      (value) => { delete value.source; },
      (value) => { value.hosted = { digest: `sha256:${'1'.repeat(64)}` }; },
    ]) {
      const candidate = clone(dependencies);
      mutate(candidate);
      assert.deepEqual(classifyReviewerInvalidation(contract, dependencies, candidate).invalidated,
        ['all-reviews', 'dependent-acceptance', 'packet']);
    }
    const unsafe = { ...contract, profile: clone(contract.profile) };
    unsafe.profile.reviewerDependencyRelations = clone(contract.profile.reviewerDependencyRelations);
    unsafe.profile.reviewerDependencyRelations.source = ['*'];
    assert.deepEqual(classifyReviewerInvalidation(unsafe, dependencies, clone(dependencies)).invalidated,
      ['all-reviews', 'dependent-acceptance', 'packet']);
  });
}
