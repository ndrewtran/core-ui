// @generated-from: packages/react/src/fields.mjs
// @generated-content-sha256: sha256:acd4fe633854c18e0676af40a58e00d31338d6cffa0debd400ac8201292e7277
import React from 'react';
import {
  Autocomplete as AriaAutocomplete,
  Button as AriaButton,
  Calendar as AriaCalendar,
  CalendarCell as AriaCalendarCell,
  CalendarGrid as AriaCalendarGrid,
  CheckboxGroup as AriaCheckboxGroup,
  DateField as AriaDateField,
  DateInput as AriaDateInput,
  DatePicker as AriaDatePicker,
  DateRangePicker as AriaDateRangePicker,
  DateSegment as AriaDateSegment,
  Dialog as AriaDialog,
  FieldError as AriaFieldError,
  Form as AriaForm,
  Group as AriaGroup,
  Input as AriaInput,
  Label as AriaLabel,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  NumberField as AriaNumberField,
  Popover as AriaPopover,
  RangeCalendar as AriaRangeCalendar,
  SearchField as AriaSearchField,
  SwitchButton as AriaSwitchButton,
  SwitchField as AriaSwitchField,
  Text as AriaText,
  TextField as AriaTextField,
  TimeField as AriaTimeField,
} from 'react-aria-components';
import { parseDate, parseTime } from '@internationalized/date';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/u;
const DATE_PLACEHOLDER = parseDate('2000-01-01');
const TIME_PLACEHOLDER = parseTime('00:00');

function classNames(base, className) {
  return [base, className].filter(Boolean).join(' ');
}

function fieldLabel(label) {
  return label === undefined || label === null ? null : React.createElement(AriaLabel, { className: 'core-field-label' }, label);
}

function assertAccessibleName({ label, ariaLabel, ariaLabelledby }, componentName) {
  if ((label === undefined || label === null || label === false || label === '') && !ariaLabel && !ariaLabelledby) {
    throw new TypeError(`${componentName} requires label, aria-label, or aria-labelledby`);
  }
}

function fieldDescription(description) {
  return description === undefined ? null : React.createElement(AriaText, { slot: 'description', className: 'core-field-description' }, description);
}

function fieldError(errorMessage) {
  return errorMessage === undefined ? null : React.createElement(AriaFieldError, { className: 'core-field-error' }, errorMessage);
}

function fieldChildren({ label, description, errorMessage, children, input }) {
  return React.createElement(React.Fragment, null,
    fieldLabel(label),
    input,
    children,
    fieldDescription(description),
    fieldError(errorMessage),
  );
}

function validationProps({ disabled, readOnly, required, invalid, errorMessage }) {
  return {
    isDisabled: disabled,
    isReadOnly: readOnly,
    isRequired: required,
    isInvalid: invalid || errorMessage !== undefined,
  };
}

function dateOrUndefined(value) {
  if (!value) return undefined;
  const text = String(value);
  if (!ISO_DATE_PATTERN.test(text)) throw new TypeError('Core date values must use YYYY-MM-DD ISO format');
  return parseDate(text);
}

function timeOrUndefined(value) {
  if (!value) return undefined;
  const text = String(value);
  if (!ISO_TIME_PATTERN.test(text)) throw new TypeError('Core time values must use HH:mm[:ss[.sss]] ISO format');
  return parseTime(text);
}

function coreDateValue(value) {
  return value ? String(value) : undefined;
}

function calendarChildren() {
  return React.createElement(AriaCalendarGrid, { className: 'core-calendar-grid' }, (date) => React.createElement(AriaCalendarCell, { date, className: 'core-calendar-cell' }));
}

function datePopover() {
  return React.createElement(AriaPopover, { className: 'core-date-popover' }, React.createElement(AriaDialog, { className: 'core-date-dialog' }, React.createElement(AriaCalendar, { className: 'core-calendar' }, calendarChildren())));
}

