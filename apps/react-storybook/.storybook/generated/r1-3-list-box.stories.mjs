// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:56da47efcadceb0d2b9d6dd3c09b2acceadf129905f2eb6d699fba64f55e5651
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
  "binding": "muxui:component:list-box#web.react",
  "export": "ListBox",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-list-box",
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
  title: 'Mux UI React/R1.3/ListBox',
  id: 'muxui-react-r1-3-list-box',
  component: MuxUI.ListBox,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ListBox family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
