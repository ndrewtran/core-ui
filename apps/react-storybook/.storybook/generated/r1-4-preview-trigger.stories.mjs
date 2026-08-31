// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:aad7e8f7db81bf8625bd7f3e2aaccf58cce29dfe58a5c770a9ceb1fc547a913e
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:preview-trigger#web.react",
  "export": "PreviewTrigger",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-preview-trigger",
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
  title: 'Mux UI React/R1.4/PreviewTrigger',
  id: 'muxui-react-r1-4-preview-trigger',
  component: MuxUI.PreviewTrigger,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned PreviewTrigger family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
