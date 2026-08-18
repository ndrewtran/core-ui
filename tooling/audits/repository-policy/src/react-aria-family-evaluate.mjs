import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const REPO = process.env.CORE_UI_REPOSITORY ?? process.cwd();
const CORE_REF = 'origin/main';
const UPSTREAM_REPO = 'adobe/react-spectrum';
const UPSTREAM_COMMIT = '5ecb3333001313e83898cd07644227897e3bae1f';
const UPSTREAM_TREE = 'eb6f6e25b83b2095536c4ab7671a0d977726738c';
const PACKAGE_TREE = 'cf646e6aba1680d1d62caa8a24d9efeae96d2251';
const DOCS_TREE = '03d35846665158610a6edfcfbc55695dc8973fb8';
const EXPORTS_TREE = '253fb233eac4fa3383b40a473c45a6e13e286f22';
const NPM_INTEGRITY = 'sha512-BMbpIgoV9aELeBrB0Y120NgoigHb5OdcJwc+4e7uSnbTbamea6lo+gqcc4LAxzMaK3Jf+7LI1oCDE6yANsmxIQ==';
const PLAN_SHA256 = 'sha256:4c9f32f6e9a4a28bd987fc033708d3a607d8e7683c1ca126ca28ddb04eec6e29';

const TRANCHES = Object.freeze({
  'R1.1': ['Breadcrumbs', 'Button', 'Checkbox', 'Disclosure', 'DisclosureGroup', 'Group', 'Link', 'Meter', 'ProgressBar', 'Separator', 'ToggleButton'],
  'R1.2': ['Autocomplete', 'CheckboxGroup', 'DateField', 'DatePicker', 'DateRangePicker', 'Form', 'NumberField', 'SearchField', 'Switch', 'TextField', 'TimeField'],
  'R1.3': ['Calendar', 'ColorArea', 'ColorField', 'ColorPicker', 'ColorSlider', 'ColorSwatch', 'ColorSwatchPicker', 'ColorWheel', 'ComboBox', 'GridList', 'ListBox', 'Menu', 'RadioGroup', 'RangeCalendar', 'Select', 'Slider', 'Table', 'Tabs', 'TagGroup', 'ToggleButtonGroup', 'TokenField', 'Toolbar', 'Tree', 'Virtualizer'],
  'R1.4': ['DropZone', 'FileTrigger', 'Modal', 'Popover', 'PreviewTrigger', 'Toast', 'Tooltip'],
  'R1.5': []
});

