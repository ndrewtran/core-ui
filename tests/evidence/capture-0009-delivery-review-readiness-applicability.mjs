#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import {
  mkdir, readFile, rename, rm, rmdir, writeFile,
} from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { canonicalJson } from '../../tooling/audits/repository-policy/src/canonical-json.mjs';
import {
  assertReviewReadinessRoot,
  assertReviewReadinessSourceTopology,
  buildReviewReadinessRoot,
  hasReviewReadinessResidue,
  pathExists,
  REVIEW_READINESS_ROOT,
} from './delivery-review-readiness-applicability-profile.mjs';

const LOCK_NAME = '.delivery-review-readiness-lock';
const JOURNAL_NAME = '.delivery-review-readiness-journal.json';
const STAGING_PREFIX = '.delivery-review-readiness-authority-58-staging-';
const execFile = promisify(execFileCallback);

function fail(code, message, cause) {
  const error = new Error(`${code}: ${message}`, cause ? { cause } : undefined);
  error.code = code;
  throw error;
}

function canonicalBytes(value) {
  return canonicalJson(value);
}

async function syncFile(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeDurable(path, bytes) {
  await writeFile(path, bytes, { flag: 'wx' });
  await syncFile(path);
  await syncDirectory(dirname(path));
}

async function readCanonicalRecord(path, code, label) {
  const bytes = await readFile(path, 'utf8');
  let value;
  try {
    value = JSON.parse(bytes);
  } catch (error) {
    fail(code, `${label} is not valid JSON`, error);
  }
  if (canonicalBytes(value) !== bytes) fail(code, `${label} is not canonical JSON`);
  return value;
}

async function lockOwner(lockPath) {
  return readCanonicalRecord(
    join(lockPath, 'owner.json'),
    'DELIVERY_REVIEW_READINESS_LOCK_INVALID',
    'capture lock owner',
  );
}

function assertOwnerValue(owner) {
  if (owner === null || typeof owner !== 'object' || Array.isArray(owner)
      || canonicalJson(Object.keys(owner).sort()) !== canonicalJson(['pid', 'processStart', 'profile', 'sourceRevision', 'sourceTree', 'token'])
      || !Number.isSafeInteger(owner.pid) || owner.pid <= 0
      || typeof owner.processStart !== 'string' || owner.processStart.trim() === ''
      || owner.profile !== 'core-ui-delivery-review-readiness-capture-owner-v1'
      || !/^[0-9a-f]{40}$/u.test(owner.sourceRevision)
      || !/^[0-9a-f]{40}$/u.test(owner.sourceTree)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(owner.token)) {
    fail('DELIVERY_REVIEW_READINESS_LOCK_INVALID', 'capture lock owner is malformed');
  }
  return owner;
}

async function processIncarnation(pid) {
  try {
    return (await execFile('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' })).stdout.trim() || null;
  } catch (error) {
    if (error?.code === 1) return null;
    throw error;
  }
}

async function assertOwner(lockPath, owner) {
  const current = assertOwnerValue(await lockOwner(lockPath).catch(() => null));
  if (canonicalJson(current) !== canonicalJson(owner)) fail('DELIVERY_REVIEW_READINESS_OWNER_LOST', 'capture lock owner or incarnation changed');
}

async function acquireLock(evidenceRoot, owner) {
  const path = join(evidenceRoot, LOCK_NAME);
  try {
    await mkdir(path);
    await writeDurable(join(path, 'owner.json'), canonicalBytes(owner));
    return path;
  } catch (error) {
    if (error?.code === 'EEXIST') {
      const observed = assertOwnerValue(await lockOwner(path));
      const currentIncarnation = await processIncarnation(observed.pid);
      if (currentIncarnation === observed.processStart) fail('DELIVERY_REVIEW_READINESS_LOCKED', 'another capture owns the evidence publication lock');
      fail('DELIVERY_REVIEW_READINESS_RECOVERY_REQUIRED', 'a stale capture lock requires explicit recovery');
    }
    throw error;
  }
}

async function releaseLock(lockPath, owner) {
  await assertOwner(lockPath, owner);
  await rm(join(lockPath, 'owner.json'));
  await syncDirectory(lockPath);
  await rmdir(lockPath);
  await syncDirectory(dirname(lockPath));
}

function interruptAt(crash, point) {
  if (crash === point) process.kill(process.pid, 'SIGKILL');
}

