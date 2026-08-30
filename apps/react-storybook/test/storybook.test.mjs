import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { ToastProvider } from '@core-ui/react';
import {
  argTypesForBinding,
  adapterNames,
  createStory,
  renderFamily,
  renderStateCoverage,
  stateArgsForBinding,
  stateCoverageForBinding,
  storyArgsForBinding,
} from '../src/storybook-factory.mjs';

const appRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(appRoot, '../..');
const packageRequire = createRequire(resolve(repositoryRoot, 'packages/react/package.json'));
const { JSDOM } = packageRequire('jsdom');
const descriptor = JSON.parse(await readFile(resolve(repositoryRoot, 'packages/react/generated/descriptor.json'), 'utf8'));
const snapshot = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json'), 'utf8'));

function generatedBody(source, fileName) {
  const match = source.match(
    /^\/\/ @generated-from: ([^\n]+)\n\/\/ @generated-content-sha256: (sha256:[a-f0-9]{64})\n([\s\S]+)$/u,
  );
  assert.ok(match, `${fileName} must include the standard generated markers`);
  const [, generatedFrom, digest, body] = match;
  assert.equal(generatedFrom, 'apps/react-storybook/src/generate-stories.mjs', fileName);
  assert.equal(digest, `sha256:${createHash('sha256').update(body).digest('hex')}`, fileName);
  return body;
}

const manifestSource = await readFile(resolve(appRoot, '.storybook/generated/manifest.mjs'), 'utf8');
generatedBody(manifestSource, 'manifest.mjs');
const { default: manifest } = await import('../.storybook/generated/manifest.mjs');

function installRuntimeDom() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  dom.window.ResizeObserver = ResizeObserverMock;
  dom.window.CSS ??= { escape: (value) => String(value) };
  dom.window.matchMedia ??= () => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
  dom.window.PointerEvent ??= dom.window.MouseEvent;
  dom.window.requestAnimationFrame ??= (callback) => dom.window.setTimeout(callback, 16);
  dom.window.cancelAnimationFrame ??= (handle) => dom.window.clearTimeout(handle);
  const globals = [
    'window', 'document', 'Document', 'DocumentFragment', 'Element', 'HTMLElement', 'HTMLButtonElement',
    'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLDivElement', 'SVGElement', 'Node',
    'NodeFilter', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'PointerEvent',
    'MutationObserver', 'File', 'Blob', 'FileReader', 'DOMRect', 'ResizeObserver', 'CSS', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame',
  ];
  const previous = new Map(globals.map((name) => [name, globalThis[name]]));
  for (const name of globals) {
    if (dom.window[name] !== undefined) globalThis[name] = dom.window[name];
  }
  const elementPrototype = dom.window.HTMLElement.prototype;
  const previousAttachEvent = elementPrototype.attachEvent;
  const previousDetachEvent = elementPrototype.detachEvent;
  elementPrototype.attachEvent ??= () => {};
  elementPrototype.detachEvent ??= () => {};
  const previousGetAnimations = elementPrototype.getAnimations;
  const previousCSSTransition = globalThis.CSSTransition;
  const pendingAnimations = new Set();
  class AnimationMock {
    constructor() {
      this.finished = new Promise((resolvePromise) => pendingAnimations.add(resolvePromise));
    }

    cancel() {}
  }
  elementPrototype.getAnimations = function getAnimations() {
    return [new AnimationMock()];
  };
  globalThis.CSSTransition = AnimationMock;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return {
    dom,
    resolveAnimations() {
      for (const resolvePromise of pendingAnimations) resolvePromise();
      pendingAnimations.clear();
    },
    restore() {
      for (const [name, value] of previous) {
        if (value === undefined) delete globalThis[name];
        else globalThis[name] = value;
      }
      if (previousGetAnimations === undefined) delete elementPrototype.getAnimations;
      else elementPrototype.getAnimations = previousGetAnimations;
      if (previousAttachEvent === undefined) delete elementPrototype.attachEvent;
      else elementPrototype.attachEvent = previousAttachEvent;
      if (previousDetachEvent === undefined) delete elementPrototype.detachEvent;
      else elementPrototype.detachEvent = previousDetachEvent;
      if (previousCSSTransition === undefined) delete globalThis.CSSTransition;
      else globalThis.CSSTransition = previousCSSTransition;
      dom.window.close();
    },
  };
}

