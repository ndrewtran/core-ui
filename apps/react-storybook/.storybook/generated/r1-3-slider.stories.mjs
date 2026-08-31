// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:6181786a10d6eb6f934fbe3c4641fc8e9d054d9295cc33d471cf63c27c762aee
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "max": 100,
      "min": 0,
      "orientation": "horizontal",
      "step": 1
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
      "min",
      "max",
      "step",
      "disabled",
      "orientation"
    ]
  },
  "binding": "muxui:component:slider#web.react",
  "export": "Slider",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-slider",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'Slider', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/Slider',
  id: 'muxui-react-r1-3-slider',
  component: MuxUI.Slider,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Slider family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
