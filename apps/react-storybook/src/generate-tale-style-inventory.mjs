import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const donorRoot = '/Users/admin/Projects/tale-ui/tale-ui';
const donorCommit = '94bf62a26c02605c8928dfeb24f0ddc4be1c92fd';
const donorTree = 'e36c96f683772eedf4652d6adbe7dbcbd1d41f94';
const outputPath = new URL('../visual-migration/tale-style-inventory.json', import.meta.url);

const directOwners = new Map([
  ['accordion.css', ['DisclosureGroup']], ['autocomplete.css', ['Autocomplete']], ['breadcrumbs.css', ['Breadcrumbs']],
  ['calendar.css', ['Calendar']], ['checkbox.css', ['Checkbox', 'CheckboxGroup']], ['color-area.css', ['ColorArea']],
  ['color-field.css', ['ColorField']], ['color-picker.css', ['ColorPicker']], ['color-slider.css', ['ColorSlider']],
  ['color-swatch-picker.css', ['ColorSwatchPicker']], ['color-swatch.css', ['ColorSwatch']], ['color-wheel.css', ['ColorWheel']],
  ['combobox.css', ['ComboBox']], ['date-field.css', ['DateField']], ['date-picker.css', ['DatePicker']],
  ['date-range-picker.css', ['DateRangePicker']], ['dialog.css', ['Dialog']], ['disclosure.css', ['Disclosure']],
  ['drop-zone.css', ['DropZone']], ['file-trigger.css', ['FileTrigger']], ['form.css', ['Form']], ['grid-list.css', ['GridList']],
  ['link.css', ['Link']], ['list-box.css', ['ListBox']], ['menu.css', ['Menu']], ['meter.css', ['Meter']],
  ['number-field.css', ['NumberField']], ['popover.css', ['Popover']], ['preview-card.css', ['PreviewTrigger']],
  ['progress-bar.css', ['ProgressBar']], ['radio.css', ['RadioGroup']], ['range-calendar.css', ['RangeCalendar']],
  ['search-field.css', ['SearchField']], ['select.css', ['Select']], ['separator.css', ['Separator']], ['slider.css', ['Slider']],
  ['switch.css', ['Switch']], ['table.css', ['Table']], ['tabs.css', ['Tabs']], ['tag-group.css', ['TagGroup']],
  ['text-field.css', ['TextField']], ['time-field.css', ['TimeField']], ['toast.css', ['Toast']],
  ['toggle-button.css', ['ToggleButton', 'ToggleButtonGroup']], ['toolbar.css', ['Toolbar']], ['tooltip.css', ['Tooltip']], ['tree.css', ['Tree']],
]);

const shared = new Map([
  ['_primitives.css', { disposition: 'shared-primitives', reason: 'Shared layout, control, and focus primitives are consumed by the fixture closure.', consumers: ['all donor fixtures'] }],
  ['button.css', { disposition: 'shared-nested-support', reason: 'Nested Tale Button triggers and actions are rendered by the fixture closure.', consumers: ['Button', 'Form', 'FileTrigger', 'Dialog', 'Popover', 'PreviewTrigger', 'Tooltip', 'Toolbar'] }],
  ['field.css', { disposition: 'shared-nested-support', reason: 'Field.Root and Field.Label wrap the CheckboxGroup and RadioGroup donor compositions.', consumers: ['CheckboxGroup', 'RadioGroup'] }],
  ['icon.css', { disposition: 'shared-nested-support', reason: 'Tale Icon wraps pinned Lucide affordances in Checkbox, CheckboxGroup, NumberField, and SearchField fixtures.', consumers: ['Checkbox', 'CheckboxGroup', 'NumberField', 'SearchField'] }],
  ['icon-button.css', { disposition: 'shared-nested-support', reason: 'Calendar navigation and NumberField stepper affordances render Tale icon-button classes.', consumers: ['Calendar', 'DatePicker', 'DateRangePicker', 'NumberField', 'RangeCalendar'] }],
  ['spinner.css', { disposition: 'shared-nested-support', reason: 'The Button pending composition renders Tale Spinner anatomy.', consumers: ['Button'] }],
]);

const special = new Map([
  ['index.css', { disposition: 'aggregate', reason: 'Aggregate stylesheet import; it has no independent component selector ownership.', consumers: ['all donor fixtures'] }],
  ['_dark-overrides.css', { disposition: 'scaffold', reason: 'Dark-mode override import scaffold; component rules remain owned by their mapped stylesheets.', consumers: ['all donor fixtures'] }],
]);

const activeCssFoundationPaths = [
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
];

function digest(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function blob(path) {
  return execFileSync('git', ['-C', donorRoot, 'rev-parse', `${donorCommit}:${path}`], { encoding: 'utf8' }).trim();
}

const paths = execFileSync('git', ['-C', donorRoot, 'ls-tree', '-r', '--name-only', donorCommit, 'packages/styles/src'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).sort();
if (paths.length !== 125) throw new Error(`expected 125 pinned Tale styles, found ${paths.length}`);

const files = paths.map((path) => {
  const filename = path.slice('packages/styles/src/'.length);
  const classification = special.get(filename) ?? shared.get(filename);
  const owners = directOwners.get(filename);
  const entry = classification ?? (owners ? {
    disposition: 'direct-family-owner',
    reason: `Direct Tale stylesheet for ${owners.join(' and ')} fixture${owners.length === 1 ? '' : 's'}.`,
    consumers: owners,
  } : {
    disposition: 'donor-only-no-fixed-family',
    reason: 'Pinned Tale stylesheet has no selector or import used by the 51-family fixture closure; it makes no Core support claim.',
    consumers: [],
  });
  const bytes = execFileSync('git', ['-C', donorRoot, 'show', `${donorCommit}:${path}`]);
  return {
    path,
    blob: blob(path),
    sha256: digest(bytes),
    disposition: entry.disposition,
    reason: entry.reason,
    fixtureConsumers: entry.consumers,
    coreSupportClaim: !['donor-only-no-fixed-family', 'aggregate', 'scaffold'].includes(entry.disposition),
  };
});

const activeCssFoundationImports = activeCssFoundationPaths.sort().map((path) => {
  const bytes = execFileSync('git', ['-C', donorRoot, 'show', `${donorCommit}:${path}`]);
  return {
    path,
    blob: blob(path),
    sha256: digest(bytes),
    reason: 'Pinned Tale CSS foundation imported by the donor stylesheet closure and consumed by the migration fixture.',
  };
});

const counts = Object.fromEntries([...new Set(files.map(({ disposition }) => disposition))].sort().map((disposition) => [disposition, files.filter((file) => file.disposition === disposition).length]));
const inventory = {
  schema: 'core-ui-tale-style-inventory-v1',
  donor: { repository: 'tale-ui/tale-ui', commit: donorCommit, tree: donorTree, path: 'packages/styles/src', fileCount: files.length },
  closure: { fixtureFamilies: 51, noApplicableDonorFamilies: ['Group', 'TokenField'], basis: 'actual selector/import use in the pinned donor fixture closure' },
  counts,
  activeCssFoundationImports,
  files,
};
await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
