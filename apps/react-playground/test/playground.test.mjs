import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('private playground is the bounded R1.0 theme and comparison host', async () => {
  const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.equal(manifest.devDependencies.vite, '8.2.1');
  assert.equal(manifest.devDependencies['axe-core'], '4.13.0');
  assert.equal(manifest.devDependencies['playwright-core'], '1.62.1');
  assert.match(await readFile(resolve(import.meta.dirname, '../src/main.jsx'), 'utf8'), /R1ButtonFixture/);
});
