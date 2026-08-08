import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canonicalJson } from '@core-ui/schema';
import { webCompatibility } from '@core-ui/web/compatibility';

const packageRoot = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const web = webCompatibility.bindings['web.react'];
const compatibility = {
  schema: 'core-ui-renderer-compatibility-v1',
  package: manifest.name,
  version: manifest.version,
  bindingSchemaRange: webCompatibility.bindingSchemaRange,
  tokenContractRange: webCompatibility.tokenContractRange,
  sourceRevision: webCompatibility.sourceRevision,
  styleSource: '@core-ui/web/button.css',
  bindings: { 'web.react': web },
};
const body = `function deepFreeze(value) {\n  if (value && typeof value === 'object' && !Object.isFrozen(value)) {\n    Object.freeze(value);\n    for (const item of Object.values(value)) deepFreeze(item);\n  }\n  return value;\n}\nexport const reactCompatibility = deepFreeze(${canonicalJson(compatibility)});\n`;
const digest = createHash('sha256').update(body).digest('hex');
const expected = `// @generated-from: packages/catalog/catalog-sources.json\n// @generated-content-sha256: sha256:${digest}\n${body}`;
const outputPath = resolve(packageRoot, 'generated/compatibility.mjs');
if (process.argv.includes('--check')) {
  const actual = await readFile(outputPath, 'utf8').catch(() => null);
  if (actual !== expected) {
    console.error('CORE_REACT_GENERATED_DRIFT: compatibility descriptor must be regenerated');
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected);
}
if (!process.exitCode) console.log('[react] generated compatibility identity matches the web binding');
