// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:a5cc7732029832e078cf9922577658b90ea5fd71384a84a9e36e53d2bb6b4744
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "orientation": "horizontal"
    },
    "events": [],
    "parts": [
      "root",
      "control"
    ],
    "props": [
      "aria-label",
      "aria-labelledby",
      "orientation",
      "disabled"
    ]
  },
  "binding": "core:component:toolbar#web.react",
  "export": "Toolbar",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-toolbar",
  "states": [
    "idle",
    "focused",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'Toolbar', tranche: 'R1.3', binding };

export default {
  title: 'Core React/R1.3/Toolbar',
  component: Core.Toolbar,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Toolbar family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
