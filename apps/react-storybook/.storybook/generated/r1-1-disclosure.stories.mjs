// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:7d65d6a1ae02b15141e43da1d38228d2e06054b3121a4482066ce72ab5660b5d
import * as MuxUI from '@muxui/react';
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
  "binding": "muxui:component:disclosure#web.react",
  "export": "Disclosure",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-disclosure",
  "states": [
    "collapsed",
    "expanded",
    "disabled"
  ],
  "strategy": "direct"
};
const record = { family: 'Disclosure', tranche: 'R1.1', binding };

export default {
  title: 'Mux UI React/R1.1/Disclosure',
  id: 'muxui-react-r1-1-disclosure',
  component: MuxUI.Disclosure,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Disclosure family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
