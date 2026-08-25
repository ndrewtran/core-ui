import { Button, reactCompatibility } from '@core-ui/react';

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

const unsupportedCancellation = (
  <Button onActivate={(event) => {
    // @ts-expect-error Core activation events intentionally do not expose cancellation.
    event.preventDefault();
  }} />
);
void unsupportedCancellation;
