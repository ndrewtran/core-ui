import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import axe from 'axe-core';
import { chromium } from 'playwright-core';
import test from 'node:test';
import manifest from '../.storybook/generated/manifest.mjs';

const appRoot = resolve(import.meta.dirname, '..');
const host = '127.0.0.1';
const serverTimeoutMs = 90_000;
const storyTimeoutMs = 15_000;
const testTimeoutMs = 180_000;

function browserCandidates() {
  return [
    process.env.CORE_UI_CHROME_EXECUTABLE,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/google-chrome',
  ].filter(Boolean);
}

async function findBrowser() {
  for (const candidate of browserCandidates()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser location.
    }
  }
  return undefined;
}

function configuredPort() {
  const value = process.env.CORE_UI_STORYBOOK_A11Y_PORT;
  if (value === undefined || value === '') return undefined;
  const port = Number(value);
  assert.ok(Number.isInteger(port) && port >= 0 && port <= 65_535, `CORE_UI_STORYBOOK_A11Y_PORT must be a valid TCP port (or 0 for an ephemeral port), got ${value}`);
  return port;
}

async function reservePort(preferredPort) {
  const server = createServer();
  try {
    await new Promise((resolvePromise, reject) => {
      server.once('error', reject);
      server.listen({ host, port: preferredPort ?? 0 }, resolvePromise);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object', 'Storybook test could not determine its reserved port');
    return address.port;
  } finally {
    if (server.listening) {
      await new Promise((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  }
}

function outputBuffer() {
  const chunks = [];
  return {
    append(chunk) {
      chunks.push(String(chunk));
      if (chunks.length > 80) chunks.shift();
    },
    read() {
      return chunks.join('').trim();
    },
  };
}

function terminateProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolvePromise();
    };
    child.once('exit', settle);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!settled) {
        child.kill('SIGKILL');
        child.once('exit', settle);
        setTimeout(settle, 1_000).unref();
      }
    }, 5_000).unref();
  });
}

async function startStorybook(port) {
  const stdout = outputBuffer();
  const stderr = outputBuffer();
  const child = spawn(resolve(appRoot, 'node_modules/.bin/storybook'), [
    'dev',
    '--ci',
    '--host',
    host,
    '--port',
    String(port),
  ], {
    cwd: appRoot,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let spawnError;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.stdout.on('data', (chunk) => stdout.append(chunk));
  child.stderr.on('data', (chunk) => stderr.append(chunk));

  const baseUrl = `http://${host}:${port}`;
  const deadline = Date.now() + serverTimeoutMs;
  let exit;
  const exited = new Promise((resolvePromise) => {
    child.once('exit', (code, signal) => {
      exit = { code, signal };
      resolvePromise();
    });
  });

  try {
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`Could not start Storybook: ${spawnError.message}\n${stderr.read()}\n${stdout.read()}`);
      }
      if (exit) {
        throw new Error(`Storybook exited before readiness (code ${exit.code ?? 'null'}, signal ${exit.signal ?? 'null'})\n${stderr.read()}\n${stdout.read()}`);
      }
      try {
        const response = await fetch(`${baseUrl}/index.json`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok) {
          const index = await response.json();
          if (index?.entries && typeof index.entries === 'object') return { child, baseUrl, stdout, stderr };
        }
      } catch {
        // Storybook may still be compiling or restarting its Vite server.
      }
      await Promise.race([
        new Promise((resolvePromise) => setTimeout(resolvePromise, 100)),
        exited,
      ]);
    }
    throw new Error(`Storybook did not become ready within ${serverTimeoutMs}ms\n${stderr.read()}\n${stdout.read()}`);
  } catch (error) {
    await terminateProcess(child);
    throw error;
  }
}

function storyFamily(entry) {
  return entry.title?.split('/').at(-1) ?? entry.id;
}

