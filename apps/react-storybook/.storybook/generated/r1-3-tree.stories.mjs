// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1030082398bc37bb183bd46fca6f7893ffdc25ee661c2a163203321215ee7316
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
      "expandedChange",
      "action"
    ],
    "parts": [
      "root",
      "item",
      "children"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "items",
      "selectedIds",
      "defaultSelectedIds",
      "expandedIds",
      "defaultExpandedIds",
      "disabled",
      "selectionMode"
    ]
  },
  "binding": "core:component:tree#web.react",
  "export": "Tree",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-tree",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected",
    "expanded",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'Tree', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/Tree',
  component: Core.Tree,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Tree family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
