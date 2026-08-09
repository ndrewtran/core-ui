import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import { sha256 } from './policy.mjs';
import {
  acceptanceCommentBody,
  assertTaleAnnexAcceptanceRecord as assertAcceptance,
} from './tale-token-annex-acceptance.mjs';

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const GIT_REVISION = /^[0-9a-f]{40}$/u;
const TOKEN_ID = /^reference\.(color|dimension|duration|number)\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u;

export class TaleTokenAnnexError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'TaleTokenAnnexError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new TaleTokenAnnexError(code, message);
}

function exactKeys(value, expected, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('TALE_ANNEX_SHAPE_INVALID', `${path} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    fail('TALE_ANNEX_UNKNOWN_FIELD', `${path} keys ${actual.join(',')} must equal ${wanted.join(',')}`);
  }
}

function exactArray(value, expected, path) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail('TALE_ANNEX_VALUE_INVALID', `${path} must equal ${canonicalJson(expected)}`);
  }
}

function nonEmpty(value, path) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('TALE_ANNEX_VALUE_INVALID', `${path} must be a non-empty string`);
  }
}

function bytewise(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function digest(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function strict(source, path) {
  try {
    return parseJsonStrict(source);
  } catch (error) {
    const code = error?.code === 'JSON_DUPLICATE_KEY'
      ? 'TALE_ANNEX_DUPLICATE_KEY'
      : 'TALE_ANNEX_JSON_INVALID';
    fail(code, `${path}: ${error.message}`);
  }
}

async function strictFile(path, label) {
  const bytes = await readFile(path, 'utf8');
  return { bytes, value: strict(bytes, label) };
}

function enumerateSource(source) {
  exactKeys(source, ['$schema', 'baseFontSize', 'description', 'files', 'formatVersion'], 'source fixture');
  const entries = [];
  let ordinal = 0;
  for (const [file, blocks] of Object.entries(source.files)) {
    if (!Array.isArray(blocks)) fail('TALE_ANNEX_SOURCE_MISMATCH', `${file} must contain blocks`);
    for (const [blockIndex, block] of blocks.entries()) {
      exactKeys(block, block.media ? ['selector', 'media', 'declarations'] : ['selector', 'declarations'], `source.${file}[${blockIndex}]`);
      for (const [name, value] of Object.entries(block.declarations)) {
        ordinal += 1;
        entries.push({ ordinal, file, selector: block.selector, ...(block.media ? { media: block.media } : {}), name, value });
      }
    }
  }
  return entries;
}

function verifySourceValueMappingProfile(value) {
  exactKeys(value, [
    'profile', 'baseFontSizePx', 'scaleVariable', 'scaleRoundingDecimals',
    'colorMixSpace', 'colorMixTransparentKeyword', 'colorMixAlphaRounding',
  ], 'sourceValueMapping');
  if (
    value.profile !== 'core-ui-tale-source-value-mapping-v1'
    || value.baseFontSizePx !== 16
    || value.scaleVariable !== '--scale'
    || value.scaleRoundingDecimals !== 2
    || value.colorMixSpace !== 'srgb'
    || value.colorMixTransparentKeyword !== 'transparent'
    || value.colorMixAlphaRounding !== 'nearest'
  ) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', 'source-value mapping profile');
}

function exactRootSourceValue(sourceEntries, name, path) {
  const matches = sourceEntries.filter((entry) => entry.name === name && entry.selector === ':root' && !entry.media);
  if (matches.length !== 1) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} requires exactly one :root ${name} source`);
  return matches[0].value;
}

function resolveSourceColor(sourceEntries, name, path, seen = new Set()) {
  if (seen.has(name)) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} contains a color alias cycle`);
  const nextSeen = new Set(seen).add(name);
  const value = exactRootSourceValue(sourceEntries, name, path);
  if (/^#[0-9a-f]{6}$/iu.test(value)) return value.toLowerCase();
  const alias = /^var\((--[a-z0-9-]+)\)$/iu.exec(value);
  if (!alias) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} cannot resolve ${name} to one hex color`);
  return resolveSourceColor(sourceEntries, alias[1], path, nextSeen);
}

function normalizeSourceValue(entry, definition, sourceEntries, mapping, path) {
  const sourceValue = entry.occurrence.value;
  if (definition.type === 'color' && definition.unit === 'hex') {
    if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(sourceValue)) return sourceValue.toLowerCase();
    const colorMix = /^color-mix\(in ([a-z0-9-]+), var\((--[a-z0-9-]+)\) ([0-9]+(?:\.[0-9]+)?)%, ([a-z-]+)\)$/iu.exec(sourceValue);
    if (!colorMix || colorMix[1] !== mapping.colorMixSpace || colorMix[4] !== mapping.colorMixTransparentKeyword) {
      fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} is not a supported color source`);
    }
    const percentage = Number(colorMix[3]);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} color-mix percentage`);
    const base = resolveSourceColor(sourceEntries, colorMix[2], path);
    const alpha = Math.round((percentage / 100) * 255).toString(16).padStart(2, '0');
    return `${base}${alpha}`;
  }
  if (definition.type === 'dimension' && definition.unit === 'px') {
    const rem = /^([0-9]+(?:\.[0-9]+)?)rem$/u.exec(sourceValue);
    if (rem) return Number(rem[1]) * mapping.baseFontSizePx;
    const px = /^([0-9]+(?:\.[0-9]+)?)px$/u.exec(sourceValue);
    if (px) return Number(px[1]);
    if (sourceValue === '0') return 0;
    const scaled = /^calc\(([0-9]+(?:\.[0-9]+)?) \* var\((--[a-z0-9-]+)\)\)$/u.exec(sourceValue);
    if (!scaled || scaled[2] !== mapping.scaleVariable) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} is not a supported dimension source`);
    const scaleSource = exactRootSourceValue(sourceEntries, mapping.scaleVariable, path);
    const scaleRem = /^([0-9]+(?:\.[0-9]+)?)rem$/u.exec(scaleSource);
    if (!scaleRem) fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} scale source must be rem`);
    const scale = Number((Number(scaleRem[1]) * mapping.baseFontSizePx).toFixed(mapping.scaleRoundingDecimals));
    return Number(scaled[1]) * scale;
  }
  if (definition.type === 'duration' && definition.unit === 'ms') {
    const duration = /^([0-9]+(?:\.[0-9]+)?)ms$/u.exec(sourceValue);
    if (duration) return Number(duration[1]);
  }
  if (definition.type === 'number' && definition.unit === 'unitless') {
    if (/^[0-9]+(?:\.[0-9]+)?$/u.test(sourceValue)) return Number(sourceValue);
  }
  fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `${path} cannot map ${sourceValue} to ${definition.type}/${definition.unit}`);
}

function verifyEntryDefinitionMappings(entries, coreTokens, sourceEntries, profile) {
  const tokenById = new Map(coreTokens.map((token) => [token.id, token]));
  for (const entry of entries) {
    if (!entry.coreTokenId) continue;
    const token = tokenById.get(entry.coreTokenId);
    if (!token) fail('TALE_ANNEX_TOKEN_MAPPING_INVALID', `${entry.coreTokenId} has no definition`);
    const mapped = normalizeSourceValue(entry, token.definition, sourceEntries, profile.sourceValueMapping, `occurrence ${entry.occurrence.ordinal}`);
    if (canonicalJson(mapped) !== canonicalJson(token.definition.value)) {
      fail('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', `occurrence ${entry.occurrence.ordinal} maps ${canonicalJson(mapped)} to ${entry.coreTokenId} value ${canonicalJson(token.definition.value)}`);
    }
  }
}

function verifyFieldOwnership(value) {
  exactKeys(value, ['profile', 'authored', 'referenced', 'derived', 'proved', 'rule'], 'fieldOwnership');
  if (value.profile !== 'core-ui-tale-token-annex-field-ownership-v1') fail('TALE_ANNEX_OWNERSHIP_INVALID', 'field ownership profile');
  const expected = {
    authored: [
      'acceptance topology for this immutable candidate', 'entry dispositions/reasons/Core mappings/target dispositions',
      'group identities/relationships/member roles and modes', 'new Core token IDs/actions/definitions',
      'page selection bounds and failure contracts fixed by this annex', 'exact query response/version/descriptor/resolver compatibility plan',
      'migration and rollback choices fixed by this annex', 'non-goal claim boundaries',
    ],
    referenced: [
      'governing authority revision and accepted Phase A/B/C sequence', 'pinned Tale repository/revision/path/digest/base-font baseline',
      'canonical binding/runtime/validation identities and renderer package ownership', 'Core canonical JSON, ArtifactRef, SemVer, lexer, and evidence-chain contracts',
      'existing reference.duration.fast definition and current token-contract identity',
    ],
    derived: [
      'source occurrence counts and exact occurrence projections', 'summary counts', 'release additions',
      'candidate sourceCrosswalk digest', 'added-token-ID digest', 'page cursors/envelope digests/lexeme counts',
    ],
    proved: [
      'strict duplicate-key-rejecting source and annex parsing', 'pinned fixture byte hash and exact occurrence equality',
      'closed grammar and relationship closure', 'canonical digest reproduction', 'negative mutation corpus',
    ],
  };
  for (const [classification, paths] of Object.entries(expected)) exactArray(value[classification], paths, `fieldOwnership.${classification}`);
  nonEmpty(value.rule, 'fieldOwnership.rule');
}

