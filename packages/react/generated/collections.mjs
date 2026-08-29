// @generated-from: packages/react/src/collections.mjs
// @generated-content-sha256: sha256:7be0f78e14dc36f450562cbd45109efff9031ad11bdbc57ee69233bc1cac7ef1
import React from 'react';
import {
  Calendar as AriaCalendar,
  CalendarCell as AriaCalendarCell,
  CalendarGrid as AriaCalendarGrid,
  CalendarGridBody as AriaCalendarGridBody,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarHeaderCell as AriaCalendarHeaderCell,
  CalendarHeading as AriaCalendarHeading,
  ColorArea as AriaColorArea,
  ColorField as AriaColorField,
  ColorPicker as AriaColorPicker,
  ColorSlider as AriaColorSlider,
  ColorSwatch as AriaColorSwatch,
  ColorSwatchPicker as AriaColorSwatchPicker,
  ColorSwatchPickerItem as AriaColorSwatchPickerItem,
  ColorWheel as AriaColorWheel,
  ColorWheelTrack as AriaColorWheelTrack,
  ColorThumb as AriaColorThumb,
  ComboBox as AriaComboBox,
  ComboBoxValue as AriaComboBoxValue,
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  RangeCalendar as AriaRangeCalendar,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
  Slider as AriaSlider,
  SliderFill as AriaSliderFill,
  SliderOutput as AriaSliderOutput,
  SliderThumb as AriaSliderThumb,
  SliderTrack as AriaSliderTrack,
  Table as AriaTable,
  TableBody as AriaTableBody,
  TableHeader as AriaTableHeader,
  Column as AriaColumn,
  Row as AriaRow,
  Cell as AriaCell,
  Tabs as AriaTabs,
  TabList as AriaTabList,
  Tab as AriaTab,
  TabPanels as AriaTabPanels,
  TabPanel as AriaTabPanel,
  TagGroup as AriaTagGroup,
  TagList as AriaTagList,
  Tag as AriaTag,
  ToggleButtonGroup as AriaToggleButtonGroup,
  TokenField as AriaTokenField,
  TokenInput as AriaTokenInput,
  Token as AriaToken,
  Toolbar as AriaToolbar,
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  Virtualizer as AriaVirtualizer,
  Group as AriaGroup,
  ListLayout,
  TreeItemContent as AriaTreeItemContent,
  Label as AriaLabel,
  Input as AriaInput,
  Text as AriaText,
  FieldError as AriaFieldError,
  Button as AriaButton,
  Popover as AriaPopover,
  parseColor,
  TokenFieldValue,
} from 'react-aria-components';
import { parseDate } from '@internationalized/date';

function classNames(base, className) {
  return [base, className].filter(Boolean).join(' ');
}

function textContent(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (React.isValidElement(value)) return textContent(value.props.children);
  return '';
}

function normalizeItems(items = []) {
  const used = new Set();
  return items.map((item, index) => {
    const source = typeof item === 'string' ? { label: item, value: item } : (item ?? {});
    const base = String(source.id ?? source.key ?? source.value ?? index);
    let id = base || String(index);
    let suffix = 1;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    const label = source.label ?? source.name ?? source.value ?? id;
    return { ...source, id, key: id, label, value: source.value ?? id, textValue: source.textValue ?? (textContent(label) || id) };
  });
}

function keySet(value) {
  return value === undefined ? undefined : value === 'all' ? 'all' : new Set((value ?? []).map(String));
}

function keyList(value) {
  return value === 'all' ? 'all' : [...(value ?? [])].map(String);
}

function accessibleName(props, componentName) {
  const { label, ariaLabel, ariaLabelledby } = props;
  if ((label === undefined || label === null || label === '') && !ariaLabel && !ariaLabelledby) {
    throw new TypeError(`${componentName} requires label, aria-label, or aria-labelledby`);
  }
}

function dateValue(value, name = 'Calendar') {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new TypeError(`${name} values must use YYYY-MM-DD ISO format`);
  try { return parseDate(value); } catch { throw new TypeError(`${name} values must use YYYY-MM-DD ISO format`); }
}

function coreDate(value) {
  return value ? String(value) : undefined;
}

function colorValue(value, name) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new TypeError(`${name} values must be Core color strings`);
  try { return parseColor(value); } catch { throw new TypeError(`${name} values must be valid CSS color strings`); }
}

// RAC's ColorPicker does not propagate disabled/read-only state through
// arbitrary child layout, so Core owns that propagation separately. A
// context keeps fragments and wrapper elements transparent to the contract.
const ColorPickerContext = React.createContext({ disabled: false, readOnly: false });

function useReadOnlyTargets(forwardedRef, readOnly, selector) {
  const scopeRef = React.useRef(null);
  const assignRef = React.useCallback((node) => {
    scopeRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  React.useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const targets = [
      ...(scope.matches(selector) ? [scope] : []),
      ...scope.querySelectorAll(selector),
    ];
    for (const target of targets) {
      if (readOnly) target.setAttribute('aria-readonly', 'true');
      else target.removeAttribute('aria-readonly');
    }
  }, [readOnly, selector]);
  return assignRef;
}

function calendarGrid(cellClass = 'core-calendar-cell') {
  return React.createElement(AriaCalendarGrid, { className: 'core-calendar-grid' },
    React.createElement(AriaCalendarGridHeader, { className: 'core-calendar-grid-header' },
      (day) => React.createElement(AriaCalendarHeaderCell, { className: 'core-calendar-header-cell' }, day)),
    React.createElement(AriaCalendarGridBody, { className: 'core-calendar-grid-body' },
      (date) => React.createElement(AriaCalendarCell, { date, className: cellClass })),
  );
}

