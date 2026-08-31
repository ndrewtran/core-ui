// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:10d870297573d9fd661a5241ac8dd0ab97874ba544603e47d0e038252d068173
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:number-field#web.react",
  "export": "NumberField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-number-field",
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
  title: 'Mux UI React/R1.2/NumberField',
  id: 'muxui-react-r1-2-number-field',
  component: MuxUI.NumberField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned NumberField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
