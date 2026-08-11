import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { publishDirectorySetAtomically } from '../../../../tests/evidence/capture-tale-token-phase-c.mjs';

const outputs = [
  'tests/evidence/tale-token-phase-c-g0.1',
  'tests/evidence/tale-token-phase-c-g0.2',
  'tests/evidence/tale-token-phase-c-g0.3',
  'tests/evidence/tale-token-phase-c-g0.4',
  'tests/evidence/tale-token-phase-c-g0.5',
  'tests/evidence/tale-token-phase-c-gate-0',
  'tests/evidence/authority-46-phase-c-applicability',
];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-phase-c-publish-'));
  const generated = join(root, 'generated');
  const destination = join(root, 'destination');
  for (const [index, relativePath] of outputs.entries()) {
    await mkdir(join(generated, relativePath), { recursive: true });
    await writeFile(join(generated, relativePath, 'index.json'), `root-${index}\n`);
  }
  return { destination, generated, root };
}

async function absent(root, path) {
  return access(join(root, path)).then(() => false).catch((error) => {
    if (error?.code === 'ENOENT') return true;
    throw error;
  });
}

test('Phase C publication rolls back every partial seven-directory boundary', async () => {
  for (let failAfter = 1; failAfter <= outputs.length; failAfter += 1) {
    const { destination, generated, root } = await fixture();
    try {
      await assert.rejects(publishDirectorySetAtomically({
        destinationRoot: destination,
        failAfter,
        generatedRoot: generated,
        relativePaths: outputs,
      }), /TALE_TOKEN_PHASE_C_TEST_FAILURE/u);
      for (const path of outputs) assert.equal(await absent(destination, path), true, path);
      const transactionParent = join(destination, 'tests/evidence');
      assert.deepEqual(await readdir(transactionParent), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('Phase C publication commits all six proof roots and the maintenance root together', async () => {
  const { destination, generated, root } = await fixture();
  try {
    await publishDirectorySetAtomically({
      afterPublish: async () => {
        const entries = await readdir(join(destination, 'tests/evidence'));
        assert.equal(entries.some((entry) => entry.startsWith('.tale-token-phase-c.transaction-')), false);
      },
      destinationRoot: destination,
      generatedRoot: generated,
      relativePaths: outputs,
    });
    for (const [index, path] of outputs.entries()) {
      assert.equal(await readFile(join(destination, path, 'index.json'), 'utf8'), `root-${index}\n`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Phase C publication restores all roots when post-publication verification fails', async () => {
  const { destination, generated, root } = await fixture();
  try {
    await assert.rejects(publishDirectorySetAtomically({
      afterPublish: async () => {
        throw new Error('INJECTED_POST_PUBLICATION_VERIFICATION_FAILURE');
      },
      destinationRoot: destination,
      generatedRoot: generated,
      relativePaths: outputs,
    }), /INJECTED_POST_PUBLICATION_VERIFICATION_FAILURE/u);
    for (const path of outputs) assert.equal(await absent(destination, path), true, path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Phase C publication reports rollback failure and leaves no final evidence roots', async () => {
  const { destination, generated, root } = await fixture();
  let rollbackAttempts = 0;
  try {
    await assert.rejects(publishDirectorySetAtomically({
      afterPublish: async () => {
        throw new Error('INJECTED_POST_PUBLICATION_VERIFICATION_FAILURE');
      },
      destinationRoot: destination,
      generatedRoot: generated,
      relativePaths: outputs,
      rollbackRename: async (source, target) => {
        rollbackAttempts += 1;
        if (rollbackAttempts === 1) throw new Error('INJECTED_ROLLBACK_RENAME_FAILURE');
        await rename(source, target);
      },
    }), /TALE_TOKEN_PHASE_C_ROLLBACK_INTEGRITY: .*INJECTED_ROLLBACK_RENAME_FAILURE/u);
    assert.equal(rollbackAttempts, outputs.length, 'every reversal is attempted after one fails');
    for (const path of outputs) assert.equal(await absent(destination, path), true, path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
