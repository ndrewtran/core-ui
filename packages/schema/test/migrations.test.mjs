import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SchemaValidationError,
  canonicalJson,
  migrateBindingV1ToV2,
  migrateTokenSourceV1ToV2,
} from '../src/index.mjs';
import { webPlatformSafety } from './fixtures.mjs';

const theme = {
  name: 'default',
  modeAxes: {
    colorScheme: ['light', 'dark'],
    contrast: ['standard', 'more'],
    motion: ['full', 'reduced'],
    density: ['comfortable', 'compact'],
    direction: ['ltr', 'rtl'],
  },
  defaultModes: {
    colorScheme: 'light', contrast: 'standard', motion: 'full', density: 'comfortable', direction: 'ltr',
  },
  runtimeSwitching: 'unavailable',
};

const previousTokenSource = {
  schemaVersion: '1.0.0',
  id: 'core:token:button-minimum',
  kind: 'token',
  name: 'Button minimum tokens',
  summary: 'The previous token source.',
  lifecycle: 'experimental',
  tokenContractVersion: '1.0.0',
  tokens: {
    'semantic.action.background': { type: 'color', value: '#000000' },
  },
};

const metadata = {
  'semantic.action.background': {
    layer: 'semantic',
    unit: 'hex',
    meaning: 'Immediate action background.',
    overridePolicy: 'theme',
  },
};

test('G1.0 token-source v1-to-v2 migration is explicit, deterministic, and idempotent', () => {
  const migrated = migrateTokenSourceV1ToV2(previousTokenSource, {
    theme,
    tokenMetadata: metadata,
  });
  assert.equal(migrated.schemaVersion, '2.0.0');
  assert.equal(migrated.tokenContractVersion, '1.1.0');
  assert.equal(migrated.tokens['semantic.action.background'].layer, 'semantic');
  assert.equal(
    canonicalJson(migrateTokenSourceV1ToV2(migrated)),
    canonicalJson(migrated),
  );
  assert.throws(
    () => migrateTokenSourceV1ToV2(previousTokenSource, { theme, tokenMetadata: {} }),
    (error) => error instanceof SchemaValidationError && error.code === 'CORE_SCHEMA_MIGRATION_REQUIRED',
  );
});

test('G1.0 binding v1-to-v2 migration requires the binding-owned token recipe', () => {
  const previous = {
    schemaVersion: '1.0.0',
    lifecycle: 'experimental',
    strategy: 'direct',
    api: { props: [], events: [], parts: [], defaults: {} },
    behavior: [],
    accessibility: [],
    tokenSources: ['core:token:button-minimum'],
    runtimeProfiles: {},
  };
  const tokenRecipe = {
    source: 'core:token:button-minimum',
    requirements: [{ token: 'semantic.action.background', requirement: 'required' }],
  };
  const platformSafety = webPlatformSafety('web.react');
  const migrated = migrateBindingV1ToV2(previous, { tokenRecipe, platformSafety });
  assert.equal(migrated.schemaVersion, '2.0.0');
  assert.equal(Object.hasOwn(migrated, 'tokenSources'), false);
  assert.deepEqual(migrated.tokenRecipe, tokenRecipe);
  assert.deepEqual(migrated.platformSafety, platformSafety);
  assert.equal(canonicalJson(migrateBindingV1ToV2(migrated)), canonicalJson(migrated));
  assert.throws(
    () => migrateBindingV1ToV2(previous),
    (error) => error instanceof SchemaValidationError && error.code === 'CORE_SCHEMA_MIGRATION_REQUIRED',
  );
});

test('G1.0 unsupported binding migration requires its complete platform-safety declaration', () => {
  const previous = {
    schemaVersion: '1.0.0',
    strategy: 'unsupported',
    reason: 'No implementation is available.',
  };
  const platformSafety = webPlatformSafety('web.react').map((declaration) => ({
    ...declaration,
    requirements: declaration.requirements.map(({ id }) => ({
      id,
      disposition: 'not-applicable',
      reason: 'The binding is unsupported in G1.0.',
    })),
  }));
  const migrated = migrateBindingV1ToV2(previous, { platformSafety });
  assert.deepEqual(migrated.platformSafety, platformSafety);
  assert.throws(
    () => migrateBindingV1ToV2(previous),
    (error) => error instanceof SchemaValidationError && error.code === 'CORE_SCHEMA_MIGRATION_REQUIRED',
  );
});
