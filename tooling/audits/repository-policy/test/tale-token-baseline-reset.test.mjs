import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { sha256 } from '../src/policy.mjs';
import {
  acceptanceCommentBody,
  TaleTokenBaselineResetError,
  verifyTaleTokenBaselineReset,
} from '../src/tale-token-baseline-reset-verify.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const annexPath = resolve(repositoryRoot, 'decisions/0004-tale-only-reference-baseline-annex.json');
const architecturePath = resolve(repositoryRoot, 'strategy/monorepo-architecture.md');
const productScopePath = resolve(repositoryRoot, 'strategy/product-scope.md');

async function annex() {
  return JSON.parse(await readFile(annexPath, 'utf8'));
}

async function rejects(code, mutate) {
  const value = await annex();
  mutate(value);
  await assert.rejects(
    verifyTaleTokenBaselineReset(repositoryRoot, { annexValue: value }),
    (error) => error instanceof TaleTokenBaselineResetError && error.code === code,
  );
}

async function acceptance(overrides = {}) {
  const annexBytes = await readFile(annexPath, 'utf8');
  const architectureBytes = await readFile(architecturePath, 'utf8');
  const productScopeBytes = await readFile(productScopePath, 'utf8');
  const body = acceptanceCommentBody({
    annexBytes: Buffer.byteLength(annexBytes),
    annexSha256: `sha256:${sha256(annexBytes)}`,
    architectureBytes: Buffer.byteLength(architectureBytes),
    architectureSha256: `sha256:${sha256(architectureBytes)}`,
    productScopeBytes: Buffer.byteLength(productScopeBytes),
    productScopeSha256: `sha256:${sha256(productScopeBytes)}`,
  });
  return {
    schema: 'core-ui-authority-decision-v1',
    decisionId: 'core-ui:decision:0004',
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    issueNumber: 39,
    commentId: 1,
    commentNodeId: 'IC_test',
    createdAt: '2026-08-10T00:00:00Z',
    url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-1',
    bodySha256: `sha256:${sha256(body)}`,
    ...overrides,
  };
}

test('verifies the exact Tale-only reference baseline reset candidate', async () => {
  assert.deepEqual(await verifyTaleTokenBaselineReset(repositoryRoot), {
    accepted: true,
    affectedScopeIds: 67,
    finalTokenCount: 312,
    finalTokenSourceDigest: 'sha256:670f2a45ada8c90b39e6de4bc4e6fef9e175313607c428067c21b7c2b1c5eac2',
    removed: 10,
  });
});

test('rejects unknown decision fields', async () => {
  await rejects('TALE_RESET_UNKNOWN_FIELD', (value) => { value.unknown = true; });
});

test('rejects an unknown classification-delta profile', async () => {
  await rejects('TALE_RESET_CLASSIFICATION_MISMATCH', (value) => {
    value.classificationDelta.profile = 'core-ui-tale-reference-family-correction-v9';
  });
});

test('rejects a rename family disconnected from its result prefix', async () => {
  await rejects('TALE_RESET_CLASSIFICATION_MISMATCH', (value) => {
    value.classificationDelta.renames[0].family = 'warning';
  });
});

test('rejects overlapping classification ranges', async () => {
  await rejects('TALE_RESET_CLASSIFICATION_MISMATCH', (value) => {
    value.classificationDelta.deferrals[1].ordinalFrom = value.classificationDelta.deferrals[0].ordinalTo;
  });
});

test('rejects a classification range disconnected from the accepted parent IDs', async () => {
  await rejects('TALE_RESET_CLASSIFICATION_MISMATCH', (value) => {
    value.classificationDelta.deferrals[0].previousCoreIdPrefix = 'reference.color.neutral-missing-';
  });
});

test('rejects retaining the obsolete adoption reason for deferred families', async () => {
  await rejects('TALE_RESET_CLASSIFICATION_MISMATCH', (value) => {
    value.classificationDelta.deferralReason = 'Admit the literal neutral palette value under a normalized Core reference ID.';
  });
});

