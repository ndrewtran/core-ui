// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:24a07463bdd6ca1e257d761f3687bd8727d3981f513a42700be07733e247fda2
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false
    },
    "events": [
      "change",
      "select"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "list",
      "option"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "items",
      "value",
      "defaultValue",
      "selectedId",
      "defaultSelectedId",
      "disabled",
      "readOnly",
      "required",
      "invalid",
      "name",
      "placeholder"
    ]
  },
  "binding": "core:component:combo-box#web.react",
  "export": "ComboBox",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-combo-box",
  "states": [
    "idle",
    "focused",
    "open",
    "disabled",
    "read-only",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'ComboBox', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/ComboBox',
  component: Core.ComboBox,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned ComboBox family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
