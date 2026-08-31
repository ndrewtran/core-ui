// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:451598800446fd3377808eed94c093014f300554a2bc10242590fe2aaeb484ce
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [],
    "parts": [
      "root",
      "control"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "orientation",
      "disabled"
    ]
  },
  "binding": "muxui:component:toolbar#web.react",
  "export": "Toolbar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-toolbar",
  "states": [
    "idle",
    "focused",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'Toolbar', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/Toolbar',
  id: 'muxui-react-r1-3-toolbar',
  component: MuxUI.Toolbar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Toolbar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
