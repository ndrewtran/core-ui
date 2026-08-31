// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:c970d4304c08617aeb3b089e740969824041350289138137f81397a367f8bed3
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
      "change",
      "submit",
      "clear"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "clear",
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
      "placeholder"
    ]
  },
  "binding": "muxui:component:search-field#web.react",
  "export": "SearchField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-search-field",
  "states": [
    "idle",
    "filled",
    "disabled",
    "readonly",
    "required",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'SearchField', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/SearchField',
  id: 'muxui-react-r1-2-search-field',
  component: MuxUI.SearchField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned SearchField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
