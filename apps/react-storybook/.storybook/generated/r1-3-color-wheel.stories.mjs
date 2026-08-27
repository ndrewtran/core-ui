// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:0d690db817c7a743c97b089e97ab27e23e8dc13467fe28cd4ff3fe02c7f17686
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
  "binding": "core:component:color-wheel#web.react",
  "export": "ColorWheel",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-wheel",
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
  title: 'Core React/R1.3/ColorWheel',
  component: Core.ColorWheel,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorWheel family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
