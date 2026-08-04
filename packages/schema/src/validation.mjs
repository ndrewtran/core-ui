import { canonicalJson } from './canonical.mjs';
import {
  loadFamilySchema,
  loadJsonDocument,
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

function evaluate(schema, value, path, currentFile, issues) {
  if (schema === true) return;
  if (schema === false) {
    issues.push({ path, message: 'is denied by the closed schema' });
    return;
  }
  if (schema.$ref) {
    const resolved = resolveSchemaReference(schema.$ref, currentFile);
    evaluate(resolved.schema, value, path, resolved.fileName, issues);
    return;
  }
  if (schema.allOf) {
    for (const item of schema.allOf) evaluate(item, value, path, currentFile, issues);
  }
  if (schema.anyOf) {
    const matches = schema.anyOf.some((item) => {
      const candidateIssues = [];
      evaluate(item, value, path, currentFile, candidateIssues);
      return candidateIssues.length === 0;
    });
    if (!matches) issues.push({ path, message: 'matches no allowed schema' });
    return;
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((item) => {
      const candidateIssues = [];
      evaluate(item, value, path, currentFile, candidateIssues);
      return candidateIssues.length === 0;
    }).length;
    if (matches !== 1) issues.push({ path, message: `must match exactly one schema; matched ${matches}` });
    return;
  }
  if (schema.not) {
    const candidateIssues = [];
    evaluate(schema.not, value, path, currentFile, candidateIssues);
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
        evaluate(schema.propertyNames, key, `${path}/{propertyName}`, currentFile, issues);
      }
      const propertySchema = schema.properties?.[key];
      if (propertySchema) {
        evaluate(propertySchema, value[key], `${path}/${key}`, currentFile, issues);
        continue;
      }
      const patternSchema = Object.entries(schema.patternProperties ?? {})
        .find(([pattern]) => new RegExp(pattern).test(key))?.[1];
      if (patternSchema) {
        evaluate(patternSchema, value[key], `${path}/${key}`, currentFile, issues);
      } else if (schema.additionalProperties === false) {
        issues.push({ path: `${path}/${key}`, message: 'is an unknown field' });
      } else if (isObject(schema.additionalProperties)) {
        evaluate(
          schema.additionalProperties,
          value[key],
          `${path}/${key}`,
          currentFile,
          issues,
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

function semanticIssues(family, value) {
  const issues = [];
  if (['binding', 'capability', 'component', 'example', 'guide', 'token-source'].includes(family)) {
    const ownership = loadJsonDocument('field-ownership.json');
    const forbidden = new Set(
      ownership.fields
        .filter((field) => field.forbiddenInAuthoredSource)
        .map((field) => field.name),
    );
    walkObjects(value, (object, path) => {
      for (const key of Object.keys(object)) {
        if (forbidden.has(key)) {
          issues.push({ path: `${path}/${key}`, message: 'is derived or proved and cannot be authored' });
        }
      }
      if (object.extensions && object.lifecycle !== 'experimental') {
        issues.push({ path: `${path}/extensions`, message: 'requires experimental lifecycle' });
      }
      if (object.strategy) {
        const runtimeProfile = path.includes('/runtimeProfiles/');
        const runtimeProfileId = runtimeProfile ? path.split('/').at(-1) : undefined;
        const expectedValidationProfiles = {
          ios: 'native.ios',
          android: 'native.android',
          'native.react-native-web': 'native.react-native-web',
        };
        if (object.strategy === 'unsupported') {
          if (object.lifecycle !== undefined || object.validationProfile !== undefined) {
            issues.push({ path, message: 'unsupported disposition must omit lifecycle and validationProfile' });
          }
          if (!object.reason && !object.alternative) {
            issues.push({ path, message: 'unsupported disposition requires a reason or alternative' });
          }
        } else {
          if (!object.lifecycle) issues.push({ path, message: 'implemented disposition requires lifecycle' });
          if (runtimeProfile && !object.validationProfile) {
            issues.push({ path, message: 'supported runtime profile requires validationProfile' });
          } else if (
            runtimeProfile
            && object.validationProfile !== expectedValidationProfiles[runtimeProfileId]
          ) {
            issues.push({
              path: `${path}/validationProfile`,
              message: `must equal ${expectedValidationProfiles[runtimeProfileId]}`,
            });
          }
        }
      }
    });
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

export function validateFamily(family, value) {
  const { fileName, schema } = loadFamilySchema(family);
  const issues = [];
  evaluate(schema, value, '$', fileName, issues);
  issues.push(...semanticIssues(family, value));
  if (issues.length > 0) throw new SchemaValidationError('CORE_SCHEMA_INVALID', issues);
  return value;
}

export function validateFieldOwnershipRegistry() {
  const registry = loadJsonDocument('field-ownership.json');
  const names = new Set();
  for (const field of registry.fields) {
    if (names.has(field.name)) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        { path: `$/fields/${field.name}`, message: 'has more than one owner declaration' },
      ]);
    }
    names.add(field.name);
    if (!registry.classes.includes(field.class) || !field.owner) {
      throw new SchemaValidationError('CORE_FIELD_OWNERSHIP_INVALID', [
        { path: `$/fields/${field.name}`, message: 'must have one known class and owner' },
      ]);
    }
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

export function validateCatalogRecords(records) {
  validateFieldOwnershipRegistry();
  validateRelationRegistry();
  const ids = new Map();
  for (const record of records) {
    const family = kindFamilies[record.kind];
    if (!family) {
      throw new SchemaValidationError('CORE_SCHEMA_INVALID', [
        { path: '$/kind', message: `${record.kind} record behavior is unavailable in G0.1` },
      ]);
    }
    validateFamily(family, record);
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
      for (const runtimeProfileId of example.binding.runtimeProfiles ?? []) {
        const runtimeProfile = binding.runtimeProfiles[runtimeProfileId];
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
