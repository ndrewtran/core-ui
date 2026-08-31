// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:cea2b1f05fe1f58bf10af60c189bf68652f694ddb1239f5e97be0779bc2dbc95
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
      "start",
      "end",
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
      "startName",
      "endName"
    ]
  },
  "binding": "muxui:component:date-range-picker#web.react",
  "export": "DateRangePicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-date-range-picker",
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
const record = { family: 'DateRangePicker', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/DateRangePicker',
  id: 'muxui-react-r1-2-date-range-picker',
  component: MuxUI.DateRangePicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned DateRangePicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
