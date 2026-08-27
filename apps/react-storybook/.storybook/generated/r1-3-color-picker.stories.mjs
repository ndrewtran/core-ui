// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:8d43f46b5136661980cbf1938280c219dc34dfc448dbb38a42af91949760ff00
import * as Core from '@core-ui/react';
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
  "binding": "core:component:color-picker#web.react",
  "export": "ColorPicker",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-picker",
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
  title: 'Core React/R1.3/ColorPicker',
  component: Core.ColorPicker,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorPicker family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
