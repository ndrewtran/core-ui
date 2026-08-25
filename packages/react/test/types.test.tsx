import {
  Breadcrumbs,
  Button,
  Checkbox,
  Disclosure,
  DisclosureGroup,
  Group,
  Link,
  Meter,
  ProgressBar,
  Separator,
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