function calendarHeader() {
  return React.createElement('div', { className: 'core-calendar-header' },
    React.createElement(AriaButton, { slot: 'previous', 'aria-label': 'Previous month', className: 'core-calendar-previous' }, '‹'),
    React.createElement(AriaCalendarHeading, { className: 'core-calendar-heading' }),
    React.createElement(AriaButton, { slot: 'next', 'aria-label': 'Next month', className: 'core-calendar-next' }, '›'));
}

function calendarProps(props, name, labelId) {
  const { value, defaultValue, focusedValue, minValue, maxValue, onChange, onFocusChange, disabled, readOnly, required, invalid, label, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, className, ...rest } = props;
  accessibleName({ label, ariaLabel, ariaLabelledby }, name);
  return {
    ...rest,
    value: dateValue(value, name),
    defaultValue: dateValue(defaultValue, name),
    focusedValue: dateValue(focusedValue, name),
    minValue: dateValue(minValue, name),
    maxValue: dateValue(maxValue, name),
    isDisabled: disabled,
    isReadOnly: readOnly,
    isRequired: required,
    isInvalid: invalid,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby ?? (label !== undefined ? labelId : undefined),
    className: classNames(`core-${name.toLowerCase()}`, className),
    onChange: (next) => { if (!disabled && !readOnly) onChange?.(coreDate(next)); },
    onFocusChange: (next) => { if (!disabled) onFocusChange?.(coreDate(next)); },
  };
}

export const Calendar = React.forwardRef(function Calendar(props, ref) {
  const { label, description: _description, errorMessage: _errorMessage, ...rest } = props;
  const labelId = React.useId();
  return React.createElement(AriaCalendar, { ...calendarProps({ ...rest, label }, 'Calendar', labelId), ref },
    label !== undefined ? React.createElement(AriaLabel, { id: labelId, className: 'core-field-label' }, label) : null,
    calendarHeader(),
    calendarGrid());
});
Calendar.displayName = 'Calendar';

export const RangeCalendar = React.forwardRef(function RangeCalendar(props, ref) {
  const { label, description: _description, errorMessage: _errorMessage, value, defaultValue, minValue, maxValue, onChange,
    disabled = false, readOnly = false, required = false, invalid = false, className,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...rest } = props;
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'RangeCalendar');
  const labelId = React.useId();
  const mapRange = (range) => range ? { start: dateValue(range.start, 'RangeCalendar'), end: dateValue(range.end, 'RangeCalendar') } : undefined;
  return React.createElement(AriaRangeCalendar, {
    ...rest,
    ref,
    value: mapRange(value),
    defaultValue: mapRange(defaultValue),
    minValue: dateValue(minValue, 'RangeCalendar'),
    maxValue: dateValue(maxValue, 'RangeCalendar'),
    isDisabled: disabled,
    isReadOnly: readOnly,
    isRequired: required,
    isInvalid: invalid,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby ?? (label !== undefined ? labelId : undefined),
    className: classNames('core-range-calendar', className),
    onChange: (next) => { if (!disabled && !readOnly) onChange?.(next ? { start: coreDate(next.start), end: coreDate(next.end) } : undefined); },
  },
  label !== undefined ? React.createElement(AriaLabel, { id: labelId, className: 'core-field-label' }, label) : null,
  calendarHeader(),
  calendarGrid('core-range-calendar-cell'));
});
RangeCalendar.displayName = 'RangeCalendar';

export const ColorSwatch = React.forwardRef(function ColorSwatch({ color, disabled = false, className, ...props }, ref) {
  const pickerState = React.useContext(ColorPickerContext);
  const effectiveDisabled = disabled || pickerState.disabled;
  return React.createElement(AriaColorSwatch, { ...props, ref, color: colorValue(color, 'ColorSwatch'), isDisabled: effectiveDisabled, 'aria-disabled': effectiveDisabled || undefined, 'data-disabled': effectiveDisabled || undefined, 'data-readonly': pickerState.readOnly || undefined, className: classNames('core-color-swatch', className) });
});
ColorSwatch.displayName = 'ColorSwatch';

export const ColorField = React.forwardRef(function ColorField({ label, description, errorMessage, value, defaultValue, onChange, disabled = false, readOnly = false, required = false, invalid = false, name, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'ColorField');
  const pickerState = React.useContext(ColorPickerContext);
  const effectiveDisabled = disabled || pickerState.disabled;
  const effectiveReadOnly = readOnly || pickerState.readOnly;
  return React.createElement(AriaColorField, {
    ...props, ref, name, value: colorValue(value, 'ColorField'), defaultValue: colorValue(defaultValue, 'ColorField'),
    onChange: (next) => { if (!effectiveDisabled && !effectiveReadOnly) onChange?.(next?.toString()); }, isDisabled: effectiveDisabled, isReadOnly: effectiveReadOnly, isRequired: required,
    isInvalid: invalid || errorMessage !== undefined, className: classNames('core-color-field', className), 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby,
  }, label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null,
  React.createElement(AriaInput, { className: 'core-field-input' }),
  description !== undefined ? React.createElement(AriaText, { slot: 'description', className: 'core-field-description' }, description) : null,
  errorMessage !== undefined ? React.createElement(AriaFieldError, { className: 'core-field-error' }, errorMessage) : null);
});
ColorField.displayName = 'ColorField';

