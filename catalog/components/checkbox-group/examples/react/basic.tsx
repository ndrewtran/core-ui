import { CheckboxGroup, Checkbox } from '@muxui/react';

export function BasicCheckboxGroupExample() {
  return <CheckboxGroup label="Notifications" name="notifications"><Checkbox value="email">Email</Checkbox><Checkbox value="sms">SMS</Checkbox></CheckboxGroup>;
}
