import descriptor from '../../../packages/react/generated/descriptor.json' with { type: 'json' };
import familySnapshot from '../../../catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json' with { type: 'json' };
import r10Crosswalk from '../../../catalog/react-r1-0/donor-crosswalk.json' with { type: 'json' };
import r12Crosswalk from '../../../catalog/react-r1-2/donor-crosswalk.json' with { type: 'json' };
import r13Crosswalk from '../../../catalog/react-r1-3/donor-crosswalk.json' with { type: 'json' };
import r14Crosswalk from '../../../catalog/react-r1-4/donor-crosswalk.json' with { type: 'json' };

/** Shared browser/Node contract for the one-time donor comparison fixture. */
export const migrationStoryId = 'core-react-r1-1-button--default';
export const migrationQuery = Object.freeze({ 'core-ui-migration': '1' });
export const migrationFrame = Object.freeze({
  viewport: Object.freeze({ width: 1000, height: 700 }),
  // The Virtualizer's layout measures its host during mount. Keep that host
  // fixed in both renderers so the donor capture cannot depend on grid or
  // child-content sizing (or produce NaN layout widths).
  virtualizer: Object.freeze({ width: 340, height: 180 }),
  deviceScaleFactor: 1,
  background: Object.freeze({ light: '#ffffff', dark: '#000000' }),
  fontFamily: 'system-ui',
  reducedMotion: true,
});
// A non-enumerable symbol lets the private fixture pass the canonical contract
// through the existing Storybook adapters without forwarding migration-only
// fields to a public component or DOM node.
export const migrationFixtureSymbol = Symbol.for('core-ui.visual-migration.fixture');

const crosswalks = [r10Crosswalk, r12Crosswalk, r13Crosswalk, r14Crosswalk];
const donorDisposition = new Map(crosswalks.flatMap(({ components, button }) => [
  ...Object.entries(components),
  ...(button ? [['button', button]] : []),
]));
const snapshotFamilies = new Map(familySnapshot.families.map((family) => [family.corePublicFamily, family]));

