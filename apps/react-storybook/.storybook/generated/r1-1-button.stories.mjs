// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:14fffaa117bb2db748ba002dd8b1c00d9a587b8c6149d9c4ffe470b0dcff3901
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "pending": false
    },
    "events": [
      "activate"
    ],
    "parts": [
      "root",
      "label"
    ],
    "props": [
      "disabled",
      "pending"
    ]
  },
  "binding": "muxui:component:button#web.react",
  "export": "Button",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-button",
  "states": [
    "idle",
    "pending",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'Button', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/Button',
  id: 'muxui-react-r1-1-button',
  component: MuxUI.Button,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Button family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
