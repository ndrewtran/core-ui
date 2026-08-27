// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:88dd696c0b3526ec58ea998cee7afdd3f1c6a2637f5bda0d4c17f84cbfd91456
import * as Core from '@core-ui/react';
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
  "binding": "core:component:color-swatch-picker#web.react",
  "export": "ColorSwatchPicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-swatch-picker",
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
  title: 'Core React/R1.3/ColorSwatchPicker',
  component: Core.ColorSwatchPicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorSwatchPicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
