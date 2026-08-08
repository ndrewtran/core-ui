import { canonicalJson } from './canonical.mjs';
import {
  loadFamilySchema,
  loadJsonDocument,
  requiredFieldOwnershipContexts,
  requiredReservedFields,
  resolveSchemaReference,
} from './contracts.mjs';

export class SchemaValidationError extends Error {
  constructor(code, issues) {
    super(`${code}: ${issues.map(({ path, message }) => `${path} ${message}`).join('; ')}`);
    this.name = 'SchemaValidationError';
    this.code = code;
    this.issues = issues;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function evaluate(schema, value, path, currentFile, issues, documents) {
  if (schema === true) return;
  if (schema === false) {
    issues.push({ path, message: 'is denied by the closed schema' });
    return;
  }
  if (schema.$ref) {
    const resolved = resolveSchemaReference(schema.$ref, currentFile, documents);
    evaluate(resolved.schema, value, path, resolved.fileName, issues, documents);
  }
  if (schema.allOf) {
    for (const item of schema.allOf) evaluate(item, value, path, currentFile, issues, documents);
  }
  if (schema.anyOf) {
    const matches = schema.anyOf.some((item) => {
      const candidateIssues = [];
      evaluate(item, value, path, currentFile, candidateIssues, documents);
      return candidateIssues.length === 0;
    });
    if (!matches) issues.push({ path, message: 'matches no allowed schema' });
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((item) => {
      const candidateIssues = [];
      evaluate(item, value, path, currentFile, candidateIssues, documents);
      return candidateIssues.length === 0;
    }).length;
    if (matches !== 1) issues.push({ path, message: `must match exactly one schema; matched ${matches}` });
  }
  if (schema.not) {
    const candidateIssues = [];
    evaluate(schema.not, value, path, currentFile, candidateIssues, documents);
    if (candidateIssues.length === 0) issues.push({ path, message: 'matches a forbidden schema' });
  }
  if (schema.const !== undefined && !sameValue(value, schema.const)) {
    issues.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
    return;
  }
  if (schema.enum && !schema.enum.some((item) => sameValue(value, item))) {
    issues.push({ path, message: `must be one of ${schema.enum.join(', ')}` });
    return;
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      issues.push({ path, message: `must be ${types.join(' or ')}` });
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `must have length at least ${schema.minLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      issues.push({ path, message: `does not match ${schema.pattern}` });
    }
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    issues.push({ path, message: `must be at least ${schema.minimum}` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push({ path, message: `must contain at least ${schema.minItems} items` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      issues.push({ path, message: `must contain at most ${schema.maxItems} items` });
    }
    if (schema.uniqueItems) {
      const unique = new Set(value.map((item) => canonicalJson(item)));
      if (unique.size !== value.length) issues.push({ path, message: 'must contain unique items' });
    }
    if (schema.items) {
      value.forEach((item, index) => evaluate(
        schema.items,
        item,
        `${path}/${index}`,
        currentFile,
        issues,
        documents,
      ));
    }
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      issues.push({ path, message: `must contain at least ${schema.minProperties} properties` });
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        issues.push({ path, message: `is missing required field ${required}` });
      }
    }
    for (const key of keys) {
      if (schema.propertyNames) {
        evaluate(schema.propertyNames, key, `${path}/{propertyName}`, currentFile, issues, documents);
      }
      const propertySchema = Object.hasOwn(schema.properties ?? {}, key)
        ? schema.properties[key]
        : undefined;
      if (propertySchema !== undefined) {
        evaluate(propertySchema, value[key], `${path}/${key}`, currentFile, issues, documents);
        continue;
      }
      const patternSchema = Object.entries(schema.patternProperties ?? {})
        .find(([pattern]) => new RegExp(pattern).test(key))?.[1];
      if (patternSchema) {
        evaluate(patternSchema, value[key], `${path}/${key}`, currentFile, issues, documents);
      } else if (schema.additionalProperties === false) {
        issues.push({ path: `${path}/${key}`, message: 'is an unknown field' });
      } else if (isObject(schema.additionalProperties)) {
        evaluate(
          schema.additionalProperties,
          value[key],
          `${path}/${key}`,
          currentFile,
          issues,
          documents,
        );
      }
    }
  }
}

function walkObjects(value, visit, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkObjects(item, visit, `${path}/${index}`));
  } else if (isObject(value)) {
    visit(value, path);
    for (const [key, item] of Object.entries(value)) {
      walkObjects(item, visit, `${path}/${key}`);
    }
  }
}

function semanticIssues(family, value, ownership) {
  const issues = [];
  const prototypeKeys = new Set(['__proto__', 'constructor', 'prototype']);
  walkObjects(value, (object, path) => {
    for (const key of Object.keys(object)) {
      if (prototypeKeys.has(key)) {
        issues.push({ path: `${path}/${key}`, message: 'prototype-bearing keys are forbidden' });
      }
    }
  });
  if (['binding', 'capability', 'component', 'example', 'guide', 'token-source'].includes(family)) {
    const ownershipRegistry = ownership ?? loadJsonDocument('field-ownership.json');
    const forbidden = new Set(
      [...ownershipRegistry.fields, ...(ownershipRegistry.reservedFields ?? [])]
        .filter((field) => field.forbiddenInAuthoredSource)
        .map((field) => field.name),
    );
    const sourceContexts = [{ object: value, path: '$' }];
    const bindingContexts = [];
    if (family === 'binding') {
      bindingContexts.push({ object: value, path: '$' });
    } else if (family === 'component') {
      for (const [bindingId, binding] of Object.entries(value.bindings ?? {})) {
        bindingContexts.push({ object: binding, path: `$/bindings/${bindingId}` });
      }
    }
    const runtimeProfileContexts = bindingContexts.flatMap(({ object, path }) =>
      Object.entries(object.runtimeProfiles ?? {}).map(([runtimeProfileId, runtimeProfile]) => ({
        object: runtimeProfile,
        path: `${path}/runtimeProfiles/${runtimeProfileId}`,
        runtimeProfileId,
      })));
    sourceContexts.push(...bindingContexts, ...runtimeProfileContexts);
    const uniqueSourceContexts = new Map(
      sourceContexts.map((context) => [context.path, context]),
    );
    for (const { object, path } of uniqueSourceContexts.values()) {
      for (const key of Object.keys(object)) {
        if (forbidden.has(key)) {
          issues.push({ path: `${path}/${key}`, message: 'is derived or proved and cannot be authored' });
        }
      }
      if (object.extensions && object.lifecycle !== 'experimental') {
        issues.push({ path: `${path}/extensions`, message: 'requires experimental lifecycle' });
      }
    }
    for (const { object, path, runtimeProfileId } of [
      ...bindingContexts,
      ...runtimeProfileContexts,
    ]) {
      if (object.strategy) {
        const runtimeProfile = runtimeProfileId !== undefined;
        const expectedValidationProfiles = {
          ios: 'native.ios',
          android: 'native.android',
          'native.react-native-web': 'native.react-native-web',
        };
        if (object.strategy === 'unsupported') {
          if (object.lifecycle !== undefined || object.validationProfile !== undefined) {
            issues.push({ path, message: 'unsupported disposition must omit lifecycle and validationProfile' });
          }
          if (!object.reason) {
            issues.push({ path, message: 'unsupported disposition requires a reason' });
          }
        } else {
          if (object.reason !== undefined || object.alternative !== undefined) {
            issues.push({ path, message: 'implemented disposition must omit reason and alternative' });
          }
          if (!object.lifecycle) issues.push({ path, message: 'implemented disposition requires lifecycle' });
          if (runtimeProfile && !object.validationProfile) {
            issues.push({ path, message: 'supported runtime profile requires validationProfile' });
          } else if (
            runtimeProfile
            && object.validationProfile !== (
              Object.hasOwn(expectedValidationProfiles, runtimeProfileId)
                ? expectedValidationProfiles[runtimeProfileId]
                : undefined
            )
          ) {
            issues.push({
              path: `${path}/validationProfile`,
              message: `must equal ${
                Object.hasOwn(expectedValidationProfiles, runtimeProfileId)
                  ? expectedValidationProfiles[runtimeProfileId]
                  : 'a declared validation profile'
              }`,
            });
          }
        }
      }
    }
  }
  if (family === 'example') {
    const implementationPurposes = new Set(['generation', 'validation', 'migration']);
    if (
      value.binding?.guidanceImpact === 'editorial'
      && value.binding.purposes?.some((purpose) => implementationPurposes.has(purpose))
    ) {
      issues.push({
        path: '$/binding/guidanceImpact',
        message: 'implementation-relevant examples must be normative',
      });
    }
  }
  if (family === 'component') {
    const requiredNativeProfiles = ['ios', 'android', 'native.react-native-web'];
    for (const [bindingId, binding] of Object.entries(value.bindings ?? {})) {
      const runtimeProfileIds = Object.keys(binding.runtimeProfiles ?? {});
      if (bindingId !== 'native.react-native' && runtimeProfileIds.length > 0) {
        issues.push({
          path: `$/bindings/${bindingId}/runtimeProfiles`,
          message: 'runtime profiles are owned only by native.react-native',
        });
      }
      if (bindingId === 'native.react-native' && binding.strategy !== 'unsupported') {
        for (const profileId of requiredNativeProfiles) {
          if (!runtimeProfileIds.includes(profileId)) {
            issues.push({
              path: `$/bindings/${bindingId}/runtimeProfiles`,
              message: `is missing required disposition ${profileId}`,
            });
          }
        }
      }
    }
  }
  return issues;
}

export function validateFamily(family, value, { schemas, ownership } = {}) {
  const { fileName, schema } = loadFamilySchema(family, schemas);
  const issues = [];
  evaluate(schema, value, '$', fileName, issues, schemas);
  issues.push(...semanticIssues(family, value, ownership));
  if (issues.length > 0) throw new SchemaValidationError('CORE_SCHEMA_INVALID', issues);
  return value;
}

function escapeJsonPointer(segment) {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function collectSchemaFieldDeclarations(schema, pointer = '#', declarations = []) {
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => collectSchemaFieldDeclarations(
      item,
      `${pointer}/${index}`,
      declarations,
    ));
    return declarations;
  }
  if (!isObject(schema)) return declarations;
  for (const [keyword, value] of Object.entries(schema)) {
    const keywordPointer = `${pointer}/${escapeJsonPointer(keyword)}`;
    if (keyword === 'properties' && isObject(value)) {
      for (const [name, propertySchema] of Object.entries(value)) {
        const schemaPointer = `${keywordPointer}/${escapeJsonPointer(name)}`;
        declarations.push({ name, schemaPointer });
        collectSchemaFieldDeclarations(propertySchema, schemaPointer, declarations);
      }
    } else {
      collectSchemaFieldDeclarations(value, keywordPointer, declarations);
    }
  }
  return declarations;
}

export function validateFieldOwnershipRegistry(
  registry = loadJsonDocument('field-ownership.json'),
  { schemas } = {},
) {
  if (!Array.isArray(registry.classes) || !Array.isArray(registry.fields)) {
    throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
      { path: '$', message: 'must declare classes and contextual fields' },
    ]);
  }
  const requiredContexts = new Map(
    requiredFieldOwnershipContexts.map((context) => [context.file, context]),
  );
  const contexts = new Map();
  for (const governed of registry.governedSchemas ?? []) {
    const requiredContext = requiredContexts.get(governed.file);
    if (
      contexts.has(governed.file)
      || !registry.classes.includes(governed.class)
      || !governed.owner
      || governed.class !== requiredContext?.class
      || governed.owner !== requiredContext?.owner
    ) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        {
          path: `$/governedSchemas/${governed.file}`,
          message: 'must match the locked canonical class and owner',
        },
      ]);
    }
    contexts.set(governed.file, governed);
  }
  if (
    contexts.size !== requiredFieldOwnershipContexts.length
    || requiredFieldOwnershipContexts.some(({ file }) => !contexts.has(file))
  ) {
    throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
      {
        path: '$/governedSchemas',
        message: `must cover the locked schemas: ${requiredFieldOwnershipContexts
          .map(({ file }) => file)
          .join(', ')}`,
      },
    ]);
  }
  const expected = new Map();
  for (const governed of contexts.values()) {
    for (const declaration of collectSchemaFieldDeclarations(
      schemas?.[governed.file] ?? loadJsonDocument(governed.file),
    )) {
      const key = `${governed.file}${declaration.schemaPointer}`;
      expected.set(key, { ...declaration, ...governed });
    }
  }
  const declared = new Set();
  for (const field of registry.fields) {
    const key = `${field.schema}${field.schemaPointer}`;
    const context = expected.get(key);
    if (declared.has(key)) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        { path: `$/fields/${key}`, message: 'has more than one owner declaration' },
      ]);
    }
    declared.add(key);
    if (
      !context
      || field.name !== context.name
      || field.class !== context.class
      || field.owner !== context.owner
    ) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        {
          path: `$/fields/${key}`,
          message: 'must match one governed schema field, class, and canonical owner',
        },
      ]);
    }
  }
  for (const key of expected.keys()) {
    if (!declared.has(key)) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        { path: `$/fields/${key}`, message: 'is missing an ownership declaration' },
      ]);
    }
  }
  const requiredReserved = new Map(
    requiredReservedFields.map((field) => [field.name, field]),
  );
  const reservedNames = new Set();
  for (const field of registry.reservedFields ?? []) {
    const requiredField = requiredReserved.get(field.name);
    if (
      reservedNames.has(field.name)
      || !registry.classes.includes(field.class)
      || !field.owner
      || field.class !== requiredField?.class
      || field.owner !== requiredField?.owner
      || field.forbiddenInAuthoredSource !== requiredField?.forbiddenInAuthoredSource
    ) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        {
          path: `$/reservedFields/${field.name}`,
          message: 'must match one locked reserved class, owner, and authored-source prohibition',
        },
      ]);
    }
    reservedNames.add(field.name);
  }
  if (
    reservedNames.size !== requiredReservedFields.length
    || requiredReservedFields.some(({ name }) => !reservedNames.has(name))
  ) {
    throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
      {
        path: '$/reservedFields',
        message: `must cover the locked reserved fields: ${requiredReservedFields
          .map(({ name }) => name)
          .join(', ')}`,
      },
    ]);
  }
  return registry;
}

export function validateRelationRegistry() {
  const registrySchema = loadJsonDocument('relation.schema.json');
  const registry = {
    schemaVersion: registrySchema.schemaVersion,
    relations: registrySchema['x-core-ui-registry'],
  };
  const issues = [];
  evaluate(registrySchema, registry, '$', 'relation.schema.json', issues);
  if (issues.length > 0) throw new SchemaValidationError('CORE_RELATION_INVALID', issues);
  return registry;
}

const kindFamilies = Object.freeze({
  capability: 'capability',
  component: 'component',
  example: 'example',
  guide: 'guide',
  token: 'token-source',
});

export function relationEdges(records) {
  const edges = [];
  for (const record of records) {
    if (record.kind === 'component') {
      for (const [bindingId, binding] of Object.entries(record.bindings)) {
        const bindingRef = `${record.id}#${bindingId}`;
        edges.push({ type: 'implemented-by', source: record.id, target: bindingRef });
        for (const token of binding.tokenSources ?? []) {
          edges.push({ type: 'uses', source: bindingRef, target: token });
        }
      }
    } else if (record.kind === 'example') {
      edges.push({ type: 'example-of', source: record.id, target: record.binding.ref });
    } else if (record.kind === 'capability') {
      for (const target of record.availableOn) {
        edges.push({ type: 'available-on', source: record.id, target });
      }
    }
  }
  return edges;
}

