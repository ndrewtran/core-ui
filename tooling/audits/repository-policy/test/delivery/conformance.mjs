import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canonicalJson, sha256Digest } from '@core-ui/schema';
import { evaluateDeliveryInvocation } from '../../src/delivery-conformance.mjs';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { clone, writeAdvisoryFixture } from './fixtures.mjs';

const writeInvocation = (path, value) => writeFile(path, `${canonicalJson(value)}\n`);

export function registerConformanceTests(repositoryRoot) {
  test('E-DELIVERY-04 validates raw invocation preimages and derives conformance after packet identity', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'core-ui-advisory-'));
    try {
      const contract = await loadDeliveryProfile(repositoryRoot);
      const { invocation } = await writeAdvisoryFixture(contract, repositoryRoot, directory);
      const manifestPath = join(directory, 'invocation.json');
      await writeInvocation(manifestPath, invocation);
      const first = await evaluateDeliveryInvocation(repositoryRoot, manifestPath);
      const second = await evaluateDeliveryInvocation(repositoryRoot, manifestPath);
      assert.deepEqual(first.identity, second.identity);
      assert.equal(first.payload.status, 'satisfied');
      assert.equal(first.payload.operationalApplicability.status, 'not-applicable');
      assert.equal(first.payload.packetIdentity.digest, first.packet.envelope.digest);
      assert.equal('conformanceIdentity' in first.packet.packet, false);
      assert.equal('handoffIdentity' in first.packet.packet, false);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test('E-DELIVERY-04 rejects stale, noncanonical, missing, traversal, and symlink-escape inputs before dispatch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'core-ui-advisory-negative-'));
    const outside = await mkdtemp(join(tmpdir(), 'core-ui-advisory-outside-'));
    try {
      const contract = await loadDeliveryProfile(repositoryRoot);
      const { invocation } = await writeAdvisoryFixture(contract, repositoryRoot, directory);
      const manifestPath = join(directory, 'invocation.json');
      const stale = clone(invocation);
      stale.authorityIdentities[0].digest = `sha256:${'f'.repeat(64)}`;
      await writeInvocation(manifestPath, stale);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /DELIVERY_INVOCATION_STALE/);
      for (const evaluationTime of ['August 12, 2026', '2026-08-12T12:30:00', '2026-02-30T12:30:00Z']) {
        const invalidTime = clone(invocation);
        invalidTime.evaluationTime = evaluationTime;
        await writeInvocation(manifestPath, invalidTime);
        await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /RFC 3339/);
      }
      const contradictorySource = clone(invocation);
      contradictorySource.repositorySource.commit = 'c'.repeat(40);
      contradictorySource.repositorySource.tree = 'd'.repeat(40);
      await writeInvocation(manifestPath, contradictorySource);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /repository source contradicts/);
      const duplicateIdentity = clone(invocation);
      const workflowInput = duplicateIdentity.inputs.find(({ slot }) => slot === 'workflowRecord');
      const conflictingWorkflow = JSON.parse(await readFile(join(directory, workflowInput.locator), 'utf8'));
      conflictingWorkflow.authority.evidenceIds.push('E-DELIVERY-02');
      const conflictingBytes = `${canonicalJson(conflictingWorkflow)}\n`;
      await writeFile(join(directory, 'workflow-record-collision.json'), conflictingBytes);
      duplicateIdentity.inputs.push({
        identity: {
          ...workflowInput.identity,
          byteLength: Buffer.byteLength(conflictingBytes),
          digest: sha256Digest(conflictingBytes),
        },
        locator: 'workflow-record-collision.json',
        slot: 'preimage.workflow-record-collision',
      });
      await writeInvocation(manifestPath, duplicateIdentity);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /identity IDs must be unique/);
      const duplicateLocator = clone(invocation);
      const sourceInput = duplicateLocator.inputs.find(({ slot }) => slot === 'preimage.source');
      duplicateLocator.inputs.push({
        identity: { ...sourceInput.identity, id: 'source-alias' },
        locator: sourceInput.locator,
        slot: 'preimage.source-alias',
      });
      await writeInvocation(manifestPath, duplicateLocator);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /locators must be unique/);
      const submillisecondExpiry = clone(invocation);
      submillisecondExpiry.evaluationTime = '2099-01-01T00:00:00.0001Z';
      await writeInvocation(manifestPath, submillisecondExpiry);
      const expired = await evaluateDeliveryInvocation(repositoryRoot, manifestPath);
      assert.equal(expired.payload.status, 'unsatisfied');
      assert.ok(expired.payload.failedRuleIds.includes('DISCLOSURE_VALID'));
      await writeFile(manifestPath, `${JSON.stringify(invocation, null, 2)}\n`);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /must be canonical/);
      const missing = clone(invocation);
      missing.inputs[0].locator = 'missing.json';
      await writeInvocation(manifestPath, missing);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /preimage is missing/);
      const traversal = clone(invocation);
      traversal.inputs[0].locator = '../outside.json';
      await writeInvocation(manifestPath, traversal);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /DELIVERY_SCHEMA_INVALID|DELIVERY_INVOCATION_UNSAFE/);
      await writeFile(join(outside, 'outside.json'), await readFile(join(directory, invocation.inputs[0].locator)));
      await symlink(join(outside, 'outside.json'), join(directory, 'escaped.json'));
      const escaped = clone(invocation);
      escaped.inputs[0].locator = 'escaped.json';
      await writeInvocation(manifestPath, escaped);
      await assert.rejects(() => evaluateDeliveryInvocation(repositoryRoot, manifestPath), /resolves outside/);
    } finally {
      await rm(directory, { force: true, recursive: true });
      await rm(outside, { force: true, recursive: true });
    }
  });
}