function rangeDatePopover() {
  return React.createElement(AriaPopover, { className: 'core-date-popover' }, React.createElement(AriaDialog, { className: 'core-date-dialog' }, React.createElement(AriaRangeCalendar, { className: 'core-calendar' }, calendarChildren())));
}

function dateInput() {
  return React.createElement(AriaDateInput, { className: 'core-date-input' }, (segment) => React.createElement(AriaDateSegment, { segment, className: 'core-date-segment' }));
}

// RAC 1.20 owns form reset for most fields, but not TimeField and the
// range serialization below. Attach one listener to the component's owning
// form so multiple forms/components remain isolated and teardown is exact.
// Capture blocks intermediate RAC changes; the callback waits for consumer
// onReset handlers to finish before checking cancellation.
function useOwningFormReset(onReset, onResetStart, onResetEnd) {
  const callbackRef = React.useRef(onReset);
  const resetStartRef = React.useRef(onResetStart);
  const resetEndRef = React.useRef(onResetEnd);
  const formRef = React.useRef(null);
  const listenerRef = React.useRef(null);
  const resetTokenRef = React.useRef(0);
  callbackRef.current = onReset;
  resetStartRef.current = onResetStart;
  resetEndRef.current = onResetEnd;
  return React.useCallback((node) => {
    const nextForm = node?.form ?? null;
    if (nextForm === formRef.current) return;
    if (formRef.current && listenerRef.current) {
      formRef.current.removeEventListener('reset', listenerRef.current, true);
    }
    formRef.current = nextForm;
    listenerRef.current = null;
    if (nextForm) {
      const listener = (event) => {
        const resetToken = ++resetTokenRef.current;
        resetStartRef.current?.();
        Promise.resolve().then(() => {
          if (resetTokenRef.current !== resetToken) return;
          resetEndRef.current?.();
          if (!event.defaultPrevented && formRef.current === nextForm && listenerRef.current === listener) callbackRef.current();
        });
      };
      listenerRef.current = listener;
      nextForm.addEventListener('reset', listener, true);
    }
  }, []);
}

function formResetAnchor(ref) {
  return React.createElement('input', {
    ref,
    type: 'hidden',
    disabled: true,
    tabIndex: -1,
    className: 'core-form-reset-anchor',
    'aria-hidden': 'true',
  });
}

export const TextField = React.forwardRef(function TextField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  placeholder,
  type = 'text',
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  autoComplete,
  autoFocus,
  inputMode,
  maxLength,
  minLength,
  pattern,
  spellCheck,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'TextField');
  return React.createElement(AriaTextField, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value,
    defaultValue,
    onChange,
    name,
    className: classNames('core-text-field', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: React.createElement(AriaInput, {
      className: 'core-field-input',
      type,
      placeholder,
      autoComplete,
      autoFocus,
      inputMode,
      maxLength,
      minLength,
      pattern,
      spellCheck,
    }),
  }));
});

TextField.displayName = 'TextField';

export const SearchField = React.forwardRef(function SearchField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  onSubmit,
  onClear,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'SearchField');
  return React.createElement(AriaSearchField, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value,
    defaultValue,
    onChange,
    onSubmit,
    name,
    className: classNames('core-search-field', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: React.createElement(AriaInput, { className: 'core-field-input', placeholder }),
    children: React.createElement(AriaButton, { slot: 'clear', type: 'button', className: 'core-search-clear', onPress: onClear }, 'Clear'),
  }));
});

SearchField.displayName = 'SearchField';

export const NumberField = React.forwardRef(function NumberField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  minValue,
  maxValue,
  step = 1,
  formatOptions,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'NumberField');
  return React.createElement(AriaNumberField, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value,
    defaultValue,
    onChange,
    name,
    minValue,
    maxValue,
    step,
    formatOptions,
    className: classNames('core-number-field', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: React.createElement(AriaGroup, { className: 'core-number-control' },
      React.createElement(AriaButton, { slot: 'decrement', type: 'button', className: 'core-number-stepper' }, '−'),
      React.createElement(AriaInput, { className: 'core-field-input', inputMode: 'decimal' }),
      React.createElement(AriaButton, { slot: 'increment', type: 'button', className: 'core-number-stepper' }, '+')),
  }));
});

