import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { canonicalJson } from '../../tooling/audits/repository-policy/src/canonical-json.mjs';
import { captureReviewReadiness } from './capture-0009-delivery-review-readiness-applicability.mjs';
import {
  assertReviewReadinessAcceptance,
  assertReviewReadinessRoot,
  buildReviewReadinessRoot,
  hasReviewReadinessResidue,
  REVIEW_READINESS_ACCEPTANCE,
  REVIEW_READINESS_DECISION,
  REVIEW_READINESS_EVIDENCE,
  REVIEW_READINESS_PROTECTED_MERGE,
  REVIEW_READINESS_ROOT,
  REVIEW_READINESS_SOURCE,
  REVIEW_READINESS_TARGETS,
  resolveReviewReadinessSourceIdentity,
  reviewReadinessTargetManifest,
} from './delivery-review-readiness-applicability-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');

async function git(root, args) {
  return (await execFile('git', args, { cwd: root, encoding: 'utf8' })).stdout.trim();
}

async function sourceIdentity() {
  return resolveReviewReadinessSourceIdentity(repositoryRoot);
}

async function cloneSource(sourceRevision) {
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-review-readiness-test-'));
  const root = join(parent, 'repository');
  await execFile('git', ['clone', '--quiet', '--shared', repositoryRoot, root]);
  await git(root, ['checkout', '--quiet', sourceRevision]);
  return { parent, root };
}