test('private host and exact Core React family projection', async () => {
  const packageManifest = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8'));
  assert.equal(packageManifest.private, true);
  assert.equal(manifest.schema, 'core-ui-react-storybook-manifest-v1');
  assert.equal(manifest.count, 53);
  assert.deepEqual(manifest.families.map(({ family }) => family), descriptor.bindings.map(({ export: name }) => name));
  assert.equal(new Set(manifest.families.map(({ family }) => family)).size, 53);
  assert.deepEqual(adapterNames.slice().sort(), descriptor.bindings.map(({ export: name }) => name).sort());
  assert.deepEqual(manifest.families.map(({ family }) => family).sort(), snapshot.families.map(({ corePublicFamily }) => corePublicFamily).sort());
});

test('uses standard generation scripts and check mode preserves drift for diagnosis', async () => {
  const packageManifest = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8'));
  assert.equal(packageManifest.scripts.generate, 'node src/generate-stories.mjs');
  assert.equal(packageManifest.scripts['generate:check'], 'node src/generate-stories.mjs --check');
  assert.equal(packageManifest.scripts.storybook, 'pnpm generate && storybook dev -p 6006');
  assert.equal(packageManifest.scripts.build, 'pnpm generate && storybook build --output-dir dist');
  assert.equal(packageManifest.scripts.check, 'pnpm generate:check && node --test test/*.test.mjs');

  const storyPath = resolve(appRoot, '.storybook/generated/r1-1-button.stories.mjs');
  const original = await readFile(storyPath, 'utf8');
  const drifted = `${original}\n// temporary drift\n`;
  await writeFile(storyPath, drifted, 'utf8');
  try {
    const result = spawnSync(
      process.execPath,
      [resolve(appRoot, 'src/generate-stories.mjs'), '--check'],
      { cwd: appRoot, encoding: 'utf8' },
    );
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /generated output drift in/u);
    assert.equal(await readFile(storyPath, 'utf8'), drifted);
  } finally {
    await writeFile(storyPath, original, 'utf8');
  }
});

test('every story exposes exactly its canonical Core-owned properties', () => {
  const byFamily = new Map(descriptor.bindings.map((binding) => [binding.export, binding]));
  for (const record of manifest.families) {
    const binding = byFamily.get(record.family);
    assert.ok(binding, `unknown manifest family ${record.family}`);
    assert.deepEqual(Object.keys(argTypesForBinding(binding)).sort(), binding.api.props.slice().sort(), record.family);
    assert.deepEqual(record.props, binding.api.props, record.family);
    assert.equal(record.tranche, snapshot.families.find(({ corePublicFamily }) => corePublicFamily === record.family).tranche, record.family);
  }
});

