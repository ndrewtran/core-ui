import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { R1ButtonFixture } from '../src/button-fixture.mjs';

test('R1.0 comparison fixture owns Core selectors and required token crosswalk', async () => {
  const css = await readFile(resolve(import.meta.dirname, '../generated/styles.css'), 'utf8');
  const comparison = JSON.parse(await readFile(resolve(import.meta.dirname, '../generated/button-donor-comparison.json'), 'utf8'));
  assert.match(css, /\.core-r1-button/);
  for (const token of ['core-component-button-background', 'core-component-button-foreground', 'core-component-button-radius', 'core-component-button-padding-inline', 'core-component-button-min-height']) assert.match(css, new RegExp(token));
  assert.doesNotMatch(css, /--color-60|\.tale-/);
  assert.equal(comparison.donor.commit, '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd');
  assert.equal(comparison.result.selector, '.core-r1-button');
  assert.equal(comparison.result.status, 'adapted-for-private-r1.0-fixture');
  assert.equal(comparison.consumedRules.length, 9);
});

test('R1.0 React Aria fixture proves SSR, hydration, disabled and pending state', async () => {
  const server = renderToString(React.createElement(R1ButtonFixture, { pending: true }));
  const disabledServer = renderToString(React.createElement(R1ButtonFixture, { disabled: true }));
  assert.match(server, /aria-busy="true"/);
  assert.match(server, /data-core-state="pending"/);
  assert.doesNotMatch(server, / disabled=""/);
  assert.match(disabledServer, / disabled=""/);
  assert.match(disabledServer, /data-disabled="true"/);
  const dom = new JSDOM(`<!doctype html><div id="root">${server}</div>`);
  const keys = ['window', 'document', 'Element', 'HTMLElement', 'HTMLButtonElement', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent', 'MutationObserver'];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    SVGElement: dom.window.SVGElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    PointerEvent: dom.window.PointerEvent ?? dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let hydrated;
  let presses = 0;
  try {
    const root = document.querySelector('#root');
    const button = root.querySelector('button');
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    await act(async () => { hydrated = hydrateRoot(root, React.createElement(R1ButtonFixture, { pending: true, onPress: () => { presses += 1; } })); });
    assert.equal(root.querySelector('button').getAttribute('data-core-state'), 'pending');
    await act(async () => root.querySelector('button').focus());
    assert.equal(document.activeElement, root.querySelector('button'));
    await act(async () => root.querySelector('button').click());
    assert.equal(presses, 0);
    assert.equal(root.firstElementChild.dataset.corePressCount, '0');
    await act(async () => hydrated.unmount());
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
});
