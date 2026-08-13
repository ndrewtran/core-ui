import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canonicalJson, sha256Digest } from '@core-ui/schema';
import { requiredDeliveryReviewers } from '../../src/delivery-packet.mjs';
import { evaluateDeliveryInvocation } from '../../src/delivery-conformance.mjs';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { clone, writeAdvisoryFixture } from './fixtures.mjs';

export function registerReviewRoutingTests(repositoryRoot) {
  test('E-DELIVERY-05 routes only the risk-triggered independent reviewers', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'planning-only'), ['core-ui-authority-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'renderer-behavior'), ['core-ui-evidence-reviewer', 'core-ui-renderer-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'package-release'), ['core-ui-evidence-reviewer', 'core-ui-release-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'repository'),
      ['core-ui-schema-catalog-reviewer', 'core-ui-evidence-reviewer', 'core-ui-release-reviewer']);
    assert.deepEqual(requiredDeliveryReviewers(contract, 'explanation-only'), []);
    assert.deepEqual(contract.profile.reviewerDependencyRelations.authority,
      ['packet', 'authority-review', 'schema-catalog-review', 'dependent-acceptance']);
    assert.deepEqual(contract.profile.reviewerDependencyRelations.disclosure,
      ['packet', 'all-reviews', 'dependent-acceptance']);
  });

  test('E-DELIVERY-05 rejects missing, duplicate, and unresolved reviewer assignments before dispatch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'core-ui-review-routing-'));
    try {
      const contract = await loadDeliveryProfile(repositoryRoot);
      const { invocation } = await writeAdvisoryFixture(contract, repositoryRoot, directory);
      const manifestPath = join(directory, 'invocation.json');
      const workflowInput = invocation.inputs.find(({ slot }) => slot === 'workflowRecord');
      const workflowPath = join(directory, workflowInput.locator);
      const originalWorkflow = JSON.parse(await readFile(workflowPath, 'utf8'));
      const assignmentInput = invocation.inputs.find(({ slot }) => slot === 'preimage.review-assignment-1');
      for (const mutate of [
        (workflow) => { workflow.reviews.requiredAssignments = []; },
        (workflow) => { workflow.reviews.requiredAssignments.push(clone(workflow.reviews.requiredAssignments[0])); },
        (workflow) => {
          workflow.reviews.requiredAssignments.push({
            ...clone(workflow.reviews.requiredAssignments[0]),
            assignmentRecordRef: 'unexpected-review-assignment',
            reviewerIdentity: 'unexpected-reviewer',
            role: 'core-ui-renderer-reviewer',
          });
        },
        (workflow) => { workflow.reviews.requiredAssignments[0].assignmentRecordDigest = `sha256:${'f'.repeat(64)}`; },
        (workflow) => {
          workflow.reviews.results = [{
            outcome: 'clear',
            ownerRef: 'repository-policy-owner',
            packetDigest: `sha256:${'a'.repeat(64)}`,
            resultDigest: `sha256:${'b'.repeat(64)}`,
            resultRecordProfile: 'core-ui-advisory-review-result-v1',
            resultRecordRef: 'fabricated-review-result',
            reviewerIdentity: 'fabricated-reviewer',
            role: 'core-ui-schema-catalog-reviewer',
          }];
        },
      ]) {
        const workflow = clone(originalWorkflow);
        mutate(workflow);
        const bytes = `${canonicalJson(workflow)}\n`;
        await writeFile(workflowPath, bytes);
        workflowInput.identity.byteLength = Buffer.byteLength(bytes);
        workflowInput.identity.digest = sha256Digest(bytes);
        await writeFile(manifestPath, `${canonicalJson(invocation)}\n`);
        await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /DELIVERY_REVIEW_ASSIGNMENT_INVALID/);
      }
      const contradictoryAssignment = clone(originalWorkflow);
      contradictoryAssignment.reviews.requiredAssignments[0].reviewerIdentity = 'substituted-reviewer';
      const assignmentBytes = `${canonicalJson(contradictoryAssignment)}\n`;
      await writeFile(workflowPath, assignmentBytes);
      workflowInput.identity.byteLength = Buffer.byteLength(assignmentBytes);
      workflowInput.identity.digest = sha256Digest(assignmentBytes);
      await writeFile(manifestPath, `${canonicalJson(invocation)}\n`);
      assert.ok(assignmentInput);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /contradicts its preimage/);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}
