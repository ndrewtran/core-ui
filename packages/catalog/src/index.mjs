import {
  API_VERSION,
  ARTIFACT_KINDS,
  ARTIFACT_REF_PATTERN,
  QUERY_ENVELOPE_SCHEMA_ID,
  QUERY_RESPONSE_TYPES,
  QUERY_SELECTORS,
  SCHEMA_VERSION,
  canonicalDigest,
  parseJsonStrict,
  validateFamily,
} from '@core-ui/schema';
import { catalogJson } from '../generated/catalog.mjs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 256;
const MAX_QUERY_TERMS = 16;
const OPERATIONS = {
  getManifest: {
    available: true,
    requestKeys: ['detail'],
    responseType: 'catalog.manifest',
  },
  listArtifacts: {
    available: true,
    requestKeys: ['cursor', 'detail', 'kind', 'limit', 'platform', 'purpose'],
    responseType: 'artifact.list',
  },
  searchArtifacts: {
    available: true,
    requestKeys: ['cursor', 'detail', 'limit', 'platform', 'purpose', 'query'],
    responseType: 'artifact.search',
  },
  getArtifact: {
    available: true,
    requestKeys: ['detail', 'id', 'platform', 'purpose', 'section'],
    responseType: 'artifact.detail',
  },
  planComposition: {
    available: false,
    requestKeys: [],
    responseType: null,
  },
};

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

function assertBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('CORE_CATALOG_INTEGRITY_MISMATCH: catalog bundle must be an object');
  }
  const { catalogDigest, ...preimage } = bundle;
  if (catalogDigest !== canonicalDigest(preimage)) {
    throw new Error('CORE_CATALOG_INTEGRITY_MISMATCH: catalog digest does not match bundle');
  }
  return deepFreeze(structuredClone(bundle));
}

function queryError(code, ruleId, message, details, retryable = false) {
  const response = {
    apiVersion: API_VERSION,
    type: 'error',
    error: { code, ruleId, message, retryable, details },
  };
  validateFamily('query-envelope', response);
  return deepFreeze(response);
}

function success(type, data, meta) {
  const response = { apiVersion: API_VERSION, type, data, meta, warnings: [] };
  validateFamily('query-envelope', response);
  return deepFreeze(response);
}

function normalizeRequest(request, operation) {
  if (request === undefined) request = {};
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return { error: queryError(
      'CORE_QUERY_INVALID',
      'query.request.object',
      `${operation} request must be an object.`,
      { operation },
    ) };
  }
  const operationKeys = OPERATIONS[operation]?.requestKeys ?? [];
  const allowed = new Set(operationKeys);
  const unknown = Object.keys(request).filter((key) => !allowed.has(key)).sort(compareText);
  if (unknown.length > 0) {
    return { error: queryError(
      'CORE_QUERY_INVALID',
      'query.request.unknown-field',
      `${operation} request contains unknown fields.`,
      { operation, fields: unknown },
    ) };
  }
  const normalized = {
    detail: request.detail ?? 'compact',
    limit: request.limit ?? DEFAULT_LIMIT,
    platform: request.platform ?? null,
    purpose: request.purpose ?? null,
    section: request.section ?? null,
    cursor: request.cursor ?? null,
  };
  for (const key of operationKeys) {
    if (!Object.hasOwn(normalized, key)) normalized[key] = request[key] ?? null;
  }
  const failures = [];
  if (!QUERY_SELECTORS.detail.includes(normalized.detail)) failures.push('detail');
  if (normalized.platform !== null && !QUERY_SELECTORS.platform.includes(normalized.platform)) {
    failures.push('platform');
  }
  if (normalized.purpose !== null && !QUERY_SELECTORS.purpose.includes(normalized.purpose)) {
    failures.push('purpose');
  }
  if (normalized.section !== null && !QUERY_SELECTORS.section.includes(normalized.section)) {
    failures.push('section');
  }
  if (!Number.isInteger(normalized.limit) || normalized.limit < 1 || normalized.limit > MAX_LIMIT) {
    failures.push('limit');
  }
  if (normalized.cursor !== null && typeof normalized.cursor !== 'string') failures.push('cursor');
  if (failures.length > 0) {
    return { error: queryError(
      'CORE_QUERY_INVALID',
      'query.request.selector',
      `${operation} request has invalid selectors.`,
      { operation, fields: failures.sort(compareText) },
    ) };
  }
  return { normalized };
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value) {
  return parseJsonStrict(Buffer.from(value, 'base64url').toString('utf8'));
}

