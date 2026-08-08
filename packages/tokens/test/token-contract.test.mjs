import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseJsonStrict } from '@core-ui/schema';
import {
  TokenContractError,
  compileNativeTheme,
  compileTokenGraph,
  compileTokenRequirementSet,
  compileWebTheme,
  validateThemeForRequirementSet,
} from '../src/index.mjs';
import { consumeButtonStaticWebTransform } from '../../../tests/fixtures/g1.0/consumers/button-web.consumer.mjs';
import { consumeButtonStaticNativeTransform } from '../../../tests/fixtures/g1.0/consumers/button-native.consumer.mjs';

const source = parseJsonStrict(await readFile(
  new URL('../../../catalog/tokens/button-minimum.json', import.meta.url),
  'utf8',
));
const recipe = {
  source: source.id,
  requirements: [
    { token: 'component.button.background', requirement: 'required' },
    { token: 'component.button.foreground', requirement: 'required' },
  ],
};

function expectCode(code, operation) {
  assert.throws(operation, (error) => error instanceof TokenContractError && error.code === code);
}

test('E-G1.0-01 rejects cycles, reverse layers, incompatible units, and overrides', () => {
  const cycle = structuredClone(source);
  cycle.tokens['semantic.test.a'] = {
    layer: 'semantic', type: 'color', unit: 'hex', meaning: 'Cycle A.', overridePolicy: 'fixed',
    alias: 'semantic.test.b', equivalence: 'semantic-equivalence',
  };
  cycle.tokens['semantic.test.b'] = {
    layer: 'semantic', type: 'color', unit: 'hex', meaning: 'Cycle B.', overridePolicy: 'fixed',
    alias: 'semantic.test.a', equivalence: 'semantic-equivalence',
  };
  expectCode('CORE_TOKEN_ALIAS_CYCLE', () => compileTokenGraph(cycle));

  const reverse = structuredClone(source);
  delete reverse.tokens['reference.color.action-dark'].value;
  reverse.tokens['reference.color.action-dark'].alias = 'semantic.action.background';
  expectCode('CORE_TOKEN_LAYER_DIRECTION', () => compileTokenGraph(reverse));

  const incompatible = structuredClone(source);
  incompatible.tokens['semantic.action.background'].unit = 'px';
  expectCode('CORE_TOKEN_TYPE_MISMATCH', () => compileTokenGraph(incompatible));

  expectCode('CORE_TOKEN_OVERRIDE_UNAUTHORIZED', () => compileTokenGraph(source, {
    overrides: {
      'reference.color.action-dark': { type: 'color', unit: 'hex', value: '#000000' },
    },
  }));
});

test('E-G1.0-02 web and native transforms retain canonical provenance without cross-target authority', () => {
  const web = compileWebTheme(source);
  const react = compileWebTheme(source);
  const ios = compileNativeTheme(source, { profile: 'native.ios' });
  const android = compileNativeTheme(source, { profile: 'native.android' });
  assert.equal(web.css, react.css);
  assert.equal(web.css.includes('--core-reference-'), false);
  assert.equal(Object.keys(ios.theme).some((id) => id.startsWith('reference.')), false);
  assert.equal(Object.hasOwn(ios, 'css'), false);
  assert.equal(ios.provenance.digest, web.provenance.digest);
  assert.equal(android.provenance.digest, web.provenance.digest);
  consumeButtonStaticWebTransform(web, { target: 'web.html' });
  consumeButtonStaticWebTransform(react, { target: 'web.react' });
  consumeButtonStaticNativeTransform(ios, { profile: 'native.ios' });
  consumeButtonStaticNativeTransform(android, { profile: 'native.android' });
  for (const profile of ['native.ios', 'native.android']) {
    for (const field of ['css', 'cssSource']) {
      expectCode('CORE_TOKEN_OPTIONS_INVALID', () => compileNativeTheme(source, {
        profile,
        [field]: ':root {}',
      }));
    }
  }
});

