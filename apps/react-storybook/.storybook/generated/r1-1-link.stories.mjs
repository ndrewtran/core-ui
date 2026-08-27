// @generated-from: apps/react-storybook/src/generate-stories.mjs
// @generated-content-sha256: sha256:8fb62dee78446f00475df92d46721499b883019028b6d877d42a45891d9d7682
import * as Core from '@core-ui/react';
import { argTypesForBinding, createStory } from '../../src/storybook-factory.mjs';

const binding = {
  "api": {
    "defaults": {
      "current": false,
      "disabled": false
    },
    "events": [
      "activate"
    ],
    "parts": [
      "root",
      "label"
    ],
    "props": [
      "href",
      "disabled",
      "current",
      "target",
      "rel"
    ]
  },
  "binding": "core:component:link#web.react",
  "export": "Link",
  "lifecycle": "experimental",
  "module": ".",
  "runtimeProfile": "web.react",
  "selector": ".core-link",
  "states": [
    "idle",
    "current",
    "disabled",
    "pressed"
  ],
  "strategy": "direct"
};
const record = { family: 'Link', tranche: 'R1.1', binding };

export default {
  title: 'Core React/R1.1/Link',
  component: Core.Link,
  tags: ['autodocs'],
  parameters: {
    controls: {
      include: binding.api.props,
    },
    docs: {
      description: {
        component: 'Private development showcase for the Core-owned Link family.',
      },
    },
  },
  argTypes: argTypesForBinding(binding),
};
export const Default = createStory(record, 'default');
export const States = createStory(record, 'states');
