// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:370f3d89ad817b1a6cb2f676b99906b52fd23df15cc361b209db4b336e04715a
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [
      "selectionChange"
    ],
    "parts": [
      "root",
      "button"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "selectedIds",
      "defaultSelectedIds",
      "disabled",
      "orientation"
    ]
  },
  "binding": "muxui:component:toggle-button-group#web.react",
  "export": "ToggleButtonGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-toggle-button-group",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'ToggleButtonGroup', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ToggleButtonGroup',
  id: 'muxui-react-r1-3-toggle-button-group',
  component: MuxUI.ToggleButtonGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ToggleButtonGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
