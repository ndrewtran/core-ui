// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:ecc0493850b740b9c66eda6f5b718449b3724dc1e4fb3967410577cd49242ee8
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [
      "selectionChange"
    ],
    "parts": [
      "root",
      "button"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "selectedIds",
      "defaultSelectedIds",
      "disabled",
      "orientation"
    ]
  },
  "binding": "core:component:toggle-button-group#web.react",
  "export": "ToggleButtonGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-toggle-button-group",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'ToggleButtonGroup', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/ToggleButtonGroup',
  component: Core.ToggleButtonGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ToggleButtonGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
