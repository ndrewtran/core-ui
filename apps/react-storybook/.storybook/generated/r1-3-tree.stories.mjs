// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1b9d86837e32bbf96693863ce175aed1618babc9fa0691e5e11ff6f52155be3f
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:tree#web.react",
  "export": "Tree",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-tree",
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
  title: 'Mux UI React/R1.3/Tree',
  id: 'muxui-react-r1-3-tree',
  component: MuxUI.Tree,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Tree family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