const FAMILY_RUNTIME_EXPORTS = Object.freeze({
  Autocomplete: ['Autocomplete'],
  Breadcrumbs: ['Breadcrumbs', 'Breadcrumb'],
  Button: ['Button'],
  Calendar: ['Calendar', 'CalendarGrid', 'CalendarGridHeader', 'CalendarGridBody', 'CalendarHeaderCell', 'CalendarCell', 'CalendarMonthPicker', 'CalendarYearPicker', 'CalendarHeading'],
  Checkbox: ['Checkbox', 'CheckboxField', 'CheckboxButton'],
  CheckboxGroup: ['CheckboxGroup'],
  ColorArea: ['ColorArea'],
  ColorField: ['ColorField'],
  ColorPicker: ['ColorPicker'],
  ColorSlider: ['ColorSlider'],
  ColorSwatch: ['ColorSwatch'],
  ColorSwatchPicker: ['ColorSwatchPicker', 'ColorSwatchPickerItem'],
  ColorWheel: ['ColorWheel', 'ColorWheelTrack'],
  ComboBox: ['ComboBox', 'ComboBoxValue'],
  DateField: ['DateField', 'DateInput', 'DateSegment'],
  DatePicker: ['DatePicker'],
  DateRangePicker: ['DateRangePicker'],
  Disclosure: ['Disclosure', 'DisclosurePanel'],
  DisclosureGroup: ['DisclosureGroup'],
  DropZone: ['DropZone'],
  FileTrigger: ['FileTrigger'],
  Form: ['Form'],
  GridList: ['GridListLoadMoreItem', 'GridList', 'GridListItem', 'GridListHeader', 'GridListSection'],
  Group: ['Group'],
  Link: ['Link'],
  ListBox: ['ListBoxLoadMoreItem', 'ListBox', 'ListBoxItem', 'ListBoxSection'],
  Menu: ['Menu', 'MenuItem', 'MenuTrigger', 'MenuSection', 'SubmenuTrigger'],
  Meter: ['Meter'],
  Modal: ['Dialog', 'Modal', 'ModalOverlay'],
  NumberField: ['NumberField'],
  Popover: ['Popover'],
  PreviewTrigger: ['PreviewTrigger'],
  ProgressBar: ['ProgressBar'],
  RadioGroup: ['RadioGroup', 'Radio', 'RadioField', 'RadioButton'],
  RangeCalendar: ['RangeCalendar'],
  SearchField: ['SearchField'],
  Select: ['Select', 'SelectValue'],
  Separator: ['Separator'],
  Slider: ['Slider', 'SliderOutput', 'SliderTrack', 'SliderThumb', 'SliderFill'],
  Switch: ['Switch', 'SwitchField', 'SwitchButton'],
  Table: ['TableLoadMoreItem', 'Table', 'Row', 'Cell', 'Column', 'ColumnResizer', 'TableHeader', 'TableBody', 'ResizableTableContainer', 'TableFooter'],
  Tabs: ['Tabs', 'TabList', 'TabPanels', 'TabPanel', 'Tab'],
  TagGroup: ['TagGroup', 'TagList', 'Tag'],
  TextField: ['TextField'],
  TimeField: ['TimeField'],
  Toast: ['UNSTABLE_Toast', 'UNSTABLE_ToastRegion', 'UNSTABLE_ToastContent'],
  ToggleButton: ['ToggleButton'],
  ToggleButtonGroup: ['ToggleButtonGroup'],
  TokenField: ['TokenField', 'TokenInput', 'Token', 'TokenFieldValue'],
  Toolbar: ['Toolbar'],
  Tooltip: ['TooltipTrigger', 'Tooltip'],
  Tree: ['TreeLoadMoreItem', 'Tree', 'TreeItem', 'TreeItemContent', 'TreeHeader', 'TreeSection'],
  Virtualizer: ['Virtualizer', 'ListLayout', 'WaterfallLayout', 'Layout', 'LayoutInfo', 'Size', 'Rect', 'Point', 'GridLayout', 'TableLayout']
});

const EXISTING = Object.freeze({
  Button: 'SCOPE-COMP-BUTTON-REACT',
  Form: 'SCOPE-PATTERN-FORM-REACT',
  Modal: 'SCOPE-COMP-DIALOG-REACT',
  Select: 'SCOPE-COMP-SELECT-REACT',
  Switch: 'SCOPE-COMP-SWITCH-REACT',
  Tabs: 'SCOPE-COMP-TABS-REACT',
  TextField: 'SCOPE-COMP-TEXTFIELD-REACT',
  Toast: 'SCOPE-COMP-TOAST-REACT'
});

const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const normalize = value => Array.isArray(value)
  ? value.map(normalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort(cmp).map(key => [key, normalize(value[key])]))
    : value;
const canonicalJson = value => JSON.stringify(normalize(value));
const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const run = (command, args, options = {}) => execFileSync(command, args, {
  encoding: 'utf8',
  maxBuffer: 128 * 1024 * 1024,
  ...options
});
const git = args => run('git', ['-C', REPO, ...args]).trim();
const gitBytes = (ref, path) => execFileSync('git', ['-C', REPO, 'show', `${ref}:${path}`], {
  maxBuffer: 128 * 1024 * 1024
});
const ghJson = path => JSON.parse(run('gh', ['api', path]));
const scopeIdFor = family => EXISTING[family] ?? `SCOPE-COMP-${family.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-REACT`;

