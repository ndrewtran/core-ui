<!-- @generated-from: packages/react/src/generate.mjs -->
<!-- @generated-content-sha256: sha256:e40e345694d8d4bc1b60c72715f3a71c0ba1089c906d550e66dd2af8a29a71d4 -->
# @core-ui/react

R1.5 React breadth closure for the standalone Core UI renderer.

- The 53 Core-owned family exports are listed below for the `web.react` binding.
- React Aria Components 1.20.0 is an internal replaceable substrate.
- Core owns the public APIs, tokens, selectors, styling, accessibility behavior, lifecycle, and prop names.
- Tale UI is a pinned styling donor; generated styling results are Core-owned and Tale UI is not a dependency.

## R1 exit publication candidate

The exact R1 exit candidate is `@core-ui/react@0.1.0-rc.1`, for the `next`
dist-tag on the npm registry. The candidate contains only the standalone
`web.react` renderer and its two internal runtime dependencies. All 53
Core-owned component exports remain experimental; no stable, secondary-renderer,
or cross-platform support claim is made. Publication, dist-tag mutation, and
post-publication verification are separate authorized operations.

## Local tarball usage

Install the versioned local candidate from the package directory:

```sh
pnpm add ./core-ui-react-0.1.0-alpha.0.tgz
```

Import the generated Core styles once, then use the React exports:

```tsx
import '@core-ui/react/styles.css';
import { Button } from '@core-ui/react';

export function Example() {
  return <Button onActivate={() => {}}>Save</Button>;
}
```

The renderer owns the Core selectors, tokens, accessibility behavior, lifecycle, and public prop names. React Aria Components is an internal implementation substrate; this package does not transfer its APIs or styling boundary.

Supporting runtime exports: `ToastProvider` and `useToast` are available alongside `Toast` for managed notifications.