test('control inference and composition adapters preserve canonical values', () => {
  const textFieldBinding = descriptor.bindings.find(({ export: name }) => name === 'TextField');
  const textFieldArgTypes = argTypesForBinding(textFieldBinding);
  for (const name of ['label', 'aria-label', 'value', 'defaultValue', 'name', 'placeholder']) {
    assert.equal(textFieldArgTypes[name].control, 'text', name);
  }

  const comboBoxBinding = descriptor.bindings.find(({ export: name }) => name === 'ComboBox');
  assert.equal(argTypesForBinding(comboBoxBinding).items.control, 'object');
  const numberFieldBinding = descriptor.bindings.find(({ export: name }) => name === 'NumberField');
  assert.equal(argTypesForBinding(numberFieldBinding).value.control.type, 'number');
  assert.equal(argTypesForBinding(numberFieldBinding).minValue.control.type, 'number');
  const dialogBinding = descriptor.bindings.find(({ export: name }) => name === 'Dialog');
  assert.equal(argTypesForBinding(dialogBinding).title.control, 'text');
  assert.equal(argTypesForBinding(dialogBinding).children.control, 'text');
  assert.deepEqual(
    argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Popover')).placement.options,
    ['top', 'bottom', 'start', 'end'],
  );
  assert.deepEqual(
    argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Toast')).variant.options,
    ['neutral', 'success', 'warning', 'danger'],
  );
  assert.equal(argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Popover')).placement.options.includes('left'), false);
  assert.equal(argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Popover')).placement.options.includes('right'), false);
  assert.equal(argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Toast')).variant.options.includes('info'), false);
  assert.equal(argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Toast')).variant.options.includes('error'), false);
  assert.deepEqual(
    argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'FileTrigger')).defaultCamera.options,
    ['user', 'environment'],
  );
  assert.equal(
    argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'FileTrigger')).defaultCamera.options.includes('front'),
    false,
  );
  assert.deepEqual(
    argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Group')).role.options,
    ['group', 'region', 'presentation'],
  );
  assert.equal(
    argTypesForBinding(descriptor.bindings.find(({ export: name }) => name === 'Group')).role.options.includes('textbox'),
    false,
  );
  const tooltipBinding = descriptor.bindings.find(({ export: name }) => name === 'Tooltip');
  assert.equal(argTypesForBinding(tooltipBinding).content.control, 'text');
  for (const name of ['Dialog', 'Popover', 'PreviewTrigger', 'Tooltip']) {
    const trigger = argTypesForBinding(descriptor.bindings.find(({ export: family }) => family === name)).trigger;
    assert.equal(trigger.control, false, name);
    assert.equal(trigger.table.type.summary, 'React element', name);
  }
  const textField = renderFamily('TextField', {
    label: 'Email',
    value: 'hello@example.com',
    name: 'email',
    placeholder: 'Email address',
  });
  assert.equal(textField.props.label, 'Email');
  assert.equal(textField.props.value, 'hello@example.com');
  assert.equal(textField.props.name, 'email');
  assert.equal(textField.props.placeholder, 'Email address');

  const trigger = React.createElement('button', null, 'Custom trigger');
  const content = React.createElement('p', null, 'Custom content');
  for (const family of ['Dialog', 'Popover', 'PreviewTrigger']) {
    const rendered = renderFamily(family, { trigger, children: content, title: 'Custom title' });
    assert.strictEqual(rendered.props.trigger, trigger, family);
    assert.strictEqual(rendered.props.children, content, family);
    if (family === 'Dialog') assert.equal(rendered.props.title, 'Custom title');
  }
  const tooltip = renderFamily('Tooltip', { trigger, content: 'Custom tooltip' });
  assert.strictEqual(tooltip.props.trigger, trigger);
  assert.equal(tooltip.props.content, 'Custom tooltip');
  assert.equal(renderFamily('DropZone', { children: 'Custom drop target' }).props.children, 'Custom drop target');
  assert.strictEqual(renderFamily('FileTrigger', { children: trigger }).props.children, trigger);
});

test('default and state stories use uncontrolled pairs without collapsing state variants', () => {
  const pairs = [
    ['checked', 'defaultChecked'],
    ['expanded', 'defaultExpanded'],
    ['expandedIds', 'defaultExpandedIds'],
    ['open', 'defaultOpen'],
    ['selected', 'defaultSelected'],
    ['selectedId', 'defaultSelectedId'],
    ['selectedIds', 'defaultSelectedIds'],
    ['value', 'defaultValue'],
  ];
  const bindings = new Map(descriptor.bindings.map((binding) => [binding.export, binding]));
  for (const family of ['Checkbox', 'Disclosure', 'DisclosureGroup', 'ToggleButton', 'Autocomplete', 'Switch']) {
    const binding = bindings.get(family);
    const defaultArgs = storyArgsForBinding(binding, 'default', family);
    const stateArgs = storyArgsForBinding(binding, 'states', family);
    for (const [controlled, uncontrolled] of pairs) {
      if (!binding.api.props.includes(controlled) || !binding.api.props.includes(uncontrolled)) continue;
      assert.equal(defaultArgs[controlled], undefined, `${family} default ${controlled}`);
      assert.notEqual(defaultArgs[uncontrolled], undefined, `${family} default ${uncontrolled}`);
      assert.equal(stateArgs[controlled], undefined, `${family} states ${controlled}`);
      assert.notEqual(stateArgs[uncontrolled], undefined, `${family} states ${uncontrolled}`);
    }
  }

  assert.equal(stateArgsForBinding(bindings.get('Checkbox'), 'selected', 'Checkbox').checked, true);
  assert.equal(stateArgsForBinding(bindings.get('Disclosure'), 'expanded', 'Disclosure').expanded, true);
  assert.deepEqual(
    stateArgsForBinding(bindings.get('DisclosureGroup'), 'expanded', 'DisclosureGroup').expandedIds,
    ['one'],
  );
  assert.equal(stateArgsForBinding(bindings.get('ToggleButton'), 'selected', 'ToggleButton').selected, true);
  assert.equal(stateArgsForBinding(bindings.get('Switch'), 'selected', 'Switch').selected, true);
  assert.equal(storyArgsForBinding(bindings.get('Autocomplete'), 'default', 'Autocomplete').defaultValue, '');
});

