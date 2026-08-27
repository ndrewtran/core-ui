// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:0f4cb6c012ce770c9e9fa85eb105c3ceb3bb0d9bd56818095c39d0de6b3f214e
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "maxValue": 100,
      "minValue": 0,
      "value": 0
    },
    "events": [],
    "parts": [
      "root",
      "label",
      "track",
      "fill"
    ],
    "props": [
      "value",
      "minValue",
      "maxValue",
      "label",
      "formatOptions"
    ]
  },
  "binding": "core:component:meter#web.react",
  "export": "Meter",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-meter",
  "states": [
    "idle",
    "low",
    "high"
  ],
  "strategy": "direct"
};
const record = { family: 'Meter', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Meter',
  component: Core.Meter,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Meter family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
