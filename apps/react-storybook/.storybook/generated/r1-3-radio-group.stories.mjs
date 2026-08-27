// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:bbbade3a99c37c4bbc81b314f6c6c6272e0e7ca42ff539d95ed3a77fb4a01aa7
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
  "binding": "core:component:radio-group#web.react",
  "export": "RadioGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-radio-group",
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
  title: 'Core React/R1.3/RadioGroup',
  component: Core.RadioGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned RadioGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
