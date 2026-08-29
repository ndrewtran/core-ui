// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:27d75e5cc5176d675c7ee23f6e5e2f9d063bfee41f9a44e58100501d6bf74511
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "segment",
      "description",
      "error"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled",
      "readOnly",
      "required",
      "invalid",
      "name"
    ]
  },
  "binding": "core:component:date-field#web.react",
  "export": "DateField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-date-field",
  "states": [
    "idle",
    "disabled",
    "readonly",
    "required",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'DateField', tranche: 'R1.2', binding };

export default {
  title: 'Core React/R1.2/DateField',
  component: Core.DateField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned DateField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
