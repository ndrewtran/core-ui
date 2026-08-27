// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:fdb63318f370ae3a645e4e9d67a702bfba53cc4779d481af9137cd77b534b591
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
      "change",
      "open"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "segment",
      "trigger",
      "calendar",
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
  "binding": "core:component:date-picker#web.react",
  "export": "DatePicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-date-picker",
  "states": [
    "idle",
    "open",
    "disabled",
    "readonly",
    "required",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'DatePicker', tranche: 'R1.2', binding };

export default {
  title: 'Core React/R1.2/DatePicker',
  component: Core.DatePicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned DatePicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
