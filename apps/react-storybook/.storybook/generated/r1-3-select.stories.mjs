// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:5d4b7aedffb71e5bcfd435266cf0ce5beac54d033ff7dab54bb43f5dbac7b55a
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
  "binding": "core:component:select#web.react",
  "export": "Select",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-select",
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
  title: 'Core React/R1.3/Select',
  component: Core.Select,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Select family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
