// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:54699f122a6e1d0378b9e39766add14bbd0aee8b5d1aed15cc76b21b698239e3
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "role": "group"
    },
    "events": [],
    "parts": [
      "root",
      "label",
      "content"
    ],
    "props": [
      "disabled",
      "invalid",
      "readOnly",
      "role",
      "aria-label"
    ]
  },
  "binding": "core:component:group#web.react",
  "export": "Group",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-group",
  "states": [
    "idle",
    "disabled",
    "invalid",
    "readonly"
  ],
  "strategy": "direct"
};
const record = { family: 'Group', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Group',
  component: Core.Group,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Group family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