function verifyDispositionDefinitions(value, profile) {
  exactKeys(value, profile.dispositions, 'dispositionDefinitions');
  for (const disposition of profile.dispositions) {
    const rule = value[disposition];
    exactKeys(rule, ['requiresCoreTokenId', 'runtimeTokenClaim', 'valueRepresentationChange', 'reasonRequired'], `dispositionDefinitions.${disposition}`);
    const admitted = ['adopt', 'adapt'].includes(disposition);
    if (rule.requiresCoreTokenId !== admitted || rule.runtimeTokenClaim !== admitted || rule.reasonRequired !== true || rule.valueRepresentationChange !== (disposition === 'adapt')) {
      fail('TALE_ANNEX_DISPOSITION_INVALID', `${disposition} contract is inconsistent`);
    }
  }
}

function verifyEntry(entry, sourceEntry, profile, index) {
  const keys = ['occurrence', 'disposition', 'reason', 'targets'];
  if (['adopt', 'adapt'].includes(entry.disposition)) keys.push('coreTokenId');
  exactKeys(entry, keys, `entries[${index}]`);
  exactKeys(entry.occurrence, sourceEntry.media ? ['ordinal', 'file', 'selector', 'media', 'name', 'value'] : ['ordinal', 'file', 'selector', 'name', 'value'], `entries[${index}].occurrence`);
  if (canonicalJson(entry.occurrence) !== canonicalJson(sourceEntry)) fail('TALE_ANNEX_SOURCE_MISMATCH', `entries[${index}] differs from the pinned source`);
  if (!profile.dispositions.includes(entry.disposition)) fail('TALE_ANNEX_DISPOSITION_INVALID', `entries[${index}] disposition`);
  nonEmpty(entry.reason, `entries[${index}].reason`);
  const admitted = ['adopt', 'adapt'].includes(entry.disposition);
  if (admitted && !TOKEN_ID.test(entry.coreTokenId ?? '')) fail('TALE_ANNEX_TOKEN_MAPPING_INVALID', `entries[${index}] requires one portable reference token`);
  if (!admitted && Object.hasOwn(entry, 'coreTokenId')) fail('TALE_ANNEX_TOKEN_MAPPING_INVALID', `entries[${index}] must not claim a Core token`);
  exactKeys(entry.targets, profile.targetIds, `entries[${index}].targets`);
  for (const targetId of profile.targetIds) {
    if (!profile.targetDispositions.includes(entry.targets[targetId])) fail('TALE_ANNEX_TARGET_INVALID', `entries[${index}].targets.${targetId}`);
  }
  if (admitted) {
    for (const targetId of ['web.html', 'web.react', 'native.ios', 'native.android']) {
      if (entry.targets[targetId] !== 'direct') fail('TALE_ANNEX_TARGET_INVALID', `admitted ${targetId} must be direct`);
    }
    if (entry.targets['native.react-native-web'] !== 'deferred') fail('TALE_ANNEX_TARGET_INVALID', 'React Native Web remains deferred');
  } else {
    const expected = entry.disposition === 'reject' ? 'rejected' : 'deferred';
    for (const targetId of profile.targetIds) if (entry.targets[targetId] !== expected) fail('TALE_ANNEX_TARGET_INVALID', `${entry.disposition} targets must be ${expected}`);
  }
}

function verifyGroups(groups, entries, profile, expectedCount) {
  if (!Array.isArray(groups) || groups.length !== 41 || expectedCount !== 41) fail('TALE_ANNEX_GROUP_INCOMPLETE', 'the accepted annex requires exactly 41 groups');
  const seenIds = new Set();
  const seenMembers = new Set();
  const groupMemberSets = [];
  let previousId = '';
  for (const [index, group] of groups.entries()) {
    const keys = ['id', 'relationship', 'members'];
    if (group.coreTokenId) keys.push('coreTokenId');
    exactKeys(group, keys, `groups[${index}]`);
    nonEmpty(group.id, `groups[${index}].id`);
    if (seenIds.has(group.id) || bytewise(group.id, previousId) < 0) fail('TALE_ANNEX_GROUP_DUPLICATE', `${group.id} is duplicate or out of bytewise order`);
    seenIds.add(group.id); previousId = group.id;
    if (!profile.groupRelationships.includes(group.relationship)) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} relationship`);
    if (!Array.isArray(group.members) || group.members.length < 2) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} needs members`);
    const roles = [];
    const ordinals = [];
    for (const [memberIndex, member] of group.members.entries()) {
      exactKeys(member, member.mode ? ['ordinal', 'role', 'mode'] : ['ordinal', 'role'], `groups[${index}].members[${memberIndex}]`);
      if (!Number.isInteger(member.ordinal) || member.ordinal < 1 || member.ordinal > entries.length || seenMembers.has(member.ordinal)) fail('TALE_ANNEX_GROUP_DUPLICATE', `${group.id} occurrence ${member.ordinal}`);
      seenMembers.add(member.ordinal); ordinals.push(member.ordinal); roles.push(member.role);
      if (!profile.groupRoles.includes(member.role)) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} role`);
      if (member.mode && !profile.groupModes.includes(member.mode)) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} mode`);
    }
    if (group.relationship === 'selector-variants') {
      exactArray(roles, ['base', 'web-responsive'], `${group.id}.roles`);
      if (group.members.some((member) => member.mode)) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} selector members cannot have modes`);
    } else if (group.relationship === 'mode-variants') {
      exactArray(roles, ['default', 'reduced-system', 'reduced-explicit'], `${group.id}.roles`);
      if (group.members.some((member) => !member.mode)) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} requires explicit modes`);
      exactArray(group.members.map((member) => member.mode), ['motion.full', 'motion.reduced', 'motion.reduced'], `${group.id}.modes`);
    } else {
      if (roles.some((role) => role !== 'equivalent-source-value') || group.members.some((member) => member.mode)) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} equivalence roles`);
      const values = new Set(ordinals.map((ordinal) => entries[ordinal - 1].occurrence.value));
      if (values.size !== 1) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} values are not equivalent`);
    }
    if (group.coreTokenId) {
      for (const ordinal of ordinals) {
        const mapped = entries[ordinal - 1].coreTokenId;
        if (mapped && mapped !== group.coreTokenId) fail('TALE_ANNEX_GROUP_INVALID', `${group.id} mapping conflict`);
      }
    }
    const admittedMappings = ordinals.map((ordinal) => entries[ordinal - 1].coreTokenId).filter(Boolean);
    const uniqueMappings = new Set(admittedMappings);
    if (uniqueMappings.size > 1) {
      fail('TALE_ANNEX_GROUP_INVALID', `${group.id} has multiple admitted Core mappings`);
    }
    if (uniqueMappings.size === 0 && group.coreTokenId) {
      fail('TALE_ANNEX_GROUP_INVALID', `${group.id} cannot bind an unmapped Core token`);
    }
    if (uniqueMappings.size === 1 && group.coreTokenId !== admittedMappings[0]) {
      fail('TALE_ANNEX_GROUP_INVALID', `${group.id} must bind its admitted Core token`);
    }
    if (group.coreTokenId && !uniqueMappings.has(group.coreTokenId)) {
      fail('TALE_ANNEX_GROUP_INVALID', `${group.id} has an invalid Core token binding`);
    }
    groupMemberSets.push(new Set(ordinals));
  }
  const repeated = Map.groupBy(entries, (entry) => entry.occurrence.name);
  for (const [name, matching] of repeated) {
    if (matching.length < 2) continue;
    const ordinals = matching.map((entry) => entry.occurrence.ordinal);
    const exact = groupMemberSets.some((members) => ordinals.length === members.size && ordinals.every((ordinal) => members.has(ordinal)));
    if (!exact) fail('TALE_ANNEX_GROUP_INCOMPLETE', `${name} has no exact explicit group`);
  }
  const groupsByCoreToken = Map.groupBy(groups.filter((group) => group.coreTokenId), (group) => group.coreTokenId);
  for (const [coreTokenId, matchingGroups] of groupsByCoreToken) {
    if (matchingGroups.length !== 1) fail('TALE_ANNEX_GROUP_DUPLICATE', `${coreTokenId} has multiple owning groups`);
  }
  const entriesByCoreToken = Map.groupBy(entries.filter((entry) => entry.coreTokenId), (entry) => entry.coreTokenId);
  for (const [coreTokenId, matchingEntries] of entriesByCoreToken) {
    if (matchingEntries.length < 2) continue;
    const ordinals = matchingEntries.map((entry) => entry.occurrence.ordinal);
    const group = groupsByCoreToken.get(coreTokenId)?.[0];
    const members = new Set(group?.members.map((member) => member.ordinal) ?? []);
    if (!group || members.size !== ordinals.length || ordinals.some((ordinal) => !members.has(ordinal))) {
      fail('TALE_ANNEX_GROUP_INCOMPLETE', `${coreTokenId} shared mapping requires one exact explicit group`);
    }
  }
}

