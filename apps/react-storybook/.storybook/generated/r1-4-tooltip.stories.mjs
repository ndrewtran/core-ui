// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:e5edcb5fd65f9732824684fdd2f45ee0de37809a55f017decd95a1d1d81f3dd2
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "closeDelay": 0,
      "delay": 500,
      "placement": "top"
    },
    "events": [
      "openChange"
    ],
    "parts": [
      "trigger",
      "tooltip"
    ],
    "props": [
      "content",
      "trigger",
      "delay",
      "closeDelay",
      "placement",
      "open",
      "defaultOpen",
      "onOpenChange",
      "className"
    ]
  },
  "binding": "core:component:tooltip#web.react",
  "export": "Tooltip",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-tooltip",
  "states": [
    "closed",
    "opening",
    "open",
    "closing"
  ],
  "strategy": "direct"
};
const record = { family: 'Tooltip', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/Tooltip',
  component: Core.Tooltip,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Tooltip family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
