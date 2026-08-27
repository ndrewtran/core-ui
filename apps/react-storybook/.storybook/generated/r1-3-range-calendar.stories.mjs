// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:4a32d87d8b41464de28087ba648083ccf2f98653f3e7f5de4e82948fdba51ddb
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "readOnly": false,
      "required": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "grid",
      "cell"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "minValue",
      "maxValue",
      "disabled",
      "readOnly",
      "required",
      "invalid"
    ]
  },
  "binding": "core:component:range-calendar#web.react",
  "export": "RangeCalendar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-range-calendar",
  "states": [
    "idle",
    "focused",
    "disabled",
    "read-only",
    "invalid",
    "selected"
  ],
  "strategy": "direct"
};
const record = { family: 'RangeCalendar', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/RangeCalendar',
  component: Core.RangeCalendar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned RangeCalendar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
