// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:d1b2ca475dc905ef9ef04f6cbb40290582213e05b7c7e59c06569c00d60a1973
import * as Core from '@core-ui/react';
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
  "binding": "core:component:token-field#web.react",
  "export": "TokenField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-token-field",
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
  title: 'Core React/R1.3/TokenField',
  component: Core.TokenField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned TokenField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
