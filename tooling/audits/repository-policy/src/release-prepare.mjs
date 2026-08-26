import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverWorkspacePackages } from './workspace-packages.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const packages = await discoverWorkspacePackages(repositoryRoot);
const reactVersionPattern = /^0\.1\.0-alpha\.(?:0|[1-9]\d*)$/u;
const deliveredExports = [
  'Button', 'Breadcrumbs', 'Checkbox', 'Disclosure', 'DisclosureGroup', 'Group',
  'Link', 'Meter', 'ProgressBar', 'Separator', 'ToggleButton',
  'Autocomplete', 'CheckboxGroup', 'DateField', 'DatePicker', 'DateRangePicker',
  'Form', 'NumberField', 'SearchField', 'Switch', 'TextField', 'TimeField',
  'Calendar', 'ColorArea', 'ColorField', 'ColorPicker', 'ColorSlider', 'ColorSwatch',
  'ColorSwatchPicker', 'ColorWheel', 'ComboBox', 'GridList', 'ListBox', 'Menu',
  'RadioGroup', 'RangeCalendar', 'Select', 'Slider', 'Table', 'Tabs', 'TagGroup',
  'ToggleButtonGroup', 'TokenField', 'Toolbar', 'Tree', 'Virtualizer',
  'DropZone', 'FileTrigger', 'Dialog', 'Popover', 'PreviewTrigger', 'Toast', 'Tooltip',
];
const supportingExports = ['ToastProvider', 'useToast'];
const expectedRuntimeDependencies = {
  '@internationalized/date': '3.12.3',
  'react-aria-components': '1.20.0',
};
const expectedPeerDependencies = {
  react: '>=19.2.0 <20',
  'react-dom': '>=19.2.0 <20',
};
const expectedGeneratedEntries = [
  'package/generated/button-donor-comparison.json',
  'package/generated/button-donor-comparison.json.provenance',
  'package/generated/button.mjs',
  'package/generated/compatibility.mjs',
  'package/generated/component-donor-comparison.json',
  'package/generated/component-donor-comparison.json.provenance',
  'package/generated/components.mjs',
  'package/generated/collections.mjs',
  'package/generated/descriptor.json',
  'package/generated/descriptor.json.provenance',
  'package/generated/fields.mjs',
  'package/generated/index.d.ts',
  'package/generated/index.mjs',
  'package/generated/overlays.mjs',
  'package/generated/r1-2-donor-comparison.json',
  'package/generated/r1-2-donor-comparison.json.provenance',
  'package/generated/r1-3-donor-comparison.json',
  'package/generated/r1-3-donor-comparison.json.provenance',
  'package/generated/r1-4-donor-comparison.json',
  'package/generated/r1-4-donor-comparison.json.provenance',
  'package/generated/release.json',
  'package/generated/release.json.provenance',
  'package/generated/styles.css',
  'package/generated/testing.mjs',
];
const expectedPackageEntries = [
  ...expectedGeneratedEntries,
  'package/LICENSE',
  'package/NOTICE',
  'package/README.md',
  'package/package.json',
];

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function stableJson(value) {
  return JSON.stringify(value);
}

function readArchiveFile(archive, path) {
  const result = spawnSync('tar', ['-xOzf', archive, path], { encoding: 'utf8' });
  if (result.status !== 0) fail('R1.4_PACK_CONTENT_MISSING', path);
  return result.stdout;
}

function parseGeneratedJson(source) {
  return JSON.parse(source.replace(/^\/\/ @generated-from:.*\n\/\/ @generated-content-sha256:.*\n/u, ''));
}

function equalEntries(actual, expected) {
  return actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
}

function assertIncludes(value, expected, code) {
  if (!value.includes(expected)) fail(code, expected);
}

const reactCandidate = packages.filter(({ name, manifest }) => (
  name === '@core-ui/react' && reactVersionPattern.test(manifest.version)
));
const publishable = packages.filter(({ manifest }) => manifest.private !== true);

