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
  defaultCamera: ['user', 'environment'],
  method: ['get', 'post'],
  orientation: ['horizontal', 'vertical'],
  placement: ['top', 'bottom', 'start', 'end'],
  role: ['group', 'region', 'presentation'],
  selectionMode: ['none', 'single', 'multiple'],
  type: ['text', 'email', 'password', 'url', 'tel'],
  validationBehavior: ['aria', 'native'],
  variant: ['neutral', 'success', 'warning', 'danger'],
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

const STATE_BOOLEAN_PROPS = Object.freeze([
  'checked', 'current', 'disabled', 'expanded', 'indeterminate', 'invalid',
  'open', 'pending', 'readOnly', 'required', 'selected',
]);

const OVERLAY_FAMILIES = new Set(['Dialog', 'Popover', 'PreviewTrigger', 'Tooltip', 'Toast']);
const INTERACTION_OPEN_FAMILIES = new Set(['DatePicker', 'DateRangePicker', 'ComboBox', 'Select']);
const INTERACTION_OPEN_SELECTORS = Object.freeze({
  DatePicker: '.core-date-trigger',
  DateRangePicker: '.core-date-trigger',
  ComboBox: '.core-combo-box-trigger',
  Select: '.core-select-trigger',
});
const LIFECYCLE_ATTRIBUTES = Object.freeze({
  entering: 'data-entering',
  opening: 'data-entering',
  exiting: 'data-exiting',
  closing: 'data-exiting',
});

function stateVariantNames(binding, family) {
  const names = [...binding.states];
  const props = new Set(binding.api.props);
  if (props.has('placement')) names.push('placement');
  if (family === 'DropZone') names.push('dragging');
  if (OVERLAY_FAMILIES.has(family)) names.push('entering', 'exiting');
  return [...new Set(names)];
}

function resetStateArgs(binding, sourceArgs) {
  const props = new Set(binding.api.props);
  const args = { ...sourceArgs };
  for (const name of STATE_BOOLEAN_PROPS) {
    if (props.has(name)) args[name] = false;
  }
  for (const [controlled, uncontrolled] of CONTROLLED_DEFAULT_PAIRS) {
    if (!props.has(controlled) || !props.has(uncontrolled)) continue;
    delete args[controlled];
    if (args[uncontrolled] === undefined) {
      const defaults = binding.api.defaults ?? {};
      const value = defaults[uncontrolled] ?? defaults[controlled];
      if (value !== undefined) args[uncontrolled] = value;
    }
  }
  return args;
}

function setSelectedState(args, props, family) {
  if (props.has('checked')) return setControlledArg(args, props, 'checked', true);
  if (props.has('selected')) return setControlledArg(args, props, 'selected', true);
  if (props.has('selectedIds')) {
    const selectedId = family === 'Tree' ? 'src'
      : family === 'Table' ? 'ada'
        : family === 'ToggleButtonGroup' ? 'bold' : 'One';
    return setControlledArg(args, props, 'selectedIds', [selectedId]);
  }
  if (props.has('selectedId')) return setControlledArg(args, props, 'selectedId', 'Melbourne');
  if (!props.has('value')) return undefined;
  if (family === 'CheckboxGroup') return setControlledArg(args, props, 'value', ['email']);
  if (family === 'RadioGroup') return setControlledArg(args, props, 'value', 's');
  if (family === 'Tabs') return setControlledArg(args, props, 'value', 'overview');
  if (family === 'Select') return setControlledArg(args, props, 'value', 'Melbourne');
  if (family === 'Calendar') return setControlledArg(args, props, 'value', '2026-08-26');
  if (family === 'RangeCalendar') return setControlledArg(args, props, 'value', { start: '2026-08-26', end: '2026-09-01' });
  if (family === 'ColorSwatchPicker') return setControlledArg(args, props, 'value', '#ff0000');
  if (typeof args.value === 'number') return setControlledArg(args, props, 'value', args.max ?? args.maxValue ?? 72);
  return undefined;
}

