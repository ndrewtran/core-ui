import {
  Autocomplete,
  type AutocompleteSelectionItem,
  Breadcrumbs,
  Button,
  Calendar,
  Checkbox,
  CheckboxGroup,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorWheel,
  ComboBox,
  DateField,
  DatePicker,
  DateRangePicker,
  Disclosure,
  DisclosureGroup,
  Dialog,
  DropZone,
  FileTrigger,
  Form,
  GridList,
  Group,
  ListBox,
  Link,
  Meter,
  Menu,
  NumberField,
  ProgressBar,
  Popover,
  PreviewTrigger,
  RadioGroup,
  RangeCalendar,
  SearchField,
  Select,
  Separator,
  Slider,
  Switch,
  Table,
  Tabs,
  TagGroup,
  TextField,
  TimeField,
  Toast,
  ToastProvider,
  ToggleButton,
  ToggleButtonGroup,
  TokenField,
  Toolbar,
  Tree,
  Tooltip,
  Virtualizer,
  type CoreDropEvent,
  reactCompatibility,
  useToast,
} from '@core-ui/react';

const schema: Readonly<Record<string, unknown>> = reactCompatibility;
void schema;

const button = (
  <Button
    aria-label="Save"
    disabled={false}
    pending
    onActivate={(event) => {
      const activationType: 'activate' = event.type;
      const pointerType = event.pointerType;
      event.target.focus();
      void activationType;
      void pointerType;
    }}
  >
    Save
  </Button>
);
void button;

// React Aria names remain internal implementation details of Core Button.
// @ts-expect-error Core owns `disabled`, not the upstream `isDisabled` prop.
const upstreamDisabled = <Button isDisabled>Save</Button>;
void upstreamDisabled;
// @ts-expect-error Core owns `pending`, not the upstream `isPending` prop.
const upstreamPending = <Button isPending>Save</Button>;
void upstreamPending;
// @ts-expect-error Button is an action control, not a navigation element.
const navigation = <Button href="/settings">Settings</Button>;
void navigation;

const componentSlice = (
  <>
    <Breadcrumbs aria-label="Breadcrumb" items={[{ label: 'Home', href: '/' }, { label: 'Docs' }]} />
    <Checkbox defaultChecked onChange={(checked) => { const value: boolean = checked; void value; }}>Accept</Checkbox>
    <Disclosure title="Details" defaultExpanded onExpandedChange={(expanded) => { const value: boolean = expanded; void value; }}>Content</Disclosure>
    <DisclosureGroup defaultExpandedIds={['one']} multiple={false} onExpandedChange={(ids) => { const value: string[] = ids; void value; }}>
      <Disclosure id="one" title="One">First</Disclosure>
    </DisclosureGroup>
    <Group aria-label="Actions"><button type="button">Save</button></Group>
    <Link href="/settings" onActivate={(event) => { const target: HTMLAnchorElement = event.target; target.focus(); }}>Settings</Link>
    <Meter label="Storage" value={72} />
    <ProgressBar label="Upload" value={64} />
    <Separator orientation="vertical" />
    <ToggleButton defaultSelected onChange={(selected) => { const value: boolean = selected; void value; }}>Bold</ToggleButton>
  </>
);
void componentSlice;

const fields = (
  <Form onSubmit={(event) => event.preventDefault()}>
    <TextField label="Name" value="Andrew" onChange={(value) => { const text: string = value; void text; }} />
    <SearchField label="Search" defaultValue="Core" onSubmit={(value) => { const text: string = value; void text; }} />
    <NumberField label="Quantity" defaultValue={2} onChange={(value) => { const amount: number = value; void amount; }} />
    <CheckboxGroup label="Alerts" defaultValue={['email']}><Checkbox value="email">Email</Checkbox></CheckboxGroup>
    <Switch label="Enabled" selected onChange={(selected) => { const value: boolean = selected; void value; }} />
    <DateField label="Birthday" value="2026-08-26" onChange={(value) => { const date: string | undefined = value; void date; }} />
    <DatePicker label="Due" defaultValue="2026-08-26" />
    <DateRangePicker label="Trip" startName="tripStart" endName="tripEnd" defaultValue={{ start: '2026-08-26', end: '2026-09-01' }} />
    <TimeField label="Start" defaultValue="09:30" />
    <Autocomplete label="City" items={['Melbourne', { label: 'Sydney' }, {}]} onSelect={(item) => {
      if (!item) return;
      const normalized: AutocompleteSelectionItem = item;
      const id: string = normalized.id;
      const value: string = normalized.value;
      void normalized.label;
      void id;
      void value;
    }} />
    <Autocomplete label="Rich city" items={[{ id: 'mel', label: <strong>Melbourne</strong>, value: 'Melbourne' }]} />
  </Form>
);
void fields;

