// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:ef62197bc7a0804e2e61ac8cf36710d85fc0bb43a85115bd32886b023855f240
import * as Core from '@core-ui/react';
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
  "binding": "core:component:toast#web.react",
  "export": "Toast",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-toast",
  "states": [
    "visible",
    "timed",
    "dismissed"
  ],
  "strategy": "direct"
};
const record = { family: 'Toast', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/Toast',
  component: Core.Toast,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Toast family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