export function validateCatalogRecords(records, { schemas, ownership } = {}) {
  validateFieldOwnershipRegistry(
    ownership ?? loadJsonDocument('field-ownership.json'),
    { schemas },
  );
  validateRelationRegistry();
  const ids = new Map();
  for (const record of records) {
    const family = Object.hasOwn(kindFamilies, record.kind)
      ? kindFamilies[record.kind]
      : undefined;
    if (!family) {
      throw new SchemaValidationError('CORE_SCHEMA_INVALID', [
        { path: '$/kind', message: `${record.kind} record behavior is unavailable in G0.1` },
      ]);
    }
    validateFamily(family, record, { schemas, ownership });
    if (ids.has(record.id)) {
      throw new SchemaValidationError('CORE_ARTIFACT_ID_INVALID', [
        { path: '$/id', message: `${record.id} is duplicated` },
      ]);
    }
    ids.set(record.id, record);
  }

  const bindingRefs = new Map();
  for (const record of records.filter(({ kind }) => kind === 'component')) {
    for (const [bindingId, binding] of Object.entries(record.bindings)) {
      bindingRefs.set(`${record.id}#${bindingId}`, binding);
    }
  }
  const issues = [];
  for (const record of records) {
    if (record.kind === 'example') {
      for (const prerequisite of record.prerequisites) {
        if (!ids.has(prerequisite)) {
          issues.push({
            path: '$/prerequisites',
            message: `${prerequisite} does not exist`,
          });
        }
      }
    }
    if (record.kind === 'component') {
      for (const [bindingId, binding] of Object.entries(record.bindings)) {
        const alternatives = [
          binding.alternative,
          ...Object.values(binding.runtimeProfiles ?? {}).map((profile) => profile.alternative),
        ].filter(Boolean);
        for (const alternative of alternatives) {
          if (!ids.has(alternative)) {
            issues.push({
              path: `$/bindings/${bindingId}/alternative`,
              message: `${alternative} does not exist`,
            });
          }
        }
      }
    }
  }
  for (const edge of relationEdges(records)) {
    if (edge.type === 'implemented-by' && !bindingRefs.has(edge.target)) {
      issues.push({ path: '$/relations', message: `${edge.target} does not exist` });
    } else if (edge.type === 'example-of' && !bindingRefs.has(edge.target)) {
      issues.push({ path: '$/binding/ref', message: `${edge.target} does not exist` });
    } else if (edge.type === 'example-of') {
      const example = ids.get(edge.source);
      const binding = bindingRefs.get(edge.target);
      if (binding.strategy === 'unsupported') {
        issues.push({
          path: '$/binding/ref',
          message: `${edge.target} is unsupported and cannot own an example`,
        });
      }
      const targetProfiles = binding.runtimeProfiles ?? {};
      for (const runtimeProfileId of example.binding.runtimeProfiles ?? []) {
        const runtimeProfile = Object.hasOwn(targetProfiles, runtimeProfileId)
          ? targetProfiles[runtimeProfileId]
          : undefined;
        if (!runtimeProfile || runtimeProfile.strategy === 'unsupported') {
          issues.push({
            path: '$/binding/runtimeProfiles',
            message: `${runtimeProfileId} is not supported by ${edge.target}`,
          });
        }
      }
    } else if (edge.type === 'uses' && !ids.has(edge.target)) {
      issues.push({ path: '$/tokenSources', message: `${edge.target} does not exist` });
    }
  }
  if (issues.length > 0) throw new SchemaValidationError('CORE_RELATION_INVALID', issues);
  return { records, edges: relationEdges(records) };
}

export function assertAppendOnlyErrorCodes(previousCodes, nextCodes) {
  const missing = previousCodes.filter((code) => !nextCodes.includes(code));
  if (missing.length > 0) {
    throw new SchemaValidationError('CORE_SCHEMA_VERSION_UNSUPPORTED', [
      { path: '$/errorCodes', message: `removed append-only codes: ${missing.join(', ')}` },
    ]);
  }
  return nextCodes;
}
