// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:9188ca08672d91afacde58d3bc9d023efcdc0aaf93ff9927778bf4d58be2691f
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultExpandedIds": [],
      "disabled": false,
      "expandedIds": [],
      "multiple": true
    },
    "events": [
      "expandedChange"
    ],
    "parts": [
      "root",
      "disclosure"
    ],
    "props": [
      "expandedIds",
      "defaultExpandedIds",
      "multiple",
      "disabled"
    ]
  },
  "binding": "muxui:component:disclosure-group#web.react",
  "export": "DisclosureGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-disclosure-group",
  "states": [
    "idle",
    "expanded",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'DisclosureGroup', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/DisclosureGroup',
  id: 'muxui-react-r1-1-disclosure-group',
  component: MuxUI.DisclosureGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned DisclosureGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