function verifyTokenDefinitions(coreTokens, entries, currentTokenSource, profile) {
  const ids = new Set();
  const mappedIds = new Set(entries.flatMap((entry) => entry.coreTokenId ? [entry.coreTokenId] : []));
  let previousId = '';
  for (const [index, token] of coreTokens.entries()) {
    exactKeys(token, ['id', 'action', 'definition'], `coreTokens[${index}]`);
    if (!TOKEN_ID.test(token.id) || ids.has(token.id) || bytewise(token.id, previousId) < 0) fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} is invalid, duplicate, or out of bytewise order`);
    ids.add(token.id); previousId = token.id;
    if (!['add', 'reuse'].includes(token.action)) fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} action`);
    const definitionKeys = ['layer', 'type', 'unit', 'meaning', 'overridePolicy', 'value'];
    if (token.definition.modes) definitionKeys.push('modes');
    exactKeys(token.definition, definitionKeys, `${token.id}.definition`);
    const idType = token.id.split('.')[1];
    if (token.definition.layer !== 'reference' || idType !== token.definition.type || profile.portableTypeUnits[token.definition.type] !== token.definition.unit) fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} layer/type/unit`);
    nonEmpty(token.definition.meaning, `${token.id}.meaning`);
    if (token.definition.overridePolicy !== 'fixed') fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} override policy`);
    const value = token.definition.value;
    if (typeof value === 'string' && /(?:cubic-bezier|clamp|var|calc|drop-shadow|rgba?)\s*\(/iu.test(value)) fail('TALE_ANNEX_CSS_VALUE_FORBIDDEN', `${token.id} cannot admit CSS syntax`);
    if (token.definition.type === 'color' && (typeof value !== 'string' || !/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value))) fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} color`);
    if (['dimension', 'duration', 'number'].includes(token.definition.type) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} numeric value`);
    if (token.definition.modes) {
      exactKeys(token.definition.modes, ['motion.reduced'], `${token.id}.modes`);
      exactKeys(token.definition.modes['motion.reduced'], ['value'], `${token.id}.modes.motion.reduced`);
      if (typeof token.definition.modes['motion.reduced'].value !== typeof value) fail('TALE_ANNEX_TOKEN_INVALID', `${token.id} mode type`);
    }
    if (token.action === 'reuse') {
      if (canonicalJson(currentTokenSource.tokens[token.id]) !== canonicalJson(token.definition)) fail('TALE_ANNEX_REUSE_MISMATCH', `${token.id} must exactly preserve Core`);
    } else if (currentTokenSource.tokens[token.id]) fail('TALE_ANNEX_TOKEN_COLLISION', `${token.id} already exists`);
    if (!mappedIds.has(token.id)) fail('TALE_ANNEX_TOKEN_UNMAPPED', `${token.id} has no occurrence`);
  }
  for (const id of mappedIds) if (!ids.has(id)) fail('TALE_ANNEX_TOKEN_MAPPING_INVALID', `${id} has no definition`);
}

function verifyAuthoredReasonReferences(entries, coreTokens) {
  const ids = new Set(coreTokens.map((token) => token.id));
  const referencePattern = /reference\.(?:color|dimension|duration|number)\.[a-z0-9.-]+/gu;
  for (const entry of entries) {
    for (const reference of entry.reason.match(referencePattern) ?? []) {
      if (!ids.has(reference)) fail('TALE_ANNEX_REASON_REFERENCE_INVALID', `occurrence ${entry.occurrence.ordinal} names absent ${reference}`);
    }
    if (/\b(?:admitted accent palette|reference\.color\.accent-|reference\.color\.[a-z]+-status-)/u.test(entry.reason)) {
      fail('TALE_ANNEX_REASON_REFERENCE_INVALID', `occurrence ${entry.occurrence.ordinal} regresses to a role-oriented reference name`);
    }
  }
}

function decodeCursor(cursor, path) {
  const parts = cursor.split('.');
  if (parts.length !== 3 || parts[0] !== 'c1' || !/^[0-9a-f]{64}$/u.test(parts[2])) fail('TALE_ANNEX_CURSOR_INVALID', `${path} encoding`);
  let source;
  try { source = Buffer.from(parts[1], 'base64url').toString('utf8'); } catch { fail('TALE_ANNEX_CURSOR_INVALID', `${path} payload`); }
  if (sha256(source) !== parts[2]) fail('TALE_ANNEX_CURSOR_INVALID', `${path} integrity`);
  const value = strict(source, `${path}.payload`);
  if (canonicalJson(value) !== source) fail('TALE_ANNEX_CURSOR_INVALID', `${path} payload is not canonical`);
  exactKeys(value, ['queryApiVersion', 'catalogDigest', 'tokenSourceContentRevision', 'section', 'selectorDigest', 'nextPosition'], `${path}.payload`);
  return value;
}