function paginate(values, operation, request, catalogDigest) {
  const requestWithoutCursor = { ...request, cursor: null };
  const requestDigest = canonicalDigest({ operation, request: requestWithoutCursor });
  let offset = 0;
  if (request.cursor !== null) {
    try {
      const decoded = decodeCursor(request.cursor);
      if (
        decoded.catalogDigest !== catalogDigest
        || decoded.operation !== operation
        || decoded.requestDigest !== requestDigest
        || !Number.isInteger(decoded.offset)
        || decoded.offset < 0
        || decoded.offset > values.length
      ) {
        throw new Error('mismatch');
      }
      offset = decoded.offset;
    } catch {
      return { error: queryError(
        'CORE_CURSOR_INVALID',
        'query.cursor.identity',
        'The cursor does not belong to this catalog and request.',
        { operation, catalogDigest },
        true,
      ) };
    }
  }
  const items = values.slice(offset, offset + request.limit);
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < values.length
    ? encodeCursor({ catalogDigest, operation, requestDigest, offset: nextOffset })
    : null;
  return { items, nextCursor, truncated: nextCursor !== null };
}

function summary(artifact, detail = 'compact') {
  const brief = {
    id: artifact.id,
    kind: artifact.kind,
    name: artifact.name,
    summary: artifact.summary,
    lifecycle: artifact.lifecycle,
    platforms: artifact.platforms,
    source: artifact.source,
  };
  if (detail === 'brief') return brief;
  return {
    ...brief,
    contentRevision: artifact.contentRevision,
  };
}

function appliesToPlatform(artifact, platform) {
  return platform === null || artifact.platforms.length === 0 || artifact.platforms.includes(platform);
}

function appliesToPurpose(artifact, purpose) {
  return purpose === null
    || artifact.kind !== 'example'
    || artifact.record.binding.purposes.includes(purpose);
}

function related(bundle, artifactId) {
  return bundle.relations.filter(({ source, target }) => (
    source === artifactId
    || target === artifactId
    || source.startsWith(`${artifactId}#`)
    || target.startsWith(`${artifactId}#`)
  ));
}

function bindingForPlatform(record, platform) {
  if (record.kind !== 'component' || platform === null) return null;
  if (platform === 'native.react-native-web') {
    const binding = record.bindings['native.react-native'];
    return binding ? {
      bindingId: 'native.react-native',
      binding,
      runtimeProfileId: 'native.react-native-web',
      runtimeProfile: binding.runtimeProfiles?.['native.react-native-web'] ?? null,
    } : null;
  }
  const binding = record.bindings[platform];
  return binding ? {
    bindingId: platform,
    binding,
    runtimeProfileId: null,
    runtimeProfile: null,
  } : null;
}

function selectedSection(bundle, artifact, request) {
  const record = artifact.record;
  const selectedBinding = bindingForPlatform(record, request.platform);
  if (request.section === 'source') return artifact.source;
  if (request.section === 'api') {
    if (record.kind !== 'component') return null;
    if (selectedBinding) return selectedBinding;
    return Object.fromEntries(Object.entries(record.bindings).map(([id, binding]) => [id, binding.api ?? null]));
  }
  if (request.section === 'accessibility') {
    return record.kind === 'component'
      ? { concept: record.accessibility, binding: selectedBinding?.binding.accessibility ?? null }
      : null;
  }
  if (request.section === 'styling') {
    return record.kind === 'component'
      ? (selectedBinding?.binding.tokenSources ?? Object.fromEntries(
        Object.entries(record.bindings).map(([id, binding]) => [id, binding.tokenSources ?? []]),
      ))
      : null;
  }
  if (request.section === 'guidance') {
    return { summary: record.summary, intent: record.intent ?? null };
  }
  if (request.section === 'decision-context') return null;
  if (request.section === 'examples') {
    const prefix = `${artifact.id}#`;
    const selectedRef = selectedBinding === null
      ? null
      : `${artifact.id}#${selectedBinding.bindingId}`;
    return bundle.artifacts
      .filter(({ kind, record: candidate }) => (
        kind === 'example'
        && candidate.binding.ref.startsWith(prefix)
        && (selectedRef === null || candidate.binding.ref === selectedRef)
        && (
          selectedBinding?.runtimeProfileId == null
          || (candidate.binding.runtimeProfiles ?? []).includes(selectedBinding.runtimeProfileId)
        )
        && (request.purpose === null || candidate.binding.purposes.includes(request.purpose))
      ))
      .map((candidate) => summary(candidate, request.detail));
  }
  return null;
}

