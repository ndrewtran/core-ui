import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { canonicalJson } from '@core-ui/schema';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { writeAdvisoryFixture } from './fixtures.mjs';

const execFileAsync = promisify(execFile);

async function invoke(repositoryRoot, manifestPath) {
  try {
    const result = await execFileAsync(process.execPath, [
      'tooling/audits/repository-policy/src/delivery-advisory.mjs',
      '--invocation',
      manifestPath,
    ], { cwd: repositoryRoot, encoding: 'utf8' });
    return { exitCode: 0, stderr: result.stderr, stdout: result.stdout };
  } catch (error) {
    return { exitCode: error.code, stderr: error.stderr, stdout: error.stdout };
  }
}

export function registerAdvisoryTests(repositoryRoot) {
  test('E-DELIVERY-06 emits byte-identical fresh-process output with closed exit semantics', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'core-ui-advisory-process-'));
    try {
      const contract = await loadDeliveryProfile(repositoryRoot);
      const satisfied = await writeAdvisoryFixture(contract, repositoryRoot, directory);
      const manifestPath = join(directory, 'invocation.json');
      await writeFile(manifestPath, `${canonicalJson(satisfied.invocation)}\n`);
      const first = await invoke(repositoryRoot, manifestPath);
      const second = await invoke(repositoryRoot, manifestPath);
      assert.deepEqual(first, second);
      assert.equal(first.exitCode, 0);
      assert.equal(JSON.parse(first.stdout).status, 'satisfied');
      const malformedPath = join(directory, 'malformed.json');
      await writeFile(malformedPath, '{');
      const malformed = await invoke(repositoryRoot, malformedPath);
      assert.equal(malformed.exitCode, 2);
      assert.equal(malformed.stdout, '');
      assert.match(malformed.stderr, /DELIVERY_ADVISORY_INTERNAL|DELIVERY_INVOCATION_INVALID/);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test('E-DELIVERY-06 returns one for valid unsatisfied input and never dispatches', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'core-ui-advisory-unsatisfied-'));
    try {
      const contract = await loadDeliveryProfile(repositoryRoot);
      const { invocation } = await writeAdvisoryFixture(contract, repositoryRoot, directory, { exitState: 1 });
      const manifestPath = join(directory, 'invocation.json');
      await writeFile(manifestPath, `${canonicalJson(invocation)}\n`);
      const result = await invoke(repositoryRoot, manifestPath);
      assert.equal(result.exitCode, 1);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'unsatisfied');
      assert.equal(output.nonDispatchRewindOperation, 'REWIND_TO_FAILED_CONFORMANCE_OWNER');
      assert.equal('dispatch' in output, false);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}
