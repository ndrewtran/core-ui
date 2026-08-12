import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
  sha256Digest,
} from '@core-ui/schema';

const PROFILE_PATH = 'tooling/audits/repository-policy/delivery-workflow-profile.json';
const PROFILE_SCHEMA_PATH = 'tooling/audits/repository-policy/delivery-workflow-profile.schema.json';
const SCHEMA_PATH = 'tooling/audits/repository-policy/delivery-workflow.schema.json';
const DIAGNOSTICS_PATH = 'tooling/audits/repository-policy/delivery-workflow-diagnostics.json';

export class DeliveryWorkflowError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'DeliveryWorkflowError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new DeliveryWorkflowError(code, message, details);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pointerPart(value) {
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

export function resolveDeliveryPointer(value, pointer) {
  if (pointer === '') return value;
  if (!pointer.startsWith('/')) fail('DELIVERY_PROFILE_INVALID', `invalid JSON pointer ${pointer}`);
  return pointer.slice(1).split('/').map(pointerPart).reduce((node, key) => node?.[key], value);
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

export function validateDeliverySchema(contract, value, {
  at = '',
  rootSchema = contract,
  schemaAt = '',
} = {}) {
  const issue = (message, pointer = at || '/') => fail(
    'DELIVERY_SCHEMA_INVALID',
    `${pointer} ${message}`,
    { pointer, schemaPointer: schemaAt || '/' },
  );
  if (contract.$ref) {
    const resolved = resolveDeliveryPointer(rootSchema, contract.$ref.slice(1));
    if (!resolved) issue(`has unresolved schema reference ${contract.$ref}`);
    return validateDeliverySchema(resolved, value, {
      at,
      rootSchema,
      schemaAt: contract.$ref.slice(1),
    });
  }
  if (contract.const !== undefined && !sameValue(value, contract.const)) {
    issue(`must equal ${canonicalJson(contract.const)}`);
  }
  if (contract.enum && !contract.enum.some((item) => sameValue(item, value))) {
    issue('must be an admitted enum value');
  }
  if (contract.type) {
    const types = Array.isArray(contract.type) ? contract.type : [contract.type];
    if (!types.some((type) => matchesType(value, type))) issue(`must be ${types.join(' or ')}`);
  }
  if (typeof value === 'string') {
    if (contract.minLength !== undefined && value.length < contract.minLength) issue(`must have length >= ${contract.minLength}`);
    if (contract.maxLength !== undefined && value.length > contract.maxLength) issue(`must have length <= ${contract.maxLength}`);
    if (contract.pattern && !(new RegExp(contract.pattern, 'u')).test(value)) issue(`must match ${contract.pattern}`);
    if (contract.format === 'date-time' && Number.isNaN(Date.parse(value))) issue('must be an RFC 3339 date-time');
  }
  if (typeof value === 'number' && contract.minimum !== undefined && value < contract.minimum) issue(`must be >= ${contract.minimum}`);
  if (typeof value === 'number' && contract.maximum !== undefined && value > contract.maximum) issue(`must be <= ${contract.maximum}`);
  if (Array.isArray(value)) {
    if (contract.minItems !== undefined && value.length < contract.minItems) issue(`must contain >= ${contract.minItems} items`);
    if (contract.maxItems !== undefined && value.length > contract.maxItems) issue(`must contain <= ${contract.maxItems} items`);
    if (contract.uniqueItems && new Set(value.map(canonicalJson)).size !== value.length) issue('must contain unique items');
    value.forEach((item, index) => validateDeliverySchema(contract.items ?? {}, item, {
      at: `${at}/${index}`,
      rootSchema,
      schemaAt: `${schemaAt}/items`,
    }));
  }
  if (isObject(value)) {
    for (const required of contract.required ?? []) {
      if (!Object.hasOwn(value, required)) issue(`is missing required field ${required}`, `${at}/${required}`);
    }
    for (const [key, item] of Object.entries(value)) {
      const child = contract.properties?.[key];
      if (!child) {
        if (contract.additionalProperties === false) issue(`contains unknown field ${key}`, `${at}/${key}`);
        continue;
      }
      validateDeliverySchema(child, item, {
        at: `${at}/${key}`,
        rootSchema,
        schemaAt: `${schemaAt}/properties/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      });
    }
  }
  if (contract.oneOf) {
    const matches = contract.oneOf.filter((candidate, index) => {
      try {
        validateDeliverySchema(candidate, value, { at, rootSchema, schemaAt: `${schemaAt}/oneOf/${index}` });
        return true;
      } catch {
        return false;
      }
    });
    if (matches.length !== 1) issue(`must match exactly one branch; matched ${matches.length}`);
  }
  if (contract.anyOf) {
    const matches = contract.anyOf.some((candidate, index) => {
      try {
        validateDeliverySchema(candidate, value, { at, rootSchema, schemaAt: `${schemaAt}/anyOf/${index}` });
        return true;
      } catch {
        return false;
      }
    });
    if (!matches) issue('must match at least one branch');
  }
  for (const rule of contract.allOf ?? []) {
    if (!rule.if) {
      validateDeliverySchema(rule, value, { at, rootSchema, schemaAt });
      continue;
    }
    let applies = false;
    try {
      validateDeliverySchema(rule.if, value, { at, rootSchema, schemaAt: `${schemaAt}/if` });
      applies = true;
    } catch {}
    if (applies && rule.then) validateDeliverySchema(rule.then, value, { at, rootSchema, schemaAt: `${schemaAt}/then` });
  }
  return value;
}

function collectTerminalFields(value, pointer = '', fields = []) {
  if (!isObject(value) && !Array.isArray(value)) return fields;
  if (value['x-core-ui-field-id']) {
    fields.push({
      classification: value['x-core-ui-classification'],
      domain: value['x-core-ui-domain'],
      id: value['x-core-ui-field-id'],
      pointer,
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('x-core-ui-')) continue;
    collectTerminalFields(child, `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, fields);
  }
  return fields;
}

async function readStrict(repositoryRoot, repositoryPath) {
  const bytes = await readFile(join(repositoryRoot, repositoryPath), 'utf8');
  return { bytes, value: parseJsonStrict(bytes) };
}

async function resolveOwners(repositoryRoot, references) {
  const owners = new Map();
  for (const reference of references) {
    const bytes = await readFile(join(repositoryRoot, reference.path), 'utf8');
    if (reference.selector === '/') parseJsonStrict(bytes);
    else if (reference.selector.startsWith('/')) {
      if (resolveDeliveryPointer(parseJsonStrict(bytes), reference.selector) === undefined) {
        fail('DELIVERY_OWNER_UNRESOLVED', `owner selector does not resolve: ${reference.id}`);
      }
    } else if (!bytes.includes(reference.selector)) {
      fail('DELIVERY_OWNER_UNRESOLVED', `owner heading does not resolve: ${reference.id}`);
    }
    owners.set(reference.id, {
      ...reference,
      bytes,
      digest: sha256Digest(bytes),
    });
  }
  return owners;
}

export async function loadDeliveryProfile(repositoryRoot) {
  const [schemaDocument, profileDocument, profileSchemaDocument, diagnosticsDocument] = await Promise.all([
    readStrict(repositoryRoot, SCHEMA_PATH),
    readStrict(repositoryRoot, PROFILE_PATH),
    readStrict(repositoryRoot, PROFILE_SCHEMA_PATH),
    readStrict(repositoryRoot, DIAGNOSTICS_PATH),
  ]);
  const { value: schema } = schemaDocument;
  const { value: profile } = profileDocument;
  const { value: profileSchema } = profileSchemaDocument;
  const { value: diagnostics } = diagnosticsDocument;
  if (profile.schemaSha256 !== sha256Digest(schemaDocument.bytes)) {
    fail('DELIVERY_PROFILE_INVALID', 'profile schema digest does not match delivery-workflow.schema.json');
  }
  if (profile.diagnosticContractDigest !== sha256Digest(diagnosticsDocument.bytes)) {
    fail('DELIVERY_PROFILE_INVALID', 'profile diagnostics digest does not match delivery-workflow-diagnostics.json');
  }
  validateDeliverySchema(profileSchema, profile, { rootSchema: profileSchema });
  const fields = collectTerminalFields(schema).sort((left, right) => Buffer.from(left.pointer).compare(Buffer.from(right.pointer)));
  const pointers = fields.map(({ pointer }) => pointer);
  if (new Set(pointers).size !== pointers.length || new Set(fields.map(({ id }) => id)).size !== fields.length) {
    fail('DELIVERY_PROFILE_INVALID', 'delivery schema field IDs and pointers must be unique');
  }
  const expectedDomains = Object.fromEntries(fields.map(({ domain, pointer }) => [pointer, domain]));
  const expectedClassifications = Object.fromEntries(fields.map(({ classification, pointer }) => [pointer, classification]));
  if (!sameValue(profile.fieldDomainMap, expectedDomains) || !sameValue(profile.fieldClassificationMap, expectedClassifications)) {
    fail('DELIVERY_PROFILE_INVALID', 'profile field maps do not exactly cover schema terminal fields');
  }
  for (const pointer of pointers) {
    const target = resolveDeliveryPointer(schema, pointer);
    if (!target?.['x-core-ui-field-id']) fail('DELIVERY_PROFILE_INVALID', `field map pointer is not terminal: ${pointer}`);
  }
  const owners = await resolveOwners(repositoryRoot, profile.ownerReferences);
  const rootManifest = parseJsonStrict(owners.get('root-command-owner').bytes);
  const repositoryPolicy = parseJsonStrict(owners.get('repository-policy-owner').bytes);
  const commands = new Map(Object.entries(rootManifest.scripts ?? {}).map(([id, scriptBody]) => {
    const value = {
      argv: ['pnpm', 'run', id],
      commandId: id,
      ownerDocumentDigest: owners.get('root-command-owner').digest,
      ownerRef: 'root-command-owner',
      profile: 'core-ui-owned-command-v1',
      scriptBody,
    };
    return [id, { digest: canonicalDigest(value), id: `root-command.${id.replaceAll(':', '.')}`, value }];
  }));
  const dependencyPreparation = repositoryPolicy.dependencyPreparation;
  if (!dependencyPreparation || dependencyPreparation.profile !== 'core-ui-dependency-preparation-command-v1') {
    fail('DELIVERY_PROFILE_INVALID', 'repository policy does not own dependency preparation');
  }
  return Object.freeze({
    commands,
    dependencyPreparation: Object.freeze({
      digest: canonicalDigest(dependencyPreparation),
      ownerRef: 'repository-policy-owner',
      value: dependencyPreparation,
    }),
    diagnostics,
    fields: Object.freeze(fields),
    owners,
    profile,
    schema,
  });
}

export function assertDeliveryRecordShape(contract, record) {
  validateDeliverySchema(contract.schema.$defs.workflowRecord, record, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/workflowRecord',
  });
  return record;
}
