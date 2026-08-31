// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:556b4940a50da46849974850dafc758542a1f746af80dbdcc36f371e7b0f7c2e
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "height": 240,
      "itemHeight": 40,
      "overscan": 2
    },
    "events": [
      "scroll"
    ],
    "parts": [
      "root",
      "viewport",
      "item"
    ],
    "props": [
      "aria-label",
      "items",
      "height",
      "itemHeight",
      "overscan",
      "disabled"
    ]
  },
  "binding": "muxui:component:virtualizer#web.react",
  "export": "Virtualizer",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-virtualizer",
  "states": [
    "idle",
    "focused",
    "disabled",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'Virtualizer', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/Virtualizer',
  id: 'muxui-react-r1-3-virtualizer',
  component: MuxUI.Virtualizer,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Virtualizer family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