function stateIsSupported(binding, state, family) {
  const props = new Set(binding.api.props);
  const normalizedState = state.toLowerCase().replaceAll('-', '');
  switch (normalizedState) {
    case 'idle':
    case 'visible':
      return true;
    case 'disabled':
      return props.has('disabled');
    case 'invalid':
      return props.has('invalid');
    case 'readonly':
      return props.has('readOnly');
    case 'required':
      return props.has('required');
    case 'selected':
      return props.has('checked')
        || props.has('selected')
        || props.has('selectedIds')
        || props.has('selectedId')
        || ['CheckboxGroup', 'RadioGroup', 'Tabs', 'Select', 'Calendar', 'RangeCalendar', 'ColorSwatchPicker'].includes(family) && props.has('value');
    case 'indeterminate':
      return props.has('indeterminate') || family === 'ProgressBar';
    case 'expanded':
    case 'collapsed':
      return props.has('expanded') || props.has('expandedIds');
    case 'pending':
      return props.has('pending');
    case 'open':
      return props.has('open') || INTERACTION_OPEN_FAMILIES.has(family);
    case 'opening':
    case 'entering':
    case 'closed':
    case 'closing':
    case 'exiting':
      return props.has('open')
        || family === 'Toast' && (normalizedState === 'entering' || normalizedState === 'exiting');
    case 'focused':
      // StateVariant focuses the first public interactive target after mount.
      return true;
    case 'drop target':
    case 'droptarget':
    case 'dragging':
      return family === 'DropZone';
    case 'low':
    case 'high':
      return family === 'Meter' && props.has('value');
    case 'progress':
    case 'complete':
      return family === 'ProgressBar' && props.has('value');
    case 'filled':
      return family === 'SearchField' && props.has('value');
    case 'empty':
      return props.has('items') || props.has('rows');
    case 'placement':
      return props.has('placement');
    case 'vertical':
      return props.has('orientation');
    case 'horizontal':
      return props.has('orientation');
    case 'timed':
      return props.has('duration');
    case 'current':
      return props.has('current');
    // Pressed and dismissed are transient lifecycle results without a Core
    // prop or reliable public interaction that can hold the state in a story.
    case 'pressed':
    case 'dismissed':
    case 'submitting':
      return false;
    default:
      return false;
  }
}

function applyStateArgs(args, binding, state, family) {
  const props = new Set(binding.api.props);
  const normalizedState = state.toLowerCase().replaceAll('-', '');
  switch (normalizedState) {
    case 'disabled':
      if (props.has('disabled')) args.disabled = true;
      break;
    case 'invalid':
      if (props.has('invalid')) args.invalid = true;
      break;
    case 'readonly':
      if (props.has('readOnly')) args.readOnly = true;
      break;
    case 'required':
      if (props.has('required')) args.required = true;
      break;
    case 'selected':
      setSelectedState(args, props, family);
      break;
    case 'indeterminate':
      if (props.has('indeterminate')) args.indeterminate = true;
      else if (family === 'ProgressBar' && props.has('value')) args.value = undefined;
      break;
    case 'expanded':
      if (props.has('expanded')) setControlledArg(args, props, 'expanded', true);
      else if (props.has('expandedIds')) setControlledArg(args, props, 'expandedIds', family === 'Tree' ? ['src'] : ['one']);
      break;
    case 'collapsed':
      if (props.has('expanded')) setControlledArg(args, props, 'expanded', false);
      else if (props.has('expandedIds')) setControlledArg(args, props, 'expandedIds', []);
      break;
    case 'pending':
      if (props.has('pending')) args.pending = true;
      break;
    case 'open':
    case 'opening':
    case 'entering':
      if (props.has('open')) setControlledArg(args, props, 'open', true);
      break;
    case 'closed':
    case 'closing':
    case 'exiting':
    case 'dismissed':
      if (props.has('open')) setControlledArg(args, props, 'open', false);
      break;
    case 'focused':
      // Focus is applied by the private StateVariant wrapper after mount.
      break;
    case 'drop target':
    case 'droptarget':
    case 'dragging':
      // The private StateVariant wrapper dispatches a real dragenter event.
      break;
    case 'low':
      if (family === 'Meter' && props.has('value')) setControlledArg(args, props, 'value', 24);
      break;
    case 'high':
      if (family === 'Meter' && props.has('value')) setControlledArg(args, props, 'value', 88);
      break;
    case 'progress':
      if (family === 'ProgressBar' && props.has('value')) setControlledArg(args, props, 'value', 64);
      break;
    case 'complete':
      if (family === 'ProgressBar' && props.has('value')) setControlledArg(args, props, 'value', args.maxValue ?? 100);
      break;
    case 'filled':
      if (props.has('value') && (typeof args.value === 'string' || args.value === undefined)) setControlledArg(args, props, 'value', 'Core');
      break;
    case 'empty':
      if (props.has('items')) args.items = [];
      if (props.has('rows')) args.rows = [];
      break;
    case 'placement':
      if (props.has('placement')) args.placement = 'top';
      break;
    case 'current':
      if (props.has('current')) args.current = true;
      break;
    case 'vertical':
      if (props.has('orientation')) args.orientation = 'vertical';
      break;
    case 'timed':
      if (props.has('duration')) args.duration = 1_000;
      break;
    default:
      break;
  }
  return args;
}

export function storyArgsForBinding(binding, variant, family) {
  if (variant === 'default' || variant === 'states') return normalizeDefaultArgs(binding);
  return stateArgsForBinding(binding, variant, family);
}