test('rejects target emission for a deferred neutral family', async () => {
  await rejects('TALE_RESET_TARGET_MISMATCH', (value) => {
    value.classificationDelta.deferredTargets['web.html'] = 'direct';
  });
});

test('rejects an incomplete authored meaning template', async () => {
  await rejects('TALE_RESET_MEANING_MISMATCH', (value) => {
    value.classificationDelta.renames[0].meaningTemplate = 'Core error palette.';
  });
});

test('rejects duplicate rename families and result prefixes', async () => {
  await rejects('TALE_RESET_CLASSIFICATION_MISMATCH', (value) => {
    value.classificationDelta.renames[1].family = 'error';
    value.classificationDelta.renames[1].resultCoreIdPrefix = 'reference.color.error-';
  });
});

test('rejects a missing legacy-token removal', async () => {
  await rejects('TALE_RESET_REMOVAL_SET_MISMATCH', (value) => { value.removals.pop(); });
});

test('rejects a replacement outside the accepted Tale reference inventory', async () => {
  await rejects('TALE_RESET_REPLACEMENT_INVALID', (value) => { value.removals[0].replacement = 'reference.color.missing'; });
});

test('rejects incomplete semantic remapping', async () => {
  await rejects('TALE_RESET_ALIAS_SET_MISMATCH', (value) => { value.semanticMappings.pop(); });
});

test('rejects speculative warning or success semantic roles', async () => {
  await rejects('TALE_RESET_ALIAS_SET_MISMATCH', (value) => {
    value.semanticMappings.push({ id: 'semantic.feedback.warning', alias: 'reference.color.warning-60', modes: {} });
  });
});

test('rejects an unaccepted compact semantic recipe', async () => {
  await rejects('TALE_RESET_MODE_MISMATCH', (value) => {
    value.semanticMappings.find(({ id }) => id === 'semantic.control.radius').modes['density.compact'] = { alias: 'reference.dimension.space-3xs' };
  });
});

test('rejects version-plan drift', async () => {
  await rejects('TALE_RESET_VERSION_MISMATCH', (value) => { value.versions.tokenContractVersion.to = 'invalid'; });
});

test('rejects a package version key outside affected package scope', async () => {
  await rejects('TALE_RESET_VERSION_MISMATCH', (value) => {
    value.versions.packages['@core-ui/unknown'] = { from: '0.0.0', to: '1.0.0', effect: 'unknown growth' };
  });
});

test('rejects query-version growth outside the accepted query grammar', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => { value.compatibility.currentCatalog.supportedQueryApiVersions.push('9.0.0'); });
});

test('rejects a renderer range without an affected platform owner', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => {
    value.compatibility.rendererTokenContractRanges['@core-ui/unknown'] = '^2.0.0';
  });
});

test('rejects a renderer range disconnected from the token-contract transition', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => {
    value.compatibility.rendererTokenContractRanges['@core-ui/web'] = '^9.0.0';
  });
});

test('rejects lifecycle qualifiers that invert current and future renderer packages', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => {
    value.compatibility.rendererTokenContractRanges['future @core-ui/web'] = value.compatibility.rendererTokenContractRanges['@core-ui/web'];
    delete value.compatibility.rendererTokenContractRanges['@core-ui/web'];
  });
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => {
    value.compatibility.rendererTokenContractRanges['@core-ui/react-native'] = value.compatibility.rendererTokenContractRanges['future @core-ui/react-native'];
    delete value.compatibility.rendererTokenContractRanges['future @core-ui/react-native'];
  });
});

test('rejects an unknown installed-local resolver dimension', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => {
    value.compatibility.installedLocal.requiredFailures[0].dimensions[0] = 'invented-dimension';
  });
});

test('rejects affected-scope omission', async () => {
  await rejects('TALE_RESET_SUMMARY_MISMATCH', (value) => { value.affectedScopeIds.pop(); });
});

test('rejects omission of the public naming scope owner', async () => {
  await rejects('TALE_RESET_SUMMARY_MISMATCH', (value) => {
    value.affectedScopeIds.splice(value.affectedScopeIds.indexOf('SCOPE-API-NAMING'), 1);
  });
});

