// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:b7585198890f0ad515327169417f37592bfc5c3a7dd7b6c532235ed125e04c83
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
      "radio"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "options",
      "value",
      "defaultValue",
      "disabled",
      "readOnly",
      "required",
      "invalid"
    ]
  },
  "binding": "muxui:component:radio-group#web.react",
  "export": "RadioGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-radio-group",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "invalid",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'RadioGroup', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/RadioGroup',
  id: 'muxui-react-r1-3-radio-group',
  component: MuxUI.RadioGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned RadioGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
