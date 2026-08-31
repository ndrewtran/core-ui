// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:0254e33de8cbdcc0fb0c07bd95e8a10bd17380dc66f4745d7b0c76fbe8449e6d
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
      "track",
      "thumb"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled"
    ]
  },
  "binding": "muxui:component:color-wheel#web.react",
  "export": "ColorWheel",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-color-wheel",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorWheel', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ColorWheel',
  id: 'muxui-react-r1-3-color-wheel',
  component: MuxUI.ColorWheel,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ColorWheel family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