function slug(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

const allRecords = descriptor.bindings.map((binding) => ({
  family: binding.export,
  slug: slug(binding.export),
  tranche: snapshotFamilies.get(binding.export)?.tranche,
  binding,
  disposition: donorDisposition.get(slug(binding.export))?.disposition,
}));

if (allRecords.length !== 53) throw new Error(`visual migration requires the canonical 53-family descriptor, found ${allRecords.length}`);

export const noApplicableDonorFamilies = Object.freeze(allRecords
  .filter(({ disposition }) => disposition === 'no-applicable-donor')
  .map(({ family }) => family));
export const applicableMigrationRecords = Object.freeze(allRecords.filter(({ disposition }) => disposition === 'adapt'));
if (applicableMigrationRecords.length !== 51 || noApplicableDonorFamilies.join(',') !== 'Group,TokenField') {
  throw new Error('visual migration donor dispositions must derive exactly 51 applicable families and Group/TokenField as no-applicable-donor');
}

const commonData = Object.freeze({
  label: 'Name',
  placeholder: 'Enter a name',
  items: Object.freeze(['Melbourne', 'Sydney']),
  options: Object.freeze([{ value: 's', label: 'Small' }, { value: 'l', label: 'Large' }]),
  choices: Object.freeze([{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }]),
  children: Object.freeze({
    disclosureGroup: Object.freeze([
      Object.freeze({ id: 'one', title: 'One', content: 'First panel' }),
      Object.freeze({ id: 'two', title: 'Two', content: 'Second panel' }),
    ]),
    toggleButtonGroup: Object.freeze([
      Object.freeze({ id: 'bold', label: 'Bold' }),
      Object.freeze({ id: 'italic', label: 'Italic' }),
    ]),
    toolbar: Object.freeze(['Bold', 'Italic']),
    form: Object.freeze({ fieldLabel: 'Name', submit: 'Save' }),
  }),
  columns: Object.freeze([{ id: 'name', label: 'Name', isRowHeader: true }, { id: 'role', label: 'Role' }]),
  rows: Object.freeze([{ id: 'ada', values: Object.freeze({ name: 'Ada', role: 'Engineer' }) }, { id: 'grace', values: Object.freeze({ name: 'Grace', role: 'Designer' }) }]),
  date: '2026-08-26',
  dateRange: Object.freeze({ start: '2026-08-26', end: '2026-09-01' }),
  time: '09:30',
  color: '#ff0000',
  values: Object.freeze({ meter: 72, progress: 64, number: 2, slider: 60 }),
});

const familyCopy = Object.freeze({
  Autocomplete: 'Choose a city', Breadcrumbs: 'Breadcrumb', Button: 'Save', Calendar: 'Date', Checkbox: 'Enable notifications',
  CheckboxGroup: 'Notifications', ColorArea: 'Color', ColorField: 'Color', ColorPicker: 'Color', ColorSlider: 'Red', ColorSwatch: 'Red',
  ColorSwatchPicker: 'Palette', ColorWheel: 'Hue', ComboBox: 'Choose a city', DateField: 'Birthday', DatePicker: 'Due date',
  DateRangePicker: 'Trip dates', Disclosure: 'Details', DisclosureGroup: 'One', DropZone: 'Upload files', FileTrigger: 'Choose files',
  Form: 'Name', GridList: 'Grid', Link: 'Settings', ListBox: 'List', Menu: 'Actions', Meter: 'Storage', Dialog: 'Delete draft',
  NumberField: 'Quantity', Popover: 'More actions', PreviewTrigger: 'Document preview', ProgressBar: 'Upload', RadioGroup: 'Size',
  RangeCalendar: 'Trip', SearchField: 'Search', Select: 'Choose a city', Separator: '', Slider: 'Volume', Switch: 'Notifications',
  Table: 'People', Tabs: 'Sections', TagGroup: 'Tags', ToggleButton: 'Pin', ToggleButtonGroup: 'Formatting', Toolbar: 'Formatting',
  Tooltip: 'Keyboard shortcut: ⌘K', Tree: 'Files', Virtualizer: 'Results', TimeField: 'Start time', TextField: 'Name', Toast: 'Saved',
});

/** The semantic copy/data contract is shared by the Core and donor adapters. */
export function fixtureContractFor(record) {
  const { family } = record;
  return {
    copy: familyCopy[family] ?? family,
    data: {
      ...commonData,
      ...(family === 'TagGroup' ? { items: Object.freeze(['Design', 'Engineering']) } : {}),
      ...(family === 'ColorSwatchPicker' ? { items: Object.freeze([{ id: 'red', color: '#ff0000' }, { id: 'blue', color: '#0000ff' }]) } : {}),
      ...(family === 'Tree' ? { items: Object.freeze([{ id: 'src', label: 'src', children: [{ id: 'main', label: 'main.jsx' }] }]) } : {}),
      ...(family === 'Tabs' ? { items: Object.freeze([{ id: 'overview', label: 'Overview', panel: 'Overview content' }, { id: 'details', label: 'Details', panel: 'Details content' }]) } : {}),
    },
    frame: migrationFrame,
  };
}

const highSignalStateNames = Object.freeze(['selected', 'pressed', 'focused', 'invalid', 'open', 'expanded', 'drop-target', 'indeterminate', 'vertical']);
const portalFamilies = new Set(['Dialog', 'Popover', 'PreviewTrigger', 'Toast', 'Tooltip']);
const openPortalFamilies = new Set(['DatePicker', 'DateRangePicker', 'ComboBox', 'Select']);

export function semanticRegionFor(family, state) {
  if (!portalFamilies.has(family) && !(state === 'open' && openPortalFamilies.has(family))) {
    return {
      capture: 'component',
      selector: '.migration-component',
      requiredSelectors: ['.migration-component'],
    };
  }
  const requiredSelectors = {
    Dialog: state === 'open' ? ['.core-dialog-backdrop', '.core-dialog', '.core-button'] : ['.core-button'],
    Popover: state === 'open' ? ['.core-popover-positioner', '.core-popover', '.core-button'] : ['.core-button'],
    PreviewTrigger: state === 'open' ? ['.core-preview-trigger', '.core-button'] : ['.core-button'],
    Toast: ['.core-toast-region', '.core-toast'],
    Tooltip: state === 'open' ? ['.core-tooltip', '.core-button'] : ['.core-button'],
    DatePicker: ['.core-date-trigger', '.core-date-popover', '.core-date-dialog', '.core-calendar'],
    DateRangePicker: ['.core-date-trigger', '.core-date-popover', '.core-date-dialog', '.core-calendar'],
    ComboBox: ['.core-combo-box-trigger', '.core-combo-box-popover', '.core-combo-box-option'],
    Select: ['.core-select-trigger', '.core-select-popover', '.core-select-option'],
  }[family];
  return {
    capture: 'viewport',
    selector: 'body',
    requiredSelectors,
  };
}

function hasState(record, state) {
  const { binding, family } = record;
  const props = new Set(binding.api.props);
  const states = new Set(binding.states.map((value) => value.toLowerCase().replaceAll('-', '')));
  if (state === 'focused') return states.has('focused');
  if (state === 'pressed') return family === 'Button' || family === 'ToggleButton';
  if (state === 'drop-target') return family === 'DropZone';
  if (state === 'vertical') return props.has('orientation');
  if (state === 'selected') return props.has('checked') || props.has('selected') || props.has('selectedIds') || props.has('selectedId') || props.has('value') && ['Calendar', 'RangeCalendar', 'Select', 'Tabs', 'ColorSwatchPicker', 'CheckboxGroup', 'RadioGroup'].includes(family);
  if (state === 'invalid') return props.has('invalid');
  if (state === 'open') return props.has('open') || ['DatePicker', 'DateRangePicker', 'ComboBox', 'Select', 'Dialog', 'Popover', 'PreviewTrigger', 'Tooltip'].includes(family);
  if (state === 'expanded') return props.has('expanded') || props.has('expandedIds');
  if (state === 'indeterminate') return props.has('indeterminate') || family === 'ProgressBar';
  return false;
}

function actionFor(family, state) {
  if (state === 'open') {
    const selector = {
      DatePicker: '.core-date-trigger', DateRangePicker: '.core-date-trigger',
      ComboBox: '.core-combo-box-trigger', Select: '.core-select-trigger',
    }[family];
    return selector ? { type: 'open', selector } : undefined;
  }
  if (state === 'drop-target') return { type: 'drop-target', selector: '.migration-component' };
  if (state === 'focused' || state === 'focus') return { type: 'focus', selector: '.migration-component' };
  if (state === 'pressed') return { type: 'pressed', selector: '.migration-component' };
  return undefined;
}

export const migrationCases = Object.freeze(applicableMigrationRecords.flatMap((record) => {
  const states = ['idle', ...highSignalStateNames.filter((state) => hasState(record, state))];
  return states.map((state) => ({
    id: `${record.slug}-${state}`,
    component: record.family,
    slug: record.slug,
    tranche: record.tranche,
    state,
    selector: `[data-core-migration-case="${record.slug}-${state}"]`,
    action: actionFor(record.family, state),
    fixture: fixtureContractFor(record),
    region: semanticRegionFor(record.family, state),
  }));
}));

/**
 * Return the only fixture object that may cross the Core/Tale adapter boundary.
 * Both adapters call this function at runtime; neither adapter may substitute
 * copy, data, state, or frame values from its own renderer defaults.
 */
export function sharedFixtureInput(entry) {
  const canonical = migrationCases.find(({ id }) => id === entry?.id);
  if (!canonical || canonical.component !== entry.component || canonical.state !== entry.state) {
    throw new Error(`unknown canonical migration fixture: ${entry?.id ?? 'unknown case'}`);
  }
  return structuredClone({
    id: canonical.id,
    family: canonical.component,
    state: canonical.state,
    copy: canonical.fixture.copy,
    data: canonical.fixture.data,
    frame: canonical.fixture.frame,
    action: canonical.action,
    region: canonical.region,
  });
}

const rootPartSelectors = Object.freeze({
  Button: ['.core-button', '.tale-button'],
  Breadcrumbs: ['.core-breadcrumbs', '.tale-breadcrumbs'],
  Checkbox: ['.core-checkbox', '.tale-checkbox'],
  Disclosure: ['.core-disclosure', '.tale-disclosure'],
  DisclosureGroup: ['.core-disclosure-group', '.tale-disclosure'],
  Link: ['.core-link', '.tale-link'],
  Meter: ['.core-meter', '.tale-meter'],
  ProgressBar: ['.core-progress-bar', '.tale-progress-bar'],
  Separator: ['.core-separator', '.tale-separator'],
  ToggleButton: ['.core-toggle-button', '.tale-toggle-button'],
  Autocomplete: ['.core-autocomplete-search', '.tale-autocomplete__search-field'],
  CheckboxGroup: ['.core-checkbox-group', '.tale-checkbox-group'],
  DateField: ['.core-date-field', '.tale-date-field'],
  DatePicker: ['.core-date-picker', '.tale-date-picker'],
  DateRangePicker: ['.core-date-range-picker', '.tale-date-range-picker'],
  Form: ['.core-form', '.tale-form'],
  NumberField: ['.core-number-field', '.tale-number-field'],
  SearchField: ['.core-search-field', '.tale-search-field'],
  Switch: ['.core-switch', '.tale-switch'],
  TextField: ['.core-text-field', '.tale-text-field'],
  TimeField: ['.core-time-field', '.tale-time-field'],
  Calendar: ['.core-calendar', '.tale-calendar'],
  ColorArea: ['.core-color-area', '.tale-color-area'],
  ColorField: ['.core-color-field', '.tale-color-field'],
  ColorPicker: ['.core-color-picker', '.tale-color-area'],
  ColorSlider: ['.core-color-slider', '.tale-color-slider'],
  ColorSwatch: ['.core-color-swatch', '.tale-color-swatch'],
  ColorSwatchPicker: ['.core-color-swatch-picker-item', '.tale-color-swatch-picker__item'],
  ColorWheel: ['.core-color-wheel', '.tale-color-wheel'],
  ComboBox: ['.core-combo-box', '.tale-combobox'],
  GridList: ['.core-grid-list', '.tale-grid-list'],
  ListBox: ['.core-list-box', '.tale-list-box'],
  Menu: ['.core-menu-item', '.tale-menu__item'],
  RadioGroup: ['.core-radio-group', '.tale-radio-group'],
  RangeCalendar: ['.core-range-calendar', '.tale-range-calendar'],
  Select: ['.core-select', '.tale-select'],
  Slider: ['.core-slider', '.tale-slider'],
  Table: ['.core-table', '.tale-table'],
  Tabs: ['.core-tabs', '.tale-tabs'],
  TagGroup: ['.core-tag-group', '.tale-tag-group'],
  ToggleButtonGroup: ['.core-toggle-button-group', '.tale-toggle-button-group'],
  Toolbar: ['.core-toolbar', '.tale-toolbar'],
  Tree: ['.core-tree', '.tale-tree'],
  Virtualizer: ['.core-virtualizer', '.tale-virtualizer'],
  DropZone: ['.core-drop-zone', '.tale-drop-zone'],
  FileTrigger: ['.core-button', '.tale-button'],
  Dialog: ['.core-dialog', '.tale-dialog__popup'],
  Popover: ['.core-popover', '.tale-popover__popup'],
  PreviewTrigger: ['.core-preview-trigger', '.tale-preview-card__trigger'],
  Toast: ['.core-toast', '.tale-toast'],
  Tooltip: ['.core-tooltip', '.tale-tooltip__popup'],
});

/** Selectors identify mapped renderer parts, not the artificial fixture frame. */
export function equivalentPartSelectorsFor(family, state = 'idle') {
  const selectors = rootPartSelectors[family];
  if (!selectors) throw new Error(`missing equivalent-part selector mapping for ${family}`);
  const triggerFamilies = new Set(['DatePicker', 'DateRangePicker', 'ComboBox', 'Select', 'PreviewTrigger', 'Tooltip']);
  if (state !== 'open' && (triggerFamilies.has(family) || ['Dialog', 'Popover'].includes(family))) {
    return family === 'PreviewTrigger'
      ? ['.core-button', '.tale-preview-card__trigger']
      : family === 'Tooltip'
        ? ['.core-button', '.tale-tooltip__trigger']
        : family === 'Dialog'
          ? ['.core-button', '.tale-button']
        : family === 'Popover' ? ['.core-button', '.tale-button']
      : family === 'ComboBox' ? ['.core-combo-box-trigger', '.tale-combobox__trigger']
        : family === 'Select' ? ['.core-select-trigger', '.tale-select__trigger']
          : ['.core-date-trigger', `.tale-${family === 'DatePicker' ? 'date-picker' : 'date-range-picker'}__trigger`];
  }
  return selectors;
}

export const migrationFamilyNames = Object.freeze(applicableMigrationRecords.map(({ family }) => family));
export const migrationStateNames = Object.freeze([...new Set(migrationCases.map(({ state }) => state))]);

export function isMigrationFixtureRequest(storyId, search) {
  if (storyId !== migrationStoryId) return false;
  const values = new URLSearchParams(search).getAll('core-ui-migration');
  return values.length === 1 && values[0] === migrationQuery['core-ui-migration'];
}
