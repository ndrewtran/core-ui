import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { UNSTABLE_ToastQueue } from 'react-aria-components';
import {
  Dialog,
  DropZone,
  FileTrigger,
  Popover,
  PreviewTrigger,
  Toast,
  ToastProvider,
  Tooltip,
  useToast,
} from '../src/overlays.mjs';
import { EXPECTED_R14_COMPONENT_SLUGS, EXPECTED_R14_DONOR_CONTRACT } from '../src/r1-4-donor-contract.mjs';

function installDom(markup = '<div id="root"></div>') {
  const dom = new JSDOM(`<!doctype html>${markup}`, { url: 'http://localhost/' });
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  dom.window.ResizeObserver = ResizeObserverMock;
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
  dom.window.requestAnimationFrame ??= (callback) => dom.window.setTimeout(callback, 0);
  dom.window.cancelAnimationFrame ??= (handle) => dom.window.clearTimeout(handle);
  const keys = [
    'window', 'document', 'Document', 'DocumentFragment', 'Element', 'HTMLElement', 'HTMLButtonElement',
    'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLDivElement', 'SVGElement', 'Node', 'NodeFilter',
    'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'PointerEvent', 'MutationObserver',
    'File', 'Blob', 'FileReader', 'DOMRect', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  const previous = new Map(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) {
    if (dom.window[key] !== undefined) globalThis[key] = dom.window[key];
  }
  const previousCss = globalThis.CSS;
  globalThis.CSS ??= { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/gu, (character) => `\\${character}`) };
  const elementPrototype = dom.window.HTMLElement.prototype;
  const previousScrollTo = elementPrototype.scrollTo;
  const previousAttachEvent = elementPrototype.attachEvent;
  const previousDetachEvent = elementPrototype.detachEvent;
  elementPrototype.scrollTo ??= () => {};
  elementPrototype.attachEvent ??= () => {};
  elementPrototype.detachEvent ??= () => {};
  const hadActFlag = 'IS_REACT_ACT_ENVIRONMENT' in globalThis;
  const previousActFlag = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return {
    dom,
    restore() {
      for (const [key, value] of previous) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
      if (previousCss === undefined) delete globalThis.CSS;
      else globalThis.CSS = previousCss;
      if (previousScrollTo === undefined) delete elementPrototype.scrollTo;
      else elementPrototype.scrollTo = previousScrollTo;
      if (previousAttachEvent === undefined) delete elementPrototype.attachEvent;
      else elementPrototype.attachEvent = previousAttachEvent;
      if (previousDetachEvent === undefined) delete elementPrototype.detachEvent;
      else elementPrototype.detachEvent = previousDetachEvent;
      if (hadActFlag) globalThis.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
      else delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      dom.window.close();
    },
  };
}

function closedOverlayTree() {
  return React.createElement(ToastProvider, null,
    React.createElement('div', null,
      React.createElement(DropZone, { 'aria-label': 'Drop files' }),
      React.createElement(FileTrigger, null),
      React.createElement(Dialog, { title: 'Details', trigger: React.createElement('button', null, 'Open dialog') }, 'Dialog body'),
      React.createElement(Popover, { 'aria-label': 'Actions', trigger: React.createElement('button', null, 'Open actions') }, 'Popover body'),
      React.createElement(PreviewTrigger, { 'aria-label': 'Preview', trigger: React.createElement('button', null, 'Show preview') }, 'Preview body'),
      React.createElement(Tooltip, { content: 'Helpful text', trigger: React.createElement('button', null, 'Show help') }),
      React.createElement(Toast, { message: 'Queued after hydration' })));
}

