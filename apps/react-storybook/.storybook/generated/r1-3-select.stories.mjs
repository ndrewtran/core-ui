// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:66026d275e2aa1c3e5c16a7cf719ca9338d354445cd6e3dc4fb57e981e761cc0
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "trigger",
      "list",
      "option"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "items",
      "value",
      "defaultValue",
      "disabled",
      "readOnly",
      "required",
      "invalid",
      "name",
      "placeholder"
    ]
  },
  "binding": "muxui:component:select#web.react",
  "export": "Select",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-select",
  "states": [
    "idle",
    "focused",
    "open",
    "disabled",
    "read-only",
    "invalid",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'Select', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/Select',
  id: 'muxui-react-r1-3-select',
  component: MuxUI.Select,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Select family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
