import React from 'react';
import * as Core from '@core-ui/react';

const BOOLEAN_PROPS = new Set([
  'acceptDirectory', 'allowsMultiple', 'checked', 'current', 'defaultChecked',
  'defaultExpanded', 'defaultOpen', 'defaultSelected', 'disabled', 'dismissable',
  'expanded', 'invalid', 'indeterminate', 'open', 'pending', 'readOnly', 'required',
  'shouldCloseOnSelect',
]);

const ARRAY_PROPS = new Set([
  'columns', 'defaultExpandedIds', 'defaultSelectedIds', 'expandedIds', 'items',
  'options', 'rows', 'selectedIds', 'value',
]);

const STRING_PROPS = new Set([
  'action', 'aria-label', 'aria-labelledby', 'children', 'className', 'color', 'content',
  'description', 'endName', 'errorMessage', 'href', 'label', 'message', 'name',
  'placeholder', 'rel', 'startName', 'target', 'title',
]);

const TEXT_VALUE_CONTEXT_PROPS = new Set(['placeholder', 'type']);
const NUMBER_PROPS = new Set([
  'closeDelay', 'delay', 'duration', 'height', 'itemHeight', 'maxLength', 'maxValue',
  'minLength', 'minValue', 'overscan', 'step',
]);

const NUMBER_VALUE_CONTEXT_PROPS = new Set(['max', 'min', 'step']);

const CONTROLLED_DEFAULT_PAIRS = Object.freeze([
  ['checked', 'defaultChecked'],
  ['expanded', 'defaultExpanded'],
  ['expandedIds', 'defaultExpandedIds'],
  ['open', 'defaultOpen'],
  ['selected', 'defaultSelected'],
  ['selectedId', 'defaultSelectedId'],
  ['selectedIds', 'defaultSelectedIds'],
  ['value', 'defaultValue'],
]);

const UNCONTROLLED_PROPS = new Map(CONTROLLED_DEFAULT_PAIRS);

const SELECT_PROPS = Object.freeze({
  colorSpace: ['hex', 'hsl', 'hsb', 'rgb'],
  method: ['get', 'post'],
  orientation: ['horizontal', 'vertical'],
  placement: ['top', 'bottom', 'left', 'right'],
  selectionMode: ['none', 'single', 'multiple'],
  type: ['text', 'email', 'password', 'url', 'tel'],
  validationBehavior: ['aria', 'native'],
  variant: ['neutral', 'info', 'success', 'warning', 'error'],
});

const callbackType = { summary: 'Core callback' };

function inferControl(name, defaults, props) {
  if (name.startsWith('on')) return { control: false, table: { type: callbackType } };
  if (name === 'trigger') return { control: false, table: { type: { summary: 'React element' } } };
  if (SELECT_PROPS[name]) return { control: { type: 'select' }, options: SELECT_PROPS[name] };
  if (BOOLEAN_PROPS.has(name) || typeof defaults[name] === 'boolean') return { control: 'boolean' };
  if ((name === 'value' || name === 'defaultValue')
    && props.some((prop) => TEXT_VALUE_CONTEXT_PROPS.has(prop))) {
    return { control: 'text' };
  }
  if ((name === 'value' || name === 'defaultValue')
    && props.some((prop) => NUMBER_VALUE_CONTEXT_PROPS.has(prop))) {
    return { control: { type: 'number' } };
  }
  if (ARRAY_PROPS.has(name) || Array.isArray(defaults[name])) return { control: 'object' };
  if (NUMBER_PROPS.has(name)) return { control: { type: 'number' } };
  if (typeof defaults[name] === 'number') return { control: { type: 'number' } };
  if (typeof defaults[name] === 'string') return { control: 'text' };
  if (STRING_PROPS.has(name)) return { control: 'text' };
  if (name === 'formatOptions' || name === 'acceptedFileTypes') return { control: 'object' };
  return { control: 'object' };
}

