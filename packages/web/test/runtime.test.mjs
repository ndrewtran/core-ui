import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { claimRoot, connectRoot, inspectRuntime } from '../src/runtime-implementation.mjs';

function fixture() {
  const dom = new JSDOM('<!doctype html><html><body><button id="before">Before</button><div id="a"></div><div id="b"></div><main id="background"></main></body></html>');
  const { document } = dom.window;
  return { dom, document, a: document.querySelector('#a'), b: document.querySelector('#b') };
}

test('E-G1.1-03 vanilla reconnect is idempotent and mixed ownership is rejected', () => {
  const { dom, a } = fixture();
  const token = {};
  const first = connectRoot(a, { token });
  assert.equal(connectRoot(a, { token }), first);
  assert.equal(inspectRuntime(a).owner, 'vanilla');
  assert.throws(() => connectRoot(a, { token: {} }), /CORE_WEB_ROOT_OWNED/);
  assert.throws(() => claimRoot(a, { integration: 'react', token: {} }), /CORE_WEB_ROOT_OWNED/);
  first.destroy();
  first.destroy();
  assert.equal(inspectRuntime(a).owner, 'unclaimed');
  dom.window.close();
});

test('E-G1.1-03 concurrent roots share listeners and global leases then clean up', () => {
  const { dom, document, a, b } = fixture();
  const background = document.querySelector('#background');
  const before = document.querySelector('#before');
  before.focus();
  let logicalCalls = 0;
  const setup = (resources) => {
    resources.addDocumentListener('keydown', () => { logicalCalls += 1; });
    resources.acquireScrollLock();
    resources.setInert(background);
    const portal = document.createElement('div');
    portal.dataset.portal = 'true';
    resources.appendPortal(portal);
    resources.restoreFocusOnRelease(before);
  };
  const one = connectRoot(a, { token: {}, setup });
  const two = connectRoot(b, { token: {}, setup });
  assert.deepEqual(inspectRuntime(a), {
    owner: 'vanilla', physicalDocumentListeners: 1, logicalDocumentListeners: 2,
    scrollLocks: 2, inertTargets: 1,
  });
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown'));
  assert.equal(logicalCalls, 2);
  one.destroy();
  assert.equal(inspectRuntime(b).physicalDocumentListeners, 1);
  assert.equal(document.documentElement.style.overflow, 'hidden');
  assert.equal(background.inert, true);
  two.destroy();
  assert.deepEqual(inspectRuntime(b), {
    owner: 'unclaimed', physicalDocumentListeners: 0, logicalDocumentListeners: 0,
    scrollLocks: 0, inertTargets: 0,
  });
  assert.equal(document.documentElement.style.overflow, '');
  assert.equal(background.getAttribute('aria-hidden'), null);
  assert.equal(document.querySelector('[data-portal]'), null);
  assert.equal(document.activeElement, before);
  dom.window.close();
});

test('E-G1.1-03 failed setup rolls every resource and root claim back', () => {
  const { dom, document, a } = fixture();
  const background = document.querySelector('#background');
  assert.throws(() => connectRoot(a, { token: {}, setup(resources) {
    resources.addDocumentListener('pointerdown', () => {});
    resources.acquireScrollLock();
    resources.setInert(background);
    resources.appendPortal(document.createElement('div'));
    throw new Error('synthetic setup failure');
  } }), /synthetic setup failure/);
  assert.deepEqual(inspectRuntime(a), {
    owner: 'unclaimed', physicalDocumentListeners: 0, logicalDocumentListeners: 0,
    scrollLocks: 0, inertTargets: 0,
  });
  assert.equal(document.documentElement.style.overflow, '');
  assert.equal(background.getAttribute('aria-hidden'), null);
  dom.window.close();
});

test('E-G1.1-03 resource releases are idempotent before final teardown', () => {
  const { dom, a } = fixture();
  let releaseLock;
  const owner = connectRoot(a, { token: {}, setup(resources) {
    releaseLock = resources.acquireScrollLock();
  } });
  releaseLock();
  releaseLock();
  assert.equal(inspectRuntime(a).scrollLocks, 0);
  owner.destroy();
  assert.equal(inspectRuntime(a).scrollLocks, 0);
  dom.window.close();
});

test('E-G1.1-03 duplicate package module identities share the realm coordinator', async () => {
  const { dom, a } = fixture();
  const duplicate = await import(`../src/runtime-implementation.mjs?duplicate=${Date.now()}`);
  const owner = connectRoot(a, { token: {} });
  assert.throws(() => duplicate.claimRoot(a, { integration: 'react', token: {} }), /CORE_WEB_ROOT_OWNED/);
  owner.destroy();
  dom.window.close();
});
