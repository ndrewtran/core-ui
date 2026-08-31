// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:17bc27e50b8429144070295bce71ba83f5239d8127d5a3c747b9e64b7631d643
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "maxValue": 100,
      "minValue": 0,
      "value": 0
    },
    "events": [],
    "parts": [
      "root",
      "label",
      "track",
      "fill"
    ],
    "props": [
      "value",
      "minValue",
      "maxValue",
      "label",
      "formatOptions"
    ]
  },
  "binding": "muxui:component:meter#web.react",
  "export": "Meter",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-meter",
  "states": [
    "idle",
    "low",
    "high"
  ],
  "strategy": "direct"
};
const record = { family: 'Meter', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/Meter',
  id: 'muxui-react-r1-1-meter',
  component: MuxUI.Meter,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Meter family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
