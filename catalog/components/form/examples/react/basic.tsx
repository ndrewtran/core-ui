import { Form, TextField, Button } from '@muxui/react';

export function BasicFormExample() {
  return <Form><TextField label="Name" name="name" /><Button type="submit">Save</Button></Form>;
}
