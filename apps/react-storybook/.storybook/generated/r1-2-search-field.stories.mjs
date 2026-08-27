// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:11ac0a9ae13247167b579e4164b77bcc7b65d43678d20df057359a88e0bf125b
import * as Core from '@core-ui/react';
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
  "binding": "core:component:search-field#web.react",
  "export": "SearchField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-search-field",
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
  title: 'Core React/R1.2/SearchField',
  component: Core.SearchField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned SearchField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
