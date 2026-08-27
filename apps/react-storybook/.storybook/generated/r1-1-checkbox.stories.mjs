// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:ddfef1738d971ef10670eceb0a82b38831cb53af1239db7a23f0a4ca5f6a8bf1
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "checked": false,
      "defaultChecked": false,
      "disabled": false,
      "indeterminate": false,
      "invalid": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "input",
      "indicator",
      "label"
    ],
    "props": [
      "checked",
      "defaultChecked",
      "disabled",
      "indeterminate",
      "name",
      "required",
      "value",
      "invalid"
    ]
  },
  "binding": "core:component:checkbox#web.react",
  "export": "Checkbox",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-checkbox",
  "states": [
    "idle",
    "selected",
    "indeterminate",
    "disabled",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'Checkbox', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Checkbox',
  component: Core.Checkbox,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Checkbox family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
