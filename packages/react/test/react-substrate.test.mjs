import assert from 'node:assert/strict';
import test from 'node:test';
import React, { StrictMode, act, createElement, useRef } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { connectRoot, webSurfaces } from '@core-ui/web';
import { inspectRuntime, platformSafetyFixture } from '@core-ui/web/testing';
import { reactCompatibility, useCoreRootOwnership } from '../src/index.mjs';
import { reactPlatformSafetyFixture } from '../src/testing.mjs';

function Fixture({ setup, disabled = false }) {
  const ref = useRef(null);
  useCoreRootOwnership(ref, setup);
  const surface = webSurfaces['web.react'].surface;
  return createElement('button', {
    ref,
    type: 'button',
    className: surface.rootClass.slice(1),
    ...(disabled ? { disabled: true, [surface.states[0]]: '' } : {}),
  }, createElement('span', { 'data-core-slot': 'label' }, 'Synthetic action'));
}

function installDom(markup = '<!doctype html><html><body><div id="root"></div></body></html>') {
  const dom = new JSDOM(markup, { url: 'https://core-ui.test/' });
  const previous = Object.fromEntries(['window', 'document', 'HTMLElement', 'Node', 'Event'].map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  };
}

test('E-G1.1-04 imports and server renders without browser globals', () => {
  assert.equal(Object.hasOwn(globalThis, 'window'), false);
  const markup = renderToString(createElement(Fixture, { disabled: true }));
  assert.match(markup, /class="core-button"/);
  assert.match(markup, /data-core-state-disabled=""/);
  assert.match(markup, /data-core-slot="label"/);
  assert.match(markup, /disabled=""/);
});

test('E-G1.1-04 hydration claims after commit without changing public markup', async () => {
  const serverMarkup = renderToString(createElement(Fixture, {}));
  const cleanupDom = installDom(`<!doctype html><html><body><div id="root">${serverMarkup}</div></body></html>`);
  try {
    const container = document.querySelector('#root');
    const before = container.innerHTML;
    let root;
    await act(async () => { root = hydrateRoot(container, createElement(Fixture, {})); });
    const button = container.querySelector('button');
    assert.equal(container.innerHTML, before);
    assert.equal(inspectRuntime(button).owner, 'react');
    await act(async () => root.unmount());
    assert.equal(inspectRuntime(button).owner, 'unclaimed');
  } finally { cleanupDom(); }
});

test('E-G1.1-03 StrictMode replay and concurrent roots share effects and fully clean up', async () => {
  const cleanupDom = installDom('<!doctype html><html><body><div id="one"></div><div id="two"></div></body></html>');
  try {
    const setup = (resources) => {
      resources.addDocumentListener('keydown', () => {});
      resources.acquireScrollLock();
    };
    const first = createRoot(document.querySelector('#one'));
    const second = createRoot(document.querySelector('#two'));
    await act(async () => {
      first.render(createElement(StrictMode, null, createElement(Fixture, { setup })));
      second.render(createElement(Fixture, { setup }));
    });
    const firstButton = document.querySelector('#one button');
    const secondButton = document.querySelector('#two button');
    assert.equal(inspectRuntime(firstButton).owner, 'react');
    assert.deepEqual(inspectRuntime(secondButton), {
      owner: 'react', physicalDocumentListeners: 1, logicalDocumentListeners: 2,
      scrollLocks: 2, inertTargets: 0,
    });
    await act(async () => { first.unmount(); second.unmount(); });
    assert.deepEqual(inspectRuntime(secondButton), {
      owner: 'unclaimed', physicalDocumentListeners: 0, logicalDocumentListeners: 0,
      scrollLocks: 0, inertTargets: 0,
    });
  } finally { cleanupDom(); }
});

test('E-G1.1-03 React cannot claim a vanilla-owned root', async () => {
  const serverMarkup = renderToString(createElement(Fixture, {}));
  const cleanupDom = installDom(`<!doctype html><html><body><div id="root">${serverMarkup}</div></body></html>`);
  try {
    const container = document.querySelector('#root');
    const button = container.querySelector('button');
    const vanilla = connectRoot(button, { token: {} });
    let reactRoot;
    let failure;
    try {
      await act(async () => { reactRoot = hydrateRoot(container, createElement(Fixture, {})); });
    } catch (error) {
      failure = error;
    }
    assert.match(String(failure), /CORE_WEB_ROOT_OWNED/);
    assert.equal(inspectRuntime(button).owner, 'vanilla');
    vanilla.destroy();
    if (reactRoot) await act(async () => reactRoot.unmount());
  } finally { cleanupDom(); }
});

test('E-G1.1-05 React preserves the web surface and exact web stylesheet identity', () => {
  const html = webSurfaces['web.html'].surface;
  const react = webSurfaces['web.react'].surface;
  assert.deepEqual(
    { ...html, bindingRef: null, bindingSpecRevision: null },
    { ...react, bindingRef: null, bindingSpecRevision: null },
  );
  assert.equal(reactPlatformSafetyFixture.stylesheet, platformSafetyFixture.stylesheet);
  assert.equal(reactPlatformSafetyFixture.stylesheetDigest, platformSafetyFixture.stylesheetDigest);
  assert.equal(reactPlatformSafetyFixture.requirementSet.digest, platformSafetyFixture.profiles['web.react'].requirementSet.digest);
  assert.equal(reactPlatformSafetyFixture.componentSupportClaim, 'none');
  assert.equal(reactCompatibility.styleSource, '@core-ui/web/button.css');
  assert.equal(reactCompatibility.bindings['web.react'].specRevision, react.bindingSpecRevision);
});
