// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:f97b7ccc57893fc0a428c00547ad3145cdd02451dfc37878982d2841c1cb40ed
import * as Core from '@core-ui/react';
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
  "binding": "core:component:color-swatch#web.react",
  "export": "ColorSwatch",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-swatch",
  "states": [
    "idle",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorSwatch', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/ColorSwatch',
  component: Core.ColorSwatch,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorSwatch family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
