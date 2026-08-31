// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:a774f8afabb298215377b124691e4f5d8bfd02cf4e8384f95149427452f05dff
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "list",
      "tab",
      "panels",
      "panel"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "items",
      "value",
      "defaultValue",
      "disabled",
      "orientation"
    ]
  },
  "binding": "muxui:component:tabs#web.react",
  "export": "Tabs",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-tabs",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'Tabs', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/Tabs',
  id: 'muxui-react-r1-3-tabs',
  component: MuxUI.Tabs,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Tabs family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
