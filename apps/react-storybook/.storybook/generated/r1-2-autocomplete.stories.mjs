// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1ca3aad590c459ced04039fd9192c44a08e5009a4226e404854ba79603af4840
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultValue": "",
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false,
      "value": ""
    },
    "events": [
      "change",
      "select"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "list"
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
      "items",
      "placeholder"
    ]
  },
  "binding": "core:component:autocomplete#web.react",
  "export": "Autocomplete",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-autocomplete",
  "states": [
    "idle",
    "focused",
    "disabled",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'Autocomplete', tranche: 'R1.2', binding };

export default {
  title: 'Core React/R1.2/Autocomplete',
  component: Core.Autocomplete,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Autocomplete family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