test('rejects parent-decision supersession drift', async () => {
  await rejects('TALE_RESET_SUMMARY_MISMATCH', (value) => { value.supersession.pointers.pop(); });
});

test('rejects derived digest drift', async () => {
  await rejects('TALE_RESET_MIGRATION_MISMATCH', (value) => { value.digests.finalTokenSource = `sha256:${'0'.repeat(64)}`; });
});

test('rejects unknown nested migration fields', async () => {
  await rejects('TALE_RESET_UNKNOWN_FIELD', (value) => { value.migration.rollback.unknown = true; });
});

test('rejects a supersession pointer that does not resolve in decision 0003', async () => {
  await rejects('TALE_RESET_SUPERSESSION_MISMATCH', (value) => { value.supersession.pointers[value.supersession.pointers.length - 1] = '/zzz'; });
});

test('rejects ancestor and descendant overlap across superseded and preserved pointers', async () => {
  await rejects('TALE_RESET_SUPERSESSION_MISMATCH', (value) => {
    value.supersession.preservedPointers[0] = '/versions/phaseC/packages/@core-ui~1catalog';
    value.supersession.preservedPointers.sort();
  });
});

test('rejects overlapping field-ownership classifications', async () => {
  await rejects('TALE_RESET_OWNERSHIP_MISMATCH', (value) => { value.fieldOwnership.derived.push(value.fieldOwnership.authored[0]); });
});

test('rejects missing or reclassified ownership of the authored delta', async () => {
  await rejects('TALE_RESET_OWNERSHIP_MISMATCH', (value) => {
    value.fieldOwnership.authored[value.fieldOwnership.authored.indexOf('classificationDelta')] = 'arbitrary prose';
  });
  await rejects('TALE_RESET_OWNERSHIP_MISMATCH', (value) => {
    value.fieldOwnership.authored.splice(value.fieldOwnership.authored.indexOf('classificationDelta'), 1);
    value.fieldOwnership.referenced.push('classificationDelta');
  });
});

test('rejects wrong or untyped current-catalog token counts and empty behavior', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => { value.compatibility.currentCatalog.tokenCount = 313; });
  await rejects('TALE_RESET_VALUE_INVALID', (value) => { value.compatibility.currentCatalog.tokenCount = '312'; });
  await rejects('TALE_RESET_VALUE_INVALID', (value) => { value.compatibility.currentCatalog.behavior = ''; });
});

test('rejects a Git commit mislabeled as the historical catalog source revision', async () => {
  await rejects('TALE_RESET_COMPATIBILITY_MISMATCH', (value) => { value.compatibility.historicalTokenContract.catalogSourceRevision = '5dbda278493d05c72880e745adb088e7a2df0b07'; });
});

test('rejects a non-idempotent rollback contract', async () => {
  await rejects('TALE_RESET_MIGRATION_MISMATCH', (value) => { value.migration.rollback.idempotent = false; });
});

test('requires exact human acceptance only when requested', async () => {
  assert.equal((await verifyTaleTokenBaselineReset(repositoryRoot, { acceptanceValue: null })).accepted, false);
  await assert.rejects(
    verifyTaleTokenBaselineReset(repositoryRoot, { acceptanceValue: null, requireAcceptance: true }),
    (error) => error instanceof TaleTokenBaselineResetError && error.code === 'TALE_RESET_ACCEPTANCE_REQUIRED',
  );
  const result = await verifyTaleTokenBaselineReset(repositoryRoot, { acceptanceValue: await acceptance(), requireAcceptance: true });
  assert.equal(result.accepted, true);
});

test('rejects an acceptance record not bound to all three exact authority files', async () => {
  const record = await acceptance({ bodySha256: `sha256:${'0'.repeat(64)}` });
  await assert.rejects(
    verifyTaleTokenBaselineReset(repositoryRoot, { acceptanceValue: record }),
    (error) => error instanceof TaleTokenBaselineResetError && error.code === 'TALE_RESET_ACCEPTANCE_INVALID',
  );
});