function baseMeta(bundle, request = {}, revisions = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    authority: 'advisory',
    revisions,
    coreVersion: '0.0.0',
    catalogVersion: bundle.catalogVersion,
    catalogDigest: bundle.catalogDigest,
    sourceRevision: bundle.sourceRevision,
    resolution: {
      authority: 'advisory',
      compatibility: 'unresolved',
      catalogSource: 'package',
      sourceRevision: bundle.sourceRevision,
      revisions,
      targetPackages: {},
    },
    platform: request.platform ?? null,
    detail: request.detail ?? 'full',
    truncated: false,
    nextCursor: null,
  };
}

function resolvedCliRegistry(bundle) {
  const registry = structuredClone(bundle.commandRegistry);
  const available = bundle.artifacts
    .find(({ id }) => id === 'core:capability:query-baseline')
    .record.availableOn.includes('cli');
  const capability = {
    available,
    effect: registry.surfacePolicy.cli.effect,
    requiresConfirmation: registry.surfacePolicy.cli.requiresConfirmation,
  };
  registry.surfacePolicy.cli = capability;
  registry.commands = registry.commands.map((command) => ({
    ...command,
    responseType: OPERATIONS[command.operation]?.responseType ?? null,
    responseSchema: QUERY_ENVELOPE_SCHEMA_ID,
    capability,
  }));
  registry.unavailableCommands = registry.unavailableCommands.map((command) => ({
    ...command,
    capability: { available: false },
  }));
  return registry;
}

function cliRegistryForDetail(bundle, detail) {
  const registry = resolvedCliRegistry(bundle);
  if (detail === 'brief') {
    return {
      name: registry.cli.name,
      version: registry.cli.version,
      commands: registry.commands.map(({ name }) => name),
    };
  }
  if (detail === 'compact') {
    return {
      cli: registry.cli,
      commands: registry.commands.map(({
        name, summary, responseType, responseSchema, tokenBudgets,
      }) => ({
        name,
        summary,
        responseType,
        responseSchema,
        tokenBudgets,
      })),
      outputModes: registry.outputModes,
      unavailableCommands: registry.unavailableCommands,
    };
  }
  return registry;
}

