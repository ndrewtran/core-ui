// @generated-from: packages/react/src/generate.mjs
// @generated-content-sha256: sha256:50f7cae7ca75e3c149ad804828578b7f0c2b605d93706d75dd2164dd09b62950
import type * as React from 'react';

export type ButtonPointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual' | undefined;
export type ComponentPointerType = ButtonPointerType;
export interface ButtonActivationEvent {
  readonly type: 'activate';
  readonly pointerType: ButtonPointerType;
  readonly target: HTMLButtonElement;
}
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'disabled' | 'onClick' | 'style'> {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pending?: boolean;
  style?: React.CSSProperties;
  onActivate?: (event: ButtonActivationEvent) => void;
}
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export interface BreadcrumbItem { id?: string; label: React.ReactNode; href?: string; }
export interface BreadcrumbsProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'aria-label'> { items?: BreadcrumbItem[]; className?: string; 'aria-label': string; onNavigate?: (item: BreadcrumbItem) => void; }
export declare const Breadcrumbs: React.ForwardRefExoticComponent<BreadcrumbsProps & React.RefAttributes<HTMLElement>>;
export interface CheckboxProps extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children' | 'className' | 'onChange'> { children?: React.ReactNode; className?: string; checked?: boolean; defaultChecked?: boolean; disabled?: boolean; indeterminate?: boolean; invalid?: boolean; name?: string; required?: boolean; value?: string; onChange?: (checked: boolean) => void; }
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLLabelElement>>;
export interface DisclosureProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'id' | 'title'> { title: React.ReactNode; children?: React.ReactNode; id?: string; expanded?: boolean; defaultExpanded?: boolean; disabled?: boolean; className?: string; onExpandedChange?: (expanded: boolean) => void; }
export declare const Disclosure: React.ForwardRefExoticComponent<DisclosureProps & React.RefAttributes<HTMLDivElement>>;
export interface DisclosureGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'> { children?: React.ReactNode; expandedIds?: string[]; defaultExpandedIds?: string[]; multiple?: boolean; disabled?: boolean; className?: string; onExpandedChange?: (expandedIds: string[]) => void; }
export declare const DisclosureGroup: React.ForwardRefExoticComponent<DisclosureGroupProps & React.RefAttributes<HTMLDivElement>>;
export interface GroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'role'> { children?: React.ReactNode; className?: string; disabled?: boolean; invalid?: boolean; readOnly?: boolean; role?: 'group' | 'region' | 'presentation'; }
export declare const Group: React.ForwardRefExoticComponent<GroupProps & React.RefAttributes<HTMLDivElement>>;
export interface LinkActivationEvent { readonly type: 'activate'; readonly pointerType: ComponentPointerType; readonly target: HTMLAnchorElement; }
export interface LinkProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'onClick'> { children?: React.ReactNode; className?: string; href?: string; disabled?: boolean; current?: boolean; target?: string; rel?: string; onActivate?: (event: LinkActivationEvent) => void; }
export declare const Link: React.ForwardRefExoticComponent<LinkProps & React.RefAttributes<HTMLElement>>;
export interface MeterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'> { label: React.ReactNode; value?: number; minValue?: number; maxValue?: number; formatOptions?: Intl.NumberFormatOptions; className?: string; }
export declare const Meter: React.ForwardRefExoticComponent<MeterProps & React.RefAttributes<HTMLDivElement>>;
export interface ProgressBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'> { label: React.ReactNode; value?: number; minValue?: number; maxValue?: number; className?: string; }
export declare const ProgressBar: React.ForwardRefExoticComponent<ProgressBarProps & React.RefAttributes<HTMLDivElement>>;
export interface SeparatorProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'> { orientation?: 'horizontal' | 'vertical'; className?: string; }
export declare const Separator: React.ForwardRefExoticComponent<SeparatorProps & React.RefAttributes<HTMLElement>>;
export interface ToggleButtonActivationEvent { readonly type: 'activate'; readonly pointerType: ComponentPointerType; readonly target: HTMLButtonElement; }
export interface ToggleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'onChange' | 'onClick'> { children?: React.ReactNode; className?: string; selected?: boolean; defaultSelected?: boolean; disabled?: boolean; onChange?: (selected: boolean) => void; onActivate?: (event: ToggleButtonActivationEvent) => void; }
export declare const ToggleButton: React.ForwardRefExoticComponent<ToggleButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const reactCompatibility: Readonly<Record<string, unknown>>;

