// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:522d6f3252e3962ff27349e6db44cd074292d78184fd352935d8553d06d0ed9f
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
      "change",
      "focusChange"
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
      "focusedValue",
      "minValue",
      "maxValue",
      "disabled",
      "readOnly",
      "required",
      "invalid"
    ]
  },
  "binding": "core:component:calendar#web.react",
  "export": "Calendar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-calendar",
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
const record = { family: 'Calendar', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/Calendar',
  component: Core.Calendar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Calendar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
