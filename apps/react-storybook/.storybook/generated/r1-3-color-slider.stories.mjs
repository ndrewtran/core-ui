// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:2beb24d328ffda14967d08d3e06742a7cfb22f50fd0eec2172500c4d329c7fa9
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "channel": "red",
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "track",
      "thumb"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "channel",
      "colorSpace",
      "disabled",
      "orientation"
    ]
  },
  "binding": "muxui:component:color-slider#web.react",
  "export": "ColorSlider",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-color-slider",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorSlider', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ColorSlider',
  id: 'muxui-react-r1-3-color-slider',
  component: MuxUI.ColorSlider,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ColorSlider family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
