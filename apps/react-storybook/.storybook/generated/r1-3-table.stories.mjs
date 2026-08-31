// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1baab737d49ccf0434ec9a4dc1ffd19e8fae4fd224967f361221c9d93dee88c0
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "selectionMode": "none"
    },
    "events": [
      "selectionChange",
      "rowAction"
    ],
    "parts": [
      "root",
      "header",
      "column",
      "body",
      "row",
      "cell"
    ],
    "props": [
      "aria-label",
      "columns",
      "rows",
      "selectedIds",
      "defaultSelectedIds",
      "disabled",
      "selectionMode"
    ]
  },
  "binding": "muxui:component:table#web.react",
  "export": "Table",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-table",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'Table', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/Table',
  id: 'muxui-react-r1-3-table',
  component: MuxUI.Table,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Table family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