// Core's public field contracts do not expose RAC prop names or temporal objects.
// @ts-expect-error Core owns `disabled`, not the upstream `isDisabled` prop.
const upstreamFieldProp = <TextField label="Name" isDisabled />;
void upstreamFieldProp;
// @ts-expect-error Date fields accept Core ISO strings, not upstream date objects.
const upstreamDateValue = <DateField label="Birthday" value={{ year: 2026, month: 8, day: 26 }} />;
void upstreamDateValue;

const ariaNamedField = <TextField aria-label="Name" />;
const labelledByField = <TextField aria-labelledby="name-heading" />;
void ariaNamedField;
void labelledByField;
// @ts-expect-error Every Core field requires label, aria-label, or aria-labelledby.
const unnamedTextField = <TextField />;
void unnamedTextField;
// @ts-expect-error Switch uses the same Core accessible-name contract.
const unnamedSwitch = <Switch>Enabled</Switch>;
void unnamedSwitch;
// Switch's canonical contract intentionally excludes field validation props.
// @ts-expect-error Switch does not expose required.
const switchRequired = <Switch label="Enabled" required />;
void switchRequired;
// @ts-expect-error Switch does not expose invalid.
const switchInvalid = <Switch label="Enabled" invalid />;
void switchInvalid;
// @ts-expect-error R1.2 fields do not expose the upstream validationBehavior prop.
const fieldValidationBehavior = <TextField label="Name" validationBehavior="native" />;
void fieldValidationBehavior;

// Breadcrumb landmarks require a Core-owned accessible name; JS callers receive the safe fallback.
// @ts-expect-error Breadcrumbs requires Core's explicit accessible name.
const unnamedBreadcrumbs = <Breadcrumbs items={[{ label: 'Home' }]} />;
void unnamedBreadcrumbs;
// @ts-expect-error Breadcrumb current state is derived from the final item, not a public item prop.
const publicCurrentBreadcrumb = <Breadcrumbs aria-label="Breadcrumb" items={[{ label: 'Home', current: true }]} />;
void publicCurrentBreadcrumb;

// Upstream RAC prop names remain private implementation details.
// @ts-expect-error Core owns `disabled`, not the upstream `isDisabled` prop.
const upstreamCheckbox = <Checkbox isDisabled>Accept</Checkbox>;
void upstreamCheckbox;
// @ts-expect-error Core owns `expanded`, not the upstream `isExpanded` prop.
const upstreamDisclosure = <Disclosure title="Details" isExpanded>Content</Disclosure>;
void upstreamDisclosure;
// @ts-expect-error Core owns `selected`, not the upstream `isSelected` prop.
const upstreamToggle = <ToggleButton isSelected>Bold</ToggleButton>;
void upstreamToggle;
// @ts-expect-error Core owns `onActivate`, not the upstream `onPress` prop.
const upstreamLink = <Link href="/settings" onPress={() => undefined}>Settings</Link>;
void upstreamLink;

const unsupportedCancellation = (
  <Button onActivate={(event) => {
    // @ts-expect-error Core activation events intentionally do not expose cancellation.
    event.preventDefault();
  }} />
);
void unsupportedCancellation;

