import test from 'node:test';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const expectedComponents = ['breadcrumbs', 'checkbox', 'autocomplete', 'checkbox-group', 'date-field', 'date-picker', 'date-range-picker', 'form', 'number-field', 'search-field', 'switch', 'text-field', 'time-field', 'disclosure', 'disclosure-group', 'group', 'link', 'meter', 'progress-bar', 'separator', 'toggle-button', 'calendar', 'color-area', 'color-field', 'color-picker', 'color-slider', 'color-swatch', 'color-swatch-picker', 'color-wheel', 'combo-box', 'grid-list', 'list-box', 'menu', 'radio-group', 'range-calendar', 'select', 'slider', 'table', 'tabs', 'tag-group', 'toggle-button-group', 'token-field', 'toolbar', 'tree', 'virtualizer'];
const expectedButtonsPerProfile = 30;
const documentAnimationSettleTimeoutMs = 2000;
const port = Number(process.env.CORE_UI_PLAYGROUND_PORT ?? 4174);
let executablePath;
for (const candidate of candidates) {
  try { await access(candidate); executablePath = candidate; break; } catch {}
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('playground preview did not become ready');
}

async function waitForDocumentAnimations(page) {
  await page.evaluate(async (timeoutMs) => {
    const startedAt = performance.now();
    let timeoutId;
    const describeAnimations = () => document.getAnimations().map((animation) => ({
      playState: animation.playState,
      currentTime: animation.currentTime,
      target: animation.effect?.target?.outerHTML?.slice(0, 240),
    }));
    const deadline = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Document animations did not settle within ${timeoutMs}ms (elapsed ${Math.round(performance.now() - startedAt)}ms): ${JSON.stringify(describeAnimations())}`));
      }, timeoutMs);
    });
    const waitForFrame = () => Promise.race([
      new Promise((resolveFrame) => requestAnimationFrame(resolveFrame)),
      deadline,
    ]);
    try {
      // Flush the media-query style change before collecting its transitions.
      void document.documentElement.offsetWidth;
      await waitForFrame();
      let animations = document.getAnimations();
      while (animations.length > 0) {
        await Promise.race([
          Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))),
          deadline,
        ]);
        await waitForFrame();
        animations = document.getAnimations();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, documentAnimationSettleTimeoutMs);
}

test('R1.3 React component browser and axe matrix', async () => {
  if (!executablePath) throw new Error('R1_BROWSER_REQUIRED: Chrome or Chromium was not found');
  const appRoot = resolve(import.meta.dirname, '..');
  const server = await createServer({ root: appRoot, server: { host: '127.0.0.1', port, strictPort: true } });
  const url = `http://127.0.0.1:${port}`;
  let browser;
  try {
    await server.listen();
    await waitForServer(url);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const fieldMediaProof = await page.evaluate(() => [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) => rule.conditionText === '(forced-colors: active)')
          && [...sheet.cssRules].some((rule) => rule.conditionText === '(prefers-contrast: more)');
      } catch { return false; }
    }));
    if (!fieldMediaProof) throw new Error('R1.2 field CSS must load forced-colors and high-contrast adaptations');
    await page.emulateMedia({ forcedColors: 'active' });
    if (!await page.locator('[data-profile]').first().isVisible()) throw new Error('R1.2 forced-colors profile did not render');
    await page.emulateMedia({ forcedColors: 'none' });
    await waitForDocumentAnimations(page);
    const profiles = await page.locator('[data-profile]').evaluateAll((nodes) => nodes.map((node) => node.dataset.profile));
    const expectedProfiles = ['light/standard/full/comfortable/ltr', 'dark/standard/full/comfortable/ltr', 'light/more/full/comfortable/ltr', 'light/standard/reduced/comfortable/ltr', 'light/standard/full/compact/ltr', 'light/standard/full/comfortable/rtl'];
    for (const expected of expectedProfiles) {
      if (!profiles.includes(expected)) throw new Error(`missing browser profile: ${expected}`);
      const profile = page.locator(`[data-profile="${expected}"]`);
      const result = await profile.evaluate(async (node) => window.axe.run(node));
      if (result.violations.length) {
        const diagnostics = await profile.evaluate((profileNode, violations) => violations.map(({ id, help, nodes }) => ({
          id,
          help,
          nodes: nodes.map(({ target, failureSummary, any }) => {
            let element;
            for (const selector of target) {
              try {
                element = profileNode.querySelector(selector);
                if (element) break;
              } catch {}
            }
            const style = element ? getComputedStyle(element) : null;
            return {
              target,
              html: element?.outerHTML.slice(0, 300),
              color: style?.color,
              backgroundColor: style?.backgroundColor,
              any: any?.map(({ data, message }) => ({ data, message })),
              failureSummary,
            };
          }),
        })), result.violations);
        throw new Error(`${expected} axe violations: ${JSON.stringify(diagnostics)}`);
      }
      if (await profile.locator('[data-component]').count() !== expectedComponents.length) {
        throw new Error(`${expected} must expose all ${expectedComponents.length} R1.3 component articles`);
      }
      for (const component of expectedComponents) {
        if (await profile.locator(`[data-component="${component}"]`).count() !== 1) {
          throw new Error(`${expected} must expose exactly one ${component} article`);
        }
      }
      if (await profile.locator('button').count() !== expectedButtonsPerProfile) {
        throw new Error(`${expected} must expose exactly ${expectedButtonsPerProfile} buttons`);
      }
      const idleFixture = profile.locator('[data-core-fixture-state="idle"]');
      await idleFixture.locator('button').click();
      if (await idleFixture.getAttribute('data-core-press-count') !== '1') throw new Error(`${expected} idle Button must activate exactly once`);
      const pendingFixture = profile.locator('[data-core-fixture-state="pending"]');
      const pending = pendingFixture.locator('button');
      await pending.focus();
      if (!await pending.evaluate((node) => document.activeElement === node)) throw new Error(`${expected} pending Button must remain focusable`);
      if (await pending.evaluate((node) => node.disabled)) throw new Error(`${expected} pending Button must not become HTML-disabled`);
      await pending.evaluate((node) => node.click());
      if (await pendingFixture.getAttribute('data-core-press-count') !== '0') throw new Error(`${expected} pending Button must suppress activation`);
      const disabledFixture = profile.locator('[data-core-fixture-state="disabled"]');
      const disabled = disabledFixture.locator('button');
      await disabled.evaluate((node) => node.click());
      if (await disabledFixture.getAttribute('data-core-press-count') !== '0') throw new Error(`${expected} disabled Button must suppress activation`);
      await disabled.focus();
      if (await disabled.evaluate((node) => document.activeElement === node)) throw new Error(`${expected} disabled Button must not be focusable`);
      if (expected === expectedProfiles[0]) {
        const autocompleteInput = profile.locator('[data-component="autocomplete"] .core-autocomplete input');
        await autocompleteInput.fill('');
        await autocompleteInput.focus();
        if (await profile.locator('.core-autocomplete-list').getAttribute('hidden') !== null) throw new Error('Autocomplete must show matching options while focused');
        await autocompleteInput.press('ArrowDown');
        const activeDescendant = await autocompleteInput.getAttribute('aria-activedescendant');
        if (!activeDescendant) throw new Error('Autocomplete ArrowDown must expose an active descendant');
        if (await profile.locator(`#${activeDescendant}`).count() !== 1) throw new Error('Autocomplete active descendant must identify an option');
        await autocompleteInput.press('Enter');
        if (await autocompleteInput.inputValue() !== 'Melbourne') throw new Error('Autocomplete Enter must select the active option');
        if (await profile.locator('.core-autocomplete-list').getAttribute('hidden') === null) throw new Error('Autocomplete Enter selection must dismiss suggestions');
        await autocompleteInput.fill('');
        await autocompleteInput.focus();
        await autocompleteInput.press('Escape');
        if (await autocompleteInput.getAttribute('aria-activedescendant') !== null) throw new Error('Autocomplete Escape must clear the active descendant');
        if (await profile.locator('.core-autocomplete-list').getAttribute('hidden') === null) throw new Error('Autocomplete Escape must dismiss suggestions');
        await autocompleteInput.evaluate((node) => node.blur());
        await autocompleteInput.focus();
        if (await profile.locator('.core-autocomplete-list').getAttribute('hidden') !== null) throw new Error('Autocomplete input focus must reopen suggestions');
        await autocompleteInput.fill('Syd');
        if (await profile.locator('.core-autocomplete-option').count() !== 1) throw new Error('Autocomplete input must filter options');
        await profile.locator('.core-autocomplete-option').click();
        if (await autocompleteInput.inputValue() !== 'Sydney') throw new Error('Autocomplete click selection must update the Core input value');
        if (await profile.locator('.core-autocomplete-list').getAttribute('hidden') === null) throw new Error('Autocomplete click selection must dismiss suggestions');
        await autocompleteInput.evaluate((node) => node.blur());
        await autocompleteInput.focus();
        if (await profile.locator('.core-autocomplete-list').getAttribute('hidden') !== null) throw new Error('Autocomplete focus after selection must reopen suggestions');
      }
    }
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    console.log(JSON.stringify({ browser: await browser.version(), profiles: expectedProfiles }));
  } finally {
    await browser?.close();
    await server.close();
  }
});