test('E-G1.0-03 missing required tokens fail per profile and exact proved fallbacks diagnose use', () => {
  for (const profile of ['web.html', 'web.react', 'native.ios', 'native.android']) {
    const set = compileTokenRequirementSet({ source, recipe, bindingId: 'button', profile });
    expectCode('CORE_TOKEN_REQUIRED_MISSING', () => validateThemeForRequirementSet({
      requirementSet: set,
      values: {},
    }));
  }

  const fallbackRecipe = structuredClone(recipe);
  fallbackRecipe.requirements[0].fallback = {
    kind: 'value',
    profiles: ['web.html'],
    evidenceIds: ['E-G1.0-03'],
    type: 'color',
    unit: 'hex',
    value: '#000000',
  };
  const set = compileTokenRequirementSet({
    source,
    recipe: fallbackRecipe,
    bindingId: 'web.html',
    profile: 'web.html',
  });
  const result = validateThemeForRequirementSet({
    requirementSet: set,
    values: { 'component.button.foreground': '#ffffff' },
  });
  assert.equal(result.diagnostics[0].code, 'CORE_TOKEN_FALLBACK_USED');
  assert.equal(result.diagnostics[0].profile, 'web.html');

  const otherProfile = compileTokenRequirementSet({
    source,
    recipe: fallbackRecipe,
    bindingId: 'web.react',
    profile: 'web.react',
  });
  expectCode('CORE_TOKEN_REQUIRED_MISSING', () => validateThemeForRequirementSet({
    requirementSet: otherProfile,
    values: { 'component.button.foreground': '#ffffff' },
  }));

  const tokenFallbackRecipe = structuredClone(recipe);
  tokenFallbackRecipe.requirements[0].fallback = {
    kind: 'token',
    profiles: ['web.html'],
    evidenceIds: ['E-G1.0-03'],
    token: 'semantic.action.background',
  };
  const tokenFallbackSet = compileTokenRequirementSet({
    source,
    recipe: tokenFallbackRecipe,
    bindingId: 'web.html',
    profile: 'web.html',
  });
  assert.ok(tokenFallbackSet.closure.some(({ token }) => token === 'semantic.action.background'));
  expectCode('CORE_TOKEN_REQUIRED_MISSING', () => validateThemeForRequirementSet({
    requirementSet: tokenFallbackSet,
    values: { 'component.button.foreground': '#ffffff' },
  }));
  assert.equal(validateThemeForRequirementSet({
    requirementSet: tokenFallbackSet,
    values: {
      'component.button.foreground': '#ffffff',
      'semantic.action.background': '#000000',
    },
  }).diagnostics[0].code, 'CORE_TOKEN_FALLBACK_USED');
});

test('E-G1.0-04 requirement digests track exact semantic closure only', () => {
  const base = compileTokenRequirementSet({ source, recipe, bindingId: 'web.html', profile: 'web.html' });
  const unrelated = structuredClone(source);
  unrelated.tokens['semantic.unrelated.value'] = {
    layer: 'semantic', type: 'string', unit: 'string', meaning: 'Unrelated value.',
    overridePolicy: 'theme', value: 'unrelated',
  };
  const unrelatedSet = compileTokenRequirementSet({
    source: unrelated, recipe, bindingId: 'web.html', profile: 'web.html',
  });
  assert.equal(unrelatedSet.digest, base.digest);
  assert.notEqual(unrelatedSet.sourceRevision, base.sourceRevision);

  const dependency = structuredClone(source);
  dependency.tokens['reference.color.action-dark'].value = '#000001';
  const dependencySet = compileTokenRequirementSet({
    source: dependency, recipe, bindingId: 'web.html', profile: 'web.html',
  });
  assert.notEqual(dependencySet.digest, base.digest);
});

test('E-G1.0-06 static mode output works while runtime switching remains unavailable', () => {
  const light = compileWebTheme(source);
  const dark = compileWebTheme(source, { modes: { colorScheme: 'dark' } });
  const reduced = compileNativeTheme(source, {
    profile: 'native.ios',
    modes: { motion: 'reduced' },
  });
  assert.notEqual(light.css, dark.css);
  assert.equal(light.runtimeSwitching, false);
  assert.equal(reduced.runtimeSwitching, false);
  assert.equal(reduced.theme['semantic.motion.feedback'].value, 0);
  assert.equal(source.theme.runtimeSwitching, 'unavailable');
});
