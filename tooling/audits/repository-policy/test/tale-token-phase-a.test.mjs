import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sha256 } from '../src/policy.mjs';
import {
  TALE_TOKEN_PHASE_A_PROFILE,
  TALE_TOKEN_PHASE_A_ROOT_NAMES,
  assertTaleTokenPhaseAIndexSet,
  assertTaleTokenPhaseAProfile,
} from '../../../../tests/evidence/tale-token-phase-a-profile.mjs';

function reject(call, pattern) {
  assert.throws(() => call((message) => { throw new Error(message); }), pattern);
}

test('TALE-TOKEN-A profile binds the exact accepted annex', async () => {
  const annex = await readFile(new URL(
    '../../../../decisions/0003-tale-token-classification-annex.json',
    import.meta.url,
  ));
  assert.equal(`sha256:${sha256(annex)}`, TALE_TOKEN_PHASE_A_PROFILE.decision.sha256);
  assert.doesNotThrow(() => assertTaleTokenPhaseAProfile(
    structuredClone(TALE_TOKEN_PHASE_A_PROFILE),
    (message) => { throw new Error(message); },
  ));
  for (const invalid of [
    undefined,
    { ...structuredClone(TALE_TOKEN_PHASE_A_PROFILE), id: 'TALE-TOKEN-B' },
    {
      ...structuredClone(TALE_TOKEN_PHASE_A_PROFILE),
      decision: { ...TALE_TOKEN_PHASE_A_PROFILE.decision, sha256: `sha256:${'0'.repeat(64)}` },
    },
  ]) reject((fail) => assertTaleTokenPhaseAProfile(invalid, fail), /exact closed/);
});

test('TALE-TOKEN-A rejects missing or mixed sibling evidence identities', () => {
  const values = TALE_TOKEN_PHASE_A_ROOT_NAMES.map((name) => ({
    name,
    index: { sourceRevision: 'source', sourceTree: 'tree', captureTimestamp: 'timestamp' },
  }));
  assert.doesNotThrow(() => assertTaleTokenPhaseAIndexSet(values, (message) => {
    throw new Error(message);
  }));
  reject((fail) => assertTaleTokenPhaseAIndexSet(values.slice(1), fail), /six exact sibling/);
  const mixed = structuredClone(values);
  mixed[3].index.sourceRevision = 'other-source';
  reject((fail) => assertTaleTokenPhaseAIndexSet(mixed, fail), /one source\/tree\/timestamp/);
});
