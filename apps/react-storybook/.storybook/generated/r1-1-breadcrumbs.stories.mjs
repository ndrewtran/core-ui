// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:66b63689bfbc84af1b9c0cf9fa2a134b239dff9f679d4129775f1916c374e92b
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "aria-label": "Breadcrumbs",
      "items": []
    },
    "events": [
      "navigate"
    ],
    "parts": [
      "root",
      "list",
      "item",
      "link"
    ],
    "props": [
      "items",
      "aria-label"
    ]
  },
  "binding": "muxui:component:breadcrumbs#web.react",
  "export": "Breadcrumbs",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-breadcrumbs",
  "states": [
    "idle",
    "disabled",
    "current"
  ],
  "strategy": "direct"
};
const record = { family: 'Breadcrumbs', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/Breadcrumbs',
  id: 'muxui-react-r1-1-breadcrumbs',
  component: MuxUI.Breadcrumbs,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Breadcrumbs family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
