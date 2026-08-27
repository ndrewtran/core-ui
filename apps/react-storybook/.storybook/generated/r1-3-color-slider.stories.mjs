// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1add83b1f824a2ddbfbbcce451cda82ba1651a34c9f21e673610a21c17e25800
import * as Core from '@core-ui/react';
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
  "binding": "core:component:color-slider#web.react",
  "export": "ColorSlider",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-slider",
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
  title: 'Core React/R1.3/ColorSlider',
  component: Core.ColorSlider,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorSlider family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
