import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedText, normalizePath } from '../../../tooling/audits/repository-policy/src/policy.mjs';
import { loadJsonDocument, resolveJsonPointer } from './contracts.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const recipe = loadJsonDocument('type-projection.json');

function projectionValues(source, valueField) {
  const [fileName, pointer] = source.split('#');
  const document = fileName.startsWith('strategy/')
    ? JSON.parse(readFileSync(join(repositoryRoot, fileName), 'utf8'))
    : loadJsonDocument(fileName);
  const value = resolveJsonPointer(
    document,
    pointer ? `#${pointer}` : '#',
  );
  const values = Array.isArray(value) ? value : Object.keys(value);
  return valueField === undefined ? values : values.map((entry) => entry[valueField]);
}

function union(values) {
  return values.map((value) => JSON.stringify(value)).join(' | ');
}

const declarations = recipe.projections.map(({ name, source, valueField }) => (
  `export type ${name} = ${union(projectionValues(source, valueField))};`
));
const body = [
  'export type ArtifactRef = `core:${ArtifactKind}:${string}`;',
  'export type BindingRef = `${Extract<ArtifactRef, `core:component:${string}`>}#${BindingId}`;',
  ...declarations,
  '',
].join('\n');
const policy = JSON.parse(await readFile(
  join(repositoryRoot, 'tooling/audits/repository-policy/repository-policy.json'),
  'utf8',
));
const source = 'packages/schema/schemas/type-projection.json';
const outputPath = join(repositoryRoot, recipe.output);
const expected = generatedText({ source, body, policy });

if (process.argv.includes('--check')) {
  const actual = await readFile(outputPath, 'utf8').catch(() => null);
  if (actual !== expected) {
    console.error(
      `SCHEMA_GENERATED_TYPES_DRIFT: ${normalizePath(recipe.output)} must be regenerated from ${source}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`[schema] generated types match ${source}`);
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected);
  console.log(`[schema] generated ${normalizePath(recipe.output)}`);
}
