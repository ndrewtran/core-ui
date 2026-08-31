import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalDigest, canonicalJson } from '@muxui/schema';
import { createCatalogApi } from '../../../../packages/catalog/src/index.mjs';

const historicalCatalog = pathToFileURL(resolve(
  import.meta.dirname,
  '../../../../packages/catalog/generated/catalog.mjs',
)).href;
const historicalBundlePath = resolve(
  import.meta.dirname,
  '../../../../tests/fixtures/tale-token-phase-b/installed-catalog/generated/catalog.json',
);
const historicalResponsesPath = resolve(
  import.meta.dirname,
  '../../../../tests/fixtures/tale-token-phase-b/historical-responses.json',
);

function mapIdentity(value, direction) {
  if (typeof value === 'string') {
    if (direction === 'toCurrent') {
      return value
        .replaceAll('core-ui', 'muxui')
        .replaceAll('core', 'muxui')
        .replaceAll('Core UI', 'Mux UI')
        .replaceAll('CORE', 'MUXUI');
    }
    return value
      .replaceAll('@muxui/', '@core-ui/')
      .replaceAll('muxui', 'core')
      .replaceAll('Mux UI', 'Core UI')
      .replaceAll('MUXUI', 'CORE');
  }
  if (Array.isArray(value)) return value.map((item) => mapIdentity(item, direction));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      mapIdentity(key, direction),
      mapIdentity(item, direction),
    ]));
  }
  return value;
}

function withCatalogDigest(bundle) {
  const { catalogDigest: _catalogDigest, ...preimage } = bundle;
  return { ...bundle, catalogDigest: canonicalDigest(preimage) };
}

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
    if (owner !== null && Object.hasOwn(owner, field)) owner[field] = `normalized:${pointer}`;
  }
  return normalized;
}

/**
 * Replays the immutable Core-era catalog through the current implementation.
 * The identity projection is deliberately owned by this private test hook so
 * the public catalog package remains current-only.
 */
export async function createHistoricalCatalogApi() {
  const historicalBundle = JSON.parse(await readFile(historicalBundlePath, 'utf8'));
  const currentBundle = withCatalogDigest(mapIdentity(historicalBundle, 'toCurrent'));
  const currentApi = createCatalogApi(currentBundle);
  return Object.fromEntries(Object.entries(currentApi).map(([operation, implementation]) => [
    operation,
    (request) => mapIdentity(implementation(mapIdentity(request, 'toCurrent')), 'toHistorical'),
  ]));
}

export async function verifyHistoricalCatalogCompatibility() {
  const fixture = JSON.parse(await readFile(historicalResponsesPath, 'utf8'));
  const historicalApi = await createHistoricalCatalogApi();
  assert.equal(fixture.schema, 'core-ui-tale-token-phase-b-historical-responses-v1');
  assert.equal(fixture.sourceRevision, 'e1aa1c96464cf603debeadb520b5f45d7104242f');

  const current = {
    v11Full: historicalApi.getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.1.0', detail: 'full',
    }),
    v12Full: historicalApi.getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.2.0', detail: 'full',
    }),
    v12SourceCrosswalkAbsent: historicalApi.getArtifact({
      id: 'core:token:button-minimum', queryApiVersion: '1.2.0', section: 'source-crosswalk',
    }),
  };
  const identityPointers = [
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
  ];
  for (const key of ['v11Full', 'v12Full']) {
    assert.equal(
      canonicalJson(normalizePointers(current[key], identityPointers)),
      canonicalJson(normalizePointers(fixture.responses[key], identityPointers)),
      key,
    );
  }
  const absencePointers = [
    ...identityPointers,
    '/entries/reason',
    '/entries/tokenSourceSchemaVersion',
    '/meta/selectorDigest',
    '/meta/tokenSourceContentRevision',
  ];
  assert.equal(
    canonicalJson(normalizePointers(current.v12SourceCrosswalkAbsent, absencePointers)),
    canonicalJson(normalizePointers(fixture.responses.v12SourceCrosswalkAbsent, absencePointers)),
  );
  const extraDrift = structuredClone(current.v12Full);
  extraDrift.warnings[0].message = 'Changed historical meaning.';
  assert.notEqual(
    canonicalJson(normalizePointers(extraDrift, identityPointers)),
    canonicalJson(normalizePointers(fixture.responses.v12Full, identityPointers)),
  );
  for (const queryApiVersion of ['1.1.0', '1.2.0', '2.0.0']) {
    assert.equal(historicalApi.getArtifact({
      id: 'core:token:button-minimum', queryApiVersion, detail: 'full',
    }).data.artifact.id, 'core:token:button-minimum');
    assert.equal(historicalApi.getArtifact({
      id: 'core:token:default-theme', queryApiVersion, detail: 'full',
    }).error.code, 'CORE_ARTIFACT_NOT_FOUND');
  }
  return true;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@core-ui/catalog/bundle') {
      return { shortCircuit: true, url: historicalCatalog };
    }
    return nextResolve(specifier, context);
  },
});