test('state coverage metadata exposes isolated supported states with canonical args', () => {
  const byFamily = new Map(descriptor.bindings.map((binding) => [binding.export, binding]));
  const comparableCoverage = (coverage) => coverage.map(({ name, args }) => ({
    name,
    args: Object.fromEntries(Object.entries(args).map(([prop, value]) => [prop, typeof value === 'function' ? '[callback]' : value])),
  }));
  for (const record of manifest.families) {
    const binding = byFamily.get(record.family);
    const coverage = stateCoverageForBinding(binding, record.family);
    assert.ok(coverage.length >= record.states.length, record.family);
    assert.deepEqual(coverage.slice(0, record.states.length).map(({ name }) => name), record.states, record.family);
    for (const { name, args } of coverage) {
      assert.ok(Object.keys(args).every((prop) => binding.api.props.includes(prop)
        || record.family === 'TagGroup' && name === 'removable' && prop === 'onRemove'), `${record.family}/${name} leaked a non-Core prop`);
    }
    const story = createStory({ family: record.family, tranche: record.tranche, binding }, 'states');
    assert.deepEqual(comparableCoverage(story.parameters.coreStateCoverage), comparableCoverage(coverage), `${record.family} metadata`);
    assert.deepEqual(Object.keys(story.argTypes).sort(), binding.api.props.slice().sort(), `${record.family} controls`);
  }

  const binding = (family) => byFamily.get(family);
  assert.equal(stateArgsForBinding(binding('Button'), 'pending', 'Button').pending, true);
  assert.equal(stateArgsForBinding(binding('Button'), 'pending', 'Button').disabled, false);
  assert.equal(stateArgsForBinding(binding('Checkbox'), 'disabled', 'Checkbox').disabled, true);
  assert.equal(stateArgsForBinding(binding('Checkbox'), 'disabled', 'Checkbox').invalid, false);
  assert.equal(stateArgsForBinding(binding('Checkbox'), 'invalid', 'Checkbox').invalid, true);
  assert.equal(stateArgsForBinding(binding('Checkbox'), 'indeterminate', 'Checkbox').indeterminate, true);
  assert.equal(stateArgsForBinding(binding('TextField'), 'readonly', 'TextField').readOnly, true);
  assert.equal(stateArgsForBinding(binding('Disclosure'), 'expanded', 'Disclosure').expanded, true);
  assert.equal(stateArgsForBinding(binding('Dialog'), 'open', 'Dialog').open, true);
  assert.equal(stateArgsForBinding(binding('DropZone'), 'drop-target', 'DropZone').disabled, false);
  assert.equal(stateArgsForBinding(binding('DropZone'), 'dragging', 'DropZone').disabled, false);
  assert.equal(stateArgsForBinding(binding('Popover'), 'placement', 'Popover').placement, 'top');
  assert.equal(stateArgsForBinding(binding('Popover'), 'entering', 'Popover').open, true);
  assert.equal(stateArgsForBinding(binding('Popover'), 'exiting', 'Popover').open, false);

  const rendered = renderStateCoverage({ family: 'Button', tranche: 'R1.1', binding: binding('Button') });
  assert.equal(rendered.type, 'div');
  assert.equal(rendered.props.className, 'core-storybook-states');
  assert.equal(rendered.props.children.length, binding('Button').states.length);
});

test('unsupported state coverage is explicit while supported state args remain observable', () => {
  const byFamily = new Map(descriptor.bindings.map((binding) => [binding.export, binding]));
  const unsupportedStates = [
    ['Link', 'pressed'],
    ['ToggleButton', 'pressed'],
    ['Form', 'submitting'],
    ['Form', 'invalid'],
    ['ColorArea', 'invalid'],
    ['ColorSlider', 'read-only'],
    ['ColorWheel', 'read-only'],
    ['Slider', 'read-only'],
    ['Slider', 'selected'],
    ['TokenField', 'invalid'],
    ['Menu', 'open'],
  ];
  for (const [family, state] of unsupportedStates) {
    const binding = byFamily.get(family);
    const markup = renderToStaticMarkup(renderStateCoverage({ family, tranche: 'R1.5', binding }));
    const dom = new JSDOM(`<!doctype html>${markup}`);
    const section = [...dom.window.document.querySelectorAll('.core-storybook-state')]
      .find((candidate) => candidate.querySelector('h3')?.textContent === state);
    assert.ok(section, `${family}/${state} section`);
    const stateBody = section.querySelector('[data-core-storybook-state="unavailable"]');
    assert.ok(stateBody, `${family}/${state}`);
    assert.match(stateBody.textContent, /Unavailable:/u, `${family}/${state}`);
    dom.window.close();
  }

  const link = renderToStaticMarkup(renderFamily('Link', stateArgsForBinding(byFamily.get('Link'), 'current', 'Link')));
  assert.match(link, /aria-current="page"/u);
  const toggle = renderToStaticMarkup(renderFamily('ToggleButton', stateArgsForBinding(byFamily.get('ToggleButton'), 'selected', 'ToggleButton')));
  assert.match(toggle, /aria-pressed="true"/u);
});

