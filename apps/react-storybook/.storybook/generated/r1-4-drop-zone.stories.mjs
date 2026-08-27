// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:52701d7449fa5f016ab716b0644a07af088a0c8a47c927da47da95bd159d3aed
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false
    },
    "events": [
      "drop",
      "activate"
    ],
    "parts": [
      "root",
      "content"
    ],
    "props": [
      "children",
      "disabled",
      "onDrop",
      "onActivate",
      "className",
      "aria-label",
      "aria-labelledby"
    ]
  },
  "binding": "core:component:drop-zone#web.react",
  "export": "DropZone",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-drop-zone",
  "states": [
    "idle",
    "drop-target",
    "focused",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'DropZone', tranche: 'R1.4', binding };

export default {
  title: 'Core React/R1.4/DropZone',
  component: Core.DropZone,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned DropZone family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