export function argTypesForBinding(binding) {
  const defaults = binding.api.defaults ?? {};
  return Object.fromEntries(binding.api.props.map((name) => [
    name,
    {
      ...inferControl(name, defaults, binding.api.props),
      description: `Core-owned ${name} property`,
      table: {
        ...(inferControl(name, defaults, binding.api.props).table ?? {}),
        defaultValue: defaults[name] === undefined ? undefined : { summary: defaults[name] },
      },
    },
  ]));
}

function normalizeDefaultArgs(binding) {
  const args = { ...(binding.api.defaults ?? {}) };
  const props = new Set(binding.api.props);
  for (const [controlled, uncontrolled] of CONTROLLED_DEFAULT_PAIRS) {
    if (!props.has(controlled) || !props.has(uncontrolled)) continue;
    if (args[uncontrolled] === undefined && args[controlled] !== undefined) {
      args[uncontrolled] = args[controlled];
    }
    delete args[controlled];
  }
  if (binding.export === 'Breadcrumbs' && Array.isArray(args.items) && args.items.length === 0) {
    delete args.items;
  }
  return args;
}

function setControlledArg(args, props, name, value) {
  args[name] = value;
  const uncontrolled = UNCONTROLLED_PROPS.get(name);
  if (uncontrolled && props.has(uncontrolled)) delete args[uncontrolled];
}

export function storyArgsForBinding(binding, variant, family) {
  const args = normalizeDefaultArgs(binding);
  if (variant !== 'states') return args;

  const props = new Set(binding.api.props);
  if (props.has('disabled')) args.disabled = true;
  if (props.has('invalid')) args.invalid = true;
  if (props.has('checked')) setControlledArg(args, props, 'checked', true);
  else if (props.has('defaultChecked')) args.defaultChecked = true;
  if (props.has('selected')) setControlledArg(args, props, 'selected', true);
  else if (props.has('defaultSelected')) args.defaultSelected = true;
  if (props.has('expanded')) setControlledArg(args, props, 'expanded', true);
  else if (props.has('defaultExpanded')) args.defaultExpanded = true;
  if (props.has('expandedIds')) {
    setControlledArg(args, props, 'expandedIds', family === 'Tree' ? ['src'] : ['one']);
  } else if (props.has('defaultExpandedIds')) {
    args.defaultExpandedIds = ['one'];
  }
  if (props.has('open')) setControlledArg(args, props, 'open', true);
  else if (props.has('defaultOpen')) args.defaultOpen = true;
  if (props.has('orientation')) args.orientation = 'vertical';
  if (props.has('value') && typeof args.value === 'number') {
    setControlledArg(args, props, 'value', Math.max(args.value, 72));
  }
  if (props.has('value') && args.value === undefined && typeof args.maxValue === 'number') {
    setControlledArg(args, props, 'value', args.maxValue);
  }
  if (props.has('value') && typeof args.value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(args.value)) {
    setControlledArg(args, props, 'value', '2026-09-01');
  }
  if (props.has('variant')) args.variant = 'success';
  if (props.has('method')) args.method = 'post';
  if (props.has('current')) args.current = true;
  return args;
}

const e = (type, props, ...children) => React.createElement(type, props, ...children);

function fallback(value, defaultValue) {
  return value === undefined || value === null || value === '' ? defaultValue : value;
}

