import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { sha256 } from '../src/policy.mjs';
import {
  acceptanceCommentBody,
  acceptanceRecordFromGitHubComment,
  DefaultThemeIdentityCorrectionError,
  verifyDefaultThemeIdentityCorrection,
} from '../src/default-theme-identity-correction-verify.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const decisionPath = resolve(repositoryRoot, 'decisions/0005-default-theme-token-source-identity.json');
const productScopePath = resolve(repositoryRoot, 'strategy/product-scope.md');

async function decision() {
  return JSON.parse(await readFile(decisionPath, 'utf8'));
}

async function rejects(code, mutate) {
  const value = await decision();
  mutate(value);
  await assert.rejects(
    verifyDefaultThemeIdentityCorrection(repositoryRoot, { decisionValue: value, acceptanceValue: null }),
    (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === code,
  );
}

async function syntheticAcceptance(overrides = {}) {
  const decisionSource = await readFile(decisionPath, 'utf8');
  const productScopeSource = await readFile(productScopePath, 'utf8');
  const body = acceptanceCommentBody({ decisionSource, productScopeSource });
  return {
    bodySha256: `sha256:${sha256(body)}`,
    commentId: 1,
    commentNodeId: 'IC_test',
    createdAt: '2026-08-10T00:00:00Z',
    decisionId: 'core-ui:decision:0005',
    issueNumber: 39,
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-authority-decision-v1',
    url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-1',
    ...overrides,
  };
}

test('verifies the exact accepted identity-correction candidate', async () => {
  assert.deepEqual(
    await verifyDefaultThemeIdentityCorrection(repositoryRoot, { acceptanceValue: await syntheticAcceptance(), requireAcceptance: true }),
    {
      accepted: true,
      authoritySupersessionRoot: 'tests/evidence/authority-39-default-theme-identity/index.json',
      authoritySupersessionTargets: 20,
      currentArtifactId: 'core:token:default-theme',
      currentPath: 'catalog/tokens/default-theme.json',
      immutableEvidenceEntries: 365,
      phaseCRoots: 6,
      scopeVersion: '4.0.0',
    },
  );
});

test('rejects duplicate JSON keys before candidate validation', async () => {
  const source = await readFile(decisionPath, 'utf8');
  await assert.rejects(
    verifyDefaultThemeIdentityCorrection(repositoryRoot, {
      decisionSource: `{"schema":"duplicate",${source.slice(1)}`,
      acceptanceValue: null,
    }),
    (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === 'DEFAULT_THEME_IDENTITY_DUPLICATE_KEY',
  );
});

test('rejects unknown top-level decision fields', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_UNKNOWN_FIELD', (value) => { value.unknown = true; });
});

test('rejects a noncanonical decision serialization', async () => {
  const source = await readFile(decisionPath, 'utf8');
  await assert.rejects(
    verifyDefaultThemeIdentityCorrection(repositoryRoot, { decisionSource: `${source}\n`, acceptanceValue: null }),
    (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === 'DEFAULT_THEME_IDENTITY_JSON_INVALID',
  );
});

test('rejects source identity drift', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_IDENTITY_INVALID', (value) => {
    value.correction.to.artifactId = 'core:token:not-default-theme';
  });
});

test('rejects version-plan drift', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_VERSION_INVALID', (value) => {
    value.versions.scopeVersion.to = '4.0.1';
  });
});

test('rejects an unresolved direct-parent supersession pointer', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', (value) => {
    value.supersession.pointers[value.supersession.pointers.length - 1] = '/zzz';
  });
});

test('rejects ancestor and descendant pointer overlap', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_SUPERSESSION_INVALID', (value) => {
    value.supersession.preservedPointers[0] = '/versions';
    value.supersession.preservedPointers.sort();
  });
});

test('rejects resolver facts that reinterpret decision 0004', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_COMPATIBILITY_INVALID', (value) => {
    value.compatibility.installedLocal.precedence.reverse();
  });
});

test('rejects an inferred historical tooling tuple', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_COMPATIBILITY_INVALID', (value) => {
    value.compatibility.installedLocal.historicalPositiveTuple = 'retained tooling-compatible';
  });
});

test('rejects immutable-history manifest drift', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.implementation.pathClassification.immutableHistory.prePhaseCEvidenceImmutableManifest.entryCount = 364;
  });
});

test('rejects an extra editable capture script', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.implementation.pathClassification.immutableHistory.prePhaseCEvidenceImmutableManifest.excludedActiveCaptureScripts.push('tests/evidence/capture-extra.mjs');
  });
});

