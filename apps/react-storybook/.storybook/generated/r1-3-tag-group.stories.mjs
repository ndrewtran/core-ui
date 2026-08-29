// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:1819db2310eaee04a61874f141bb835999bc6105f22a35589bad9cff3e55b121
import * as Core from '@core-ui/react';
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
  "binding": "core:component:tag-group#web.react",
  "export": "TagGroup",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-tag-group",
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
  title: 'Core React/R1.3/TagGroup',
  component: Core.TagGroup,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned TagGroup family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
