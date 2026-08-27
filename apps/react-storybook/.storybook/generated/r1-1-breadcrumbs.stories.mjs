// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:ae9c14d8eb750e832eab74b05d5fc58db1b60a5256d28e66682a8e8ec05583fb
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "aria-label": "Breadcrumbs",
      "items": []
    },
    "events": [
      "navigate"
    ],
    "parts": [
      "root",
      "list",
      "item",
      "link"
    ],
    "props": [
      "items",
      "aria-label"
    ]
  },
  "binding": "core:component:breadcrumbs#web.react",
  "export": "Breadcrumbs",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-breadcrumbs",
  "states": [
    "idle",
    "disabled",
    "current"
  ],
  "strategy": "direct"
};
const record = { family: 'Breadcrumbs', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Breadcrumbs',
  component: Core.Breadcrumbs,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Breadcrumbs family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