const ADAPTERS = {
  Button: (args) => e(Core.Button, args, 'Save'),
  Breadcrumbs: (args) => e(Core.Breadcrumbs, { ...args, items: fallback(args.items, [{ id: 'home', label: 'Home', href: '/' }, { id: 'docs', label: 'Docs' }]), 'aria-label': fallback(args['aria-label'], 'Breadcrumb') }),
  Checkbox: (args) => e(Core.Checkbox, args, 'Enable notifications'),
  Disclosure: (args) => e(Core.Disclosure, { ...args, title: 'Details' }, 'Expanded content'),
  DisclosureGroup: (args) => e(Core.DisclosureGroup, args, e(Core.Disclosure, { id: 'one', title: 'One' }, 'First panel'), e(Core.Disclosure, { id: 'two', title: 'Two' }, 'Second panel')),
  Group: (args) => e(Core.Group, { ...args, 'aria-label': fallback(args['aria-label'], 'Actions') }, e(Core.Button, null, 'Save')),
  Link: (args) => e(Core.Link, { ...args, href: fallback(args.href, '/settings') }, 'Settings'),
  Meter: (args) => e(Core.Meter, { ...args, label: fallback(args.label, 'Storage'), value: args.value ?? 72 }),
  ProgressBar: (args) => e(Core.ProgressBar, { ...args, label: fallback(args.label, 'Upload'), value: args.value ?? 64 }),
  Separator: (args) => e(Core.Separator, args),
  ToggleButton: (args) => e(Core.ToggleButton, args, 'Pin'),
  Autocomplete: (args) => e(Core.Autocomplete, { ...args, label: fallback(args.label, 'City'), items: fallback(args.items, ['Melbourne', 'Sydney']), placeholder: fallback(args.placeholder, 'Choose a city') }),
  CheckboxGroup: (args) => e(Core.CheckboxGroup, { ...args, label: fallback(args.label, 'Notifications') }, e(Core.Checkbox, { value: 'email' }, 'Email'), e(Core.Checkbox, { value: 'sms' }, 'SMS')),
  DateField: (args) => e(Core.DateField, { ...args, label: fallback(args.label, 'Birthday'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '2026-08-26') : args.defaultValue }),
  DatePicker: (args) => e(Core.DatePicker, { ...args, label: fallback(args.label, 'Due date'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '2026-08-26') : args.defaultValue }),
  DateRangePicker: (args) => e(Core.DateRangePicker, { ...args, label: fallback(args.label, 'Trip dates'), defaultValue: args.value === undefined ? fallback(args.defaultValue, { start: '2026-08-26', end: '2026-09-01' }) : args.defaultValue }),
  Form: (args) => e(Core.Form, args, e(Core.TextField, { label: 'Name', name: 'name' }), e(Core.Button, { type: 'submit' }, 'Save')),
  NumberField: (args) => e(Core.NumberField, { ...args, label: fallback(args.label, 'Quantity'), defaultValue: args.value === undefined ? (args.defaultValue ?? 2) : args.defaultValue, minValue: args.minValue ?? 0 }),
  SearchField: (args) => e(Core.SearchField, { ...args, label: fallback(args.label, 'Search'), placeholder: fallback(args.placeholder, 'Search') }),
  Switch: (args) => e(Core.Switch, { ...args, label: fallback(args.label, 'Notifications') }),
  TextField: (args) => e(Core.TextField, { ...args, label: fallback(args.label, 'Name'), placeholder: fallback(args.placeholder, 'Enter a name') }),
  TimeField: (args) => e(Core.TimeField, { ...args, label: fallback(args.label, 'Start time'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '09:30') : args.defaultValue }),
  Calendar: (args) => e(Core.Calendar, { ...args, label: fallback(args.label, 'Date'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '2026-08-26') : args.defaultValue }),
  ColorArea: (args) => e(Core.ColorArea, { ...args, label: fallback(args.label, 'Color'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '#ff0000') : args.defaultValue }),
  ColorField: (args) => e(Core.ColorField, { ...args, label: fallback(args.label, 'Color'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '#ff0000') : args.defaultValue }),
  ColorPicker: (args) => e(Core.ColorPicker, { ...args, defaultValue: args.value === undefined ? fallback(args.defaultValue, '#ff0000') : args.defaultValue }, e(Core.ColorField, { label: 'Color' })),
  ColorSlider: (args) => e(Core.ColorSlider, { ...args, label: fallback(args.label, 'Red'), channel: fallback(args.channel, 'red'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '#ff0000') : args.defaultValue }),
  ColorSwatch: (args) => e(Core.ColorSwatch, { ...args, color: fallback(args.color, '#ff0000') }),
  ColorSwatchPicker: (args) => e(Core.ColorSwatchPicker, { ...args, 'aria-label': fallback(args['aria-label'], 'Palette'), items: fallback(args.items, [{ id: 'red', color: '#ff0000' }, { id: 'blue', color: '#0000ff' }]) }),
  ColorWheel: (args) => e(Core.ColorWheel, { ...args, 'aria-label': fallback(args['aria-label'], 'Hue'), defaultValue: args.value === undefined ? fallback(args.defaultValue, '#ff0000') : args.defaultValue }),
  ComboBox: (args) => e(Core.ComboBox, { ...args, label: fallback(args.label, 'City'), items: fallback(args.items, ['Melbourne', 'Sydney']), placeholder: fallback(args.placeholder, 'Choose a city') }),
  GridList: (args) => e(Core.GridList, { ...args, 'aria-label': fallback(args['aria-label'], 'Grid'), items: fallback(args.items, ['One', 'Two']) }),
  ListBox: (args) => e(Core.ListBox, { ...args, 'aria-label': fallback(args['aria-label'], 'List'), items: fallback(args.items, ['One', 'Two']) }),
  Menu: (args) => e(Core.Menu, { ...args, 'aria-label': fallback(args['aria-label'], 'Actions'), items: fallback(args.items, ['Save', 'Delete']) }),
  RadioGroup: (args) => e(Core.RadioGroup, { ...args, label: fallback(args.label, 'Size'), options: fallback(args.options, [{ value: 's', label: 'Small' }, { value: 'l', label: 'Large' }]) }),
  RangeCalendar: (args) => e(Core.RangeCalendar, { ...args, label: fallback(args.label, 'Trip'), defaultValue: args.value === undefined ? fallback(args.defaultValue, { start: '2026-08-26', end: '2026-09-01' }) : args.defaultValue }),
  Select: (args) => e(Core.Select, { ...args, label: fallback(args.label, 'City'), items: fallback(args.items, ['Melbourne', 'Sydney']), placeholder: fallback(args.placeholder, 'Choose a city') }),
  Slider: (args) => e(Core.Slider, { ...args, label: fallback(args.label, 'Volume'), defaultValue: args.value === undefined ? (args.defaultValue ?? 60) : args.defaultValue }),
  Table: (args) => e(Core.Table, { ...args, 'aria-label': fallback(args['aria-label'], 'People'), columns: fallback(args.columns, [{ id: 'name', label: 'Name', isRowHeader: true }, { id: 'role', label: 'Role' }]), rows: fallback(args.rows, [{ id: 'ada', values: { name: 'Ada', role: 'Engineer' } }, { id: 'grace', values: { name: 'Grace', role: 'Designer' } }]) }),
  Tabs: (args) => e(Core.Tabs, { ...args, 'aria-label': fallback(args['aria-label'], 'Sections'), items: fallback(args.items, [{ id: 'overview', label: 'Overview', panel: 'Overview content' }, { id: 'details', label: 'Details', panel: 'Details content' }]) }),
  TagGroup: (args) => e(Core.TagGroup, { ...args, label: fallback(args.label, 'Tags'), items: fallback(args.items, ['Design', 'Engineering']) }),
  ToggleButtonGroup: (args) => e(Core.ToggleButtonGroup, { ...args, 'aria-label': fallback(args['aria-label'], 'Formatting') }, e(Core.ToggleButton, { id: 'bold' }, 'Bold'), e(Core.ToggleButton, { id: 'italic' }, 'Italic')),
  TokenField: (args) => e(Core.TokenField, { ...args, label: fallback(args.label, 'Recipients'), defaultValue: args.value === undefined ? (args.defaultValue ?? ['Andrew', 'Core UI']) : args.defaultValue, placeholder: fallback(args.placeholder, 'Add recipient') }),
  Toolbar: (args) => e(Core.Toolbar, { ...args, 'aria-label': fallback(args['aria-label'], 'Formatting') }, e(Core.Button, null, 'Bold'), e(Core.Button, null, 'Italic')),
  Tree: (args) => e(Core.Tree, { ...args, 'aria-label': fallback(args['aria-label'], 'Files'), items: fallback(args.items, [{ id: 'src', label: 'src', children: [{ id: 'main', label: 'main.jsx' }] }]), defaultExpandedIds: args.expandedIds === undefined ? (args.defaultExpandedIds ?? ['src']) : args.defaultExpandedIds }),
  Virtualizer: (args) => e(Core.Virtualizer, { ...args, 'aria-label': fallback(args['aria-label'], 'Results'), items: fallback(args.items, ['Result 1', 'Result 2', 'Result 3']), height: args.height ?? 180 }),
  DropZone: (args) => e(Core.DropZone, { ...args, 'aria-label': fallback(args['aria-label'], 'Upload files') }, fallback(args.children, 'Drop files here')),
  FileTrigger: (args) => e(Core.FileTrigger, { ...args }, fallback(args.children, e(Core.Button, null, 'Choose files'))),
  Dialog: (args) => e(Core.Dialog, {
    ...args,
    title: fallback(args.title, 'Delete draft'),
    trigger: fallback(args.trigger, e(Core.Button, null, 'Open dialog')),
  }, fallback(args.children, e('p', null, 'This dialog traps focus and closes with Escape.'))),
  Popover: (args) => e(Core.Popover, {
    ...args,
    'aria-label': fallback(args['aria-label'], 'More actions'),
    trigger: fallback(args.trigger, e(Core.Button, null, 'More actions')),
  }, fallback(args.children, e('p', null, 'Additional actions appear next to the trigger.'))),
  PreviewTrigger: (args) => e(Core.PreviewTrigger, {
    ...args,
    'aria-label': fallback(args['aria-label'], 'Document preview'),
    delay: args.delay ?? 0,
    closeDelay: args.closeDelay ?? 0,
    trigger: fallback(args.trigger, e(Core.Button, null, 'Preview document')),
  }, fallback(args.children, e('p', null, 'A quick preview is available on focus or hover.'))),
  Toast: (args) => e(Core.Toast, { ...args, message: fallback(args.message, 'Your changes are saved.'), title: fallback(args.title, 'Saved') }),
  Tooltip: (args) => e(Core.Tooltip, {
    ...args,
    content: fallback(args.content, 'Keyboard shortcut: ⌘K'),
    delay: args.delay ?? 0,
    closeDelay: args.closeDelay ?? 0,
    trigger: fallback(args.trigger, e(Core.Button, null, 'Keyboard help')),
  }),
};

export const adapterNames = Object.freeze(Object.keys(ADAPTERS));

export function renderFamily(family, args) {
  const adapter = ADAPTERS[family];
  if (!adapter) throw new Error(`Unknown Core UI React story family: ${family}`);
  return adapter(args);
}

export function createStoryMeta(record) {
  const component = Core[record.family];
  if (!component) throw new Error(`Missing @core-ui/react export for ${record.family}`);
  return {
    title: `Core React/${record.tranche}/${record.family}`,
    component,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `Private development showcase for the Core-owned ${record.family} family.`,
        },
      },
    },
    argTypes: argTypesForBinding(record.binding),
  };
}

export function createStory(record, variant) {
  return {
    name: variant === 'states' ? 'States' : 'Default',
    args: storyArgsForBinding(record.binding, variant, record.family),
    argTypes: argTypesForBinding(record.binding),
    render: (args) => renderFamily(record.family, args),
  };
}