NumberField.displayName = 'NumberField';

export const CheckboxGroup = React.forwardRef(function CheckboxGroup({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  children,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'CheckboxGroup');
  return React.createElement(AriaCheckboxGroup, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value,
    defaultValue,
    onChange,
    // RAC carries this through CheckboxGroupStateContext to every descendant
    // checkbox, including fragments and wrapper components.
    name,
    className: classNames('core-checkbox-group', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    children,
  }));
});

CheckboxGroup.displayName = 'CheckboxGroup';

export const Switch = React.forwardRef(function Switch({
  label,
  children,
  selected,
  defaultSelected = false,
  onChange,
  disabled = false,
  readOnly = false,
  description,
  errorMessage,
  required: _required,
  invalid: _invalid,
  validationBehavior: _validationBehavior,
  name,
  value,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'Switch');
  const visibleLabel = label ?? children;
  return React.createElement(AriaSwitchField, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, errorMessage }),
    isSelected: selected,
    defaultSelected,
    name,
    value,
    className: classNames('core-switch-field', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    onChange,
  }, React.createElement(AriaSwitchButton, { className: 'core-switch' }, ({ isSelected }) => React.createElement(React.Fragment, null,
    React.createElement('span', { className: 'core-switch-indicator', 'aria-hidden': 'true', 'data-selected': isSelected || undefined }),
    visibleLabel !== undefined && visibleLabel !== null
      ? React.createElement('span', { className: 'core-switch-label' }, visibleLabel)
      : null)),
  fieldDescription(description),
  fieldError(errorMessage));
});

Switch.displayName = 'Switch';

export const Form = React.forwardRef(function Form({
  children,
  className,
  validationBehavior = 'native',
  onSubmit,
  onReset,
  ...props
}, ref) {
  return React.createElement(AriaForm, {
    ...props,
    ref,
    className: classNames('core-form', className),
    validationBehavior,
    onSubmit,
    onReset,
  }, children);
});

Form.displayName = 'Form';

export const DateField = React.forwardRef(function DateField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'DateField');
  const parsedValue = React.useMemo(() => dateOrUndefined(value), [value]);
  const parsedDefaultValue = React.useMemo(() => dateOrUndefined(defaultValue), [defaultValue]);
  return React.createElement(AriaDateField, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value: parsedValue,
    defaultValue: parsedDefaultValue,
    placeholderValue: DATE_PLACEHOLDER,
    onChange: (next) => onChange?.(coreDateValue(next)),
    name,
    className: classNames('core-date-field', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({ label, description, errorMessage, input: dateInput() }));
});

DateField.displayName = 'DateField';

export const TimeField = React.forwardRef(function TimeField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'TimeField');
  React.useMemo(() => timeOrUndefined(value), [value]);
  React.useMemo(() => timeOrUndefined(defaultValue), [defaultValue]);
  const [formValue, setFormValue] = React.useState(() => value ?? defaultValue ?? '');
  const resettingRef = React.useRef(false);
  React.useEffect(() => {
    if (value !== undefined) setFormValue(value);
  }, [value]);
  const handleChange = (next) => {
    if (resettingRef.current) return;
    const nextValue = coreDateValue(next);
    setFormValue(nextValue ?? '');
    onChange?.(nextValue);
  };
  const handleReset = () => {
    if (value === undefined) setFormValue(defaultValue ?? '');
  };
  const resetInputRef = useOwningFormReset(handleReset, () => { resettingRef.current = true; }, () => { resettingRef.current = false; });
  const effectiveValue = value ?? formValue;
  const effectiveParsedValue = React.useMemo(() => timeOrUndefined(effectiveValue), [effectiveValue]);
  return React.createElement(AriaTimeField, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value: effectiveParsedValue,
    placeholderValue: TIME_PLACEHOLDER,
    onChange: handleChange,
    // RAC 1.20 does not own a form input for TimeField; Core owns this contract below.
    name: undefined,
    className: classNames('core-time-field', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: dateInput(),
    children: React.createElement(React.Fragment, null,
      formResetAnchor(resetInputRef),
      name ? React.createElement('input', { type: 'hidden', name, value: value ?? formValue, disabled, readOnly: true, 'aria-hidden': 'true' }) : null),
  }));
});

