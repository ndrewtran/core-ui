import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  EvidenceIntegrityError,
  verifyDefaultThemeG11V2Route,
} from '../src/evidence-verify.mjs';

test('current G1.1 routing permits absence before capture', async () => {
  assert.equal(await verifyDefaultThemeG11V2Route(process.cwd(), new Set(['g0.0'])), false);
});

test('current G1.1 routing rejects partial and duplicate-looking roots', async () => {
  await assert.rejects(
    verifyDefaultThemeG11V2Route(process.cwd(), new Set([
      'default-theme-g1.1-v2', 'default-theme-g1.1-v2-copy',
    ])),
    (error) => error instanceof EvidenceIntegrityError
      && error.code === 'EVIDENCE_G11_V2_TOPOLOGY_INVALID',
  );

  const repository = await mkdtemp(join(tmpdir(), 'default-theme-g11-v2-route-'));
  try {
    await mkdir(join(repository, 'tests/evidence/default-theme-g1.1-v2'), { recursive: true });
    await assert.rejects(
      verifyDefaultThemeG11V2Route(repository, new Set(['default-theme-g1.1-v2'])),
      (error) => error instanceof EvidenceIntegrityError
        && error.code === 'EVIDENCE_G11_V2_PROFILE_INVALID',
    );
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
