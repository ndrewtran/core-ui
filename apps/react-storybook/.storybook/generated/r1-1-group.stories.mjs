// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:dc37cadcbfe879cd5471eee78413f4af2c58e7ec52302088afc2caea1dca2112
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:group#web.react",
  "export": "Group",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-group",
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
  title: 'Mux UI React/R1.1/Group',
  id: 'muxui-react-r1-1-group',
  component: MuxUI.Group,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Group family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
