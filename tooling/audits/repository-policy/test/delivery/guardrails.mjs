import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

export function registerGuardrailTests(repositoryRoot) {
  test('E-DELIVERY-08 keeps the workflow additive: no new root command, workflow, or package selector', async () => {
    const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'));
    assert.equal(Object.hasOwn(packageJson.scripts, 'delivery'), false);
    const policyPackage = JSON.parse(await readFile(join(repositoryRoot, 'tooling/audits/repository-policy/package.json'), 'utf8'));
    assert.equal(policyPackage.scripts.check.includes('test/*.test.mjs'), true);
    assert.equal(policyPackage.scripts.check.includes('delivery-workflow.test.mjs'), false);
    const continuationTest = '../../../tests/evidence/delivery-review-readiness-applicability-profile.test.mjs';
    assert.equal(policyPackage.scripts.check.split(continuationTest).length - 1, 1);
    assert.equal(policyPackage.scripts.check.includes('--invocation'), false);
    const ci = await readFile(join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
    assert.equal(ci.includes('delivery-workflow'), false);
    assert.equal(ci.includes('--invocation'), false);
  });
}