test('R1.4 overlay owners use RAC lifecycle primitives and expose Core names only', async () => {
  const packageRoot = resolve(import.meta.dirname, '..');
  const source = await readFile(resolve(packageRoot, 'src/overlays.mjs'), 'utf8');
  const index = await readFile(resolve(packageRoot, 'generated/index.mjs'), 'utf8');
  const types = await readFile(resolve(packageRoot, 'generated/index.d.ts'), 'utf8');
  assert.match(source, /from 'react-aria-components'/u);
  assert.match(source, /AriaDropZone|AriaFileTrigger|AriaModalOverlay|AriaPopover|AriaPreviewTrigger|AriaTooltipTrigger|UNSTABLE_ToastRegion/u);
  assert.doesNotMatch(source, /createPortal|document\.addEventListener|window\.setTimeout|setInterval/u);
  assert.doesNotMatch(index, /export .*Modal\b|UNSTABLE_/u);
  assert.doesNotMatch(types, /react-aria-components|react-stately|UNSTABLE_/u);
  for (const name of ['DropZone', 'FileTrigger', 'Dialog', 'Popover', 'PreviewTrigger', 'Toast', 'ToastProvider', 'useToast', 'Tooltip']) assert.match(index, new RegExp(`\\b${name}\\b`));
  assert.deepEqual(EXPECTED_R14_COMPONENT_SLUGS, ['drop-zone', 'file-trigger', 'dialog', 'popover', 'preview-trigger', 'toast', 'tooltip']);
  assert.equal(EXPECTED_R14_DONOR_CONTRACT.dependency, false);
});

test('R1.4 families are SSR and hydration safe and reject missing accessible content', async () => {
  const server = renderToString(closedOverlayTree());
  assert.match(server, /core-drop-zone/u);
  assert.match(server, /core-file-trigger/u);
  assert.doesNotMatch(server, /core-dialog-backdrop|core-popover|core-preview-trigger|core-tooltip|core-toast/u);
  assert.throws(() => renderToString(React.createElement(Dialog, { title: ' ' })), /Dialog requires a title or accessible name/u);
  assert.throws(() => renderToString(React.createElement(Popover, { 'aria-label': ' ', trigger: React.createElement('button', null, 'Open') }, 'Body')), /Popover requires an accessible name/u);
  assert.throws(() => renderToString(React.createElement(PreviewTrigger, { trigger: React.createElement('button', null, 'Preview') }, 'Body')), /PreviewTrigger requires an accessible name/u);
  assert.throws(() => renderToString(React.createElement(Tooltip, { content: '', trigger: React.createElement('button', null, 'Help') })), /Tooltip requires content/u);
  assert.throws(() => renderToString(React.createElement(ToastProvider, null, React.createElement(Toast, { message: '' }))), /Toast requires a message/u);

  const env = installDom(`<div id="root">${server}</div>`);
  let root;
  try {
    await act(async () => { root = hydrateRoot(document.querySelector('#root'), closedOverlayTree()); });
    assert.match(document.body.textContent, /Queued after hydration/u);
    await act(async () => root.unmount());
    await Promise.resolve();
    assert.equal(document.querySelector('.core-toast'), null);
  } finally {
    env.restore();
  }
});

test('R1.4 label guards reject empty hosts, fragments, and arrays while preserving valid labels', () => {
  for (const empty of [React.createElement('span'), React.createElement(React.Fragment), []]) {
    assert.throws(() => renderToString(React.createElement(Dialog, { title: empty })), /Dialog requires a title or accessible name/u);
    assert.throws(() => renderToString(React.createElement(Tooltip, { content: empty, trigger: React.createElement('button', null, 'Help') })), /Tooltip requires content/u);
    assert.throws(() => renderToString(React.createElement(ToastProvider, null, React.createElement(Toast, { message: empty }))), /Toast requires a message/u);
  }
  assert.doesNotThrow(() => renderToString(React.createElement(Dialog, { title: 0 })));
  assert.doesNotThrow(() => renderToString(React.createElement(Dialog, { title: React.createElement('span', { 'aria-label': 'Details' }) })));
  function CustomTitle() { return React.createElement('span', null, 'Custom title'); }
  assert.doesNotThrow(() => renderToString(React.createElement(Dialog, { title: React.createElement(CustomTitle) })));
});