const outputPath = process.argv[2];
if (!outputPath) throw new Error('OUTPUT_PATH_REQUIRED');
const envelopePath = process.argv[3] ?? `${outputPath}.identity.json`;
const toolPath = fileURLToPath(import.meta.url);
const toolBytes = readFileSync(toolPath);
const toolSha256 = sha256(toolBytes);
const coreCommit = git(['rev-parse', CORE_REF]);
const coreTree = git(['rev-parse', `${CORE_REF}^{tree}`]);
if (coreCommit !== 'dea987aca51cde9da67fe3cac16c5e69a8c46016') throw new Error('CORE_SOURCE_DRIFT');
if (coreTree !== 'af0f923abaf8cdf55acb3c402fa929cfb439335d') throw new Error('CORE_TREE_DRIFT');

const upstreamCommit = ghJson(`repos/${UPSTREAM_REPO}/git/commits/${UPSTREAM_COMMIT}`);
if (upstreamCommit.tree.sha !== UPSTREAM_TREE) throw new Error('UPSTREAM_TREE_DRIFT');
const upstreamTree = ghJson(`repos/${UPSTREAM_REPO}/git/trees/${UPSTREAM_COMMIT}?recursive=1`);
if (upstreamTree.truncated) throw new Error('UPSTREAM_TREE_TRUNCATED');
const requiredTrees = {
  'packages/dev/s2-docs/pages/react-aria': DOCS_TREE,
  'packages/react-aria-components': PACKAGE_TREE,
  'packages/react-aria-components/exports': EXPORTS_TREE
};
for (const [path, expected] of Object.entries(requiredTrees)) {
  const actual = upstreamTree.tree.find(entry => entry.type === 'tree' && entry.path === path)?.sha;
  if (actual !== expected) throw new Error(`UPSTREAM_SUBTREE_DRIFT:${path}`);
}
const docsPrefix = 'packages/dev/s2-docs/pages/react-aria/';
const pages = upstreamTree.tree
  .filter(entry => entry.type === 'blob' && new RegExp(`^${docsPrefix}[A-Z][^/]*\\.mdx$`).test(entry.path))
  .sort((a, b) => cmp(a.path, b.path))
  .map(entry => {
    const blob = ghJson(`repos/${UPSTREAM_REPO}/git/blobs/${entry.sha}`);
    const bytes = Buffer.from(blob.content.replace(/\n/g, ''), blob.encoding);
    if (bytes.byteLength !== entry.size) throw new Error(`DOC_BYTES_DRIFT:${entry.path}`);
    const body = bytes.toString('utf8');
    return {
      blob: entry.sha,
      body,
      bytes: entry.size,
      name: entry.path.slice(docsPrefix.length, -4),
      path: entry.path,
      section: body.match(/^export const section = ['"]([^'"]+)['"];/m)?.[1] ?? 'Components',
      sha256: sha256(bytes),
      stability: body.match(/^export const version = ['"]([^'"]+)['"];/m)?.[1] ?? 'stable'
    };
  });
const componentPages = pages.filter(page => page.section === 'Components');
const excludedPages = pages.filter(page => page.section !== 'Components');
if (pages.length !== 59) throw new Error(`DOCUMENTED_CAPITAL_PAGE_COUNT:${pages.length}`);
if (componentPages.length !== 53) throw new Error(`DOCUMENTED_FAMILY_COUNT:${componentPages.length}`);
const expectedExcluded = ['FocusRing:Interactions', 'FocusScope:Interactions', 'I18nProvider:Utilities', 'PortalProvider:Utilities', 'SSRProvider:Utilities', 'VisuallyHidden:Utilities'];
if (canonicalJson(excludedPages.map(page => `${page.name}:${page.section}`)) !== canonicalJson(expectedExcluded)) {
  throw new Error('DOCUMENTED_NON_FAMILY_BOUNDARY_DRIFT');
}