const r13Collections = (
  <>
    <Calendar label="Date" defaultValue="2026-08-26" />
    <ColorArea label="Saturation" defaultValue="#ff0000" />
    <ColorField label="Color" defaultValue="#ff0000" />
    <ColorPicker defaultValue="#ff0000"><ColorField label="Nested color" /></ColorPicker>
    <ColorSlider label="Red" defaultValue="#ff0000" />
    <ColorSwatch color="#ff0000" />
    <ColorSwatchPicker aria-label="Palette" items={[{ id: 'red', color: '#ff0000' }]} />
    <ColorWheel aria-label="Hue" defaultValue="#ff0000" />
    <ComboBox label="City" items={[{ id: 'mel', label: <strong>Melbourne</strong> }]} />
    <GridList aria-label="Files" items={[{ id: 'readme', label: <strong>README</strong> }]} />
    <ListBox aria-label="Files" items={[{ id: 'readme', label: <strong>README</strong> }]} />
    <Menu aria-label="Actions" items={[{ id: 'edit', label: <strong>Edit</strong> }]} />
    <RadioGroup label="Plan" options={[{ value: 'pro', label: <strong>Pro</strong> }]} />
    <RangeCalendar label="Trip" defaultValue={{ start: '2026-08-26', end: '2026-09-01' }} />
    <Select label="Color" items={[{ id: 'red', label: <strong>Red</strong> }]} />
    <Slider label="Volume" defaultValue={50} />
    <Table aria-label="People" columns={[{ id: 'name', label: 'Name', isRowHeader: true }]} rows={[{ id: 'ada', values: { name: 'Ada' } }]} />
    <Tabs aria-label="Sections" items={[{ id: 'overview', label: <strong>Overview</strong>, panel: 'Summary' }]} />
    <TagGroup label="Tags" items={[{ id: 'one', label: <strong>One</strong> }]} />
    <ToggleButtonGroup aria-label="Text style"><ToggleButton>Bold</ToggleButton></ToggleButtonGroup>
    <TokenField label="Tags" defaultValue={['one']} />
    <Toolbar aria-label="Actions"><Button>Save</Button></Toolbar>
    <Tree aria-label="Navigation" items={[{ id: 'docs', label: <strong>Docs</strong> }]} />
    <Virtualizer aria-label="Results" items={[{ id: 'one', label: <strong>One</strong> }]} />
  </>
);
void r13Collections;

