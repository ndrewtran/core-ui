// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:650b319a41fe0db99068f26b4046c456a35e85a63e790e98d5e7ead3cc197275
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "closeDelay": 200,
      "defaultOpen": false,
      "delay": 600,
      "placement": "top"
    },
    "events": [
      "openChange"
    ],
    "parts": [
      "trigger",
      "root",
      "content"
    ],
    "props": [
      "children",
      "trigger",
      "delay",
      "closeDelay",
      "open",
      "defaultOpen",
      "placement",
      "onOpenChange",
      "className",
      "aria-label",
      "aria-labelledby"
    ]
  },
  "binding": "core:component:preview-trigger#web.react",
  "export": "PreviewTrigger",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-preview-trigger",
  "states": [
    "closed",
    "opening",
    "open",
    "closing"
  ],
  "strategy": "direct"
};
const record = { family: 'PreviewTrigger', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/PreviewTrigger',
  component: Core.PreviewTrigger,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned PreviewTrigger family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