export const ColorArea = React.forwardRef(function ColorArea({ label, value, defaultValue, onChange, disabled = false, readOnly = false, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'ColorArea');
  const pickerState = React.useContext(ColorPickerContext);
  const effectiveDisabled = disabled || pickerState.disabled;
  const effectiveReadOnly = readOnly || pickerState.readOnly;
  const labelId = React.useId();
  const labelledby = ariaLabelledby ?? (label !== undefined ? labelId : undefined);
  const assignAreaRef = useReadOnlyTargets(ref, effectiveReadOnly, '[role="slider"], input[type="range"]:not([tabindex="-1"])');
  const preventReadOnlyInteraction = (event) => {
    if (effectiveReadOnly) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return React.createElement('div', { className: 'core-color-area-field', 'data-disabled': effectiveDisabled || undefined, 'data-readonly': effectiveReadOnly || undefined, 'aria-disabled': effectiveDisabled || undefined }, label !== undefined ? React.createElement('span', { id: labelId, className: 'core-field-label' }, label) : null, React.createElement(AriaColorArea, { ...props, ref: assignAreaRef, value: colorValue(value, 'ColorArea'), defaultValue: colorValue(defaultValue, 'ColorArea'), onChange: (next) => { if (!effectiveDisabled && !effectiveReadOnly) onChange?.(next.toString()); }, isDisabled: effectiveDisabled, 'aria-label': ariaLabel, 'aria-labelledby': labelledby, 'aria-readonly': effectiveReadOnly || undefined, onPointerDownCapture: preventReadOnlyInteraction, onMouseDownCapture: preventReadOnlyInteraction, onKeyDownCapture: preventReadOnlyInteraction, className: classNames('core-color-area', className) }, React.createElement(AriaColorThumb, { className: 'core-color-area-thumb' })));
});
ColorArea.displayName = 'ColorArea';

export const ColorSlider = React.forwardRef(function ColorSlider({ label, value, defaultValue, onChange, channel = 'red', colorSpace, disabled = false, orientation = 'horizontal', className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'ColorSlider');
  const pickerState = React.useContext(ColorPickerContext);
  const effectiveDisabled = disabled || pickerState.disabled;
  const effectiveReadOnly = pickerState.readOnly;
  const preventReadOnlyInteraction = (event) => {
    if (effectiveReadOnly) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const assignSliderRef = useReadOnlyTargets(ref, effectiveReadOnly, '[role="slider"], input[type="range"]:not([tabindex="-1"])');
  return React.createElement('div', { 'aria-disabled': effectiveDisabled || undefined, 'data-disabled': effectiveDisabled || undefined, 'data-readonly': effectiveReadOnly || undefined, onPointerDownCapture: preventReadOnlyInteraction, onMouseDownCapture: preventReadOnlyInteraction, onKeyDownCapture: preventReadOnlyInteraction }, React.createElement(AriaColorSlider, { ...props, ref: assignSliderRef, channel, colorSpace, value: colorValue(value, 'ColorSlider'), defaultValue: colorValue(defaultValue, 'ColorSlider'), onChange: (next) => { if (!effectiveDisabled && !effectiveReadOnly) onChange?.(next.toString()); }, isDisabled: effectiveDisabled, orientation, 'aria-readonly': effectiveReadOnly || undefined, className: classNames('core-color-slider', className), 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null, React.createElement(AriaSliderTrack, { className: 'core-color-slider-track' }, React.createElement(AriaSliderFill, { className: 'core-color-slider-fill' }), React.createElement(AriaColorThumb, { className: 'core-color-slider-thumb' }))));
});
ColorSlider.displayName = 'ColorSlider';

export const ColorWheel = React.forwardRef(function ColorWheel({ value, defaultValue, onChange, disabled = false, className, outerRadius = 96, innerRadius = 64, label: _label, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ ariaLabel, ariaLabelledby }, 'ColorWheel');
  const pickerState = React.useContext(ColorPickerContext);
  const effectiveDisabled = disabled || pickerState.disabled;
  const effectiveReadOnly = pickerState.readOnly;
  const preventReadOnlyInteraction = (event) => {
    if (effectiveReadOnly) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const assignWheelRef = useReadOnlyTargets(ref, effectiveReadOnly, '[role="slider"], input[type="range"]:not([tabindex="-1"])');
  return React.createElement('div', { 'aria-disabled': effectiveDisabled || undefined, 'data-disabled': effectiveDisabled || undefined, 'data-readonly': effectiveReadOnly || undefined, onPointerDownCapture: preventReadOnlyInteraction, onMouseDownCapture: preventReadOnlyInteraction, onKeyDownCapture: preventReadOnlyInteraction }, React.createElement(AriaColorWheel, { ...props, ref: assignWheelRef, outerRadius, innerRadius, value: colorValue(value, 'ColorWheel'), defaultValue: colorValue(defaultValue, 'ColorWheel'), onChange: (next) => { if (!effectiveDisabled && !effectiveReadOnly) onChange?.(next.toString()); }, isDisabled: effectiveDisabled, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, 'aria-readonly': effectiveReadOnly || undefined, className: classNames('core-color-wheel', className) }, React.createElement(AriaColorWheelTrack, { className: 'core-color-wheel-track' }), React.createElement(AriaColorThumb, { className: 'core-color-wheel-thumb' })));
});
ColorWheel.displayName = 'ColorWheel';

export const ColorPicker = React.forwardRef(function ColorPicker({ value, defaultValue, onChange, disabled = false, readOnly = false, children, className, ...props }, ref) {
  return React.createElement('div', { ...props, ref, 'aria-disabled': disabled || undefined, 'data-disabled': disabled || undefined, 'data-readonly': readOnly || undefined, className: classNames('core-color-picker', className) }, React.createElement(AriaColorPicker, { value: colorValue(value, 'ColorPicker'), defaultValue: colorValue(defaultValue, 'ColorPicker'), onChange: (next) => { if (!disabled && !readOnly) onChange?.(next.toString()); } }, React.createElement(ColorPickerContext.Provider, { value: { disabled, readOnly } }, children)));
});
ColorPicker.displayName = 'ColorPicker';

export const ColorSwatchPicker = React.forwardRef(function ColorSwatchPicker({ items = [], value, defaultValue, onChange, disabled = false, children: _children, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  const normalized = normalizeItems(items);
  const pickerState = React.useContext(ColorPickerContext);
  const effectiveDisabled = disabled || pickerState.disabled;
  const effectiveReadOnly = pickerState.readOnly;
  accessibleName({ ariaLabel, ariaLabelledby }, 'ColorSwatchPicker');
  const preventReadOnlyInteraction = (event) => {
    if (effectiveReadOnly) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const assignSwatchPickerRef = useReadOnlyTargets(ref, effectiveReadOnly, '[role="listbox"]');
  return React.createElement('div', { 'aria-disabled': effectiveDisabled || undefined, 'data-disabled': effectiveDisabled || undefined, 'data-readonly': effectiveReadOnly || undefined, onPointerDownCapture: preventReadOnlyInteraction, onMouseDownCapture: preventReadOnlyInteraction, onKeyDownCapture: preventReadOnlyInteraction }, React.createElement(AriaColorSwatchPicker, { ...props, ref: assignSwatchPickerRef, value: colorValue(value, 'ColorSwatchPicker'), defaultValue: colorValue(defaultValue, 'ColorSwatchPicker'), onChange: (next) => { if (!effectiveDisabled && !effectiveReadOnly) onChange?.(next.toString()); }, isDisabled: effectiveDisabled, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, 'aria-readonly': effectiveReadOnly || undefined, className: classNames('core-color-swatch-picker', className) }, normalized.map((item) => React.createElement(AriaColorSwatchPickerItem, { key: item.id, color: colorValue(item.color ?? item.value, 'ColorSwatchPicker'), id: item.id, isDisabled: effectiveDisabled || item.disabled, className: 'core-color-swatch-picker-item' }, React.createElement(AriaColorSwatch, { color: colorValue(item.color ?? item.value, 'ColorSwatchPicker'), isDisabled: effectiveDisabled || item.disabled, 'aria-disabled': effectiveDisabled || item.disabled || undefined, 'data-disabled': effectiveDisabled || item.disabled || undefined, className: 'core-color-swatch' })))));
});
ColorSwatchPicker.displayName = 'ColorSwatchPicker';

function collectionProps(props, componentName) {
  const { items = [], selectedIds, defaultSelectedIds, onSelectionChange, onAction, selectionMode = 'single', disabled = false, children: _children, className, ...rest } = props;
  const normalized = normalizeItems(items);
  accessibleName({ ariaLabel: rest['aria-label'], ariaLabelledby: rest['aria-labelledby'] }, componentName);
  const disabledKeys = disabled ? new Set(normalized.map((item) => item.id)) : new Set(normalized.filter((item) => item.disabled).map((item) => item.id));
  return { normalized, rest, selectedKeys: keySet(selectedIds), defaultSelectedKeys: keySet(defaultSelectedIds), onSelectionChange: (keys) => { if (!disabled) onSelectionChange?.(keyList(keys)); }, onAction, selectionMode, className: classNames(`core-${componentName}`, className), disabled, disabledKeys };
}

export const ListBox = React.forwardRef(function ListBox(props, ref) {
  const { normalized, rest, selectedKeys, defaultSelectedKeys, onSelectionChange, onAction, selectionMode, className, disabled, disabledKeys } = collectionProps(props, 'list-box');
  return React.createElement(AriaListBox, { ...rest, ref, items: normalized, selectionMode, selectedKeys, defaultSelectedKeys, disabledKeys, onSelectionChange, onAction: (key) => { const item = normalized.find((candidate) => candidate.id === String(key)); if (!disabled && !item?.disabled) onAction?.(item); }, isDisabled: disabled, 'aria-disabled': disabled || undefined, className }, (item) => React.createElement(AriaListBoxItem, { id: item.id, textValue: item.textValue, isDisabled: disabled || item.disabled, 'data-disabled': disabled || item.disabled || undefined, 'aria-disabled': disabled || item.disabled || undefined, className: 'core-list-box-item' }, item.label));
});
ListBox.displayName = 'ListBox';

export const GridList = React.forwardRef(function GridList(props, ref) {
  const { normalized, rest, selectedKeys, defaultSelectedKeys, onSelectionChange, onAction, selectionMode, className, disabled, disabledKeys } = collectionProps(props, 'grid-list');
  return React.createElement(AriaGridList, { ...rest, ref, items: normalized, selectionMode, selectedKeys, defaultSelectedKeys, disabledKeys, onSelectionChange, onAction: (key) => { const item = normalized.find((candidate) => candidate.id === String(key)); if (!disabled && !item?.disabled) onAction?.(item); }, isDisabled: disabled, 'aria-disabled': disabled || undefined, className }, (item) => React.createElement(AriaGridListItem, { id: item.id, textValue: item.textValue, isDisabled: disabled || item.disabled, className: 'core-grid-list-item' }, item.label));
});
GridList.displayName = 'GridList';

export const Menu = React.forwardRef(function Menu({ items = [], onAction, onSelect, disabled = false, shouldCloseOnSelect = true, children: _children, className, ...props }, ref) {
  const normalized = normalizeItems(items);
  accessibleName({ ariaLabel: props['aria-label'], ariaLabelledby: props['aria-labelledby'] }, 'Menu');
  const disabledKeys = disabled ? new Set(normalized.map((item) => item.id)) : new Set(normalized.filter((item) => item.disabled).map((item) => item.id));
  return React.createElement(AriaMenu, { ...props, ref, items: normalized, disabledKeys, isDisabled: disabled, shouldCloseOnSelect, onAction: (key) => { const item = normalized.find((candidate) => candidate.id === String(key)); if (!disabled && !item?.disabled) { onAction?.(item); onSelect?.(item); } }, 'aria-disabled': disabled || undefined, className: classNames('core-menu', className) }, (item) => React.createElement(AriaMenuItem, { id: item.id, textValue: item.textValue, isDisabled: item.disabled || disabled, className: 'core-menu-item' }, item.label));
});
Menu.displayName = 'Menu';

export const ComboBox = React.forwardRef(function ComboBox({ label, description, errorMessage, items = [], value, defaultValue, selectedId, defaultSelectedId, onChange, onSelect, disabled = false, readOnly = false, required = false, invalid = false, placeholder, name, children: _children, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'ComboBox');
  const normalized = normalizeItems(items);
  const handleSelection = (key) => { const item = normalized.find((candidate) => candidate.id === String(key)); if (item && !disabled && !readOnly) onSelect?.(item); };
  return React.createElement(AriaComboBox, { ...props, ref, items: normalized, ...(value === undefined ? {} : { inputValue: value }), defaultInputValue: defaultValue, selectedKey: selectedId, defaultSelectedKey: defaultSelectedId, onInputChange: (next) => { if (!disabled && !readOnly) onChange?.(next); }, onSelectionChange: handleSelection, isDisabled: disabled, isReadOnly: readOnly, isRequired: required, isInvalid: invalid || errorMessage !== undefined, name, className: classNames('core-combo-box', className), 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby },
    label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null,
    React.createElement(AriaGroup, { className: 'core-combo-control' },
      React.createElement(AriaInput, { className: 'core-field-input', placeholder }),
      React.createElement(AriaButton, { className: 'core-combo-box-trigger', 'aria-label': 'Show options' },
        React.createElement('svg', { className: 'core-combo-box-arrow', viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false' },
          React.createElement('path', { d: 'm6 9 6 6 6-6' })))),
    description !== undefined ? React.createElement(AriaText, { slot: 'description', className: 'core-field-description' }, description) : null,
    errorMessage !== undefined ? React.createElement(AriaFieldError, { className: 'core-field-error' }, errorMessage) : null,
    React.createElement(AriaPopover, { className: 'core-combo-box-popover' }, React.createElement(AriaListBox, { items: normalized, className: 'core-combo-box-list' }, (item) => React.createElement(AriaListBoxItem, { id: item.id, textValue: item.textValue, className: 'core-combo-box-option' }, item.label))),
  );
});
ComboBox.displayName = 'ComboBox';

export const Select = React.forwardRef(function Select({ label, description, errorMessage, items = [], value, defaultValue, onChange, disabled = false, readOnly = false, required = false, invalid = false, placeholder = 'Select an option', name, children: _children, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'Select');
  const normalized = normalizeItems(items);
  const handleSelection = (key) => { if (!disabled && !readOnly) onChange?.(key == null ? undefined : String(key)); };
  return React.createElement(AriaSelect, { ...props, ref, selectedKey: value, defaultSelectedKey: defaultValue, onSelectionChange: handleSelection, isDisabled: disabled, isReadOnly: readOnly, isRequired: required, isInvalid: invalid || errorMessage !== undefined, name, className: classNames('core-select', className), 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby },
    label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null,
    React.createElement(AriaButton, { className: 'core-select-trigger', 'data-disabled': disabled || undefined, 'aria-disabled': disabled || undefined }, React.createElement(AriaSelectValue, { className: 'core-select-value', children: ({ selectedText }) => selectedText || placeholder }), React.createElement('span', { className: 'core-select-arrow', 'aria-hidden': 'true' }, '⌄')),
    description !== undefined ? React.createElement(AriaText, { slot: 'description', className: 'core-field-description' }, description) : null,
    errorMessage !== undefined ? React.createElement(AriaFieldError, { className: 'core-field-error' }, errorMessage) : null,
    React.createElement(AriaPopover, { className: 'core-select-popover' }, React.createElement(AriaListBox, { items: normalized, className: 'core-select-list' }, (item) => React.createElement(AriaListBoxItem, { id: item.id, textValue: item.textValue, className: 'core-select-option' }, item.label))),
  );
});
Select.displayName = 'Select';

export const RadioGroup = React.forwardRef(function RadioGroup({ label, options = [], value, defaultValue, onChange, disabled = false, readOnly = false, required = false, invalid = false, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'RadioGroup');
  return React.createElement(AriaRadioGroup, { ref, value, defaultValue, onChange: (next) => { if (!disabled && !readOnly) onChange?.(next); }, isDisabled: disabled, isReadOnly: readOnly, isRequired: required, isInvalid: invalid, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, className: classNames('core-radio-group', className) }, label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null, options.map((option) => React.createElement(AriaRadio, { key: String(option.id ?? option.value), value: String(option.value ?? option.id), isDisabled: disabled || option.disabled, className: 'core-radio' }, React.createElement('span', { 'aria-hidden': 'true', className: 'core-radio-indicator' }), option.label ?? option.value)));
});
RadioGroup.displayName = 'RadioGroup';

export const Slider = React.forwardRef(function Slider({ label, value, defaultValue, onChange, min = 0, max = 100, step = 1, disabled = false, orientation = 'horizontal', className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'Slider');
  return React.createElement(AriaSlider, { ...props, ref, value, defaultValue, onChange: (next) => { if (!disabled) onChange?.(next); }, minValue: min, maxValue: max, step, isDisabled: disabled, orientation, className: classNames('core-slider', className), 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, React.createElement('div', { className: 'core-slider-header' }, label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null, React.createElement(AriaOutput, { className: 'core-slider-output' })), React.createElement('div', { className: 'core-slider-control' }, React.createElement(AriaSliderTrack, { className: 'core-slider-track' }, React.createElement(AriaSliderFill, { className: 'core-slider-fill' }), React.createElement(AriaSliderThumb, { className: 'core-slider-thumb' }))));
});
Slider.displayName = 'Slider';

const AriaOutput = AriaSliderOutput;

export const Table = React.forwardRef(function Table({ columns = [], rows = [], selectedIds, defaultSelectedIds, onSelectionChange, onRowAction, selectionMode = 'none', disabled = false, children: _children, className, 'aria-label': ariaLabel, 'aria-labelledby': _ariaLabelledby, ...props }, ref) {
  const normalizedRows = normalizeItems(rows);
  const normalizedColumns = normalizeItems(columns);
  accessibleName({ ariaLabel }, 'Table');
  const disabledKeys = disabled ? new Set(normalizedRows.map((row) => row.id)) : new Set(normalizedRows.filter((row) => row.disabled).map((row) => row.id));
  return React.createElement(AriaTable, { ...props, ref, selectionMode, selectedKeys: keySet(selectedIds), defaultSelectedKeys: keySet(defaultSelectedIds), disabledKeys, isDisabled: disabled, onSelectionChange: (keys) => { if (!disabled) onSelectionChange?.(keyList(keys)); }, onRowAction: (key) => { const row = normalizedRows.find((item) => item.id === String(key)); if (!disabled && !row?.disabled) onRowAction?.(row); }, 'aria-label': ariaLabel, 'aria-disabled': disabled || undefined, className: classNames('core-table', className) },
    React.createElement(AriaTableHeader, { columns: normalizedColumns, className: 'core-table-header' }, (column) => React.createElement(AriaColumn, { id: column.id, isRowHeader: column.isRowHeader, allowsSorting: column.sortable, className: 'core-table-column' }, column.label)),
    React.createElement(AriaTableBody, { items: normalizedRows, className: 'core-table-body' }, (row) => React.createElement(AriaRow, { id: row.id, className: 'core-table-row' }, normalizedColumns.map((column) => React.createElement(AriaCell, { key: column.id, className: 'core-table-cell' }, row[column.id] ?? row.values?.[column.id] ?? '')))),
  );
});
Table.displayName = 'Table';

export const Tabs = React.forwardRef(function Tabs({ items = [], value, defaultValue, onChange, orientation = 'horizontal', disabled = false, children: _children, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  const normalized = normalizeItems(items);
  accessibleName({ ariaLabel, ariaLabelledby }, 'Tabs');
  return React.createElement(AriaTabs, { ...props, ref, selectedKey: value, defaultSelectedKey: defaultValue ?? normalized[0]?.id, onSelectionChange: (key) => { const item = normalized.find((candidate) => candidate.id === String(key)); if (!disabled && !item?.disabled) onChange?.(String(key)); }, orientation, isDisabled: disabled, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, className: classNames('core-tabs', className) },
    React.createElement(AriaTabList, { items: normalized, className: 'core-tab-list' }, (item) => React.createElement(AriaTab, { id: item.id, isDisabled: disabled || item.disabled, 'data-disabled': disabled || item.disabled || undefined, 'aria-disabled': disabled || item.disabled || undefined, className: 'core-tab' }, item.label)),
    React.createElement(AriaTabPanels, { items: normalized, className: 'core-tab-panels' }, (item) => React.createElement(AriaTabPanel, { id: item.id, className: 'core-tab-panel' }, item.panel)),
  );
});
Tabs.displayName = 'Tabs';

export const TagGroup = React.forwardRef(function TagGroup({ label, items = [], onRemove, onAction, disabled = false, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, ref) {
  const normalized = normalizeItems(items);
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'TagGroup');
  return React.createElement(AriaTagGroup, { ref, onRemove: (keys) => { if (!disabled) onRemove?.([...keys].map(String).map((id) => normalized.find((item) => item.id === id)).filter((item) => item && !item.disabled)); }, onAction: (key) => { const item = normalized.find((candidate) => candidate.id === String(key)); if (!disabled && !item?.disabled) onAction?.(item); }, isDisabled: disabled, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, className: classNames('core-tag-group', className) }, label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null, React.createElement(AriaTagList, { items: normalized, className: 'core-tag-list' }, (item) => React.createElement(AriaTag, { id: item.id, textValue: item.textValue, isDisabled: disabled || item.disabled, className: 'core-tag' }, item.label, onRemove ? React.createElement(AriaButton, { slot: 'remove', isDisabled: disabled || item.disabled, className: 'core-tag-remove' }, '×') : null)));
});
TagGroup.displayName = 'TagGroup';

export const ToggleButtonGroup = React.forwardRef(function ToggleButtonGroup({ selectedIds, defaultSelectedIds, onSelectionChange, orientation = 'horizontal', disabled = false, children, className, ...props }, ref) {
  accessibleName({ ariaLabel: props['aria-label'], ariaLabelledby: props['aria-labelledby'] }, 'ToggleButtonGroup');
  return React.createElement(AriaToggleButtonGroup, { ...props, ref, selectedKeys: keySet(selectedIds), defaultSelectedKeys: keySet(defaultSelectedIds), onSelectionChange: (keys) => { if (!disabled) onSelectionChange?.(keyList(keys)); }, orientation, isDisabled: disabled, className: classNames('core-toggle-button-group', className) }, children);
});
ToggleButtonGroup.displayName = 'ToggleButtonGroup';

function toTokenValue(values = []) {
  return new TokenFieldValue(values.map((value) => ({ type: 'token', text: String(value), value: String(value) })));
}

function tokenValues(fieldValue) {
  return fieldValue.segments.filter((segment) => segment.type === 'token').map((segment) => String(segment.value ?? segment.text));
}

function useTokenFieldFormReset(onReset) {
  const callbackRef = React.useRef(onReset);
  const formRef = React.useRef(null);
  const listenerRef = React.useRef(null);
  const resetTokenRef = React.useRef(0);
  callbackRef.current = onReset;
  return React.useCallback((node) => {
    const nextForm = node?.form ?? null;
    if (nextForm === formRef.current) return;
    if (formRef.current && listenerRef.current) formRef.current.removeEventListener('reset', listenerRef.current, true);
    formRef.current = nextForm;
    listenerRef.current = null;
    if (!nextForm) return;
    const listener = (event) => {
      const resetToken = ++resetTokenRef.current;
      Promise.resolve().then(() => {
        if (resetTokenRef.current !== resetToken || formRef.current !== nextForm || listenerRef.current !== listener || event.defaultPrevented) return;
        callbackRef.current();
      });
    };
    listenerRef.current = listener;
    nextForm.addEventListener('reset', listener, true);
  }, []);
}

export const TokenField = React.forwardRef(function TokenField({ label, value, defaultValue = [], onChange, disabled = false, readOnly = false, name, placeholder, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, ref) {
  accessibleName({ label, ariaLabel, ariaLabelledby }, 'TokenField');
  const controlled = value !== undefined;
  const initialDefaultValueRef = React.useRef(null);
  if (initialDefaultValueRef.current === null) initialDefaultValueRef.current = [...defaultValue];
  const initialDefaultValue = initialDefaultValueRef.current;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => [...initialDefaultValue]);
  const [resetVersion, setResetVersion] = React.useState(0);
  const currentValue = controlled ? value : uncontrolledValue;
  const resetAnchorRef = useTokenFieldFormReset(() => {
    if (!controlled) {
      setUncontrolledValue([...initialDefaultValue]);
      setResetVersion((version) => version + 1);
    }
  });
  const handleChange = (next) => {
    if (disabled || readOnly) return;
    const nextValue = tokenValues(next);
    if (!controlled) setUncontrolledValue(nextValue);
    onChange?.(nextValue);
  };
  return React.createElement(AriaTokenField, { key: resetVersion, ref, value: toTokenValue(currentValue), onChange: handleChange, isDisabled: disabled, isReadOnly: readOnly, className: classNames('core-token-field', className), 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, label !== undefined ? React.createElement(AriaLabel, { className: 'core-field-label' }, label) : null, React.createElement(AriaTokenInput, { className: 'core-token-input', children: (segment) => segment.type === 'token' ? React.createElement(AriaToken, { className: 'core-token' }, segment.text) : null }), React.createElement('input', { ref: resetAnchorRef, type: 'hidden', disabled: true, tabIndex: -1, 'aria-hidden': 'true' }), name ? currentValue.map((token, index) => React.createElement('input', { key: `${token}-${index}`, type: 'hidden', name, value: token, disabled, 'aria-hidden': 'true' })) : null, placeholder ? React.createElement('span', { className: 'core-token-placeholder' }, placeholder) : null);
});
TokenField.displayName = 'TokenField';

export const Toolbar = React.forwardRef(function Toolbar({ orientation = 'horizontal', disabled = false, children, className, ...props }, ref) {
  accessibleName({ ariaLabel: props['aria-label'], ariaLabelledby: props['aria-labelledby'] }, 'Toolbar');
  return React.createElement(AriaToolbar, { ...props, ref, orientation, isDisabled: disabled, 'aria-disabled': disabled || undefined, className: classNames('core-toolbar', className) }, children);
});
Toolbar.displayName = 'Toolbar';

function normalizeTreeItems(items, used = new Set(), parentDisabled = false) {
  return items.map((item, index) => {
    const source = typeof item === 'string' ? { label: item, value: item } : (item ?? {});
    const base = String(source.id ?? source.key ?? source.value ?? index);
    let id = base || String(index);
    let suffix = 1;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    const nested = normalizeTreeItems(source.children ?? source.items ?? [], used, parentDisabled || Boolean(source.disabled));
    const label = source.label ?? source.name ?? source.value ?? id;
    return { ...source, id, key: id, label, value: source.value ?? id, textValue: source.textValue ?? (textContent(label) || id), disabled: parentDisabled || Boolean(source.disabled), children: nested };
  });
}

function treeKeys(items, keys = []) {
  for (const item of items) {
    keys.push(item.id);
    treeKeys(item.children ?? [], keys);
  }
  return keys;
}

function findTreeItem(items, key) {
  for (const item of items) {
    if (item.id === String(key)) return item;
    const nested = findTreeItem(item.children ?? [], key);
    if (nested) return nested;
  }
  return undefined;
}

function treeItem(item) {
  const nested = item.children ?? [];
  return React.createElement(AriaTreeItem, { id: item.id, textValue: item.textValue, hasChildItems: nested.length > 0, isDisabled: item.disabled, className: 'core-tree-item' },
    React.createElement(AriaTreeItemContent, null,
      React.createElement('div', { className: 'core-tree-item-content' },
        nested.length ? React.createElement(AriaButton, { slot: 'chevron', 'aria-label': 'Toggle', isDisabled: item.disabled, className: 'core-tree-toggle' }, '▶') : null,
        React.createElement('span', { className: 'core-tree-item-label' }, item.label)),
    ),
    nested.map((child) => React.cloneElement(treeItem(child), { key: child.id })));
}

export const Tree = React.forwardRef(function Tree({ items = [], selectedIds, defaultSelectedIds, expandedIds, defaultExpandedIds, onSelectionChange, onExpandedChange, onAction, selectionMode = 'single', disabled = false, children: _children, className, ...props }, ref) {
  accessibleName({ ariaLabel: props['aria-label'], ariaLabelledby: props['aria-labelledby'] }, 'Tree');
  const normalized = normalizeTreeItems(items);
  const allKeys = treeKeys(normalized);
  const disabledKeys = new Set(disabled ? allKeys : allKeys.filter((key) => findTreeItem(normalized, key)?.disabled));
  const expanded = expandedIds === 'all' ? new Set(allKeys) : keySet(expandedIds);
  const defaultExpanded = defaultExpandedIds === 'all' ? new Set(allKeys) : keySet(defaultExpandedIds);
  return React.createElement(AriaTree, { ...props, ref, selectionMode, selectedKeys: keySet(selectedIds), defaultSelectedKeys: keySet(defaultSelectedIds), expandedKeys: expanded, defaultExpandedKeys: defaultExpanded, disabledKeys, onSelectionChange: (keys) => { if (!disabled) onSelectionChange?.(keyList(keys)); }, onExpandedChange: (keys) => { if (!disabled) onExpandedChange?.(keyList(keys)); }, onAction: (key) => { const item = findTreeItem(normalized, key); if (!disabled && !item?.disabled) onAction?.(item); }, isDisabled: disabled, className: classNames('core-tree', className) }, normalized.map((item) => React.cloneElement(treeItem(item), { key: item.id })));
});
Tree.displayName = 'Tree';

function assertPositiveVirtualizerNumber(value, property) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`Virtualizer ${property} must be a finite number greater than 0`);
}

function assertNonNegativeVirtualizerNumber(value, property) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`Virtualizer ${property} must be a finite number greater than or equal to 0`);
}

export const Virtualizer = React.forwardRef(function Virtualizer({ items = [], renderItem: _renderItem, itemHeight = 40, height = 240, overscan = 2, disabled = false, children: _children, className, 'aria-label': ariaLabel, 'aria-labelledby': _ariaLabelledby, style, onScroll, ...props }, ref) {
  accessibleName({ ariaLabel }, 'Virtualizer');
  assertPositiveVirtualizerNumber(itemHeight, 'itemHeight');
  assertPositiveVirtualizerNumber(height, 'height');
  assertNonNegativeVirtualizerNumber(overscan, 'overscan');
  const normalized = normalizeItems(items);
  // RAC manages the rendered window from the viewport and row size. The
  // padding option is layout padding, not overscan, so passing it visibly
  // offsets the first item and shifts the virtual content. Keep overscan in
  // the public contract while leaving window placement to RAC.
  const layoutOptions = { rowSize: itemHeight };
  return React.createElement(AriaVirtualizer, { layout: ListLayout, layoutOptions },
    React.createElement(AriaListBox, {
      ...props,
      ref,
      items: normalized,
      selectionMode: 'none',
      disabledKeys: disabled ? new Set(normalized.map((item) => item.id)) : new Set(normalized.filter((item) => item.disabled).map((item) => item.id)),
      isDisabled: disabled,
      'aria-label': ariaLabel,
      'aria-disabled': disabled || undefined,
      className: classNames('core-virtualizer', className),
      style: { ...style, blockSize: height, overflow: 'auto' },
      onScroll: (event) => { if (!disabled) onScroll?.(event); },
    }, (item) => React.createElement(AriaListBoxItem, {
      id: item.id,
      textValue: item.textValue,
      className: 'core-virtualizer-item',
      isDisabled: disabled || item.disabled,
    }, item.label ?? item.value ?? item.id)));
});
Virtualizer.displayName = 'Virtualizer';
