// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:d0443330d9ccefe5d7d6e68296c627b4687b27cb7bf530b116ce5392f938f74f
import * as Core from '@core-ui/react';
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
  "binding": "core:component:button#web.react",
  "export": "Button",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-button",
  "states": [
    "idle",
    "pending",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'Button', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Button',
  component: Core.Button,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Button family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
