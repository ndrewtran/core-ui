// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:8bf21bce8487432790391d30671e19ed4f86e6f55d204cb87793b9bff1f3a4cd
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:separator#web.react",
  "export": "Separator",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-separator",
  "states": [
    "horizontal",
    "vertical"
  ],
  "strategy": "direct"
};
const record = { family: 'Separator', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/Separator',
  id: 'muxui-react-r1-1-separator',
  component: MuxUI.Separator,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Separator family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
