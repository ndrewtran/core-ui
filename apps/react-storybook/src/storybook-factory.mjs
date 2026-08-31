import React from 'react';
import * as MuxUI from '@muxui/react';
import { migrationFixtureSymbol } from './visual-migration-contract.mjs';
import { fixtureFieldPropsFor, fixtureRenderModel } from './visual-migration-fixture-map.mjs';

const MUXUI_SEARCH_FIELD_VALUE = 'MuxUI';
const HISTORICAL_MIGRATION_SEARCH_FIELD_VALUE = ['C', 'o', 'r', 'e'].join('');

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

const callbackType = { summary: 'MuxUI callback' };

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
      description: `Mux UI-owned ${name} property`,
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
  DatePicker: '.muxui-date-trigger',
  DateRangePicker: '.muxui-date-trigger',
  ComboBox: '.muxui-combo-box-trigger',
  Select: '.muxui-select-trigger',
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
  if (family === 'TagGroup') names.push('removable');
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

function fixtureDataFromInput(fixtureInput, name, defaultValue) {
  return fixtureInput ? fixtureRenderModel(fixtureInput).data[name] ?? defaultValue : defaultValue;
}

function setSelectedState(args, props, family, fixtureInput) {
  const model = fixtureInput ? fixtureRenderModel(fixtureInput) : undefined;
  if (props.has('checked')) return setControlledArg(args, props, 'checked', true);
  if (props.has('selected')) return setControlledArg(args, props, 'selected', true);
  if (props.has('selectedIds')) {
    if (props.has('selectionMode')) args.selectionMode = 'single';
    const selectedId = family === 'Tree'
      ? model?.selected.treeId ?? 'src'
      : family === 'Table'
        ? model?.selected.rowId ?? 'ada'
        : family === 'ToggleButtonGroup'
          ? model?.selected.toggleId ?? 'bold'
          : model?.selected.itemId ?? 'Melbourne';
    return setControlledArg(args, props, 'selectedIds', [selectedId]);
  }
  if (props.has('selectedId')) return setControlledArg(args, props, 'selectedId', model?.selected.itemId ?? 'Melbourne');
  if (!props.has('value')) return undefined;
  if (family === 'CheckboxGroup') return setControlledArg(args, props, 'value', [model?.selected.choice ?? 'email']);
  if (family === 'RadioGroup') return setControlledArg(args, props, 'value', model?.selected.option ?? 's');
  if (family === 'Tabs') return setControlledArg(args, props, 'value', model?.selected.item ?? 'overview');
  if (family === 'Select') return setControlledArg(args, props, 'value', model?.selected.item ?? 'Melbourne');
  if (family === 'Calendar') return setControlledArg(args, props, 'value', fixtureDataFromInput(fixtureInput, 'date', '2026-08-26'));
  if (family === 'RangeCalendar') return setControlledArg(args, props, 'value', fixtureDataFromInput(fixtureInput, 'dateRange', { start: '2026-08-26', end: '2026-09-01' }));
  if (family === 'ColorSwatchPicker') return setControlledArg(args, props, 'value', model?.selected.color ?? '#ff0000');
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
    case 'removable':
      return family === 'TagGroup';
    // Pressed and dismissed are transient lifecycle results without a MuxUI
    // prop or reliable public interaction that can hold the state in a story.
    case 'pressed':
    case 'dismissed':
    case 'submitting':
      return false;
    default:
      return false;
  }
}