export type CoreDateValue = string;
export interface CoreDateRange { start: CoreDateValue; end: CoreDateValue; }
export interface FieldValidationProps { description?: React.ReactNode; errorMessage?: React.ReactNode; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; className?: string; }
export type CoreAccessibleName =
  | { label: Exclude<React.ReactNode, null | undefined | boolean>; 'aria-label'?: never; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label': string; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label'?: never; 'aria-labelledby': string };
export type CoreAriaAccessibleName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-label'?: never; 'aria-labelledby': string };
export type CoreAriaLabel = { 'aria-label': string };
export type NamedFieldProps = FieldValidationProps & CoreAccessibleName;
export type TextFieldProps = NamedFieldProps & { value?: string; defaultValue?: string; onChange?: (value: string) => void; name?: string; placeholder?: string; type?: 'text' | 'email' | 'password' | 'url' | 'tel'; };
export declare const TextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<HTMLDivElement>>;
export type SearchFieldProps = NamedFieldProps & { value?: string; defaultValue?: string; onChange?: (value: string) => void; onSubmit?: (value: string) => void; onClear?: () => void; name?: string; placeholder?: string; };
export declare const SearchField: React.ForwardRefExoticComponent<SearchFieldProps & React.RefAttributes<HTMLDivElement>>;
export type NumberFieldProps = NamedFieldProps & { value?: number; defaultValue?: number; onChange?: (value: number) => void; name?: string; minValue?: number; maxValue?: number; step?: number; formatOptions?: Intl.NumberFormatOptions; };
export declare const NumberField: React.ForwardRefExoticComponent<NumberFieldProps & React.RefAttributes<HTMLDivElement>>;
export type CheckboxGroupProps = NamedFieldProps & { value?: string[]; defaultValue?: string[]; onChange?: (value: string[]) => void; name?: string; children?: React.ReactNode; };
export declare const CheckboxGroup: React.ForwardRefExoticComponent<CheckboxGroupProps & React.RefAttributes<HTMLDivElement>>;
export type SwitchProps = CoreAccessibleName & { description?: React.ReactNode; errorMessage?: React.ReactNode; disabled?: boolean; readOnly?: boolean; className?: string; children?: React.ReactNode; selected?: boolean; defaultSelected?: boolean; onChange?: (selected: boolean) => void; name?: string; value?: string; };
export declare const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLDivElement>>;
export interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'children' | 'className' | 'onSubmit' | 'onReset'> { children?: React.ReactNode; className?: string; validationBehavior?: 'aria' | 'native'; onSubmit?: React.FormEventHandler<HTMLFormElement>; onReset?: React.FormEventHandler<HTMLFormElement>; }
export declare const Form: React.ForwardRefExoticComponent<FormProps & React.RefAttributes<HTMLFormElement>>;
export type DateFieldProps = NamedFieldProps & { value?: CoreDateValue; defaultValue?: CoreDateValue; onChange?: (value?: CoreDateValue) => void; name?: string; };
export declare const DateField: React.ForwardRefExoticComponent<DateFieldProps & React.RefAttributes<HTMLDivElement>>;
export type TimeFieldProps = NamedFieldProps & { value?: string; defaultValue?: string; onChange?: (value?: string) => void; name?: string; };
export declare const TimeField: React.ForwardRefExoticComponent<TimeFieldProps & React.RefAttributes<HTMLDivElement>>;
export type DatePickerProps = DateFieldProps & { onOpenChange?: (isOpen: boolean) => void; };
export declare const DatePicker: React.ForwardRefExoticComponent<DatePickerProps & React.RefAttributes<HTMLDivElement>>;
export type DateRangePickerProps = NamedFieldProps & { value?: CoreDateRange; defaultValue?: CoreDateRange; onChange?: (value?: CoreDateRange) => void; startName?: string; endName?: string; onOpenChange?: (isOpen: boolean) => void; };
export declare const DateRangePicker: React.ForwardRefExoticComponent<DateRangePickerProps & React.RefAttributes<HTMLDivElement>>;
export interface AutocompleteItem { id?: string; label?: React.ReactNode; value?: string; }
export interface AutocompleteSelectionItem { id: string; label: React.ReactNode; value: string; }
export type AutocompleteProps = NamedFieldProps & { items?: Array<AutocompleteItem | string>; value?: string; defaultValue?: string; onChange?: (value: string) => void; onSelect?: (item?: AutocompleteSelectionItem) => void; name?: string; placeholder?: string; };
export declare const Autocomplete: React.ForwardRefExoticComponent<AutocompleteProps & React.RefAttributes<HTMLDivElement>>;

