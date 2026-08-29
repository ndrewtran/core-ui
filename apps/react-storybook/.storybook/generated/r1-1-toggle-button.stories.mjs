// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:0a1b5e367289ac9c848fe08f6069165637c61564663e348b3837eb48c0addecd
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultSelected": false,
      "disabled": false,
      "selected": false
    },
    "events": [
      "change",
      "activate"
    ],
    "parts": [
      "root",
      "label"
    ],
    "props": [
      "selected",
      "defaultSelected",
      "disabled"
    ]
  },
  "binding": "core:component:toggle-button#web.react",
  "export": "ToggleButton",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-toggle-button",
  "states": [
    "idle",
    "selected",
    "disabled",
    "pressed"
  ],
  "strategy": "direct"
};
const record = { family: 'ToggleButton', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/ToggleButton',
  component: Core.ToggleButton,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ToggleButton family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
