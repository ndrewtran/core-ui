// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:bffbb4a5e186a7c2ac94abf584feecbfe7d4922d3a21b1f964fb7caffc02cd85
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:tooltip#web.react",
  "export": "Tooltip",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-tooltip",
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
  title: 'Mux UI React/R1.4/Tooltip',
  id: 'muxui-react-r1-4-tooltip',
  component: MuxUI.Tooltip,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Tooltip family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
