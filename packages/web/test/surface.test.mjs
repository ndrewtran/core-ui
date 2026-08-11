import assert from 'node:assert/strict';
import test from 'node:test';
import { webCompatibility, webSurfaces } from '../src/index.mjs';
import { compileWebSurface } from '../src/compile-surface.mjs';
import { catalogJson } from '@core-ui/catalog/bundle';

const bundle = JSON.parse(catalogJson);
const button = bundle.artifacts.find(({ id }) => id === 'core:component:button');
const tokenSource = bundle.artifacts.find(({ id }) => id === 'core:token:default-theme').record;

test('E-G1.1-02 machine-enumerates only binding and token-policy derived hooks', () => {
  const html = webSurfaces['web.html'].surface;
  const react = webSurfaces['web.react'].surface;
  for (const surface of [html, react]) {
    assert.equal(surface.rootClass, '.core-button');
    assert.deepEqual(surface.slots, ['[data-core-slot="label"]']);
    assert.deepEqual(surface.states, ['data-core-state-disabled']);
    assert.deepEqual(surface.events, ['core:activate']);
    assert.deepEqual(surface.publicCustomProperties, [
      '--core-component-button-background',
      '--core-component-button-foreground',
    ]);
    assert.deepEqual(surface.cascadeLayers, ['core.tokens', 'core.components', 'core.utilities']);
    assert.equal(surface.styleExport, '@core-ui/web/button.css');
    assert.ok(!JSON.stringify(surface).includes('wrapper'));
  }
  assert.deepEqual(
    { ...html, bindingRef: null, bindingSpecRevision: null },
    { ...react, bindingRef: null, bindingSpecRevision: null },
  );
  assert.equal(webCompatibility.bindings['web.html'].lifecycle, 'experimental');
  assert.equal(webCompatibility.bindings['web.react'].lifecycle, 'experimental');
});

test('E-G1.1-02 refuses nonexistent exports and non-component identities', () => {
  assert.throws(
    () => compileWebSurface({ artifact: button, bindingId: 'web.html', packageExports: [], tokenSource }),
    /CORE_WEB_SURFACE_EXPORT_MISSING/,
  );
  assert.throws(
    () => compileWebSurface({
      artifact: { ...button, id: 'core:guide:button' },
      bindingId: 'web.html',
      packageExports: ['./button.css'],
      tokenSource,
    }),
    /CORE_WEB_SURFACE_ARTIFACT_INVALID/,
  );
});