async function runInterruptedCapture(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

test('delivery review readiness authority receipt and 29-target topology are closed and deterministic', async () => {
  const acceptance = JSON.parse(await readFile(join(repositoryRoot, REVIEW_READINESS_ACCEPTANCE), 'utf8'));
  assert.doesNotThrow(() => assertReviewReadinessAcceptance(acceptance));
  const targets = await reviewReadinessTargetManifest(repositoryRoot);
  assert.equal(targets.length, 29);
  assert.deepEqual(targets.map(({ name }) => name), REVIEW_READINESS_TARGETS);
  assert.equal(targets.find(({ name }) => name === 'g1.2').predecessor.previousSupersession, undefined);
  assert.ok(targets.filter(({ name }) => name !== 'g1.2').every(({ predecessor }) => predecessor.previousSupersession));
  const source = await sourceIdentity();
  const first = await buildReviewReadinessRoot(repositoryRoot, { ...source, timestamp: '2026-08-12T12:30:00Z' });
  const second = await buildReviewReadinessRoot(repositoryRoot, { ...source, timestamp: '2026-08-12T12:30:00Z' });
  assert.deepEqual([...first], [...second]);
  assert.equal(first.size, 30);
});

test('delivery review readiness source resolution admits accepted history and protected descendants', async () => {
  const source = await sourceIdentity();
  const parent = await mkdtemp(join(tmpdir(), 'core-ui-review-readiness-checkout-'));
  const root = join(parent, 'repository');
  try {
    await execFile('git', ['clone', '--quiet', '--shared', repositoryRoot, root]);
    await git(root, ['config', 'user.name', 'Fixture']);
    await git(root, ['config', 'user.email', 'fixture@example.invalid']);

    for (const revision of [REVIEW_READINESS_SOURCE, REVIEW_READINESS_EVIDENCE, REVIEW_READINESS_PROTECTED_MERGE]) {
      await git(root, ['switch', '--quiet', '--detach', revision]);
      assert.deepEqual(await resolveReviewReadinessSourceIdentity(root), source);
    }

    await git(root, ['commit', '--quiet', '--allow-empty', '-m', 'ordinary descendant']);
    assert.deepEqual(await resolveReviewReadinessSourceIdentity(root), source);

    await git(root, ['switch', '--quiet', '--detach', REVIEW_READINESS_EVIDENCE]);
    await git(root, ['commit', '--quiet', '--allow-empty', '-m', 'non-protected descendant']);
    await assert.rejects(() => resolveReviewReadinessSourceIdentity(root), /must descend from the protected Decision 0009 merge/);

    await git(root, ['switch', '--quiet', '--detach', REVIEW_READINESS_PROTECTED_MERGE]);
    await writeFile(join(root, REVIEW_READINESS_DECISION), '{}\n');
    await git(root, ['add', REVIEW_READINESS_DECISION]);
    await git(root, ['commit', '--quiet', '-m', 'decision drift']);
    await assert.rejects(() => resolveReviewReadinessSourceIdentity(root), /Decision 0009 record identity/);

    await git(root, ['switch', '--quiet', '--detach', REVIEW_READINESS_PROTECTED_MERGE]);
    await writeFile(join(root, REVIEW_READINESS_ACCEPTANCE), '{}\n');
    await git(root, ['add', REVIEW_READINESS_ACCEPTANCE]);
    await git(root, ['commit', '--quiet', '-m', 'acceptance drift']);
    await assert.rejects(() => resolveReviewReadinessSourceIdentity(root), /Decision 0009 acceptance receipt identity/);

    await git(root, ['switch', '--quiet', '--detach', REVIEW_READINESS_PROTECTED_MERGE]);
    await writeFile(join(root, REVIEW_READINESS_ROOT, 'drift.json'), '{}\n');
    await git(root, ['add', REVIEW_READINESS_ROOT]);
    await git(root, ['commit', '--quiet', '-m', 'retained evidence drift']);
    await assert.rejects(() => resolveReviewReadinessSourceIdentity(root), /authority-58 evidence root/);
  } finally {
    await rm(parent, { force: true, recursive: true });
  }
});

test('delivery review readiness capture is atomic, retry-identical, and checkable', async () => {
  const source = await sourceIdentity();
  const clone = await cloneSource(source.sourceRevision);
  try {
    const options = { ...source, repositoryRoot: clone.root, timestamp: '2026-08-12T12:30:00Z' };
    const first = await captureReviewReadiness(options);
    const retry = await captureReviewReadiness(options);
    const checked = await captureReviewReadiness({ ...options, check: true });
    assert.equal(first.fileCount, 30);
    assert.equal(first.indexSha256, retry.indexSha256);
    assert.equal(first.indexSha256, checked.indexSha256);
    assert.deepEqual(await hasReviewReadinessResidue(clone.root), []);
    await assertReviewReadinessRoot(clone.root);
  } finally {
    await rm(clone.parent, { force: true, recursive: true });
  }
});

test('delivery review readiness capture rolls back every admitted crash point without residue', async () => {
  const source = await sourceIdentity();
  for (const fault of ['after-journal', 'after-file-1', 'before-publish', 'after-publish']) {
    const clone = await cloneSource(source.sourceRevision);
    try {
      await assert.rejects(() => captureReviewReadiness({
        ...source,
        fault,
        repositoryRoot: clone.root,
        timestamp: '2026-08-12T12:30:00Z',
      }), /DELIVERY_REVIEW_READINESS_FAULT/);
      assert.deepEqual(await hasReviewReadinessResidue(clone.root), []);
      await assert.rejects(() => readFile(join(clone.root, REVIEW_READINESS_ROOT, 'index.json')), /ENOENT/);
    } finally {
      await rm(clone.parent, { force: true, recursive: true });
    }
  }
});

test('delivery review readiness capture recovers every abrupt interruption before retry', async () => {
  const source = await sourceIdentity();
  for (const crash of ['after-lock', 'after-journal', 'after-file-1', 'before-publish', 'after-publish']) {
    const clone = await cloneSource(source.sourceRevision);
    try {
      const options = { ...source, crash, repositoryRoot: clone.root, timestamp: '2026-08-12T12:30:00Z' };
      const script = `import { captureReviewReadiness } from ${JSON.stringify(new URL('./capture-0009-delivery-review-readiness-applicability.mjs', import.meta.url).href)}; await captureReviewReadiness(${JSON.stringify(options)});`;
      assert.deepEqual(await runInterruptedCapture(script), { code: null, signal: 'SIGKILL' });
      const recovered = await captureReviewReadiness({ ...options, crash: null });
      assert.equal(recovered.fileCount, 30);
      assert.deepEqual(await hasReviewReadinessResidue(clone.root), []);
    } finally {
      await rm(clone.parent, { force: true, recursive: true });
    }
  }
});

test('delivery review readiness capture rejects contenders, wrong source, pre-existing output, and false provenance', async () => {
  const source = await sourceIdentity();
  const clone = await cloneSource(source.sourceRevision);
  try {
    const evidenceRoot = join(clone.root, 'tests/evidence');
    const contenderLock = join(evidenceRoot, '.delivery-review-readiness-lock');
    await mkdir(contenderLock);
    const processStart = (await execFile('ps', ['-o', 'lstart=', '-p', String(process.pid)])).stdout.trim();
    await writeFile(join(contenderLock, 'owner.json'), canonicalJson({
      pid: process.pid,
      processStart,
      profile: 'core-ui-delivery-review-readiness-capture-owner-v1',
      sourceRevision: source.sourceRevision,
      sourceTree: source.sourceTree,
      token: '00000000-0000-4000-8000-000000000000',
    }));
    await assert.rejects(() => captureReviewReadiness({ ...source, repositoryRoot: clone.root, timestamp: '2026-08-12T12:30:00Z' }), /LOCKED/);
    await rm(contenderLock, { recursive: true });
    await assert.rejects(() => captureReviewReadiness({
      repositoryRoot: clone.root,
      sourceRevision: '0'.repeat(40),
      sourceTree: source.sourceTree,
      timestamp: '2026-08-12T12:30:00Z',
    }));
    await mkdir(join(clone.root, REVIEW_READINESS_ROOT), { recursive: true });
    await writeFile(join(clone.root, REVIEW_READINESS_ROOT, 'index.json'), '{}');
    await assert.rejects(() => captureReviewReadiness({ ...source, repositoryRoot: clone.root, timestamp: '2026-08-12T12:30:00Z' }), /PROFILE_INVALID/);
    await rm(join(clone.root, REVIEW_READINESS_ROOT), { recursive: true });
    const receiptPath = join(clone.root, REVIEW_READINESS_ACCEPTANCE);
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    receipt.taskProvenance.githubCommentClaimed = true;
    await writeFile(receiptPath, canonicalJson(receipt));
    await assert.rejects(() => captureReviewReadiness({ ...source, repositoryRoot: clone.root, timestamp: '2026-08-12T12:30:00Z' }), /task provenance/);
    assert.deepEqual(await hasReviewReadinessResidue(clone.root), []);
  } finally {
    await rm(clone.parent, { force: true, recursive: true });
  }
});
