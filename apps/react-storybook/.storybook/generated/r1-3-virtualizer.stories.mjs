// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:3987eac034dc956de9f79b4e4a6327dd77c7dd4f82975c9241b7460d1c5cb5a2
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "height": 240,
      "itemHeight": 40,
      "overscan": 2
    },
    "events": [
      "scroll"
    ],
    "parts": [
      "root",
      "viewport",
      "item"
    ],
    "props": [
      "aria-label",
      "items",
      "height",
      "itemHeight",
      "overscan",
      "disabled"
    ]
  },
  "binding": "core:component:virtualizer#web.react",
  "export": "Virtualizer",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-virtualizer",
  "states": [
    "idle",
    "focused",
    "disabled",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'Virtualizer', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/Virtualizer',
  component: Core.Virtualizer,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Virtualizer family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
