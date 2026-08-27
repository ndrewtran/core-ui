import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import {
  argTypesForBinding,
  adapterNames,
  renderFamily,
  storyArgsForBinding,
} from '../src/storybook-factory.mjs';

const appRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(appRoot, '../..');
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

test('default stories use uncontrolled pairs and state stories keep each pair exclusive', () => {
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
      assert.equal(
        stateArgs[controlled] !== undefined && stateArgs[uncontrolled] !== undefined,
        false,
        `${family} state ${controlled}/${uncontrolled}`,
      );
    }
  }

  assert.equal(storyArgsForBinding(bindings.get('Checkbox'), 'states', 'Checkbox').checked, true);
  assert.equal(storyArgsForBinding(bindings.get('Disclosure'), 'states', 'Disclosure').expanded, true);
  assert.deepEqual(
    storyArgsForBinding(bindings.get('DisclosureGroup'), 'states', 'DisclosureGroup').expandedIds,
    ['one'],
  );
  assert.equal(storyArgsForBinding(bindings.get('ToggleButton'), 'states', 'ToggleButton').selected, true);
  assert.equal(storyArgsForBinding(bindings.get('Switch'), 'states', 'Switch').selected, true);
  assert.equal(storyArgsForBinding(bindings.get('Autocomplete'), 'default', 'Autocomplete').defaultValue, '');
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
