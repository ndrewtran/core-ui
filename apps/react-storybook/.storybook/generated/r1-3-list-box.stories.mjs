// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:c4efab39c4ec6d6bc8dfb34043e9b6ff303c86c7db83b9269f4afdbec2f41dc4
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
  "binding": "core:component:list-box#web.react",
  "export": "ListBox",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-list-box",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'ListBox', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/ListBox',
  component: Core.ListBox,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ListBox family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
