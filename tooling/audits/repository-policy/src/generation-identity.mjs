import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { walkFiles } from './policy.mjs';
import { verifyGenerationState } from './generation-proof.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

async function snapshot(cleanRoot) {
  const files = (await walkFiles(cleanRoot))
    .filter((path) => path !== '.git' && !path.startsWith('.git/'))
    .sort();
  const digest = createHash('sha256');
  for (const path of files) {
    digest.update(path);
    digest.update('\0');
    digest.update(await readFile(resolve(cleanRoot, path)));
    digest.update('\0');
  }
  return digest.digest('hex');
}

function run(command, args, cwd, stdio = 'inherit') {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command.toUpperCase()}_FAILED: ${result.stderr?.trim() || `exit ${result.status}`}`,
    );
  }
  return result.stdout ?? '';
}

function generate(cleanRoot) {
  const result = spawnSync(
    process.execPath,
    [
      resolve(cleanRoot, 'tooling/audits/repository-policy/src/run-workspace-task.mjs'),
      'generate',
    ],
    { cwd: cleanRoot, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`GENERATION_COMMAND_FAILED: exit ${result.status ?? 1}`);
  }
}

function status(cleanRoot) {
  return run(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    cleanRoot,
    'pipe',
  );
}

const sourceRevision = run('git', ['rev-parse', 'HEAD'], repositoryRoot, 'pipe').trim();
const temporaryRoot = await mkdtemp(join(tmpdir(), 'core-ui-generation-proof-'));
const cleanRoot = join(temporaryRoot, 'checkout');

try {
  run('git', ['worktree', 'add', '--quiet', '--detach', cleanRoot, sourceRevision], repositoryRoot);
  const beforeDigest = await snapshot(cleanRoot);
  generate(cleanRoot);
  const firstDigest = await snapshot(cleanRoot);
  const firstStatus = status(cleanRoot);
  generate(cleanRoot);
  const secondDigest = await snapshot(cleanRoot);
  const secondStatus = status(cleanRoot);

  verifyGenerationState({
    beforeDigest,
    firstDigest,
    secondDigest,
    firstStatus,
    secondStatus,
  });

  console.log(
    `[E-G0.0-04] isolated clean checkout ${sourceRevision} remained clean after two `
      + `generation runs (sha256:${secondDigest})`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  spawnSync('git', ['worktree', 'remove', '--force', cleanRoot], {
    cwd: repositoryRoot,
    stdio: 'ignore',
  });
  await rm(temporaryRoot, { recursive: true, force: true });
}
