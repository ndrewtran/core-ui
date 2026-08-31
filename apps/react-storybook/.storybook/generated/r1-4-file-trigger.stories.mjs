// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:a0e2b89f04bf33d88da87fe5be552e2ea5d674f8338960c3edfefd1abf8f29f0
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:file-trigger#web.react",
  "export": "FileTrigger",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-file-trigger",
  "states": [
    "idle",
    "focused",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'FileTrigger', tranche: 'R1.4', binding };

export default {
  title: 'Mux UI React/R1.4/FileTrigger',
  id: 'muxui-react-r1-4-file-trigger',
  component: MuxUI.FileTrigger,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned FileTrigger family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
