import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyReactR10Route, EvidenceIntegrityError } from '../src/evidence-verify.mjs';
import { canonicalJson } from '../../../../packages/schema/src/index.mjs';

test('R1.0 verifier is absent-safe and rejects duplicate-looking roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'r1-0-')); const names = new Set();
  assert.equal(await verifyReactR10Route(root, names), false);
  await mkdir(join(root, 'tests/evidence/react-r1.0-extra'), { recursive: true });
  await assert.rejects(() => verifyReactR10Route(root, new Set(['react-r1.0-extra'])), (error) => error instanceof EvidenceIntegrityError && error.code === 'EVIDENCE_REACT_R10_TOPOLOGY_INVALID');
  await rm(root, { recursive: true, force: true });
});

test('R1.0 verifier rejects an incomplete exact root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'r1-0-')); await mkdir(join(root, 'tests/evidence/react-r1.0'), { recursive: true });
  await writeFile(join(root, 'tests/evidence/react-r1.0/index.json'), canonicalJson({}));
  await assert.rejects(() => verifyReactR10Route(root, new Set(['react-r1.0'])), /EVIDENCE_REACT_R10_PROFILE_INVALID/u);
  await rm(root, { recursive: true, force: true });
});
