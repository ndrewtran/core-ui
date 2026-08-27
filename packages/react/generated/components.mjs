// @generated-from: packages/react/src/components.mjs
// @generated-content-sha256: sha256:35db023fcfc9e8f9f7c3dc11bcc078d8014be47702f537539fdd7fca62bb5264
import React from 'react';
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Checkbox as AriaCheckbox,
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  DisclosurePanel as AriaDisclosurePanel,
  Group as AriaGroup,
  Link as AriaLink,
  Label as AriaLabel,
  ProgressBar as AriaProgressBar,
  Separator as AriaSeparator,
  ToggleButton as AriaToggleButton,
  Button as AriaButton,
} from 'react-aria-components';

function classNames(base, className) {
  return [base, className].filter(Boolean).join(' ');
}

function activationEvent(event, target) {
  return {
    type: 'activate',
    pointerType: event?.pointerType || event?.nativeEvent?.pointerType || (event?.detail === 0 ? 'keyboard' : undefined),
    target,
  };
}

export const Breadcrumbs = React.forwardRef(function Breadcrumbs({
  items = [],
  className,
  'aria-label': ariaLabel,
  onNavigate,
  ...props
}, ref) {
  const collectionItems = items.map((item, index) => {
    const { current: _current, ...itemWithoutCurrent } = item;
    return { ...itemWithoutCurrent, id: item.id ?? String(index) };
  });
  const resolvedAriaLabel = ariaLabel ?? 'Breadcrumbs';
  const navigate = (key) => {
    const item = collectionItems.find((candidate) => String(candidate.id) === String(key));
    if (item) onNavigate?.(item);
  };
  return React.createElement('nav', {
    ...props,
    ref,
    className: classNames('core-breadcrumbs', className),
    'aria-label': resolvedAriaLabel,
  }, React.createElement(AriaBreadcrumbs, {
    items: collectionItems,
    className: 'core-breadcrumbs-list',
    'aria-label': resolvedAriaLabel,
    onAction: navigate,
    children: (item) => {
      const current = item.id === collectionItems.at(-1)?.id;
      return React.createElement(AriaBreadcrumb, {
        id: item.id,
        className: 'core-breadcrumbs-item',
      }, item.href && !current
        ? React.createElement(AriaLink, { href: item.href, className: 'core-breadcrumbs-link' }, item.label)
        : React.createElement('span', { className: 'core-breadcrumbs-current', 'aria-current': current ? 'page' : undefined }, item.label));
    },
  }));
});

Breadcrumbs.displayName = 'Breadcrumbs';

export const Checkbox = React.forwardRef(function Checkbox({
  children,
  checked,
  defaultChecked = false,
  disabled = false,
  indeterminate = false,
  invalid = false,
  name,
  required = false,
  value,
  className,
  onChange,
  ...props
}, ref) {
  return React.createElement(AriaCheckbox, {
    ...props,
    ref,
    className: classNames('core-checkbox', className),
    isSelected: checked,
    defaultSelected: defaultChecked,
    isDisabled: disabled,
    isIndeterminate: indeterminate,
    isInvalid: invalid,
    isRequired: required,
    name,
    value,
    onChange,
  }, ({ isSelected, isIndeterminate }) => React.createElement(React.Fragment, null,
    React.createElement('span', {
      className: 'core-checkbox-indicator',
      'aria-hidden': 'true',
      'data-selected': isSelected || undefined,
      'data-indeterminate': isIndeterminate || undefined,
    }),
    React.createElement('span', { className: 'core-checkbox-label' }, children)));
});

Checkbox.displayName = 'Checkbox';

export const DisclosureGroup = React.forwardRef(function DisclosureGroup({
  children,
  expandedIds,
  defaultExpandedIds = [],
  multiple = true,
  disabled = false,
  className,
  onExpandedChange,
  ...props
}, ref) {
  const mapKeys = (keys) => new Set((keys ?? []).map(String));
  return React.createElement(AriaDisclosureGroup, {
    ...props,
    ref,
    className: classNames('core-disclosure-group', className),
    isDisabled: disabled,
    allowsMultipleExpanded: multiple,
    expandedKeys: expandedIds === undefined ? undefined : mapKeys(expandedIds),
    defaultExpandedKeys: mapKeys(defaultExpandedIds),
    onExpandedChange: (keys) => onExpandedChange?.([...keys].map(String)),
  }, children);
});

DisclosureGroup.displayName = 'DisclosureGroup';

export const Disclosure = React.forwardRef(function Disclosure({
  title,
  children,
  id,
  expanded,
  defaultExpanded = false,
  disabled = false,
  className,
  onExpandedChange,
  ...props
}, ref) {
  return React.createElement(AriaDisclosure, {
    ...props,
    ref,
    className: classNames('core-disclosure', className),
    id,
    isExpanded: expanded,
    defaultExpanded,
    isDisabled: disabled,
    onExpandedChange,
  }, React.createElement(AriaButton, { slot: 'trigger', className: 'core-disclosure-trigger' }, title), React.createElement(AriaDisclosurePanel, { role: 'region', className: 'core-disclosure-panel' }, children));
});

