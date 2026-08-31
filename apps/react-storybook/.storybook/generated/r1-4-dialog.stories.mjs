// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:61edea3beffb449503e26052ff5a3ae5fcc166294a110eaec017f85a7bd01667
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "defaultOpen": false,
      "dismissable": true
    },
    "events": [
      "openChange",
      "dismiss"
    ],
    "parts": [
      "backdrop",
      "root",
      "title",
      "content",
      "close"
    ],
    "props": [
      "children",
      "title",
      "open",
      "defaultOpen",
      "dismissable",
      "trigger",
      "onOpenChange",
      "className",
      "aria-label",
      "aria-labelledby"
    ]
  },
  "binding": "muxui:component:dialog#web.react",
  "export": "Dialog",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-dialog",
  "states": [
    "closed",
    "open",
    "focused",
    "dismissed"
  ],
  "strategy": "direct"
};
const record = { family: 'Dialog', tranche: 'R1.4', binding };

export default {
  title: 'Mux UI React/R1.4/Dialog',
  id: 'muxui-react-r1-4-dialog',
  component: MuxUI.Dialog,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Dialog family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
