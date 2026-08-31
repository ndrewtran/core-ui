// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:b5580d8147adbde2e07b6771f69d6ce392b41af29e01dbce4eb9876d6a3e3433
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:progress-bar#web.react",
  "export": "ProgressBar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-progress-bar",
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
  title: 'Mux UI React/R1.1/ProgressBar',
  id: 'muxui-react-r1-1-progress-bar',
  component: MuxUI.ProgressBar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ProgressBar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