export function createCatalogApi(inputBundle) {
  const bundle = assertBundle(inputBundle);
  const artifactsById = new Map(bundle.artifacts.map((artifact) => [artifact.id, artifact]));
  const indexById = new Map(bundle.searchIndex.map((entry) => [entry.id, entry]));

  function getManifest(request) {
    const parsed = normalizeRequest(request, 'getManifest');
    if (parsed.error) return parsed.error;
    const { normalized } = parsed;
    return success('catalog.manifest', {
      formatVersion: bundle.formatVersion,
      catalogVersion: bundle.catalogVersion,
      catalogDigest: bundle.catalogDigest,
      sourceRevision: bundle.sourceRevision,
      operations: OPERATIONS,
      responseTypes: QUERY_RESPONSE_TYPES,
      selectors: QUERY_SELECTORS,
      artifactKinds: [...new Set(bundle.artifacts.map(({ kind }) => kind))].sort(compareText),
      platforms: QUERY_SELECTORS.platform,
      capabilities: bundle.artifacts
        .filter(({ kind }) => kind === 'capability')
        .map(({ record }) => record),
      cli: cliRegistryForDetail(bundle, normalized.detail),
    }, baseMeta(bundle, normalized));
  }

  function listArtifacts(request) {
    const parsed = normalizeRequest(request, 'listArtifacts');
    if (parsed.error) return parsed.error;
    const { normalized } = parsed;
    if (normalized.kind !== null && !ARTIFACT_KINDS.includes(normalized.kind)) {
      return queryError(
        'CORE_QUERY_INVALID',
        'query.list.kind',
        'listArtifacts kind must be an enabled ArtifactKind.',
        { kind: normalized.kind },
      );
    }
    const values = bundle.artifacts
      .filter((artifact) => (
        (normalized.kind === null || artifact.kind === normalized.kind)
        && appliesToPlatform(artifact, normalized.platform)
        && appliesToPurpose(artifact, normalized.purpose)
      ))
      .map((artifact) => summary(artifact, normalized.detail));
    const page = paginate(values, 'listArtifacts', normalized, bundle.catalogDigest);
    if (page.error) return page.error;
    return success('artifact.list', { items: page.items }, {
      ...baseMeta(bundle, normalized),
      truncated: page.truncated,
      nextCursor: page.nextCursor,
    });
  }

  function searchArtifacts(request) {
    const parsed = normalizeRequest(request, 'searchArtifacts');
    if (parsed.error) return parsed.error;
    const { normalized } = parsed;
    if (
      typeof normalized.query !== 'string'
      || normalized.query.trim().length === 0
      || normalized.query.length > MAX_QUERY_LENGTH
    ) {
      return queryError(
        'CORE_QUERY_INVALID',
        'query.search.text',
        `searchArtifacts query must contain 1-${MAX_QUERY_LENGTH} characters.`,
        { query: normalized.query },
      );
    }
    const queryTerms = [...new Set(
      normalized.query.toLowerCase().match(/[a-z0-9]+/g) ?? [],
    )].slice(0, MAX_QUERY_TERMS);
    if (queryTerms.length === 0) {
      return queryError(
        'CORE_QUERY_INVALID',
        'query.search.terms',
        'searchArtifacts query must contain an ASCII letter or number.',
        { query: normalized.query },
      );
    }
    const matches = [];
    for (const artifact of bundle.artifacts) {
      if (!appliesToPlatform(artifact, normalized.platform) || !appliesToPurpose(artifact, normalized.purpose)) {
        continue;
      }
      const reasons = [];
      let score = 0;
      for (const term of queryTerms) {
        for (const indexed of indexById.get(artifact.id).terms) {
          const match = indexed.term === term ? 'exact' : indexed.term.startsWith(term) ? 'prefix' : null;
          if (match) {
            const points = (match === 'exact' ? 20 : 10) + (indexed.field === 'name' ? 5 : 0);
            score += points;
            reasons.push({
              queryTerm: term,
              field: indexed.field,
              value: indexed.value,
              match,
              points,
            });
          }
        }
      }
      if (score > 0) {
        reasons.sort((left, right) => (
          compareText(left.queryTerm, right.queryTerm)
          || compareText(left.field, right.field)
          || compareText(left.value, right.value)
          || compareText(left.match, right.match)
        ));
        matches.push({ ...summary(artifact, normalized.detail), score, matchReasons: reasons });
      }
    }
    matches.sort((left, right) => right.score - left.score || compareText(left.id, right.id));
    const page = paginate(matches, 'searchArtifacts', normalized, bundle.catalogDigest);
    if (page.error) return page.error;
    return success('artifact.search', { query: normalized.query, items: page.items }, {
      ...baseMeta(bundle, normalized),
      truncated: page.truncated,
      nextCursor: page.nextCursor,
    });
  }

  function getArtifact(request) {
    const parsed = normalizeRequest(request, 'getArtifact');
    if (parsed.error) return parsed.error;
    const { normalized } = parsed;
    if (
      typeof normalized.id !== 'string'
      || !new RegExp(ARTIFACT_REF_PATTERN).test(normalized.id)
    ) {
      return queryError(
        'CORE_QUERY_INVALID',
        'query.get.id',
        'getArtifact id must be an ArtifactRef string.',
        { id: normalized.id },
      );
    }
    const artifact = artifactsById.get(normalized.id);
    if (
      !artifact
      || !appliesToPlatform(artifact, normalized.platform)
      || !appliesToPurpose(artifact, normalized.purpose)
    ) {
      return queryError(
        'CORE_ARTIFACT_NOT_FOUND',
        'artifact.resolve.exists',
        `No artifact matched ${JSON.stringify(normalized.id)}.`,
        { id: normalized.id, platform: normalized.platform },
        true,
      );
    }
    const relations = related(bundle, artifact.id);
    let data;
    if (normalized.section !== null) {
      data = {
        artifact: summary(artifact, normalized.detail),
        section: normalized.section,
        value: selectedSection(bundle, artifact, normalized),
      };
    } else if (normalized.detail === 'brief') {
      data = { artifact: summary(artifact, 'brief') };
    } else if (normalized.detail === 'compact') {
      data = { artifact: summary(artifact), relations };
    } else {
      data = {
        artifact: {
          ...artifact.record,
          contentRevision: artifact.contentRevision,
          bindingSpecRevisions: artifact.bindingSpecRevisions,
          source: artifact.source,
        },
        relations,
      };
    }
    const selectedBinding = bindingForPlatform(artifact.record, normalized.platform);
    const revisions = {
      conceptContent: artifact.contentRevision,
      bindingContent: selectedBinding?.bindingId
        ? (artifact.bindingContentRevisions[selectedBinding.bindingId] ?? null)
        : null,
      bindingSpec: selectedBinding?.bindingId
        ? (artifact.bindingSpecRevisions[selectedBinding.bindingId] ?? null)
        : null,
    };
    return success('artifact.detail', data, baseMeta(bundle, normalized, revisions));
  }

  return deepFreeze({ getManifest, listArtifacts, searchArtifacts, getArtifact });
}

const defaultApi = createCatalogApi(parseJsonStrict(catalogJson));

export const getManifest = defaultApi.getManifest;
export const listArtifacts = defaultApi.listArtifacts;
export const searchArtifacts = defaultApi.searchArtifacts;
export const getArtifact = defaultApi.getArtifact;
