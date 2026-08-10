import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
  validateFamily,
} from '@core-ui/schema';
import { validateSourceCrosswalk } from './index.mjs';

export const TALE_TOKEN_MATERIALIZATION_PATHS = Object.freeze({
  acceptance: 'decisions/0004-tale-only-reference-baseline-acceptance.json',
  currentSource: 'catalog/tokens/button-minimum.json',
  parentAcceptance: 'decisions/0003-tale-token-classification-acceptance.json',
  parentDecision: 'decisions/0003-tale-token-classification-annex.json',
  phaseBSource: 'packages/tokens/fixtures/button-minimum-phase-b.json',
  resetDecision: 'decisions/0004-tale-only-reference-baseline-annex.json',
});

export const TALE_TOKEN_MATERIALIZATION_IDENTITIES = Object.freeze({
  acceptance: 'sha256:eff0ddc420e87a861d1c9f8fa3cd3d1353ea8f4d6fdb3aa830bc86006107aee7',
  finalSource: 'sha256:670f2a45ada8c90b39e6de4bc4e6fef9e175313607c428067c21b7c2b1c5eac2',
  parentAcceptance: 'sha256:6ef7a0d4fa92cda7ea3222551074ae488a45a359a7de0600d3ee59180f3d1a17',
  parentDecision: 'sha256:c94518bc3e9d3a98a1752311f0a4bc37be106d75fa16db5bfc2555b3894d9604',
  phaseBCanonical: 'sha256:b6a86d8c22f7eb193b4cb8b6a203a40a56a01e581b8175e14f4228084f43d679',
  phaseBFile: 'sha256:adfa0560a25cb47521fc19f258a627c214ef567656b51f60155eedc638dcc91b',
  resetDecision: 'sha256:a9cd83a11a915ff1c3bd8b38b14ec18c0fc69881eb7fb46f8526ca77f1e6c9f6',
});

export class TaleTokenMaterializationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'TaleTokenMaterializationError';
  }
}

function fail(code, message) {
  throw new TaleTokenMaterializationError(code, message);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function exact(actual, expected, code, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(code, `${label} is not exact`);
}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function strict(bytes, label) {
  try {
    return parseJsonStrict(bytes);
  } catch (error) {
    fail('CORE_TALE_RESET_BASE_DRIFT', `${label}: ${error.message}`);
  }
}

function suffixFromId(id, prefix, label) {
  if (typeof id !== 'string' || !id.startsWith(prefix)) {
    fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `${label} does not match ${prefix}`);
  }
  const suffix = id.slice(prefix.length);
  if (!/^[0-9]+$/u.test(suffix)) {
    fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `${label} has a nonnumeric step`);
  }
  return suffix;
}

function ruleForOrdinal(rules, ordinal) {
  return rules.find((rule) => ordinal >= rule.ordinalFrom && ordinal <= rule.ordinalTo);
}

