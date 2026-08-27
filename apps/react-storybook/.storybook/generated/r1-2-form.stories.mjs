// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:df82f61bddeae8b0baaabba3cbbc6d6b7db400958f98449735add4b7c8a74481
import * as Core from '@core-ui/react';
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
  "binding": "core:component:form#web.react",
  "export": "Form",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-form",
  "states": [
    "idle",
    "submitting",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'Form', tranche: 'R1.2', binding };

export default {
  title: 'Core React/R1.2/Form',
  component: Core.Form,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Form family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
