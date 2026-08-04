import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { classifyPath, loadPolicy, normalizePath, walkFiles } from './policy.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

async function snapshot() {
  const trackedResult = spawnSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (trackedResult.status !== 0) {
    throw new Error(`GIT_INDEX_UNAVAILABLE: ${trackedResult.stderr.trim()}`);
  }
  const policy = await loadPolicy(repositoryRoot);
  const tracked = trackedResult.stdout.split('\0').map(normalizePath).filter(Boolean);
  const projections = (await walkFiles(repositoryRoot)).filter(
    (path) => classifyPath(path, policy) === 'projection',
  );
  const files = [...new Set([...tracked, ...projections])].sort();
  const digest = createHash('sha256');
  for (const path of files) {
    digest.update(path);
    digest.update('\0');
    digest.update(await readFile(resolve(repositoryRoot, path)));
    digest.update('\0');
  }
  return digest.digest('hex');
}

function generate() {
  const result = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, 'run-workspace-task.mjs'), 'generate'],
    { cwd: repositoryRoot, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const before = await snapshot();
generate();
const first = await snapshot();
generate();
const second = await snapshot();

if (before !== first) {
  console.error(
    'GENERATION_DRIFT: generation changed the worktree; repair the earliest source and commit its projection',
  );
  process.exit(1);
}
if (first !== second) {
  console.error('GENERATION_NONDETERMINISTIC: repeated generation produced a different repository digest');
  process.exit(1);
}

console.log(`[E-G0.0-04] repeated generation is a no-op (sha256:${second})`);