function verifyPageProfiles(annex, profile) {
  if (!Array.isArray(annex.pageProfiles) || annex.pageProfiles.length !== 2) fail('TALE_ANNEX_PAGE_PROFILE_INVALID', 'two page profiles required');
  exactArray(annex.pageProfiles.map((page) => page.queryApiVersion), ['1.2.0', '2.0.0'], 'page profile versions');
  for (const page of annex.pageProfiles) {
    exactKeys(page, ['id', 'queryApiVersion', 'lexerVersion', 'canonicalEntryOrder', 'entryCostRule', 'densePageBudgetTokens', 'normalizedWorstCaseEnvelopePreimage', 'normalizedWorstCaseEnvelopeSha256', 'measuredWorstCaseEnvelopeTokens', 'envelopeReserveTokens', 'maximumEntryTokens', 'defaultItemLimit', 'maximumItemLimit', 'minimumProgressEntries', 'selection', 'oversizeCode', 'envelopeOversizeCode', 'cursorProfile', 'cursorPayloadCanonicalization', 'cursorEncoding', 'cursorMaximumBytes', 'cursorPositionMaximum', 'artifactIdMaximumBytes', 'artifactIdMaximumLexemes', 'catalogVersionMaximumBytes', 'catalogVersionMaximumLexemes', 'cursorBindings', 'truncation'], `pageProfiles.${page.queryApiVersion}`);
    if (page.lexerVersion !== profile.pageLexerVersion || page.densePageBudgetTokens !== 2048 || page.envelopeReserveTokens !== 512 || page.maximumEntryTokens !== 1536 || page.maximumEntryTokens + page.envelopeReserveTokens !== page.densePageBudgetTokens) fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.queryApiVersion} budget`);
    const expectedPageId = `core-ui-token-section-page-budget-${page.queryApiVersion.replaceAll('.', '-')}`;
    if (page.id !== expectedPageId || page.canonicalEntryOrder !== 'tokens by Core token ID; source-crosswalk by source ordinal; bytewise ascending UTF-8 for ties' || page.entryCostRule !== 'Core lexer lexeme count over canonical compact JSON for each complete entry' || page.selection !== 'greatest non-empty canonical-entry prefix within both the item ceiling and remaining token budget' || page.cursorPayloadCanonicalization !== 'Core canonical JSON UTF-8' || page.cursorEncoding !== 'c1.<unpadded-base64url-canonical-payload>.<lowercase-sha256-of-canonical-payload>') fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.queryApiVersion} semantic contract`);
    if (page.defaultItemLimit !== 20 || page.maximumItemLimit !== 100 || page.minimumProgressEntries !== 1 || page.oversizeCode !== 'CORE_QUERY_PAGE_ENTRY_TOO_LARGE' || page.envelopeOversizeCode !== 'CORE_QUERY_PAGE_ENVELOPE_TOO_LARGE' || page.cursorProfile !== 'core-ui-section-cursor-v1' || page.truncation !== 'forbidden') fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.queryApiVersion} constants`);
    if (page.cursorPositionMaximum !== 4294967295 || page.artifactIdMaximumBytes !== 256 || page.artifactIdMaximumLexemes !== 125 || page.catalogVersionMaximumBytes !== 64 || page.catalogVersionMaximumLexemes !== 32) fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.queryApiVersion} variable bounds`);
    exactArray(page.cursorBindings, ['queryApiVersion', 'catalogDigest', 'tokenSourceContentRevision', 'section', 'selectorDigest', 'nextPosition'], `${page.queryApiVersion}.cursorBindings`);
    const envelope = page.normalizedWorstCaseEnvelopePreimage;
    exactKeys(envelope, ['schemaVersion', 'responseType', 'meta', 'page', 'diagnostics'], `${page.id}.envelope`);
    exactKeys(envelope.meta, ['queryApiVersion', 'catalogVersion', 'catalogDigest', 'tokenSourceContentRevision', 'artifactId', 'section', 'selectorDigest'], `${page.id}.meta`);
    exactKeys(envelope.page, ['position', 'returned', 'remaining', 'nextCursor', 'entryTokens', 'densePageBudget'], `${page.id}.page`);
    if (envelope.schemaVersion !== page.queryApiVersion || envelope.meta.queryApiVersion !== page.queryApiVersion || envelope.responseType !== 'artifact.detail.section-page' || envelope.meta.section !== 'source-crosswalk' || !Array.isArray(envelope.diagnostics) || envelope.diagnostics.length !== 0 || envelope.page.position !== page.cursorPositionMaximum - 1 || envelope.page.returned !== 1 || envelope.page.remaining !== 1 || envelope.page.entryTokens !== page.maximumEntryTokens || envelope.page.densePageBudget !== page.densePageBudgetTokens) fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.id} response identity`);
    const artifactBytes = Buffer.byteLength(envelope.meta.artifactId);
    const artifactLexemes = envelope.meta.artifactId.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
    if (artifactBytes !== page.artifactIdMaximumBytes || artifactLexemes !== page.artifactIdMaximumLexemes || !/^core:token:[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(envelope.meta.artifactId)) fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.id} ArtifactRef bound`);
    const catalogVersionLexemes = envelope.meta.catalogVersion.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
    if (Buffer.byteLength(envelope.meta.catalogVersion) !== page.catalogVersionMaximumBytes || catalogVersionLexemes !== page.catalogVersionMaximumLexemes || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(envelope.meta.catalogVersion)) fail('TALE_ANNEX_PAGE_PROFILE_INVALID', `${page.id} catalogVersion bound`);
    const cursor = decodeCursor(envelope.page.nextCursor, `${page.id}.page.nextCursor`);
    if (cursor.queryApiVersion !== page.queryApiVersion || cursor.catalogDigest !== envelope.meta.catalogDigest || cursor.tokenSourceContentRevision !== envelope.meta.tokenSourceContentRevision || cursor.section !== envelope.meta.section || cursor.selectorDigest !== envelope.meta.selectorDigest || cursor.nextPosition !== envelope.page.position + envelope.page.returned || cursor.nextPosition > page.cursorPositionMaximum || envelope.page.remaining <= 0) fail('TALE_ANNEX_PAGE_STATE_MISMATCH', page.id);
    if (Buffer.byteLength(envelope.page.nextCursor) !== page.cursorMaximumBytes) fail('TALE_ANNEX_CURSOR_BOUND_MISMATCH', page.id);
    if (digest(envelope) !== page.normalizedWorstCaseEnvelopeSha256) fail('TALE_ANNEX_PAGE_DIGEST_MISMATCH', page.queryApiVersion);
    const lexemes = canonicalJson(envelope).match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
    if (lexemes !== page.measuredWorstCaseEnvelopeTokens || lexemes > page.envelopeReserveTokens) fail('TALE_ANNEX_PAGE_BUDGET_MISMATCH', page.queryApiVersion);
  }
}

