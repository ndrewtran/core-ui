import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  EvidenceIntegrityError,
  verifyG12V2Route,
} from '../src/evidence-verify.mjs';

test('current G1.2 routing permits absence before capture', async () => {
  assert.equal(await verifyG12V2Route(process.cwd(), new Set(['g0.0'])), false);
});

test('current G1.2 routing rejects partial and duplicate-looking roots', async () => {
  await assert.rejects(
    verifyG12V2Route(process.cwd(), new Set([
      'g1.2-v2', 'g1.2-v2-copy',
    ])),
    (error) => error instanceof EvidenceIntegrityError
      && error.code === 'EVIDENCE_G12_V2_TOPOLOGY_INVALID',
  );

  const repository = await mkdtemp(join(tmpdir(), 'g12-v2-route-'));
  try {
    await mkdir(join(repository, 'tests/evidence/g1.2-v2'), { recursive: true });
    await assert.rejects(
      verifyG12V2Route(repository, new Set(['g1.2-v2'])),
      (error) => error instanceof EvidenceIntegrityError
        && error.code === 'EVIDENCE_G12_V2_PROFILE_INVALID',
    );
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
