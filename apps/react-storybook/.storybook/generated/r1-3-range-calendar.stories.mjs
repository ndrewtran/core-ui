// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:14149e72e057634fb4f6918bd8a8fca4d39b8e5cf0ba280da33388cb3095f2ad
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:range-calendar#web.react",
  "export": "RangeCalendar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-range-calendar",
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
  title: 'Mux UI React/R1.3/RangeCalendar',
  id: 'muxui-react-r1-3-range-calendar',
  component: MuxUI.RangeCalendar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned RangeCalendar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
