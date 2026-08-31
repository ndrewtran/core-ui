// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:fc4ae80cdb08468638b0e390b65e6ef772fbe1f9a3dddaa0283ae1d7c625b2a2
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false
    },
    "events": [
      "remove",
      "action"
    ],
    "parts": [
      "root",
      "label",
      "list",
      "tag",
      "remove"
    ],
    "props": [
      "label",
      "aria-label",
      "aria-labelledby",
      "items",
      "disabled"
    ]
  },
  "binding": "muxui:component:tag-group#web.react",
  "export": "TagGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-tag-group",
  "states": [
    "idle",
    "focused",
    "disabled",
    "selected",
    "empty"
  ],
  "strategy": "direct"
};
const record = { family: 'TagGroup', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/TagGroup',
  id: 'muxui-react-r1-3-tag-group',
  component: MuxUI.TagGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned TagGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