const INTERACTION_OPEN_LOCATORS = Object.freeze({
  DatePicker: { trigger: '.core-date-trigger', overlay: '.core-date-popover' },
  DateRangePicker: { trigger: '.core-date-trigger', overlay: '.core-date-popover' },
  ComboBox: { trigger: '.core-combo-box-trigger', overlay: '.core-combo-box-popover' },
  Select: { trigger: '.core-select-trigger', overlay: '.core-select-popover' },
});

function formatViolations(violations) {
  return violations.map((violation) => [
    `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}`,
    `  ${violation.helpUrl}`,
    ...violation.nodes.map((node) => `  target=${JSON.stringify(node.target)} html=${node.html}\n  ${node.failureSummary ?? ''}`),
  ].join('\n')).join('\n');
}

async function waitForStory(page, scheme) {
  await page.waitForFunction((expectedScheme) => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && bounds.width > 0
        && bounds.height > 0;
    };
    const surface = document.querySelector('.core-storybook-surface');
    const root = document.querySelector('#storybook-root');
    return Boolean(surface)
      && Boolean(root?.firstElementChild)
      && document.documentElement.getAttribute('data-core-color-scheme') === expectedScheme
      && !isVisible(document.querySelector('.sb-errordisplay'))
      && !isVisible(document.querySelector('.sb-preparing-story'));
  }, scheme, { timeout: storyTimeoutMs });
}

async function waitForDocumentAnimations(page) {
  await page.evaluate(async () => {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
    await document.fonts.ready;
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    // Indeterminate components intentionally animate forever. Axe needs the
    // settled DOM and computed styles, not an unbounded wait for decorative
    // motion, so cancel the current visual animations before evaluation.
    document.getAnimations().forEach((animation) => animation.cancel());
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
  });
}

async function runAxe(page, contextSelector) {
  return page.evaluate(async (contextSelector) => {
    const deadline = performance.now() + 5_000;
    while (window.axe._running) {
      if (performance.now() >= deadline) throw new Error('Axe did not become idle before evaluation');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    }
    const context = contextSelector ? document.querySelector(contextSelector) : document.body;
    if (!context) throw new Error(`Axe context did not resolve: ${contextSelector}`);
    return window.axe.run(context);
  }, contextSelector);
}

async function waitForInteractionOpen(page, family) {
  const locators = INTERACTION_OPEN_LOCATORS[family];
  assert.ok(locators, `missing interaction-open locators for ${family}`);
  await page.waitForFunction(({ triggerSelector, overlaySelector }) => {
    const section = [...document.querySelectorAll('.core-storybook-state')]
      .find((candidate) => candidate.querySelector('h3')?.textContent === 'open');
    const trigger = section?.querySelector(triggerSelector);
    const overlay = document.querySelector(`${overlaySelector}:not([hidden])`);
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true' || !overlay) return false;
    const style = getComputedStyle(overlay);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }, { triggerSelector: locators.trigger, overlaySelector: locators.overlay }, { timeout: storyTimeoutMs });
}

async function waitForInteractionClosed(page, family) {
  const locators = INTERACTION_OPEN_LOCATORS[family];
  await page.waitForFunction(({ triggerSelector, overlaySelector }) => {
    const section = [...document.querySelectorAll('.core-storybook-state')]
      .find((candidate) => candidate.querySelector('h3')?.textContent === 'open');
    const trigger = section?.querySelector(triggerSelector);
    const overlay = document.querySelector(`${overlaySelector}:not([hidden])`);
    const overlayHidden = !overlay || ['none', 'hidden'].includes(getComputedStyle(overlay).display)
      || getComputedStyle(overlay).visibility === 'hidden' || overlay.getAttribute('aria-hidden') === 'true';
    return trigger?.getAttribute('aria-expanded') !== 'true' && overlayHidden;
  }, { triggerSelector: locators.trigger, overlaySelector: locators.overlay }, { timeout: storyTimeoutMs });
}

