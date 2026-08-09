import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
import { assertAcceptedQueryProfile, compileCatalog } from '../src/compiler.mjs';
import {
  createCatalogApi,
  getArtifact,
  getManifest,
  listArtifacts,
  searchArtifacts,
  validateTokenDetailSummary,
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

function withCatalogDigest(bundle) {
  return { ...bundle, catalogDigest: canonicalDigest(bundle) };
}

function syntheticCrosswalkBundle(entries, { pageBudgetProfile } = {}) {
  const bundle = structuredClone(preimage(baseBundle));
  const artifact = bundle.artifacts.find(({ kind }) => kind === 'token');
  const customPropertyNames = entries
    .map(({ occurrence }) => occurrence.name)
    .filter((name) => name.startsWith('--'));
  artifact.record.sourceCrosswalk = {
    baseline: {
      repository: 'Tale-UI/tale-ui', revision: 'a'.repeat(40), path: 'packages/tokens/tokens.json',
      sha256: `sha256:${'b'.repeat(64)}`, baseFontSizePx: 16,
      declarationOccurrences: entries.length,
      customPropertyOccurrences: customPropertyNames.length,
      uniqueCustomPropertyNames: new Set(customPropertyNames).size,
      nonCustomPropertyOccurrences: entries.length - customPropertyNames.length,
    },
    entries,
    groups: [],
  };
  artifact.sourceCrosswalkDigest = canonicalDigest(artifact.record.sourceCrosswalk);
  artifact.contentRevision = contentRevision('token-source', artifact.record);
  if (pageBudgetProfile !== undefined) bundle.pageBudgetProfile = pageBudgetProfile;
  return withCatalogDigest(bundle);
}

function rejectEntry(ordinal, { reason = 'Deferred test occurrence.', value = `${ordinal}px` } = {}) {
  return {
    occurrence: { ordinal, file: '_test.css', selector: ':root', name: `--test-${ordinal}`, value },
    disposition: 'reject',
    reason,
    targets: {
      'web.html': 'rejected', 'web.react': 'rejected', 'native.ios': 'rejected',
      'native.android': 'rejected', 'native.react-native-web': 'rejected',
    },
  };
}

function rebindSectionCursor(cursor, mutate) {
  const [, payloadPart] = cursor.split('.');
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  mutate(payload);
  const bytes = canonicalJson(payload);
  const digest = createHash('sha256').update(bytes).digest('hex');
  return `c1.${Buffer.from(bytes).toString('base64url')}.${digest}`;
}

const PHASE_B_HISTORICAL_IDENTITY_POINTERS = Object.freeze([
  '/data/artifact/schemaVersion',
  '/data/artifact/contentRevision',
  '/meta/coreVersion',
  '/meta/revisions/conceptContent',
  '/meta/catalogVersion',
  '/meta/catalogDigest',
  '/meta/sourceRevision',
  '/meta/resolution/sourceRevision',
  '/meta/resolution/revisions/conceptContent',
  '/meta/resolution/targetPackages/@core-ui~1catalog',
]);

function normalizePointers(value, pointers) {
  const normalized = JSON.parse(canonicalJson(value));
  for (const pointer of pointers) {
    const segments = pointer.slice(1).split('/').map((segment) => (
      segment.replaceAll('~1', '/').replaceAll('~0', '~')
    ));
    let owner = normalized;
    for (const segment of segments.slice(0, -1)) {
      if (owner?.[segment] === undefined) {
        owner = null;
        break;
      }
      owner = owner[segment];
    }
    const field = segments.at(-1);
    if (owner !== null && Object.hasOwn(owner, field)) owner[field] = `<normalized:${pointer}>`;
  }
  return normalized;
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

test('TALE-TOKEN-B query 2.0 removes inline tokens while retaining historical 1.1 and 1.2 meanings', () => {
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

  const v20 = api.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '2.0.0',
    detail: 'full',
  });
  assert.equal(v20.apiVersion, '2.0.0');
  assert.deepEqual(v20.warnings, []);
  assert.equal(Object.hasOwn(v20.data.artifact, 'tokens'), false);
  assert.equal(v20.data.artifact.tokenCount, Object.keys(v11.data.artifact.tokens).length);
  assert.equal(v20.data.artifact.sourceCrosswalkDigest, null);
  assert.deepEqual(v20.data.artifact.availableSections, ['tokens', 'source-crosswalk']);
  for (const response of [v11, v12, v20]) {
    assert.equal(Object.hasOwn(response.data.artifact, 'sourceCrosswalk'), false);
  }
  validateFamily('query-envelope', v20);
  for (const mutate of [
    (value) => { value.data.artifact.availableSections.reverse(); },
    (value) => { value.data.artifact.tokenCount = -1; },
    (value) => { value.data.artifact.tokenSourceContentRevision = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.data.artifact.tokens = {}; },
    (value) => { value.data.artifact.sourceCrosswalk = {}; },
    (value) => { value.data.artifact.unownedSummary = true; },
  ]) {
    const invalid = structuredClone(v20);
    mutate(invalid);
    assert.throws(() => validateFamily('query-envelope', invalid), /CORE_SCHEMA_INVALID/u);
  }
  const selectedTokenArtifact = baseBundle.artifacts.find(({ kind }) => kind === 'token');
  for (const mutate of [
    (value) => { value.sourceCrosswalkDigest = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.tokenCount += 1; },
    (value) => { value.tokenSourceContentRevision = `sha256:${'0'.repeat(64)}`; },
    (value) => { value.availableSections.reverse(); },
  ]) {
    const invalid = structuredClone(v20.data.artifact);
    mutate(invalid);
    assert.throws(
      () => validateTokenDetailSummary({ responseArtifact: invalid, selectedArtifact: selectedTokenArtifact }),
      /CORE_CATALOG_INTEGRITY_MISMATCH/u,
    );
  }

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
    reason: 'token-source-omits-source-crosswalk',
    tokenSourceSchemaVersion: '2.1.0',
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
  futureToken.record.sourceCrosswalk = {
    baseline: {
      repository: 'Tale-UI/tale-ui',
      revision: 'a'.repeat(40),
      path: 'packages/tokens/tokens.json',
      sha256: `sha256:${'b'.repeat(64)}`,
      baseFontSizePx: 16,
      declarationOccurrences: 1,
      customPropertyOccurrences: 0,
      uniqueCustomPropertyNames: 0,
      nonCustomPropertyOccurrences: 1,
    },
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
    groups: [],
  };
  futureToken.sourceCrosswalkDigest = canonicalDigest(futureToken.record.sourceCrosswalk);
  futureToken.contentRevision = contentRevision('token-source', futureToken.record);
  const futureApi = createCatalogApi({
    ...futurePreimage,
    catalogDigest: canonicalDigest(futurePreimage),
  });
  const availableCrosswalk = futureApi.getArtifact({
    id: 'core:token:button-minimum',
    queryApiVersion: '2.0.0',
    section: 'source-crosswalk',
  });
  assert.equal(availableCrosswalk.entries.status, 'available');
  assert.equal(availableCrosswalk.entries.items[0].occurrence.ordinal, 1);
  validateFamily('section-page', availableCrosswalk);

  delete futureToken.record.sourceCrosswalk;
  futureToken.sourceCrosswalkDigest = null;
  futureToken.contentRevision = contentRevision('token-source', futureToken.record);
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

test('TALE-TOKEN-B synthetic crosswalk pages preserve normalized groups without changing v1.2 projection', () => {
  const bundle = structuredClone(preimage(baseBundle));
  const artifact = bundle.artifacts.find(({ kind }) => kind === 'token');
  const occurrences = [
    { ordinal: 1, file: '_color.css', selector: ':root', name: '--action-dark', value: '#1f2937' },
    { ordinal: 2, file: '_color.css', selector: '.dark', name: '--action-dark', value: '#1f2937' },
  ];
  const targets = {
    'web.html': 'direct',
    'web.react': 'direct',
    'native.ios': 'direct',
    'native.android': 'direct',
    'native.react-native-web': 'deferred',
  };
  artifact.record.sourceCrosswalk = {
    baseline: {
      repository: 'Tale-UI/tale-ui',
      revision: 'a'.repeat(40),
      path: 'packages/tokens/tokens.json',
      sha256: `sha256:${'b'.repeat(64)}`,
      baseFontSizePx: 16,
      declarationOccurrences: 2,
      customPropertyOccurrences: 2,
      uniqueCustomPropertyNames: 1,
      nonCustomPropertyOccurrences: 0,
    },
    entries: occurrences.map((occurrence) => ({
      occurrence,
      disposition: 'adopt',
      coreTokenId: 'reference.color.action-dark',
      groupId: 'source.action-dark-equivalence',
      reason: 'The two source occurrences are exactly equivalent.',
      targets,
    })),
    groups: [{
      id: 'source.action-dark-equivalence',
      relationship: 'equivalent-source-values',
      coreTokenId: 'reference.color.action-dark',
      members: occurrences.map(({ ordinal }) => ({ ordinal, role: 'equivalent-source-value' })),
    }],
  };
  artifact.sourceCrosswalkDigest = canonicalDigest(artifact.record.sourceCrosswalk);
  artifact.contentRevision = contentRevision('token-source', artifact.record);
  const api = createCatalogApi({ ...bundle, catalogDigest: canonicalDigest(bundle) });
  const summary = api.getArtifact({
    id: artifact.id,
    queryApiVersion: '2.0.0',
    detail: 'full',
  });
  assert.equal(summary.data.artifact.sourceCrosswalkDigest, artifact.sourceCrosswalkDigest);

  const pages = [];
  let cursor = null;
  do {
    const page = api.getArtifact({
      id: artifact.id,
      queryApiVersion: '2.0.0',
      section: 'source-crosswalk',
      limit: 1,
      cursor,
    });
    validateFamily('section-page', page);
    pages.push(page);
    cursor = page.page.nextCursor;
  } while (cursor !== null);
  const items = pages.flatMap(({ entries }) => entries.items);
  assert.deepEqual(items.map(({ occurrence }) => occurrence.ordinal), [1, 2]);
  const reconstructed = [{
    id: items[0].group.id,
    relationship: items[0].group.relationship,
    coreTokenId: items[0].group.coreTokenId,
    members: items.map(({ group }) => group.member),
  }];
  assert.deepEqual(reconstructed, artifact.record.sourceCrosswalk.groups);

  const historical = api.getArtifact({
    id: artifact.id,
    queryApiVersion: '1.2.0',
    section: 'source-crosswalk',
    limit: 100,
  });
  assert.ok(historical.entries.items.every((entry) => (
    entry.groupId === 'source.action-dark-equivalence' && entry.group === undefined
  )));

  const mismatched = structuredClone(bundle);
  mismatched.artifacts.find(({ kind }) => kind === 'token').sourceCrosswalkDigest = `sha256:${'0'.repeat(64)}`;
  assert.throws(
    () => createCatalogApi({ ...mismatched, catalogDigest: canonicalDigest(mismatched) }),
    /CORE_CATALOG_INTEGRITY_MISMATCH/u,
  );
});

test('TALE-TOKEN-B retains exact Phase A v1.1 and v1.2 responses outside enumerated identities', async () => {
  const fixture = JSON.parse(await readFile(
    join(repositoryRoot, 'tests/fixtures/tale-token-phase-b/historical-responses.json'),
    'utf8',
  ));
  assert.equal(fixture.schema, 'core-ui-tale-token-phase-b-historical-responses-v1');
  assert.equal(fixture.sourceRevision, 'e1aa1c96464cf603debeadb520b5f45d7104242f');
  const current = {
    v11Full: getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.1.0', detail: 'full',
    }),
    v12Full: getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.2.0', detail: 'full',
    }),
    v12SourceCrosswalkAbsent: getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.2.0', section: 'source-crosswalk',
    }),
  };
  for (const key of ['v11Full', 'v12Full']) {
    assert.equal(
      canonicalJson(normalizePointers(current[key], PHASE_B_HISTORICAL_IDENTITY_POINTERS)),
      canonicalJson(normalizePointers(fixture.responses[key], PHASE_B_HISTORICAL_IDENTITY_POINTERS)),
      key,
    );
  }
  const absencePointers = [
    ...PHASE_B_HISTORICAL_IDENTITY_POINTERS,
    '/entries/reason',
    '/entries/tokenSourceSchemaVersion',
  ];
  assert.equal(
    canonicalJson(normalizePointers(current.v12SourceCrosswalkAbsent, absencePointers)),
    canonicalJson(normalizePointers(fixture.responses.v12SourceCrosswalkAbsent, absencePointers)),
  );
  const extraDrift = structuredClone(current.v12Full);
  extraDrift.warnings[0].message = 'Changed historical meaning.';
  assert.notEqual(
    canonicalJson(normalizePointers(extraDrift, PHASE_B_HISTORICAL_IDENTITY_POINTERS)),
    canonicalJson(normalizePointers(fixture.responses.v12Full, PHASE_B_HISTORICAL_IDENTITY_POINTERS)),
  );
});

