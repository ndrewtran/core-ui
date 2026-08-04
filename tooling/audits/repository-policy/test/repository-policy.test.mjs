import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  PolicyError,
  auditAliases,
  auditRepository,
  generatedText,
  loadPolicy,
  validateGeneratedFile,
} from '../src/policy.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const policy = await loadPolicy(repositoryRoot);

test('E-G0.0-01: a cold root navigation audit reaches every major owner', async () => {
  const result = await auditRepository(repositoryRoot);
  assert.equal(result.owners, 7);
});

test('E-G0.0-03: generated output validates against its source and digest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-policy-'));
  await mkdir(join(root, 'catalog'), { recursive: true });
  await mkdir(join(root, 'tooling/generated'), { recursive: true });
  await writeFile(join(root, 'catalog/source.txt'), 'canonical input\n');
  await writeFile(
    join(root, 'tooling/generated/output.js'),
    generatedText({
      source: 'catalog/source.txt',
      body: 'export const answer = 42;\n',
      policy,
    }),
  );

  const result = await validateGeneratedFile(
    root,
    'tooling/generated/output.js',
    policy,
  );
  assert.equal(result.source, 'catalog/source.txt');
});

test('E-G0.0-03 negative: a direct projection edit is rejected with its owner', async () => {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-policy-'));
  await mkdir(join(root, 'catalog'), { recursive: true });
  await mkdir(join(root, 'tooling/generated'), { recursive: true });
  await writeFile(join(root, 'catalog/source.txt'), 'canonical input\n');
  const outputPath = join(root, 'tooling/generated/output.js');
  await writeFile(
    outputPath,
    generatedText({
      source: 'catalog/source.txt',
      body: 'export const answer = 42;\n',
      policy,
    }),
  );
  const edited = (await readFile(outputPath, 'utf8')).replace('42', '43');
  await writeFile(outputPath, edited);

  await assert.rejects(
    validateGeneratedFile(root, 'tooling/generated/output.js', policy),
    (error) => {
      assert.ok(error instanceof PolicyError);
      assert.equal(error.code, 'PROJECTION_DIGEST_MISMATCH');
      assert.match(error.message, /repair catalog\/source\.txt and regenerate/);
      return true;
    },
  );
});

test('E-G0.0-03 negative: duplicate aliases fail deterministically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-alias-'));
  await mkdir(join(root, 'catalog/components/button'), { recursive: true });
  await mkdir(join(root, 'catalog/patterns/form'), { recursive: true });
  await writeFile(
    join(root, 'catalog/components/button/artifact.json'),
    JSON.stringify({ id: 'core:component:button', aliases: ['action'] }),
  );
  await writeFile(
    join(root, 'catalog/patterns/form/artifact.json'),
    JSON.stringify({ id: 'core:pattern:form', aliases: ['action'] }),
  );

  await assert.rejects(auditAliases(root, policy), (error) => {
    assert.ok(error instanceof PolicyError);
    assert.equal(error.code, 'ALIAS_COLLISION');
    assert.match(error.message, /core:component:button/);
    assert.match(error.message, /core:pattern:form/);
    return true;
  });
});
