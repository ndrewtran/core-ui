import { canonicalDigest } from './canonical.mjs';
import {
  loadFamilySchema,
  loadJsonDocument,
  resolveSchemaReference,
} from './contracts.mjs';
import { SchemaValidationError } from './validation.mjs';

const AUTHORING_FILES = Object.freeze({
  binding: 'binding.schema.json',
  component: 'component.schema.json',
});
const EFFECTS = new Set(['editorial', 'compatible', 'incompatible']);
const OPERATIONS = Object.freeze(['add', 'remove', 'replace']);
const REVISION_AXES = new Set(['content', 'binding-content', 'binding-spec']);
const AUTOFIXES = new Set(['trim-outer-whitespace']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(segment) {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function unescapePointer(segment) {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

function pathSegments(path) {
  if (path === '$' || path === '' || path === '#') return [];
  const normalized = path.startsWith('$/')
    ? path.slice(2)
    : path.startsWith('/')
      ? path.slice(1)
      : path;
  return normalized.split('/').filter(Boolean).map(unescapePointer);
}

function schemaAt(fileName, schemas) {
  return schemas?.[fileName] ?? loadJsonDocument(fileName);
}

function completionFor(schema, required) {
  return {
    required,
    ...(schema.const === undefined ? {} : { literal: structuredClone(schema.const) }),
    ...(schema.enum === undefined ? {} : { values: structuredClone(schema.enum) }),
    ...(schema.type === undefined ? {} : { type: structuredClone(schema.type) }),
    ...(schema.pattern === undefined ? {} : { pattern: schema.pattern }),
    ...(schema.items?.type === undefined ? {} : { itemType: schema.items.type }),
  };
}

function normalizeAnnotation(annotation, path) {
  const issues = [];
  if (!isObject(annotation)) {
    issues.push({ path, message: 'is missing x-core-ui-authoring metadata' });
  } else {
    const allowed = new Set(['effect', 'effects', 'revisionAxes', 'autofixes']);
    const unknown = Object.keys(annotation).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
      issues.push({ path, message: `has unknown authoring keys: ${unknown.join(', ')}` });
    }
    const hasEffect = EFFECTS.has(annotation.effect);
    const hasEffects = isObject(annotation.effects)
      && OPERATIONS.every((operation) => EFFECTS.has(annotation.effects[operation]))
      && Object.keys(annotation.effects).length === OPERATIONS.length;
    if (hasEffect === hasEffects) {
      issues.push({ path, message: 'must declare exactly one effect or complete effects map' });
    }
    if (
      !Array.isArray(annotation.revisionAxes)
      || annotation.revisionAxes.length === 0
      || new Set(annotation.revisionAxes).size !== annotation.revisionAxes.length
      || annotation.revisionAxes.some((axis) => !REVISION_AXES.has(axis))
    ) {
      issues.push({ path, message: 'must declare unique supported revisionAxes' });
    }
    if (
      annotation.autofixes !== undefined
      && (
        !Array.isArray(annotation.autofixes)
        || new Set(annotation.autofixes).size !== annotation.autofixes.length
        || annotation.autofixes.some((autofix) => !AUTOFIXES.has(autofix))
      )
    ) {
      issues.push({ path, message: 'declares an unsupported or duplicate autofix' });
    }
  }
  if (issues.length > 0) {
    throw new SchemaValidationError('CORE_SCHEMA_INVALID', issues);
  }
  return {
    effects: Object.fromEntries(OPERATIONS.map((operation) => [
      operation,
      annotation.effect ?? annotation.effects[operation],
    ])),
    revisionAxes: [...annotation.revisionAxes],
    autofixes: [...(annotation.autofixes ?? [])],
  };
}

function collectProperties({
  family,
  fileName,
  node,
  pointer = '#',
  declarations,
}) {
  if (!isObject(node)) return;
  if (isObject(node.properties)) {
    const required = new Set(node.required ?? []);
    for (const [field, propertySchema] of Object.entries(node.properties)) {
      const schemaPointer = `${pointer}/properties/${escapePointer(field)}`;
      const authoring = normalizeAnnotation(
        propertySchema['x-core-ui-authoring'],
        `${schemaPointer}/x-core-ui-authoring`,
      );
      declarations.push({
        family,
        field,
        schema: fileName,
        schemaPointer,
        completion: completionFor(propertySchema, required.has(field)),
        ...authoring,
      });
      collectProperties({
        family,
        fileName,
        node: propertySchema,
        pointer: schemaPointer,
        declarations,
      });
    }
  }
  if (isObject(node.$defs)) {
    for (const [name, definition] of Object.entries(node.$defs)) {
      collectProperties({
        family,
        fileName,
        node: definition,
        pointer: `${pointer}/$defs/${escapePointer(name)}`,
        declarations,
      });
    }
  }
}

function declarationsFor(family, schemas) {
  const fileName = AUTHORING_FILES[family];
  if (!fileName) {
    throw new Error(`CORE_SCHEMA_INVALID: authoring metadata unavailable for ${family}`);
  }
  const declarations = [];
  collectProperties({
    family,
    fileName,
    node: schemaAt(fileName, schemas),
    declarations,
  });
  return declarations;
}

export function validateAuthoringMetadata({ schemas, ownership } = {}) {
  const declarations = Object.keys(AUTHORING_FILES)
    .flatMap((family) => declarationsFor(family, schemas));
  const registry = ownership ?? loadJsonDocument('field-ownership.json');
  const owners = new Map(registry.fields.map((field) => [
    `${field.schema}${field.schemaPointer}`,
    field,
  ]));
  for (const declaration of declarations) {
    const owner = owners.get(`${declaration.schema}${declaration.schemaPointer}`);
    if (!owner) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [{
        path: `${declaration.schema}${declaration.schemaPointer}`,
        message: 'authoring metadata must resolve to the existing field owner',
      }]);
    }
  }
  return declarations.map((declaration) => Object.freeze(structuredClone(declaration)));
}