export function correctTaleTokenClassification(parent, reset) {
  const delta = reset.classificationDelta;
  if (delta?.profile !== 'core-ui-tale-reference-family-correction-v1') {
    fail('CORE_TALE_RESET_DECISION_MISMATCH', 'classification profile');
  }
  const affectedOrdinals = new Set();
  const entries = parent.entries.map((entry) => {
    const ordinal = entry.occurrence.ordinal;
    const deferral = ruleForOrdinal(delta.deferrals, ordinal);
    const rename = ruleForOrdinal(delta.renames, ordinal);
    if (!deferral && !rename) return structuredClone(entry);
    affectedOrdinals.add(ordinal);
    if (
      entry.groupId !== undefined
      || parent.groups.some((group) => group.members.some((member) => member.ordinal === ordinal))
    ) {
      fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `affected ordinal ${ordinal} belongs to a group`);
    }
    if (deferral) {
      if (entry.disposition !== 'adopt') {
        fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `ordinal ${ordinal} is not adopted`);
      }
      suffixFromId(entry.coreTokenId, deferral.previousCoreIdPrefix, `entry ${ordinal}`);
      exact(entry.targets, delta.retainedTargets, 'CORE_TALE_RESET_TARGET_MISMATCH', `entry ${ordinal} prior targets`);
      if (entry.reason === delta.deferralReason) {
        fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `ordinal ${ordinal} retains its adoption reason`);
      }
      const { coreTokenId: _coreTokenId, ...rest } = entry;
      return {
        ...structuredClone(rest),
        disposition: 'defer',
        reason: delta.deferralReason,
        targets: structuredClone(delta.deferredTargets),
      };
    }
    const step = suffixFromId(entry.coreTokenId, rename.previousCoreIdPrefix, `entry ${ordinal}`);
    if (!entry.occurrence.name.endsWith(`-${step}`)) {
      fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `entry ${ordinal} source suffix`);
    }
    exact(entry.targets, delta.retainedTargets, 'CORE_TALE_RESET_TARGET_MISMATCH', `entry ${ordinal} retained targets`);
    return { ...structuredClone(entry), coreTokenId: `${rename.resultCoreIdPrefix}${step}` };
  });
  const expectedAffected = [...delta.deferrals, ...delta.renames]
    .reduce((count, rule) => count + rule.ordinalTo - rule.ordinalFrom + 1, 0);
  if (affectedOrdinals.size !== expectedAffected) {
    fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', 'affected ordinal closure');
  }

  const coreTokens = parent.coreTokens.flatMap((candidate) => {
    const deferral = delta.deferrals.find((rule) => candidate.id.startsWith(rule.previousCoreIdPrefix));
    if (deferral) return [];
    const rename = delta.renames.find((rule) => candidate.id.startsWith(rule.previousCoreIdPrefix));
    if (!rename) return [structuredClone(candidate)];
    const step = suffixFromId(candidate.id, rename.previousCoreIdPrefix, candidate.id);
    if (typeof rename.meaningTemplate !== 'string' || !rename.meaningTemplate.includes('{step}')) {
      fail('CORE_TALE_RESET_MEANING_MISMATCH', rename.family);
    }
    return [{
      ...structuredClone(candidate),
      id: `${rename.resultCoreIdPrefix}${step}`,
      definition: {
        ...structuredClone(candidate.definition),
        meaning: rename.meaningTemplate.replaceAll('{step}', step),
      },
    }];
  });
  const ids = coreTokens.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) fail('CORE_TALE_RESET_TOKEN_COLLISION', 'duplicate Core ID');
  const entryIds = new Set(entries.flatMap((entry) => entry.coreTokenId ? [entry.coreTokenId] : []));
  const tokenIds = new Set(ids);
  if (
    [...entryIds].some((id) => !tokenIds.has(id))
    || [...tokenIds].some((id) => !entryIds.has(id) && id !== 'reference.duration.fast')
  ) {
    fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', 'corrected entry/token closure');
  }
  return { ...structuredClone(parent), entries, coreTokens };
}

export function projectTaleBaselineOccurrences(parent) {
  if (parent?.schema !== 'core-ui-tale-token-classification-annex-v1') {
    fail('CORE_TALE_RESET_DECISION_MISMATCH', 'parent decision schema');
  }
  return parent.entries.map(({ occurrence }) => {
    const { media: _media, ...identity } = occurrence;
    return identity;
  });
}

export function projectTaleSourceCrosswalk(parent) {
  const { fixturePath: _fixturePath, authorityReference: _authorityReference, ...baseline } = parent.source;
  const membership = new Map();
  for (const group of parent.groups) {
    for (const member of group.members) {
      if (membership.has(member.ordinal)) {
        fail('CORE_TALE_RESET_CLASSIFICATION_MISMATCH', `ordinal ${member.ordinal} has multiple groups`);
      }
      membership.set(member.ordinal, group.id);
    }
  }
  return {
    baseline,
    entries: parent.entries.map((entry) => {
      const { media: _media, ...occurrence } = entry.occurrence;
      return {
        occurrence,
        disposition: entry.disposition,
        ...(entry.reason === undefined ? {} : { reason: entry.reason }),
        ...(entry.coreTokenId === undefined ? {} : { coreTokenId: entry.coreTokenId }),
        ...(membership.has(entry.occurrence.ordinal)
          ? { groupId: membership.get(entry.occurrence.ordinal) }
          : {}),
        targets: structuredClone(entry.targets),
      };
    }),
    groups: structuredClone(parent.groups),
  };
}

