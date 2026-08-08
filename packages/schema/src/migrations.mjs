import { SchemaValidationError, validateFamily } from './validation.mjs';

function migrationError(path, message) {
  throw new SchemaValidationError('CORE_SCHEMA_MIGRATION_REQUIRED', [{ path, message }]);
}

function assertPlainObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    migrationError(path, 'must be an object');
  }
}

export function migrateTokenSourceV1ToV2(source, {
  theme,
  tokenMetadata,
  tokenContractVersion = '1.1.0',
} = {}) {
  assertPlainObject(source, '$');
  if (source.schemaVersion === '2.0.0') {
    validateFamily('token-source', source);
    return structuredClone(source);
  }
  if (source.schemaVersion !== '1.0.0') {
    migrationError('$/schemaVersion', `${source.schemaVersion} is not migratable`);
  }
  assertPlainObject(theme, '$migration/theme');
  assertPlainObject(tokenMetadata, '$migration/tokenMetadata');
  const tokens = {};
  for (const tokenId of Object.keys(source.tokens ?? {}).sort()) {
    const previous = source.tokens[tokenId];
    const metadata = tokenMetadata[tokenId];
    assertPlainObject(metadata, `$migration/tokenMetadata/${tokenId}`);
    const required = ['layer', 'unit', 'meaning', 'overridePolicy'];
    const missing = required.filter((field) => metadata[field] === undefined);
    if (missing.length > 0) {
      migrationError(`$migration/tokenMetadata/${tokenId}`, `missing authored decisions: ${missing.join(', ')}`);
    }
    if (previous.alias !== undefined && previous.value !== undefined && !['alias', 'value'].includes(metadata.source)) {
      migrationError(
        `$migration/tokenMetadata/${tokenId}/source`,
        'must choose alias or value for an ambiguous v1 token',
      );
    }
    const useAlias = previous.alias !== undefined && metadata.source !== 'value';
    tokens[tokenId] = {
      layer: metadata.layer,
      type: previous.type,
      unit: metadata.unit,
      meaning: metadata.meaning,
      overridePolicy: metadata.overridePolicy,
      ...(useAlias ? { alias: previous.alias } : { value: previous.value }),
      ...(metadata.equivalence === undefined ? {} : { equivalence: metadata.equivalence }),
      ...(metadata.modes === undefined ? {} : { modes: structuredClone(metadata.modes) }),
      ...(metadata.platformRestrictions === undefined
        ? {}
        : { platformRestrictions: [...metadata.platformRestrictions] }),
    };
  }
  const migrated = {
    ...structuredClone(source),
    schemaVersion: '2.0.0',
    tokenContractVersion,
    theme: structuredClone(theme),
    tokens,
  };
  validateFamily('token-source', migrated);
  return migrated;
}

export function migrateBindingV1ToV2(binding, { tokenRecipe, platformSafety } = {}) {
  assertPlainObject(binding, '$');
  if (binding.schemaVersion === '2.0.0') {
    validateFamily('binding', binding);
    return structuredClone(binding);
  }
  if (binding.schemaVersion !== '1.0.0') {
    migrationError('$/schemaVersion', `${binding.schemaVersion} is not migratable`);
  }
  const migrated = structuredClone(binding);
  migrated.schemaVersion = '2.0.0';
  delete migrated.tokenSources;
  if (migrated.strategy !== 'unsupported') {
    assertPlainObject(tokenRecipe, '$migration/tokenRecipe');
    if (!Array.isArray(platformSafety) || platformSafety.length === 0) {
      migrationError('$migration/platformSafety', 'must provide binding-owned declarations');
    }
    migrated.tokenRecipe = structuredClone(tokenRecipe);
    migrated.platformSafety = structuredClone(platformSafety);
  }
  validateFamily('binding', migrated);
  return migrated;
}

export function migrateComponentBindingsV1ToV2(component, { recipes = {}, platformSafety = {} } = {}) {
  assertPlainObject(component, '$');
  const migrated = structuredClone(component);
  migrated.bindings = Object.fromEntries(Object.entries(component.bindings ?? {}).map(
    ([bindingId, binding]) => [
      bindingId,
      migrateBindingV1ToV2(binding, {
        tokenRecipe: recipes[bindingId],
        platformSafety: platformSafety[bindingId],
      }),
    ],
  ));
  validateFamily('component', migrated);
  return migrated;
}
