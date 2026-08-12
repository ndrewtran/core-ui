import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  G12_ASSERTIONS,
  G12_MAINTENANCE_ROOT,
  G12_NONCLAIMS,
  G12_PROFILE,
  G12_ROOT,
  assertG12Root,
  assertG12ExactFileSet,
  assertG12ExpectedValue,
  assertG12ExternalIdentity,
  createG12ApplicabilityProfile,
} from './g1.2-profile.mjs';
import {
  acquireG12TransactionLock,
  materializeG12Transactionally,
  parseG12JestReport,
  parseG12CaptureArguments,
} from './capture-g1.2.mjs';

function sampleIndex() {
  return {
    records: G12_ASSERTIONS.map((assertionId) => ({
      assertionId,
      path: `${G12_ROOT}/records/${assertionId}.json`,
      sha256: `sha256:${'0'.repeat(64)}`,
    })),
    recertifications: [],
    schema: 'core-ui-evidence-index-v1',
    sourceRevision: '1'.repeat(40),
    sourceTree: '2'.repeat(40),
    supersessions: [],
    validation: { path: `${G12_ROOT}/validation.json`, sha256: `sha256:${'3'.repeat(64)}` },
  };
}

async function present(path) {
  return stat(path).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

test('G1.2 profile is closed around exactly five proposed assertions and no supersessions', () => {
  const index = sampleIndex();
  assert.doesNotThrow(() => assertG12Root(index, {
    sourceRevision: index.sourceRevision,
    sourceTree: index.sourceTree,
  }));
  for (const mutate of [
    (value) => { value.extra = true; },
    (value) => { value.records.pop(); },
    (value) => { value.records[0].assertionId = 'E-G1.2-99'; },
    (value) => { value.supersessions.push({}); },
    (value) => { value.validation.path = `${G12_ROOT}/other.json`; },
  ]) {
    const value = structuredClone(index);
    mutate(value);
    assert.throws(() => assertG12Root(value, {
      sourceRevision: index.sourceRevision,
      sourceTree: index.sourceTree,
    }), /G12_PROFILE_INVALID/u);
  }
  const profile = createG12ApplicabilityProfile({
    manifest: { algorithm: 'sha256', paths: [], profile: 'core-ui-path-manifest-v1', sha256: `sha256:${'4'.repeat(64)}` },
    proofFiles: [],
    sourceRevision: index.sourceRevision,
    sourceTree: index.sourceTree,
  });
  assert.equal(profile.profile, G12_PROFILE);
  assert.equal(profile.componentSupportClaim, 'none');
  assert.deepEqual(profile.nonclaims, G12_NONCLAIMS);
  assert.equal(profile.platformBoundary.reactNativeWeb, 'unsupported');
});

test('G1.2 closed profile rejects nested extras, mutated facts, references, and continuity members', () => {
  assert.doesNotThrow(() => assertG12ExactFileSet(
    ['index.json', 'records/E-G1.2-01.json'],
    ['index.json', 'records/E-G1.2-01.json'],
    'fixture',
  ));
  for (const extra of [
    'artifacts/unreferenced.json',
    'records/unreferenced.json',
    'validation/unreferenced.txt',
    'supersessions/unreferenced.json',
  ]) assert.throws(() => assertG12ExactFileSet(
    ['index.json', 'records/E-G1.2-01.json', extra],
    ['index.json', 'records/E-G1.2-01.json'],
    'fixture',
  ), /G12_PROFILE_INVALID/u);
  const expected = { facts: { bindingRef: 'core:component:button#native.react-native' }, references: ['exact'] };
  for (const mutate of [
    (value) => { value.facts.bindingRef = 'core:component:other#native.react-native'; },
    (value) => { value.references = ['wrong']; },
    (value) => { value.extra = true; },
  ]) {
    const value = structuredClone(expected);
    mutate(value);
    assert.throws(() => assertG12ExpectedValue(value, expected, 'fixture'), /G12_PROFILE_INVALID/u);
  }
});

test('G1.2 root identity is externally bound across source, tree, and timestamp', () => {
  const expected = { sourceRevision: '1'.repeat(40), sourceTree: '2'.repeat(40), timestamp: '2026-08-12T06:10:00Z' };
  assert.doesNotThrow(() => assertG12ExternalIdentity(expected, expected, 'fixture'));
  for (const key of ['sourceRevision', 'sourceTree', 'timestamp']) {
    const value = structuredClone(expected);
    value[key] = key === 'timestamp' ? '2026-08-12T06:11:00Z' : '3'.repeat(40);
    assert.throws(() => assertG12ExternalIdentity(value, expected, 'fixture'), /G12_PROFILE_INVALID/u);
  }
});

test('G1.2 capture arguments are exact and timestamp-bound', () => {
  assert.deepEqual(parseG12CaptureArguments([
    '--source', '1'.repeat(40), '--tree', '2'.repeat(40), '--timestamp', '2026-08-12T06:10:00Z',
  ]), {
    check: false,
    sourceRevision: '1'.repeat(40),
    sourceTree: '2'.repeat(40),
    timestamp: '2026-08-12T06:10:00Z',
  });
  for (const args of [
    [],
    ['--source', '1'.repeat(40), '--source', '2'.repeat(40), '--timestamp', '2026-08-12T06:10:00Z'],
    ['--source', 'bad', '--tree', '2'.repeat(40), '--timestamp', '2026-08-12T06:10:00Z'],
    ['--source', '1'.repeat(40), '--tree', '2'.repeat(40), '--timestamp', 'not-time'],
  ]) assert.throws(() => parseG12CaptureArguments(args), /G12_CAPTURE_ARGUMENT/u);
});

test('G1.2 Jest report parsing ignores pnpm stderr appended after the JSON line', () => {
  const report = parseG12JestReport([
    'prefix from the package runner',
    '{"numFailedTestSuites":0,"success":true,"testResults":[]}',
    'Test Suites: 1 passed, 1 total',
  ].join('\n'));
  assert.equal(report.success, true);
  assert.equal(report.numFailedTestSuites, 0);
  for (const output of [
    'Test Suites: 1 passed',
    'runner noise {"numFailedTestSuites":0,"success":true,"testResults":[]}',
    [
      '{"numFailedTestSuites":0,"success":true,"testResults":[]}',
      '{"numFailedTestSuites":1,"success":false,"testResults":[]}',
    ].join('\n'),
  ]) assert.throws(() => parseG12JestReport(output), /G12_CAPTURE_JEST_JSON_AMBIGUOUS/u);
});

test('G1.2 transactional materialization verifies only after both roots and leaves no transaction directory', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-publish-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  try {
    await materializeG12Transactionally({
      repository,
      build: async ([maintenance, evidence]) => {
        await writeFile(join(maintenance, 'index.json'), '{}');
        await writeFile(join(evidence, 'index.json'), '{}');
      },
      afterPublish: async () => {
        assert.equal(await present(join(repository, G12_MAINTENANCE_ROOT, 'index.json')), true);
        assert.equal(await present(join(repository, G12_ROOT, 'index.json')), true);
        assert.equal((await readdir(join(repository, 'tests'))).some((name) => name.startsWith('.g1-2-transaction-')), false);
      },
    });
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 transactional materialization durably syncs both staged trees before publication', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-durable-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  const synced = [];
  try {
    await materializeG12Transactionally({
      repository,
      build: async ([maintenance, evidence]) => {
        await writeFile(join(maintenance, 'index.json'), '{}');
        await writeFile(join(evidence, 'index.json'), '{}');
      },
      syncStagedTree: async (path) => { synced.push(path); },
      renamePath: async (from, to) => {
        assert.equal(synced.includes(from), true);
        await rename(from, to);
      },
    });
    assert.equal(synced.length, 2);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 transactional materialization rolls both roots back after verification failure and retries cleanly', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-rollback-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  const build = async ([maintenance, evidence]) => {
    await writeFile(join(maintenance, 'index.json'), '{}');
    await writeFile(join(evidence, 'index.json'), '{}');
  };
  try {
    await assert.rejects(materializeG12Transactionally({
      repository,
      build,
      afterPublish: async () => { throw new Error('INJECTED_G12_VERIFIER_FAILURE'); },
    }), /INJECTED_G12_VERIFIER_FAILURE/u);
    for (const root of [G12_MAINTENANCE_ROOT, G12_ROOT]) assert.equal(await present(join(repository, root)), false);
    await materializeG12Transactionally({ repository, build });
    assert.equal(await readFile(join(repository, G12_ROOT, 'index.json'), 'utf8'), '{}');
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 transactional materialization rolls back an inter-root interruption', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-inter-root-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  try {
    await assert.rejects(materializeG12Transactionally({
      repository,
      build: async ([maintenance, evidence]) => {
        await writeFile(join(maintenance, 'index.json'), '{}');
        await writeFile(join(evidence, 'index.json'), '{}');
      },
      afterEachMaterialization: async ({ index }) => {
        if (index === 0) throw new Error('INJECTED_G12_INTER_ROOT_INTERRUPTION');
      },
    }), /INJECTED_G12_INTER_ROOT_INTERRUPTION/u);
    for (const root of [G12_MAINTENANCE_ROOT, G12_ROOT]) assert.equal(await present(join(repository, root)), false);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

for (const interruptionPoint of [0, 1, 'verification']) test(
  `G1.2 transactional materialization rejects reads and recovers after interruption at ${interruptionPoint}`,
  async () => {
    const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-crash-recovery-'));
    await mkdir(join(repository, 'tests/evidence'), { recursive: true });
    const build = async ([maintenance, evidence]) => {
      await writeFile(join(maintenance, 'index.json'), '{}');
      await writeFile(join(evidence, 'index.json'), '{}');
    };
    try {
      const interruption = new Error('INJECTED_G12_PROCESS_INTERRUPTION');
      interruption.code = 'G12_SIMULATED_PROCESS_INTERRUPTION';
      await assert.rejects(materializeG12Transactionally({
        repository,
        build,
        afterEachMaterialization: async ({ index, journalPath }) => {
          if (index !== interruptionPoint) return;
          assert.equal(await present(journalPath), true);
          const { verifyEvidence } = await import('../../tooling/audits/repository-policy/src/evidence-verify.mjs');
          await assert.rejects(verifyEvidence(repository), /EVIDENCE_TRANSACTION_INCOMPLETE/u);
          throw interruption;
        },
        afterPublish: async ({ journalPath }) => {
          if (interruptionPoint !== 'verification') return;
          assert.equal(await present(journalPath), true);
          const { verifyEvidence } = await import('../../tooling/audits/repository-policy/src/evidence-verify.mjs');
          await assert.rejects(verifyEvidence(repository), /EVIDENCE_TRANSACTION_INCOMPLETE/u);
          throw interruption;
        },
      }), /INJECTED_G12_PROCESS_INTERRUPTION/u);
      assert.equal(await present(join(repository, 'tests/evidence/.g1-2-transaction.json')), true);
      await materializeG12Transactionally({ repository, build });
      assert.equal(await present(join(repository, 'tests/evidence/.g1-2-transaction.json')), false);
      assert.equal(await present(join(repository, G12_MAINTENANCE_ROOT, 'index.json')), true);
      assert.equal(await present(join(repository, G12_ROOT, 'index.json')), true);
    } finally {
      await rm(repository, { recursive: true, force: true });
    }
  },
);

test('G1.2 transactional materialization surfaces rollback-integrity failure while force-cleaning residue', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-integrity-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  let calls = 0;
  const renamePath = async (from, to) => {
    calls += 1;
    if (calls === 3) throw new Error('INJECTED_G12_ROLLBACK_RENAME_FAILURE');
    await rename(from, to);
  };
  try {
    await assert.rejects(materializeG12Transactionally({
      repository,
      renamePath,
      build: async ([maintenance, evidence]) => {
        await writeFile(join(maintenance, 'index.json'), '{}');
        await writeFile(join(evidence, 'index.json'), '{}');
      },
      afterPublish: async () => { throw new Error('INJECTED_G12_POSTCONDITION_FAILURE'); },
    }), /G12_CAPTURE_ROLLBACK_INTEGRITY.*INJECTED_G12_ROLLBACK_RENAME_FAILURE/u);
    for (const root of [G12_MAINTENANCE_ROOT, G12_ROOT]) assert.equal(await present(join(repository, root)), false);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 transactional materialization is single-writer and cannot delete the owner result', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-concurrent-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const build = async ([maintenance, evidence]) => {
    await writeFile(join(maintenance, 'index.json'), '{}');
    await writeFile(join(evidence, 'index.json'), '{}');
  };
  try {
    const owner = materializeG12Transactionally({
      repository,
      build: async (paths) => { await build(paths); await held; },
    });
    while (!await present(join(repository, 'tests/evidence/.g1-2-transaction.lock'))) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    await assert.rejects(
      materializeG12Transactionally({ repository, build }),
      /G12_CAPTURE_TRANSACTION_LOCKED/u,
    );
    release();
    await owner;
    assert.equal(await present(join(repository, G12_MAINTENANCE_ROOT, 'index.json')), true);
    assert.equal(await present(join(repository, G12_ROOT, 'index.json')), true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 transactional materialization leaves a stale lock untouched for explicit recovery', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-stale-lock-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  await writeFile(join(repository, 'tests/evidence/.g1-2-transaction.lock'), JSON.stringify({
    pid: 2147483647,
    processStart: 'stale-process-incarnation',
    profile: 'core-ui-g1-2-transaction-lock-v1',
    token: '00000000-0000-4000-8000-000000000000',
  }));
  try {
    await assert.rejects(materializeG12Transactionally({
      repository,
      build: async ([maintenance, evidence]) => {
        await writeFile(join(maintenance, 'index.json'), '{}');
        await writeFile(join(evidence, 'index.json'), '{}');
      },
    }), /G12_CAPTURE_STALE_LOCK_RECOVERY_REQUIRED.*token=00000000-0000-4000-8000-000000000000/u);
    assert.equal(await present(join(repository, G12_ROOT, 'index.json')), false);
    assert.equal(await present(join(repository, 'tests/evidence/.g1-2-transaction.lock')), true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 PID reuse cannot impersonate a lock owner process incarnation', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-pid-reuse-'));
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  await writeFile(join(repository, 'tests/evidence/.g1-2-transaction.lock'), JSON.stringify({
    pid: process.pid,
    processStart: 'different-process-incarnation',
    profile: 'core-ui-g1-2-transaction-lock-v1',
    token: '00000000-0000-4000-8000-000000000001',
  }));
  try {
    await assert.rejects(
      materializeG12Transactionally({ repository, build: async () => {} }),
      /G12_CAPTURE_STALE_LOCK_RECOVERY_REQUIRED/u,
    );
    assert.equal(await present(join(repository, 'tests/evidence/.g1-2-transaction.lock')), true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('G1.2 partial owned-lock creation cleans the path and closes the handle', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'core-ui-g12-lock-create-'));
  const lockPath = join(repository, 'tests/evidence/.g1-2-transaction.lock');
  await mkdir(join(repository, 'tests/evidence'), { recursive: true });
  let closed = false;
  try {
    await assert.rejects(acquireG12TransactionLock(lockPath, {
      openLock: async (path, flags) => {
        const handle = await import('node:fs/promises').then(({ open }) => open(path, flags));
        return {
          close: async () => { closed = true; await handle.close(); },
          sync: async () => { throw new Error('INJECTED_G12_LOCK_SYNC_FAILURE'); },
          writeFile: (...args) => handle.writeFile(...args),
        };
      },
    }), /INJECTED_G12_LOCK_SYNC_FAILURE/u);
    assert.equal(closed, true);
    assert.equal(await present(lockPath), false);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
