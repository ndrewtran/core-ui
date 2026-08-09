import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  canonicalDigest,
  canonicalJson,
  bindingContentRevision,
  contentRevision,
  relationEdges,
  validateFamily,
} from '@core-ui/schema';
import { catalogJson } from '../generated/catalog.mjs';
import { assertPhaseAQueryProfile, compileCatalog } from '../src/compiler.mjs';
import {
  createCatalogApi,
  getArtifact,
  getManifest,
  listArtifacts,
  searchArtifacts,
} from '../src/index.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const baseBundle = JSON.parse(catalogJson);

function preimage(bundle) {
  const { catalogDigest: _catalogDigest, ...value } = bundle;
  return value;
}

function countTokens(value) {
  return value.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

test('E-G0.2-01: declared sources compile to byte-identical ordered bundles', async () => {
  const first = await compileCatalog({ repositoryRoot });
  const second = await compileCatalog({ repositoryRoot });
  assert.equal(first.bytes, second.bytes);
  assert.equal(first.bundle.catalogDigest, second.bundle.catalogDigest);
  assert.deepEqual(
    first.bundle.artifacts.map(({ id }) => id),
    [...first.bundle.artifacts.map(({ id }) => id)].sort(),
  );
  assert.deepEqual(
    first.bundle.relations,
    [...first.bundle.relations].sort((left, right) => (
      left.type.localeCompare(right.type)
      || left.source.localeCompare(right.source)
      || left.target.localeCompare(right.target)
    )),
  );

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'core-ui-catalog-order-'));
  try {
    const manifest = JSON.parse(await readFile(
      join(repositoryRoot, 'packages/catalog/catalog-sources.json'),
      'utf8',
    ));
    manifest.records.reverse();
    const manifestPath = join(temporaryRoot, 'catalog-sources.json');
    await writeFile(manifestPath, JSON.stringify(manifest));
    const reordered = await compileCatalog({ repositoryRoot, sourceManifestPath: manifestPath });
    assert.equal(reordered.bytes, first.bytes);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('E-G0.2-01 negative: generated bundle matches its canonical source manifest', async () => {
  const compiled = await compileCatalog({ repositoryRoot });
  assert.equal(catalogJson, compiled.bytes);
  assert.equal(baseBundle.catalogDigest, canonicalDigest(preimage(baseBundle)));
});

test('E-G0.2-02: list, search, and get are deterministic with exact provenance', () => {
  const list = listArtifacts({ limit: 100, detail: 'compact' });
  const search = searchArtifacts({ query: 'button action', detail: 'brief' });
  const detail = getArtifact({
    id: 'core:component:button',
    platform: 'web.react',
    detail: 'full',
  });
  assert.deepEqual(list, listArtifacts({ limit: 100, detail: 'compact' }));
  assert.deepEqual(search, searchArtifacts({ query: 'button action', detail: 'brief' }));
  assert.deepEqual(detail, getArtifact({
    id: 'core:component:button',
    platform: 'web.react',
    detail: 'full',
  }));
  assert.deepEqual(getArtifact({
    id: 'core:component:button',
    platform: 'web.react',
    detail: 'full',
  }), detail);
  assert.equal(getArtifact({ id: 'button', detail: 'brief' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(getArtifact({ id: 'Button', detail: 'brief' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(getManifest({ limit: 1 }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(list.type, 'artifact.list');
  assert.equal(search.type, 'artifact.search');
  assert.equal(detail.type, 'artifact.detail');
  assert.equal(detail.meta.authority, 'advisory');
  assert.equal(detail.meta.resolution.authority, 'advisory');
  assert.equal(detail.meta.resolution.compatibility, 'unresolved');
  assert.equal(detail.meta.resolution.catalogSource, 'package');
  assert.deepEqual(detail.meta.resolution.targetPackages, {});
  assert.equal(detail.meta.catalogDigest, baseBundle.catalogDigest);
  assert.equal(detail.meta.sourceRevision, baseBundle.sourceRevision);
  assert.equal(detail.meta.resolution.sourceRevision, baseBundle.sourceRevision);
  assert.match(detail.meta.revisions.conceptContent, /^sha256:[a-f0-9]{64}$/);
  assert.match(detail.meta.revisions.bindingContent, /^sha256:[a-f0-9]{64}$/);
  assert.match(detail.meta.revisions.bindingSpec, /^sha256:[a-f0-9]{64}$/);
  assert.equal(detail.data.artifact.source.record, 'catalog/components/button/artifact.json');
  assert.equal(
    search.data.items[0].source.record,
    'catalog/components/button/artifact.json',
  );
  assert.ok(search.data.items[0].matchReasons.length > 0);
  assert.ok(search.data.items[0].matchReasons.every(({ field, match, points }) => (
    typeof field === 'string'
    && ['exact', 'prefix'].includes(match)
    && Number.isInteger(points)
  )));
  for (const response of [list, search, detail, getManifest()]) {
    validateFamily('query-envelope', response);
    assert.equal(Object.isFrozen(response), true);
  }
  const missingProvenance = structuredClone(list);
  delete missingProvenance.meta.sourceRevision;
  assert.throws(() => validateFamily('query-envelope', missingProvenance));
  const missingReasons = structuredClone(search);
  delete missingReasons.data.items[0].matchReasons;
  assert.throws(() => validateFamily('query-envelope', missingReasons));
  const mismatchedDiscriminator = structuredClone(list);
  mismatchedDiscriminator.type = 'artifact.search';
  assert.throws(() => validateFamily('query-envelope', mismatchedDiscriminator));
  const missingResolvedRevisions = structuredClone(detail);
  missingResolvedRevisions.meta.resolution.revisions = {};
  assert.throws(() => validateFamily('query-envelope', missingResolvedRevisions));
});

test('E-G0.2-02: graph and revisions remain derived from schema-owned contracts', () => {
  const records = baseBundle.artifacts.map(({ record }) => record);
  assert.deepEqual(baseBundle.relations, relationEdges(records).sort((left, right) => (
    left.type.localeCompare(right.type)
    || left.source.localeCompare(right.source)
    || left.target.localeCompare(right.target)
  )));
  const button = baseBundle.artifacts.find(({ id }) => id === 'core:component:button');
  assert.equal(button.contentRevision, contentRevision('component', button.record));
  assert.equal(
    button.bindingContentRevisions['web.react'],
    bindingContentRevision(button.record.bindings['web.react']),
  );
});

test('E-G0.2-03: pagination is digest- and request-bound', () => {
  const first = listArtifacts({ limit: 1, detail: 'brief' });
  assert.equal(first.meta.truncated, true);
  assert.equal(typeof first.meta.nextCursor, 'string');
  const second = listArtifacts({ limit: 1, detail: 'brief', cursor: first.meta.nextCursor });
  assert.notEqual(first.data.items[0].id, second.data.items[0].id);

  const invalid = listArtifacts({ limit: 1, detail: 'brief', cursor: 'not-a-cursor' });
  assert.equal(invalid.type, 'error');
  assert.equal(invalid.error.code, 'CORE_CURSOR_INVALID');

  const changedRequest = listArtifacts({ limit: 1, detail: 'compact', cursor: first.meta.nextCursor });
  assert.equal(changedRequest.error.code, 'CORE_CURSOR_INVALID');

  const alternatePreimage = { ...preimage(baseBundle), catalogVersion: '0.0.1' };
  const alternateApi = createCatalogApi({
    ...alternatePreimage,
    catalogDigest: canonicalDigest(alternatePreimage),
  });
  const crossDigest = alternateApi.listArtifacts({
    limit: 1,
    detail: 'brief',
    cursor: first.meta.nextCursor,
  });
  assert.equal(crossDigest.error.code, 'CORE_CURSOR_INVALID');
});

test('TALE-TOKEN-A query 1.2 retains inline 1.1 meaning and adds bounded token sections', () => {
  const api = createCatalogApi(baseBundle);
  const v11 = api.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.1.0',
    detail: 'full',
  });
  assert.equal(v11.apiVersion, '1.1.0');
  assert.deepEqual(v11.warnings, []);
  assert.ok(Object.hasOwn(v11.data.artifact, 'tokens'));

  const v12 = api.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    detail: 'full',
  });
  assert.equal(v12.apiVersion, '1.2.0');
  assert.ok(Object.hasOwn(v12.data.artifact, 'tokens'));
  assert.equal(v12.warnings[0].code, 'CORE_QUERY_INLINE_TOKENS_DEPRECATED');
  assert.equal(v12.warnings[0].details.replacement, 'section=tokens');
  validateFamily('query-envelope', v11);
  validateFamily('query-envelope', v12);

  const first = api.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    section: 'tokens',
    limit: 1,
  });
  assert.equal(first.responseType, 'artifact.detail.section-page');
  assert.equal(first.entries.status, 'available');
  assert.equal(first.entries.items.length, 1);
  assert.equal(first.page.returned, 1);
  assert.ok(first.page.remaining > 0);
  assert.equal(typeof first.page.nextCursor, 'string');
  assert.ok(first.page.entryTokens <= 1536);
  const { entries: _entries, ...envelope } = first;
  assert.ok(countTokens(canonicalJson(envelope)) <= 512);
  validateFamily('section-page', first);
  validateFamily('query-envelope', first);

  const second = api.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    section: 'tokens',
    limit: 1,
    cursor: first.page.nextCursor,
  });
  assert.equal(second.page.position, 1);
  assert.notEqual(second.entries.items[0].id, first.entries.items[0].id);

  const absent = api.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    section: 'source-crosswalk',
  });
  assert.deepEqual(absent.entries, {
    status: 'absent',
    reason: 'token-source-schema-does-not-declare-source-crosswalk',
    tokenSourceSchemaVersion: '2.0.0',
    items: [],
  });
  assert.deepEqual(absent.page, {
    position: 0,
    returned: 0,
    remaining: 0,
    nextCursor: null,
    entryTokens: 0,
    densePageBudget: 2048,
  });
  validateFamily('section-page', absent);

  const futurePreimage = structuredClone(preimage(baseBundle));
  const futureToken = futurePreimage.artifacts.find(({ kind }) => kind === 'token');
  futureToken.record.schemaVersion = '2.1.0';
  futureToken.record.sourceCrosswalk = {
    entries: [{
      occurrence: {
        ordinal: 1,
        file: '_base.css',
        selector: 'html',
        name: 'font-size',
        value: '100%',
      },
      disposition: 'reject',
      reason: 'This is an HTML root style, not a portable token declaration.',
      targets: {
        'web.html': 'rejected',
        'web.react': 'rejected',
        'native.ios': 'rejected',
        'native.android': 'rejected',
        'native.react-native-web': 'rejected',
      },
    }],
  };
  const futureApi = createCatalogApi({
    ...futurePreimage,
    catalogDigest: canonicalDigest(futurePreimage),
  });
  const availableCrosswalk = futureApi.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    section: 'source-crosswalk',
  });
  assert.equal(availableCrosswalk.entries.status, 'available');
  assert.equal(availableCrosswalk.entries.items[0].occurrence.ordinal, 1);
  validateFamily('section-page', availableCrosswalk);

  delete futureToken.record.sourceCrosswalk;
  const omittedApi = createCatalogApi({
    ...futurePreimage,
    catalogDigest: canonicalDigest(futurePreimage),
  });
  assert.deepEqual(omittedApi.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    section: 'source-crosswalk',
  }).entries, {
    status: 'absent',
    reason: 'token-source-omits-source-crosswalk',
    tokenSourceSchemaVersion: '2.1.0',
    items: [],
  });
});