Disclosure.displayName = 'Disclosure';

export const Group = React.forwardRef(function Group({
  children,
  disabled = false,
  invalid = false,
  readOnly = false,
  role = 'group',
  className,
  ...props
}, ref) {
  return React.createElement(AriaGroup, {
    ...props,
    ref,
    role,
    className: classNames('core-group', className),
    isDisabled: disabled,
    isInvalid: invalid,
    isReadOnly: readOnly,
    'aria-disabled': disabled || undefined,
    'aria-invalid': invalid || undefined,
    'aria-readonly': readOnly || undefined,
  }, children);
});

Group.displayName = 'Group';

export const Link = React.forwardRef(function Link({
  children,
  href,
  disabled = false,
  current = false,
  target,
  rel,
  className,
  onActivate,
  ...props
}, ref) {
  return React.createElement(AriaLink, {
    ...props,
    ref,
    href,
    isDisabled: disabled || !href,
    target,
    rel,
    className: classNames('core-link', className),
    'aria-current': current ? 'page' : undefined,
    onPress: (event) => onActivate?.(activationEvent(event, event.target)),
  }, children);
});

Link.displayName = 'Link';

export const Meter = React.forwardRef(function Meter({
  value = 0,
  minValue = 0,
  maxValue = 100,
  label,
  formatOptions,
  className,
  ...props
}, ref) {
  const externalLabel = props['aria-label'];
  const externalLabelledby = props['aria-labelledby'];
  const labelId = React.useId();
  const boundedValue = Math.min(maxValue, Math.max(minValue, value));
  const percentage = maxValue === minValue ? 0 : ((boundedValue - minValue) / (maxValue - minValue)) * 100;
  const formatter = new Intl.NumberFormat(undefined, formatOptions ?? { style: 'percent' });
  const valueText = formatter.format(!formatOptions || formatOptions.style === 'percent' ? percentage / 100 : boundedValue);
  return React.createElement('div', {
    ...props,
    ref,
    role: 'meter',
    className: classNames('core-meter', className),
    'aria-label': externalLabel,
    'aria-labelledby': externalLabelledby ?? (externalLabel ? undefined : labelId),
    'aria-valuenow': boundedValue,
    'aria-valuemin': minValue,
    'aria-valuemax': maxValue,
    'aria-valuetext': valueText,
  }, !externalLabel && !externalLabelledby
    ? React.createElement(AriaLabel, { id: labelId, elementType: 'span', className: 'core-value-label' }, label)
    : null,
  React.createElement('div', { className: 'core-meter-track' }, React.createElement('div', { className: 'core-meter-fill', style: { inlineSize: `${percentage}%` } })),
  );
});

Meter.displayName = 'Meter';

export const ProgressBar = React.forwardRef(function ProgressBar({
  value,
  minValue = 0,
  maxValue = 100,
  label,
  className,
  ...props
}, ref) {
  return React.createElement(AriaProgressBar, {
    ...props,
    ref,
    value: value ?? 0,
    minValue,
    maxValue,
    isIndeterminate: value === undefined,
    'data-indeterminate': value === undefined || undefined,
    className: classNames('core-progress-bar', className),
    children: ({ percentage }) => React.createElement(React.Fragment, null,
      React.createElement(AriaLabel, { className: 'core-value-label' }, label),
      React.createElement('div', { className: 'core-progress-bar-track' }, React.createElement('div', { className: 'core-progress-bar-fill', style: percentage === undefined ? undefined : { inlineSize: `${percentage}%` } }))),
  });
});

ProgressBar.displayName = 'ProgressBar';

export const Separator = React.forwardRef(function Separator({
  orientation = 'horizontal',
  className,
  ...props
}, ref) {
  return React.createElement(AriaSeparator, {
    ...props,
    ref,
    orientation,
    className: classNames(`core-separator core-separator-${orientation}`, className),
  });
});

Separator.displayName = 'Separator';

export const ToggleButton = React.forwardRef(function ToggleButton({
  children,
  selected,
  defaultSelected = false,
  disabled = false,
  className,
  onChange,
  onActivate,
  ...props
}, ref) {
  return React.createElement(AriaToggleButton, {
    ...props,
    ref,
    isSelected: selected,
    defaultSelected,
    isDisabled: disabled,
    className: classNames('core-toggle-button', className),
    onChange,
    onPress: (event) => onActivate?.(activationEvent(event, event.target)),
  }, children);
});

ToggleButton.displayName = 'ToggleButton';

export {
  Autocomplete,
  CheckboxGroup,
  DateField,
  DatePicker,
  DateRangePicker,
  Form,
  NumberField,
  SearchField,
  Switch,
  TextField,
  TimeField,
} from './fields.mjs';