test('rejects migration ownership drift', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', (value) => {
    value.implementation.owner = 'tests/';
  });
});

test('rejects test orchestration claiming product ownership', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', (value) => {
    value.evidenceTopology.captureScriptOwner = 'tests/ authors canonical token facts';
  });
});

test('rejects authority applicability ownership or topology drift', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.evidenceTopology.authorityApplicabilitySupersession.targetCount = 19;
  });
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.evidenceTopology.authorityApplicabilitySupersession.targetNames.reverse();
  });
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.evidenceTopology.authorityApplicabilitySupersession.predecessorIndex = 'tests/evidence/other/index.json';
  });
  await rejects('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', (value) => {
    value.evidenceTopology.authorityApplicabilitySupersession.captureScriptOwner = 'tests/ authors product facts';
  });
});

test('rejects unsorted or expanded proof paths', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', (value) => {
    value.implementation.pathClassification.proofAndFixtures.reverse();
  });
  await rejects('DEFAULT_THEME_IDENTITY_OWNERSHIP_INVALID', (value) => {
    value.implementation.pathClassification.proofAndFixtures.push('tests/evidence/extra');
  });
});

test('rejects an extra or missing Phase C root', async () => {
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.evidenceTopology.rootPaths.push('tests/evidence/tale-token-phase-c-extra/index.json');
  });
  await rejects('DEFAULT_THEME_IDENTITY_HISTORY_INVALID', (value) => {
    value.evidenceTopology.rootPaths.pop();
  });
});

test('rejects Product Scope byte drift', async () => {
  const source = await readFile(productScopePath, 'utf8');
  await assert.rejects(
    verifyDefaultThemeIdentityCorrection(repositoryRoot, { productScopeSource: `${source}\n`, acceptanceValue: null }),
    (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === 'DEFAULT_THEME_IDENTITY_AUTHORITY_MISMATCH',
  );
});

test('requires exact human acceptance only when requested', async () => {
  assert.equal((await verifyDefaultThemeIdentityCorrection(repositoryRoot, { acceptanceValue: null })).accepted, false);
  await assert.rejects(
    verifyDefaultThemeIdentityCorrection(repositoryRoot, { acceptanceValue: null, requireAcceptance: true }),
    (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === 'DEFAULT_THEME_IDENTITY_ACCEPTANCE_REQUIRED',
  );
  assert.equal((await verifyDefaultThemeIdentityCorrection(repositoryRoot, {
    acceptanceValue: await syntheticAcceptance(),
    requireAcceptance: true,
  })).accepted, true);
});

test('rejects an acceptance record with the wrong authority-body digest', async () => {
  await assert.rejects(
    verifyDefaultThemeIdentityCorrection(repositoryRoot, {
      acceptanceValue: await syntheticAcceptance({ bodySha256: `sha256:${'0'.repeat(64)}` }),
    }),
    (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === 'DEFAULT_THEME_IDENTITY_ACCEPTANCE_INVALID',
  );
});

test('captures only the exact authenticated owner comment', async () => {
  const decisionSource = await readFile(decisionPath, 'utf8');
  const productScopeSource = await readFile(productScopePath, 'utf8');
  const body = acceptanceCommentBody({ decisionSource, productScopeSource });
  const comment = {
    author_association: 'OWNER',
    body,
    created_at: '2026-08-10T00:00:00Z',
    html_url: 'https://github.com/ndrewtran/core-ui/issues/39#issuecomment-1',
    id: 1,
    issue_url: 'https://api.github.com/repos/ndrewtran/core-ui/issues/39',
    node_id: 'IC_test',
    user: { login: 'ndrewtran', node_id: 'MDQ6VXNlcjc0MzE0OTg0' },
  };
  assert.equal(
    acceptanceRecordFromGitHubComment(comment, decisionSource, productScopeSource).bodySha256,
    `sha256:${sha256(body)}`,
  );
  for (const mutation of [
    { body: 'wrong' },
    { author_association: 'CONTRIBUTOR' },
    { user: { login: 'someone-else', node_id: 'MDQ6VXNlcjc0MzE0OTg0' } },
    { node_id: '' },
  ]) {
    assert.throws(
      () => acceptanceRecordFromGitHubComment({ ...comment, ...mutation }, decisionSource, productScopeSource),
      (error) => error instanceof DefaultThemeIdentityCorrectionError && error.code === 'DEFAULT_THEME_IDENTITY_ACCEPTANCE_INVALID',
    );
  }
});
