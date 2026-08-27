// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:8cc503642f181755d4eb915d3433028cd53323d8d035307df332c9acf2e832d3
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultSelected": false,
      "disabled": false,
      "readOnly": false,
      "selected": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "input",
      "indicator",
      "label"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "selected",
      "defaultSelected",
      "disabled",
      "readOnly",
      "name",
      "value"
    ]
  },
  "binding": "core:component:switch#web.react",
  "export": "Switch",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-switch",
  "states": [
    "idle",
    "selected",
    "disabled",
    "readonly"
  ],
  "strategy": "direct"
};
const record = { family: 'Switch', tranche: 'R1.2', binding };

export default {
  title: 'Core React/R1.2/Switch',
  component: Core.Switch,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Switch family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