TimeField.displayName = 'TimeField';

export const DatePicker = React.forwardRef(function DatePicker({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'DatePicker');
  const parsedValue = React.useMemo(() => dateOrUndefined(value), [value]);
  const parsedDefaultValue = React.useMemo(() => dateOrUndefined(defaultValue), [defaultValue]);
  return React.createElement(AriaDatePicker, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value: parsedValue,
    defaultValue: parsedDefaultValue,
    placeholderValue: DATE_PLACEHOLDER,
    onChange: (next) => onChange?.(coreDateValue(next)),
    name,
    className: classNames('core-date-picker', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: React.createElement(AriaGroup, { className: 'core-date-control' }, dateInput(), React.createElement(AriaButton, { slot: 'button', type: 'button', className: 'core-date-trigger' }, 'Choose date')),
    children: datePopover(),
  }));
});

DatePicker.displayName = 'DatePicker';

export const DateRangePicker = React.forwardRef(function DateRangePicker({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  startName,
  endName,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'DateRangePicker');
  React.useMemo(() => (value ? { start: dateOrUndefined(value.start), end: dateOrUndefined(value.end) } : undefined), [value?.start, value?.end]);
  React.useMemo(() => (defaultValue ? { start: dateOrUndefined(defaultValue.start), end: dateOrUndefined(defaultValue.end) } : undefined), [defaultValue?.start, defaultValue?.end]);
  const [formValue, setFormValue] = React.useState(() => value ?? defaultValue);
  const resettingRef = React.useRef(false);
  React.useEffect(() => {
    if (value !== undefined) setFormValue(value);
  }, [value]);
  const handleChange = (next) => {
    if (resettingRef.current) return;
    const nextValue = next ? { start: coreDateValue(next.start), end: coreDateValue(next.end) } : undefined;
    setFormValue(nextValue);
    onChange?.(nextValue);
  };
  const handleReset = () => {
    if (value === undefined) setFormValue(defaultValue);
  };
  const resetInputRef = useOwningFormReset(handleReset, () => { resettingRef.current = true; }, () => { resettingRef.current = false; });
  const effectiveValue = value ?? formValue;
  const effectiveValueObject = React.useMemo(() => (effectiveValue ? { start: dateOrUndefined(effectiveValue.start), end: dateOrUndefined(effectiveValue.end) } : undefined), [effectiveValue?.start, effectiveValue?.end]);
  return React.createElement(AriaDateRangePicker, {
    ...props,
    ref,
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    value: effectiveValueObject,
    placeholderValue: DATE_PLACEHOLDER,
    onChange: handleChange,
    name: undefined,
    className: classNames('core-date-range-picker', className),
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: React.createElement(AriaGroup, { className: 'core-date-range-control' },
      React.createElement(AriaDateInput, { slot: 'start', className: 'core-date-input' }, (segment) => React.createElement(AriaDateSegment, { segment, className: 'core-date-segment' })),
      React.createElement('span', { className: 'core-date-range-separator', 'aria-hidden': 'true' }, '–'),
      React.createElement(AriaDateInput, { slot: 'end', className: 'core-date-input' }, (segment) => React.createElement(AriaDateSegment, { segment, className: 'core-date-segment' })),
      React.createElement(AriaButton, { slot: 'button', type: 'button', className: 'core-date-trigger' }, 'Choose dates')),
    children: React.createElement(React.Fragment, null,
      rangeDatePopover(),
      formResetAnchor(resetInputRef),
      startName ? React.createElement('input', { type: 'hidden', name: startName, value: value?.start ?? formValue?.start ?? '', disabled, readOnly: true, 'aria-hidden': 'true' }) : null,
      endName ? React.createElement('input', { type: 'hidden', name: endName, value: value?.end ?? formValue?.end ?? '', disabled, readOnly: true, 'aria-hidden': 'true' }) : null),
  }));
});

