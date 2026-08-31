// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:190ea22e9d7ca40a2e720555e13438525debfce85faf3ffc7df2cfed536855f2
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "duration": 5000,
      "variant": "neutral"
    },
    "events": [
      "dismiss"
    ],
    "parts": [
      "region",
      "toast",
      "title",
      "message",
      "dismiss"
    ],
    "props": [
      "message",
      "title",
      "variant",
      "duration",
      "onDismiss",
      "className"
    ]
  },
  "binding": "muxui:component:toast#web.react",
  "export": "Toast",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-toast",
  "states": [
    "visible",
    "timed",
    "dismissed"
  ],
  "strategy": "direct"
};
const record = { family: 'Toast', tranche: 'R1.4', binding };

export default {
  title: 'Mux UI React/R1.4/Toast',
  id: 'muxui-react-r1-4-toast',
  component: MuxUI.Toast,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Toast family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
