// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:b7331e8d21b00009690d402faca6edc61244a17dfaf0bda82acb7582be5313f3
import * as Core from '@core-ui/react';
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
  "binding": "core:component:disclosure-group#web.react",
  "export": "DisclosureGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-disclosure-group",
  "states": [
    "idle",
    "expanded",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'DisclosureGroup', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/DisclosureGroup',
  component: Core.DisclosureGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned DisclosureGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