export function stateArgsForBinding(binding, state, family, sourceArgs = normalizeDefaultArgs(binding)) {
  return applyStateArgs(resetStateArgs(binding, sourceArgs), binding, state, family);
}

export function stateCoverageForBinding(binding, family) {
  return stateVariantNames(binding, family).map((state) => ({
    name: state,
    args: stateArgsForBinding(binding, state, family),
  }));
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
  ProgressBar: (args) => e(Core.ProgressBar, { ...args, label: fallback(args.label, 'Upload'), value: Object.hasOwn(args, 'value') ? args.value : 64 }),
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

function focusStateTarget(element) {
  if (!element) return;
  const target = element.matches('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')
    ? element
    : element.querySelector('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])');
  target?.focus();
}

function dispatchDragEnter(element) {
  const target = element?.querySelector('.core-drop-zone') ?? element;
  if (!target || typeof target.dispatchEvent !== 'function') return;
  let dataTransfer;
  try {
    dataTransfer = typeof DataTransfer === 'function' ? new DataTransfer() : undefined;
    if (dataTransfer) dataTransfer.effectAllowed = 'all';
  } catch {
    dataTransfer = undefined;
  }
  dataTransfer ??= {
    effectAllowed: 'all',
    dropEffect: 'none',
    files: [],
    items: [],
    types: ['Files'],
  };
  const event = typeof DragEvent === 'function'
    ? new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
    : new Event('dragenter', { bubbles: true, cancelable: true });
  if (!event.dataTransfer) Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  target.dispatchEvent(event);
}

function scheduleOpenInteraction(element, family) {
  const target = element?.querySelector(INTERACTION_OPEN_SELECTORS[family]);
  if (!target) return undefined;
  const handle = scheduleFrame(() => {
    if (target.isConnected && target.getAttribute('aria-expanded') !== 'true') target.click();
  });
  return () => cancelFrame(handle);
}

function lifecycleMarker(family, state) {
  return `core-storybook-lifecycle-${family}-${state}`.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function findOverlayHost(target) {
  if (typeof document === 'undefined' || !target) return undefined;
  return [...document.body.children].find((child) => child.contains(target));
}

/** Keep the private overlay portals distinguishable to the Storybook a11y host. */
function OverlayHost({ marker, children }) {
  React.useEffect(() => {
    if (!marker || typeof document === 'undefined') return undefined;
    let managedHost;
    let originalRole;
    let originalLabel;
    const annotateHost = () => {
      const host = findOverlayHost(document.querySelector(`.${marker}`));
      if (!host || host === managedHost) return;
      managedHost = host;
      originalRole = host.getAttribute('role');
      originalLabel = host.getAttribute('aria-label');
      if (!originalRole) host.setAttribute('role', 'region');
      host.setAttribute('aria-label', `Core UI overlay ${marker}`);
    };
    const observer = typeof MutationObserver === 'function'
      ? new MutationObserver(annotateHost)
      : undefined;
    observer?.observe(document.body, { childList: true, subtree: true });
    annotateHost();
    return () => {
      observer?.disconnect();
      if (!managedHost) return;
      if (originalRole === null) managedHost.removeAttribute('role');
      else managedHost.setAttribute('role', originalRole);
      if (originalLabel === null) managedHost.removeAttribute('aria-label');
      else managedHost.setAttribute('aria-label', originalLabel);
    };
  }, [marker]);
  return children;
}

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return setTimeout(callback, 0);
}

function cancelFrame(handle) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else clearTimeout(handle);
}

const LifecycleSelectionContext = React.createContext(null);

function LifecycleSelection({ family, states, children }) {
  const [activeState, setActiveState] = React.useState(states[0]);
  const selectId = `core-storybook-lifecycle-select-${family.toLowerCase()}`;
  return e(React.Fragment, null,
    e('label', { htmlFor: selectId }, 'Lifecycle state'),
    e('select', {
      id: selectId,
      value: activeState,
      'aria-label': `${family} lifecycle state`,
      'data-core-storybook-lifecycle-select': family,
      onChange: (event) => setActiveState(event.target.value),
    }, states.map((state) => e('option', { key: state, value: state }, state))),
    e(LifecycleSelectionContext.Provider, { value: activeState }, children),
  );
}

