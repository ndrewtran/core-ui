// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:3c6ce2f4e4999f5925d8d414584b45669a68df1f9c2f14b4034dac3f05f8f495
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "readOnly": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "area",
      "thumb"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled",
      "readOnly"
    ]
  },
  "binding": "muxui:component:color-area#web.react",
  "export": "ColorArea",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-color-area",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorArea', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ColorArea',
  id: 'muxui-react-r1-3-color-area',
  component: MuxUI.ColorArea,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ColorArea family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