test('behavior-only state evidence executes the focused Core interactions', async () => {
  const env = installRuntimeDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  const settle = async (milliseconds = 0) => {
    if (milliseconds > 0) await act(async () => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)));
  };
  try {
    let linkActivations = 0;
    await act(async () => root.render(renderFamily('Link', { href: '#', onActivate: () => { linkActivations += 1; } })));
    const link = host.querySelector('.core-link');
    assert.ok(link, 'Link behavior target');
    await act(async () => link.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })));
    assert.equal(link.hasAttribute('data-pressed'), true, 'Link exposes the pressed interaction state');
    await act(async () => link.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })));
    await act(async () => link.click());
    assert.equal(linkActivations, 1, 'Link activation callback');

    let toggleActivations = 0;
    await act(async () => root.render(renderFamily('ToggleButton', { onActivate: () => { toggleActivations += 1; } })));
    const toggle = host.querySelector('.core-toggle-button');
    assert.ok(toggle, 'ToggleButton behavior target');
    await act(async () => toggle.click());
    assert.equal(toggle.getAttribute('aria-pressed'), 'true', 'ToggleButton pressed state');
    assert.equal(toggleActivations, 1, 'ToggleButton activation callback');

    let formSubmissions = 0;
    await act(async () => root.render(renderFamily('Form', { onSubmit: () => { formSubmissions += 1; } })));
    const form = host.querySelector('.core-form');
    assert.ok(form, 'Form behavior target');
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(formSubmissions, 1, 'Form submit callback');

    const dialogDismissals = [];
    await act(async () => root.render(renderFamily('Dialog', { open: true, title: 'Delete draft', onOpenChange: (open) => dialogDismissals.push(open) })));
    await settle(20);
    const dialogClose = document.querySelector('.core-dialog-close');
    assert.ok(dialogClose, 'Dialog dismiss target');
    await act(async () => dialogClose.click());
    assert.deepEqual(dialogDismissals, [false], 'Dialog dismissal callback');

    const popoverDismissals = [];
    await act(async () => root.render(renderFamily('Popover', { open: true, onOpenChange: (open) => popoverDismissals.push(open) })));
    await settle(20);
    const popoverTrigger = host.querySelector('.core-button');
    assert.ok(document.querySelector('.core-popover'), 'Popover behavior target');
    await act(async () => popoverTrigger.click());
    assert.deepEqual(popoverDismissals, [false], 'Popover dismissal callback');

    let toastDismissals = 0;
    await act(async () => root.render(React.createElement(ToastProvider, null, renderFamily('Toast', { onDismiss: () => { toastDismissals += 1; } }))));
    await settle(100);
    const toastClose = document.querySelector('.core-toast-dismiss');
    assert.ok(toastClose, 'Toast dismiss target');
    await act(async () => toastClose.click());
    await settle(40);
    assert.equal(toastDismissals, 1, 'Toast dismissal callback');
    assert.equal(document.querySelector('.core-toast'), null, 'Toast leaves the DOM after dismissal');
  } finally {
    await act(async () => root.unmount());
    env.resolveAnimations();
    env.restore();
  }
});

