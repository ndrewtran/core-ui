// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:f9ef0770634932f5dc2a67b0f6d7f701d8561e7b1a38fca2ed7d52ab20917369
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "checked": false,
      "defaultChecked": false,
      "disabled": false,
      "indeterminate": false,
      "invalid": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "input",
      "indicator",
      "label"
    ],
    "props": [
      "checked",
      "defaultChecked",
      "disabled",
      "indeterminate",
      "name",
      "required",
      "value",
      "invalid"
    ]
  },
  "binding": "muxui:component:checkbox#web.react",
  "export": "Checkbox",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-checkbox",
  "states": [
    "idle",
    "selected",
    "indeterminate",
    "disabled",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'Checkbox', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/Checkbox',
  id: 'muxui-react-r1-1-checkbox',
  component: MuxUI.Checkbox,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Checkbox family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
