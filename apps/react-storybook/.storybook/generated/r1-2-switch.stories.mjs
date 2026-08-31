// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1121d78094559cf7cfa48784d5a5710e32e103abe93bac1d38d648ea1472d617
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultSelected": false,
      "disabled": false,
      "readOnly": false,
      "selected": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "input",
      "indicator",
      "label"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "selected",
      "defaultSelected",
      "disabled",
      "readOnly",
      "name",
      "value"
    ]
  },
  "binding": "muxui:component:switch#web.react",
  "export": "Switch",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-switch",
  "states": [
    "idle",
    "selected",
    "disabled",
    "readonly"
  ],
  "strategy": "direct"
};
const record = { family: 'Switch', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/Switch',
  id: 'muxui-react-r1-2-switch',
  component: MuxUI.Switch,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Switch family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