async function writeStagedFiles(repositoryRoot, stagingRoot, files, owner, lockPath, fault, crash) {
  const rootPrefix = `${REVIEW_READINESS_ROOT}/`;
  let index = 0;
  for (const [repositoryPath, bytes] of [...files].sort(([left], [right]) => Buffer.from(left).compare(Buffer.from(right)))) {
    await assertOwner(lockPath, owner);
    const localPath = repositoryPath.slice(rootPrefix.length);
    const destination = join(stagingRoot, localPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeDurable(destination, bytes);
    index += 1;
    if (fault === `after-file-${index}`) fail('DELIVERY_REVIEW_READINESS_FAULT', `injected fault after file ${index}`);
    interruptAt(crash, `after-file-${index}`);
  }
  await syncDirectory(stagingRoot);
  await assertReviewReadinessRoot(repositoryRoot, stagingRoot);
}

async function rollbackAttempt({ finalRoot, journalPath, published, stagingRoot }) {
  const failures = [];
  for (const [path, options] of [
    [published ? finalRoot : null, { force: true, recursive: true }],
    [stagingRoot, { force: true, recursive: true }],
    [journalPath, { force: true }],
  ]) {
    if (!path) continue;
    await rm(path, options).catch((error) => failures.push(error));
  }
  if (failures.length) fail('DELIVERY_REVIEW_READINESS_ROLLBACK_FAILED', 'partial publication rollback failed', failures[0]);
}

async function recoverAbandonedLock({ evidenceRoot, finalRoot, repositoryRoot, sourceRevision, sourceTree }) {
  const lockPath = join(evidenceRoot, LOCK_NAME);
  if (!await pathExists(lockPath)) return false;
  const owner = assertOwnerValue(await lockOwner(lockPath));
  if (owner.sourceRevision !== sourceRevision || owner.sourceTree !== sourceTree) {
    fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'stale capture lock binds another source');
  }
  if (await processIncarnation(owner.pid) === owner.processStart) {
    fail('DELIVERY_REVIEW_READINESS_LOCKED', 'the capture lock owner is still active');
  }
  const stagingRoot = join(evidenceRoot, `${STAGING_PREFIX}${owner.pid}`);
  if (await pathExists(stagingRoot) || await pathExists(finalRoot)) {
    fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'journal-free lock has publication residue');
  }
  await releaseLock(lockPath, owner);
  return true;
}

async function recoverInterruptedPublication({ evidenceRoot, finalRoot, journalPath, repositoryRoot, sourceRevision, sourceTree }) {
  if (!await pathExists(journalPath)) {
    return recoverAbandonedLock({ evidenceRoot, finalRoot, repositoryRoot, sourceRevision, sourceTree });
  }
  const journal = await readCanonicalRecord(
    journalPath,
    'DELIVERY_REVIEW_READINESS_RECOVERY_INVALID',
    'capture journal',
  );
  if (journal === null || typeof journal !== 'object' || Array.isArray(journal)
      || canonicalJson(Object.keys(journal).sort()) !== canonicalJson(['finalRoot', 'owner', 'profile', 'stagingRoot', 'timestamp'])
      || journal.profile !== 'core-ui-delivery-review-readiness-capture-journal-v1'
      || journal.finalRoot !== REVIEW_READINESS_ROOT) {
    fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'capture journal is malformed');
  }
  const owner = assertOwnerValue(journal.owner);
  if (owner.sourceRevision !== sourceRevision || owner.sourceTree !== sourceTree) {
    fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'capture journal binds another source');
  }
  const expectedStaging = relative(repositoryRoot, join(evidenceRoot, `${STAGING_PREFIX}${owner.pid}`));
  if (journal.stagingRoot !== expectedStaging) fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'capture journal staging path is not owner-derived');
  const lockPath = join(evidenceRoot, LOCK_NAME);
  const observed = assertOwnerValue(await lockOwner(lockPath));
  if (canonicalJson(observed) !== canonicalJson(owner)) fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'capture journal and lock owner disagree');
  if (await processIncarnation(owner.pid) === owner.processStart) fail('DELIVERY_REVIEW_READINESS_LOCKED', 'the journal owner is still active');
  const stagingRoot = join(repositoryRoot, journal.stagingRoot);
  let published = false;
  if (await pathExists(finalRoot)) {
    const result = await assertReviewReadinessRoot(repositoryRoot, finalRoot);
    if (result.index.sourceRevision !== sourceRevision || result.index.sourceTree !== sourceTree) {
      fail('DELIVERY_REVIEW_READINESS_RECOVERY_INVALID', 'published root binds another source');
    }
    published = true;
  }
  await rollbackAttempt({ finalRoot, journalPath, published, stagingRoot });
  await releaseLock(lockPath, owner);
  return true;
}