function verifyQueryCompatibility(query, pageProfiles) {
  exactKeys(query, ['request', 'phases', 'responses', 'cli', 'catalogPackageDescriptor', 'resolver', 'pageEnvelope', 'cursor'], 'queryCompatibility');
  exactKeys(query.request, ['owner', 'key', 'required', 'allowed', 'omissionUsesSelectedDescriptor', 'explicitRequiresExactDescriptorMatch'], 'queryCompatibility.request');
  exactArray(query.request.allowed, ['1.1.0', '1.2.0', '2.0.0'], 'queryCompatibility.request.allowed');
  if (query.request.owner !== '@core-ui/schema' || query.request.key !== 'queryApiVersion' || query.request.required !== false || query.request.omissionUsesSelectedDescriptor !== true || query.request.explicitRequiresExactDescriptorMatch !== true) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'request');
  if (!Array.isArray(query.phases) || query.phases.length !== 3) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'phases');
  const phaseExpected = [
    ['A', '1.2.0', ['1.1.0', '1.2.0'], ['1.1.0', '1.2.0']],
    ['B', '2.0.0', ['1.1.0', '1.2.0', '2.0.0'], ['1.1.0', '1.2.0', '2.0.0']],
    ['C', '2.0.0', ['1.1.0', '1.2.0', '2.0.0'], ['1.1.0', '1.2.0', '2.0.0']],
  ];
  query.phases.forEach((phase, index) => {
    exactKeys(phase, ['phase', 'selectedCatalogQueryApiVersion', 'selectedCatalogSupportedQueryApiVersions', 'toolingSupportedRequestVersions'], `queryCompatibility.phases[${index}]`);
    const [id, selected, retained, supported] = phaseExpected[index];
    if (phase.phase !== id || phase.selectedCatalogQueryApiVersion !== selected) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', `phase ${id}`);
    exactArray(phase.selectedCatalogSupportedQueryApiVersions, retained, `phase ${id} selected catalog support`);
    exactArray(phase.toolingSupportedRequestVersions, supported, `phase ${id} supported`);
  });
  if (!Array.isArray(query.responses) || query.responses.length !== 3) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'responses');
  const versions = ['1.1.0', '1.2.0', '2.0.0'];
  query.responses.forEach((response, index) => {
    exactKeys(response, ['queryApiVersion', 'fullInlineTokens', 'fullSummaryFields', 'sections', 'inlineTokenDiagnostic', 'sourceCrosswalkAbsence'], `queryCompatibility.responses[${index}]`);
    if (response.queryApiVersion !== versions[index]) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', `response ${index}`);
  });
  const [v11, v12, v2] = query.responses;
  exactArray(v11.fullSummaryFields, [], 'v1.1 summary');
  exactArray(v11.sections, [], 'v1.1 sections');
  if (v11.fullInlineTokens !== true || v11.inlineTokenDiagnostic !== null || v11.sourceCrosswalkAbsence !== 'selector-unsupported') fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'v1.1 response');
  exactArray(v12.fullSummaryFields, [], 'v1.2 summary');
  exactArray(v12.sections, ['tokens', 'source-crosswalk'], 'v1.2 sections');
  exactKeys(v12.inlineTokenDiagnostic, ['code', 'replacement', 'reason', 'noticeBoundary'], 'v1.2 diagnostic');
  if (v12.fullInlineTokens !== true || v12.inlineTokenDiagnostic.code !== 'CORE_QUERY_INLINE_TOKENS_DEPRECATED' || v12.inlineTokenDiagnostic.replacement !== 'section=tokens' || v12.inlineTokenDiagnostic.reason !== 'inline tokens are removed in query API 2.0.0' || v12.inlineTokenDiagnostic.noticeBoundary !== 'complete separately human-accepted Phase A release' || v12.sourceCrosswalkAbsence !== 'typed-absent') fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'v1.2 response');
  exactArray(v2.sections, ['tokens', 'source-crosswalk'], 'v2 sections');
  exactArray(v2.fullSummaryFields, ['availableSections', 'sourceCrosswalkDigest', 'tokenCount', 'tokenSourceContentRevision'], 'v2 summary');
  if (v2.fullInlineTokens !== false || v2.inlineTokenDiagnostic !== null || v2.sourceCrosswalkAbsence !== 'typed-absent') fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'v2 response');
  exactKeys(query.cli, ['owner', 'option', 'getOptionsAdded', 'sectionChoicesAdded', 'generatedSurfaces', 'commandRegistrySchemaVersion'], 'queryCompatibility.cli');
  exactArray(query.cli.getOptionsAdded, ['query-api-version', 'limit', 'cursor'], 'queryCompatibility.cli.getOptionsAdded');
  exactArray(query.cli.sectionChoicesAdded, ['tokens', 'source-crosswalk'], 'queryCompatibility.cli.sectionChoicesAdded');
  exactArray(query.cli.generatedSurfaces, ['command registry', 'CLI help', 'request/response types', 'human', 'JSON', 'dense'], 'queryCompatibility.cli.generatedSurfaces');
  exactKeys(query.cli.commandRegistrySchemaVersion, ['from', 'to', 'effect'], 'queryCompatibility.cli.commandRegistrySchemaVersion');
  if (query.cli.owner !== '@core-ui/tooling' || query.cli.option !== '--query-api-version <1.1.0|1.2.0|2.0.0>' || query.cli.commandRegistrySchemaVersion.from !== '1.0.0' || query.cli.commandRegistrySchemaVersion.to !== '1.0.0' || query.cli.commandRegistrySchemaVersion.effect !== 'none') fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'CLI/registry');
  exactKeys(query.catalogPackageDescriptor, ['owner', 'schemaFrom', 'schemaTo', 'schemaEffect', 'queryApiVersionFieldRequired', 'queryApiVersionFieldCardinality', 'supportedQueryApiVersionsFieldRequired', 'supportedQueryApiVersionsIncludesCurrent', 'releaseManifestMustMatchCurrent', 'v1Migration', 'historicalResponseMeaningsRetainedBySelectedCatalog'], 'queryCompatibility.catalogPackageDescriptor');
  const descriptor = query.catalogPackageDescriptor;
  if (descriptor.owner !== '@core-ui/catalog' || descriptor.schemaFrom !== 'core-ui-catalog-package-v1' || descriptor.schemaTo !== 'core-ui-catalog-package-v2' || descriptor.schemaEffect !== 'major-required-version-capability' || descriptor.queryApiVersionFieldRequired !== true || descriptor.queryApiVersionFieldCardinality !== 'one current default' || descriptor.supportedQueryApiVersionsFieldRequired !== true || descriptor.supportedQueryApiVersionsIncludesCurrent !== true || descriptor.releaseManifestMustMatchCurrent !== true || descriptor.v1Migration !== 'supportedQueryApiVersions=[queryApiVersion]' || descriptor.historicalResponseMeaningsRetainedBySelectedCatalog !== true) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'catalog descriptor');
  exactKeys(query.resolver, ['owner', 'installedSelectionKeys', 'requestNegotiationKey', 'explicitRequestMustBeInSelectedDescriptorSupportedVersions', 'omittedRequestUsesSelectedDescriptorCurrent', 'responseTranslation', 'cursorTranslation', 'failure', 'errorCodeSchemaEffect'], 'queryCompatibility.resolver');
  exactArray(query.resolver.installedSelectionKeys, ['catalogVersion', 'catalogDigest'], 'resolver installedSelectionKeys');
  exactKeys(query.resolver.failure, ['code', 'when', 'precedenceAfter', 'precedenceBefore'], 'resolver failure');
  exactArray(query.resolver.failure.when, ['requested version is absent from selected descriptor supportedQueryApiVersions', 'selected descriptor current queryApiVersion is absent from supportedQueryApiVersions', 'release manifest current queryApiVersion differs from descriptor current queryApiVersion'], 'resolver failure.when');
  exactArray(query.resolver.failure.precedenceAfter, ['catalog-package-metadata-missing', 'catalog-package-integrity-mismatch'], 'resolver failure.precedenceAfter');
  exactArray(query.resolver.failure.precedenceBefore, ['schema-range-mismatch', 'token-contract-range-mismatch'], 'resolver failure.precedenceBefore');
  exactKeys(query.resolver.errorCodeSchemaEffect, ['phase', 'owner', 'packageVersion', 'add'], 'resolver error code effect');
  exactArray(query.resolver.errorCodeSchemaEffect.add, ['CORE_QUERY_API_VERSION_UNSUPPORTED', 'CORE_QUERY_PAGE_ENVELOPE_TOO_LARGE', 'CORE_QUERY_PAGE_ENTRY_TOO_LARGE'], 'resolver error codes');
  if (query.resolver.owner !== '@core-ui/tooling' || query.resolver.requestNegotiationKey !== 'queryApiVersion' || query.resolver.explicitRequestMustBeInSelectedDescriptorSupportedVersions !== true || query.resolver.omittedRequestUsesSelectedDescriptorCurrent !== true || query.resolver.responseTranslation !== false || query.resolver.cursorTranslation !== false || query.resolver.failure.code !== 'CORE_QUERY_API_VERSION_UNSUPPORTED' || query.resolver.errorCodeSchemaEffect.phase !== 'A' || query.resolver.errorCodeSchemaEffect.owner !== '@core-ui/schema' || query.resolver.errorCodeSchemaEffect.packageVersion !== '0.1.0') fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'resolver');
  exactKeys(query.pageEnvelope, ['owner', 'artifactRefSchemaChanged', 'pageArtifactIdMaximumBytes', 'catalogVersionMaximumBytes', 'overBoundBehavior', 'failureCode', 'queryApiEffect'], 'queryCompatibility.pageEnvelope');
  if (query.pageEnvelope.owner !== '@core-ui/catalog' || query.pageEnvelope.artifactRefSchemaChanged !== false || query.pageEnvelope.pageArtifactIdMaximumBytes !== 256 || query.pageEnvelope.catalogVersionMaximumBytes !== 64 || query.pageEnvelope.overBoundBehavior !== 'fail closed before page emission' || query.pageEnvelope.failureCode !== 'CORE_QUERY_PAGE_ENVELOPE_TOO_LARGE' || query.pageEnvelope.queryApiEffect !== 'additive in 1.2.0 sectional retrieval only') fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'page envelope');
  exactKeys(query.cursor, ['owner', 'payloadSchema', 'payloadFields', 'selectorDigestPreimage', 'canonicalization', 'encoding', 'maximumBytes', 'nextPositionMinimum', 'nextPositionMaximum', 'artifactIdMaximumBytes', 'catalogVersionMaximumBytes', 'failures'], 'queryCompatibility.cursor');
  exactArray(query.cursor.payloadFields, ['queryApiVersion', 'catalogDigest', 'tokenSourceContentRevision', 'section', 'selectorDigest', 'nextPosition'], 'queryCompatibility.cursor.payloadFields');
  exactArray(query.cursor.selectorDigestPreimage, ['artifact id', 'platform', 'detail', 'purpose', 'section', 'limit'], 'queryCompatibility.cursor.selectorDigestPreimage');
  exactArray(query.cursor.failures, ['malformed', 'integrity mismatch', 'unsupported query version', 'catalog digest mismatch', 'token source revision mismatch', 'section mismatch', 'selector digest mismatch', 'out-of-range position'], 'queryCompatibility.cursor.failures');
  if (query.cursor.owner !== '@core-ui/catalog' || query.cursor.payloadSchema !== 'core-ui-section-cursor-v1' || query.cursor.canonicalization !== 'Core canonical JSON UTF-8' || query.cursor.encoding !== 'c1.<unpadded-base64url-canonical-payload>.<lowercase-sha256-of-canonical-payload>' || query.cursor.maximumBytes !== pageProfiles[0].cursorMaximumBytes || query.cursor.nextPositionMinimum !== 1 || query.cursor.nextPositionMaximum !== 4294967295 || query.cursor.artifactIdMaximumBytes !== 256 || query.cursor.catalogVersionMaximumBytes !== 64) fail('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', 'cursor');
}

