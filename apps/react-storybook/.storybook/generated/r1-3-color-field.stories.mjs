// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:93a2b6ff875b536a60409e023d45d85f0e0db0163d7561327a4e5e4ade7c5750
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
      "name"
    ]
  },
  "binding": "core:component:color-field#web.react",
  "export": "ColorField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-color-field",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'ColorField', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/ColorField',
  component: Core.ColorField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ColorField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
