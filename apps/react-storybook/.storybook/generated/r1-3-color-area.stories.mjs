// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:f6ad46e204db7d5d0166e0c208bed6d7a37d010ea43cd7587cde60d8ba0d653c
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
      "area",
      "thumb"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled",
      "readOnly"
    ]
  },
  "binding": "core:component:color-area#web.react",
  "export": "ColorArea",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-area",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorArea', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/ColorArea',
  component: Core.ColorArea,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorArea family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
