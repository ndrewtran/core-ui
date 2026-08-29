// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:f963946a15861a2d453b55a68d82405691505cb13101c86809f62c84ad4bfbb1
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultOpen": false,
      "dismissable": true
    },
    "events": [
      "openChange",
      "dismiss"
    ],
    "parts": [
      "backdrop",
      "root",
      "title",
      "content",
      "close"
    ],
    "props": [
      "children",
      "title",
      "open",
      "defaultOpen",
      "dismissable",
      "trigger",
      "onOpenChange",
      "className",
      "aria-label",
      "aria-labelledby"
    ]
  },
  "binding": "core:component:dialog#web.react",
  "export": "Dialog",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-dialog",
  "states": [
    "closed",
    "open",
    "focused",
    "dismissed"
  ],
  "strategy": "direct"
};
const record = { family: 'Dialog', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/Dialog',
  component: Core.Dialog,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Dialog family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
