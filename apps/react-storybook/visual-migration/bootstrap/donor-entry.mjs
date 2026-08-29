import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as InternationalizedDate from '@internationalized/date';
import '@tale-ui/react-styles';
import * as ButtonPackage from '@tale-ui/react/button';
import * as BreadcrumbsPackage from '@tale-ui/react/breadcrumbs';
import * as CheckboxPackage from '@tale-ui/react/checkbox';
import * as DisclosurePackage from '@tale-ui/react/disclosure';
import * as LinkPackage from '@tale-ui/react/link';
import * as MeterPackage from '@tale-ui/react/meter';
import * as ProgressBarPackage from '@tale-ui/react/progress-bar';
import * as SeparatorPackage from '@tale-ui/react/separator';
import * as ToggleButtonPackage from '@tale-ui/react/toggle-button';
import * as AutocompletePackage from '@tale-ui/react/autocomplete';
import * as CheckboxGroupPackage from '@tale-ui/react/checkbox-group';
import * as DateFieldPackage from '@tale-ui/react/date-field';
import * as DatePickerPackage from '@tale-ui/react/date-picker';
import * as DateRangePickerPackage from '@tale-ui/react/date-range-picker';
import * as FormPackage from '@tale-ui/react/form';
import * as NumberFieldPackage from '@tale-ui/react/number-field';
import * as SearchFieldPackage from '@tale-ui/react/search-field';
import * as FieldPackage from '@tale-ui/react/field';
import * as SwitchPackage from '@tale-ui/react/switch';
import * as TextFieldPackage from '@tale-ui/react/text-field';
import * as TimeFieldPackage from '@tale-ui/react/time-field';
import * as CalendarPackage from '@tale-ui/react/calendar';
import * as ColorAreaPackage from '@tale-ui/react/color-area';
import * as ColorFieldPackage from '@tale-ui/react/color-field';
import * as ColorPickerPackage from '@tale-ui/react/color-picker';
import * as ColorSliderPackage from '@tale-ui/react/color-slider';
import * as ColorSwatchPackage from '@tale-ui/react/color-swatch';
import * as ColorSwatchPickerPackage from '@tale-ui/react/color-swatch-picker';
import * as ColorWheelPackage from '@tale-ui/react/color-wheel';
import * as ComboBoxPackage from '@tale-ui/react/combobox';
import * as GridListPackage from '@tale-ui/react/grid-list';
import * as ListBoxPackage from '@tale-ui/react/list-box';
import * as MenuPackage from '@tale-ui/react/menu';
import * as RadioPackage from '@tale-ui/react/radio-group';
import * as RadioFieldPackage from '@tale-ui/react/radio';
import * as RangeCalendarPackage from '@tale-ui/react/range-calendar';
import * as SelectPackage from '@tale-ui/react/select';
import * as SliderPackage from '@tale-ui/react/slider';
import * as TablePackage from '@tale-ui/react/table';
import * as TabsPackage from '@tale-ui/react/tabs';
import * as TagGroupPackage from '@tale-ui/react/tag-group';
import * as ToolbarPackage from '@tale-ui/react/toolbar';
import * as TreePackage from '@tale-ui/react/tree';
import * as VirtualizerPackage from '@tale-ui/react/virtualizer';
import * as DropZonePackage from '@tale-ui/react/drop-zone';
import * as FileTriggerPackage from '@tale-ui/react/file-trigger';
import * as DialogPackage from '@tale-ui/react/dialog';
import * as PopoverPackage from '@tale-ui/react/popover';
import * as PreviewCardPackage from '@tale-ui/react/preview-card';
import * as ToastPackage from '@tale-ui/react/toast';
import * as TooltipPackage from '@tale-ui/react/tooltip';
import { equivalentPartSelectorsFor, migrationCases, migrationFrame, sharedFixtureInput } from '../../src/visual-migration-contract.mjs';
import { renderFamilyPlan } from './donor-render-plan.mjs';