test('all Core React Storybook families are axe-clean in light and dark', { timeout: testTimeoutMs }, async () => {
  const executablePath = await findBrowser();
  assert.ok(executablePath, 'Chrome or Chromium is required for the Storybook a11y gate (set CORE_UI_CHROME_EXECUTABLE to override)');

  const preferredPort = configuredPort();
  let port;
  try {
    port = await reservePort(preferredPort);
  } catch (error) {
    if (preferredPort === undefined) throw error;
    port = await reservePort(undefined);
  }

  let storybook;
  let browser;
  try {
    const started = await startStorybook(port);
    storybook = started.child;
    const baseUrl = started.baseUrl;
    const index = await fetch(`${baseUrl}/index.json`).then(async (response) => {
      assert.ok(response.ok, `Storybook index request failed with HTTP ${response.status}`);
      return response.json();
    });
    const stories = Object.values(index.entries).filter(({ type }) => type === 'story');
    const defaults = stories.filter(({ name }) => name === 'Default');
    const states = stories.filter(({ name }) => name === 'States');
    const expectedFamilies = new Set(manifest.families.map(({ family }) => family));
    assert.equal(expectedFamilies.size, 53, 'the generated Storybook manifest must contain 53 families');
    assert.equal(defaults.length, expectedFamilies.size, 'Storybook must expose one Default story for every family');
    assert.equal(states.length, expectedFamilies.size, 'Storybook must expose one States story for every family');
    assert.deepEqual(new Set(defaults.map(storyFamily)), expectedFamilies, 'Default stories must cover every manifest family');
    assert.deepEqual(new Set(states.map(storyFamily)), expectedFamilies, 'States stories must cover every manifest family');
    assert.deepEqual(
      new Set(defaults.map(storyFamily)),
      new Set(states.map(storyFamily)),
      'Default and States stories must cover the same families',
    );

    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(storyTimeoutMs);
    page.setDefaultTimeout(storyTimeoutMs);

    for (const scheme of ['light', 'dark']) {
      for (const story of [...defaults, ...states]) {
        try {
          const storyUrl = `${baseUrl}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story&globals=${encodeURIComponent(`colorScheme:${scheme}`)}`;
          await page.goto(storyUrl, { waitUntil: 'domcontentloaded' });
          await waitForStory(page, scheme);
          await waitForDocumentAnimations(page);
          await page.addScriptTag({ content: axe.source });
          const family = storyFamily(story);
          const interactionOpen = story.name === 'States' && INTERACTION_OPEN_LOCATORS[family];
          if (interactionOpen) {
            await waitForInteractionOpen(page, family);
            const portalResult = await runAxe(page, `${interactionOpen.overlay}:not([hidden])`);
            assert.equal(
              portalResult.violations.length,
              0,
              `${scheme} ${story.id} (${family}) open portal has axe violations:\n${formatViolations(portalResult.violations)}`,
            );
            await page.keyboard.press('Escape');
            await waitForInteractionClosed(page, family);
          }
          const result = await runAxe(page);
          assert.equal(
            result.violations.length,
            0,
            `${scheme} ${story.id} (${storyFamily(story)}) has axe violations:\n${formatViolations(result.violations)}`,
          );
        } catch (error) {
          if (error?.name === 'AssertionError') throw error;
          const diagnostics = await page.evaluate(() => ({
            body: document.body?.innerText?.slice(0, 1_000),
            html: document.documentElement?.outerHTML?.slice(0, 2_000),
            root: document.querySelector('#storybook-root')?.outerHTML?.slice(0, 2_000),
            surfaceCount: document.querySelectorAll('.core-storybook-surface').length,
            rootChildCount: document.querySelector('#storybook-root')?.childElementCount,
          })).catch(() => ({ body: '', html: '' }));
          throw new Error(
            `${scheme} ${story.id} (${storyFamily(story)}) failed to render before axe evaluation: ${error.message}\n`
              + `body=${diagnostics.body}\nroot=${diagnostics.root}\n`
              + `surfaceCount=${diagnostics.surfaceCount} rootChildCount=${diagnostics.rootChildCount}\n`
              + `html=${diagnostics.html}`,
            { cause: error },
          );
        }
      }
    }
    await page.close();
  } finally {
    await browser?.close();
    await terminateProcess(storybook);
  }
});
