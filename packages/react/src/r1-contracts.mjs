import { createHash } from 'node:crypto';
import { canonicalJson, validateContractDocument } from '@core-ui/schema';
import { EXPECTED_R12_COMPONENT_SLUGS, EXPECTED_R12_DONOR_CONTRACT } from './r1-2-donor-contract.mjs';
import { EXPECTED_R13_COMPONENT_SLUGS, EXPECTED_R13_DONOR_CONTRACT } from './r1-3-donor-contract.mjs';
import { EXPECTED_R14_COMPONENT_SLUGS, EXPECTED_R14_DONOR_CONTRACT } from './r1-4-donor-contract.mjs';

const EXPECTED_UPSTREAM = Object.freeze({
  package: 'react-aria-components',
  version: '1.20.0',
  commit: '5ecb3333001313e83898cd07644227897e3bae1f',
  tree: 'eb6f6e25b83b2095536c4ab7671a0d977726738c',
  inputs: [
    { path: 'packages/react-aria-components/package.json', blob: '34aff3e05c02dfed56cc4e416d893331d48d3cc3', bytes: 2770 },
    { path: 'packages/react-aria-components/exports/index.ts', blob: 'e72133c7b1d1d0fe2d65031f100e3f92d61add9a', bytes: 20184 },
  ],
});

const EXPECTED_CLASSIFICATION_SHA256 = 'sha256:1210b8d3cee9999407c4632672640b0905c5d9fa8d93904a9e80afd70f9166dc';
// Generated once from the two exact React Spectrum blobs in EXPECTED_UPSTREAM.
// This is deliberately independent of both mutable local catalog projections.
const EXPECTED_NORMALIZED_EXPORTS_SHA256 = 'sha256:8f4e9dd637585ed98d529624f46960cee80041cd41bfef206e7745be351503d3';
const EXPECTED_DONOR = Object.freeze({
  commit: '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd',
  name: 'Tale UI',
  tree: 'e36c96f683772eedf4652d6adbe7dbcbd1d41f94',
});
const EXPECTED_DONOR_DISPOSITIONS = Object.freeze([
  'adopt', 'adapt', 'defer', 'reject', 'no-applicable-donor',
]);
const EXPECTED_UPSTREAM_DISPOSITIONS = Object.freeze([
  'candidate', 'delivered', 'defer', 'exclude', 'not-a-component',
]);
const R11_COMPONENTS = Object.freeze([
  ['Button', 'button'],
  ['Breadcrumbs', 'breadcrumbs'],
  ['Checkbox', 'checkbox'],
  ['Disclosure', 'disclosure'],
  ['DisclosureGroup', 'disclosure-group'],
  ['Group', 'group'],
  ['Link', 'link'],
  ['Meter', 'meter'],
  ['ProgressBar', 'progress-bar'],
  ['Separator', 'separator'],
  ['ToggleButton', 'toggle-button'],
]);

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function fail(code) {
  throw new Error(code);
}

function snapshotTuples(items) {
  return items.map(({ name, source, value }) => ({ name, source, value }));
}

function classificationTuples(items) {
  return items.map(({ name, kind, disposition, tranche, reason }) => ({
    name,
    kind,
    disposition,
    tranche,
    ...(reason === undefined ? {} : { reason }),
  }));
}

