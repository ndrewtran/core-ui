// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:a4bc1d21f3c01668fa2d0315211fabfe67ea29327e6a81484fde9d19358a3f9a
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "method": "get",
      "validationBehavior": "native"
    },
    "events": [
      "submit",
      "reset"
    ],
    "parts": [
      "root",
      "content"
    ],
    "props": [
      "validationBehavior",
      "method",
      "action",
      "onSubmit",
      "onReset"
    ]
  },
  "binding": "muxui:component:form#web.react",
  "export": "Form",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-form",
  "states": [
    "idle",
    "submitting",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'Form', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/Form',
  id: 'muxui-react-r1-2-form',
  component: MuxUI.Form,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned Form family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
