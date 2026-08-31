// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:06963d4a988be13a338c1355ac9e0d5a1926b8dfdd47e3d6eaff3ebd7b0df261
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:popover#web.react",
  "export": "Popover",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-popover",
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
  title: 'Mux UI React/R1.4/Popover',
  id: 'muxui-react-r1-4-popover',
  component: MuxUI.Popover,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Popover family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
