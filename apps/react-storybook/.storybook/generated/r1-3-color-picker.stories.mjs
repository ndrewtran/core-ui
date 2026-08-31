// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:98648612aeecd9de803d616780ae6d8ce5ec32d1e5e6bddebe589060e42e641b
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
      "field",
      "area",
      "slider",
      "swatch"
    ],
    "props": [
      "value",
      "defaultValue",
      "disabled",
      "readOnly"
    ]
  },
  "binding": "muxui:component:color-picker#web.react",
  "export": "ColorPicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-color-picker",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorPicker', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ColorPicker',
  id: 'muxui-react-r1-3-color-picker',
  component: MuxUI.ColorPicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ColorPicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