const snapshotPath = 'catalog/react-r1-0/upstream-snapshot.json';
const exportsPath = 'catalog/react-r1-0/upstream-exports.json';
const priorSnapshotBytes = gitBytes(CORE_REF, snapshotPath);
const priorExportsBytes = gitBytes(CORE_REF, exportsPath);
const priorSnapshot = JSON.parse(priorSnapshotBytes);
const priorExports = JSON.parse(priorExportsBytes);
if (priorSnapshot.package !== 'react-aria-components' || priorSnapshot.version !== '1.20.0' || priorSnapshot.commit !== UPSTREAM_COMMIT || priorSnapshot.tree !== UPSTREAM_TREE) {
  throw new Error('PRIOR_UPSTREAM_IDENTITY_DRIFT');
}
if (priorSnapshot.items.length !== 613 || priorExports.items.length !== 613) throw new Error('RAW_EXPORT_COUNT_DRIFT');
if (new Set(priorSnapshot.items.map(item => item.name)).size !== 613) throw new Error('RAW_EXPORT_DUPLICATE');
if (canonicalJson(priorSnapshot.items.map(({name, source, value}) => ({name, source, value}))) !== canonicalJson(priorExports.items)) {
  throw new Error('RAW_EXPORT_DERIVATION_DRIFT');
}
const componentKinds = new Set(['component', 'compositional-pattern']);
const componentFacingCount = priorSnapshot.items.filter(item => componentKinds.has(item.kind)).length;
if (componentFacingCount !== 132 || priorSnapshot.items.length - componentFacingCount !== 481) {
  throw new Error('RAW_EXPORT_CLASSIFICATION_COUNT_DRIFT');
}
const lockfileBytes = gitBytes(CORE_REF, 'pnpm-lock.yaml');
const lockfileText = lockfileBytes.toString('utf8');
if (!lockfileText.includes('react-aria-components@1.20.0:') || !lockfileText.includes(`integrity: ${NPM_INTEGRITY}`)) {
  throw new Error('NPM_INTEGRITY_DRIFT');
}

const familyNames = componentPages.map(page => page.name);
const trancheNames = Object.values(TRANCHES).flat();
if (trancheNames.length !== 53 || new Set(trancheNames).size !== 53) throw new Error('TRANCHE_DUPLICATE_OR_COUNT');
if (canonicalJson([...trancheNames].sort(cmp)) !== canonicalJson([...familyNames].sort(cmp))) throw new Error('TRANCHE_FAMILY_SET_DRIFT');
if (canonicalJson(Object.keys(FAMILY_RUNTIME_EXPORTS).sort(cmp)) !== canonicalJson([...familyNames].sort(cmp))) {
  throw new Error('FAMILY_RUNTIME_EXPORT_FAMILY_SET_DRIFT');
}
const runtimeOwnerByExport = new Map();
for (const [family, names] of Object.entries(FAMILY_RUNTIME_EXPORTS)) {
  for (const name of names) {
    if (runtimeOwnerByExport.has(name)) throw new Error(`FAMILY_RUNTIME_EXPORT_DUPLICATE:${name}`);
    runtimeOwnerByExport.set(name, family);
  }
}
if (runtimeOwnerByExport.size !== 128) throw new Error(`FAMILY_RUNTIME_EXPORT_COUNT:${runtimeOwnerByExport.size}`);
for (const [name, family] of runtimeOwnerByExport) {
  const matches = priorSnapshot.items.filter(item => item.name === name);
  if (matches.length !== 1 || matches[0].value !== true) throw new Error(`FAMILY_RUNTIME_EXPORT_DRIFT:${family}:${name}`);
}

