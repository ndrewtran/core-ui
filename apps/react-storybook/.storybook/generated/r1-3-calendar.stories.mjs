// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1ac3b11349820e2922252bd8aaf691abd8de5f67bf1c53012ae9598d15c1661e
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
  "binding": "muxui:component:calendar#web.react",
  "export": "Calendar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-calendar",
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
  title: 'Mux UI React/R1.3/Calendar',
  id: 'muxui-react-r1-3-calendar',
  component: MuxUI.Calendar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Calendar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
