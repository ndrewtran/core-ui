import { canonicalDigest, canonicalJson } from '@core-ui/schema';

export const TALE_TOKEN_ANNEX_PATH = 'decisions/0003-tale-token-classification-annex.json';
export const TALE_TOKEN_SOURCE_PATH = 'tests/fixtures/tale-token-classification/tokens.json';
export const TALE_TOKEN_CROSSWALK_DIGEST = 'sha256:37e18a03d4496502aa4861cb721ed93e7208a3b766abd5e159dc76904211dfbf';
export const TALE_TOKEN_PHASE_B_SOURCE_DIGEST = 'sha256:b6a86d8c22f7eb193b4cb8b6a203a40a56a01e581b8175e14f4228084f43d679';

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function exact(value, expected, code, message) {
  if (canonicalJson(value) !== canonicalJson(expected)) fail(code, message);
}

export function enumerateTaleTokenOccurrences(source) {
  const occurrences = [];
  for (const [file, blocks] of Object.entries(source.files ?? {})) {
    for (const block of blocks) {
      for (const [name, value] of Object.entries(block.declarations ?? {})) {
        occurrences.push({
          ordinal: occurrences.length + 1,
          file,
          selector: block.selector,
          ...(block.media === undefined ? {} : { media: block.media }),
          name,
          value,
        });
      }
    }
  }
  return occurrences;
}

export function projectTaleTokenCrosswalk(annex, source) {
  const sourceOccurrences = enumerateTaleTokenOccurrences(source);
  exact(
    annex.entries.map(({ occurrence }) => occurrence),
    sourceOccurrences,
    'CORE_TALE_TOKEN_SOURCE_MISMATCH',
    'the accepted annex must exactly cover the pinned Tale source before projection',
  );
  const groupByOrdinal = new Map();
  for (const group of annex.groups) {
    for (const member of group.members) {
      if (groupByOrdinal.has(member.ordinal)) {
        fail('CORE_TALE_TOKEN_GROUP_INVALID', `occurrence ${member.ordinal} belongs to multiple groups`);
      }
      groupByOrdinal.set(member.ordinal, group.id);
    }
  }
  const baseline = {
    repository: annex.source.repository,
    revision: annex.source.revision,
    path: annex.source.path,
    sha256: annex.source.sha256,
    baseFontSizePx: annex.source.baseFontSizePx,
    declarationOccurrences: annex.source.declarationOccurrences,
    customPropertyOccurrences: annex.source.customPropertyOccurrences,
    uniqueCustomPropertyNames: annex.source.uniqueCustomPropertyNames,
    nonCustomPropertyOccurrences: annex.source.nonCustomPropertyOccurrences,
  };
  const entries = annex.entries.map((entry) => {
    const { media: _media, ...occurrence } = entry.occurrence;
    const groupId = groupByOrdinal.get(occurrence.ordinal);
    return {
      occurrence,
      disposition: entry.disposition,
      ...(entry.coreTokenId === undefined ? {} : { coreTokenId: entry.coreTokenId }),
      ...(groupId === undefined ? {} : { groupId }),
      reason: entry.reason,
      targets: structuredClone(entry.targets),
    };
  });
  const groups = structuredClone(annex.groups);
  const crosswalk = { baseline, entries, groups };
  const digest = canonicalDigest(crosswalk);
  if (digest !== TALE_TOKEN_CROSSWALK_DIGEST) {
    fail('CORE_TALE_TOKEN_CROSSWALK_DIGEST_MISMATCH', `projected crosswalk ${digest}`);
  }
  return crosswalk;
}

export function projectedTaleTokenOccurrences(annex, source) {
  return projectTaleTokenCrosswalk(annex, source).entries.map(({ occurrence }) => occurrence);
}

export function materializeTaleTokenSource(baseSource, annex, source) {
  const tokens = structuredClone(baseSource.tokens);
  for (const token of annex.coreTokens) {
    if (token.action === 'reuse') {
      exact(
        tokens[token.id],
        token.definition,
        'CORE_TALE_TOKEN_REUSE_MISMATCH',
        `${token.id} must remain an exact Core-owned definition`,
      );
    } else {
      if (tokens[token.id] !== undefined) {
        fail('CORE_TALE_TOKEN_COLLISION', `${token.id} already exists`);
      }
      tokens[token.id] = structuredClone(token.definition);
    }
  }
  return {
    ...structuredClone(baseSource),
    tokenContractVersion: '1.2.0',
    tokens,
    sourceCrosswalk: projectTaleTokenCrosswalk(annex, source),
  };
}

export function rollbackMaterializedTaleTokenSource(value, annex) {
  const rolledBack = structuredClone(value);
  for (const token of annex.coreTokens) {
    if (token.action === 'add') delete rolledBack.tokens[token.id];
  }
  rolledBack.tokenContractVersion = '1.1.0';
  delete rolledBack.sourceCrosswalk;
  const digest = canonicalDigest(rolledBack);
  if (digest !== TALE_TOKEN_PHASE_B_SOURCE_DIGEST) {
    fail('CORE_TALE_TOKEN_PHASE_B_BASE_MISMATCH', `rolled-back source ${digest}`);
  }
  return rolledBack;
}

export function assertMaterializedTaleTokenSource(value, annex, source) {
  const baseSource = rollbackMaterializedTaleTokenSource(value, annex);
  const expected = materializeTaleTokenSource(baseSource, annex, source);
  exact(
    value,
    expected,
    'CORE_TALE_TOKEN_MATERIALIZATION_MISMATCH',
    'canonical token source differs from the accepted Phase C materialization',
  );
  return {
    tokenCount: Object.keys(value.tokens).length,
    crosswalkEntries: value.sourceCrosswalk.entries.length,
    crosswalkGroups: value.sourceCrosswalk.groups.length,
    crosswalkDigest: canonicalDigest(value.sourceCrosswalk),
  };
}
