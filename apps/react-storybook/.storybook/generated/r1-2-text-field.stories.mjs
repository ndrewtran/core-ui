// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:bd22051e96463957d04abc6cd6dd395a74202fd4d6b2bfff261abed3de95d62d
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false,
      "type": "text"
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "description",
      "error"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled",
      "readOnly",
      "required",
      "invalid",
      "name",
      "placeholder",
      "type"
    ]
  },
  "binding": "muxui:component:text-field#web.react",
  "export": "TextField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-text-field",
  "states": [
    "idle",
    "disabled",
    "readonly",
    "required",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'TextField', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/TextField',
  id: 'muxui-react-r1-2-text-field',
  component: MuxUI.TextField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned TextField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
