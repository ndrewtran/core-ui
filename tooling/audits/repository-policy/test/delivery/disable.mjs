import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

export function registerDisableTests(repositoryRoot) {
  test('E-DELIVERY-07 rollback production code renders recovery but owns no process execution', async () => {
    const source = await readFile(join(repositoryRoot, 'tooling/audits/repository-policy/src/delivery-rollback.mjs'), 'utf8');
    assert.equal(/node:child_process|execFile|spawn|graphql|fetch\(|writeFile|unlink|rename|mkdir|chmod|\brm\(/.test(source), false);
    assert.match(source, /DELIVERY_ROLLBACK_INCOMPLETE/);
    assert.match(source, /remainingRecoverySteps/);
  });

  test('E-DELIVERY-07 rollback partition is exact, disjoint, duplicate-free, and preserves historical applicability', async () => {
    const profile = JSON.parse(await readFile(join(repositoryRoot, 'tooling/audits/repository-policy/delivery-workflow-profile.json'), 'utf8'));
    const removable = Object.values(profile.recoveryStepPaths).flat();
    assert.equal(new Set(removable).size, removable.length);
    assert.equal(new Set(profile.recoveryPreservedPaths).size, profile.recoveryPreservedPaths.length);
    assert.deepEqual(removable.filter((path) => profile.recoveryPreservedPaths.includes(path)), []);
    assert.ok(profile.recoveryPreservedPaths.includes('tooling/audits/repository-policy/src/evidence-verify.mjs'));
    assert.ok(profile.recoveryPreservedPaths.includes('tests/evidence/delivery-review-readiness-applicability-profile.mjs'));
  });
}