const h = React.createElement;
const createRoot = ReactDOMClient.createRoot ?? ReactDOMClient.default?.createRoot;
if (!createRoot) throw new Error('Tale bootstrap could not resolve ReactDOM.createRoot from the pinned Tale runtime');
const parseDate = InternationalizedDate.parseDate ?? InternationalizedDate.default?.parseDate;
const parseTime = InternationalizedDate.parseTime ?? InternationalizedDate.default?.parseTime;
if (!parseDate || !parseTime) throw new Error('Tale bootstrap could not resolve date helpers from the pinned Tale runtime');
const packages = {
  Button: ButtonPackage,
  Breadcrumbs: BreadcrumbsPackage.Breadcrumbs,
  Checkbox: CheckboxPackage.Checkbox,
  Disclosure: DisclosurePackage.Disclosure,
  DisclosureGroup: DisclosurePackage.Disclosure,
  Link: LinkPackage,
  Meter: MeterPackage.Meter,
  ProgressBar: ProgressBarPackage.ProgressBar,
  Separator: SeparatorPackage,
  ToggleButton: ToggleButtonPackage,
  Autocomplete: AutocompletePackage.Autocomplete,
  CheckboxGroup: CheckboxGroupPackage,
  DateField: DateFieldPackage.DateField,
  DatePicker: DatePickerPackage.DatePicker,
  DateRangePicker: DateRangePickerPackage.DateRangePicker,
  Form: FormPackage,
  NumberField: NumberFieldPackage.NumberField,
  SearchField: SearchFieldPackage.SearchField,
  Switch: SwitchPackage.Switch,
  TextField: TextFieldPackage.TextField,
  TimeField: TimeFieldPackage.TimeField,
  Calendar: CalendarPackage.Calendar,
  ColorArea: ColorAreaPackage.ColorArea,
  ColorField: ColorFieldPackage.ColorField,
  ColorPicker: ColorPickerPackage.ColorPicker,
  ColorSlider: ColorSliderPackage.ColorSlider,
  ColorSwatch: ColorSwatchPackage,
  ColorSwatchPicker: ColorSwatchPickerPackage.ColorSwatchPicker,
  ColorWheel: ColorWheelPackage.ColorWheel,
  ComboBox: ComboBoxPackage.Combobox,
  GridList: GridListPackage.GridList,
  ListBox: ListBoxPackage.ListBox,
  Menu: MenuPackage.Menu,
  RadioGroup: { Group: RadioPackage.RadioGroup },
  RangeCalendar: RangeCalendarPackage.RangeCalendar,
  Select: SelectPackage.Select,
  Slider: SliderPackage.Slider,
  Table: TablePackage.Table,
  Tabs: TabsPackage.Tabs,
  TagGroup: TagGroupPackage.TagGroup,
  ToggleButtonGroup: ToggleButtonPackage,
  Toolbar: ToolbarPackage.Toolbar,
  Tree: TreePackage.Tree,
  Virtualizer: VirtualizerPackage,
  DropZone: DropZonePackage,
  FileTrigger: FileTriggerPackage,
  Dialog: DialogPackage.Dialog,
  Popover: PopoverPackage.Popover,
  PreviewTrigger: PreviewCardPackage.PreviewCard,
  Toast: ToastPackage,
  Tooltip: TooltipPackage.Tooltip,
};

function propsFor(entry) {
  const props = { className: 'migration-tale-root' };
  switch (entry.state) {
    case 'selected':
      props.isSelected = true;
      props.defaultSelected = true;
      break;
    case 'invalid':
      props.isInvalid = true;
      props.invalid = true;
      break;
    case 'indeterminate':
      props.isIndeterminate = true;
      props.indeterminate = true;
      break;
    case 'expanded':
      props.isExpanded = true;
      props.defaultExpanded = true;
      if (entry.component === 'Tree') {
        props.expandedKeys = ['src'];
        props.defaultExpandedKeys = ['src'];
      }
      break;
    case 'vertical':
      props.orientation = 'vertical';
      break;
    case 'focused':
      break;
    default:
      break;
  }
  return props;
}

function textItem(value, key) {
  if (value && typeof value === 'object') return h(React.Fragment, { key }, value.label ?? value.name ?? String(value.value ?? key));
  return h(React.Fragment, { key }, String(value));
}

function parseFixtureDate(value) {
  return parseDate(value);
}

function colorValue(value, packageNamespace) {
  return packageNamespace.parseColor ? packageNamespace.parseColor(value) : value;
}