if (publishable.length !== 0) {
  console.error(
    `FOUNDATION_RELEASE_FORBIDDEN: packages cannot become publishable before an exact external publish authorization: ${publishable.map(({ name }) => name).join(', ')}`,
  );
  process.exit(1);
}

if (reactCandidate.length !== 1) {
  console.error('R1.4_PUBLICATION_GUARD_INVALID: exactly one private R1.4 React candidate is required');
  process.exit(1);
}

const reactPackage = reactCandidate[0];
const reactPackageRoot = resolve(repositoryRoot, 'packages/react');
const manifest = reactPackage.manifest;
if (manifest.private !== true || manifest.scripts?.prepublishOnly !== 'node src/publish-guard.mjs') {
  console.error('R1.4_PUBLICATION_GUARD_INVALID: the R1.4 React candidate must remain private with its fail-closed prepublish guard');
  process.exit(1);
}

const publicationGuard = spawnSync(process.execPath, ['src/publish-guard.mjs'], {
  cwd: reactPackageRoot,
  encoding: 'utf8',
});
if (publicationGuard.status === 0 || !publicationGuard.stderr.includes('CORE_REACT_R14_PUBLISH_FORBIDDEN')) {
  fail('R1.4_PUBLICATION_GUARD_INVALID', 'direct publication must remain fail-closed');
}

