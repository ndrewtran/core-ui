import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import axe from 'axe-core';
import { chromium } from 'playwright-core';
import { platformSafetyFixture } from '../src/testing.mjs';

const chromeCandidates = [
  process.env.CORE_UI_CHROME_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function launchChrome() {
  const executablePath = chromeCandidates.find(existsSync);
  return chromium.launch(executablePath ? { executablePath, headless: true } : { channel: 'chrome', headless: true });
}

function pageMarkup() {
  return `<!doctype html><html lang="en"><head><title>Core UI platform safety fixture</title><style>${platformSafetyFixture.stylesheet}</style></head><body>
    <main><h1>Platform safety substrate</h1><button class="core-button" type="button"
      style="--core-component-button-background: rgb(0, 0, 0); --core-component-button-foreground: rgb(255, 255, 255)">
      <span data-core-fixture-direction-marker aria-hidden="true">•</span><span data-core-slot="label">Synthetic action</span></button></main></body></html>`;
}

test('E-G1.1-01 progressive fixture keeps native semantics with JavaScript disabled', async () => {
  const browser = await launchChrome();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setContent(pageMarkup());
    const button = page.getByRole('button', { name: 'Synthetic action' });
    await assert.doesNotReject(() => button.focus());
    assert.equal(await button.evaluate((element) => element === document.activeElement), true);
    assert.equal(await button.getAttribute('disabled'), null);
    await context.close();
  } finally { await browser.close(); }
});

test('E-G1.1-06 binds two exact safety sets and proves web-owned browser adaptation', async () => {
  const html = platformSafetyFixture.profiles['web.html'];
  const react = platformSafetyFixture.profiles['web.react'];
  for (const fixture of [html, react]) {
    assert.equal(fixture.requirementSet.dispositions.length, 6);
    assert.match(fixture.requirementSet.digest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(
      fixture.requirementSet.dispositions.filter(({ disposition }) => disposition === 'required').map(({ id }) => id),
      ['layout.direction', 'platform.accessibility-mapping', 'system.forced-colors', 'system.high-contrast'],
    );
    assert.deepEqual(fixture.requiredAssertions, [
      'system.forced-colors', 'system.high-contrast', 'layout.direction',
    ]);
  }
  assert.notEqual(html.requirementSet.digest, react.requirementSet.digest);
  assert.equal(html.requirementSet.contractDigest, react.requirementSet.contractDigest);
  assert.equal(platformSafetyFixture.componentSupportClaim, 'none');

  const browser = await launchChrome();
  try {
    const page = await browser.newPage();
    await page.setContent(pageMarkup());
    const normal = await page.locator('button').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, border: style.borderTopWidth };
    });
    assert.equal(normal.background, 'rgb(0, 0, 0)');
    assert.equal(normal.color, 'rgb(255, 255, 255)');
    assert.equal(normal.border, '2px');

    await page.emulateMedia({ contrast: 'more' });
    assert.equal(await page.locator('button').evaluate((element) => getComputedStyle(element).borderTopWidth), '3px');
    await page.emulateMedia({ contrast: 'no-preference' });
    assert.equal(await page.locator('button').evaluate((element) => getComputedStyle(element).borderTopWidth), '2px');

    await page.emulateMedia({ forcedColors: 'active' });
    const forced = await page.locator('button').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    assert.notEqual(forced.background, 'rgb(0, 0, 0)');
    assert.notEqual(forced.color, 'rgb(255, 255, 255)');
    await page.emulateMedia({ forcedColors: 'none' });

    await page.locator('html').evaluate((element) => { element.dir = 'ltr'; });
    const ltr = await page.locator('[data-core-fixture-direction-marker]').evaluate((element) => {
      const style = getComputedStyle(element); return { left: style.marginLeft, right: style.marginRight };
    });
    await page.locator('html').evaluate((element) => { element.dir = 'rtl'; });
    const rtl = await page.locator('[data-core-fixture-direction-marker]').evaluate((element) => {
      const style = getComputedStyle(element); return { left: style.marginLeft, right: style.marginRight };
    });
    assert.deepEqual(ltr, { left: '2px', right: '10px' });
    assert.deepEqual(rtl, { left: '10px', right: '2px' });
    assert.equal(await page.locator('button').evaluate((element) => getComputedStyle(element).direction), 'rtl');
    assert.equal(await page.locator('button').evaluate((element) => getComputedStyle(element).textAlign), 'start');

    await page.addScriptTag({ content: axe.source });
    const results = await page.evaluate(() => globalThis.axe.run(document));
    assert.deepEqual(results.violations, []);
  } finally { await browser.close(); }
});