test('TALE-TOKEN-A section cursors fail closed across tampering, selectors, and catalog identities', () => {
  const api = createCatalogApi(baseBundle);
  const request = {
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
    section: 'tokens',
    limit: 1,
  };
  const first = api.getArtifact(request);
  for (const cursor of [
    'not-a-cursor',
    `${first.page.nextCursor.slice(0, -1)}${first.page.nextCursor.endsWith('0') ? '1' : '0'}`,
  ]) {
    assert.equal(api.getArtifact({ ...request, cursor }).error.code, 'CORE_CURSOR_INVALID');
  }
  assert.equal(api.getArtifact({ ...request, limit: 2, cursor: first.page.nextCursor }).error.code, 'CORE_CURSOR_INVALID');

  const changed = { ...preimage(baseBundle), catalogVersion: '0.1.1' };
  const changedApi = createCatalogApi({ ...changed, catalogDigest: canonicalDigest(changed) });
  assert.equal(changedApi.getArtifact({ ...request, cursor: first.page.nextCursor }).error.code, 'CORE_CURSOR_INVALID');
  assert.equal(api.getArtifact({ ...request, queryApiVersion: '2.0.0' }).error.code, 'CORE_QUERY_API_VERSION_UNSUPPORTED');
  assert.equal(api.getArtifact({ ...request, queryApiVersion: '1.3.0' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(api.getArtifact({ ...request, queryApiVersion: 1.2 }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(api.getArtifact({ ...request, invented: true }).error.code, 'CORE_QUERY_INVALID');
});

test('TALE-TOKEN-A page budget profile binds the exact accepted annex envelope', async () => {
  const profile = JSON.parse(await readFile(
    join(repositoryRoot, 'packages/catalog/token-section-page-budget-profile.json'),
    'utf8',
  ));
  const annex = JSON.parse(await readFile(
    join(repositoryRoot, 'decisions/0003-tale-token-classification-annex.json'),
    'utf8',
  ));
  const accepted = annex.pageProfiles.find(({ queryApiVersion }) => queryApiVersion === '1.2.0');
  assert.equal(
    canonicalDigest(accepted.normalizedWorstCaseEnvelopePreimage),
    profile.normalizedWorstCaseEnvelopeSha256,
  );
  assert.equal(countTokens(canonicalJson(accepted.normalizedWorstCaseEnvelopePreimage)), 201);
  assert.equal(profile.maximumEntryTokens + profile.envelopeReserveTokens, 2048);
  assert.equal(profile.cursorPositionMaximum, 4294967295);
  for (const mutate of [
    (value) => { value.id = 'core-ui-token-section-page-budget-2-0-0'; },
    (value) => { value.queryApiVersion = '2.0.0'; },
  ]) {
    const invalidProfile = structuredClone(baseBundle.pageBudgetProfile);
    mutate(invalidProfile);
    const invalidPreimage = { ...preimage(baseBundle), pageBudgetProfile: invalidProfile };
    assert.throws(
      () => createCatalogApi({ ...invalidPreimage, catalogDigest: canonicalDigest(invalidPreimage) }),
      /CORE_SCHEMA_INVALID/,
    );
  }
  const manifest = JSON.parse(await readFile(
    join(repositoryRoot, 'packages/catalog/catalog-sources.json'),
    'utf8',
  ));
  assert.equal(assertPhaseAQueryProfile({
    manifest,
    pageBudgetProfile: profile,
    authorityDecision: annex,
  }), profile);
  for (const mutate of [
    (value) => { value.profile.unowned = true; },
    (value) => { value.profile.cursorMaximumBytes -= 1; },
    (value) => { value.profile.envelopeOversizeCode = 'CORE_QUERY_PAGE_ENTRY_TOO_LARGE'; },
    (value) => { value.profile.cursorBindings.reverse(); },
    (value) => { value.profile.normalizedWorstCaseEnvelopeSha256 = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.manifest.queryApiVersion = '1.1.0'; },
    (value) => { value.manifest.supportedQueryApiVersions = ['1.2.0']; },
  ]) {
    const invalid = { manifest: structuredClone(manifest), profile: structuredClone(profile) };
    mutate(invalid);
    assert.throws(
      () => assertPhaseAQueryProfile({
        manifest: invalid.manifest,
        pageBudgetProfile: invalid.profile,
        authorityDecision: annex,
      }),
      /CORE_(?:CATALOG_SOURCE|SCHEMA)_INVALID/,
    );
  }
});

test('TALE-TOKEN-A selected catalog descriptor owns query defaults and support', () => {
  const historicalPreimage = {
    ...preimage(baseBundle),
    apiVersion: '1.1.0',
    supportedQueryApiVersions: ['1.1.0'],
  };
  const historical = createCatalogApi({
    ...historicalPreimage,
    catalogDigest: canonicalDigest(historicalPreimage),
  });
  assert.equal(historical.getManifest().apiVersion, '1.1.0');
  assert.equal(historical.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.1.0',
  }).apiVersion, '1.1.0');
  const unsupported = historical.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '1.2.0',
  });
  assert.equal(unsupported.apiVersion, '1.1.0');
  assert.equal(unsupported.error.code, 'CORE_QUERY_API_VERSION_UNSUPPORTED');

  for (const response of [
    historical.listArtifacts({ kind: 'not-a-kind' }),
    historical.listArtifacts({ cursor: 'not-a-cursor' }),
    historical.searchArtifacts({ query: '' }),
    historical.getArtifact({ id: 'not-an-artifact-ref' }),
    historical.getArtifact({ id: 'core:component:not-present' }),
    historical.getArtifact({ id: 'core:token:button-minimum', cursor: 'not-a-cursor' }),
  ]) {
    assert.equal(response.type, 'error');
    assert.equal(response.apiVersion, '1.1.0');
  }

  const inconsistentPreimage = {
    ...preimage(baseBundle),
    supportedQueryApiVersions: ['1.1.0'],
  };
  assert.throws(
    () => createCatalogApi({
      ...inconsistentPreimage,
      catalogDigest: canonicalDigest(inconsistentPreimage),
    }),
    /CORE_CATALOG_INTEGRITY_MISMATCH/,
  );
});

test('E-G0.2-04: search is bounded and retrieval traverses only direct relations', () => {
  const search = searchArtifacts({ query: 'button', limit: 1, detail: 'brief' });
  assert.equal(search.data.items.length, 1);
  assert.equal(Object.hasOwn(search.data.items[0], 'record'), false);
  assert.ok(JSON.stringify(search).length < 8_000);

  const examples = getArtifact({
    id: 'core:component:button',
    platform: 'web.react',
    section: 'examples',
    purpose: 'generation',
    detail: 'compact',
  });
  assert.equal(examples.data.value.length, 1);
  assert.equal(examples.data.value[0].id, 'core:example:button-basic-react');
  assert.equal(Object.hasOwn(examples.data.value[0], 'record'), false);

  const htmlExamples = getArtifact({
    id: 'core:component:button',
    platform: 'web.html',
    section: 'examples',
    purpose: 'generation',
    detail: 'compact',
  });
  assert.deepEqual(
    htmlExamples.data.value.map(({ id }) => id),
    ['core:example:button-basic-html'],
  );

  const profileBundle = structuredClone(baseBundle);
  const profileButton = profileBundle.artifacts.find(
    ({ id }) => id === 'core:component:button',
  );
  profileButton.platforms.push('native.react-native-web');
  profileButton.platforms.sort();
  profileButton.record.bindings['native.react-native'].runtimeProfiles['native.react-native-web'] = {
    strategy: 'adapted',
    lifecycle: 'experimental',
    validationProfile: 'native.react-native-web',
  };
  const profileExample = structuredClone(
    profileBundle.artifacts.find(({ id }) => id === 'core:example:button-basic-html'),
  );
  profileExample.id = 'core:example:button-native-profile';
  profileExample.record.id = profileExample.id;
  profileExample.record.binding.ref = 'core:component:button#native.react-native';
  delete profileExample.record.binding.runtimeProfiles;
  profileBundle.artifacts.push(profileExample);
  profileBundle.artifacts.sort((left, right) => left.id.localeCompare(right.id));
  let profilePreimage = preimage(profileBundle);
  let profileApi = createCatalogApi({
    ...profilePreimage,
    catalogDigest: canonicalDigest(profilePreimage),
  });
  assert.deepEqual(profileApi.getArtifact({
    id: 'core:component:button',
    platform: 'native.react-native-web',
    section: 'examples',
  }).data.value, []);
  profileExample.record.binding.runtimeProfiles = ['native.react-native-web'];
  profilePreimage = preimage(profileBundle);
  profileApi = createCatalogApi({
    ...profilePreimage,
    catalogDigest: canonicalDigest(profilePreimage),
  });
  assert.deepEqual(
    profileApi.getArtifact({
      id: 'core:component:button',
      platform: 'native.react-native-web',
      section: 'examples',
    }).data.value.map(({ id }) => id),
    ['core:example:button-native-profile'],
  );

  const full = getArtifact({ id: 'core:component:button', detail: 'full' });
  assert.equal(full.data.artifact.id, 'core:component:button');
  assert.ok(full.data.relations.length > 0);
  assert.equal(Object.hasOwn(full.data, 'catalog'), false);
  assert.ok(JSON.stringify(full).length < catalogJson.length);
});

test('E-G0.2-04 negative: unsupported selectors and missing artifacts are typed', () => {
  const badSelector = listArtifacts({ platform: 'hosted.latest' });
  assert.equal(badSelector.error.code, 'CORE_QUERY_INVALID');
  assert.deepEqual(badSelector.error.details.fields, ['platform']);
  assert.equal(listArtifacts({ kind: 'not-a-kind' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(searchArtifacts({ query: ' '.repeat(257) }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(searchArtifacts({ query: '---' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(getArtifact({ id: '' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(getArtifact({ id: 'not-an-artifact-ref' }).error.code, 'CORE_QUERY_INVALID');
  const missing = getArtifact({ id: 'core:component:missing' });
  assert.equal(missing.error.code, 'CORE_ARTIFACT_NOT_FOUND');
  validateFamily('query-envelope', badSelector);
  validateFamily('query-envelope', missing);

  const wrongPurpose = getArtifact({
    id: 'core:example:button-basic-react',
    purpose: 'migration',
  });
  assert.equal(wrongPurpose.error.code, 'CORE_ARTIFACT_NOT_FOUND');
});

test('E-G0.2-05: query kernel is hermetic and ranking ignores environment state', async () => {
  const querySource = await readFile(join(repositoryRoot, 'packages/catalog/src/index.mjs'), 'utf8');
  for (const forbidden of [
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:dns',
    'node:child_process',
    'process.env',
    'Math.random',
    'Date.now',
    'localeCompare',
    'eval(',
    'new Function',
  ]) {
    assert.equal(querySource.includes(forbidden), false, forbidden);
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'core-ui-query-hermetic-'));
  const originalDirectory = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalLanguage = process.env.LANG;
  try {
    process.chdir(temporaryRoot);
    globalThis.fetch = () => { throw new Error('network access forbidden'); };
    process.env.LANG = 'tr_TR.UTF-8';
    const before = await readdir(temporaryRoot);
    const first = searchArtifacts({ query: 'BUTTON', limit: 100 });
    process.env.LANG = 'C';
    const second = searchArtifacts({ query: 'BUTTON', limit: 100 });
    const after = await readdir(temporaryRoot);
    assert.deepEqual(first, second);
    assert.deepEqual(after, before);
  } finally {
    process.chdir(originalDirectory);
    globalThis.fetch = originalFetch;
    if (originalLanguage === undefined) delete process.env.LANG;
    else process.env.LANG = originalLanguage;
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('E-G0.2-05 negative: compiler uses the declared manifest and rejects duplicates', async () => {
  const compilerSource = await readFile(join(repositoryRoot, 'packages/catalog/src/compiler.mjs'), 'utf8');
  assert.equal(compilerSource.includes('readdir'), false);
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'core-ui-catalog-manifest-'));
  try {
    const manifest = JSON.parse(await readFile(
      join(repositoryRoot, 'packages/catalog/catalog-sources.json'),
      'utf8',
    ));
    manifest.records.push({ ...manifest.records[0] });
    const manifestPath = join(temporaryRoot, 'catalog-sources.json');
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(
      compileCatalog({ repositoryRoot, sourceManifestPath: manifestPath }),
      /CORE_CATALOG_SOURCE_INVALID: duplicate/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
