import {
  Autocomplete,
  type AutocompleteSelectionItem,
  Breadcrumbs,
  Button,
  Checkbox,
  CheckboxGroup,
  DateField,
  DatePicker,
  DateRangePicker,
  Disclosure,
  DisclosureGroup,
  Form,
  Group,
  Link,
  Meter,
  NumberField,
  ProgressBar,
  SearchField,
  Separator,
  Switch,
  TextField,
  TimeField,
  ToggleButton,
  reactCompatibility,
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
