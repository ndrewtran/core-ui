import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TALE_TOKEN_PHASE_C_V2_ROOT_NAMES,
  assertTaleTokenPhaseCV2DirectoryNames,
  isTaleTokenPhaseCV2Name,
} from '../../../../tests/evidence/tale-token-phase-c-v2-profile.mjs';

const legacy = [
  'tale-token-phase-c-g0.1',
  'tale-token-phase-c-g0.2',
  'tale-token-phase-c-g0.3',
  'tale-token-phase-c-g0.4',
  'tale-token-phase-c-g0.5',
  'tale-token-phase-c-gate-0',
];

test('Phase C v2 verifier routing admits the complete successor beside legacy evidence', () => {
  assert.equal(assertTaleTokenPhaseCV2DirectoryNames([...legacy, ...TALE_TOKEN_PHASE_C_V2_ROOT_NAMES]), true);
  assert.deepEqual(legacy.map(isTaleTokenPhaseCV2Name), Array(6).fill(false));
  assert.deepEqual(TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.map(isTaleTokenPhaseCV2Name), Array(6).fill(true));
});

test('Phase C v2 verifier routing rejects incomplete or unrecognized successor roots', () => {
  for (const names of [
    [...legacy, ...TALE_TOKEN_PHASE_C_V2_ROOT_NAMES.slice(0, 5)],
    [...legacy, ...TALE_TOKEN_PHASE_C_V2_ROOT_NAMES, 'tale-token-phase-c-gate-0-v2-copy'],
  ]) assert.throws(() => assertTaleTokenPhaseCV2DirectoryNames(names), /six versioned Phase C roots/u);
});
