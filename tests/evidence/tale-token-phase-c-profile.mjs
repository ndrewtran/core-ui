import { canonicalDigest, canonicalJson } from '../../packages/schema/src/index.mjs';

export const TALE_TOKEN_PHASE_C_PROFILE = Object.freeze({
  schema: 'core-ui-evidence-applicability-profile-v1',
  id: 'TALE-TOKEN-C',
  decision: Object.freeze({
    path: 'decisions/0003-tale-token-classification-annex.json',
    sha256: 'sha256:c94518bc3e9d3a98a1752311f0a4bc37be106d75fa16db5bfc2555b3894d9604',
  }),
});

export const TALE_TOKEN_PHASE_C_PROFILE_DIGEST = canonicalDigest(
  TALE_TOKEN_PHASE_C_PROFILE,
);

export const TALE_TOKEN_PHASE_C_ROOT_NAMES = Object.freeze([
  'tale-token-phase-c-g0.1',
  'tale-token-phase-c-g0.2',
  'tale-token-phase-c-g0.3',
  'tale-token-phase-c-g0.4',
  'tale-token-phase-c-g0.5',
  'tale-token-phase-c-gate-0',
]);

export function assertTaleTokenPhaseCProfile(value, fail) {
  let matches = false;
  try {
    matches = canonicalJson(value) === canonicalJson(TALE_TOKEN_PHASE_C_PROFILE);
  } catch {
    matches = false;
  }
  if (!matches) fail('must bind the exact closed TALE-TOKEN-C applicability profile');
}

export function assertTaleTokenPhaseCIndexSet(values, fail) {
  const names = values.map(({ name }) => name).sort();
  const identities = new Set(values.map(({ index }) => (
    `${index.sourceRevision}:${index.sourceTree}:${index.captureTimestamp}`
  )));
  if (
    canonicalJson(names) !== canonicalJson(TALE_TOKEN_PHASE_C_ROOT_NAMES)
    || identities.size !== 1
  ) fail('must retain six exact sibling roots with one source/tree/timestamp');
}