test('interaction-open coverage opens the public field and collection triggers', async () => {
  const bindings = new Map(descriptor.bindings.map((binding) => [binding.export, binding]));
  const families = [
    ['DatePicker', '.core-date-popover', '.core-date-trigger'],
    ['DateRangePicker', '.core-date-popover', '.core-date-trigger'],
    ['ComboBox', '.core-combo-box-popover', '.core-combo-box-trigger'],
    ['Select', '.core-select-popover', '.core-select-trigger'],
  ];
  for (const [family, overlaySelector, triggerSelector] of families) {
    const env = installRuntimeDom();
    const host = document.querySelector('#root');
    const root = createRoot(host);
    try {
      const binding = bindings.get(family);
      const record = { family, tranche: 'R1.2', binding };
      await act(async () => root.render(React.createElement(React.StrictMode, null, renderStateCoverage(record))));
      await act(async () => new Promise((resolvePromise) => setTimeout(resolvePromise, 50)));

      const section = [...host.querySelectorAll('.core-storybook-state')]
        .find((candidate) => candidate.querySelector('h3')?.textContent === 'open');
      assert.ok(section, `${family}/open section`);
      assert.equal(section.querySelector('[data-core-storybook-state="unavailable"]'), null, `${family}/open should be supported`);
      const trigger = section.querySelector(triggerSelector);
      assert.ok(trigger, `${family}/open trigger`);
      assert.equal(trigger.getAttribute('aria-expanded'), 'true', `${family}/open trigger state`);
      const overlay = document.querySelector(`${overlaySelector}:not([hidden])`);
      assert.ok(overlay, `${family}/open overlay`);
    } finally {
      if (host.isConnected && host.hasChildNodes()) await act(async () => root.unmount());
      env.restore();
    }
  }
});

function markerForTest(family, state) {
  return `core-storybook-lifecycle-${family}-${state}`.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function isInspectableOverlay(marker) {
  const target = document.querySelector(`.${marker}`);
  if (!target?.isConnected) return false;
  for (let element = target; element; element = element.parentElement) {
    if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('inert')) return false;
  }
  const style = getComputedStyle(target);
  return style.visibility !== 'hidden' && style.opacity !== '0';
}