function renderTreeItem(item, treePackage, key) {
  const children = item.children?.map((child) => renderTreeItem(child, treePackage, child.id));
  return h(treePackage.Item, { key, id: item.id, textValue: item.label },
    h(treePackage.ItemContent, null, item.label),
    children,
  );
}

function renderCalendar(packageNamespace, model, props, range = false) {
  const children = [
    h(packageNamespace.Header, { key: 'header' }, h(packageNamespace.PreviousButton), h(packageNamespace.Heading), h(packageNamespace.NextButton)),
    h(packageNamespace.Grid, { key: 'grid' },
      h(packageNamespace.GridHeader, { key: 'grid-header' }, (day) => h(packageNamespace.GridHeaderCell, { key: day }, day)),
      h(packageNamespace.GridBody, { key: 'grid-body' }, (date) => h(packageNamespace.Cell, { date, key: date.toString() })),
    ),
  ];
  return h(packageNamespace.Root, { ...props, defaultValue: range
    ? { start: parseFixtureDate(model.data.dateRange.start), end: parseFixtureDate(model.data.dateRange.end) }
    : parseFixtureDate(model.data.date) }, ...children);
}

function renderField(packageNamespace, model, props, kind) {
  const date = kind === 'time' ? parseTime(model.data.time) : parseFixtureDate(model.data.date);
  const Root = packageNamespace.Root;
  const Input = packageNamespace.DateInput;
  return h(Root, { ...props, label: model.copy, defaultValue: date },
    h(packageNamespace.Label, null, model.copy),
    h(Input, null, (segment) => h(packageNamespace.Segment, { segment, key: segment.type })),
  );
}

function renderFamily(entry, fixture) {
  return renderFamilyPlan(entry, fixture, {
    h,
    packages,
    ButtonPackage,
    ColorSwatchPackage,
    ToggleButtonPackage,
    RadioFieldPackage,
    SearchFieldPackage: SearchFieldPackage.SearchField,
    FieldPackage: FieldPackage.Field,
    CalendarPackage,
    RangeCalendarPackage,
    propsFor,
    parseFixtureDate,
    renderCalendar,
    renderField,
    renderTreeItem,
    ToastHarness,
    textItem,
    colorValue,
  });
}

function ToastHarness({ copy }) {
  const [queue] = React.useState(() => ToastPackage.createToastQueue());
  React.useEffect(() => {
    queue.add({ title: copy, description: copy });
  }, [copy, queue]);
  return h(ToastPackage.ToastRegion, { queue });
}

