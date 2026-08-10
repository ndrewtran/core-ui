import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const capturePath = 'tests/evidence/capture-authority-39-phase-c-applicability-topology-supersessions.mjs';
const outputPath = 'tests/evidence/authority-39-phase-c-applicability-topology';

function git(args, cwd = repositoryRoot) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runCapture(cwd, sourceRevision, environment = {}) {
  return spawnSync(process.execPath, [capturePath, '--source', sourceRevision], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
}

function directoryDigest(root) {
  const entries = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else entries.push(`${path.relative(root, absolutePath)}\0${createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex')}`);
    }
  }
  visit(root);
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}

function addWorktree(parent, name, sourceRevision) {
  const worktree = path.join(parent, name);
  git(['worktree', 'add', '--detach', worktree, sourceRevision]);
  execFileSync('pnpm', ['install', '--offline', '--frozen-lockfile'], {
    cwd: worktree,
    encoding: 'utf8',
    stdio: 'ignore',
  });
  return worktree;
}

function removeWorktree(worktree) {
  try {
    git(['worktree', 'remove', '--force', worktree]);
  } catch {
    fs.rmSync(worktree, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
}

test('Decision 0006 authority capture is atomic, recoverable, confined, and check-only', { timeout: 120_000 }, () => {
  const retainedIndex = path.join(repositoryRoot, outputPath, 'index.json');
  const sourceRevision = fs.existsSync(retainedIndex)
    ? JSON.parse(fs.readFileSync(retainedIndex, 'utf8')).sourceRevision
    : git(['rev-parse', 'HEAD']);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'core-ui-phase-c-authority-capture-'));
  const atomicWorktree = addWorktree(temporary, 'atomic', sourceRevision);
  const dirtyWorktree = addWorktree(temporary, 'dirty', sourceRevision);

  try {
    const failed = runCapture(atomicWorktree, sourceRevision, {
      CORE_UI_TEST_PHASE_C_AUTHORITY_CAPTURE_FAIL_AFTER: '3',
    });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /EVIDENCE_SUPERSESSION_TEST_FAILURE/);
    assert.equal(fs.existsSync(path.join(atomicWorktree, outputPath)), false);
    assert.deepEqual(
      fs.readdirSync(path.join(atomicWorktree, 'tests/evidence')).filter((name) => name.startsWith('.authority-39-phase-c-applicability-topology.stage-')),
      [],
    );

    const retry = runCapture(atomicWorktree, sourceRevision);
    assert.equal(retry.status, 0, retry.stderr);
    const capturedRoot = path.join(atomicWorktree, outputPath);
    assert.equal(fs.existsSync(path.join(capturedRoot, 'index.json')), true);

    const beforeCheck = directoryDigest(capturedRoot);
    const check = spawnSync(process.execPath, [capturePath, '--check'], { cwd: atomicWorktree, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
    assert.equal(directoryDigest(capturedRoot), beforeCheck);

    const existing = runCapture(atomicWorktree, sourceRevision);
    assert.notEqual(existing.status, 0);
    assert.match(existing.stderr, /EVIDENCE_SUPERSESSION_OUTPUT_EXISTS/);

    fs.writeFileSync(path.join(dirtyWorktree, 'capture-dirty.txt'), 'intentional negative fixture\n');
    const dirty = runCapture(dirtyWorktree, sourceRevision);
    assert.notEqual(dirty.status, 0);
    assert.match(dirty.stderr, /EVIDENCE_SUPERSESSION_WORKTREE_DIRTY/);
    assert.equal(fs.existsSync(path.join(dirtyWorktree, outputPath)), false);
  } finally {
    removeWorktree(atomicWorktree);
    removeWorktree(dirtyWorktree);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