test('TALE-TOKEN-B section cursors fail closed across tampering, versions, selectors, and catalog identities', () => {
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
  assert.equal(api.getArtifact({ ...request, queryApiVersion: '2.0.0', cursor: first.page.nextCursor }).error.code, 'CORE_CURSOR_INVALID');
  const crossSourceCursor = rebindSectionCursor(first.page.nextCursor, (payload) => {
    payload.tokenSourceContentRevision = `sha256:${'0'.repeat(64)}`;
  });
  assert.equal(api.getArtifact({ ...request, cursor: crossSourceCursor }).error.code, 'CORE_CURSOR_INVALID');
  for (const nextPosition of [0, 28, 4294967296]) {
    const outOfRangeCursor = rebindSectionCursor(first.page.nextCursor, (payload) => {
      payload.nextPosition = nextPosition;
    });
    assert.equal(
      api.getArtifact({ ...request, cursor: outOfRangeCursor }).error.code,
      'CORE_CURSOR_INVALID',
    );
  }
  assert.equal(api.getArtifact({ ...request, queryApiVersion: '1.3.0' }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(api.getArtifact({ ...request, queryApiVersion: 1.2 }).error.code, 'CORE_QUERY_INVALID');
  assert.equal(api.getArtifact({ ...request, invented: true }).error.code, 'CORE_QUERY_INVALID');
});

test('TALE-TOKEN-B runtime paging proves budget breaks, oversize errors, continuation, and position bounds', () => {
  const boundedEntries = [1, 2, 3].map((ordinal) => rejectEntry(ordinal, {
    reason: 'x '.repeat(250).trim(),
    value: 'y '.repeat(300).trim(),
  }));
  const api = createCatalogApi(syntheticCrosswalkBundle(boundedEntries));
  const pages = [];
  let cursor = null;
  do {
    const page = api.getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '2.0.0',
      section: 'source-crosswalk', limit: 100, cursor,
    });
    assert.equal(page.responseType, 'artifact.detail.section-page');
    assert.ok(page.page.returned >= 1);
    assert.ok(page.page.entryTokens <= 1536);
    pages.push(page);
    cursor = page.page.nextCursor;
  } while (cursor !== null);
  assert.ok(pages.length > 1, 'the runtime must break before the item limit when the token budget fills');
  assert.deepEqual(
    pages.flatMap(({ entries }) => entries.items.map(({ occurrence }) => occurrence.ordinal)),
    [1, 2, 3],
  );

  const oversizeApi = createCatalogApi(syntheticCrosswalkBundle([
    rejectEntry(1, { reason: 'x '.repeat(1024).trim(), value: 'y '.repeat(1024).trim() }),
  ]));
  assert.equal(oversizeApi.getArtifact({
    id: 'core:token:button-minimum', queryApiVersion: '2.0.0',
    section: 'source-crosswalk', limit: 1,
  }).error.code, 'CORE_QUERY_PAGE_ENTRY_TOO_LARGE');

  const envelopeBundle = structuredClone(preimage(syntheticCrosswalkBundle([rejectEntry(1)])));
  envelopeBundle.catalogVersion = `1.0.0+${'a'.repeat(65)}`;
  const envelopeApi = createCatalogApi(withCatalogDigest(envelopeBundle));
  assert.equal(envelopeApi.getArtifact({
    id: 'core:token:button-minimum', queryApiVersion: '2.0.0',
    section: 'source-crosswalk', limit: 1,
  }).error.code, 'CORE_QUERY_PAGE_ENVELOPE_TOO_LARGE');

  const overflowProfile = structuredClone(baseBundle.pageBudgetProfile);
  overflowProfile.cursorPositionMaximum = 1;
  const overflowApi = createCatalogApi(syntheticCrosswalkBundle(
    [rejectEntry(1), rejectEntry(2)], { pageBudgetProfile: overflowProfile },
  ));
  assert.equal(overflowApi.getArtifact({
    id: 'core:token:button-minimum', queryApiVersion: '2.0.0',
    section: 'source-crosswalk', limit: 1,
  }).error.code, 'CORE_CURSOR_INVALID');

  const terminalProfile = structuredClone(baseBundle.pageBudgetProfile);
  terminalProfile.cursorPositionMaximum = 2;
  const terminalApi = createCatalogApi(syntheticCrosswalkBundle(
    [rejectEntry(1), rejectEntry(2)], { pageBudgetProfile: terminalProfile },
  ));
  const first = terminalApi.getArtifact({
    id: 'core:token:button-minimum', queryApiVersion: '2.0.0',
    section: 'source-crosswalk', limit: 1,
  });
  const terminal = terminalApi.getArtifact({
    id: 'core:token:button-minimum', queryApiVersion: '2.0.0',
    section: 'source-crosswalk', limit: 1, cursor: first.page.nextCursor,
  });
  assert.equal(terminal.page.remaining, 0);
  assert.equal(terminal.page.nextCursor, null);
});