test('lifecycle state coverage drives observable Core transitions', async () => {
  const env = installRuntimeDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  const bindings = new Map(descriptor.bindings.map((binding) => [binding.export, binding]));
  const lifecycleAttributes = {
    entering: 'data-entering',
    opening: 'data-entering',
    exiting: 'data-exiting',
    closing: 'data-exiting',
  };
  const families = ['Dialog', 'Popover', 'PreviewTrigger', 'Toast', 'Tooltip'];
  try {
    for (const family of families) {
      const binding = bindings.get(family);
      const coverage = renderStateCoverage({
        family,
        tranche: manifest.families.find((record) => record.family === family).tranche,
        binding,
      });
      const transitionHistory = [];
      const racLifecycleRecords = [];
      const lifecycleStates = stateCoverageForBinding(binding, family)
        .map(({ name }) => name)
        .filter((name) => lifecycleAttributes[name]);
      const transitionObserver = new MutationObserver((records) => {
        for (const { target, attributeName, oldValue } of records) {
          if (attributeName !== 'data-core-storybook-transition') continue;
          transitionHistory.push({ oldValue, newValue: target.getAttribute(attributeName) });
        }
      });
      const recordRacAttribute = (target, attributeName) => {
        const markedOverlay = target.matches('[class*="core-storybook-lifecycle-"]')
          ? target
          : target.querySelector('[class*="core-storybook-lifecycle-"]');
        if (markedOverlay) racLifecycleRecords.push({ marker: markedOverlay.className, attributeName });
      };
      const racObserver = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === 'attributes') {
            if (record.attributeName === 'data-entering' || record.attributeName === 'data-exiting') {
              recordRacAttribute(record.target, record.attributeName);
            }
            continue;
          }
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            for (const attributeName of ['data-entering', 'data-exiting']) {
              if (node.matches(`[${attributeName}]`)) recordRacAttribute(node, attributeName);
              for (const target of node.querySelectorAll(`[${attributeName}]`)) {
                recordRacAttribute(target, attributeName);
              }
            }
          }
        }
      });
      transitionObserver.observe(host, { attributes: true, attributeOldValue: true, subtree: true });
      racObserver.observe(document.body, { attributes: true, subtree: true });
      await act(async () => root.render(React.createElement(ToastProvider, null, coverage)));
      assert.ok(lifecycleStates.length > 0, `${family} has lifecycle coverage`);
      const lifecycleSelect = document.querySelector(`[data-core-storybook-lifecycle-select="${family}"]`);
      assert.ok(lifecycleSelect, `${family} lifecycle selector`);
      for (const state of lifecycleStates) {
        const marker = markerForTest(family, state);
        const alternateState = lifecycleStates.find((candidate) => candidate !== state);
        assert.ok(alternateState, `${family}/${state} has a reset state`);
        await act(async () => {
          lifecycleSelect.value = alternateState;
          lifecycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const transitionStart = transitionHistory.length;
        const racStart = racLifecycleRecords.length;
        await act(async () => {
          lifecycleSelect.value = state;
          lifecycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const initialOverlayState = isInspectableOverlay(marker);
        const overlayHistory = [initialOverlayState];
        const recordCurrentRacAttributes = () => {
          const target = document.querySelector(`.${marker}`);
          if (!target) return;
          for (const attributeName of ['data-entering', 'data-exiting']) {
            for (let element = target; element; element = element.parentElement) {
              if (element.hasAttribute(attributeName)) racLifecycleRecords.push({ marker: target.className, attributeName });
            }
            for (const element of target.querySelectorAll(`[${attributeName}]`)) {
              racLifecycleRecords.push({ marker: target.className, attributeName });
            }
          }
        };
        recordCurrentRacAttributes();
        for (let tick = 0; tick < 35; tick += 1) {
          await act(async () => new Promise((resolvePromise) => setTimeout(resolvePromise, 25)));
          overlayHistory.push(isInspectableOverlay(marker));
          recordCurrentRacAttributes();
        }
        const section = document.querySelector(`[data-core-storybook-lifecycle="${state}"]`);
        assert.ok(section, `${family}/${state} section`);
        const overlay = document.querySelector(`.${marker}`);
        assert.ok(overlay, `${family}/${state} overlay`);
        const closing = state === 'closing' || state === 'exiting';
        const expectedPhaseStart = closing ? 'open' : 'closed';
        const presence = overlayHistory;
        assert.equal(initialOverlayState, closing, `${family}/${state} initial overlay visibility`);
        assert.equal(presence.at(-1), true, `${family}/${state} settled overlay visibility (${presence.join(',')})`);
        const transitionRecords = transitionHistory.slice(transitionStart);
        const racRecords = racLifecycleRecords.slice(racStart);
        assert.equal(
          transitionRecords.some(({ oldValue }) => oldValue === expectedPhaseStart),
          true,
          `${family}/${state} transition phase (${transitionRecords.map(({ oldValue, newValue }) => `${oldValue}->${newValue}`).join(', ')})`,
        );
        if (closing) {
          if (family === 'Toast') {
            const firstVisible = presence.findIndex(Boolean);
            const removedAfterVisible = presence.findIndex((visible, index) => index > firstVisible && !visible);
            const visibleAgain = presence.findIndex((visible, index) => index > removedAfterVisible && visible);
            assert.ok(firstVisible >= 0 && removedAfterVisible >= 0 && visibleAgain >= 0,
              `${family}/${state} RAC queue close/reopen (${presence.join(',')})`);
          } else if (family === 'PreviewTrigger') {
            // RAC intentionally skips exit animations while preview warmup/cooldown
            // swaps are active, so its observable contract is removal and reopen.
            const firstVisible = presence.findIndex(Boolean);
            const removedAfterVisible = presence.findIndex((visible, index) => index > firstVisible && !visible);
            const visibleAgain = presence.findIndex((visible, index) => index > removedAfterVisible && visible);
            assert.ok(firstVisible >= 0 && removedAfterVisible >= 0 && visibleAgain >= 0,
              `${family}/${state} RAC preview close/reopen (${presence.join(',')})`);
          } else {
            assert.equal(
              racRecords.some(({ marker: recordMarker, attributeName }) => recordMarker.includes(marker)
                && attributeName === 'data-exiting'),
              true,
              `${family}/${state} RAC exit transition (${racRecords.map(({ marker: recordMarker, attributeName }) => `${attributeName}:${recordMarker}`).join(', ')})`,
            );
          }
        }
        assert.equal(section.querySelector('[data-core-storybook-transition="open"]')?.textContent, `${state}: open`);
      }
      transitionObserver.disconnect();
      racObserver.disconnect();
      env.resolveAnimations();
      await act(async () => root.render(null));
      host.replaceChildren();
    }
  } finally {
    env.resolveAnimations();
    if (host.isConnected && host.hasChildNodes()) await act(async () => root.unmount());
    env.restore();
  }
});

test('Breadcrumbs defaults show the adapter sample while explicit empty items stay empty', () => {
  const binding = descriptor.bindings.find(({ export: family }) => family === 'Breadcrumbs');
  const defaultArgs = storyArgsForBinding(binding, 'default', 'Breadcrumbs');
  assert.equal(defaultArgs.items, undefined);
  const defaultMarkup = renderToStaticMarkup(renderFamily('Breadcrumbs', defaultArgs));
  assert.match(defaultMarkup, /Home/u);
  assert.match(defaultMarkup, /Docs/u);

  const emptyMarkup = renderToStaticMarkup(renderFamily('Breadcrumbs', { ...defaultArgs, items: [] }));
  assert.doesNotMatch(emptyMarkup, /Home|Docs/u);
});