DateRangePicker.displayName = 'DateRangePicker';

function normalizeAutocompleteItems(items) {
  const usedIds = new Set();
  return (items ?? []).map((item, index) => {
    const source = typeof item === 'string'
      ? { label: item, value: item }
      : item;
    const baseId = String(source.id ?? source.value ?? index) || String(index);
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    return { ...source, id, label: source.label ?? source.value ?? id, value: source.value ?? id };
  });
}

function autocompleteNodeText(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(autocompleteNodeText).join('');
  if (React.isValidElement(value)) return autocompleteNodeText(value.props.children);
  return '';
}

function autocompleteItemText(item) {
  const fallback = String(item.value ?? item.id);
  return autocompleteNodeText(item.label) || fallback;
}

export const Autocomplete = React.forwardRef(function Autocomplete({
  label,
  description,
  errorMessage,
  items = [],
  value,
  defaultValue,
  onChange,
  onSelect,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  validationBehavior: _validationBehavior,
  name,
  placeholder,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  assertAccessibleName({ label, ariaLabel, ariaLabelledby }, 'Autocomplete');
  const normalizedItems = React.useMemo(() => normalizeAutocompleteItems(items), [items]);
  const [inputValue, setInputValue] = React.useState(() => value ?? defaultValue ?? '');
  React.useEffect(() => {
    if (value !== undefined) setInputValue(value);
  }, [value]);
  const effectiveInputValue = value ?? inputValue;
  const filteredItems = React.useMemo(() => {
    const query = effectiveInputValue.toLocaleLowerCase();
    return normalizedItems.filter((item) => autocompleteItemText(item).toLocaleLowerCase().includes(query));
  }, [effectiveInputValue, normalizedItems]);
  const [isOpen, setIsOpen] = React.useState(false);
  const filter = (textValue, inputValue) => textValue.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase());
  const handleSelect = (key) => {
    if (disabled || readOnly) return;
    const keyText = String(key);
    const item = filteredItems.find((candidate) => String(candidate.id) === keyText);
    if (item) {
      const nextValue = String(item.value);
      setInputValue(nextValue);
      onChange?.(nextValue);
    }
    onSelect?.(item);
    setIsOpen(false);
  };
  const handleInputChange = (next) => {
    if (disabled || readOnly) return;
    if (value === undefined) setInputValue(next);
    onChange?.(next);
    setIsOpen(!disabled);
  };
  return React.createElement('div', {
    ref,
    className: classNames('core-autocomplete', className),
    onBlurCapture: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    },
  }, React.createElement(AriaAutocomplete, {
    ...props,
    filter,
    disableAutoFocusFirst: false,
    inputValue: effectiveInputValue,
    onInputChange: handleInputChange,
  }, React.createElement(AriaSearchField, {
    ...validationProps({ disabled, readOnly, required, invalid, errorMessage }),
    name,
    className: 'core-autocomplete-search',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, fieldChildren({
    label,
    description,
    errorMessage,
    input: React.createElement(AriaInput, {
      className: 'core-field-input',
      placeholder,
      onFocus: () => setIsOpen(!disabled),
      onKeyDown: (event) => {
        if (event.key === 'Escape') setIsOpen(false);
        if (event.key === 'ArrowDown') setIsOpen(!disabled);
      },
    }),
  })),
  React.createElement(AriaListBox, {
    items: filteredItems,
    className: 'core-autocomplete-list',
    hidden: !isOpen || filteredItems.length === 0,
    selectionMode: readOnly ? 'none' : 'single',
    onAction: handleSelect,
  }, (item) => React.createElement(AriaListBoxItem, { id: item.id, textValue: autocompleteItemText(item), className: 'core-autocomplete-option' }, item.label))));
});

Autocomplete.displayName = 'Autocomplete';
