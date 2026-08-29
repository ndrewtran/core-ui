// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:6d0f730a6312e181294d984eaebd4a18b294f23c1b7abfd9bd73f421d8d95a5a
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "list",
      "tab",
      "panels",
      "panel"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "items",
      "value",
      "defaultValue",
      "disabled",
      "orientation"
    ]
  },
  "binding": "core:component:tabs#web.react",
  "export": "Tabs",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-tabs",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'Tabs', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/Tabs',
  component: Core.Tabs,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Tabs family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
