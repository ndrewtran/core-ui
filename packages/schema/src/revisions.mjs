import { canonicalDigest, sha256Digest } from './canonical.mjs';
import { validateCatalogRecords, validateFamily } from './validation.mjs';

export function contentRevisionPreimage(family, record, { sourceBytes } = {}) {
  validateFamily(family, record);
  if (family === 'example') {
    if (typeof sourceBytes !== 'string' && !Buffer.isBuffer(sourceBytes)) {
      throw new Error(`CORE_RELATION_INVALID: missing executable source bytes for ${record.id}`);
    }
    return { record, sourceDigest: sha256Digest(sourceBytes) };
  }
  return record;
}

export function contentRevision(family, record, options = {}) {
  return canonicalDigest(contentRevisionPreimage(family, record, options));
}

export function bindingContentRevisionPreimage(binding) {
  validateFamily('binding', binding);
  return binding;
}

export function bindingContentRevision(binding) {
  return canonicalDigest(bindingContentRevisionPreimage(binding));
}

export function bindingSpecRevisionPreimage({
  component,
  bindingId,
  examples = [],
  exampleSources = {},
  tokenSources = [],
}) {
  validateCatalogRecords([component, ...examples, ...tokenSources]);
  const binding = Object.hasOwn(component.bindings, bindingId)
    ? component.bindings[bindingId]
    : undefined;
  if (!binding) throw new Error(`CORE_RELATION_INVALID: missing ${component.id}#${bindingId}`);
  if (binding.strategy === 'unsupported') {
    throw new Error(`CORE_RELATION_INVALID: unsupported binding ${component.id}#${bindingId} has no specRevision`);
  }
  const bindingRef = `${component.id}#${bindingId}`;
  const normativeExamples = examples
    .filter((example) => (
      example.binding.ref === bindingRef
      && example.binding.guidanceImpact === 'normative'
    ))
    .map((example) => ({
      id: example.id,
      revision: contentRevision('example', example, {
        sourceBytes: exampleSources[example.id],
      }),
      relation: example.binding,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const tokenRequirements = binding.tokenSources.map((id) => {
    const source = tokenSources.find((record) => record.id === id);
    if (!source) throw new Error(`CORE_RELATION_INVALID: missing ${id}`);
    return {
      id,
      tokenContractVersion: source.tokenContractVersion,
      tokens: Object.entries(source.tokens)
        .map(([token, definition]) => ({
          token,
          type: definition.type,
          ...(definition.alias === undefined ? {} : { alias: definition.alias }),
        }))
        .sort((left, right) => left.token.localeCompare(right.token)),
    };
  });
  return {
    component: {
      id: component.id,
      lifecycle: component.lifecycle,
      intent: component.intent,
      anatomy: component.anatomy,
      states: component.states,
      accessibility: component.accessibility,
    },
    binding: {
      lifecycle: binding.lifecycle,
      strategy: binding.strategy,
      api: binding.api,
      behavior: binding.behavior,
      accessibility: binding.accessibility,
      runtimeProfiles: binding.runtimeProfiles,
      tokenSources: binding.tokenSources,
    },
    normativeExamples,
    tokenRequirements,
  };
}

export function bindingSpecRevision(input) {
  return canonicalDigest(bindingSpecRevisionPreimage(input));
}
