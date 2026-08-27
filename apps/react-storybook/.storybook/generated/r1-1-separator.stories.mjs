// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:0900aef2e657cd24628044c729eeb9177a708da6c695e88750545269f42a7b90
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "orientation": "horizontal"
    },
    "events": [],
    "parts": [
      "root"
    ],
    "props": [
      "orientation"
    ]
  },
  "binding": "core:component:separator#web.react",
  "export": "Separator",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-separator",
  "states": [
    "horizontal",
    "vertical"
  ],
  "strategy": "direct"
};
const record = { family: 'Separator', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Separator',
  component: Core.Separator,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Separator family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
