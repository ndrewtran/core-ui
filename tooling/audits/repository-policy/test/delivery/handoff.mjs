import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canonicalJson } from '@core-ui/schema';
import { evaluateDeliveryInvocation } from '../../src/delivery-conformance.mjs';
import { deriveDeliveryHandoff } from '../../src/delivery-handoff.mjs';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { writeAdvisoryFixture } from './fixtures.mjs';

export function registerHandoffTests(repositoryRoot) {
  test('E-DELIVERY-06 derives a context-free guidance-only handoff bound to conformance', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'core-ui-handoff-'));
    try {
      const contract = await loadDeliveryProfile(repositoryRoot);
      const { invocation } = await writeAdvisoryFixture(contract, repositoryRoot, directory);
      const manifestPath = join(directory, 'invocation.json');
      await writeFile(manifestPath, `${canonicalJson(invocation)}\n`);
      const evaluation = await evaluateDeliveryInvocation(repositoryRoot, manifestPath);
      const first = deriveDeliveryHandoff(contract, evaluation);
      const second = deriveDeliveryHandoff(contract, evaluation);
      assert.deepEqual(first, second);
      assert.equal(first.payload.nextOperationId, 'DISPATCH_ADVISORY_REVIEW');
      assert.equal(first.payload.conformanceIdentity.digest, evaluation.identity.digest);
      for (const prohibited of ['approval', 'objective', 'prompt', 'writeAuthority']) assert.equal(prohibited in first.payload, false);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}