function verifyTargetProfiles(targets, profile, authority) {
  exactKeys(targets, [...profile.targetIds, 'authorityReferences', 'dispositionVocabulary', 'proofBoundary'], 'targetProfiles');
  exactArray(targets.authorityReferences, ['strategy/monorepo-architecture.md', 'packages/schema/schemas/binding.schema.json'], 'targetProfiles.authorityReferences');
  for (const identity of ['web.html', 'web.react', 'native.ios', 'native.android', 'native.react-native-web', 'native.react-native']) {
    if (!authority.bindingSchema.includes(identity)) fail('TALE_ANNEX_TARGET_INVALID', `${identity} is absent from canonical binding schema`);
  }
  for (const owner of ['@core-ui/tokens', '@core-ui/web', '@core-ui/react-native']) {
    if (!authority.architecture.includes(owner)) fail('TALE_ANNEX_TARGET_INVALID', `${owner} is absent from architecture`);
  }
  for (const id of ['web.html', 'web.react']) {
    exactKeys(targets[id], ['bindingId', 'runtimeProfile', 'validationProfile', 'transformOwner', 'projectionOwner', 'sharedStyleSource', 'independentTokenProjection'], `targetProfiles.${id}`);
    if (targets[id].bindingId !== id || targets[id].runtimeProfile !== id || targets[id].validationProfile !== id || targets[id].transformOwner !== '@core-ui/tokens' || targets[id].projectionOwner !== '@core-ui/web' || targets[id].sharedStyleSource !== '@core-ui/web' || targets[id].independentTokenProjection !== false) fail('TALE_ANNEX_TARGET_INVALID', id);
  }
  for (const [id, runtime] of [['native.ios', 'ios'], ['native.android', 'android']]) {
    exactKeys(targets[id], ['bindingId', 'runtimeProfile', 'validationProfile', 'transformOwner', 'projectionOwner'], `targetProfiles.${id}`);
    if (targets[id].bindingId !== 'native.react-native' || targets[id].runtimeProfile !== runtime || targets[id].validationProfile !== id || targets[id].transformOwner !== '@core-ui/tokens' || targets[id].projectionOwner !== '@core-ui/react-native') fail('TALE_ANNEX_TARGET_INVALID', id);
  }
  const rnw = targets['native.react-native-web'];
  exactKeys(rnw, ['bindingId', 'runtimeProfile', 'validationProfile', 'currentAvailability', 'inheritsWebReactParity', 'inheritsWebReactEvidence'], 'targetProfiles.native.react-native-web');
  if (rnw.bindingId !== 'native.react-native' || rnw.runtimeProfile !== 'native.react-native-web' || rnw.validationProfile !== 'native.react-native-web' || rnw.currentAvailability !== 'unsupported' || rnw.inheritsWebReactParity !== false || rnw.inheritsWebReactEvidence !== false) fail('TALE_ANNEX_TARGET_INVALID', 'React Native Web');
  exactKeys(targets.dispositionVocabulary, profile.targetDispositions, 'targetProfiles.dispositionVocabulary');
  const expectedDisposition = { direct: [true, false, false], deferred: [false, false, false], rejected: [false, false, false] };
  for (const id of profile.targetDispositions) {
    exactKeys(targets.dispositionVocabulary[id], ['emitsTargetValue', 'supportClaim', 'evidenceClaim'], `targetProfiles.dispositionVocabulary.${id}`);
    const [emits, support, evidence] = expectedDisposition[id];
    if (targets.dispositionVocabulary[id].emitsTargetValue !== emits || targets.dispositionVocabulary[id].supportClaim !== support || targets.dispositionVocabulary[id].evidenceClaim !== evidence) fail('TALE_ANNEX_TARGET_INVALID', `${id} semantics`);
  }
  exactKeys(targets.proofBoundary, ['bindingStrategy', 'lifecycle', 'componentSupport', 'runtimeAvailability', 'platformSafety', 'accessibility', 'parity', 'evidence'], 'targetProfiles.proofBoundary');
  if (Object.values(targets.proofBoundary).some((claim) => claim !== false)) fail('TALE_ANNEX_TARGET_INVALID', 'proof boundary must make no claim');
}

function verifyVersionPlan(versions) {
  exactKeys(versions, ['phaseA', 'phaseB', 'phaseC', 'publicationClaim'], 'versions');
  if (versions.publicationClaim !== 'none; all package versions remain private prerelease implementation identities until the later publication milestone') fail('TALE_ANNEX_VERSION_INVALID', 'publication claim');
  const packageIds = ['@core-ui/schema', '@core-ui/catalog', '@core-ui/tokens', '@core-ui/tooling'];
  const expected = {
    phaseA: {
      queryApiVersion: ['1.1.0', '1.2.0', 'minor-additive-deprecation'],
      tokenSourceSchemaVersion: ['2.0.0', '2.0.0', 'none'],
      tokenContractVersion: ['1.1.0', '1.1.0', 'none'],
      catalogVersion: ['0.0.0', '0.1.0', 'minor-prerelease'],
      commandRegistrySchemaVersion: ['1.0.0', '1.0.0', 'none'],
      catalogPackageSchema: ['core-ui-catalog-package-v1', 'core-ui-catalog-package-v2', 'major-required-version-capability'],
      packages: { '@core-ui/schema': ['0.0.0', '0.1.0'], '@core-ui/catalog': ['0.0.0', '0.1.0'], '@core-ui/tokens': ['0.0.0', '0.0.0'], '@core-ui/tooling': ['0.0.0', '0.1.0'] },
    },
    phaseB: {
      queryApiVersion: ['1.2.0', '2.0.0', 'major-after-accepted-notice'],
      tokenSourceSchemaVersion: ['2.0.0', '2.1.0', 'minor-optional-stable-field'],
      tokenContractVersion: ['1.1.0', '1.1.0', 'none'],
      catalogVersion: ['0.1.0', '0.2.0', 'minor-prerelease-with-query-major'],
      commandRegistrySchemaVersion: ['1.0.0', '1.0.0', 'none'],
      catalogPackageSchema: ['core-ui-catalog-package-v2', 'core-ui-catalog-package-v2', 'none'],
      packages: { '@core-ui/schema': ['0.1.0', '0.2.0'], '@core-ui/catalog': ['0.1.0', '0.2.0'], '@core-ui/tokens': ['0.0.0', '0.1.0'], '@core-ui/tooling': ['0.1.0', '0.2.0'] },
    },
    phaseC: {
      queryApiVersion: ['2.0.0', '2.0.0', 'none'],
      tokenSourceSchemaVersion: ['2.1.0', '2.1.0', 'none'],
      tokenContractVersion: ['1.1.0', '1.2.0', 'minor-additive'],
      catalogVersion: ['0.2.0', '0.3.0', 'minor-prerelease-content-addition'],
      commandRegistrySchemaVersion: ['1.0.0', '1.0.0', 'none'],
      catalogPackageSchema: ['core-ui-catalog-package-v2', 'core-ui-catalog-package-v2', 'none'],
      packages: { '@core-ui/schema': ['0.2.0', '0.2.0'], '@core-ui/catalog': ['0.2.0', '0.3.0'], '@core-ui/tokens': ['0.1.0', '0.2.0'], '@core-ui/tooling': ['0.2.0', '0.3.0'] },
    },
  };
  for (const phase of ['phaseA', 'phaseB', 'phaseC']) {
    const value = versions[phase];
    exactKeys(value, ['queryApiVersion', 'tokenSourceSchemaVersion', 'tokenContractVersion', 'catalogVersion', 'commandRegistrySchemaVersion', 'catalogPackageSchema', 'packages'], `versions.${phase}`);
    for (const key of ['queryApiVersion', 'tokenSourceSchemaVersion', 'tokenContractVersion', 'catalogVersion', 'commandRegistrySchemaVersion', 'catalogPackageSchema']) {
      exactKeys(value[key], ['from', 'to', 'effect'], `versions.${phase}.${key}`);
      exactArray([value[key].from, value[key].to, value[key].effect], expected[phase][key], `versions.${phase}.${key}`);
    }
    exactKeys(value.packages, packageIds, `versions.${phase}.packages`);
    for (const id of packageIds) {
      exactKeys(value.packages[id], ['from', 'to'], `versions.${phase}.packages.${id}`);
      exactArray([value.packages[id].from, value.packages[id].to], expected[phase].packages[id], `versions.${phase}.packages.${id}`);
    }
  }
  const phases = [versions.phaseA, versions.phaseB, versions.phaseC];
  for (let index = 1; index < phases.length; index += 1) {
    for (const key of ['queryApiVersion', 'tokenSourceSchemaVersion', 'tokenContractVersion', 'catalogVersion', 'commandRegistrySchemaVersion', 'catalogPackageSchema']) if (phases[index - 1][key].to !== phases[index][key].from) fail('TALE_ANNEX_VERSION_INVALID', `${key} continuity`);
    for (const id of packageIds) if (phases[index - 1].packages[id].to !== phases[index].packages[id].from) fail('TALE_ANNEX_VERSION_INVALID', `${id} continuity`);
  }
}