/** Validates every authored R1.0 source record and its complete upstream relation. */
export function assertReactR10SourceContracts({
  snapshot,
  upstreamExports,
  upstreamExportsBytes,
  crosswalk,
  license,
}) {
  for (const value of [snapshot, upstreamExports, crosswalk, license]) {
    validateContractDocument('react-r1.schema.json', value);
  }
  for (const value of [snapshot, upstreamExports]) {
    if (!same({
      package: value.package,
      version: value.version,
      commit: value.commit,
      tree: value.tree,
      inputs: value.inputs,
    }, EXPECTED_UPSTREAM)) fail('CORE_REACT_UPSTREAM_IDENTITY_DRIFT');
  }
  if (upstreamExports.items.length !== 613) fail('CORE_REACT_UPSTREAM_EXPORT_COUNT_DRIFT');
  if (!same(snapshotTuples(snapshot.items), upstreamExports.items)) {
    fail('CORE_REACT_UPSTREAM_EXPORT_DERIVATION_DRIFT');
  }
  const normalizedExportsSha256 = sha256(JSON.stringify(upstreamExports.items));
  if (normalizedExportsSha256 !== EXPECTED_NORMALIZED_EXPORTS_SHA256
    || snapshot.exportTupleSha256 !== EXPECTED_NORMALIZED_EXPORTS_SHA256.slice(7)) {
    fail('CORE_REACT_UPSTREAM_EXPORT_TUPLE_DRIFT');
  }
  if (snapshot.normalizedExports.path !== 'catalog/react-r1-0/upstream-exports.json'
    || snapshot.normalizedExports.count !== upstreamExports.items.length
    || snapshot.normalizedExports.sha256 !== sha256(upstreamExportsBytes)) {
    fail('CORE_REACT_UPSTREAM_EXPORT_PAYLOAD_DRIFT');
  }
  const classificationSha256 = sha256(canonicalJson(classificationTuples(snapshot.items)));
  if (classificationSha256 !== EXPECTED_CLASSIFICATION_SHA256
    || snapshot.classificationSha256 !== EXPECTED_CLASSIFICATION_SHA256) {
    fail('CORE_REACT_UPSTREAM_CLASSIFICATION_DRIFT');
  }
  if (!same(snapshot.dispositionGrammar, EXPECTED_UPSTREAM_DISPOSITIONS)) {
    fail('CORE_REACT_UPSTREAM_DISPOSITION_GRAMMAR_DRIFT');
  }
  if (!same(crosswalk.donor, EXPECTED_DONOR)
    || !same(crosswalk.dispositions, EXPECTED_DONOR_DISPOSITIONS)) {
    fail('CORE_REACT_DONOR_IDENTITY_DRIFT');
  }
  const componentCrosswalks = crosswalk.components;
  const expectedComponentSlugs = R11_COMPONENTS.slice(1).map(([, slug]) => slug);
  if (!componentCrosswalks
    || !same(Object.keys(componentCrosswalks).sort(), [...expectedComponentSlugs].sort())) {
    fail('CORE_REACT_COMPONENT_DONOR_CROSSWALK_DRIFT');
  }
  for (const slug of expectedComponentSlugs) {
    const entry = componentCrosswalks[slug];
    if (!entry
      || !Array.isArray(entry.donorInputs)
      || !Array.isArray(entry.rules)
      || !Array.isArray(entry.consumedRules)
      || !same(entry.consumedRules, entry.rules.map(({ input }) => input))
      || (slug === 'group'
        ? entry.disposition !== 'no-applicable-donor' || entry.donorInputs.length !== 0 || entry.rules.length !== 0
        : entry.disposition !== 'adapt' || entry.donorInputs.length === 0 || entry.rules.length === 0)) {
      fail('CORE_REACT_COMPONENT_DONOR_CROSSWALK_DRIFT');
    }
  }
  if (license.dependency !== false || license.donor !== EXPECTED_DONOR.name) {
    fail('CORE_REACT_DONOR_LICENSE_DRIFT');
  }
  return { snapshot, upstreamExports, crosswalk, license };
}

/** Validates generated R1.0 package records before they are serialized. */
export function assertReactR10GeneratedContracts({
  descriptor,
  release,
  donorComparison,
  manifest,
  crosswalk,
}) {
  for (const value of [descriptor, release, donorComparison]) {
    validateContractDocument('react-r1.schema.json', value);
  }
  if (manifest.private !== true || release.packagePrivate !== true) {
    fail('CORE_REACT_R10_PUBLICATION_GUARD_MISSING');
  }
  if (!same(donorComparison.donor, {
    commit: crosswalk.donor.commit,
    tree: crosswalk.donor.tree,
    buttonBlobs: crosswalk.buttonBlobs,
  }) || !same(donorComparison.consumedRules, crosswalk.button.rules)) {
    fail('CORE_REACT_DONOR_COMPARISON_DERIVATION_DRIFT');
  }
  return { descriptor, release, donorComparison };
}

