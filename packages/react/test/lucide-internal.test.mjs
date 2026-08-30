import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { resolve } from 'node:path';
import {
  Breadcrumbs,
  Calendar,
  Checkbox,
  ComboBox,
  DatePicker,
  DateRangePicker,
  NumberField,
  RangeCalendar,
  SearchField,
  Select,
  TagGroup,
  Tree,
} from '../generated/index.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const lucideIntegrity = 'sha512-LPsB4rD1TD6wZu1djKOf9vUnS1jTNaHbolXebXDgiTdb6jeA1agIJhJsIybCmjKmQClcOaal1o1OaiYahEftyQ==';

test('Lucide stays an exact internal, tree-shakeable dependency with no public leakage', async () => {
  const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies['lucide-react'], '1.37.0');

  const lockfile = await readFile(resolve(packageRoot, '../../pnpm-lock.yaml'), 'utf8');
  assert.match(lockfile, new RegExp(`lucide-react@1\\.37\\.0:\\n\\s+resolution: \\{integrity: ${lucideIntegrity.replaceAll('+', '\\+')}\\}`));

  const sourceByFile = await Promise.all(['components.mjs', 'fields.mjs', 'collections.mjs', 'overlays.mjs']
    .map(async (file) => [file, await readFile(resolve(packageRoot, 'src', file), 'utf8')]));
  const source = sourceByFile.map(([, content]) => content).join('\n');
  const iconModules = ['check', 'chevron-down', 'chevron-left', 'chevron-right', 'minus', 'plus', 'x'];
  for (const icon of iconModules) assert.match(source, new RegExp(`from 'lucide-react/dist/esm/icons/${icon}\\.mjs'`));
  assert.doesNotMatch(source, /from 'lucide-react\/dist\/esm\/icons\/calendar\.mjs'/u);
  assert.doesNotMatch(source, /from ['"]lucide-react['"]/u);

  const publicEntry = await readFile(resolve(packageRoot, 'generated/index.mjs'), 'utf8');
  const publicTypes = await readFile(resolve(packageRoot, 'generated/index.d.ts'), 'utf8');
  assert.doesNotMatch(`${publicEntry}\n${publicTypes}`, /lucide-react|lucide-[a-z-]+|IconProps/u);

  const lucideManifest = JSON.parse(await readFile(resolve(packageRoot, 'node_modules/lucide-react/package.json'), 'utf8'));
  assert.equal(lucideManifest.version, '1.37.0');
  assert.equal(lucideManifest.sideEffects, false);
  const checkModule = await import('lucide-react/dist/esm/icons/check.mjs');
  assert.equal(typeof checkModule.default, 'object');
});

test('Core affordances render the accepted Lucide glyph mapping as decorative SVGs', () => {
  const markup = renderToString(React.createElement('div', null,
    React.createElement(Breadcrumbs, { 'aria-label': 'Path', items: [{ label: 'Home', href: '/' }, { label: 'Current' }] }),
    React.createElement(Checkbox, { defaultChecked: true }, 'Complete'),
    React.createElement(Checkbox, { indeterminate: true }, 'Mixed'),
    React.createElement(SearchField, { label: 'Search', defaultValue: 'Core' }),
    React.createElement(NumberField, { label: 'Quantity', defaultValue: 2 }),
    React.createElement(DatePicker, { label: 'Due date', defaultValue: '2026-08-26' }),
    React.createElement(DateRangePicker, { label: 'Trip', defaultValue: { start: '2026-08-26', end: '2026-09-01' } }),
    React.createElement(Calendar, { label: 'Calendar', value: '2026-08-26' }),
    React.createElement(RangeCalendar, { label: 'Range calendar', value: { start: '2026-08-26', end: '2026-09-01' } }),
    React.createElement(ComboBox, { label: 'City', items: ['Melbourne'] }),
    React.createElement(Select, { label: 'Country', items: ['Australia'] }),
    React.createElement(TagGroup, { label: 'Tags', items: ['Core'], onRemove: () => {} }),
    React.createElement(Tree, { 'aria-label': 'Navigation', items: [{ id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child' }] }] }),
  ));
  const dom = new JSDOM(`<!doctype html>${markup}`);
  const iconCases = [
    ['.core-checkbox-indicator[data-selected] svg', 'lucide-check', null],
    ['.core-checkbox-indicator[data-indeterminate] svg', 'lucide-minus', null],
    ['.core-search-clear svg', 'lucide-x', 'Clear search'],
    ['.core-number-stepper-decrement svg', 'lucide-minus', 'Decrease'],
    ['.core-number-stepper-increment svg', 'lucide-plus', 'Increase'],
    ['.core-date-trigger svg', 'core-icon--sm', 'Open calendar'],
    ['.core-calendar-previous svg', 'lucide-chevron-left', 'Previous month'],
    ['.core-calendar-next svg', 'lucide-chevron-right', 'Next month'],
    ['.core-combo-box-arrow', 'lucide-chevron-down', 'Show options'],
    ['.core-select-arrow', 'lucide-chevron-down', null],
    ['.core-tag-remove svg', 'lucide-x', 'Remove'],
    ['.core-tree-toggle svg', 'lucide-chevron-right', 'Toggle'],
  ];
  for (const [selector, className, label] of iconCases) {
    const icon = dom.window.document.querySelector(selector);
    assert.ok(icon, `missing icon ${className}`);
    assert.equal(icon.classList.contains(className), true);
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.equal(icon.getAttribute('focusable'), 'false');
    if (label !== null) assert.equal(icon.closest('button')?.getAttribute('aria-label'), label);
  }
  for (const selector of ['.core-calendar-previous svg', '.core-calendar-next svg']) {
    const icon = dom.window.document.querySelector(selector);
    assert.equal(icon?.classList.contains('core-icon'), true);
    assert.equal(icon?.classList.contains('core-icon--sm'), true);
  }
  const treeIcon = dom.window.document.querySelector('.core-tree-toggle svg');
  assert.equal(treeIcon?.getAttribute('fill'), 'currentColor');
  assert.equal(treeIcon?.getAttribute('stroke-width'), '0');
  const calendarIcons = dom.window.document.querySelectorAll('.core-date-trigger svg');
  assert.equal(calendarIcons.length, 2);
  for (const icon of calendarIcons) {
    assert.equal(icon.classList.contains('lucide-calendar'), false);
    assert.deepEqual([...icon.children].map((child) => [
      child.tagName.toLowerCase(),
      child.getAttribute('d'),
      child.getAttribute('width'),
      child.getAttribute('height'),
      child.getAttribute('x'),
      child.getAttribute('y'),
      child.getAttribute('rx'),
    ]), [
      ['path', 'M8 2v4', null, null, null, null, null],
      ['path', 'M16 2v4', null, null, null, null, null],
      ['rect', null, '18', '18', '3', '4', '2'],
      ['path', 'M3 10h18', null, null, null, null, null],
    ]);
  }
  assert.equal(dom.window.document.querySelector('.core-breadcrumbs svg'), null);
  assert.equal(dom.window.document.querySelector('.core-search-field .lucide-search'), null);
  dom.window.close();
});
