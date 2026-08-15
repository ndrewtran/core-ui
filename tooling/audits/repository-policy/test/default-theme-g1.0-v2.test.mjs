import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  EvidenceIntegrityError,
  verifyDefaultThemeG10V2Route,
} from '../src/evidence-verify.mjs';

test('current G1.0 routing permits absence before capture', async () => {
  assert.equal(await verifyDefaultThemeG10V2Route(process.cwd(), new Set(['g0.0'])), false);
});

test('current G1.0 routing rejects partial and duplicate-looking roots', async () => {
  await assert.rejects(
    verifyDefaultThemeG10V2Route(process.cwd(), new Set([
      'default-theme-g1.0-v2', 'default-theme-g1.0-v2-copy',
    ])),
    (error) => error instanceof EvidenceIntegrityError
      && error.code === 'EVIDENCE_G10_V2_TOPOLOGY_INVALID',
  );

  const repository = await mkdtemp(join(tmpdir(), 'default-theme-g10-v2-route-'));
  try {
    await mkdir(join(repository, 'tests/evidence/default-theme-g1.0-v2'), { recursive: true });
    await assert.rejects(
      verifyDefaultThemeG10V2Route(repository, new Set(['default-theme-g1.0-v2'])),
      (error) => error instanceof EvidenceIntegrityError
        && error.code === 'EVIDENCE_G10_V2_PROFILE_INVALID',
    );
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
