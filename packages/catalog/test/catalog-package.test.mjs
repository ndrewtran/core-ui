import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonicalDigest, parseJsonStrict, validateFamily } from '@core-ui/schema';
import { createCatalogApi } from '../src/index.mjs';

async function readJson(relativePath) {
  return parseJsonStrict(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

test('E-G0.4 package layout binds package, catalog, API, schema, digest, and source identity', async () => {
  const packageManifest = await readJson('../package.json');
  const identity = await readJson('../generated/catalog-package.json');
  const bundle = await readJson('../generated/catalog.json');
  const { catalogDigest: _catalogDigest, ...preimage } = bundle;
  assert.equal(packageManifest.coreUi.catalogPackage, './generated/catalog-package.json');
  assert.equal(identity.schema, 'core-ui-catalog-package-v1');
  assert.equal(identity.name, packageManifest.name);
  assert.equal(identity.version, packageManifest.version);
  assert.equal(identity.catalogVersion, packageManifest.version);
  assert.equal(identity.catalogVersion, bundle.catalogVersion);
  assert.equal(identity.catalogDigest, canonicalDigest(preimage));
  assert.equal(identity.catalogDigest, bundle.catalogDigest);
  assert.equal(identity.queryApiVersion, bundle.apiVersion);
  assert.equal(identity.schemaRange, '^1.0.0');
  assert.equal(identity.sourceRevision, bundle.sourceRevision);
  assert.equal(identity.provenance.kind, 'source-revision');
  assert.equal(identity.provenance.value, bundle.sourceRevision);
  assert.equal(identity.releaseManifest.catalog.id.startsWith('@core-ui/catalog@'), true);
  assert.equal(identity.releaseManifest.catalog.digest, bundle.catalogDigest);
  assert.equal(identity.releaseManifest.sourceRevision, bundle.sourceRevision);
  assert.deepEqual(identity.releaseManifest.bindings, []);
  assert.equal(identity.bundle, './catalog.json');
});

test('E-G0.4 installed-local resolution context is catalog-owned response metadata', async () => {
  const bundle = await readJson('../generated/catalog.json');
  const resolution = {
    authority: 'installed-local',
    compatibility: 'exact',
    catalogSource: 'project',
    sourceRevision: bundle.sourceRevision,
    targetPackages: { '@core-ui/catalog': bundle.catalogVersion },
    coreVersion: '0.0.0',
  };
  const api = createCatalogApi(bundle, { resolution });
  const responses = [
    api.getManifest({ detail: 'full' }),
    api.listArtifacts({ detail: 'brief', limit: 1 }),
    api.searchArtifacts({ query: 'button', detail: 'brief', limit: 1 }),
    api.getArtifact({ id: 'core:component:button', detail: 'compact' }),
  ];
  for (const response of responses) {
    validateFamily('query-envelope', response);
    assert.equal(response.meta.authority, 'installed-local');
    assert.equal(response.meta.catalogVersion, bundle.catalogVersion);
    assert.equal(response.meta.catalogDigest, bundle.catalogDigest);
    assert.equal(response.meta.resolution.authority, 'installed-local');
    assert.equal(response.meta.resolution.compatibility, 'exact');
    assert.equal(response.meta.resolution.catalogSource, 'project');
    assert.deepEqual(response.meta.resolution.targetPackages, {
      '@core-ui/catalog': bundle.catalogVersion,
    });
  }
  assert.throws(() => createCatalogApi(bundle, {
    resolution: { ...resolution, sourceRevision: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' },
  }), /CORE_CATALOG_RESOLUTION_CONTEXT_INVALID/);
  assert.throws(() => createCatalogApi(bundle, {
    resolution: { ...resolution, unverified: true },
  }), /CORE_CATALOG_RESOLUTION_CONTEXT_INVALID/);
  assert.throws(() => createCatalogApi(bundle, {
    resolution: { ...resolution, targetPackages: {} },
  }), /CORE_CATALOG_RESOLUTION_CONTEXT_INVALID/);
});