export async function captureReviewReadiness({
  check = false,
  crash = null,
  fault = null,
  repositoryRoot,
  sourceRevision,
  sourceTree,
  timestamp,
}) {
  const evidenceRoot = join(repositoryRoot, 'tests/evidence');
  const finalRoot = join(repositoryRoot, REVIEW_READINESS_ROOT);
  const journalPath = join(evidenceRoot, JOURNAL_NAME);
  if (check) {
    const result = await assertReviewReadinessRoot(repositoryRoot, finalRoot);
    const residue = await hasReviewReadinessResidue(repositoryRoot);
    if (residue.length) fail('DELIVERY_REVIEW_READINESS_RESIDUE', `capture residue remains: ${residue.join(', ')}`);
    if (result.index.sourceRevision !== sourceRevision || result.index.sourceTree !== sourceTree) fail('DELIVERY_REVIEW_READINESS_SOURCE_MISMATCH', 'retained root binds another source');
    return result;
  }
  await assertReviewReadinessSourceTopology(repositoryRoot, sourceRevision, sourceTree);
  await recoverInterruptedPublication({ evidenceRoot, finalRoot, journalPath, repositoryRoot, sourceRevision, sourceTree });
  if (await pathExists(finalRoot)) {
    const result = await assertReviewReadinessRoot(repositoryRoot, finalRoot);
    const residue = await hasReviewReadinessResidue(repositoryRoot);
    if (residue.length) fail('DELIVERY_REVIEW_READINESS_RESIDUE', `capture residue remains: ${residue.join(', ')}`);
    if (result.index.sourceRevision !== sourceRevision || result.index.sourceTree !== sourceTree) fail('DELIVERY_REVIEW_READINESS_DESTINATION_EXISTS', 'destination exists for another source');
    return result;
  }
  const owner = {
    pid: process.pid,
    processStart: await processIncarnation(process.pid),
    profile: 'core-ui-delivery-review-readiness-capture-owner-v1',
    sourceRevision,
    sourceTree,
    token: randomUUID(),
  };
  const lockPath = await acquireLock(evidenceRoot, owner);
  interruptAt(crash, 'after-lock');
  const stagingRoot = join(evidenceRoot, `${STAGING_PREFIX}${process.pid}`);
  let published = false;
  let primaryError = null;
  try {
    if (await pathExists(stagingRoot)) fail('DELIVERY_REVIEW_READINESS_STAGING_EXISTS', 'capture staging path already exists');
    const journal = {
      finalRoot: REVIEW_READINESS_ROOT,
      owner,
      profile: 'core-ui-delivery-review-readiness-capture-journal-v1',
      stagingRoot: relative(repositoryRoot, stagingRoot),
      timestamp,
    };
    await writeDurable(journalPath, canonicalBytes(journal));
    if (fault === 'after-journal') fail('DELIVERY_REVIEW_READINESS_FAULT', 'injected fault after journal');
    interruptAt(crash, 'after-journal');
    const files = await buildReviewReadinessRoot(repositoryRoot, { sourceRevision, sourceTree, timestamp });
    await mkdir(stagingRoot);
    await syncDirectory(evidenceRoot);
    await writeStagedFiles(repositoryRoot, stagingRoot, files, owner, lockPath, fault, crash);
    if (fault === 'before-publish') fail('DELIVERY_REVIEW_READINESS_FAULT', 'injected fault before publish');
    interruptAt(crash, 'before-publish');
    await assertOwner(lockPath, owner);
    await rename(stagingRoot, finalRoot);
    published = true;
    await syncDirectory(evidenceRoot);
    if (fault === 'after-publish') fail('DELIVERY_REVIEW_READINESS_FAULT', 'injected fault after publish');
    interruptAt(crash, 'after-publish');
    const result = await assertReviewReadinessRoot(repositoryRoot, finalRoot);
    await rm(journalPath);
    await syncDirectory(evidenceRoot);
    await releaseLock(lockPath, owner);
    return result;
  } catch (error) {
    primaryError = error;
    try {
      await rollbackAttempt({ finalRoot, journalPath, published, stagingRoot });
      if (await pathExists(lockPath)) await releaseLock(lockPath, owner);
    } catch (rollbackError) {
      fail('DELIVERY_REVIEW_READINESS_ROLLBACK_FAILED', rollbackError.message, primaryError);
    }
    throw primaryError;
  }
}

function parseArguments(argv) {
  const values = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--check') values.check = true;
    else if (['--source', '--tree', '--timestamp'].includes(key) && argv[index + 1]) {
      values[key.slice(2)] = argv[index + 1];
      index += 1;
    } else fail('DELIVERY_REVIEW_READINESS_ARGUMENT_INVALID', `unknown or incomplete argument ${key}`);
  }
  if (!values.source || !values.tree || !values.timestamp) fail('DELIVERY_REVIEW_READINESS_ARGUMENT_INVALID', '--source, --tree, and --timestamp are required');
  return values;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const result = await captureReviewReadiness({
      check: args.check,
      repositoryRoot: process.cwd(),
      sourceRevision: args.source,
      sourceTree: args.tree,
      timestamp: args.timestamp,
    });
    process.stdout.write(`${canonicalJson({
      fileCount: result.fileCount,
      indexSha256: result.indexSha256,
      profile: 'core-ui-delivery-review-readiness-capture-result-v1',
      sourceRevision: result.index.sourceRevision,
      sourceTree: result.index.sourceTree,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