function verifyMigrationRollback(annex) {
  exactKeys(annex.migration, ['phaseA', 'phaseB', 'phaseC', 'historicalRetrieval'], 'migration');
  exactKeys(annex.migration.phaseA, ['addsQueryApiVersion', 'retainsInlineTokens', 'addsSections', 'addsCursor', 'tokenSourceSchemaChange', 'tokenInventoryChange', 'catalogPackageDescriptor', 'addsStableErrorCodes'], 'migration.phaseA');
  exactArray(annex.migration.phaseA.addsSections, ['tokens', 'source-crosswalk'], 'migration.phaseA.addsSections');
  if (annex.migration.phaseA.addsQueryApiVersion !== '1.2.0' || annex.migration.phaseA.retainsInlineTokens !== true || annex.migration.phaseA.addsCursor !== true || annex.migration.phaseA.tokenSourceSchemaChange !== false || annex.migration.phaseA.tokenInventoryChange !== false) fail('TALE_ANNEX_MIGRATION_INVALID', 'phase A');
  exactKeys(annex.migration.phaseA.catalogPackageDescriptor, ['from', 'to', 'migrator', 'idempotent', 'readRewrite'], 'migration.phaseA.catalogPackageDescriptor');
  if (annex.migration.phaseA.catalogPackageDescriptor.from !== 'core-ui-catalog-package-v1' || annex.migration.phaseA.catalogPackageDescriptor.to !== 'core-ui-catalog-package-v2' || annex.migration.phaseA.catalogPackageDescriptor.migrator !== 'set supportedQueryApiVersions to the singleton current queryApiVersion' || annex.migration.phaseA.catalogPackageDescriptor.idempotent !== true || annex.migration.phaseA.catalogPackageDescriptor.readRewrite !== false) fail('TALE_ANNEX_MIGRATION_INVALID', 'phase A descriptor migration');
  exactArray(annex.migration.phaseA.addsStableErrorCodes, ['CORE_QUERY_API_VERSION_UNSUPPORTED', 'CORE_QUERY_PAGE_ENVELOPE_TOO_LARGE', 'CORE_QUERY_PAGE_ENTRY_TOO_LARGE'], 'migration.phaseA.addsStableErrorCodes');
  exactKeys(annex.migration.phaseB, ['addsQueryApiVersion', 'removesInlineTokens', 'tokenSourceSchema', 'realTaleCrosswalk', 'fixtures'], 'migration.phaseB');
  exactKeys(annex.migration.phaseB.tokenSourceSchema, ['from', 'to', 'migrator', 'readRewrite'], 'migration.phaseB.tokenSourceSchema');
  exactArray(annex.migration.phaseB.fixtures, ['absent', 'synthetic'], 'migration.phaseB.fixtures');
  if (annex.migration.phaseB.addsQueryApiVersion !== '2.0.0' || annex.migration.phaseB.removesInlineTokens !== true || annex.migration.phaseB.realTaleCrosswalk !== false || annex.migration.phaseB.tokenSourceSchema.from !== '2.0.0' || annex.migration.phaseB.tokenSourceSchema.to !== '2.1.0' || annex.migration.phaseB.tokenSourceSchema.migrator !== 'explicit idempotent opt-in' || annex.migration.phaseB.tokenSourceSchema.readRewrite !== false) fail('TALE_ANNEX_MIGRATION_INVALID', 'phase B');
  exactKeys(annex.migration.phaseC, ['authorsAcceptedCrosswalk', 'addsListedCoreTokens', 'preservesExistingTokenIds', 'tokenContractVersion'], 'migration.phaseC');
  exactKeys(annex.migration.phaseC.tokenContractVersion, ['from', 'to'], 'migration.phaseC.tokenContractVersion');
  if (annex.migration.phaseC.authorsAcceptedCrosswalk !== true || annex.migration.phaseC.addsListedCoreTokens !== true || annex.migration.phaseC.preservesExistingTokenIds !== true || annex.migration.phaseC.tokenContractVersion.from !== '1.1.0' || annex.migration.phaseC.tokenContractVersion.to !== '1.2.0') fail('TALE_ANNEX_MIGRATION_INVALID', 'phase C');
  exactKeys(annex.migration.historicalRetrieval, ['retain', 'reinterpretation', 'cursorTranslation'], 'migration.historicalRetrieval');
  exactArray(annex.migration.historicalRetrieval.retain, ['1.1.0', '1.2.0'], 'migration.historicalRetrieval.retain');
  if (annex.migration.historicalRetrieval.reinterpretation !== false || annex.migration.historicalRetrieval.cursorTranslation !== false) fail('TALE_ANNEX_MIGRATION_INVALID', 'historical retrieval');
  exactKeys(annex.rollback, ['phaseA', 'phaseB', 'phaseC'], 'rollback');
  exactKeys(annex.rollback.phaseA, ['selectQueryApiVersion', 'selectCatalogPackageSchema', 'retainNewerHistory'], 'rollback.phaseA');
  exactKeys(annex.rollback.phaseB, ['selectQueryApiVersion', 'selectTokenSourceSchemaVersion', 'selectCatalogPackageSchema', 'retainNewerHistory'], 'rollback.phaseB');
  exactKeys(annex.rollback.phaseC, ['selectTokenContractVersion', 'selectTokenCount', 'selectCatalogPackageSchema', 'retainTaleBaseline', 'retainCrosswalkHistory', 'retainEvidenceHistory'], 'rollback.phaseC');
  if (annex.rollback.phaseA.selectQueryApiVersion !== '1.1.0' || annex.rollback.phaseA.selectCatalogPackageSchema !== 'core-ui-catalog-package-v1' || annex.rollback.phaseA.retainNewerHistory !== true || annex.rollback.phaseB.selectQueryApiVersion !== '1.2.0' || annex.rollback.phaseB.selectTokenSourceSchemaVersion !== '2.0.0' || annex.rollback.phaseB.selectCatalogPackageSchema !== 'core-ui-catalog-package-v2' || annex.rollback.phaseB.retainNewerHistory !== true || annex.rollback.phaseC.selectTokenContractVersion !== '1.1.0' || annex.rollback.phaseC.selectTokenCount !== 27 || annex.rollback.phaseC.selectCatalogPackageSchema !== 'core-ui-catalog-package-v2' || annex.rollback.phaseC.retainTaleBaseline !== true || annex.rollback.phaseC.retainCrosswalkHistory !== true || annex.rollback.phaseC.retainEvidenceHistory !== true) fail('TALE_ANNEX_ROLLBACK_INVALID', 'exact rollback contract');
}

export function assertTaleAnnexAcceptanceRecord(record, annexPath, annexBytes, acceptanceRecordSchema = 'core-ui-authority-decision-v1') {
  assertAcceptance(record, annexPath, annexBytes, (message) => {
    const code = message.includes('digest binding')
      ? 'TALE_ANNEX_ACCEPTANCE_DIGEST_MISMATCH'
      : message.includes('body preimage')
        ? 'TALE_ANNEX_ACCEPTANCE_BODY_MISMATCH'
        : 'TALE_ANNEX_ACCEPTANCE_INVALID';
    fail(code, message);
  }, acceptanceRecordSchema);
}

export { acceptanceCommentBody };

