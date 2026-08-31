// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:0e562f189b91a7917a9ffc910ed7eb1a1489b35ecab7449043e563477157f4e0
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultSelected": false,
      "disabled": false,
      "selected": false
    },
    "events": [
      "change",
      "activate"
    ],
    "parts": [
      "root",
      "label"
    ],
    "props": [
      "selected",
      "defaultSelected",
      "disabled"
    ]
  },
  "binding": "muxui:component:toggle-button#web.react",
  "export": "ToggleButton",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-toggle-button",
  "states": [
    "idle",
    "selected",
    "disabled",
    "pressed"
  ],
  "strategy": "direct"
};
const record = { family: 'ToggleButton', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/ToggleButton',
  id: 'muxui-react-r1-1-toggle-button',
  component: MuxUI.ToggleButton,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ToggleButton family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
