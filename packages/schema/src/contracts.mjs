import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const schemaDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../schemas',
);

export const familyFiles = Object.freeze({
  'artifact-ref': 'artifact-ref.schema.json',
  binding: 'binding.schema.json',
  capability: 'capability.schema.json',
  component: 'component.schema.json',
  diagnostic: 'diagnostic.schema.json',
  example: 'example.schema.json',
  guide: 'guide.schema.json',
  'query-envelope': 'query-envelope.schema.json',
  'section-page': 'section-page.schema.json',
  'token-section-page-budget-profile': 'token-section-page-budget-profile.schema.json',
  'token-source': 'token-source.schema.json',
});

function freezeContractRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

export const requiredFieldOwnershipContexts = freezeContractRows([
  { file: 'artifact-ref.schema.json', class: 'authored', owner: 'artifact-reference-contract' },
  { file: 'binding.schema.json', class: 'authored', owner: 'binding-contract' },
  { file: 'capability.schema.json', class: 'authored', owner: 'capability-contract' },
  { file: 'component.schema.json', class: 'authored', owner: 'component-contract' },
  { file: 'diagnostic.schema.json', class: 'derived', owner: 'diagnostic-contract' },
  { file: 'error-code.schema.json', class: 'derived', owner: 'diagnostic-code-contract' },
  { file: 'example.schema.json', class: 'authored', owner: 'example-contract' },
  { file: 'guide.schema.json', class: 'authored', owner: 'guide-contract' },
  { file: 'query-envelope.schema.json', class: 'derived', owner: 'query-envelope-contract' },
  { file: 'section-page.schema.json', class: 'derived', owner: 'query-envelope-contract' },
  { file: 'token-section-page-budget-profile.schema.json', class: 'derived', owner: 'query-page-budget-profile-contract' },
  { file: 'relation.schema.json', class: 'authored', owner: 'relation-registry' },
  { file: 'token-source.schema.json', class: 'authored', owner: 'token-source-contract' },
]);

export const requiredReservedFields = freezeContractRows([
  { name: 'contentRevision', class: 'derived', owner: 'artifact-revision-compiler', forbiddenInAuthoredSource: true },
  { name: 'evidenceResults', class: 'proved', owner: 'proof-system', forbiddenInAuthoredSource: true },
  { name: 'evidenceStatus', class: 'proved', owner: 'proof-system', forbiddenInAuthoredSource: true },
  { name: 'exportPath', class: 'derived', owner: 'package-export-graph', forbiddenInAuthoredSource: true },
  { name: 'packageVersion', class: 'derived', owner: 'package-graph', forbiddenInAuthoredSource: true },
  { name: 'sourceLocation', class: 'derived', owner: 'repository-convention', forbiddenInAuthoredSource: true },
  { name: 'specRevision', class: 'derived', owner: 'binding-revision-compiler', forbiddenInAuthoredSource: true },
]);

const documentCache = new Map();

export function loadJsonDocument(fileName) {
  if (!documentCache.has(fileName)) {
    const path = join(schemaDirectory, fileName);
    documentCache.set(fileName, JSON.parse(readFileSync(path, 'utf8')));
  }
  return documentCache.get(fileName);
}

export function loadFamilySchema(family, documents) {
  const fileName = Object.hasOwn(familyFiles, family) ? familyFiles[family] : undefined;
  if (!fileName) throw new Error(`SCHEMA_FAMILY_UNKNOWN: ${family}`);
  return {
    fileName,
    schema: documents?.[fileName] ?? loadJsonDocument(fileName),
  };
}

export function resolveJsonPointer(value, pointer) {
  if (!pointer || pointer === '#') return value;
  const path = pointer.replace(/^#\/?/, '');
  if (!path) return value;
  return path.split('/').reduce((current, segment) => {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current == null || !Object.hasOwn(current, key)) {
      throw new Error(`SCHEMA_POINTER_INVALID: ${pointer}`);
    }
    return current[key];
  }, value);
}

export function resolveSchemaReference(reference, currentFile, documents) {
  const [filePart, fragment = ''] = reference.split('#');
  const fileName = filePart || currentFile;
  const document = documents?.[fileName] ?? loadJsonDocument(fileName);
  return {
    fileName,
    schema: resolveJsonPointer(document, fragment ? `#${fragment}` : '#'),
  };
}
