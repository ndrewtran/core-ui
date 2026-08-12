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
}