export function materializeTaleTokenSource({ phaseBSource, parentDecision, resetDecision }) {
  if (
    parentDecision?.decisionId !== 'core-ui:decision:0003'
    || resetDecision?.decisionId !== 'core-ui:decision:0004'
  ) {
    fail('CORE_TALE_RESET_DECISION_MISMATCH', 'decision identity');
  }
  const source = structuredClone(phaseBSource);
  const correctedParent = correctTaleTokenClassification(parentDecision, resetDecision);
  for (const candidate of correctedParent.coreTokens) {
    if (candidate.action === 'add') {
      if (source.tokens[candidate.id]) fail('CORE_TALE_RESET_TOKEN_COLLISION', candidate.id);
      source.tokens[candidate.id] = structuredClone(candidate.definition);
    } else if (candidate.action === 'reuse') {
      exact(source.tokens[candidate.id], candidate.definition, 'CORE_TALE_RESET_DECISION_MISMATCH', candidate.id);
    } else {
      fail('CORE_TALE_RESET_DECISION_MISMATCH', `unsupported action ${candidate.action}`);
    }
  }
  source.sourceCrosswalk = projectTaleSourceCrosswalk(correctedParent);
  const expectedRemovals = Object.keys(phaseBSource.tokens)
    .filter((id) => id.startsWith('reference.') && id !== 'reference.duration.fast')
    .sort(bytewise);
  const removalIds = resetDecision.removals.map(({ id }) => id);
  exact(removalIds, expectedRemovals, 'CORE_TALE_RESET_REMOVAL_EXTRA', 'removal IDs');
  for (const removal of resetDecision.removals) {
    if (!source.tokens[removal.id]) fail('CORE_TALE_RESET_REMOVAL_MISSING', removal.id);
    delete source.tokens[removal.id];
  }
  const semanticIds = Object.keys(phaseBSource.tokens)
    .filter((id) => id.startsWith('semantic.'))
    .sort(bytewise);
  exact(
    resetDecision.semanticMappings.map(({ id }) => id),
    semanticIds,
    'CORE_TALE_RESET_ALIAS_MISMATCH',
    'semantic mapping IDs',
  );
  for (const mapping of resetDecision.semanticMappings) {
    const token = source.tokens[mapping.id];
    if (!token || token.layer !== 'semantic') fail('CORE_TALE_RESET_ALIAS_STALE', mapping.id);
    token.alias = mapping.alias;
    if (Object.keys(mapping.modes).length === 0) delete token.modes;
    else token.modes = structuredClone(mapping.modes);
  }
  source.tokenContractVersion = resetDecision.versions.tokenContractVersion.to;
  validateFamily('token-source', source);
  validateSourceCrosswalk(source, { baselineOccurrences: projectTaleBaselineOccurrences(parentDecision) });
  const finalIds = Object.keys(source.tokens).sort(bytewise);
  if (
    finalIds.length !== resetDecision.summary.finalTokenCount
    || finalIds.filter((id) => id.startsWith('reference.')).length !== resetDecision.summary.finalReferenceTokenCount
    || finalIds.filter((id) => id.startsWith('semantic.')).length !== resetDecision.summary.semanticTokenCount
    || finalIds.filter((id) => id.startsWith('component.')).length !== resetDecision.summary.componentTokenCount
  ) {
    fail('CORE_TALE_RESET_FINAL_IDENTITY_MISMATCH', 'final token counts');
  }
  if (
    canonicalDigest(finalIds) !== resetDecision.digests.finalTokenIds
    || canonicalDigest(source.sourceCrosswalk) !== resetDecision.digests.correctedSourceCrosswalk
    || canonicalDigest(source) !== resetDecision.digests.finalTokenSource
  ) {
    fail('CORE_TALE_RESET_FINAL_IDENTITY_MISMATCH', 'accepted final digests');
  }
  return source;
}

async function exactFile(repositoryRoot, path, expectedDigest) {
  const bytes = await readFile(join(repositoryRoot, path), 'utf8');
  if (sha256(bytes) !== expectedDigest) fail('CORE_TALE_RESET_DECISION_MISMATCH', path);
  return { bytes, value: strict(bytes, path) };
}

