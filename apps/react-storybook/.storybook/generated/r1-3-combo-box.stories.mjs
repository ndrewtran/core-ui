// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:33bcc6475a86bd2b31d94bc16d68982882d2bab943100c91fd0dd31289d4dcac
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
      "change",
      "select"
    ],
    "parts": [
      "root",
      "label",
      "input",
      "list",
      "option"
    ],
    "props": [
      "label",
      "description",
      "errorMessage",
      "aria-label",
      "aria-labelledby",
      "items",
      "value",
      "defaultValue",
      "selectedId",
      "defaultSelectedId",
      "disabled",
      "readOnly",
      "required",
      "invalid",
      "name",
      "placeholder"
    ]
  },
  "binding": "muxui:component:combo-box#web.react",
  "export": "ComboBox",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".muxui-combo-box",
  "states": [
    "idle",
    "focused",
    "open",
    "disabled",
    "read-only",
    "invalid"
  ],
  "strategy": "direct"
};
const record = { family: 'ComboBox', tranche: 'R1.3', binding };

export default {
  title: 'Mux UI React/R1.3/ComboBox',
  id: 'muxui-react-r1-3-combo-box',
  component: MuxUI.ComboBox,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Mux UI-owned ComboBox family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