// R1.3 public collection contracts intentionally keep naming and item rendering Core-owned.
// @ts-expect-error ARIA-only controls do not expose a `label` prop.
const colorWheelLabel = <ColorWheel label="Hue" aria-label="Hue" />;
void colorWheelLabel;
// @ts-expect-error ARIA-only controls do not expose a `label` prop.
const colorSwatchPickerLabel = <ColorSwatchPicker label="Palette" aria-label="Palette" />;
void colorSwatchPickerLabel;
// @ts-expect-error CollectionProps is ARIA-only; labels belong on collection items.
const listBoxLabel = <ListBox label="Files" aria-label="Files" />;
void listBoxLabel;
// @ts-expect-error CollectionProps is ARIA-only; labels belong on collection items.
const gridListLabel = <GridList label="Files" aria-label="Files" />;
void gridListLabel;
// @ts-expect-error Menus use an ARIA accessible name, not a field label.
const menuLabel = <Menu label="Actions" aria-label="Actions" />;
void menuLabel;
// @ts-expect-error Tabs use an ARIA accessible name, not a field label.
const tabsLabel = <Tabs label="Sections" aria-label="Sections" />;
void tabsLabel;
// @ts-expect-error ToggleButtonGroup uses an ARIA accessible name, not a field label.
const toggleButtonGroupLabel = <ToggleButtonGroup label="Styles" aria-label="Styles" />;
void toggleButtonGroupLabel;
// @ts-expect-error Toolbar uses an ARIA accessible name, not a field label.
const toolbarLabel = <Toolbar label="Actions" aria-label="Actions" />;
void toolbarLabel;
// @ts-expect-error Tree uses an ARIA accessible name, not a field label.
const treeLabel = <Tree label="Navigation" aria-label="Navigation" />;
void treeLabel;
// @ts-expect-error Table's canonical API supports only `aria-label`.
const tableLabelledBy = <Table aria-labelledby="people-heading" />;
void tableLabelledBy;
// @ts-expect-error Virtualizer's canonical API supports only `aria-label`.
const virtualizerLabelledBy = <Virtualizer aria-labelledby="results-heading" />;
void virtualizerLabelledBy;
// @ts-expect-error Core wraps collection item labels; a public render-prop child is not supported.
const listBoxChildren = <ListBox aria-label="Files" items={[]}>{(item) => item.label}</ListBox>;
void listBoxChildren;
// @ts-expect-error Core wraps menu item labels; a public render-prop child is not supported.
const menuChildren = <Menu aria-label="Actions" items={[]}>{(item) => item.label}</Menu>;
void menuChildren;
// @ts-expect-error Core wraps Select item labels; a public render-prop child is not supported.
const selectChildren = <Select label="Color" items={[]}>{(item) => item.label}</Select>;
void selectChildren;
// @ts-expect-error Core wraps ComboBox item labels; a public render-prop child is not supported.
const comboBoxChildren = <ComboBox label="City" items={[]}>{(item) => item.label}</ComboBox>;
void comboBoxChildren;
// @ts-expect-error RadioGroup does not expose generic field descriptions.
const radioGroupDescription = <RadioGroup label="Plan" description="Unsupported" />;
void radioGroupDescription;
// @ts-expect-error RadioGroup does not expose generic field errors.
const radioGroupErrorMessage = <RadioGroup label="Plan" errorMessage="Unsupported" />;
void radioGroupErrorMessage;
// @ts-expect-error RadioGroup does not expose a generic field name.
const radioGroupName = <RadioGroup label="Plan" name="unsupported" />;
void radioGroupName;
// @ts-expect-error TagGroup does not expose generic field descriptions.
const tagGroupDescription = <TagGroup label="Tags" description="Unsupported" />;
void tagGroupDescription;
// @ts-expect-error TagGroup does not expose generic field errors.
const tagGroupErrorMessage = <TagGroup label="Tags" errorMessage="Unsupported" />;
void tagGroupErrorMessage;
// @ts-expect-error TagGroup does not expose readOnly.
const tagGroupReadOnly = <TagGroup label="Tags" readOnly />;
void tagGroupReadOnly;
// @ts-expect-error TagGroup does not expose required.
const tagGroupRequired = <TagGroup label="Tags" required />;
void tagGroupRequired;
// @ts-expect-error TagGroup does not expose invalid.
const tagGroupInvalid = <TagGroup label="Tags" invalid />;
void tagGroupInvalid;
// @ts-expect-error TokenField does not expose generic field descriptions.
const tokenFieldDescription = <TokenField label="Tags" description="Unsupported" />;
void tokenFieldDescription;
// @ts-expect-error TokenField does not expose generic field errors.
const tokenFieldErrorMessage = <TokenField label="Tags" errorMessage="Unsupported" />;
void tokenFieldErrorMessage;
// @ts-expect-error TokenField does not expose required.
const tokenFieldRequired = <TokenField label="Tags" required />;
void tokenFieldRequired;
// @ts-expect-error TokenField does not expose invalid.
const tokenFieldInvalid = <TokenField label="Tags" invalid />;
void tokenFieldInvalid;
// @ts-expect-error Tree item content is always rendered from CoreTreeItem.label.
const treeChildren = <Tree aria-label="Navigation" items={[]}>{(item) => item.label}</Tree>;
void treeChildren;
// @ts-expect-error Virtualizer item content is always rendered from the normalized item.
const virtualizerRenderItem = <Virtualizer aria-label="Results" items={[]} renderItem={(item) => item.label} />;
void virtualizerRenderItem;
// Calendar contracts expose Core date/validation state, but not field messaging props.
// @ts-expect-error Calendar does not expose description.
const calendarDescription = <Calendar label="Date" description="Unsupported" />;
void calendarDescription;
// @ts-expect-error Calendar does not expose errorMessage.
const calendarErrorMessage = <Calendar label="Date" errorMessage="Unsupported" />;
void calendarErrorMessage;
// @ts-expect-error RangeCalendar does not expose description.
const rangeCalendarDescription = <RangeCalendar label="Range" description="Unsupported" />;
void rangeCalendarDescription;
// @ts-expect-error RangeCalendar does not expose errorMessage.
const rangeCalendarErrorMessage = <RangeCalendar label="Range" errorMessage="Unsupported" />;
void rangeCalendarErrorMessage;