| Export | Lifecycle | Selector | Public props |
| --- | --- | --- | --- |
| Button | experimental | .core-button | disabled, pending |
| Breadcrumbs | experimental | .core-breadcrumbs | items, aria-label |
| Checkbox | experimental | .core-checkbox | checked, defaultChecked, disabled, indeterminate, name, required, value, invalid |
| Disclosure | experimental | .core-disclosure | expanded, defaultExpanded, disabled, id |
| DisclosureGroup | experimental | .core-disclosure-group | expandedIds, defaultExpandedIds, multiple, disabled |
| Group | experimental | .core-group | disabled, invalid, readOnly, role, aria-label |
| Link | experimental | .core-link | href, disabled, current, target, rel |
| Meter | experimental | .core-meter | value, minValue, maxValue, label, formatOptions |
| ProgressBar | experimental | .core-progress-bar | value, minValue, maxValue, label |
| Separator | experimental | .core-separator | orientation |
| ToggleButton | experimental | .core-toggle-button | selected, defaultSelected, disabled |
| Autocomplete | experimental | .core-autocomplete | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name, items, placeholder |
| CheckboxGroup | experimental | .core-checkbox-group | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name |
| DateField | experimental | .core-date-field | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name |
| DatePicker | experimental | .core-date-picker | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name |
| DateRangePicker | experimental | .core-date-range-picker | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, startName, endName |
| Form | experimental | .core-form | validationBehavior, method, action, onSubmit, onReset |
| NumberField | experimental | .core-number-field | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, minValue, maxValue, step, name, formatOptions |
| SearchField | experimental | .core-search-field | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name, placeholder |
| Switch | experimental | .core-switch | label, description, errorMessage, aria-label, aria-labelledby, selected, defaultSelected, disabled, readOnly, name, value |
| TextField | experimental | .core-text-field | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name, placeholder, type |
| TimeField | experimental | .core-time-field | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name |
| Calendar | experimental | .core-calendar | label, aria-label, aria-labelledby, value, defaultValue, focusedValue, minValue, maxValue, disabled, readOnly, required, invalid |
| ColorArea | experimental | .core-color-area | label, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly |
| ColorField | experimental | .core-color-field | label, description, errorMessage, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, required, invalid, name |
| ColorPicker | experimental | .core-color-picker | value, defaultValue, disabled, readOnly |
| ColorSlider | experimental | .core-color-slider | label, aria-label, aria-labelledby, value, defaultValue, channel, colorSpace, disabled, orientation |
| ColorSwatch | experimental | .core-color-swatch | color, disabled |
| ColorSwatchPicker | experimental | .core-color-swatch-picker | aria-label, aria-labelledby, items, value, defaultValue, disabled |
| ColorWheel | experimental | .core-color-wheel | aria-label, aria-labelledby, value, defaultValue, disabled |
| ComboBox | experimental | .core-combo-box | label, description, errorMessage, aria-label, aria-labelledby, items, value, defaultValue, selectedId, defaultSelectedId, disabled, readOnly, required, invalid, name, placeholder |
| GridList | experimental | .core-grid-list | aria-label, aria-labelledby, items, selectedIds, defaultSelectedIds, disabled, selectionMode |
| ListBox | experimental | .core-list-box | aria-label, aria-labelledby, items, selectedIds, defaultSelectedIds, disabled, selectionMode |
| Menu | experimental | .core-menu | aria-label, aria-labelledby, items, disabled, shouldCloseOnSelect |
| RadioGroup | experimental | .core-radio-group | label, aria-label, aria-labelledby, options, value, defaultValue, disabled, readOnly, required, invalid |
| RangeCalendar | experimental | .core-range-calendar | label, aria-label, aria-labelledby, value, defaultValue, minValue, maxValue, disabled, readOnly, required, invalid |
| Select | experimental | .core-select | label, description, errorMessage, aria-label, aria-labelledby, items, value, defaultValue, disabled, readOnly, required, invalid, name, placeholder |
| Slider | experimental | .core-slider | label, aria-label, aria-labelledby, value, defaultValue, min, max, step, disabled, orientation |
| Table | experimental | .core-table | aria-label, columns, rows, selectedIds, defaultSelectedIds, disabled, selectionMode |
| Tabs | experimental | .core-tabs | aria-label, aria-labelledby, items, value, defaultValue, disabled, orientation |
| TagGroup | experimental | .core-tag-group | label, aria-label, aria-labelledby, items, disabled |
| ToggleButtonGroup | experimental | .core-toggle-button-group | aria-label, aria-labelledby, selectedIds, defaultSelectedIds, disabled, orientation |
| TokenField | experimental | .core-token-field | label, aria-label, aria-labelledby, value, defaultValue, disabled, readOnly, name, placeholder |
| Toolbar | experimental | .core-toolbar | aria-label, aria-labelledby, orientation, disabled |
| Tree | experimental | .core-tree | aria-label, aria-labelledby, items, selectedIds, defaultSelectedIds, expandedIds, defaultExpandedIds, disabled, selectionMode |
| Virtualizer | experimental | .core-virtualizer | aria-label, items, height, itemHeight, overscan, disabled |
| DropZone | experimental | .core-drop-zone | children, disabled, onDrop, onActivate, className, aria-label, aria-labelledby |
| FileTrigger | experimental | .core-file-trigger | children, acceptedFileTypes, allowsMultiple, acceptDirectory, defaultCamera, disabled, onSelect, className |
| Dialog | experimental | .core-dialog | children, title, open, defaultOpen, dismissable, trigger, onOpenChange, className, aria-label, aria-labelledby |
| Popover | experimental | .core-popover | children, trigger, open, defaultOpen, dismissable, placement, onOpenChange, className, aria-label, aria-labelledby |
| PreviewTrigger | experimental | .core-preview-trigger | children, trigger, delay, closeDelay, open, defaultOpen, placement, onOpenChange, className, aria-label, aria-labelledby |
| Toast | experimental | .core-toast | message, title, variant, duration, onDismiss, className |
| Tooltip | experimental | .core-tooltip | content, trigger, delay, closeDelay, placement, open, defaultOpen, onOpenChange, className |
