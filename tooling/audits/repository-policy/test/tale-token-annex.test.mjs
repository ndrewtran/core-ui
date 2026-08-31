import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { canonicalJson } from '@muxui/schema';
import { sha256 } from '../src/policy.mjs';
import {
  acceptanceCommentBody,
  TaleTokenAnnexError,
  verifyTaleTokenAnnex,
} from '../src/tale-token-annex-verify.mjs';
import { acceptanceRecordFromGitHubComment } from '../src/tale-token-annex-acceptance.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const annexPath = resolve(repositoryRoot, 'decisions/0003-tale-token-classification-annex.json');
const profilePath = resolve(repositoryRoot, 'tooling/audits/repository-policy/tale-token-annex-profile.json');
const execFile = promisify(execFileCallback);

async function annex() {
  return JSON.parse(await readFile(annexPath, 'utf8'));
}

function digest(value) {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function recomputeDerivedInventory(value) {
  const added = value.coreTokens.filter((token) => token.action === 'add');
  const reused = value.coreTokens.filter((token) => token.action === 'reuse');
  value.summary.admittedCoreTokens = value.coreTokens.length;
  value.summary.addedCoreTokens = added.length;
  value.summary.reusedExistingCoreTokens = reused.length;
  value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  value.releaseAdditions.addedCoreTokenCount = added.length;
  value.releaseAdditions.addedCoreTokenIdsDigest = digest(added.map((token) => token.id));
  value.releaseAdditions.reusedExistingCoreTokenCount = reused.length;
}

async function rejects(code, mutate) {
  const value = await annex();
  mutate(value);
  await assert.rejects(
    verifyTaleTokenAnnex(repositoryRoot, { annexValue: value }),
    (error) => error instanceof TaleTokenAnnexError && error.code === code,
  );
}

async function syntheticAcceptance(overrides = {}) {
  const annexBytes = await readFile(annexPath, 'utf8');
  const annexSha256 = `sha256:${sha256(annexBytes)}`;
  const commentBody = acceptanceCommentBody({
    annexPath: 'decisions/0003-tale-token-classification-annex.json',
    annexSha256,
    annexBytes: Buffer.byteLength(annexBytes),
  });
  return {
    schema: 'core-ui-authority-decision-v1',
    decisionId: 'core-ui:decision:0003',
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    issueNumber: 39,
    commentId: 1,
    commentNodeId: 'IC_test',
    createdAt: '2026-08-09T00:00:00Z',
    url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-1',
    bodySha256: `sha256:${sha256(commentBody)}`,
    ...overrides,
  };
}

test('verifies the complete accepted Tale classification annex', async () => {
  const result = await verifyTaleTokenAnnex(repositoryRoot);
  assert.deepEqual(result.dispositionCounts, { adopt: 344, adapt: 95, defer: 193, reject: 61 });
  assert.equal(result.entries, 693);
  assert.equal(result.groups, 41);
  assert.equal(result.added, 430);
  assert.equal(result.reused, 1);
  assert.equal(result.accepted, true);
});

test('accepts an exact synthetic digest-bound human record', async () => {
  const result = await verifyTaleTokenAnnex(repositoryRoot, { acceptanceValue: await syntheticAcceptance() });
  assert.equal(result.accepted, true);
});

test('captures only the exact authenticated owner acceptance comment', async () => {
  const annexBytes = await readFile(annexPath);
  const annexSha256 = `sha256:${sha256(annexBytes)}`;
  const body = acceptanceCommentBody({
    annexPath: 'decisions/0003-tale-token-classification-annex.json',
    annexSha256,
    annexBytes: Buffer.byteLength(annexBytes),
  });
  const comment = {
    author_association: 'OWNER',
    body,
    created_at: '2026-08-09T00:00:00Z',
    html_url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-1',
    id: 1,
    issue_url: 'https://api.github.com/repos/ndrewtran/core-ui/issues/39',
    node_id: 'IC_test',
    user: { login: 'ndrewtran', node_id: 'MDQ6VXNlcjc0MzE0OTg0' },
  };
  const record = acceptanceRecordFromGitHubComment(
    comment,
    'decisions/0003-tale-token-classification-annex.json',
    annexBytes,
    (message) => { throw new Error(message); },
  );
  assert.equal(record.bodySha256, `sha256:${sha256(body)}`);
  for (const mutation of [
    { body: 'wrong' },
    { author_association: 'CONTRIBUTOR' },
    { user: { login: 'someone-else', node_id: 'MDQ6VXNlcjc0MzE0OTg0' } },
    { user: { login: 'ndrewtran', node_id: 'wrong' } },
    { node_id: '' },
  ]) {
    assert.throws(() => acceptanceRecordFromGitHubComment(
      { ...comment, ...mutation },
      'decisions/0003-tale-token-classification-annex.json',
      annexBytes,
      (message) => { throw new Error(message); },
    ));
  }
});

test('rejects duplicate JSON keys before object validation', async () => {
  const source = await readFile(annexPath, 'utf8');
  await assert.rejects(
    verifyTaleTokenAnnex(repositoryRoot, { annexSource: `{"schema":"duplicate",${source.slice(1)}` }),
    (error) => error instanceof TaleTokenAnnexError && error.code === 'TALE_ANNEX_DUPLICATE_KEY',
  );
});

test('rejects a missing pinned occurrence', async () => {
  await rejects('TALE_ANNEX_SOURCE_COVERAGE_MISMATCH', (value) => value.entries.pop());
});

test('rejects an unknown authored field', async () => {
  await rejects('TALE_ANNEX_UNKNOWN_FIELD', (value) => { value.entries[0].inferred = true; });
});

test('rejects an unknown validation-profile field', async () => {
  const profile = JSON.parse(await readFile(resolve(repositoryRoot, 'tooling/audits/repository-policy/tale-token-annex-profile.json'), 'utf8'));
  profile.inferred = true;
  await assert.rejects(
    verifyTaleTokenAnnex(repositoryRoot, { profileValue: profile }),
    (error) => error instanceof TaleTokenAnnexError && error.code === 'TALE_ANNEX_UNKNOWN_FIELD',
  );
});

test('rejects an unclosed disposition', async () => {
  await rejects('TALE_ANNEX_DISPOSITION_INVALID', (value) => { value.entries[0].disposition = 'maybe'; });
});

test('rejects falsified field ownership', async () => {
  await rejects('TALE_ANNEX_VALUE_INVALID', (value) => { value.fieldOwnership.authored.pop(); });
});

test('rejects an unknown query-contract field', async () => {
  await rejects('TALE_ANNEX_UNKNOWN_FIELD', (value) => { value.queryCompatibility.cursor.inferred = true; });
});

test('rejects response reinterpretation', async () => {
  await rejects('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', (value) => { value.queryCompatibility.responses[2].fullInlineTokens = true; });
});

test('rejects resolver response translation', async () => {
  await rejects('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', (value) => { value.queryCompatibility.resolver.responseTranslation = true; });
});

test('rejects resolver precedence changes', async () => {
  await rejects('TALE_ANNEX_VALUE_INVALID', (value) => { value.queryCompatibility.resolver.failure.precedenceBefore = ['nonsense']; });
});

test('rejects descriptor negotiation removal', async () => {
  await rejects('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', (value) => { value.queryCompatibility.catalogPackageDescriptor.supportedQueryApiVersionsFieldRequired = false; });
});

test('rejects an admitted token on React Native Web', async () => {
  await rejects('TALE_ANNEX_TARGET_INVALID', (value) => { value.entries.find((entry) => entry.disposition === 'adopt').targets['native.react-native-web'] = 'direct'; });
});

test('rejects web identities or owners in the iOS profile', async () => {
  await rejects('TALE_ANNEX_TARGET_INVALID', (value) => {
    Object.assign(value.targetProfiles['native.ios'], { bindingId: 'web.react', runtimeProfile: 'web.react', validationProfile: 'web.react', projectionOwner: '@core-ui/web' });
  });
});

test('rejects platform proof claims', async () => {
  await rejects('TALE_ANNEX_TARGET_INVALID', (value) => { value.targetProfiles.proofBoundary.accessibility = true; });
});

test('rejects React Native Web inheritance claims', async () => {
  await rejects('TALE_ANNEX_TARGET_INVALID', (value) => { value.targetProfiles['native.react-native-web'].inheritsWebReactEvidence = true; });
});

test('rejects wrong Boolean types across target, acceptance, and migration contracts', async () => {
  await rejects('TALE_ANNEX_TARGET_INVALID', (value) => { value.targetProfiles['native.react-native-web'].inheritsWebReactEvidence = 0; });
  await rejects('TALE_ANNEX_ACCEPTANCE_TOPOLOGY_INVALID', (value) => { value.acceptanceTopology.candidateImmutability = 1; });
  await rejects('TALE_ANNEX_MIGRATION_INVALID', (value) => { value.migration.phaseA.retainsInlineTokens = 1; });
});

test('rejects implicit repeated-name grouping even after digest recomputation', async () => {
  await rejects('TALE_ANNEX_GROUP_INCOMPLETE', (value) => {
    const index = value.groups.findIndex((group) => group.relationship === 'equivalent-source-values');
    value.groups.splice(index, 1);
    value.summary.logicalGroups = value.groups.length;
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
});

test('rejects groups outside bytewise ID order', async () => {
  await rejects('TALE_ANNEX_GROUP_DUPLICATE', (value) => { [value.groups[0], value.groups[1]] = [value.groups[1], value.groups[0]]; });
});

test('rejects a group without explicit mode mapping', async () => {
  await rejects('TALE_ANNEX_GROUP_INVALID', (value) => { delete value.groups.find((group) => group.relationship === 'mode-variants').members[0].mode; });
});

test('rejects removal of a shared admitted group Core mapping after digest recomputation', async () => {
  await rejects('TALE_ANNEX_GROUP_INVALID', (value) => {
    delete value.groups.find((group) => group.coreTokenId).coreTokenId;
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
});

test('rejects removal of a selector-group Core mapping after digest recomputation', async () => {
  await rejects('TALE_ANNEX_GROUP_INVALID', (value) => {
    delete value.groups.find((group) => group.relationship === 'selector-variants').coreTokenId;
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
});

test('rejects a changed existing token contract', async () => {
  await rejects('TALE_ANNEX_REUSE_MISMATCH', (value) => { value.coreTokens.find((token) => token.action === 'reuse').definition.modes['motion.reduced'].value = 120; });
});

test('rejects an incompatible token type and unit', async () => {
  await rejects('TALE_ANNEX_TOKEN_INVALID', (value) => { value.coreTokens.find((token) => token.action === 'add').definition.unit = 'string'; });
});

test('rejects a cross-type occurrence mapping after derived values are recomputed', async () => {
  await rejects('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', (value) => {
    const entry = value.entries.find((candidate) => candidate.occurrence.ordinal === 134);
    const removedId = entry.coreTokenId;
    entry.coreTokenId = 'reference.number.font-weight-medium';
    value.coreTokens = value.coreTokens.filter((token) => token.id !== removedId);
    recomputeDerivedInventory(value);
  });
});

test('rejects a wrong same-type Core value', async () => {
  await rejects('TALE_ANNEX_SOURCE_VALUE_MAPPING_INVALID', (value) => {
    value.coreTokens.find((token) => token.id === 'reference.color.bluegreen-5').definition.value = '#000000';
  });
});

test('rejects an ungrouped collapse onto one shared Core token', async () => {
  await rejects('TALE_ANNEX_GROUP_INCOMPLETE', (value) => {
    const entry = value.entries.find((candidate) => candidate.occurrence.ordinal === 392);
    const removedId = entry.coreTokenId;
    entry.coreTokenId = 'reference.color.neutral-cool-5';
    value.coreTokens = value.coreTokens.filter((token) => token.id !== removedId);
    recomputeDerivedInventory(value);
  });
});

test('rejects CSS timing-function strings as portable tokens', async () => {
  await rejects('TALE_ANNEX_CSS_VALUE_FORBIDDEN', (value) => { value.coreTokens.find((token) => token.action === 'add').definition.value = 'cubic-bezier(0.4, 0, 0.2, 1)'; });
});

test('rejects CSS shadow strings as portable tokens', async () => {
  await rejects('TALE_ANNEX_CSS_VALUE_FORBIDDEN', (value) => { value.coreTokens.find((token) => token.action === 'add').definition.value = 'drop-shadow(0 1px 2px #000)'; });
});

test('rejects a noncanonical page-profile digest', async () => {
  await rejects('TALE_ANNEX_PAGE_DIGEST_MISMATCH', (value) => { value.pageProfiles[0].normalizedWorstCaseEnvelopeSha256 = `sha256:${'0'.repeat(64)}`; });
});

test('rejects inconsistent page and cursor positions after digest recomputation', async () => {
  await rejects('TALE_ANNEX_PAGE_PROFILE_INVALID', (value) => {
    const page = value.pageProfiles[0];
    page.normalizedWorstCaseEnvelopePreimage.page.position -= 1;
    page.normalizedWorstCaseEnvelopeSha256 = digest(page.normalizedWorstCaseEnvelopePreimage);
  });
});

test('rejects an understated ArtifactRef envelope bound', async () => {
  await rejects('TALE_ANNEX_PAGE_PROFILE_INVALID', (value) => { value.pageProfiles[0].artifactIdMaximumBytes = 255; });
});

test('rejects an understated catalog-version envelope bound', async () => {
  await rejects('TALE_ANNEX_PAGE_PROFILE_INVALID', (value) => { value.pageProfiles[0].catalogVersionMaximumBytes = 63; });
});

test('rejects an understated catalog-version lexeme bound', async () => {
  await rejects('TALE_ANNEX_PAGE_PROFILE_INVALID', (value) => { value.pageProfiles[0].catalogVersionMaximumLexemes = 31; });
});

test('rejects changed governing and pinned-source identities', async () => {
  await rejects('TALE_ANNEX_IDENTITY_INVALID', (value) => { value.authorityRevision = '0'.repeat(40); });
  await rejects('TALE_ANNEX_SOURCE_IDENTITY_MISMATCH', (value) => {
    value.source.repository = 'example/unrelated';
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
  await rejects('TALE_ANNEX_SOURCE_IDENTITY_MISMATCH', (value) => {
    value.source.path = 'unrelated.json';
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
});

test('rejects query, page, cursor, and summary semantic reinterpretation', async () => {
  await rejects('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', (value) => { value.queryCompatibility.responses[1].inlineTokenDiagnostic.reason = 'nonsense'; });
  await rejects('TALE_ANNEX_VALUE_INVALID', (value) => { value.queryCompatibility.responses[0].sections = ''; });
  await rejects('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', (value) => { value.queryCompatibility.responses[0].fullInlineTokens = 1; });
  await rejects('TALE_ANNEX_QUERY_COMPATIBILITY_INVALID', (value) => { value.queryCompatibility.catalogPackageDescriptor.queryApiVersionFieldRequired = 1; });
  await rejects('TALE_ANNEX_VALUE_INVALID', (value) => { value.queryCompatibility.cli.generatedSurfaces = ['nonsense']; });
  await rejects('TALE_ANNEX_VALUE_INVALID', (value) => { value.queryCompatibility.cursor.selectorDigestPreimage = ['nonsense']; });
  await rejects('TALE_ANNEX_PAGE_PROFILE_INVALID', (value) => { value.pageProfiles[0].selection = 'nonsense'; });
  await rejects('TALE_ANNEX_CROSSWALK_DIGEST_MISMATCH', (value) => { value.summary.candidateSourceCrosswalkDigestProfile = 'nonsense'; });
  await rejects('TALE_ANNEX_RELEASE_MISMATCH', (value) => { value.releaseAdditions.source = 'nonsense'; });
});

test('rejects page budget-field reinterpretation after digest recomputation', async () => {
  for (const key of ['entryTokens', 'densePageBudget']) {
    await rejects('TALE_ANNEX_PAGE_PROFILE_INVALID', (value) => {
      const page = value.pageProfiles[0];
      page.normalizedWorstCaseEnvelopePreimage.page[key] = key === 'entryTokens' ? 0 : 1;
      page.normalizedWorstCaseEnvelopeSha256 = digest(page.normalizedWorstCaseEnvelopePreimage);
    });
  }
});

test('rejects a semantically invalid but continuous version plan', async () => {
  await rejects('TALE_ANNEX_VALUE_INVALID', (value) => {
    for (const phase of ['phaseA', 'phaseB', 'phaseC']) value.versions[phase].queryApiVersion.effect = 'nonsense';
  });
});

test('rejects migration-version reinterpretation', async () => {
  await rejects('TALE_ANNEX_MIGRATION_INVALID', (value) => { value.migration.phaseB.tokenSourceSchema.to = '9.9.9'; });
});

test('rejects rollback token-count reinterpretation', async () => {
  await rejects('TALE_ANNEX_ROLLBACK_INVALID', (value) => { value.rollback.phaseC.selectTokenCount = 999; });
});

test('rejects a source-crosswalk digest mismatch', async () => {
  await rejects('TALE_ANNEX_CROSSWALK_DIGEST_MISMATCH', (value) => { value.entries[0].reason = 'Changed authored reason.'; });
});

test('rejects an authored reason that names an absent Core token after digest recomputation', async () => {
  await rejects('TALE_ANNEX_REASON_REFERENCE_INVALID', (value) => {
    value.entries[558].reason = 'Retain the Tale pairing to reference.color.missing-100 as crosswalk context.';
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
});

test('rejects a role-oriented reference-name regression', async () => {
  await rejects('TALE_ANNEX_REASON_REFERENCE_INVALID', (value) => {
    value.entries[353].reason = 'This aliases the admitted accent palette.';
    value.summary.candidateSourceCrosswalkDigest = digest({ baseline: value.source, entries: value.entries, groups: value.groups });
  });
});

test('rejects an acceptance record for different annex bytes', async () => {
  const acceptance = await syntheticAcceptance();
  acceptance.bodySha256 = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(
    verifyTaleTokenAnnex(repositoryRoot, { acceptanceValue: acceptance }),
    (error) => error instanceof TaleTokenAnnexError && error.code === 'TALE_ANNEX_ACCEPTANCE_DIGEST_MISMATCH',
  );
});

test('rejects empty or wrong authenticated acceptance identities', async () => {
  for (const acceptance of [
    await syntheticAcceptance({ ownerNodeId: '' }),
    await syntheticAcceptance({ ownerNodeId: 'MDQ6VXNlcjE=' }),
    await syntheticAcceptance({ commentNodeId: '' }),
    await syntheticAcceptance({ commentNodeId: 'not-a-github-issue-comment' }),
  ]) {
    await assert.rejects(
      verifyTaleTokenAnnex(repositoryRoot, { acceptanceValue: acceptance }),
      (error) => error instanceof TaleTokenAnnexError && error.code === 'TALE_ANNEX_ACCEPTANCE_INVALID',
    );
  }
});

test('rejects a non-accepted human outcome', async () => {
  const acceptance = await syntheticAcceptance({ outcome: 'rejected' });
  await assert.rejects(
    verifyTaleTokenAnnex(repositoryRoot, { acceptanceValue: acceptance }),
    (error) => error instanceof TaleTokenAnnexError && error.code === 'TALE_ANNEX_ACCEPTANCE_INVALID',
  );
});

test('reports pending when the acceptance record is absent', async () => {
  const value = await annex();
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  const absentPath = 'decisions/0003-tale-token-classification-acceptance-missing.json';
  value.acceptanceTopology.requiredAcceptanceRecord = absentPath;
  profile.acceptanceRecordPath = absentPath;
  const result = await verifyTaleTokenAnnex(repositoryRoot, { annexValue: value, profileValue: profile });
  assert.equal(result.accepted, false);
});

test('repository merge mode accepts the bound human decision', async () => {
  const result = await execFile(
    process.execPath,
    ['tooling/audits/repository-policy/src/tale-token-annex-verify.mjs', '--require-acceptance'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.match(result.stdout, /human acceptance bound/u);
});

test('continuation capture rejects a pre-acceptance source commit', async () => {
  await assert.rejects(
    execFile(process.execPath, ['tests/evidence/capture-authority-39-annex-supersessions.mjs', '--source', '4c57cfff97c946979bb18e3aaee70558a65224b4'], { cwd: repositoryRoot, encoding: 'utf8' }),
    (error) => error.code === 1 && error.stderr.includes('EVIDENCE_SUPERSESSION_ACCEPTANCE_REQUIRED'),
  );
});

test('continuation capture refuses to overwrite its retained output root', async () => {
  const retainedIndex = JSON.parse(
    await readFile(resolve(repositoryRoot, 'tests/evidence/authority-39-annex/index.json'), 'utf8'),
  );
  await assert.rejects(
    execFile(
      process.execPath,
      [
        'tests/evidence/capture-authority-39-annex-supersessions.mjs',
        '--source',
        retainedIndex.sourceRevision,
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    ),
    (error) => error.code === 1 && error.stderr.includes('EVIDENCE_SUPERSESSION_OUTPUT_EXISTS'),
  );
});