/** Validates the first Core-owned component projection without exposing RAC types. */
export function assertReactR11GeneratedContracts({
  descriptor,
  release,
  donorComparison,
  componentDonorComparison,
  manifest,
  crosswalk,
}) {
  if (manifest.private !== true || release.packagePrivate !== true) {
    fail('CORE_REACT_R11_PUBLICATION_GUARD_MISSING');
  }
  if (!same(Object.keys(descriptor).sort(), ['bindings', 'exports', 'generatedFrom', 'package', 'schema', 'support', 'version'])
    || descriptor.schema !== 'core-ui-renderer-descriptor-v1'
    || descriptor.generatedFrom !== 'packages/react/src/generate.mjs'
    || descriptor.package !== '@core-ui/react'
    || descriptor.support !== 'unproved; R1.1 React exports only'
    || descriptor.bindings.length !== R11_COMPONENTS.length
    || descriptor.exports.length !== R11_COMPONENTS.length) {
    fail('CORE_REACT_R11_DESCRIPTOR_INVALID');
  }
  for (const [name, slug] of R11_COMPONENTS) {
    const binding = descriptor.bindings.find(({ export: exportName }) => exportName === name);
    const componentExport = descriptor.exports.find(({ name: exportName }) => exportName === name);
    if (!binding || !componentExport
      || binding.binding !== `core:component:${slug}#web.react`
      || binding.export !== name
      || binding.strategy !== 'direct'
      || binding.runtimeProfile !== 'web.react'
      || binding.selector !== `.core-${slug}`
      || !Array.isArray(binding.states)
      || !Array.isArray(binding.api?.props)
      || binding.api.props.some((prop) => /^is[A-Z]/u.test(prop) || /(?:onPress|isPending|isDisabled)/u.test(prop))
      || componentExport.name !== name
      || componentExport.binding !== binding.binding) {
      fail('CORE_REACT_R11_COMPONENT_DESCRIPTOR_DRIFT');
    }
  }
  if (!release.publication
    || release.schema !== 'core-ui-react-release-candidate-v1'
    || release.lifecycle !== 'experimental'
    || release.componentExports.length !== R11_COMPONENTS.length
    || release.bindings.length !== R11_COMPONENTS.length
    || !same(release.runtimeProfiles, ['web.react'])
    || release.catalog.status !== 'bound'
    || !Array.isArray(release.catalog.components)
    || release.catalog.components.length !== R11_COMPONENTS.length
    || release.evidence.status !== 'pending'
    || !same(release.evidence.ids, ['E-R1.1-01', 'E-R1.1-02', 'E-R1.1-03', 'E-R1.1-04'])
    || release.publication.status !== 'disabled') {
    fail('CORE_REACT_R11_RELEASE_INVALID');
  }
  for (const [name, slug] of R11_COMPONENTS) {
    const binding = `core:component:${slug}#web.react`;
    if (!release.componentExports.some((entry) => entry.name === name && entry.export === name && entry.binding === binding)
      || !release.bindings.some((entry) => entry.binding === binding && entry.export === name && entry.runtimeProfile === 'web.react')
      || !release.catalog.components.some((entry) => entry.component === `core:component:${slug}` && entry.binding === binding && Array.isArray(entry.states))) {
      fail('CORE_REACT_R11_RELEASE_COMPONENT_DRIFT');
    }
  }
  if (!same(donorComparison.donor, {
    commit: crosswalk.donor.commit,
    tree: crosswalk.donor.tree,
    buttonBlobs: crosswalk.buttonBlobs,
  }) || !same(donorComparison.consumedRules, crosswalk.button.rules)
    || donorComparison.disposition !== 'adapt'
    || donorComparison.result.selector !== '.core-button'
    || donorComparison.result.status !== 'adapted-for-r1.1-button') {
    fail('CORE_REACT_R11_DONOR_COMPARISON_DRIFT');
  }
  if (componentDonorComparison !== undefined) {
    if (componentDonorComparison.schema !== 'core-ui-react-component-donor-comparison-v1'
      || componentDonorComparison.generatedFrom !== 'packages/react/src/generate.mjs'
      || !same(componentDonorComparison.donor, {
        name: crosswalk.donor.name,
        commit: crosswalk.donor.commit,
        tree: crosswalk.donor.tree,
      })
      || !Array.isArray(componentDonorComparison.components)
      || componentDonorComparison.components.length !== R11_COMPONENTS.length) {
      fail('CORE_REACT_R11_COMPONENT_DONOR_COMPARISON_INVALID');
    }
    for (const [name, slug] of R11_COMPONENTS) {
      const entry = componentDonorComparison.components.find(({ component }) => component === name);
      const expectedCrosswalk = name === 'Button' ? crosswalk.button : crosswalk.components[slug];
      if (!entry
        || entry.binding !== `core:component:${slug}#web.react`
        || entry.selector !== `.core-${slug}`
        || entry.disposition !== expectedCrosswalk.disposition
        || !same(entry.rules, expectedCrosswalk.rules)
        || (name !== 'Button' && !same(entry.donorInputs, expectedCrosswalk.donorInputs))) {
        fail('CORE_REACT_R11_COMPONENT_DONOR_COMPARISON_DRIFT');
      }
    }
  }
  return { descriptor, release, donorComparison, componentDonorComparison };
}

