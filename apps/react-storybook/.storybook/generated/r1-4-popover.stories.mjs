// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:e269e36981b0132a214d7314d1f8250f454788d63f443c4877cbaf735c9a271c
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultOpen": false,
      "dismissable": true,
      "placement": "bottom"
    },
    "events": [
      "openChange",
      "dismiss"
    ],
    "parts": [
      "trigger",
      "root",
      "content"
    ],
    "props": [
      "children",
      "trigger",
      "open",
      "defaultOpen",
      "dismissable",
      "placement",
      "onOpenChange",
      "className",
      "aria-label",
      "aria-labelledby"
    ]
  },
  "binding": "core:component:popover#web.react",
  "export": "Popover",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-popover",
  "states": [
    "closed",
    "open",
    "focused",
    "dismissed"
  ],
  "strategy": "direct"
};
const record = { family: 'Popover', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/Popover',
  component: Core.Popover,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Popover family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