export async function loadTaleTokenMaterialization(repositoryRoot) {
  const paths = TALE_TOKEN_MATERIALIZATION_PATHS;
  const identities = TALE_TOKEN_MATERIALIZATION_IDENTITIES;
  const [currentBytes, phaseB, parentDecision, parentAcceptance, resetDecision, acceptance] = await Promise.all([
    readFile(join(repositoryRoot, paths.currentSource), 'utf8'),
    exactFile(repositoryRoot, paths.phaseBSource, identities.phaseBFile),
    exactFile(repositoryRoot, paths.parentDecision, identities.parentDecision),
    exactFile(repositoryRoot, paths.parentAcceptance, identities.parentAcceptance),
    exactFile(repositoryRoot, paths.resetDecision, identities.resetDecision),
    exactFile(repositoryRoot, paths.acceptance, identities.acceptance),
  ]);
  if (canonicalDigest(phaseB.value) !== identities.phaseBCanonical) {
    fail('CORE_TALE_RESET_BASE_DRIFT', 'Phase-B canonical content digest');
  }
  const finalSource = materializeTaleTokenSource({
    phaseBSource: phaseB.value,
    parentDecision: parentDecision.value,
    resetDecision: resetDecision.value,
  });
  if (canonicalDigest(finalSource) !== identities.finalSource) {
    fail('CORE_TALE_RESET_FINAL_IDENTITY_MISMATCH', 'final source constant');
  }
  const currentSource = strict(currentBytes, paths.currentSource);
  const currentCanonical = canonicalDigest(currentSource);
  const state = currentBytes === phaseB.bytes ? 'phase-b'
    : currentCanonical === identities.finalSource ? 'materialized'
      : null;
  if (state === null) fail('CORE_TALE_RESET_BASE_DRIFT', paths.currentSource);
  return {
    acceptance: acceptance.value,
    currentBytes,
    currentSource,
    finalBytes: `${JSON.stringify(finalSource, null, 2)}\n`,
    finalSource,
    parentAcceptance: parentAcceptance.value,
    parentDecision: parentDecision.value,
    phaseBBytes: phaseB.bytes,
    phaseBSource: phaseB.value,
    resetDecision: resetDecision.value,
    state,
  };
}

export async function runTaleTokenMaterialization(repositoryRoot, { mode = 'write' } = {}) {
  const loaded = await loadTaleTokenMaterialization(repositoryRoot);
  const currentPath = join(repositoryRoot, TALE_TOKEN_MATERIALIZATION_PATHS.currentSource);
  if (mode === 'check') {
    if (loaded.state !== 'materialized') fail('CORE_TALE_RESET_FINAL_IDENTITY_MISMATCH', 'source is not materialized');
    return { changed: false, mode, state: loaded.state };
  }
  if (mode === 'dry-run') {
    return { changed: loaded.state === 'phase-b', mode, state: loaded.state };
  }
  if (mode === 'rollback-check') {
    if (loaded.currentBytes !== loaded.phaseBBytes) fail('CORE_TALE_RESET_BASE_DRIFT', 'source is not byte-exact Phase B');
    return { changed: false, mode, state: 'phase-b' };
  }
  if (mode === 'rollback') {
    if (loaded.state === 'materialized') await writeFile(currentPath, loaded.phaseBBytes);
    return { changed: loaded.state === 'materialized', mode, state: 'phase-b' };
  }
  if (mode !== 'write') fail('CORE_TALE_RESET_DECISION_MISMATCH', `unknown mode ${mode}`);
  if (loaded.state === 'phase-b') await writeFile(currentPath, loaded.finalBytes);
  return { changed: loaded.state === 'phase-b', mode, state: 'materialized' };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const mode = process.argv.includes('--check') ? 'check'
    : process.argv.includes('--dry-run') ? 'dry-run'
      : process.argv.includes('--rollback-check') ? 'rollback-check'
        : process.argv.includes('--rollback') ? 'rollback'
          : 'write';
  const result = await runTaleTokenMaterialization(repositoryRoot, { mode });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
