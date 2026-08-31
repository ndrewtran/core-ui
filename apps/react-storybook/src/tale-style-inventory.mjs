import inventory from '../visual-migration/tale-style-inventory.json' with { type: 'json' };
import r10Crosswalk from '../../../catalog/react-r1-0/donor-crosswalk.json' with { type: 'json' };
import r12Crosswalk from '../../../catalog/react-r1-2/donor-crosswalk.json' with { type: 'json' };
import r13Crosswalk from '../../../catalog/react-r1-3/donor-crosswalk.json' with { type: 'json' };
import r14Crosswalk from '../../../catalog/react-r1-4/donor-crosswalk.json' with { type: 'json' };

export const taleStyleInventory = inventory;

const pinnedDonor = Object.freeze({
  repository: 'tale-ui/tale-ui',
  commit: '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd',
  tree: 'e36c96f683772eedf4652d6adbe7dbcbd1d41f94',
});
const expectedCssFoundationPaths = Object.freeze([
  'packages/css/src/foundations/_base-elements.css',
  'packages/css/src/foundations/_typography.css',
  'packages/css/src/themes/_color-modes.css',
  'packages/css/src/tokens/_base.css',
  'packages/css/src/tokens/_colors.css',
  'packages/css/src/tokens/_effects.css',
  'packages/css/src/tokens/_foreground.css',
  'packages/css/src/tokens/_neutrals.css',
  'packages/css/src/tokens/_spacing.css',
  'packages/css/src/tokens/_typography.css',
]);

function fail(message) {
  throw new Error(`Tale style inventory: ${message}`);
}

function crosswalkStyleInputs() {
  return [r10Crosswalk, r12Crosswalk, r13Crosswalk, r14Crosswalk].flatMap((crosswalk) => [
    ...Object.values(crosswalk.components ?? {}).flatMap(({ donorInputs = [] }) => donorInputs),
    ...(crosswalk.sharedPrimitives ?? []),
    ...(crosswalk.button?.donorInputs ?? []),
  ]).filter(({ path }) => path?.startsWith('packages/styles/src/'));
}

/**
 * Validate the retained, file-complete donor stylesheet ledger. This is kept
 * separate from capture so provenance can be checked even when the donor
 * checkout is not available to the local Storybook runner.
 */
export function validateTaleStyleInventory(value = inventory) {
  if (value?.schema !== 'muxui-tale-style-inventory-v1') fail('schema is invalid');
  if (JSON.stringify(value.donor) !== JSON.stringify({ ...pinnedDonor, path: 'packages/styles/src', fileCount: 125 })) {
    fail('pinned donor identity or path is invalid');
  }
  if (value.closure?.fixtureFamilies !== 51 || JSON.stringify(value.closure?.noApplicableDonorFamilies) !== JSON.stringify(['Group', 'TokenField'])) {
    fail('fixture closure identity is invalid');
  }
  if (!Array.isArray(value.files) || value.files.length !== 125) fail(`expected 125 files, found ${value.files?.length ?? 'none'}`);
  const paths = value.files.map((file) => file.path);
  if (new Set(paths).size !== 125 || paths.some((path, index) => path !== [...paths].sort()[index])) fail('file paths must be unique and bytewise sorted');
  const byPath = new Map();
  for (const file of value.files) {
    if (!file || typeof file !== 'object' || !/^packages\/styles\/src\/[A-Za-z0-9_.-]+\.css$/u.test(file.path)) fail(`invalid stylesheet path ${file?.path ?? 'unknown'}`);
    if (!/^[0-9a-f]{40}$/u.test(file.blob) || !/^sha256:[0-9a-f]{64}$/u.test(file.sha256)) fail(`invalid pinned identity for ${file.path}`);
    if (!['direct-family-owner', 'shared-primitives', 'shared-nested-support', 'aggregate', 'scaffold', 'donor-only-no-fixed-family'].includes(file.disposition)) fail(`invalid disposition for ${file.path}`);
    if (typeof file.reason !== 'string' || file.reason.length === 0 || !Array.isArray(file.fixtureConsumers)) fail(`missing explanation for ${file.path}`);
    if (typeof file.muxuiSupportClaim !== 'boolean') fail(`missing Mux UI support claim for ${file.path}`);
    if (file.disposition === 'donor-only-no-fixed-family' && (file.muxuiSupportClaim || file.fixtureConsumers.length > 0)) fail(`no-fixed-family file ${file.path} claims Mux UI support`);
    if (['aggregate', 'scaffold'].includes(file.disposition) && file.muxuiSupportClaim) fail(`${file.path} claims component support despite being ${file.disposition}`);
    byPath.set(file.path, file);
  }

  if (!Array.isArray(value.activeCssFoundationImports) || value.activeCssFoundationImports.length !== expectedCssFoundationPaths.length) fail('active CSS foundation import inventory is incomplete');
  const foundationPaths = value.activeCssFoundationImports.map((entry) => entry.path);
  if (JSON.stringify(foundationPaths) !== JSON.stringify([...expectedCssFoundationPaths].sort())) fail('active CSS foundation import paths are not canonical');
  for (const entry of value.activeCssFoundationImports) {
    if (!/^packages\/css\/src\/(?:foundations|themes|tokens)\/[A-Za-z0-9_.-]+\.css$/u.test(entry.path) || !/^[0-9a-f]{40}$/u.test(entry.blob) || !/^sha256:[0-9a-f]{64}$/u.test(entry.sha256) || typeof entry.reason !== 'string' || entry.reason.length === 0) fail(`invalid active CSS foundation identity for ${entry.path}`);
  }

  const crosswalk = crosswalkStyleInputs();
  const crosswalkPaths = [...new Set(crosswalk.map(({ path }) => path))].sort();
  if (crosswalkPaths.length !== 49) fail(`expected 49 exact crosswalk/shared stylesheet inputs, found ${crosswalkPaths.length}`);
  for (const path of crosswalkPaths) {
    const entry = byPath.get(path);
    if (!entry) fail(`crosswalk stylesheet is missing from inventory: ${path}`);
    const expectedBlobs = new Set(crosswalk.filter((item) => item.path === path).map(({ blob }) => blob));
    if (expectedBlobs.size !== 1 || !expectedBlobs.has(entry.blob)) fail(`crosswalk blob drift for ${path}`);
    if (entry.disposition === 'donor-only-no-fixed-family' || !entry.muxuiSupportClaim) fail(`crosswalk stylesheet has no Mux UI support claim: ${path}`);
  }
  for (const entry of value.files) {
    if (entry.disposition === 'direct-family-owner' && !crosswalkPaths.includes(entry.path)) fail(`direct owner is absent from crosswalk: ${entry.path}`);
  }
  return { fileCount: value.files.length, crosswalkInputCount: crosswalkPaths.length, counts: value.counts };
}

validateTaleStyleInventory();