const familyMap = new Map();
for (const page of componentPages) {
  const rootExport = page.name === 'Toast' ? 'UNSTABLE_Toast' : page.name;
  const roots = priorSnapshot.items.filter(item => item.name === rootExport);
  if (roots.length !== 1 || !componentKinds.has(roots[0].kind)) throw new Error(`FAMILY_ROOT_DRIFT:${page.name}`);
  const tranche = Object.entries(TRANCHES).find(([, names]) => names.includes(page.name))?.[0];
  familyMap.set(page.name, {
    corePublicFamily: page.name === 'Modal' ? 'Dialog' : page.name,
    documentation: {blob: page.blob, bytes: page.bytes, path: page.path, section: page.section, sha256: page.sha256},
    family: page.name,
    rootExport,
    rootKind: roots[0].kind,
    scopeId: scopeIdFor(page.name),
    scopeIdDisposition: EXISTING[page.name] ? 'reuse-existing-exact-outcome' : 'add-new-immutable-outcome',
    source: roots[0].source,
    stability: page.stability,
    tranche
  });
}
if (Object.keys(EXISTING).length !== 8) throw new Error('EXISTING_SCOPE_ID_COUNT_DRIFT');
if (new Set([...familyMap.values()].map(family => family.scopeId)).size !== 53) throw new Error('SCOPE_ID_COLLISION');

const rootByExport = new Map([...familyMap.values()].map(family => [family.rootExport, family.family]));
const rawExports = priorSnapshot.items.map((item, index) => {
  const rootFamily = rootByExport.get(item.name);
  if (rootFamily) return {disposition: 'committed-family-root', familyNames: [rootFamily], index, kind: item.kind, name: item.name, source: item.source, upstreamTranche: item.tranche, value: item.value};
  const family = runtimeOwnerByExport.get(item.name);
  if (family) return {disposition: 'family-part', familyNames: [family], index, kind: item.kind, name: item.name, source: item.source, upstreamTranche: item.tranche, value: item.value};
  return {disposition: item.value ? 'internal-runtime-support' : 'internal-type-support', familyNames: [], index, kind: item.kind, name: item.name, source: item.source, upstreamTranche: item.tranche, value: item.value};
});
const dispositionNames = [...new Set(rawExports.map(item => item.disposition))].sort(cmp);
const dispositionCounts = Object.fromEntries(dispositionNames.map(name => [name, rawExports.filter(item => item.disposition === name).length]));
if (dispositionCounts['committed-family-root'] !== 53) throw new Error('ROOT_DISPOSITION_COUNT_DRIFT');
if (dispositionCounts['family-part'] !== 75) throw new Error('FAMILY_PART_DISPOSITION_COUNT_DRIFT');
if (dispositionCounts['internal-runtime-support'] !== 158) throw new Error('INTERNAL_RUNTIME_DISPOSITION_COUNT_DRIFT');
if (dispositionCounts['internal-type-support'] !== 327) throw new Error('INTERNAL_TYPE_DISPOSITION_COUNT_DRIFT');
if (rawExports.length !== 613 || rawExports.some(item => !item.disposition)) throw new Error('RAW_EXPORT_DISPOSITION_INCOMPLETE');
const families = [...familyMap.values()].sort((a, b) => cmp(a.family, b.family)).map(family => ({
  ...family,
  parts: rawExports.filter(item => item.familyNames.includes(family.family) && item.disposition !== 'committed-family-root').map(item => item.name)
}));