export async function verifyTaleTokenAnnex(repositoryRoot, options = {}) {
  const packageRoot = join(repositoryRoot, 'tooling/audits/repository-policy');
  const profileDocument = options.profileValue
    ? { bytes: canonicalJson(options.profileValue), value: options.profileValue }
    : await strictFile(join(packageRoot, 'tale-token-annex-profile.json'), 'validation profile');
  const profile = profileDocument.value;
  exactKeys(profile, ['schema', 'annexPath', 'annexSchema', 'sourceFixturePath', 'dispositions', 'targetIds', 'targetDispositions', 'groupRelationships', 'groupRoles', 'groupModes', 'portableTypeUnits', 'sourceValueMapping', 'pageLexerVersion', 'acceptanceRecordPath', 'acceptanceRecordSchema'], 'validation profile');
  if (profile.schema !== 'core-ui-tale-token-classification-annex-validation-profile-v1') fail('TALE_ANNEX_PROFILE_INVALID', 'validation profile schema');
  verifySourceValueMappingProfile(profile.sourceValueMapping);
  const annexPath = join(repositoryRoot, profile.annexPath);
  const annexDocument = options.annexSource !== undefined
    ? { bytes: options.annexSource, value: strict(options.annexSource, profile.annexPath) }
    : options.annexValue !== undefined
      ? { bytes: options.annexBytes ?? canonicalJson(options.annexValue), value: options.annexValue }
      : await strictFile(annexPath, profile.annexPath);
  const annex = annexDocument.value;
  const sourceDocument = await strictFile(join(repositoryRoot, profile.sourceFixturePath), profile.sourceFixturePath);
  const source = sourceDocument.value;
  const currentTokenSource = (await strictFile(join(repositoryRoot, 'catalog/tokens/button-minimum.json'), 'current token source')).value;
  const productScope = await readFile(join(repositoryRoot, 'strategy/product-scope.md'), 'utf8');
  const architecture = await readFile(join(repositoryRoot, 'strategy/monorepo-architecture.md'), 'utf8');
  const bindingSchema = await readFile(join(repositoryRoot, 'packages/schema/schemas/binding.schema.json'), 'utf8');

  exactKeys(annex, ['schema', 'decisionId', 'state', 'humanDecisionOwner', 'parentIssue', 'authorityRevision', 'acceptanceTopology', 'source', 'fieldOwnership', 'dispositionDefinitions', 'summary', 'releaseAdditions', 'pageProfiles', 'queryCompatibility', 'versions', 'migration', 'rollback', 'targetProfiles', 'nonGoals', 'groups', 'coreTokens', 'entries'], '$');
  if (annex.schema !== profile.annexSchema || annex.decisionId !== 'core-ui:decision:0003' || annex.state !== 'acceptance-candidate' || annex.humanDecisionOwner !== 'ndrewtran' || annex.parentIssue !== 39 || annex.authorityRevision !== '4c57cfff97c946979bb18e3aaee70558a65224b4') fail('TALE_ANNEX_IDENTITY_INVALID', 'candidate identity');
  exactKeys(annex.acceptanceTopology, ['candidateImmutability', 'requiredAcceptanceRecord', 'acceptanceRecordSchema', 'acceptedRecordPresent', 'mergeRequires', 'mergeReady'], 'acceptanceTopology');
  if (annex.acceptanceTopology.candidateImmutability !== true || annex.acceptanceTopology.requiredAcceptanceRecord !== profile.acceptanceRecordPath || annex.acceptanceTopology.acceptanceRecordSchema !== profile.acceptanceRecordSchema || annex.acceptanceTopology.acceptedRecordPresent !== false || annex.acceptanceTopology.mergeReady !== false) fail('TALE_ANNEX_ACCEPTANCE_TOPOLOGY_INVALID', 'immutable candidate topology');
  exactArray(annex.acceptanceTopology.mergeRequires, ['digest-specific accepted human decision', 'append-only applicability continuation successors', 'green required checks'], 'acceptanceTopology.mergeRequires');
  verifyFieldOwnership(annex.fieldOwnership);
  verifyDispositionDefinitions(annex.dispositionDefinitions, profile);

  exactKeys(annex.source, ['repository', 'revision', 'path', 'sha256', 'baseFontSizePx', 'declarationOccurrences', 'customPropertyOccurrences', 'uniqueCustomPropertyNames', 'nonCustomPropertyOccurrences', 'fixturePath', 'authorityReference'], 'source');
  if (
    annex.source.repository !== 'Tale-UI/tale-ui'
    || annex.source.revision !== '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd'
    || annex.source.path !== 'packages/tokens/tokens.json'
    || annex.source.sha256 !== 'sha256:83b72fc79b34932ae1afa44d21f74460a23fa693407bc319fdfafb3a2bb64a86'
    || annex.source.baseFontSizePx !== 16
    || annex.source.declarationOccurrences !== 693
    || annex.source.customPropertyOccurrences !== 692
    || annex.source.uniqueCustomPropertyNames !== 644
    || annex.source.nonCustomPropertyOccurrences !== 1
    || annex.source.fixturePath !== profile.sourceFixturePath
    || annex.source.authorityReference !== 'strategy/product-scope.md'
    || annex.source.sha256 !== `sha256:${sha256(sourceDocument.bytes)}`
    || source.baseFontSize !== annex.source.baseFontSizePx
  ) fail('TALE_ANNEX_SOURCE_IDENTITY_MISMATCH', 'source identity/digest');
  for (const referenced of [annex.source.revision, annex.source.sha256.slice(7), String(annex.source.declarationOccurrences), String(annex.source.uniqueCustomPropertyNames)]) {
    if (!productScope.includes(referenced)) fail('TALE_ANNEX_SOURCE_IDENTITY_MISMATCH', `${referenced} is absent from Product Scope`);
  }
  const sourceEntries = enumerateSource(source);
  const custom = sourceEntries.filter((entry) => entry.name.startsWith('--'));
  const unique = new Set(custom.map((entry) => entry.name));
  if (annex.source.declarationOccurrences !== sourceEntries.length || annex.source.customPropertyOccurrences !== custom.length || annex.source.uniqueCustomPropertyNames !== unique.size || annex.source.nonCustomPropertyOccurrences !== sourceEntries.length - custom.length) fail('TALE_ANNEX_SOURCE_COVERAGE_MISMATCH', 'derived source counts');
  if (!Array.isArray(annex.entries) || annex.entries.length !== sourceEntries.length) fail('TALE_ANNEX_SOURCE_COVERAGE_MISMATCH', 'entry count');
  annex.entries.forEach((entry, index) => verifyEntry(entry, sourceEntries[index], profile, index));

  exactKeys(annex.summary, ['dispositionCounts', 'logicalGroups', 'admittedCoreTokens', 'addedCoreTokens', 'reusedExistingCoreTokens', 'candidateSourceCrosswalkDigest', 'candidateSourceCrosswalkDigestProfile'], 'summary');
  verifyTokenDefinitions(annex.coreTokens, annex.entries, currentTokenSource, profile);
  verifyEntryDefinitionMappings(annex.entries, annex.coreTokens, sourceEntries, profile);
  verifyGroups(annex.groups, annex.entries, profile, annex.summary.logicalGroups);
  verifyAuthoredReasonReferences(annex.entries, annex.coreTokens);
  verifyPageProfiles(annex, profile);
  verifyQueryCompatibility(annex.queryCompatibility, annex.pageProfiles);
  verifyTargetProfiles(annex.targetProfiles, profile, { architecture, bindingSchema });
  verifyVersionPlan(annex.versions);
  verifyMigrationRollback(annex);
  exactKeys(annex.nonGoals, ['phaseAImplementation', 'tokenSchemaOrQueryImplementation', 'defaultThemeMigration', 'semanticOrComponentRecipeExpansion', 'typedShadowOntology', 'externalFontBundling', 'evidenceRecertification', 'milestoneAcceptance', 'gateExit', 'publication', 'release'], 'nonGoals');
  if (Object.values(annex.nonGoals).some((claim) => claim !== false)) fail('TALE_ANNEX_NON_GOAL_INVALID', 'candidate must make no implementation/evidence/release claim');

  const counts = Object.fromEntries(profile.dispositions.map((disposition) => [disposition, annex.entries.filter((entry) => entry.disposition === disposition).length]));
  const reuse = annex.coreTokens.filter((token) => token.action === 'reuse');
  const added = annex.coreTokens.filter((token) => token.action === 'add');
  exactKeys(annex.summary.dispositionCounts, profile.dispositions, 'summary.dispositionCounts');
  if (canonicalJson(annex.summary.dispositionCounts) !== canonicalJson(counts) || annex.summary.admittedCoreTokens !== annex.coreTokens.length || annex.summary.addedCoreTokens !== added.length || annex.summary.reusedExistingCoreTokens !== reuse.length) fail('TALE_ANNEX_SUMMARY_MISMATCH', 'derived summary');
  if (annex.summary.candidateSourceCrosswalkDigestProfile !== 'core-ui-source-crosswalk-preimage-v1 canonical JSON over pinned baseline, complete entries, and stable groups' || digest({ baseline: annex.source, entries: annex.entries, groups: annex.groups }) !== annex.summary.candidateSourceCrosswalkDigest || !SHA256.test(annex.summary.candidateSourceCrosswalkDigest)) fail('TALE_ANNEX_CROSSWALK_DIGEST_MISMATCH', 'candidate sourceCrosswalk digest');
  exactKeys(annex.releaseAdditions, ['addedCoreTokenCount', 'addedCoreTokenIdsDigest', 'reusedExistingCoreTokenCount', 'removals', 'source'], 'releaseAdditions');
  if (annex.releaseAdditions.source !== 'derived from coreTokens action values; coreTokens is the sole token-definition inventory' || annex.releaseAdditions.addedCoreTokenCount !== added.length || annex.releaseAdditions.reusedExistingCoreTokenCount !== reuse.length || annex.releaseAdditions.removals !== 0 || digest(added.map((token) => token.id)) !== annex.releaseAdditions.addedCoreTokenIdsDigest) fail('TALE_ANNEX_RELEASE_MISMATCH', 'derived release additions');

  let acceptance = options.acceptanceValue;
  if (acceptance === undefined) {
    const acceptancePath = join(repositoryRoot, profile.acceptanceRecordPath);
    try { await access(acceptancePath); acceptance = (await strictFile(acceptancePath, profile.acceptanceRecordPath)).value; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  if (acceptance !== undefined) assertTaleAnnexAcceptanceRecord(acceptance, profile.annexPath, annexDocument.bytes, profile.acceptanceRecordSchema);
  return { entries: annex.entries.length, groups: annex.groups.length, added: added.length, reused: reuse.length, dispositionCounts: counts, crosswalkDigest: annex.summary.candidateSourceCrosswalkDigest, accepted: acceptance !== undefined };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  try {
    const result = await verifyTaleTokenAnnex(repositoryRoot);
    console.log(`[TALE-TOKEN-ANNEX] verified ${result.entries} occurrences, ${result.groups} groups, ${result.added} additions, and ${result.reused} exact reuse`);
    console.log(`[TALE-TOKEN-ANNEX] candidate crosswalk ${result.crosswalkDigest}`);
    console.log(`[TALE-TOKEN-ANNEX] human acceptance ${result.accepted ? 'bound' : 'pending'}`);
    if (process.argv.includes('--require-acceptance') && !result.accepted) {
      fail('TALE_ANNEX_ACCEPTANCE_REQUIRED', 'repository merge checks require the exact digest-bound human acceptance record');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
