import { Form, TextField, Button } from '@core-ui/react';

export function BasicFormExample() {
  return <Form><TextField label="Name" name="name" /><Button type="submit">Save</Button></Form>;
}
