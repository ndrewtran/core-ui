// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:600554dcc85c514e6f2b7093e26812444cb034322ee61fa889148832feaa41a7
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "maxValue": 100,
      "minValue": 0
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
      "label"
    ]
  },
  "binding": "core:component:progress-bar#web.react",
  "export": "ProgressBar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-progress-bar",
  "states": [
    "idle",
    "progress",
    "indeterminate",
    "complete"
  ],
  "strategy": "direct"
};
const record = { family: 'ProgressBar', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/ProgressBar',
  component: Core.ProgressBar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ProgressBar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