const r14Overlays = (
  <>
    <DropZone aria-label="Upload" onDrop={(event) => {
      const drop: CoreDropEvent = event;
      const operation: 'copy' | 'link' | 'move' | 'cancel' = drop.dropOperation;
      for (const item of drop.items) {
        if (item.kind === 'file') void item.getFile();
        if (item.kind === 'text') void item.types;
        if (item.kind === 'directory') void item.getEntries();
      }
      void operation;
    }}>Drop files</DropZone>
    <FileTrigger acceptedFileTypes={['image/png', 'image/jpeg'] as const} allowsMultiple onSelect={(files) => { const selected: File[] = files; void selected; }}>Choose files</FileTrigger>
    <Dialog title="Confirm" trigger={<button type="button">Open</button>}>Dialog content</Dialog>
    <Dialog aria-label="Programmatic dialog" open={false}>Dialog content</Dialog>
    <Popover aria-label="Details" trigger={<button type="button">Details</button>}>Popover content</Popover>
    <PreviewTrigger aria-label="Item preview" trigger={<a href="/items/1">Preview</a>} open={false}>Preview content</PreviewTrigger>
    <ToastProvider><Toast message="Saved" variant="success" onDismiss={() => undefined} /></ToastProvider>
    <Tooltip trigger={<button type="button">Help</button>} content="Helpful information" delay={500} closeDelay={0} />
  </>
);
void r14Overlays;

function ToastAction() {
  const manager = useToast();
  const key: string = manager.add('Saved', { duration: 5000, onDismiss: () => undefined });
  manager.remove(key);
  // @ts-expect-error Toast messages exclude null.
  manager.add(null);
  // @ts-expect-error Toast messages exclude undefined.
  manager.add(undefined);
  // @ts-expect-error Toast messages exclude booleans.
  manager.add(false);
  return null;
}
void ToastAction;

// @ts-expect-error DropZone exposes a Core drop event, not a native DragEvent.
const nativeDropEvent = <DropZone onDrop={(event) => event.dataTransfer.files} />;
void nativeDropEvent;
// @ts-expect-error FileTrigger uses the exact acceptedFileTypes array contract.
const fileTriggerAcceptAlias = <FileTrigger acceptedFileTypes="image/*" />;
void fileTriggerAcceptAlias;
// @ts-expect-error Dialog requires a title, aria-label, or aria-labelledby.
const unnamedDialog = <Dialog>Content</Dialog>;
void unnamedDialog;
// @ts-expect-error Popover requires an accessible name.
const unnamedPopover = <Popover trigger={<button type="button">Open</button>}>Content</Popover>;
void unnamedPopover;
// @ts-expect-error PreviewTrigger requires a trigger.
const triggerlessPreview = <PreviewTrigger aria-label="Preview">Content</PreviewTrigger>;
void triggerlessPreview;
// @ts-expect-error Toast requires a message.
const emptyToast = <Toast />;
void emptyToast;
// @ts-expect-error Toast owns one required message rather than a redundant description alias.
const redundantToastDescription = <Toast message="Saved" description="Duplicate detail" />;
void redundantToastDescription;
// @ts-expect-error Tooltip requires content.
const emptyTooltip = <Tooltip trigger={<button type="button">Help</button>} />;
void emptyTooltip;
// @ts-expect-error Tooltip has one explicit trigger prop rather than an ambiguous children alias.
const childTooltip = <Tooltip content="Help"><button type="button">Help</button></Tooltip>;
void childTooltip;
// @ts-expect-error Core owns `open`, not the upstream `isOpen` prop.
const upstreamPopoverState = <Popover aria-label="Details" trigger={<button type="button">Details</button>} isOpen>Content</Popover>;
void upstreamPopoverState;
