// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:733ae15ff8f4c8a29b37311c13fb1c91bc5753e08981ee656d642e9acae497db
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "acceptDirectory": false,
      "allowsMultiple": false,
      "disabled": false
    },
    "events": [
      "select"
    ],
    "parts": [
      "root",
      "input"
    ],
    "props": [
      "children",
      "acceptedFileTypes",
      "allowsMultiple",
      "acceptDirectory",
      "defaultCamera",
      "disabled",
      "onSelect",
      "className"
    ]
  },
  "binding": "core:component:file-trigger#web.react",
  "export": "FileTrigger",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-file-trigger",
  "states": [
    "idle",
    "focused",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'FileTrigger', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/FileTrigger',
  component: Core.FileTrigger,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned FileTrigger family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
