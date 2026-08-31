// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:d28f0b83cc1fe8265a3633d91c2666e922116f0ed29a38678a867d6b484b18d5
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false
    },
    "events": [],
    "parts": [
      "root"
    ],
    "props": [
      "color",
      "disabled"
    ]
  },
  "binding": "muxui:component:color-swatch#web.react",
  "export": "ColorSwatch",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-color-swatch",
  "states": [
    "idle",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorSwatch', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ColorSwatch',
  id: 'muxui-react-r1-3-color-swatch',
  component: MuxUI.ColorSwatch,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ColorSwatch family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
