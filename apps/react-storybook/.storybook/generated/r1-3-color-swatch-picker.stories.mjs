// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:569509cf471188aeb55640295505ee493fa121cd0b960ae138c2b445172270a8
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "swatch",
      "selection"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "items",
      "value",
      "defaultValue",
      "disabled"
    ]
  },
  "binding": "muxui:component:color-swatch-picker#web.react",
  "export": "ColorSwatchPicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-color-swatch-picker",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorSwatchPicker', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ColorSwatchPicker',
  id: 'muxui-react-r1-3-color-swatch-picker',
  component: MuxUI.ColorSwatchPicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ColorSwatchPicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