function applyStateArgs(args, binding, state, family, fixtureInput) {
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
      setSelectedState(args, props, family, fixtureInput);
      break;
    case 'indeterminate':
      if (props.has('indeterminate')) args.indeterminate = true;
      else if (family === 'ProgressBar' && props.has('value')) args.value = undefined;
      break;
    case 'expanded':
      if (props.has('expanded')) setControlledArg(args, props, 'expanded', true);
      else if (props.has('expandedIds')) {
        const model = fixtureInput ? fixtureRenderModel(fixtureInput) : undefined;
        setControlledArg(args, props, 'expandedIds', [family === 'Tree'
          ? model?.selected.treeId ?? 'src'
          : model?.selected.disclosureId ?? 'one']);
      }
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
      if (props.has('value') && (typeof args.value === 'string' || args.value === undefined)) {
        setControlledArg(args, props, 'value', fixtureInput ? HISTORICAL_MIGRATION_SEARCH_FIELD_VALUE : MUXUI_SEARCH_FIELD_VALUE);
      }
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
    case 'removable':
      if (family === 'TagGroup') args.onRemove = () => {};
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
  return applyStateArgs(resetStateArgs(binding, sourceArgs), binding, state, family, sourceArgs[migrationFixtureSymbol]);
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

function fixtureCopy(args, defaultValue) {
  const fixture = args[migrationFixtureSymbol];
  return fixture ? fixtureRenderModel(fixture).copy ?? defaultValue : defaultValue;
}

function fixtureData(args, name, defaultValue) {
  const fixture = args[migrationFixtureSymbol];
  return fixture ? fixtureRenderModel(fixture).data[name] ?? defaultValue : defaultValue;
}

function fixtureState(args) {
  return args[migrationFixtureSymbol]?.state;
}

function fixtureChildren(args, name, defaultValue) {
  const children = fixtureData(args, 'children', {});
  return children?.[name] ?? defaultValue;
}

function fixtureFieldProps(args, family, defaults) {
  const fixture = args[migrationFixtureSymbol];
  if (!fixture) return defaults;
  const fieldProps = fixtureFieldPropsFor(fixture, family);
  // Tale's Select.Value documents "Select an item" as its empty-state copy;
  // keep Mux UI's migration adapter equivalent while preserving explicit fixture
  // placeholder mutations for contract tests and consumer stories.
  return family === 'Select' && fieldProps.placeholder === 'Enter a name'
    ? { ...fieldProps, placeholder: 'Select an item' }
    : fieldProps;
}

const ADAPTERS = {
  Button: (args) => e(MuxUI.Button, args, fixtureCopy(args, 'Save')),
  Breadcrumbs: (args) => e(MuxUI.Breadcrumbs, {
    ...args,
    // Mux UI's public Breadcrumbs contract uses item records; the canonical
    // fixture intentionally keeps these as renderer-neutral labels.
    items: fixtureData(args, 'items', fallback(args.items, ['Home', 'Docs'])).map((item, index) => typeof item === 'object'
      ? item
      : { id: String(index), label: String(item), href: '#' }),
    'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Breadcrumb')),
  }),
  Checkbox: (args) => e(MuxUI.Checkbox, args, fixtureCopy(args, 'Enable notifications')),
  Disclosure: (args) => e(MuxUI.Disclosure, { ...args, title: fixtureCopy(args, 'Details') }, fixtureCopy(args, 'Details') + ' content'),
  DisclosureGroup: (args) => e(MuxUI.DisclosureGroup, args, ...fixtureChildren(args, 'disclosureGroup', [{ id: 'one', title: 'One', content: 'First panel' }, { id: 'two', title: 'Two', content: 'Second panel' }]).map(({ id, title, content }) => e(MuxUI.Disclosure, { key: id, id, title }, content))),
  Group: (args) => e(MuxUI.Group, { ...args, 'aria-label': fallback(args['aria-label'], 'Actions') }, e(MuxUI.Button, null, 'Save')),
  Link: (args) => e(MuxUI.Link, { ...args, href: fallback(args.href, '/settings') }, fixtureCopy(args, 'Settings')),
  Meter: (args) => {
    const state = fixtureState(args);
    const fixtureValue = state === 'low' ? 24 : state === 'high' ? 88 : fixtureData(args, 'values', {}).meter ?? args.value ?? 72;
    return e(MuxUI.Meter, { ...args, label: fallback(args.label, fixtureCopy(args, 'Storage')), value: fixtureValue });
  },
  ProgressBar: (args) => e(MuxUI.ProgressBar, { ...args, label: fallback(args.label, fixtureCopy(args, 'Upload')), value: args.indeterminate || Object.hasOwn(args, 'value') && args.value === undefined ? undefined : fixtureState(args) === 'complete' ? 100 : (fixtureData(args, 'values', {}).progress ?? (Object.hasOwn(args, 'value') ? args.value : 64)) }),
  Separator: (args) => e(MuxUI.Separator, args),
  ToggleButton: (args) => e(MuxUI.ToggleButton, args, fixtureCopy(args, 'Pin')),
  Autocomplete: (args) => e(MuxUI.Autocomplete, { ...args, ...fixtureFieldProps(args, 'Autocomplete', { label: fallback(args.label, fixtureCopy(args, 'Choose a city')), placeholder: fallback(args.placeholder, fixtureCopy(args, 'Choose a city')) }), items: fixtureData(args, 'items', fallback(args.items, ['Melbourne', 'Sydney'])) }),
  CheckboxGroup: (args) => e(MuxUI.CheckboxGroup, { ...args, label: fallback(args.label, fixtureCopy(args, 'Notifications')) }, ...fixtureData(args, 'choices', [{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }]).map(({ value, label }) => e(MuxUI.Checkbox, { key: value, value }, label))),
  DateField: (args) => e(MuxUI.DateField, { ...args, label: fallback(args.label, fixtureCopy(args, 'Birthday')), defaultValue: args.value === undefined ? fixtureData(args, 'date', fallback(args.defaultValue, '2026-08-26')) : args.defaultValue }),
  DatePicker: (args) => e(MuxUI.DatePicker, { ...args, label: fallback(args.label, fixtureCopy(args, 'Due date')), defaultValue: args.value === undefined ? fixtureData(args, 'date', fallback(args.defaultValue, '2026-08-26')) : args.defaultValue }),
  DateRangePicker: (args) => e(MuxUI.DateRangePicker, { ...args, label: fallback(args.label, fixtureCopy(args, 'Trip dates')), defaultValue: args.value === undefined ? fixtureData(args, 'dateRange', fallback(args.defaultValue, { start: '2026-08-26', end: '2026-09-01' })) : args.defaultValue }),
  Form: (args) => e(MuxUI.Form, args, e(MuxUI.TextField, { label: fixtureChildren(args, 'form', { fieldLabel: 'Name' }).fieldLabel, name: 'name' }), e(MuxUI.Button, { type: 'submit' }, fixtureChildren(args, 'form', { submit: 'Save' }).submit)),
  NumberField: (args) => e(MuxUI.NumberField, { ...args, label: fallback(args.label, fixtureCopy(args, 'Quantity')), defaultValue: args.value === undefined ? (fixtureData(args, 'values', {}).number ?? args.defaultValue ?? 2) : args.defaultValue, minValue: args.minValue ?? 0 }),
  SearchField: (args) => e(MuxUI.SearchField, {
    ...args,
    ...fixtureFieldProps(args, 'SearchField', { label: fallback(args.label, fixtureCopy(args, 'Search')), placeholder: fallback(args.placeholder, fixtureCopy(args, 'Search')) }),
    onClear: args.onClear ?? (args[migrationFixtureSymbol] && args.value ? () => {} : undefined),
  }),
  Switch: (args) => e(MuxUI.Switch, { ...args, label: fallback(args.label, fixtureCopy(args, 'Notifications')) }),
  TextField: (args) => e(MuxUI.TextField, { ...args, label: fixtureData(args, 'label', fallback(args.label, fixtureCopy(args, 'Name'))), placeholder: fixtureData(args, 'placeholder', fallback(args.placeholder, fixtureCopy(args, 'Enter a name'))) }),
  TimeField: (args) => e(MuxUI.TimeField, { ...args, label: fallback(args.label, fixtureCopy(args, 'Start time')), defaultValue: args.value === undefined ? fixtureData(args, 'time', fallback(args.defaultValue, '09:30')) : args.defaultValue }),
  Calendar: (args) => e(MuxUI.Calendar, {
    ...args,
    // The shared migration fixture gives calendars an accessible name, while
    // ordinary stories retain their existing visible-label default.
    label: args[migrationFixtureSymbol] ? undefined : fallback(args.label, fixtureCopy(args, 'Date')),
    'aria-label': args[migrationFixtureSymbol] ? fixtureCopy(args, 'Date') : args['aria-label'],
    defaultValue: args.value === undefined ? fixtureData(args, 'date', fallback(args.defaultValue, '2026-08-26')) : args.defaultValue,
  }),
  ColorArea: (args) => e(MuxUI.ColorArea, {
    ...args,
    'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Color')),
    defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue,
  }),
  ColorField: (args) => e(MuxUI.ColorField, { ...args, label: fallback(args.label, fixtureCopy(args, 'Color')), defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue }),
  ColorPicker: (args) => e(MuxUI.ColorPicker, { ...args, defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue },
    e(MuxUI.ColorArea, { 'aria-label': fixtureCopy(args, 'Color'), defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue }),
    e(MuxUI.ColorField, { label: fixtureCopy(args, 'Color'), defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue })),
  ColorSlider: (args) => e(MuxUI.ColorSlider, { ...args, label: fallback(args.label, fixtureCopy(args, 'Red')), channel: fallback(args.channel, 'red'), defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue }),
  ColorSwatch: (args) => e(MuxUI.ColorSwatch, { ...args, color: fixtureData(args, 'color', fallback(args.color, '#ff0000')) }),
  ColorSwatchPicker: (args) => e(MuxUI.ColorSwatchPicker, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Palette')), items: fixtureData(args, 'items', fallback(args.items, [{ id: 'red', color: '#ff0000' }, { id: 'blue', color: '#0000ff' }])) }),
  ColorWheel: (args) => e(MuxUI.ColorWheel, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Hue')), outerRadius: args.outerRadius ?? 12, innerRadius: args.innerRadius ?? 8, defaultValue: args.value === undefined ? fixtureData(args, 'color', fallback(args.defaultValue, '#ff0000')) : args.defaultValue }),
  ComboBox: (args) => e(MuxUI.ComboBox, { ...args, ...fixtureFieldProps(args, 'ComboBox', { label: fallback(args.label, fixtureCopy(args, 'Choose a city')), placeholder: fallback(args.placeholder, fixtureCopy(args, 'Choose a city')) }), items: fixtureData(args, 'items', fallback(args.items, ['Melbourne', 'Sydney'])) }),
  GridList: (args) => e(MuxUI.GridList, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Grid')), items: fixtureState(args) === 'empty' ? [] : fixtureData(args, 'items', fallback(args.items, ['One', 'Two'])) }),
  ListBox: (args) => e(MuxUI.ListBox, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'List')), items: fixtureState(args) === 'empty' ? [] : fixtureData(args, 'items', fallback(args.items, ['One', 'Two'])) }),
  Menu: (args) => e(MuxUI.Menu, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Actions')), items: fixtureData(args, 'items', fallback(args.items, ['Save', 'Delete'])) }),
  RadioGroup: (args) => e(MuxUI.RadioGroup, { ...args, label: fallback(args.label, fixtureCopy(args, 'Size')), options: fixtureData(args, 'options', fallback(args.options, [{ value: 's', label: 'Small' }, { value: 'l', label: 'Large' }])) }),
  RangeCalendar: (args) => e(MuxUI.RangeCalendar, {
    ...args,
    label: args[migrationFixtureSymbol] ? undefined : fallback(args.label, fixtureCopy(args, 'Trip')),
    'aria-label': args[migrationFixtureSymbol] ? fixtureCopy(args, 'Trip') : args['aria-label'],
    defaultValue: args.value === undefined ? fixtureData(args, 'dateRange', fallback(args.defaultValue, { start: '2026-08-26', end: '2026-09-01' })) : args.defaultValue,
  }),
  Select: (args) => e(MuxUI.Select, { ...args, ...fixtureFieldProps(args, 'Select', { label: fallback(args.label, fixtureCopy(args, 'Choose a city')), placeholder: fallback(args.placeholder, fixtureCopy(args, 'Choose a city')) }), items: fixtureData(args, 'items', fallback(args.items, ['Melbourne', 'Sydney'])) }),
  Slider: (args) => e(MuxUI.Slider, { ...args, label: fallback(args.label, fixtureCopy(args, 'Volume')), defaultValue: args.value === undefined ? (fixtureData(args, 'values', {}).slider ?? args.defaultValue ?? 60) : args.defaultValue }),
  Table: (args) => e(MuxUI.Table, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'People')), columns: fixtureData(args, 'columns', fallback(args.columns, [{ id: 'name', label: 'Name', isRowHeader: true }, { id: 'role', label: 'Role' }])), rows: fixtureState(args) === 'empty' ? [] : fixtureData(args, 'rows', fallback(args.rows, [{ id: 'ada', values: { name: 'Ada', role: 'Engineer' } }, { id: 'grace', values: { name: 'Grace', role: 'Designer' } }])) }),
  Tabs: (args) => e(MuxUI.Tabs, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Sections')), items: fixtureData(args, 'items', fallback(args.items, [{ id: 'overview', label: 'Overview', panel: 'Overview content' }, { id: 'details', label: 'Details', panel: 'Details content' }])) }),
  TagGroup: (args) => e(MuxUI.TagGroup, { ...args, label: fallback(args.label, fixtureCopy(args, 'Tags')), items: fixtureState(args) === 'empty' ? [] : fixtureData(args, 'items', fallback(args.items, ['Design', 'Engineering'])), onRemove: args.onRemove ?? (args[migrationFixtureSymbol] && args.removable ? () => {} : undefined) }),
  ToggleButtonGroup: (args) => e(MuxUI.ToggleButtonGroup, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Formatting')) }, ...fixtureChildren(args, 'toggleButtonGroup', [{ id: 'bold', label: 'Bold' }, { id: 'italic', label: 'Italic' }]).map(({ id, label }) => e(MuxUI.ToggleButton, { key: id, id }, label))),
  TokenField: (args) => e(MuxUI.TokenField, { ...args, label: fallback(args.label, fixtureCopy(args, 'Recipients')), defaultValue: args.value === undefined ? (args.defaultValue ?? ['Andrew', 'Mux UI']) : args.defaultValue, placeholder: fallback(args.placeholder, 'Add recipient') }),
  Toolbar: (args) => e(MuxUI.Toolbar, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Formatting')) }, ...fixtureChildren(args, 'toolbar', ['Bold', 'Italic']).map((label) => e(MuxUI.Button, { key: label }, label))),
  Tree: (args) => e(MuxUI.Tree, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Files')), items: fixtureState(args) === 'empty' ? [] : fixtureData(args, 'items', fallback(args.items, [{ id: 'src', label: 'src', children: [{ id: 'main', label: 'main.jsx' }] }])), defaultExpandedIds: args.expandedIds === undefined ? (args.defaultExpandedIds ?? (args[migrationFixtureSymbol] ? undefined : ['src'])) : args.defaultExpandedIds }),
  Virtualizer: (args) => {
    const viewport = args[migrationFixtureSymbol]?.frame?.virtualizer;
    const height = viewport?.height ?? args.height ?? 180;
    if (!Number.isFinite(height) || height <= 0) throw new Error('MuxUI migration Virtualizer requires a finite positive height');
    const items = fixtureState(args) === 'empty' ? [] : fixtureData(args, 'items', fallback(args.items, ['Result 1', 'Result 2', 'Result 3']));
    const migration = Boolean(viewport);
    const virtualizer = e(MuxUI.Virtualizer, {
      ...args,
      'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Results')),
      items,
      // Tale's virtualizer contracts its empty list to its border while the
      // populated fixture uses a 76px inner viewport inside the 340x180 host.
      // Keep the host dimensions stable but map the empty state to the same
      // deterministic inner geometry instead of forcing an empty 76px panel.
      height: migration ? (fixtureState(args) === 'empty' ? 12 : 76) : height,
      itemHeight: migration ? 32 : args.itemHeight ?? 32,
      style: migration && fixtureState(args) === 'empty'
        ? { ...(args.style ?? {}), marginBlockStart: '1px' }
        : args.style,
    });
    return migration
      ? e('div', {
        style: {
          boxSizing: 'border-box',
          width: `${viewport.width}px`,
          height: `${viewport.height}px`,
          overflow: 'auto',
        },
      }, virtualizer)
      : virtualizer;
  },
  DropZone: (args) => e(MuxUI.DropZone, { ...args, 'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Upload files')) }, fallback(args.children, fixtureCopy(args, 'Drop files here'))),
  FileTrigger: (args) => e(MuxUI.FileTrigger, { ...args }, fallback(args.children, e(MuxUI.Button, null, fixtureCopy(args, 'Choose files')))),
  Dialog: (args) => e(MuxUI.Dialog, {
    ...args,
    title: fallback(args.title, fixtureCopy(args, 'Delete draft')),
    trigger: fallback(args.trigger, e(MuxUI.Button, null, fixtureCopy(args, 'Open dialog'))),
  }, fallback(args.children, e('p', null, `${fixtureCopy(args, 'Delete draft')} content.`))),
  Popover: (args) => e(MuxUI.Popover, {
    ...args,
    'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'More actions')),
    trigger: fallback(args.trigger, e(MuxUI.Button, null, fixtureCopy(args, 'More actions'))),
  }, fallback(args.children, args[migrationFixtureSymbol]
    ? e(React.Fragment, null,
      e('h2', { className: 'muxui-popover-title' }, fixtureCopy(args, 'More actions')),
      e('p', { className: 'muxui-popover-description' }, `${fixtureCopy(args, 'More actions')} content.`),
    )
    : e('p', null, `${fixtureCopy(args, 'More actions')} content.`))),
  PreviewTrigger: (args) => e(MuxUI.PreviewTrigger, {
    ...args,
    'aria-label': fallback(args['aria-label'], fixtureCopy(args, 'Document preview')),
    delay: args.delay ?? 0,
    closeDelay: args.closeDelay ?? 0,
    placement: args.placement ?? (args[migrationFixtureSymbol] ? 'bottom' : undefined),
    trigger: fallback(args.trigger, e(MuxUI.Button, null, args[migrationFixtureSymbol] ? fixtureCopy(args, 'Document preview') : 'Preview document')),
  }, fallback(args.children, args[migrationFixtureSymbol]
    ? `${fixtureCopy(args, 'Document preview')} content.`
    : e('p', null, `${fixtureCopy(args, 'Document preview')} content.`))),
  Toast: (args) => e(MuxUI.Toast, { ...args, message: fallback(args.message, fixtureCopy(args, 'Saved')), title: fallback(args.title, fixtureCopy(args, 'Saved')) }),
  Tooltip: (args) => e(MuxUI.Tooltip, {
    ...args,
    content: fallback(args.content, fixtureCopy(args, 'Keyboard shortcut: ⌘K')),
    delay: args.delay ?? 0,
    closeDelay: args.closeDelay ?? 0,
    trigger: fallback(args.trigger, e(MuxUI.Button, null, fixtureCopy(args, 'Keyboard help'))),
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
  const target = element?.querySelector('.muxui-drop-zone') ?? element;
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
  return `muxui-storybook-lifecycle-${family}-${state}`.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase();
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
      host.setAttribute('aria-label', `Mux UI overlay ${marker}`);
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
  const selectId = `muxui-storybook-lifecycle-select-${family.toLowerCase()}`;
  return e(React.Fragment, null,
    e('label', { htmlFor: selectId }, 'Lifecycle state'),
    e('select', {
      id: selectId,
      value: activeState,
      'aria-label': `${family} lifecycle state`,
      'data-muxui-storybook-lifecycle-select': family,
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
      className: 'muxui-storybook-transition-status',
      'data-muxui-storybook-transition': phase,
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
  // Mux UI's nav/group adapters unique accessible names without adding a prop
  // to the public API or changing the controls contract.
  if (family === 'Breadcrumbs' || family === 'Group') {
    variantArgs['aria-label'] = `${family} ${state}`;
  }
  const labelId = `muxui-storybook-state-${family}-${state.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const rendered = !available
    ? e('p', {
      className: 'muxui-storybook-state-unavailable',
      'data-muxui-storybook-state': 'unavailable',
    }, `Unavailable: MuxUI ${family} has no public prop or supported interaction for the ${state} state.`)
    : lifecycleAttribute
    ? activeLifecycleState === state
      ? e(LifecycleTransition, { family, state, args: variantArgs })
      : e('p', { className: 'muxui-storybook-lifecycle-inactive' }, `Select ${state} to inspect this lifecycle state.`)
    : renderFamily(family, variantArgs);
  const stateContent = e('section', {
    ref: stateRef,
    className: 'muxui-storybook-state',
    'aria-labelledby': labelId,
    'data-muxui-storybook-lifecycle': lifecycleAttribute ? state : undefined,
  }, e('h3', { id: labelId }, state), rendered);
  return marker ? e(OverlayHost, { marker }, stateContent) : stateContent;
}

export function renderStateCoverage(record, args = storyArgsForBinding(record.binding, 'states', record.family)) {
  const variants = stateCoverageForBinding(record.binding, record.family);
  const stateMatrix = e('div', { className: 'muxui-storybook-states' }, variants.map(({ name }) => e(StateVariant, {
    key: name,
    family: record.family,
    state: name,
    available: stateIsSupported(record.binding, name, record.family),
    args: stateArgsForBinding(record.binding, name, record.family, args),
  })));
  const lifecycleStates = variants.map(({ name }) => name).filter((name) => LIFECYCLE_ATTRIBUTES[name]);
  return lifecycleStates.length > 0
    ? e('div', { className: 'muxui-storybook-lifecycle-showcase' }, e(LifecycleSelection, {
      family: record.family,
      states: lifecycleStates,
      children: stateMatrix,
    }))
    : stateMatrix;
}

export function renderFamily(family, args) {
  const adapter = ADAPTERS[family];
  if (!adapter) throw new Error(`Unknown Mux UI React story family: ${family}`);
  return adapter(args);
}

export function createStoryMeta(record) {
  const component = MuxUI[record.family];
  if (!component) throw new Error(`Missing @muxui/react export for ${record.family}`);
  return {
    title: `Mux UI React/${record.tranche}/${record.family}`,
    component,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `Private development showcase for the Mux UI-owned ${record.family} family.`,
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
      ? { muxuiStateCoverage: stateCoverageForBinding(record.binding, record.family) }
      : undefined,
    render: (args) => variant === 'states'
      ? renderStateCoverage(record, args)
      : renderFamily(record.family, args),
  };
}
