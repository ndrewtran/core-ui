import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  canonicalDigest,
  bindingContentRevision,
  contentRevision,
  relationEdges,
  validateFamily,
} from '@core-ui/schema';
import { catalogJson } from '../generated/catalog.mjs';
import { compileCatalog } from '../src/compiler.mjs';
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
  assert.equal(list.type, 'artifact.list');
  assert.equal(search.type, 'artifact.search');
  assert.equal(detail.type, 'artifact.detail');
  assert.equal(detail.meta.authority, 'advisory');
  assert.equal(detail.meta.resolution.authority, 'advisory');
  assert.equal(detail.meta.resolution.compatibility, 'unresolved');
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
