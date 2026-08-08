const COORDINATOR = Symbol.for('core-ui.web.runtime-coordinator.v1');

export class CoreWebOwnershipError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'CoreWebOwnershipError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new CoreWebOwnershipError(code, message, details);
}

function realmFor(root) {
  const document = root?.ownerDocument;
  if (!document) fail('CORE_WEB_ROOT_INVALID', 'root must belong to a document');
  return { document, realm: document.defaultView ?? globalThis };
}

function coordinatorFor(realm) {
  if (!realm[COORDINATOR]) {
    Object.defineProperty(realm, COORDINATOR, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: { roots: new WeakMap(), documents: new WeakMap() },
    });
  }
  return realm[COORDINATOR];
}

function documentState(coordinator, document) {
  let state = coordinator.documents.get(document);
  if (!state) {
    state = { listeners: new Map(), scrollLocks: 0, previousOverflow: '', inert: new Map() };
    coordinator.documents.set(document, state);
  }
  return state;
}

function once(release) {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    release();
  };
}

function acquireListener(document, state, type, listener, options) {
  let entry = state.listeners.get(type);
  if (!entry) {
    const logical = new Set();
    const physical = (event) => { for (const handler of [...logical]) handler(event); };
    entry = { logical, physical, options };
    state.listeners.set(type, entry);
    document.addEventListener(type, physical, options);
  } else if (entry.options !== options && JSON.stringify(entry.options) !== JSON.stringify(options)) {
    fail('CORE_WEB_LISTENER_OPTIONS_CONFLICT', `${type} listener options conflict`);
  }
  entry.logical.add(listener);
  return () => {
    entry.logical.delete(listener);
    if (entry.logical.size === 0) {
      document.removeEventListener(type, entry.physical, entry.options);
      state.listeners.delete(type);
    }
  };
}

function acquireScrollLock(document, state) {
  if (state.scrollLocks === 0) {
    state.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }
  state.scrollLocks += 1;
  return () => {
    state.scrollLocks -= 1;
    if (state.scrollLocks === 0) document.documentElement.style.overflow = state.previousOverflow;
  };
}

function acquireInert(state, element) {
  let entry = state.inert.get(element);
  if (!entry) {
    entry = { count: 0, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') };
    state.inert.set(element, entry);
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
  }
  entry.count += 1;
  return () => {
    entry.count -= 1;
    if (entry.count === 0) {
      element.inert = entry.inert;
      if (entry.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', entry.ariaHidden);
      state.inert.delete(element);
    }
  };
}

export function claimRoot(root, { integration, token, setup = () => undefined } = {}) {
  if (!['vanilla', 'react'].includes(integration) || (typeof token !== 'object' && typeof token !== 'function')) {
    fail('CORE_WEB_CLAIM_INVALID', 'claim requires an integration and stable object token');
  }
  const { document, realm } = realmFor(root);
  const coordinator = coordinatorFor(realm);
  const current = coordinator.roots.get(root);
  if (current) {
    if (current.integration === integration && current.token === token) return current.handle;
    fail('CORE_WEB_ROOT_OWNED', 'root already has a lifecycle owner', {
      actual: current.integration, requested: integration,
    });
  }
  const state = documentState(coordinator, document);
  const releases = [];
  const focusReturns = [];
  let cleanup;
  let destroyed = false;
  const track = (release) => {
    const guarded = once(release);
    releases.push(guarded);
    return guarded;
  };
  const resources = Object.freeze({
    addDocumentListener(type, listener, options) {
      return track(acquireListener(document, state, type, listener, options));
    },
    acquireScrollLock() {
      return track(acquireScrollLock(document, state));
    },
    setInert(element) {
      return track(acquireInert(state, element));
    },
    appendPortal(node) {
      document.body.append(node);
      return track(() => node.remove());
    },
    restoreFocusOnRelease(element) {
      const release = once(() => {
        if (element?.isConnected && typeof element.focus === 'function') element.focus();
      });
      focusReturns.push(release);
      return release;
    },
  });
  const handle = Object.freeze({
    integration,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try { cleanup?.(); } finally {
        for (const release of releases.splice(0).reverse()) release();
        for (const restore of focusReturns.splice(0).reverse()) restore();
        if (coordinator.roots.get(root)?.handle === handle) coordinator.roots.delete(root);
      }
    },
  });
  coordinator.roots.set(root, { integration, token, handle });
  try {
    const result = setup(resources);
    if (result !== undefined && typeof result !== 'function') {
      fail('CORE_WEB_SETUP_INVALID', 'setup must return a cleanup function or undefined');
    }
    cleanup = result;
    return handle;
  } catch (error) {
    handle.destroy();
    throw error;
  }
}

export function connectRoot(root, options = {}) {
  return claimRoot(root, { ...options, integration: 'vanilla' });
}

export function inspectRuntime(root) {
  const { document, realm } = realmFor(root);
  const coordinator = coordinatorFor(realm);
  const owner = coordinator.roots.get(root);
  const state = documentState(coordinator, document);
  return Object.freeze({
    owner: owner?.integration ?? 'unclaimed',
    physicalDocumentListeners: state.listeners.size,
    logicalDocumentListeners: [...state.listeners.values()].reduce((sum, entry) => sum + entry.logical.size, 0),
    scrollLocks: state.scrollLocks,
    inertTargets: state.inert.size,
  });
}
