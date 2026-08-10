import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sha256 } from '../src/policy.mjs';
import {
  TALE_TOKEN_PHASE_B_PROFILE,
  TALE_TOKEN_PHASE_B_ROOT_NAMES,
  assertTaleTokenPhaseBIndexSet,
  assertTaleTokenPhaseBProfile,
} from '../../../../tests/evidence/tale-token-phase-b-profile.mjs';
import {
  TALE_TOKEN_PHASE_C_PROFILE,
  TALE_TOKEN_PHASE_C_ROOT_NAMES,
  assertTruthfulTaleTokenPhaseCTimestamp,
  assertTaleTokenPhaseCIndexSet,
  assertTaleTokenPhaseCProfile,
  parseTaleTokenPhaseCArguments,
} from '../../../../tests/evidence/capture-tale-token-phase-c.mjs';

function reject(call, pattern) {
  assert.throws(() => call((message) => { throw new Error(message); }), pattern);
}

test('TALE-TOKEN-B profile binds the exact accepted annex', async () => {
  const annex = await readFile(new URL(
    '../../../../decisions/0003-tale-token-classification-annex.json',
    import.meta.url,
  ));
  assert.equal(`sha256:${sha256(annex)}`, TALE_TOKEN_PHASE_B_PROFILE.decision.sha256);
  assert.doesNotThrow(() => assertTaleTokenPhaseBProfile(
    structuredClone(TALE_TOKEN_PHASE_B_PROFILE),
    (message) => { throw new Error(message); },
  ));
  for (const invalid of [
    undefined,
    { ...structuredClone(TALE_TOKEN_PHASE_B_PROFILE), id: 'TALE-TOKEN-C' },
    {
      ...structuredClone(TALE_TOKEN_PHASE_B_PROFILE),
      decision: { ...TALE_TOKEN_PHASE_B_PROFILE.decision, sha256: `sha256:${'0'.repeat(64)}` },
    },
  ]) reject((fail) => assertTaleTokenPhaseBProfile(invalid, fail), /exact closed/);
});

test('TALE-TOKEN-B rejects missing or mixed sibling evidence identities', () => {
  const values = TALE_TOKEN_PHASE_B_ROOT_NAMES.map((name) => ({
    name,
    index: { sourceRevision: 'source', sourceTree: 'tree', captureTimestamp: 'timestamp' },
  }));
  assert.doesNotThrow(() => assertTaleTokenPhaseBIndexSet(values, (message) => {
    throw new Error(message);
  }));
  reject((fail) => assertTaleTokenPhaseBIndexSet(values.slice(1), fail), /six exact sibling/);
  const mixed = structuredClone(values);
  mixed[3].index.sourceRevision = 'other-source';
  reject((fail) => assertTaleTokenPhaseBIndexSet(mixed, fail), /one source\/tree\/timestamp/);
});

test('TALE-TOKEN-C profile binds the exact accepted identity correction', async () => {
  const decision = await readFile(new URL(
    '../../../../decisions/0005-default-theme-token-source-identity.json',
    import.meta.url,
  ));
  assert.equal(`sha256:${sha256(decision)}`, TALE_TOKEN_PHASE_C_PROFILE.decision.sha256);
  assert.doesNotThrow(() => assertTaleTokenPhaseCProfile(
    structuredClone(TALE_TOKEN_PHASE_C_PROFILE),
    (message) => { throw new Error(message); },
  ));
  for (const invalid of [
    { ...structuredClone(TALE_TOKEN_PHASE_C_PROFILE), id: 'TALE-TOKEN-B' },
    {
      ...structuredClone(TALE_TOKEN_PHASE_C_PROFILE),
      decision: { ...TALE_TOKEN_PHASE_C_PROFILE.decision, sha256: `sha256:${'0'.repeat(64)}` },
    },
  ]) reject((fail) => assertTaleTokenPhaseCProfile(invalid, fail), /exact closed/);
});

test('TALE-TOKEN-C rejects missing or mixed sibling evidence identities', () => {
  const values = TALE_TOKEN_PHASE_C_ROOT_NAMES.map((name) => ({
    name,
    index: { sourceRevision: 'source', sourceTree: 'tree', captureTimestamp: 'timestamp' },
  }));
  assert.doesNotThrow(() => assertTaleTokenPhaseCIndexSet(values, (message) => {
    throw new Error(message);
  }));
  reject((fail) => assertTaleTokenPhaseCIndexSet(values.slice(1), fail), /six exact sibling/);
  const mixed = structuredClone(values);
  mixed[3].index.sourceTree = 'other-tree';
  reject((fail) => assertTaleTokenPhaseCIndexSet(mixed, fail), /one source\/tree\/timestamp/);
});

test('TALE-TOKEN-C capture arguments and truthful UTC timestamp fail closed', () => {
  const source = 'a'.repeat(40);
  const tree = 'b'.repeat(40);
  const timestamp = '2026-08-10T01:02:03Z';
  assert.deepEqual(parseTaleTokenPhaseCArguments([
    '--source', source, '--tree', tree, '--timestamp', timestamp,
  ]), { source, timestamp, tree });
  for (const args of [
    ['--source', source, '--timestamp', timestamp],
    ['--source', source, '--tree', tree, '--tree', tree],
    ['--source', source, '--tree', tree, '--unknown', timestamp],
    ['--source', source, '--tree', 'not-a-tree', '--timestamp', timestamp],
  ]) assert.throws(() => parseTaleTokenPhaseCArguments(args), /TALE_TOKEN_PHASE_C_ARGUMENT/u);
  assert.doesNotThrow(() => assertTruthfulTaleTokenPhaseCTimestamp(
    timestamp,
    '2026-08-10T01:02:02+00:00',
    new Date('2026-08-10T01:02:04Z'),
  ));
  for (const value of [
    '2026-02-30T01:02:03Z',
    '2026-08-10T01:02:01Z',
    '2026-08-10T01:02:05Z',
  ]) assert.throws(() => assertTruthfulTaleTokenPhaseCTimestamp(
    value,
    '2026-08-10T01:02:02Z',
    new Date('2026-08-10T01:02:04Z'),
  ), /TALE_TOKEN_PHASE_C_TIMESTAMP_INVALID/u);
});
