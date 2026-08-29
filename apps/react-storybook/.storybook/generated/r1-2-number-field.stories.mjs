// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:33ecfb862cab0c91a5a1d4998191d44f693b6bf7a102f0bd685d4a17dd6a6d8f
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false,
      "step": 1
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "decrement",
      "increment",
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
      "minValue",
      "maxValue",
      "step",
      "name",
      "formatOptions"
    ]
  },
  "binding": "core:component:number-field#web.react",
  "export": "NumberField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-number-field",
  "states": [
    "idle",
    "disabled",
    "readonly",
    "required",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'NumberField', tranche: 'R1.2', binding };

export default {
  title: 'Core React/R1.2/NumberField',
  component: Core.NumberField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned NumberField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
