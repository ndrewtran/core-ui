import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('private playground exposes the bounded R1.4 React component states', async () => {
  const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.equal(manifest.devDependencies.vite, '8.2.1');
  assert.equal(manifest.devDependencies['axe-core'], '4.13.0');
  assert.equal(manifest.devDependencies['playwright-core'], '1.62.1');
  const source = await readFile(resolve(import.meta.dirname, '../src/main.jsx'), 'utf8');
  assert.match(source, /R1ButtonFixture/);
  assert.match(source, /ToastProvider/);
  assert.match(source, /useToast/);
  assert.match(source, /backgroundColor: 'var\(--core-semantic-surface-canvas\)'/u);
  assert.match(source, /color: 'var\(--core-semantic-content-default\)'/u);
  for (const component of ['Breadcrumbs', 'Checkbox', 'Autocomplete', 'CheckboxGroup', 'DateField', 'DatePicker', 'DateRangePicker', 'Form', 'NumberField', 'SearchField', 'Switch', 'TextField', 'TimeField', 'Disclosure', 'DisclosureGroup', 'Group', 'Link', 'Meter', 'ProgressBar', 'Separator', 'ToggleButton', 'Calendar', 'ColorArea', 'ColorField', 'ColorPicker', 'ColorSlider', 'ColorSwatch', 'ColorSwatchPicker', 'ColorWheel', 'ComboBox', 'GridList', 'ListBox', 'Menu', 'RadioGroup', 'RangeCalendar', 'Select', 'Slider', 'Table', 'Tabs', 'TagGroup', 'ToggleButtonGroup', 'TokenField', 'Toolbar', 'Tree', 'Virtualizer', 'DropZone', 'FileTrigger', 'Dialog', 'Popover', 'PreviewTrigger', 'Toast', 'Tooltip']) {
    const slug = component.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
    assert.match(source, new RegExp(`data-component.*${slug}`));
  }
});
