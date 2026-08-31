// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:b2a7cd03dad8d4221f95d49fbb4257c66e68ac878aa73abd2367730777ad12e3
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:date-picker#web.react",
  "export": "DatePicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-date-picker",
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
  title: 'Mux UI React/R1.2/DatePicker',
  id: 'muxui-react-r1-2-date-picker',
  component: MuxUI.DatePicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned DatePicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
