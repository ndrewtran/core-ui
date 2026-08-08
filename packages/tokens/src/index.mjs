import { canonicalDigest, validateFamily } from '@core-ui/schema';

const LAYER_RANK = Object.freeze({ reference: 0, semantic: 1, component: 2 });
const UNIT_BY_TYPE = Object.freeze({
  color: new Set(['hex']),
  dimension: new Set(['px']),
  duration: new Set(['ms']),
  number: new Set(['unitless']),
  string: new Set(['string']),
});
const MODE_AXES = Object.freeze(['colorScheme', 'contrast', 'motion', 'density', 'direction']);
const PROFILE_IDS = new Set([
  'web.html',
  'web.react',
  'native.ios',
  'native.android',
  'native.react-native-web',
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class TokenContractError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'TokenContractError';
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

function fail(code, message, details) {
  throw new TokenContractError(code, message, details);
}

function validateLiteral(type, unit, value, path) {
  const expected = ['dimension', 'duration', 'number'].includes(type) ? 'number' : 'string';
  if (typeof value !== expected || (typeof value === 'number' && !Number.isFinite(value))) {
    fail('CORE_TOKEN_TYPE_MISMATCH', `${path} must be a ${expected}`, { path, type, unit });
  }
  if (!UNIT_BY_TYPE[type]?.has(unit)) {
    fail('CORE_TOKEN_UNIT_MISMATCH', `${path} has incompatible unit ${unit}`, { path, type, unit });
  }
  if (type === 'color' && !/^#[a-fA-F0-9]{6}(?:[a-fA-F0-9]{2})?$/.test(value)) {
    fail('CORE_TOKEN_TYPE_MISMATCH', `${path} must be a six- or eight-digit hex color`, { path });
  }
}

function selectedBranch(definition, modes) {
  for (const axis of MODE_AXES) {
    const key = `${axis}.${modes[axis]}`;
    if (Object.hasOwn(definition.modes ?? {}, key)) return definition.modes[key];
  }
  return definition;
}

function assertModes(source, modes) {
  const selected = {};
  for (const axis of MODE_AXES) {
    const values = source.theme.modeAxes[axis];
    const value = modes?.[axis] ?? source.theme.defaultModes[axis];
    if (!values.includes(value)) {
      fail('CORE_TOKEN_MODE_INVALID', `${axis}.${value} is not declared`, { axis, value });
    }
    selected[axis] = value;
  }
  return Object.freeze(selected);
}

function assertThemeContract(source) {
  if (source.theme.runtimeSwitching !== 'unavailable') {
    fail('CORE_THEME_RUNTIME_UNAVAILABLE', 'G1.0 permits static theme output only', {
      runtimeSwitching: source.theme.runtimeSwitching,
    });
  }
  for (const axis of MODE_AXES) {
    const values = source.theme.modeAxes[axis];
    const defaultValue = source.theme.defaultModes[axis];
    if (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length) {
      fail('CORE_TOKEN_MODE_INVALID', `${axis} must declare unique values`, { axis });
    }
    if (!values.includes(defaultValue)) {
      fail('CORE_TOKEN_MODE_INVALID', `${axis} default is not declared`, { axis, defaultValue });
    }
  }
}

function normalizeOverrides(source, overrides = {}) {
  if (!isObject(overrides)) {
    fail('CORE_TOKEN_OVERRIDE_UNAUTHORIZED', 'consumer overrides must be an object');
  }
  const normalized = {};
  for (const tokenId of Object.keys(overrides).sort(compareText)) {
    const definition = source.tokens[tokenId];
    if (!definition || definition.layer === 'reference' || definition.overridePolicy === 'fixed') {
      fail('CORE_TOKEN_OVERRIDE_UNAUTHORIZED', `${tokenId} cannot be overridden`, { tokenId });
    }
    const override = overrides[tokenId];
    if (!isObject(override) || Object.keys(override).some((key) => !['type', 'unit', 'value'].includes(key))) {
      fail('CORE_TOKEN_OVERRIDE_UNAUTHORIZED', `${tokenId} override must be a typed literal`, { tokenId });
    }
    if (override.type !== definition.type || override.unit !== definition.unit) {
      fail('CORE_TOKEN_TYPE_MISMATCH', `${tokenId} override changes type or unit`, { tokenId });
    }
    validateLiteral(override.type, override.unit, override.value, `overrides/${tokenId}`);
    normalized[tokenId] = structuredClone(override);
  }
  return normalized;
}

export function compileTokenGraph(source, options = {}) {
  if (
    !isObject(options)
    || Object.keys(options).some((key) => !['modes', 'overrides'].includes(key))
  ) {
    fail('CORE_TOKEN_OPTIONS_INVALID', 'token compilation options must be closed', {
      fields: isObject(options) ? Object.keys(options).sort(compareText) : [],
    });
  }
  const { modes, overrides } = options;
  validateFamily('token-source', source);
  assertThemeContract(source);
  const selectedModes = assertModes(source, modes);
  const normalizedOverrides = normalizeOverrides(source, overrides);
  const resolved = new Map();
  const dependencies = new Map();
  const visiting = [];

  function resolveToken(tokenId) {
    if (resolved.has(tokenId)) return resolved.get(tokenId);
    const definition = source.tokens[tokenId];
    if (!definition) fail('CORE_TOKEN_ALIAS_MISSING', `${tokenId} does not exist`, { tokenId });
    if (visiting.includes(tokenId)) {
      fail('CORE_TOKEN_ALIAS_CYCLE', `token alias cycle: ${[...visiting, tokenId].join(' -> ')}`, {
        cycle: [...visiting, tokenId],
      });
    }
    const override = normalizedOverrides[tokenId];
    if (override) {
      const result = Object.freeze({
        id: tokenId,
        layer: definition.layer,
        type: definition.type,
        unit: definition.unit,
        value: override.value,
        overridePolicy: definition.overridePolicy,
        source: 'consumer-theme',
      });
      dependencies.set(tokenId, []);
      resolved.set(tokenId, result);
      return result;
    }
    visiting.push(tokenId);
    const branch = selectedBranch(definition, selectedModes);
    let value;
    let sourceKind = 'literal';
    if (Object.hasOwn(branch, 'alias')) {
      const targetId = branch.alias;
      const target = source.tokens[targetId];
      if (!target) fail('CORE_TOKEN_ALIAS_MISSING', `${tokenId} aliases missing ${targetId}`, { tokenId, targetId });
      if (LAYER_RANK[target.layer] > LAYER_RANK[definition.layer]) {
        fail('CORE_TOKEN_LAYER_DIRECTION', `${tokenId} cannot alias forward to ${targetId}`, { tokenId, targetId });
      }
      if (target.layer === definition.layer && definition.equivalence !== 'semantic-equivalence' && definition.equivalence !== 'deprecation-bridge') {
        fail('CORE_TOKEN_LAYER_DIRECTION', `${tokenId} same-layer alias requires an explicit equivalence`, { tokenId, targetId });
      }
      if (target.type !== definition.type || target.unit !== definition.unit) {
        fail('CORE_TOKEN_TYPE_MISMATCH', `${tokenId} and ${targetId} have incompatible type or unit`, { tokenId, targetId });
      }
      value = resolveToken(targetId).value;
      dependencies.set(tokenId, [targetId]);
      sourceKind = 'alias';
    } else {
      validateLiteral(definition.type, definition.unit, branch.value, `tokens/${tokenId}`);
      value = branch.value;
      dependencies.set(tokenId, []);
    }
    visiting.pop();
    const result = Object.freeze({
      id: tokenId,
      layer: definition.layer,
      type: definition.type,
      unit: definition.unit,
      value,
      overridePolicy: definition.overridePolicy,
      source: sourceKind,
    });
    resolved.set(tokenId, result);
    return result;
  }

  for (const tokenId of Object.keys(source.tokens).sort(compareText)) resolveToken(tokenId);
  return Object.freeze({
    sourceId: source.id,
    sourceRevision: canonicalDigest(source),
    tokenContractVersion: source.tokenContractVersion,
    theme: source.theme.name,
    modes: selectedModes,
    tokens: Object.freeze(Object.fromEntries([...resolved.entries()].sort(([a], [b]) => compareText(a, b)))),
    dependencies: Object.freeze(Object.fromEntries([...dependencies.entries()].sort(([a], [b]) => compareText(a, b)))),
  });
}

function profileMatches(requirement, profile) {
  return requirement.profiles === undefined || requirement.profiles.includes(profile);
}

function dependencyClosure(graph, tokenId, closure = new Set()) {
  if (closure.has(tokenId)) return closure;
  closure.add(tokenId);
  for (const dependency of graph.dependencies[tokenId] ?? []) dependencyClosure(graph, dependency, closure);
  return closure;
}

function validateFallback(fallback, source, requirement, profile) {
  if (fallback === undefined) return undefined;
  if (!fallback.profiles.includes(profile)) return undefined;
  if (!fallback.evidenceIds?.length) {
    fail('CORE_TOKEN_FALLBACK_UNPROVED', `${requirement.token} fallback lacks evidence`, {
      tokenId: requirement.token,
      profile,
    });
  }
  const definition = source.tokens[requirement.token];
  if (fallback.kind === 'token') {
    const target = source.tokens[fallback.token];
    if (!target || target.layer === 'reference' || target.type !== definition.type || target.unit !== definition.unit) {
      fail('CORE_TOKEN_FALLBACK_INVALID', `${requirement.token} fallback token is incompatible`, {
        tokenId: requirement.token,
        fallbackToken: fallback.token,
        profile,
      });
    }
  } else {
    if (fallback.type !== definition.type || fallback.unit !== definition.unit) {
      fail('CORE_TOKEN_FALLBACK_INVALID', `${requirement.token} fallback literal is incompatible`, {
        tokenId: requirement.token,
        profile,
      });
    }
    validateLiteral(fallback.type, fallback.unit, fallback.value, `fallback/${requirement.token}`);
  }
  return structuredClone(fallback);
}

export function compileTokenRequirementSet({ source, recipe, bindingId, profile, modes }) {
  if (!PROFILE_IDS.has(profile)) fail('CORE_TOKEN_PROFILE_INVALID', `${profile} is not supported`, { profile });
  if (!recipe || recipe.source !== source.id || !Array.isArray(recipe.requirements)) {
    fail('CORE_TOKEN_RECIPE_INVALID', `${bindingId} must reference ${source.id}`, { bindingId, profile });
  }
  const graph = compileTokenGraph(source, { modes });
  const requirements = recipe.requirements
    .filter((requirement) => profileMatches(requirement, profile))
    .map((requirement) => {
      const definition = source.tokens[requirement.token];
      if (!definition || definition.layer === 'reference') {
        fail('CORE_TOKEN_RECIPE_INVALID', `${bindingId} consumes invalid ${requirement.token}`, {
          bindingId,
          profile,
          tokenId: requirement.token,
        });
      }
      const fallback = validateFallback(requirement.fallback, source, requirement, profile);
      return {
        token: requirement.token,
        requirement: requirement.requirement,
        type: definition.type,
        unit: definition.unit,
        modes: Object.keys(definition.modes ?? {}).sort(compareText),
        overridePolicy: definition.overridePolicy,
        ...(fallback === undefined ? {} : { fallback }),
      };
    })
    .sort((left, right) => compareText(left.token, right.token));
  const closureIds = new Set();
  for (const requirement of requirements) {
    dependencyClosure(graph, requirement.token, closureIds);
    if (requirement.fallback?.kind === 'token') {
      dependencyClosure(graph, requirement.fallback.token, closureIds);
    }
  }
  const closure = [...closureIds].sort(compareText).map((tokenId) => {
    const definition = source.tokens[tokenId];
    return {
      token: tokenId,
      layer: definition.layer,
      type: definition.type,
      unit: definition.unit,
      meaning: definition.meaning,
      overridePolicy: definition.overridePolicy,
      resolved: graph.tokens[tokenId].value,
      dependencies: graph.dependencies[tokenId],
    };
  });
  const digestPreimage = {
    schemaVersion: '1.0.0',
    bindingId,
    profile,
    source: source.id,
    tokenContractVersion: source.tokenContractVersion,
    requirements,
    closure,
  };
  return Object.freeze({
    ...digestPreimage,
    sourceRevision: graph.sourceRevision,
    digest: canonicalDigest(digestPreimage),
  });
}

export function validateThemeForRequirementSet({ requirementSet, values }) {
  const diagnostics = [];
  const resolved = {};
  for (const requirement of requirementSet.requirements) {
    if (Object.hasOwn(values, requirement.token)) {
      validateLiteral(
        requirement.type,
        requirement.unit,
        values[requirement.token],
        `values/${requirement.token}`,
      );
      resolved[requirement.token] = values[requirement.token];
      continue;
    }
    if (requirement.fallback) {
      if (
        requirement.fallback.kind === 'token'
        && !Object.hasOwn(values, requirement.fallback.token)
      ) {
        fail('CORE_TOKEN_REQUIRED_MISSING', `${requirement.fallback.token} fallback is missing`, {
          bindingId: requirementSet.bindingId,
          fallbackToken: requirement.fallback.token,
          profile: requirementSet.profile,
          tokenId: requirement.token,
        });
      }
      const fallbackValue = requirement.fallback.kind === 'token'
        ? values[requirement.fallback.token]
        : requirement.fallback.value;
      const fallbackDefinition = requirement.fallback.kind === 'token'
        ? requirementSet.closure.find(({ token }) => token === requirement.fallback.token)
        : requirement.fallback;
      validateLiteral(
        fallbackDefinition.type,
        fallbackDefinition.unit,
        fallbackValue,
        `fallback/${requirement.token}`,
      );
      resolved[requirement.token] = fallbackValue;
      diagnostics.push(Object.freeze({
        code: 'CORE_TOKEN_FALLBACK_USED',
        bindingId: requirementSet.bindingId,
        profile: requirementSet.profile,
        token: requirement.token,
        fallback: structuredClone(requirement.fallback),
      }));
      continue;
    }
    if (requirement.requirement === 'required') {
      fail('CORE_TOKEN_REQUIRED_MISSING', `${requirement.token} is required`, {
        bindingId: requirementSet.bindingId,
        profile: requirementSet.profile,
        tokenId: requirement.token,
      });
    }
  }
  return Object.freeze({ values: Object.freeze(resolved), diagnostics: Object.freeze(diagnostics) });
}

function publicTokenEntries(graph) {
  return Object.values(graph.tokens).filter(({ layer }) => layer !== 'reference');
}

function cssName(tokenId) {
  return `--core-${tokenId.replaceAll('.', '-')}`;
}

function cssValue(token) {
  if (token.unit === 'px') return `${token.value}px`;
  if (token.unit === 'ms') return `${token.value}ms`;
  return String(token.value);
}

export function compileWebTheme(source, options = {}) {
  const graph = compileTokenGraph(source, options);
  const declarations = publicTokenEntries(graph)
    .map((token) => `  ${cssName(token.id)}: ${cssValue(token)};`)
    .join('\n');
  return Object.freeze({
    kind: 'web.css.static',
    format: 'core-ui-web-theme-v1',
    sourceId: graph.sourceId,
    sourceRevision: graph.sourceRevision,
    tokenContractVersion: graph.tokenContractVersion,
    modes: graph.modes,
    runtimeSwitching: false,
    provenance: Object.freeze({ source: 'canonical-token-source', digest: graph.sourceRevision }),
    css: `:root {\n${declarations}\n}\n`,
  });
}

export function compileNativeTheme(source, { profile, ...options } = {}) {
  if (!['native.ios', 'native.android'].includes(profile)) {
    fail('CORE_TOKEN_PROFILE_INVALID', `${profile} has no native transform`, { profile });
  }
  const graph = compileTokenGraph(source, options);
  return Object.freeze({
    kind: 'native.theme.static',
    format: 'core-ui-native-theme-v1',
    profile,
    sourceId: graph.sourceId,
    sourceRevision: graph.sourceRevision,
    tokenContractVersion: graph.tokenContractVersion,
    modes: graph.modes,
    runtimeSwitching: false,
    provenance: Object.freeze({ source: 'canonical-token-source', digest: graph.sourceRevision }),
    theme: Object.freeze(Object.fromEntries(publicTokenEntries(graph).map((token) => [token.id, Object.freeze({
      type: token.type,
      unit: token.unit,
      value: token.value,
    })]))),
  });
}
