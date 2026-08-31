// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:e00f964888f074001e9791c715ab2a26435c88bdaa425a4faed508b6c33c7c9d
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "readOnly": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "token"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled",
      "readOnly",
      "name",
      "placeholder"
    ]
  },
  "binding": "muxui:component:token-field#web.react",
  "export": "TokenField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-token-field",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'TokenField', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/TokenField',
  id: 'muxui-react-r1-3-token-field',
  component: MuxUI.TokenField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned TokenField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