export type CoreColorValue = string;
export interface CoreCollectionItem { id?: string; key?: string; label?: React.ReactNode; value?: string; textValue?: string; disabled?: boolean; [key: string]: unknown; }
export type CoreSelection = string[] | 'all';
export type CoreItems = Array<CoreCollectionItem | string>;
export type CalendarProps = CoreAccessibleName & { value?: CoreDateValue; defaultValue?: CoreDateValue; focusedValue?: CoreDateValue; minValue?: CoreDateValue; maxValue?: CoreDateValue; onChange?: (value?: CoreDateValue) => void; onFocusChange?: (value?: CoreDateValue) => void; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; className?: string; };
export declare const Calendar: React.ForwardRefExoticComponent<CalendarProps & React.RefAttributes<HTMLDivElement>>;
export type RangeCalendarProps = CoreAccessibleName & { value?: CoreDateRange; defaultValue?: CoreDateRange; minValue?: CoreDateValue; maxValue?: CoreDateValue; onChange?: (value?: CoreDateRange) => void; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; className?: string; };
export declare const RangeCalendar: React.ForwardRefExoticComponent<RangeCalendarProps & React.RefAttributes<HTMLDivElement>>;
export type ColorAreaProps = CoreAccessibleName & { value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; readOnly?: boolean; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorArea: React.ForwardRefExoticComponent<ColorAreaProps & React.RefAttributes<HTMLDivElement>>;
export type ColorFieldProps = NamedFieldProps & { value?: CoreColorValue; defaultValue?: CoreColorValue; onChange?: (value: CoreColorValue) => void; name?: string; };
export declare const ColorField: React.ForwardRefExoticComponent<ColorFieldProps & React.RefAttributes<HTMLDivElement>>;
export type ColorPickerProps = { value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; readOnly?: boolean; onChange?: (value: CoreColorValue) => void; children?: React.ReactNode; className?: string; };
export declare const ColorPicker: React.ForwardRefExoticComponent<ColorPickerProps & React.RefAttributes<HTMLDivElement>>;
export type ColorSliderProps = CoreAccessibleName & { value?: CoreColorValue; defaultValue?: CoreColorValue; channel?: string; colorSpace?: string; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorSlider: React.ForwardRefExoticComponent<ColorSliderProps & React.RefAttributes<HTMLDivElement>>;
export type ColorSwatchProps = { color: CoreColorValue; disabled?: boolean; className?: string; };
export declare const ColorSwatch: React.ForwardRefExoticComponent<ColorSwatchProps & React.RefAttributes<HTMLDivElement>>;
export type ColorSwatchPickerProps = CoreAriaAccessibleName & { items?: CoreItems; value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorSwatchPicker: React.ForwardRefExoticComponent<ColorSwatchPickerProps & React.RefAttributes<HTMLDivElement>>;
export type ColorWheelProps = CoreAriaAccessibleName & { value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorWheel: React.ForwardRefExoticComponent<ColorWheelProps & React.RefAttributes<HTMLDivElement>>;
export type CollectionProps = CoreAriaAccessibleName & { items?: CoreItems; selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; disabled?: boolean; selectionMode?: 'none' | 'single' | 'multiple'; onSelectionChange?: (ids: CoreSelection) => void; onAction?: (item?: CoreCollectionItem) => void; className?: string; };
export type GridListProps = CollectionProps;
export declare const GridList: React.ForwardRefExoticComponent<GridListProps & React.RefAttributes<HTMLDivElement>>;
export type ListBoxProps = CollectionProps;
export declare const ListBox: React.ForwardRefExoticComponent<ListBoxProps & React.RefAttributes<HTMLDivElement>>;
export type MenuProps = CoreAriaAccessibleName & { items?: CoreItems; disabled?: boolean; shouldCloseOnSelect?: boolean; onAction?: (item?: CoreCollectionItem) => void; onSelect?: (item?: CoreCollectionItem) => void; className?: string; };
export declare const Menu: React.ForwardRefExoticComponent<MenuProps & React.RefAttributes<HTMLDivElement>>;
export type RadioOption = { id?: string; value: string; label?: React.ReactNode; disabled?: boolean; };
export type RadioGroupProps = CoreAccessibleName & { options?: RadioOption[]; value?: string; defaultValue?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; onChange?: (value: string) => void; className?: string; };
export declare const RadioGroup: React.ForwardRefExoticComponent<RadioGroupProps & React.RefAttributes<HTMLDivElement>>;
export type SelectProps = NamedFieldProps & { items?: CoreItems; value?: string; defaultValue?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; name?: string; placeholder?: string; onChange?: (value?: string) => void; };
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLDivElement>>;
export type ComboBoxProps = NamedFieldProps & { items?: CoreItems; value?: string; defaultValue?: string; selectedId?: string; defaultSelectedId?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; name?: string; placeholder?: string; onChange?: (value: string) => void; onSelect?: (item?: CoreCollectionItem) => void; };
export declare const ComboBox: React.ForwardRefExoticComponent<ComboBoxProps & React.RefAttributes<HTMLDivElement>>;
export type SliderProps = CoreAccessibleName & { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onChange?: (value: number) => void; className?: string; };
export declare const Slider: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<HTMLDivElement>>;
export interface CoreTableColumn extends CoreCollectionItem { isRowHeader?: boolean; sortable?: boolean; }
export interface CoreTableRow extends CoreCollectionItem { values?: Record<string, React.ReactNode>; }
export type TableProps = CoreAriaLabel & { columns?: CoreTableColumn[]; rows?: CoreTableRow[]; selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; disabled?: boolean; selectionMode?: 'none' | 'single' | 'multiple'; onSelectionChange?: (ids: CoreSelection) => void; onRowAction?: (row?: CoreTableRow) => void; className?: string; };
export declare const Table: React.ForwardRefExoticComponent<TableProps & React.RefAttributes<HTMLTableElement>>;
export type TabsProps = CoreAriaAccessibleName & { items?: CoreItems; value?: string; defaultValue?: string; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onChange?: (value: string) => void; className?: string; };
export declare const Tabs: React.ForwardRefExoticComponent<TabsProps & React.RefAttributes<HTMLDivElement>>;
export type TagGroupProps = CoreAccessibleName & { items?: CoreItems; disabled?: boolean; onRemove?: (items: CoreCollectionItem[]) => void; onAction?: (item?: CoreCollectionItem) => void; className?: string; };
export declare const TagGroup: React.ForwardRefExoticComponent<TagGroupProps & React.RefAttributes<HTMLDivElement>>;
export type ToggleButtonGroupProps = CoreAriaAccessibleName & { selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onSelectionChange?: (ids: CoreSelection) => void; children?: React.ReactNode; className?: string; };
export declare const ToggleButtonGroup: React.ForwardRefExoticComponent<ToggleButtonGroupProps & React.RefAttributes<HTMLDivElement>>;
export type TokenFieldProps = CoreAccessibleName & { value?: string[]; defaultValue?: string[]; disabled?: boolean; readOnly?: boolean; name?: string; placeholder?: string; onChange?: (value: string[]) => void; className?: string; };
export declare const TokenField: React.ForwardRefExoticComponent<TokenFieldProps & React.RefAttributes<HTMLDivElement>>;
export type ToolbarProps = CoreAriaAccessibleName & { orientation?: 'horizontal' | 'vertical'; disabled?: boolean; children?: React.ReactNode; className?: string; };
export declare const Toolbar: React.ForwardRefExoticComponent<ToolbarProps & React.RefAttributes<HTMLDivElement>>;
export interface CoreTreeItem extends CoreCollectionItem { children?: CoreTreeItem[]; items?: CoreTreeItem[]; }
export type TreeProps = CoreAriaAccessibleName & { items?: CoreTreeItem[]; selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; expandedIds?: CoreSelection; defaultExpandedIds?: CoreSelection; disabled?: boolean; selectionMode?: 'none' | 'single' | 'multiple'; onSelectionChange?: (ids: CoreSelection) => void; onExpandedChange?: (ids: CoreSelection) => void; onAction?: (item?: CoreTreeItem) => void; className?: string; };
export declare const Tree: React.ForwardRefExoticComponent<TreeProps & React.RefAttributes<HTMLDivElement>>;
export type VirtualizerProps = CoreAriaLabel & { items?: CoreItems; height?: number; itemHeight?: number; overscan?: number; disabled?: boolean; onScroll?: React.UIEventHandler<HTMLDivElement>; className?: string; style?: React.CSSProperties; };
export declare const Virtualizer: React.ForwardRefExoticComponent<VirtualizerProps & React.RefAttributes<HTMLDivElement>>;

export type CoreDropOperation = 'copy' | 'link' | 'move' | 'cancel';
export interface CoreFileDropItem { readonly kind: 'file'; readonly type: string; readonly name: string; readonly getFile: () => Promise<File>; readonly getText: () => Promise<string>; }
export interface CoreDirectoryDropItem { readonly kind: 'directory'; readonly name: string; readonly getEntries: () => AsyncIterable<CoreDropItem>; }
export interface CoreTextDropItem { readonly kind: 'text'; readonly types: ReadonlySet<string>; readonly getText: (type: string) => Promise<string>; }
export type CoreDropItem = CoreFileDropItem | CoreDirectoryDropItem | CoreTextDropItem;
export interface CoreDropEvent { readonly type: 'drop'; readonly x: number; readonly y: number; readonly dropOperation: CoreDropOperation; readonly items: CoreDropItem[]; }
export interface CoreDropActivateEvent { readonly type: 'activate'; readonly x: number; readonly y: number; }
export interface DropZoneProps { children?: React.ReactNode; disabled?: boolean; className?: string; 'aria-label'?: string; 'aria-labelledby'?: string; onDrop?: (event: CoreDropEvent) => void; onActivate?: (event: CoreDropActivateEvent) => void; }
export declare const DropZone: React.ForwardRefExoticComponent<DropZoneProps & React.RefAttributes<HTMLDivElement>>;
export interface FileTriggerProps { children?: React.ReactNode; acceptedFileTypes?: readonly string[]; allowsMultiple?: boolean; acceptDirectory?: boolean; defaultCamera?: 'user' | 'environment'; disabled?: boolean; className?: string; onSelect?: (files: File[]) => void; }
export declare const FileTrigger: React.ForwardRefExoticComponent<FileTriggerProps & React.RefAttributes<HTMLInputElement>>;
export type OverlayAccessibleName = { 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-label'?: never; 'aria-labelledby': string };
export type DialogProps = { children?: React.ReactNode; open?: boolean; defaultOpen?: boolean; dismissable?: boolean; trigger?: React.ReactElement; onOpenChange?: (open: boolean) => void; className?: string; } & ({ title: Exclude<React.ReactNode, null | undefined | boolean>; 'aria-label'?: string; 'aria-labelledby'?: string } | ({ title?: never } & OverlayAccessibleName));
export declare const Dialog: React.ForwardRefExoticComponent<DialogProps & React.RefAttributes<HTMLElement>>;
export type PopoverProps = { children: React.ReactNode; trigger: React.ReactElement; open?: boolean; defaultOpen?: boolean; dismissable?: boolean; placement?: 'top' | 'bottom' | 'start' | 'end'; onOpenChange?: (open: boolean) => void; className?: string; } & OverlayAccessibleName;
export declare const Popover: React.ForwardRefExoticComponent<PopoverProps & React.RefAttributes<HTMLDivElement>>;
export type PreviewTriggerProps = { children: React.ReactNode; trigger: React.ReactElement; delay?: number; closeDelay?: number; open?: boolean; defaultOpen?: boolean; placement?: 'top' | 'bottom' | 'start' | 'end'; onOpenChange?: (open: boolean) => void; className?: string; } & OverlayAccessibleName;
export declare const PreviewTrigger: React.ForwardRefExoticComponent<PreviewTriggerProps & React.RefAttributes<HTMLDivElement>>;
export interface ToastProps { message: Exclude<React.ReactNode, null | undefined | boolean>; title?: React.ReactNode; variant?: 'neutral' | 'success' | 'warning' | 'danger'; duration?: number; onDismiss?: () => void; className?: string; }
export declare const Toast: React.FC<ToastProps>;
export interface ToastOptions { title?: React.ReactNode; variant?: 'neutral' | 'success' | 'warning' | 'danger'; duration?: number; onDismiss?: () => void; className?: string; }
export interface ToastManager { add: (message: Exclude<React.ReactNode, null | undefined | boolean>, options?: ToastOptions) => string; remove: (key: string) => void; }
export interface ToastProviderProps { children?: React.ReactNode; maxVisible?: number; placement?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'; className?: string; }
export declare const ToastProvider: React.FC<ToastProviderProps>;
export declare function useToast(): ToastManager;
export type TooltipProps = { content: Exclude<React.ReactNode, null | undefined | boolean>; trigger: React.ReactElement; delay?: number; closeDelay?: number; placement?: 'top' | 'bottom' | 'start' | 'end'; open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; className?: string; };
export declare const Tooltip: React.ForwardRefExoticComponent<TooltipProps & React.RefAttributes<HTMLDivElement>>;
