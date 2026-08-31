// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:ccfc1e1da43676b6c4862bb7ad891aad5f1d618e5b56703b247471592079e0cd
import * as MuxUI from '@muxui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "disabled": false,
      "invalid": false,
      "readOnly": false,
      "required": false
    },
    "events": [
      "change"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "segment",
      "description",
      "error"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "value",
      "defaultValue",
      "disabled",
      "readOnly",
      "required",
      "invalid",
      "name"
    ]
  },
  "binding": "muxui:component:date-field#web.react",
  "export": "DateField",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-date-field",
  "states": [
    "idle",
    "disabled",
    "readonly",
    "required",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'DateField', tranche: 'R1.2', binding };

export default {
  title: 'Mux UI React/R1.2/DateField',
  id: 'muxui-react-r1-2-date-field',
  component: MuxUI.DateField,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned DateField family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