function LifecycleTransition({ family, state, args }) {
  const isClosing = state === 'closing' || state === 'exiting';
  const isToast = family === 'Toast';
  const [open, setOpen] = React.useState(!isToast && isClosing);
  const [toastMounted, setToastMounted] = React.useState(isClosing);
  const [toastRevision, setToastRevision] = React.useState(0);
  const [phase, setPhase] = React.useState(isClosing ? 'open' : 'closed');

  React.useEffect(() => {
    const frame = scheduleFrame(() => {
      setPhase(isClosing ? 'exiting' : 'entering');
      if (isToast) setToastMounted(!isClosing);
      else setOpen(!isClosing);
    });
    const reopen = isClosing
      ? setTimeout(() => {
        setPhase('entering');
        if (isToast) {
          setToastRevision(1);
          setToastMounted(true);
        }
        else setOpen(true);
      }, 300)
      : undefined;
    const settle = setTimeout(() => {
      setPhase('open');
    }, isClosing ? 600 : 300);
    return () => {
      cancelFrame(frame);
      if (reopen !== undefined) clearTimeout(reopen);
      clearTimeout(settle);
    };
  }, [isClosing, isToast]);

  const transitionArgs = { ...args };
  let rendered;
  if (isToast) {
    transitionArgs.duration = isClosing && toastRevision === 0 ? 50 : (args.duration ?? 5_000);
    rendered = toastMounted
      ? React.cloneElement(renderFamily(family, transitionArgs), { key: toastRevision })
      : null;
  } else {
    transitionArgs.open = open;
    rendered = renderFamily(family, transitionArgs);
  }
  return e(React.Fragment, null,
    e('div', {
      className: 'core-storybook-transition-status',
      'data-core-storybook-transition': phase,
      'aria-hidden': 'true',
    }, `${state}: ${phase}`),
    rendered,
  );
}

function StateVariant({ family, state, args, available }) {
  const stateRef = React.useRef(null);
  React.useEffect(() => {
    if (state === 'focused') focusStateTarget(stateRef.current);
    if (state === 'drop-target' || state === 'dragging') dispatchDragEnter(stateRef.current);
    if (state !== 'open' || !INTERACTION_OPEN_FAMILIES.has(family)) return undefined;
    return scheduleOpenInteraction(stateRef.current, family);
  }, [family, state]);

  const variantArgs = { ...args };
  const lifecycleAttribute = LIFECYCLE_ATTRIBUTES[state];
  const activeLifecycleState = React.useContext(LifecycleSelectionContext);
  const marker = OVERLAY_FAMILIES.has(family) ? lifecycleMarker(family, state) : undefined;
  if (marker) {
    variantArgs.className = [variantArgs.className, marker].filter(Boolean).join(' ');
  }
  // The matrix intentionally mounts several landmark instances at once. Give
  // Core's nav/group adapters unique accessible names without adding a prop
  // to the public API or changing the controls contract.
  if (family === 'Breadcrumbs' || family === 'Group') {
    variantArgs['aria-label'] = `${family} ${state}`;
  }
  const labelId = `core-storybook-state-${family}-${state.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const rendered = !available
    ? e('p', {
      className: 'core-storybook-state-unavailable',
      'data-core-storybook-state': 'unavailable',
    }, `Unavailable: Core ${family} has no public prop or supported interaction for the ${state} state.`)
    : lifecycleAttribute
    ? activeLifecycleState === state
      ? e(LifecycleTransition, { family, state, args: variantArgs })
      : e('p', { className: 'core-storybook-lifecycle-inactive' }, `Select ${state} to inspect this lifecycle state.`)
    : renderFamily(family, variantArgs);
  const stateContent = e('section', {
    ref: stateRef,
    className: 'core-storybook-state',
    'aria-labelledby': labelId,
    'data-core-storybook-lifecycle': lifecycleAttribute ? state : undefined,
  }, e('h3', { id: labelId }, state), rendered);
  return marker ? e(OverlayHost, { marker }, stateContent) : stateContent;
}

export function renderStateCoverage(record, args = storyArgsForBinding(record.binding, 'states', record.family)) {
  const variants = stateCoverageForBinding(record.binding, record.family);
  const stateMatrix = e('div', { className: 'core-storybook-states' }, variants.map(({ name }) => e(StateVariant, {
    key: name,
    family: record.family,
    state: name,
    available: stateIsSupported(record.binding, name, record.family),
    args: stateArgsForBinding(record.binding, name, record.family, args),
  })));
  const lifecycleStates = variants.map(({ name }) => name).filter((name) => LIFECYCLE_ATTRIBUTES[name]);
  return lifecycleStates.length > 0
    ? e('div', { className: 'core-storybook-lifecycle-showcase' }, e(LifecycleSelection, {
      family: record.family,
      states: lifecycleStates,
      children: stateMatrix,
    }))
    : stateMatrix;
}

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
    parameters: variant === 'states'
      ? { coreStateCoverage: stateCoverageForBinding(record.binding, record.family) }
      : undefined,
    render: (args) => variant === 'states'
      ? renderStateCoverage(record, args)
      : renderFamily(record.family, args),
  };
}
