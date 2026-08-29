// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:d758e10f4a28ea94e79b71988f06b2973a58dad51eddbe1b53b380c4be7cef13
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "shouldCloseOnSelect": true
    },
    "events": [
      "action",
      "select"
    ],
    "parts": [
      "root",
      "item"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "items",
      "disabled",
      "shouldCloseOnSelect"
    ]
  },
  "binding": "core:component:menu#web.react",
  "export": "Menu",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-menu",
  "states": [
    "idle",
    "focused",
    "disabled",
    "open"
  ],
  "strategy": "direct"
};
const record = { family: 'Menu', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/Menu',
  component: Core.Menu,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Menu family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