const temp = mkdtempSync(join(tmpdir(), 'core-ui-r1-4-release-'));
try {
  const packed = spawnSync('pnpm', ['pack', '--pack-destination', temp], {
    cwd: reactPackageRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, npm_config_engine_strict: 'false' },
  });
  if (packed.status !== 0) fail('R1.4_PACK_FAILED', packed.stderr);
  const archive = join(temp, `core-ui-react-${manifest.version}.tgz`);
  const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  if (listing.status !== 0) fail('R1.4_PACK_ARCHIVE_MISSING', listing.stderr);
  const entries = listing.stdout.trim().split('\n').sort();
  const expectedEntries = [...expectedPackageEntries].sort();
  if (!equalEntries(entries, expectedEntries)) {
    fail('R1.4_PACK_CONTENT_INVALID', `expected ${expectedEntries.join(', ')}, received ${entries.join(', ')}`);
  }
  if (entries.some((entry) => entry.startsWith('package/src/') || entry.startsWith('package/test/'))) {
    fail('R1.4_PACK_PRIVATE_SOURCE_LEAK', 'private source or tests entered the archive');
  }

  const packedManifest = JSON.parse(readArchiveFile(archive, 'package/package.json'));
  if (packedManifest.name !== '@core-ui/react'
    || packedManifest.version !== manifest.version
    || packedManifest.private !== true
    || stableJson(packedManifest.dependencies) !== stableJson(expectedRuntimeDependencies)
    || stableJson(packedManifest.peerDependencies) !== stableJson(expectedPeerDependencies)
    || stableJson(packedManifest.exports) !== stableJson(manifest.exports)) {
    fail('R1.4_PACK_MANIFEST_INVALID', 'name, version, privacy, runtime graph, peers, exports, or guard drifted');
  }
  const packedManifestText = JSON.stringify(packedManifest);
  for (const forbidden of ['workspace:', '@core-ui/web', 'tale-ui']) {
    if (packedManifestText.includes(forbidden)) fail('R1.4_PACK_MANIFEST_INVALID', `forbidden package reference: ${forbidden}`);
  }

  const publicEntry = readArchiveFile(archive, 'package/generated/index.mjs');
  const publicTypes = readArchiveFile(archive, 'package/generated/index.d.ts');
  for (const forbidden of ['react-aria-components', '@internationalized/date', 'react-stately', 'UNSTABLE_']) {
    if (publicEntry.includes(forbidden) || publicTypes.includes(forbidden)) {
      fail('R1.4_PACK_PUBLIC_LEAK', `upstream implementation detail leaked through the public surface: ${forbidden}`);
    }
  }
  const descriptor = JSON.parse(readArchiveFile(archive, 'package/generated/descriptor.json'));
  const release = JSON.parse(readArchiveFile(archive, 'package/generated/release.json'));
  const donorComparison = parseGeneratedJson(readArchiveFile(archive, 'package/generated/r1-4-donor-comparison.json'));
  if (!equalEntries(deliveredExports, descriptor.bindings.map(({ export: name }) => name))
    || !equalEntries(deliveredExports, release.componentExports.map(({ name }) => name))
    || !equalEntries(deliveredExports.slice(46), donorComparison.components.map(({ component }) => component))) {
    fail('R1.4_PACK_EXPORT_SURFACE_INVALID', 'descriptor, release, donor, and public export surfaces disagree');
  }
  if (release.packagePrivate !== true
    || release.publication?.status !== 'disabled'
    || stableJson(release.runtimeProfiles) !== stableJson(['web.react'])
    || donorComparison.donor?.commit !== '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd') {
    fail('R1.4_PACK_RELEASE_METADATA_INVALID', 'support, publication, runtime, or donor boundary drifted');
  }

  const readme = readArchiveFile(archive, 'package/README.md');
  const notice = readArchiveFile(archive, 'package/NOTICE');
  const styles = readArchiveFile(archive, 'package/generated/styles.css');
  for (const name of [...deliveredExports, ...supportingExports]) assertIncludes(readme, name, 'R1.4_PACK_GUIDANCE_MISSING');
  assertIncludes(readme, 'web.react', 'R1.4_PACK_GUIDANCE_MISSING');
  assertIncludes(notice, 'Tale UI', 'R1.4_PACK_NOTICE_INVALID');
  for (const name of deliveredExports) {
    if (name === 'FileTrigger') continue;
    const slug = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    assertIncludes(styles, `.core-${slug}`, 'R1.4_PACK_STYLE_MISSING');
  }

  const consumer = join(temp, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), `${JSON.stringify({
    name: 'core-ui-r1-4-clean-consumer', private: true, type: 'module',
    dependencies: { '@core-ui/react': `file:../core-ui-react-${manifest.version}.tgz`, react: '19.2.8', 'react-dom': '19.2.8' },
  }, null, 2)}\n`);
  const install = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], {
    cwd: consumer,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, npm_config_engine_strict: 'false' },
  });
  if (install.status !== 0) fail('R1.4_PACK_CONSUMER_INSTALL_FAILED', install.stderr);

  const consumerScript = `
    import React from 'react';
    import {renderToString} from 'react-dom/server';
    const entry = await import('@core-ui/react');
    const compatibility = await import('@core-ui/react/compatibility');
    const testing = await import('@core-ui/react/testing');
    const expected = ${JSON.stringify(['reactCompatibility', ...deliveredExports, ...supportingExports])};
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify([...expected].sort())) throw new Error('exact public export surface');
    if (compatibility.reactCompatibility.version !== '${manifest.version}') throw new Error('compatibility version');
    if (compatibility.reactCompatibility.support !== 'unproved; R1.4 React exports only') throw new Error('compatibility support');
    if (testing.reactPlatformSafetyFixture.componentSupportClaim !== 'none') throw new Error('support claim');
    const packageEntry = await import.meta.resolve('@core-ui/react');
    await import(new URL('./fields.mjs', packageEntry));
    if (!import.meta.resolve('@core-ui/react/styles.css').endsWith('/generated/styles.css')) throw new Error('styles resolution');
    const {
      Autocomplete, Breadcrumbs, Button, Calendar, Checkbox, CheckboxGroup, DateField, DatePicker,
      DateRangePicker, Disclosure, DisclosureGroup, Form, Group, Link, Meter, NumberField,
      ProgressBar, RangeCalendar, SearchField, Separator, Switch, TextField, TimeField, ToggleButton,
      DropZone, FileTrigger, Dialog, Popover, PreviewTrigger, ToastProvider, Tooltip,
    } = entry;
    const rendered = renderToString(React.createElement(Form, {method: 'post'},
      React.createElement(Button, null, 'Save'),
      React.createElement(Breadcrumbs, {'aria-label': 'Path', items: [{label: 'Home', href: '/'}]}),
      React.createElement(Checkbox, {name: 'enabled', value: 'yes'}, 'Enabled'),
      React.createElement(CheckboxGroup, {label: 'Alerts', name: 'alerts'}, React.createElement(Checkbox, {value: 'email'}, 'Email')),
      React.createElement(Disclosure, {title: 'Details'}, 'Details'),
      React.createElement(DisclosureGroup, null, React.createElement(Disclosure, {title: 'More'}, 'More')),
      React.createElement(Group, {role: 'group', 'aria-label': 'Group'}, 'Group'),
      React.createElement(Link, {href: '/'}, 'Home'),
      React.createElement(Meter, {label: 'Storage', value: 2}),
      React.createElement(ProgressBar, {label: 'Upload', value: 2}),
      React.createElement(Separator),
      React.createElement(ToggleButton, null, 'Toggle'),
      React.createElement(Autocomplete, {label: 'City', items: ['Melbourne'], defaultValue: 'Mel'}),
      React.createElement(Calendar, {label: 'Calendar', value: '2026-08-26'}),
      React.createElement(DateField, {label: 'Birthday', name: 'date', value: '2026-08-26'}),
      React.createElement(DatePicker, {label: 'Due date', name: 'due', value: '2026-08-26'}),
      React.createElement(DateRangePicker, {label: 'Trip', startName: 'rangeStart', endName: 'rangeEnd', value: {start: '2026-08-26', end: '2026-09-01'}}),
      React.createElement(NumberField, {label: 'Quantity', name: 'quantity', value: 2}),
      React.createElement(RangeCalendar, {label: 'Range calendar', value: {start: '2026-08-26', end: '2026-09-01'}}),
      React.createElement(SearchField, {label: 'Search', name: 'query', value: 'Core'}),
      React.createElement(Switch, {label: 'Enabled', name: 'switch'}),
      React.createElement(TextField, {label: 'Name', name: 'name', value: 'Core'}),
      React.createElement(TimeField, {label: 'Start', name: 'time', value: '09:30'}),
      React.createElement(DropZone, {'aria-label': 'Upload files'}, 'Drop files here'),
      React.createElement(FileTrigger, null, 'Choose files'),
      React.createElement(Dialog, {title: 'Closed dialog', open: false}, 'Dialog content'),
      React.createElement(Popover, {'aria-label': 'Details', trigger: React.createElement('button', {type: 'button'}, 'Details')}, 'Popover content'),
      React.createElement(PreviewTrigger, {'aria-label': 'Preview', trigger: React.createElement('button', {type: 'button'}, 'Preview')}, 'Preview content'),
      React.createElement(Tooltip, {trigger: React.createElement('button', {type: 'button'}, 'Help'), content: 'Helpful information'}),
      React.createElement(ToastProvider, null),
    ));
    for (const marker of ['<form', 'Calendar', 'Range calendar', 'August 2026', 'name="date"', 'name="due"', 'name="rangeStart"', 'name="rangeEnd"', 'name="time"', '2026-08-26', '09:30:00']) if (!rendered.includes(marker)) throw new Error('render/form/temporal behavior');
    let rejected = false;
    try { await import('@core-ui/react/button'); } catch (error) { rejected = error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'; }
    if (!rejected) throw new Error('undeclared component subpath resolved');
  `;
  const consumerCheck = spawnSync(process.execPath, ['--input-type=module', '--eval', consumerScript], {
    cwd: consumer,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (consumerCheck.status !== 0) fail('R1.4_PACK_CONSUMER_IMPORT_FAILED', consumerCheck.stderr || consumerCheck.stdout);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('R1.4 release preparation passed; @core-ui/react remains technically private and unpublished.');