test('generated stories are stock CSF modules with default and state coverage', async () => {
  for (const record of manifest.families) {
    const slug = record.family.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    const tranche = record.tranche.replace('.', '-').toLowerCase();
    const fileName = `${tranche}-${slug}.stories.mjs`;
    const source = await readFile(resolve(appRoot, '.storybook/generated', fileName), 'utf8');
    const body = generatedBody(source, fileName);
    assert.match(body, /include: binding\.api\.props/);
    assert.match(body, /argTypesForBinding/);
    assert.match(body, /export const Default/);
    assert.match(body, /export const States/);
  }

  const buttonBinding = descriptor.bindings.find(({ export: name }) => name === 'Button');
  const buttonStory = await import('../.storybook/generated/r1-1-button.stories.mjs');
  assert.deepEqual(buttonStory.default.parameters.controls.include, buttonBinding.api.props);
});

test('showcase does not expose React Aria or Tale UI as a public import', async () => {
  const packageManifest = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8'));
  assert.equal(packageManifest.dependencies['@core-ui/react'], 'workspace:*');
  assert.equal(packageManifest.devDependencies['react-aria-components'], undefined);
  assert.equal(packageManifest.devDependencies['@tale-ui/react'], undefined);
  assert.equal(packageManifest.devDependencies['@storybook/addon-docs'], '10.5.10');
  const factory = await readFile(resolve(appRoot, 'src/storybook-factory.mjs'), 'utf8');
  assert.doesNotMatch(factory, /react-aria-components|@tale-ui/i);
  const main = await readFile(resolve(appRoot, '.storybook/main.mjs'), 'utf8');
  assert.match(main, /@storybook\/addon-docs/);
  assert.match(main, /reactDocgen: false/);
  const preview = await readFile(resolve(appRoot, '.storybook/preview.mjs'), 'utf8');
  assert.match(preview, /@core-ui\/react/);
  assert.doesNotMatch(preview, /react-aria-components|@tale-ui/);
});

test('preview exposes the Core light/dark host theme contract', async () => {
  const preview = await readFile(resolve(appRoot, '.storybook/preview.mjs'), 'utf8');
  const previewCss = await readFile(resolve(appRoot, '.storybook/preview.css'), 'utf8');

  assert.match(preview, /globalTypes/);
  assert.match(preview, /colorScheme/);
  assert.match(preview, /value: 'light'/);
  assert.match(preview, /value: 'dark'/);
  assert.match(preview, /document\.documentElement\.setAttribute\('data-core-color-scheme'/);
  assert.match(preview, /className: 'core-storybook-surface'/);
  assert.match(preview, /viewMode === 'story'/);
  assert.match(preview, /const surfaceElement = viewMode === 'story' \? 'main' : 'div'/);
  assert.match(preview, /React\.createElement\(\s*surfaceElement/u);
  assert.match(preview, /MutationObserver/);
  assert.match(preview, /observer\.observe\(document\.body, \{ childList: true \}\)/);
  assert.match(preview, /element\.style\.display === 'contents'/);
  assert.match(preview, /element\.hasAttribute\('data-overlay-container'\)/);
  assert.match(preview, /element\.classList\.contains\('core-dialog-backdrop'\)/);
  assert.match(preview, /element\.classList\.contains\('core-toast-region'\)/);
  assert.match(preview, /child\.setAttribute\('role', 'region'\)/);
  assert.match(preview, /child\.setAttribute\('aria-label', 'Core UI overlay'\)/);
  assert.match(preview, /element\.removeAttribute\('role'\)/);
  assert.match(preview, /element\.removeAttribute\('aria-label'\)/);
  assert.doesNotMatch(preview, /\.append\(/u);
  assert.match(preview, /'data-core-color-scheme': scheme/);
  assert.match(preview, /test: 'error'/);
  const packageManifest = JSON.parse(await readFile(resolve(appRoot, 'package.json'), 'utf8'));
  assert.equal(packageManifest.devDependencies['axe-core'], '4.13.0');
  assert.equal(packageManifest.devDependencies['playwright-core'], '1.62.1');

  assert.match(previewCss, /:root\[data-core-color-scheme='dark'\]/);
  assert.match(previewCss, /background: #000/);
  assert.match(previewCss, /color: #fff/);
  assert.match(previewCss, /font-family: ui-sans-serif, system-ui/);
  assert.doesNotMatch(previewCss, /Inter|@tale-ui|\.tale-/i);
});
