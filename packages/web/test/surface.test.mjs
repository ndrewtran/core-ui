import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    assert.deepEqual(surface.states, surface === html
      ? ['data-core-state-disabled']
      : ['data-core-state-disabled', 'data-core-state-pending']);
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
    (({ bindingRef, bindingSpecRevision, states, ...surface }) => surface)(html),
    (({ bindingRef, bindingSpecRevision, states, ...surface }) => surface)(react),
  );
  assert.equal(webCompatibility.bindings['web.html'].lifecycle, 'experimental');
  assert.equal(webCompatibility.bindings['web.react'].lifecycle, 'experimental');
  assert.deepEqual(button.record.bindings['web.html'].api.props, ['disabled']);
  assert.deepEqual(button.record.bindings['web.react'].api.props, ['disabled', 'pending']);
  assert.doesNotMatch(JSON.stringify(html), /pending/u);
  assert.match(JSON.stringify(react), /pending/u);
});

test('E-G1.1-02 framework-free web output does not inherit React-only pending', async () => {
  const bindings = await readFile(new URL('../generated/bindings.d.ts', import.meta.url), 'utf8');
  const stylesheet = await readFile(new URL('../generated/button.css', import.meta.url), 'utf8');
  const [htmlTypes, reactTypes] = bindings.split('\n\n');
  assert.doesNotMatch(htmlTypes, /pending/u);
  assert.match(reactTypes, /pending/u);
  assert.doesNotMatch(stylesheet, /pending/u);
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