/** Validates the R1.2 field tranche projection without exposing RAC types. */
export function assertReactR12GeneratedContracts({ descriptor, release, donorComparison, manifest, componentNames, crosswalk }) {
  if (manifest.private !== true || release.packagePrivate !== true) fail('CORE_REACT_R12_PUBLICATION_GUARD_MISSING');
  if (!same(crosswalk, EXPECTED_R12_DONOR_CONTRACT)
    || !same(Object.keys(crosswalk.components ?? {}).sort(), [...EXPECTED_R12_COMPONENT_SLUGS].sort())
    || crosswalk.components && Object.values(crosswalk.components).some((entry) => entry.disposition !== 'adapt')) {
    fail('CORE_REACT_R12_DONOR_PROVENANCE_DRIFT');
  }
  if (!Array.isArray(crosswalk.sharedPrimitives)
    || !same(crosswalk.sharedPrimitives, EXPECTED_R12_DONOR_CONTRACT.sharedPrimitives)) fail('CORE_REACT_R12_SHARED_DONOR_INPUT_DRIFT');
  if (descriptor.schema !== 'core-ui-renderer-descriptor-v1'
    || descriptor.generatedFrom !== 'packages/react/src/generate.mjs'
    || descriptor.package !== '@core-ui/react'
    || descriptor.support !== 'unproved; R1.2 React exports only'
    || descriptor.bindings.length !== componentNames.length
    || descriptor.exports.length !== componentNames.length) fail('CORE_REACT_R12_DESCRIPTOR_INVALID');
  for (const name of componentNames) {
    const binding = descriptor.bindings.find(({ export: exportName }) => exportName === name);
    const componentExport = descriptor.exports.find(({ name: exportName }) => exportName === name);
    if (!binding || !componentExport || binding.binding !== componentExport.binding
      || binding.strategy !== 'direct' || binding.runtimeProfile !== 'web.react'
      || binding.api.props.some((prop) => /^is[A-Z]/u.test(prop) || /(?:onPress|isPending|isDisabled)/u.test(prop))) {
      fail('CORE_REACT_R12_COMPONENT_DESCRIPTOR_DRIFT');
    }
  }
  if (release.schema !== 'core-ui-react-release-candidate-v1'
    || release.lifecycle !== 'experimental'
    || release.componentExports.length !== componentNames.length
    || release.bindings.length !== componentNames.length
    || !same(release.runtimeProfiles, ['web.react'])
    || !release.catalog
    || !release.evidence
    || !release.publication
    || release.catalog.status !== 'bound'
    || release.catalog.components.length !== componentNames.length
    || release.evidence.status !== 'pending'
    || !same(release.evidence.ids, ['E-R1.2-01', 'E-R1.2-02', 'E-R1.2-03', 'E-R1.2-04'])
    || release.publication.status !== 'disabled') fail('CORE_REACT_R12_RELEASE_INVALID');
  if (donorComparison.schema !== 'core-ui-react-r1-2-donor-comparison-v1'
    || donorComparison.generatedFrom !== 'packages/react/src/generate.mjs'
    || !same(donorComparison.donor, EXPECTED_R12_DONOR_CONTRACT.donor)
    || donorComparison.components.length !== EXPECTED_R12_COMPONENT_SLUGS.length) fail('CORE_REACT_R12_DONOR_COMPARISON_INVALID');
  for (const component of donorComparison.components) {
    const slug = component.binding.replace(/^core:component:([^#]+)#.*$/u, '$1');
    const source = EXPECTED_R12_DONOR_CONTRACT.components[slug];
    if (!source || component.disposition !== 'adapt' || component.selector !== `.core-${slug}`
      || !same(component.rules, source.rules) || !same(component.donorInputs, source.donorInputs)) {
      fail('CORE_REACT_R12_DONOR_COMPARISON_DRIFT');
    }
  }
  return { descriptor, release, donorComparison };
}

/** Validates the R1.3 collection/color projection and its exact Tale donor crosswalk. */
export function assertReactR13GeneratedContracts({ descriptor, release, donorComparison, manifest, componentNames, crosswalk, collectionsSource }) {
  if (manifest.private !== true || release.packagePrivate !== true) fail('CORE_REACT_R13_PUBLICATION_GUARD_MISSING');
  if (!same(crosswalk, EXPECTED_R13_DONOR_CONTRACT)
    || !same(Object.keys(crosswalk.components ?? {}).sort(), [...EXPECTED_R13_COMPONENT_SLUGS].sort())
    || crosswalk.donor.commit !== '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd'
    || crosswalk.donor.tree !== 'e36c96f683772eedf4652d6adbe7dbcbd1d41f94') {
    fail('CORE_REACT_R13_DONOR_PROVENANCE_DRIFT');
  }
  for (const slug of EXPECTED_R13_COMPONENT_SLUGS) {
    const entry = crosswalk.components[slug];
    const noDonor = slug === 'token-field';
    if (!entry || !Array.isArray(entry.donorInputs) || !Array.isArray(entry.rules) || !Array.isArray(entry.consumedRules) || !Array.isArray(entry.tokenHooks)
      || !same(entry.consumedRules, entry.rules.map(({ input }) => input))
      || entry.disposition !== (noDonor ? 'no-applicable-donor' : 'adapt')
      || (noDonor ? (entry.donorInputs.length !== 0 || entry.rules.length !== 0 || entry.tokenHooks.length !== 0)
        : (entry.donorInputs.length === 0 || entry.rules.length === 0))) {
      fail('CORE_REACT_R13_DONOR_CROSSWALK_DRIFT');
    }
    for (const input of entry.donorInputs) {
      if (!/^packages\/(?:styles|react)\/.+$/u.test(input.path) || !/^[0-9a-f]{40}$/u.test(input.blob)
        || /^([0-9a-f])\1{39}$/u.test(input.blob)) fail('CORE_REACT_R13_DONOR_BLOB_INVALID');
    }
  }
  if (!descriptor || descriptor.schema !== 'core-ui-renderer-descriptor-v1'
    || descriptor.generatedFrom !== 'packages/react/src/generate.mjs'
    || descriptor.package !== '@core-ui/react'
    || descriptor.support !== 'unproved; R1.3 React exports only'
    || descriptor.bindings.length !== componentNames.length
    || descriptor.exports.length !== componentNames.length
    || componentNames.length !== 46) fail('CORE_REACT_R13_DESCRIPTOR_INVALID');
  for (const slug of EXPECTED_R13_COMPONENT_SLUGS) {
    const binding = descriptor.bindings.find(({ binding: value }) => value === `core:component:${slug}#web.react`);
    const componentExport = descriptor.exports.find(({ binding: value }) => value === `core:component:${slug}#web.react`);
    if (!binding || !componentExport || binding.strategy !== 'direct' || binding.runtimeProfile !== 'web.react'
      || binding.api.props.some((prop) => /^is[A-Z]/u.test(prop) || /(?:onPress|isPending|isDisabled)/u.test(prop))) {
      fail('CORE_REACT_R13_COMPONENT_DESCRIPTOR_DRIFT');
    }
  }
  if (release.schema !== 'core-ui-react-release-candidate-v1'
    || release.lifecycle !== 'experimental'
    || release.componentExports.length !== componentNames.length
    || release.bindings.length !== componentNames.length
    || !same(release.runtimeProfiles, ['web.react'])
    || release.catalog?.status !== 'bound'
    || release.catalog.components.length !== componentNames.length
    || !same(release.evidence?.ids, ['E-R1.3-01', 'E-R1.3-02', 'E-R1.3-03', 'E-R1.3-04', 'E-R1.3-05'])
    || release.publication?.status !== 'disabled') fail('CORE_REACT_R13_RELEASE_INVALID');
  if (donorComparison.schema !== 'core-ui-react-r1-3-donor-comparison-v1'
    || donorComparison.generatedFrom !== 'packages/react/src/generate.mjs'
    || !same(donorComparison.donor, EXPECTED_R13_DONOR_CONTRACT.donor)
    || donorComparison.components.length !== EXPECTED_R13_COMPONENT_SLUGS.length) fail('CORE_REACT_R13_DONOR_COMPARISON_INVALID');
  for (const slug of EXPECTED_R13_COMPONENT_SLUGS) {
    const source = EXPECTED_R13_DONOR_CONTRACT.components[slug];
    const entry = donorComparison.components.find(({ binding }) => binding === `core:component:${slug}#web.react`);
    if (!entry || entry.disposition !== source.disposition || entry.selector !== `.core-${slug}`
      || !same(entry.donorInputs, source.donorInputs) || !same(entry.tokenHooks, source.tokenHooks) || !same(entry.rules, source.rules)) {
      fail('CORE_REACT_R13_DONOR_COMPARISON_DRIFT');
    }
  }
  const names = ['Calendar', 'ColorArea', 'ColorField', 'ColorPicker', 'ColorSlider', 'ColorSwatch', 'ColorSwatchPicker', 'ColorWheel', 'ComboBox', 'GridList', 'ListBox', 'Menu', 'RadioGroup', 'RangeCalendar', 'Select', 'Slider', 'Table', 'Tabs', 'TagGroup', 'ToggleButtonGroup', 'TokenField', 'Toolbar', 'Tree', 'Virtualizer'];
  if (!collectionsSource || names.some((name) => !collectionsSource.includes(`export const ${name}`))) fail('CORE_REACT_R13_RUNTIME_EXPORT_DRIFT');
  return { descriptor, release, donorComparison };
}

/** Validates the R1.4 overlay projection and its stable Core-owned surface. */
export function assertReactR14GeneratedContracts({ descriptor, release, donorComparison, manifest, componentNames, crosswalk, overlaysSource }) {
  if (manifest.private !== true || release.packagePrivate !== true) fail('CORE_REACT_R14_PUBLICATION_GUARD_MISSING');
  if (!same(crosswalk, EXPECTED_R14_DONOR_CONTRACT)
    || crosswalk.schema !== 'core-ui-react-r1-4-donor-crosswalk-v1'
    || crosswalk.tranche !== 'R1.4'
    || crosswalk.dependency !== false
    || !same(Object.keys(crosswalk.components ?? {}).sort(), [...EXPECTED_R14_COMPONENT_SLUGS].sort())
    || !same(crosswalk.donor, EXPECTED_DONOR)) fail('CORE_REACT_R14_DONOR_PROVENANCE_DRIFT');
  for (const slug of EXPECTED_R14_COMPONENT_SLUGS) {
    const entry = crosswalk.components[slug];
    if (!entry || entry.disposition !== 'adapt' || !Array.isArray(entry.donorInputs) || entry.donorInputs.length === 0
      || !Array.isArray(entry.rules) || !Array.isArray(entry.consumedRules) || !Array.isArray(entry.tokenHooks)
      || !same(entry.consumedRules, entry.rules.map(({ input }) => input))) fail('CORE_REACT_R14_DONOR_CROSSWALK_DRIFT');
    for (const input of entry.donorInputs) {
      if (!/^packages\/(?:styles|react)\/.+$/u.test(input.path) || !/^[0-9a-f]{40}$/u.test(input.blob)
        || /^([0-9a-f])\1{39}$/u.test(input.blob)) fail('CORE_REACT_R14_DONOR_BLOB_INVALID');
    }
  }
  if (!descriptor || descriptor.schema !== 'core-ui-renderer-descriptor-v1'
    || descriptor.generatedFrom !== 'packages/react/src/generate.mjs'
    || descriptor.package !== '@core-ui/react'
    || descriptor.support !== 'unproved; R1.4 React exports only'
    || descriptor.bindings.length !== 53
    || descriptor.exports.length !== 53
    || componentNames.length !== EXPECTED_R14_COMPONENT_SLUGS.length) fail('CORE_REACT_R14_DESCRIPTOR_INVALID');
  for (const slug of EXPECTED_R14_COMPONENT_SLUGS) {
    const binding = descriptor.bindings.find(({ binding: value }) => value === `core:component:${slug}#web.react`);
    const componentExport = descriptor.exports.find(({ binding: value }) => value === `core:component:${slug}#web.react`);
    if (!binding || !componentExport || binding.strategy !== 'direct' || binding.runtimeProfile !== 'web.react'
      || binding.api.props.some((prop) => /^is[A-Z]/u.test(prop) || /(?:onPress|isPending|isDisabled)/u.test(prop))) {
      fail('CORE_REACT_R14_COMPONENT_DESCRIPTOR_DRIFT');
    }
  }
  if (release.schema !== 'core-ui-react-release-candidate-v1'
    || release.lifecycle !== 'experimental'
    || release.componentExports.length !== 53
    || release.bindings.length !== 53
    || !same(release.runtimeProfiles, ['web.react'])
    || release.catalog?.status !== 'bound'
    || release.catalog.components.length !== 53
    || release.evidence?.status !== 'pending'
    || !same(release.evidence.ids, ['E-R1.4-01', 'E-R1.4-02', 'E-R1.4-03', 'E-R1.4-04', 'E-R1.4-05', 'E-R1.4-06'])
    || release.publication?.status !== 'disabled') fail('CORE_REACT_R14_RELEASE_INVALID');
  if (donorComparison.schema !== 'core-ui-react-r1-4-donor-comparison-v1'
    || donorComparison.generatedFrom !== 'packages/react/src/generate.mjs'
    || !same(donorComparison.donor, EXPECTED_R14_DONOR_CONTRACT.donor)
    || donorComparison.components.length !== EXPECTED_R14_COMPONENT_SLUGS.length) fail('CORE_REACT_R14_DONOR_COMPARISON_INVALID');
  for (const slug of EXPECTED_R14_COMPONENT_SLUGS) {
    const source = EXPECTED_R14_DONOR_CONTRACT.components[slug];
    const entry = donorComparison.components.find(({ binding }) => binding === `core:component:${slug}#web.react`);
    if (!entry || entry.disposition !== source.disposition || entry.selector !== `.core-${slug}`
      || !same(entry.donorInputs, source.donorInputs) || !same(entry.tokenHooks, source.tokenHooks) || !same(entry.rules, source.rules)) {
      fail('CORE_REACT_R14_DONOR_COMPARISON_DRIFT');
    }
  }
  const names = ['DropZone', 'FileTrigger', 'Dialog', 'Popover', 'PreviewTrigger', 'Toast', 'ToastProvider', 'useToast', 'Tooltip'];
  if (!overlaysSource || names.some((name) => !overlaysSource.includes(`export ${name === 'useToast' ? 'function' : 'const'} ${name}`))
    || /export\s+const\s+Modal\b/u.test(overlaysSource)
    || !/from ['"]react-aria-components['"]/u.test(overlaysSource)) fail('CORE_REACT_R14_RUNTIME_EXPORT_DRIFT');
  return { descriptor, release, donorComparison };
}
