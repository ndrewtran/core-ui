// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:e98a541caabd895ae6fa3506d3ad01af7062391b64e372a35ff143b0c0e22a08
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "selectionMode": "single"
    },
    "events": [
      "selectionChange",
      "action"
    ],
    "parts": [
      "root",
      "item"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "items",
      "selectedIds",
      "defaultSelectedIds",
      "disabled",
      "selectionMode"
    ]
  },
  "binding": "core:component:grid-list#web.react",
  "export": "GridList",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-grid-list",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'GridList', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/GridList',
  component: Core.GridList,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned GridList family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