test('TALE-TOKEN-B page budget profile binds the exact accepted annex envelope', async () => {
  const profile = JSON.parse(await readFile(
    join(repositoryRoot, 'packages/catalog/token-section-page-budget-profile.json'),
    'utf8',
  ));
  const annex = JSON.parse(await readFile(
    join(repositoryRoot, 'decisions/0003-tale-token-classification-annex.json'),
    'utf8',
  ));
  const accepted = annex.pageProfiles.find(({ queryApiVersion }) => queryApiVersion === '2.0.0');
  assert.equal(
    canonicalDigest(accepted.normalizedWorstCaseEnvelopePreimage),
    profile.normalizedWorstCaseEnvelopeSha256,
  );
  assert.equal(countTokens(canonicalJson(accepted.normalizedWorstCaseEnvelopePreimage)), 201);
  assert.equal(profile.maximumEntryTokens + profile.envelopeReserveTokens, 2048);
  assert.equal(profile.cursorPositionMaximum, 4294967295);
  for (const mutate of [
    (value) => { value.id = 'core-ui-token-section-page-budget-1-2-0'; },
    (value) => { value.queryApiVersion = '1.2.0'; },
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
  assert.equal(assertAcceptedQueryProfile({
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
      () => assertAcceptedQueryProfile({
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
