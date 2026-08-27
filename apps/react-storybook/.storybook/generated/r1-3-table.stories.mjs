// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:e15302788a403eefa3651b4f46dfd1fb10de6582c0f6da36f61550785ce6e0da
import * as Core from '@core-ui/react';
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
  "binding": "core:component:table#web.react",
  "export": "Table",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-table",
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
  title: 'Core React/R1.3/Table',
  component: Core.Table,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Table family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
