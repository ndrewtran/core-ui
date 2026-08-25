import { createHash } from 'node:crypto';
import { canonicalJson, validateContractDocument } from '@core-ui/schema';

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
    || descriptor.support !== 'unproved; Button export only'
    || descriptor.bindings.length !== 1
    || descriptor.exports.length !== 1) {
    fail('CORE_REACT_R11_DESCRIPTOR_INVALID');
  }
  const [binding] = descriptor.bindings;
  const [componentExport] = descriptor.exports;
  if (binding.binding !== 'core:component:button#web.react'
    || binding.export !== 'Button'
    || binding.strategy !== 'direct'
    || binding.runtimeProfile !== 'web.react'
    || binding.selector !== '.core-button'
    || !same(binding.states, ['idle', 'pending', 'disabled'])
    || !same(binding.api.props, ['disabled', 'pending'])
    || !same(binding.api.defaults, { disabled: false, pending: false })
    || componentExport.name !== 'Button'
    || componentExport.binding !== binding.binding) {
    fail('CORE_REACT_R11_BUTTON_DESCRIPTOR_DRIFT');
  }
  if (!release.publication
    || release.schema !== 'core-ui-react-release-candidate-v1'
    || release.lifecycle !== 'experimental'
    || release.componentExports.length !== 1
    || release.bindings.length !== 1
    || !same(release.runtimeProfiles, ['web.react'])
    || release.catalog.status !== 'bound'
    || !same(release.catalog.states, ['idle', 'pending', 'disabled'])
    || release.evidence.status !== 'pending'
    || !same(release.evidence.ids, ['E-R1.1-01', 'E-R1.1-02', 'E-R1.1-03', 'E-R1.1-04'])
    || release.publication.status !== 'disabled') {
    fail('CORE_REACT_R11_RELEASE_INVALID');
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
  return { descriptor, release, donorComparison };
}
