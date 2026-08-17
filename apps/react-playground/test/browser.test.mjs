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

test('R1.0 browser and axe matrix', async () => {
  if (!executablePath) throw new Error('R1_BROWSER_REQUIRED: Chrome or Chromium was not found');
  const appRoot = resolve(import.meta.dirname, '..');
  const server = await createServer({ root: appRoot, server: { host: '127.0.0.1', port: 4173, strictPort: true } });
  const url = 'http://127.0.0.1:4173';
  let browser;
  try {
    await server.listen();
    await waitForServer(url);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const profiles = await page.locator('[data-profile]').evaluateAll((nodes) => nodes.map((node) => node.dataset.profile));
    const expectedProfiles = ['light/standard/full/comfortable/ltr', 'dark/standard/full/comfortable/ltr', 'light/more/full/comfortable/ltr', 'light/standard/reduced/comfortable/ltr', 'light/standard/full/compact/ltr', 'light/standard/full/comfortable/rtl'];
    for (const expected of expectedProfiles) {
      if (!profiles.includes(expected)) throw new Error(`missing browser profile: ${expected}`);
      const profile = page.locator(`[data-profile="${expected}"]`);
      const result = await profile.evaluate(async (node) => window.axe.run(node));
      if (result.violations.length) throw new Error(`${expected} axe violations: ${result.violations.map(({ id }) => id).join(', ')}`);
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
    }
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    if (await page.locator('button').count() !== 18) throw new Error('browser state matrix is incomplete');
    console.log(JSON.stringify({ browser: await browser.version(), profiles: expectedProfiles }));
  } finally {
    await browser?.close();
    await server.close();
  }
});
