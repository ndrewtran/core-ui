import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { Button } from '../src/button.mjs';
import { R1ButtonFixture } from '../src/button-fixture.mjs';
import { EXPECTED_R12_DONOR_CONTRACT } from '../src/r1-2-donor-contract.mjs';

test('R1.1 Button owns Core selectors and required token crosswalk', async () => {
  const css = await readFile(resolve(import.meta.dirname, '../generated/styles.css'), 'utf8');
  const comparison = JSON.parse(await readFile(resolve(import.meta.dirname, '../generated/button-donor-comparison.json'), 'utf8'));
  assert.match(css, /\.core-r1-button/);
  for (const token of ['core-component-button-background', 'core-component-button-foreground', 'core-component-button-radius', 'core-component-button-padding-inline', 'core-component-button-min-height']) assert.match(css, new RegExp(token));
  assert.doesNotMatch(css, /--color-60|\.tale-/);
  assert.equal(comparison.donor.commit, '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd');
  assert.equal(comparison.result.selector, '.core-button');
  assert.equal(comparison.result.status, 'adapted-for-r1.1-button');
  assert.equal(comparison.consumedRules.length, 9);
});

test('R1.2 component selectors and donor dispositions stay Core-owned', async () => {
  const css = await readFile(resolve(import.meta.dirname, '../generated/styles.css'), 'utf8');
  const comparisonSource = await readFile(resolve(import.meta.dirname, '../generated/component-donor-comparison.json'), 'utf8');
  const comparison = JSON.parse(comparisonSource.replace(/^\/\/ @generated-from:.*\n\/\/ @generated-content-sha256:.*\n/u, ''));
  const names = ['Button', 'Breadcrumbs', 'Checkbox', 'Disclosure', 'DisclosureGroup', 'Group', 'Link', 'Meter', 'ProgressBar', 'Separator', 'ToggleButton', 'Autocomplete', 'CheckboxGroup', 'DateField', 'DatePicker', 'DateRangePicker', 'Form', 'NumberField', 'SearchField', 'Switch', 'TextField', 'TimeField'];
  for (const name of names) {
    const slug = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
    assert.match(css, new RegExp(`\\.core-${slug}(?:\\b|[-_])`));
  }
  assert.match(css, /\.core-checkbox-indicator/);
  assert.match(css, /data-indeterminate/);
  assert.match(css, /semantic-feedback-invalid/);
  assert.equal(comparison.components.length, names.length);
  assert.deepEqual(comparison.components.map(({ component }) => component), names);
  assert.equal(comparison.components.find(({ component }) => component === 'Group').disposition, 'no-applicable-donor');
  assert.ok(comparison.components.filter(({ disposition }) => disposition === 'adapt').length >= 9);
  assert.doesNotMatch(css, /(?:\\.tale-|--color-60|@keyframes|animation:)/u);
});

test('R1.2 donor crosswalk is exact, adapted, and dependency-free', async () => {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const crosswalk = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-2/donor-crosswalk.json'), 'utf8'));
  const slugs = ['autocomplete', 'checkbox-group', 'date-field', 'date-picker', 'date-range-picker', 'form', 'number-field', 'search-field', 'switch', 'text-field', 'time-field'];
  assert.equal(crosswalk.schema, 'core-ui-react-r1-2-donor-crosswalk-v1');
  assert.deepEqual(crosswalk, EXPECTED_R12_DONOR_CONTRACT);
  assert.equal(crosswalk.donor.commit, '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd');
  assert.equal(crosswalk.dependency, false);
  assert.deepEqual(crosswalk.sharedPrimitives, [
    { path: 'packages/styles/src/_primitives.css', blob: 'b54d4ab7296f992731cfd844b4edac28d5254ee8' },
    { path: 'packages/styles/src/button.css', blob: '32227dc8969351bb11499d53e7773425b3fe7e68' },
  ]);
  assert.deepEqual(Object.keys(crosswalk.components).sort(), slugs.sort());
  for (const slug of slugs) {
    const entry = crosswalk.components[slug];
    assert.equal(entry.disposition, 'adapt');
    assert.deepEqual(entry.rules.map(({ input }) => input), entry.consumedRules);
    assert.ok(entry.donorInputs.length >= 3);
    assert.ok(entry.donorInputs.every(({ path, blob }) => path && /^[0-9a-f]{40}$/u.test(blob)));
  }
  assert.match(await readFile(resolve(repositoryRoot, 'packages/react/NOTICE'), 'utf8'), /Tale UI contributors/);
});

test('R1.1 Core Button proves SSR, hydration, disabled and pending state', async () => {
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

    const ref = React.createRef();
    const consumer = createRoot(root);
    await act(async () => consumer.render(React.createElement(Button, {
      ref,
      'aria-label': 'Core action',
      'data-consumer-hook': 'preserved',
    }, 'Save')));
    const direct = root.querySelector('button');
    assert.equal(ref.current, direct);
    assert.equal(direct.getAttribute('aria-label'), 'Core action');
    assert.equal(direct.dataset.consumerHook, 'preserved');

    let activation;
    await act(async () => consumer.render(React.createElement(Button, {
      onActivate: (event) => { activation = event; },
    }, 'Activate')));
    let clickError;
    try {
      await act(async () => root.querySelector('button').click());
    } catch (error) {
      clickError = error;
    }
    assert.equal(clickError, undefined);
    assert.equal(activation.type, 'activate');
    assert.ok(['mouse', 'pen', 'touch', 'keyboard', 'virtual', undefined].includes(activation.pointerType));
    assert.equal(activation.target instanceof dom.window.HTMLButtonElement, true);
    assert.equal('preventDefault' in activation, false);
    await act(async () => consumer.unmount());
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
});