export function authoringMetadata(family) {
  validateAuthoringMetadata();
  return Object.freeze(declarationsFor(family).map((declaration) => (
    Object.freeze(structuredClone(declaration))
  )));
}

function referenceTarget(reference, currentFile) {
  const [filePart, fragment = ''] = reference.split('#');
  return {
    fileName: filePart || currentFile,
    pointer: fragment ? `#${fragment}` : '#',
    schema: resolveSchemaReference(reference, currentFile).schema,
  };
}

function findProperty(node, fileName, pointer, segment, visited = new Set()) {
  if (!isObject(node)) return null;
  const visitKey = `${fileName}${pointer}:${segment}`;
  if (visited.has(visitKey)) return null;
  visited.add(visitKey);
  if (isObject(node.properties) && Object.hasOwn(node.properties, segment)) {
    return {
      fileName,
      pointer: `${pointer}/properties/${escapePointer(segment)}`,
      schema: node.properties[segment],
    };
  }
  if (node.$ref) {
    const target = referenceTarget(node.$ref, fileName);
    const found = findProperty(
      target.schema,
      target.fileName,
      target.pointer,
      segment,
      visited,
    );
    if (found) return found;
  }
  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    for (const [index, child] of (node[keyword] ?? []).entries()) {
      const found = findProperty(
        child,
        fileName,
        `${pointer}/${keyword}/${index}`,
        segment,
        visited,
      );
      if (found) return found;
    }
  }
  return null;
}

function ownerFor(fileName, schemaPointer) {
  const field = loadJsonDocument('field-ownership.json').fields.find((entry) => (
    entry.schema === fileName && entry.schemaPointer === schemaPointer
  ));
  if (!field) {
    throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [{
      path: `${fileName}${schemaPointer}`,
      message: 'has no canonical field owner',
    }]);
  }
  return field.owner;
}

export function resolveAuthoringField(family, path) {
  validateAuthoringMetadata();
  const { fileName, schema } = loadFamilySchema(family);
  let current = { fileName, pointer: '#', schema };
  let resolved = null;
  for (const segment of pathSegments(path)) {
    if (Array.isArray(current.schema) || /^\d+$/u.test(segment)) {
      if (current.schema?.items) {
        current = {
          fileName: current.fileName,
          pointer: `${current.pointer}/items`,
          schema: current.schema.items,
        };
      }
      continue;
    }
    const property = findProperty(
      current.schema,
      current.fileName,
      current.pointer,
      segment,
    );
    if (!property) break;
    const authoring = normalizeAnnotation(
      property.schema['x-core-ui-authoring'],
      `${property.pointer}/x-core-ui-authoring`,
    );
    resolved = {
      family,
      field: segment,
      schema: property.fileName,
      schemaPointer: property.pointer,
      owner: ownerFor(property.fileName, property.pointer),
      completion: completionFor(property.schema, false),
      ...authoring,
    };
    current = property;
  }
  if (!resolved) {
    throw new SchemaValidationError('CORE_SCHEMA_INVALID', [{
      path,
      message: 'does not resolve to schema-owned authoring metadata',
    }]);
  }
  return Object.freeze(structuredClone(resolved));
}

export function authoringMetadataDigest() {
  return canonicalDigest(validateAuthoringMetadata());
}
