import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compileCatalog } from './compiler.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const source = 'packages/catalog/catalog-sources.json';
const output = resolve(repositoryRoot, 'packages/catalog/generated/catalog.mjs');
const { bytes } = await compileCatalog({ repositoryRoot, sourceManifestPath: source });
const body = [
  `export const catalogJson = ${JSON.stringify(bytes)};`,
  '',
].join('\n');
const digest = createHash('sha256').update(body).digest('hex');
const expected = [
  `// @generated-from: ${source}`,
  `// @generated-content-sha256: sha256:${digest}`,
  body,
].join('\n');

if (process.argv.includes('--check')) {
  const actual = await readFile(output, 'utf8').catch(() => null);
  if (actual !== expected) {
    console.error(
      'CATALOG_GENERATED_BUNDLE_DRIFT: packages/catalog/generated/catalog.mjs '
      + `must be regenerated from ${source}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`[catalog] generated bundle matches ${source}`);
  }
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, expected);
  console.log('[catalog] generated packages/catalog/generated/catalog.mjs');
}