const coreInput = path => {
  const bytes = gitBytes(CORE_REF, path);
  return {blob: git(['rev-parse', `${CORE_REF}:${path}`]), bytes: bytes.byteLength, path, sha256: sha256(bytes)};
};
const snapshot = {
  authorityState: 'candidate-unaccepted',
  boundaryRule: {
    documentedFamily: 'A top-level capitalized MDX page in the pinned React Aria docs tree whose authored section is Components (or defaults to Components).',
    familyPart: 'A non-root runtime export explicitly assigned to one documented family by the immutable family-runtime-export table in the evaluation tool.',
    internalRuntimeSupport: 'Every value-bearing raw export not explicitly assigned to one documented family. It remains replaceable internal substrate support.',
    internalTypeSupport: 'Every type-only raw export. It remains replaceable internal substrate support unless a later Core-owned public contract admits an independently authored type.',
    rootNormalization: 'Toast maps to upstream UNSTABLE_Toast; all other family pages map to the same-named upstream root export.'
  },
  coreSource: {commit: coreCommit, tree: coreTree},
  counts: {
    documentedCapitalPages: pages.length,
    documentedFamilies: families.length,
    existingExactScopeIdsReused: Object.keys(EXISTING).length,
    familyOwnedRuntimeExports: runtimeOwnerByExport.size,
    internalSubstrateExports: rawExports.filter(item => item.disposition.startsWith('internal-')).length,
    newImmutableScopeIds: families.filter(family => family.scopeIdDisposition === 'add-new-immutable-outcome').length,
    priorRawComponentFacingExports: componentFacingCount,
    rawDispositionCounts: dispositionCounts,
    rawExports: rawExports.length,
    priorRawSupportingExports: 481
  },
  evaluation: {
    ghVersion: run('gh', ['--version']).split('\n')[0],
    nodeVersion: process.version,
    tool: {bytes: toolBytes.byteLength, path: 'tooling/audits/repository-policy/src/react-aria-family-evaluate.mjs', sha256: toolSha256}
  },
  excludedDocumentedPages: excludedPages.map(({blob, bytes, name, path, section, sha256: digest}) => ({blob, bytes, name, path, section, sha256: digest})),
  families,
  inputs: {
    approvedPlan: {path: 'strategy/core-ui-react-comprehensive-delivery-plan.final.md', sha256: PLAN_SHA256},
    coreRawClassification: coreInput(snapshotPath),
    coreRawExports: coreInput(exportsPath),
    lockfile: coreInput('pnpm-lock.yaml'),
    upstreamDocumentPages: pages.map(({body, ...page}) => page)
  },
  nonGoals: ['No RSC or client-boundary support', 'No React Aria public API re-export', 'No React Native or framework-free counterpart', 'No implementation, package, dependency, Project, publication, or release mutation'],
  rawExportDispositionGrammar: ['committed-family-root', 'family-part', 'internal-runtime-support', 'internal-type-support'],
  rawExports,
  schema: 'core-ui-react-family-evaluation-snapshot-v1',
  trancheDerivation: {
    rule: 'Eleven foundations/actions in R1.1; eleven field/form/date controls in R1.2; twenty-four collection/selection/color/virtualization families in R1.3; seven overlay/global/temporal families in R1.4; R1.5 implements no new family and closes the exact all-53 inventory, export manifest, support ledger, evidence, and prerelease boundary.',
    tranches: TRANCHES
  },
  upstream: {
    commit: UPSTREAM_COMMIT,
    docsTree: DOCS_TREE,
    exportsTree: EXPORTS_TREE,
    npmIntegrity: NPM_INTEGRITY,
    package: 'react-aria-components',
    packageTree: PACKAGE_TREE,
    repository: UPSTREAM_REPO,
    sourceInputs: priorSnapshot.inputs,
    tree: UPSTREAM_TREE,
    version: '1.20.0'
  }
};
const snapshotBytes = Buffer.from(canonicalJson(snapshot));
const envelope = {
  algorithm: 'sha256',
  byteLength: snapshotBytes.byteLength,
  digest: sha256(snapshotBytes),
  id: 'core-ui-react-aria-1.20.0-53-family-evaluation-v1',
  profile: 'core-ui-task-local-immutable-evaluation-v1',
  source: {commit: coreCommit, tree: coreTree},
  tool: {digest: toolSha256}
};
const envelopeBytes = Buffer.from(canonicalJson(envelope));
writeFileSync(outputPath, snapshotBytes);
writeFileSync(envelopePath, envelopeBytes);
process.stdout.write(`${canonicalJson({
  envelope: {...envelope, envelopeByteLength: envelopeBytes.byteLength, envelopeDigest: sha256(envelopeBytes)},
  newScopeIds: families.filter(family => family.scopeIdDisposition === 'add-new-immutable-outcome').map(family => family.scopeId),
  tranches: TRANCHES
})}\n`);
