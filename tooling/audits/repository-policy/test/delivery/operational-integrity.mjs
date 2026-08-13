import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';

const MODULES = [
  'tooling/audits/repository-policy/src/delivery-packet.mjs',
  'tooling/audits/repository-policy/src/delivery-conformance.mjs',
  'tooling/audits/repository-policy/src/delivery-handoff.mjs',
  'tooling/audits/repository-policy/src/delivery-advisory.mjs',
  'tooling/audits/repository-policy/src/delivery-rollback.mjs',
];

export function registerOperationalIntegrityTests(repositoryRoot) {
  test('E-DELIVERY-08 admits operational N/A only for the read-only advisory and human-render-only rollback', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    assert.equal(contract.profile.operationalProofContract.noRuntimeMutationReason, 'NO_RUNTIME_MUTATION');
    assert.equal(contract.profile.operationalProofContract.humanRenderOnlyReason, 'HUMAN_RENDER_ONLY_ROLLBACK');
    for (const path of MODULES) {
      const source = await readFile(`${repositoryRoot}/${path}`, 'utf8');
      assert.doesNotMatch(source, /\b(?:writeFile|appendFile|rename|rm|mkdir|spawn|execFile|fetch)\s*\(/u);
    }
    const advisory = await readFile(`${repositoryRoot}/tooling/audits/repository-policy/src/delivery-advisory.mjs`, 'utf8');
    assert.doesNotMatch(advisory, /https?:|dispatch|process\.chdir/u);
  });
}