test('DropZone and FileTrigger normalize browser inputs to Core-owned values', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  const drops = [];
  const selections = [];
  try {
    await act(async () => root.render(React.createElement(DropZone, { 'aria-label': 'Upload', onDrop: (event) => drops.push(event) }, 'Drop here')));
    const pasteTarget = host.querySelector('.core-drop-zone button');
    await act(async () => pasteTarget.focus());
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        types: ['text/plain'],
        items: [{ kind: 'string', type: 'text/plain' }],
        getData: (type) => type === 'text/plain' ? 'Core clipboard text' : '',
      },
    });
    await act(async () => document.dispatchEvent(pasteEvent));
    assert.equal(drops.length, 1);
    assert.notEqual(drops[0], pasteEvent);
    assert.deepEqual(Object.keys(drops[0]).sort(), ['dropOperation', 'items', 'type', 'x', 'y']);
    assert.deepEqual({ type: drops[0].type, x: drops[0].x, y: drops[0].y, dropOperation: drops[0].dropOperation }, { type: 'drop', x: 0, y: 0, dropOperation: 'copy' });
    assert.equal(drops[0].items[0].kind, 'text');
    assert.deepEqual([...drops[0].items[0].types], ['text/plain']);
    assert.equal(await drops[0].items[0].getText('text/plain'), 'Core clipboard text');

    await act(async () => root.render(React.createElement(FileTrigger, {
      acceptedFileTypes: ['.txt', 'text/plain'],
      allowsMultiple: true,
      acceptDirectory: true,
      onSelect: (files) => selections.push(files),
    }, 'Choose files')));
    const input = host.querySelector('input[type="file"]');
    assert.equal(input.getAttribute('accept'), '.txt,text/plain');
    assert.equal(input.multiple, true);
    assert.equal(input.getAttribute('webkitdirectory'), '');
    assert.ok(host.querySelector('.core-file-trigger'));
    const file = new File(['fixture'], 'fixture.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    Object.defineProperty(input, 'files', { configurable: true, value: null });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    assert.equal(Array.isArray(selections[0]), true);
    assert.deepEqual(selections[0], [file]);
    assert.deepEqual(selections[1], []);
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test('Popover dismissable false prevents Escape and outside-press dismissal', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(Popover, {
      'aria-label': 'Actions',
      trigger: React.createElement('button', null, 'Open actions'),
      defaultOpen: true,
      dismissable: false,
    }, 'Popover body')));
    const popover = document.body.querySelector('.core-popover');
    assert.ok(popover);

    await act(async () => {
      popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    assert.ok(document.body.querySelector('.core-popover'));

    await act(async () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    assert.ok(document.body.querySelector('.core-popover'));
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test('ToastProvider pauses auto-dismiss timers before clearing on teardown', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  const originalPauseAll = UNSTABLE_ToastQueue.prototype.pauseAll;
  const originalClear = UNSTABLE_ToastQueue.prototype.clear;
  const calls = [];
  UNSTABLE_ToastQueue.prototype.pauseAll = function pauseAll(...args) {
    calls.push('pauseAll');
    return originalPauseAll.apply(this, args);
  };
  UNSTABLE_ToastQueue.prototype.clear = function clear(...args) {
    calls.push('clear');
    return originalClear.apply(this, args);
  };
  let manager;
  function CaptureManager() {
    manager = useToast();
    return null;
  }
  try {
    await act(async () => root.render(React.createElement(ToastProvider, null, React.createElement(CaptureManager))));
    await act(async () => manager.add('Pending teardown', { duration: 60000 }));
    assert.ok(document.body.querySelector('.core-toast'));
    await act(async () => root.unmount());
    await Promise.resolve();
    assert.deepEqual(calls.slice(-2), ['pauseAll', 'clear']);
  } finally {
    UNSTABLE_ToastQueue.prototype.pauseAll = originalPauseAll;
    UNSTABLE_ToastQueue.prototype.clear = originalClear;
    if (host.isConnected && host.hasChildNodes()) await act(async () => root.unmount());
    env.restore();
  }
});

test('ToastProvider normalizes zero maxVisible so toasts still auto-dismiss', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  let manager;
  let dismissed = 0;
  function CaptureManager() {
    manager = useToast();
    return null;
  }
  try {
    await act(async () => root.render(React.createElement(ToastProvider, { maxVisible: 0 }, React.createElement(CaptureManager))));
    await act(async () => manager.add('Visible toast', { duration: 25, onDismiss: () => { dismissed += 1; } }));
    assert.ok(document.body.querySelector('.core-toast'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    assert.equal(dismissed, 1);
    assert.equal(document.body.querySelector('.core-toast'), null);
  } finally {
    if (host.isConnected && host.hasChildNodes()) await act(async () => root.unmount());
    env.restore();
  }
});

test('title-less useToast notifications have an accessible RAC name', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  let manager;
  function CaptureManager() {
    manager = useToast();
    return null;
  }
  try {
    await act(async () => root.render(React.createElement(ToastProvider, null, React.createElement(CaptureManager))));
    await act(async () => manager.add('Saved', { duration: 60000 }));
    const toast = document.body.querySelector('.core-toast');
    assert.ok(toast);
    assert.equal(toast.getAttribute('role'), 'alertdialog');
    const labelledBy = toast.getAttribute('aria-labelledby');
    assert.ok(labelledBy);
    const title = document.getElementById(labelledBy);
    assert.ok(title);
    assert.equal(title.classList.contains('core-toast-title-fallback'), true);
    assert.equal(title.textContent, 'Notification');
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test('declarative Toast teardown cancels its timer and settles onDismiss once', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const activeTimers = new Set();
  globalThis.setTimeout = (...args) => {
    const handle = originalSetTimeout(...args);
    activeTimers.add(handle);
    return handle;
  };
  globalThis.clearTimeout = (handle) => {
    activeTimers.delete(handle);
    return originalClearTimeout(handle);
  };
  let dismissed = 0;
  try {
    await act(async () => root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(ToastProvider, null,
          React.createElement(Toast, { message: 'Declarative toast', duration: 60000, onDismiss: () => { dismissed += 1; } }))
      )
    ));
    await Promise.resolve();
    assert.equal(dismissed, 0);
    assert.equal(activeTimers.size, 1);
    const toast = document.body.querySelector('.core-toast');
    assert.ok(toast);
    assert.equal(toast.getAttribute('role'), 'alertdialog');
    const labelledBy = toast.getAttribute('aria-labelledby');
    assert.ok(labelledBy);
    const title = document.getElementById(labelledBy);
    assert.ok(title);
    assert.equal(title.classList.contains('core-toast-title-fallback'), true);
    assert.equal(title.textContent, 'Notification');

    await act(async () => root.unmount());
    await Promise.resolve();
    assert.equal(activeTimers.size, 0);
    assert.equal(dismissed, 1);
    assert.equal(document.body.querySelector('.core-toast'), null);
  } finally {
    for (const handle of activeTimers) originalClearTimeout(handle);
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (host.isConnected && host.hasChildNodes()) await act(async () => root.unmount());
    env.restore();
  }
});

test('Toast keeps one stable Core manager and settles dismissal callbacks once', async () => {
  const env = installDom();
  const host = document.querySelector('#root');
  const root = createRoot(host);
  let manager;
  function CaptureManager() {
    manager = useToast();
    return null;
  }
  let dismissed = 0;
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(ToastProvider, null, React.createElement(CaptureManager)))));
    await Promise.resolve();
    assert.ok(manager);
    assert.throws(() => manager.add('   '), /Toast requires a message/u);
    let firstKey;
    await act(async () => { firstKey = manager.add('Saved', { title: 'Complete', duration: 60000, onDismiss: () => { dismissed += 1; } }); });
    const toast = document.body.querySelector('.core-toast');
    assert.ok(toast);
    assert.equal(toast.getAttribute('role'), 'alertdialog');
    assert.match(toast.textContent, /Complete.*Saved/u);
    assert.ok(toast.querySelector('[role="alert"]'));
    await act(async () => manager.remove(firstKey));
    await act(async () => manager.remove(firstKey));
    assert.equal(dismissed, 1);

    await act(async () => { manager.add('Pending teardown', { duration: 60000, onDismiss: () => { dismissed += 1; } }); });
    await act(async () => { root.unmount(); await Promise.resolve(); });
    await Promise.resolve();
    assert.equal(dismissed, 2);
    assert.equal(document.body.querySelector('.core-toast'), null);
  } finally {
    if (host.isConnected && host.hasChildNodes()) await act(async () => root.unmount());
    env.restore();
  }
});
