// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:93254c1346c8cb379cf2e166f73ac20d6ddf0e08d3fc5950527b59ad597651b3
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultValue": "",
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false,
      "value": ""
    },
    "events": [
      "change",
      "select"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "list"
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
      "name",
      "items",
      "placeholder"
    ]
  },
  "binding": "muxui:component:autocomplete#web.react",
  "export": "Autocomplete",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-autocomplete",
  "states": [
    "idle",
    "focused",
    "disabled",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'Autocomplete', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/Autocomplete',
  id: 'muxui-react-r1-2-autocomplete',
  component: MuxUI.Autocomplete,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Autocomplete family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
