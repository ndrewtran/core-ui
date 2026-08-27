// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:742d4921620a89cd8131f81391cf4f563418abfe54b97279110b78d28a336c6b
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultExpanded": false,
      "disabled": false,
      "expanded": false
    },
    "events": [
      "expandedChange"
    ],
    "parts": [
      "root",
      "trigger",
      "panel"
    ],
    "props": [
      "expanded",
      "defaultExpanded",
      "disabled",
      "id"
    ]
  },
  "binding": "core:component:disclosure#web.react",
  "export": "Disclosure",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-disclosure",
  "states": [
    "collapsed",
    "expanded",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'Disclosure', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Disclosure',
  component: Core.Disclosure,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Disclosure family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