function stateAssertion(entry) {
  const root = document.querySelector(`[data-migration-case="${entry.id}"]`);
  if (!root) return false;
  const elements = [root, ...root.querySelectorAll('*')];
  const truthy = (element, name) => element.getAttribute(name) === 'true' || element.hasAttribute(name);
  switch (entry.state) {
    case 'focused': return root.contains(document.activeElement) && document.activeElement !== document.body;
    case 'pressed': return elements.some((element) => truthy(element, 'data-pressed') || element.getAttribute('aria-pressed') === 'true' || element.matches(':active'));
    case 'selected': return elements.some((element) => truthy(element, 'data-selected') || element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-checked') === 'true' || element.checked === true)
      || Boolean(root.querySelector('input[role="combobox"]')?.value || root.querySelector('.tale-select__value')?.textContent?.trim());
    case 'invalid': return elements.some((element) => truthy(element, 'data-invalid') || element.getAttribute('aria-invalid') === 'true');
    case 'open': return elements.some((element) => truthy(element, 'data-open') || element.getAttribute('aria-expanded') === 'true') || Boolean(document.querySelector('.tale-dialog__popup, .tale-popover__popup, .tale-preview-card__popup, .tale-tooltip__popup, .tale-date-picker__popover, .tale-date-range-picker__popover, .tale-combobox__popover, .tale-select__popover'));
    case 'expanded': return elements.some((element) => truthy(element, 'data-expanded') || element.getAttribute('aria-expanded') === 'true');
    case 'drop-target': return elements.some((element) => truthy(element, 'data-dragging') || truthy(element, 'data-drop-target') || element.matches('[data-drop-target]'));
    case 'indeterminate': return elements.some((element) => truthy(element, 'data-indeterminate') || element.indeterminate === true || element.getAttribute('aria-valuetext')?.toLowerCase().includes('indeterminate'));
    case 'vertical': return elements.some((element) => element.getAttribute('aria-orientation') === 'vertical' || element.getAttribute('data-orientation') === 'vertical' || getComputedStyle(element).flexDirection === 'column');
    default: return true;
  }
}

function requiredPartAssertion(entry) {
  const selectors = entry.component === 'DatePicker' && entry.state === 'open'
    ? ['.tale-date-picker__trigger', '.tale-date-picker__popover', '.tale-date-picker__dialog', '.tale-calendar']
    : entry.component === 'DateRangePicker' && entry.state === 'open'
      ? ['.tale-date-range-picker__trigger', '.tale-date-range-picker__popover', '.tale-date-range-picker__dialog', '.tale-range-calendar']
      : entry.component === 'ComboBox' && entry.state === 'open'
        ? ['.tale-combobox__trigger', '.tale-combobox__popover', '.tale-combobox__item']
        : entry.component === 'Select' && entry.state === 'open'
          ? ['.tale-select__trigger', '.tale-select__popover', '.tale-select__item']
          : entry.component === 'Dialog' && entry.state === 'open'
    ? ['.tale-dialog__backdrop', '.tale-dialog__popup', '.tale-button']
          : entry.component === 'Popover' && entry.state === 'open'
      ? ['.tale-popover__popup', '.tale-button']
          : entry.component === 'Popover'
            ? ['.tale-button']
        : entry.component === 'PreviewTrigger' && entry.state === 'open'
        ? ['.tale-preview-card__trigger', '.tale-preview-card__popup']
        : entry.component === 'Toast' ? ['.tale-toast-region', '.tale-toast']
            : entry.component === 'Tooltip' ? (entry.state === 'open' ? ['.tale-tooltip__popup', '.tale-tooltip__trigger'] : ['.tale-tooltip__trigger'])
            : ['.migration-component'];
  const beforeAction = entry.action?.type === 'open';
  const expected = beforeAction ? selectors.filter((selector) => selector.includes('trigger') || selector === '.tale-button') : selectors;
  return expected.every((selector) => document.querySelector(selector));
}

function styleFacts(entry) {
  const selector = equivalentPartSelectorsFor(entry.component, entry.state)[1];
  if (!selector) throw new Error(`Tale equivalent part has no mapped selector: ${entry.component}`);
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Tale equivalent part is absent: ${selector}`);
  const styles = getComputedStyle(target);
  return { selector, properties: { boxSizing: styles.boxSizing, fontSize: styles.fontSize } };
}

function Case({ entry }) {
  const fixture = sharedFixtureInput(entry);
  const wide = ['TextField', 'Autocomplete', 'ComboBox', 'Select'].includes(entry.component);
  const viewport = entry.component === 'Virtualizer' ? fixture.frame.virtualizer : undefined;
  return h('div', {
    'data-migration-case': entry.id,
    className: 'migration-component',
    style: {
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      padding: viewport ? 0 : '12px',
      background: 'var(--migration-frame-background)',
      width: viewport ? `${viewport.width}px` : wide ? '340px' : 'max-content',
      height: viewport ? `${viewport.height}px` : undefined,
    },
  }, h('div', {
    className: 'migration-equivalent-frame',
    style: viewport
      ? { boxSizing: 'border-box', width: `${viewport.width}px`, height: `${viewport.height}px` }
      : { display: 'contents', boxSizing: 'border-box' },
  }, renderFamily(entry, fixture)));
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('case');
  const entry = migrationCases.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`unknown canonical migration case: ${id}`);
  const mode = params.get('mode');
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.dataset.reducedMotion = 'true';
  document.documentElement.style.setProperty('--migration-frame-background', migrationFrame.background[mode]);
  document.documentElement.style.fontFamily = migrationFrame.fontFamily;
  document.body.style.fontFamily = migrationFrame.fontFamily;
  document.body.style.background = migrationFrame.background[mode];
  const root = document.getElementById('root');
  createRoot(root).render(h(Case, { entry }));
  window.__coreMigration = {
    ready: () => requiredPartAssertion(entry),
    state: () => stateAssertion(entry),
    styleFacts: () => styleFacts(entry),
  };
}

App();
