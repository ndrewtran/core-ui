// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:34e45dbd9e4418ef1c14e60d074768193577ee1e477d5cc92db97332064a187e
import * as Core from '@core-ui/react';
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
  "binding": "core:component:slider#web.react",
  "export": "Slider",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-slider",
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
  title: 'Core React/R1.3/Slider',
  component: Core.Slider,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Slider family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
