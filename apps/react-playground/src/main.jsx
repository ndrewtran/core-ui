import React from 'react';
import { createRoot } from 'react-dom/client';
import { R1ButtonFixture } from '../../../packages/react/src/button-fixture.mjs';
import '@core-ui/react/styles.css';

const profiles = [
  ['light', 'standard', 'full', 'comfortable', 'ltr'],
  ['dark', 'standard', 'full', 'comfortable', 'ltr'],
  ['light', 'more', 'full', 'comfortable', 'ltr'],
  ['light', 'standard', 'reduced', 'comfortable', 'ltr'],
  ['light', 'standard', 'full', 'compact', 'ltr'],
  ['light', 'standard', 'full', 'comfortable', 'rtl'],
];

createRoot(document.querySelector('#root')).render(React.createElement('main', null,
  React.createElement('h1', null, 'Core UI React R1.0 baseline'),
  profiles.map(([colorScheme, contrast, motion, density, direction]) => React.createElement('section', {
    key: [colorScheme, contrast, motion, density, direction].join('-'),
    'data-profile': [colorScheme, contrast, motion, density, direction].join('/'),
    'data-core-color-scheme': colorScheme,
    'data-core-contrast': contrast,
    'data-core-motion': motion,
    'data-core-density': density,
    'data-core-direction': direction,
  },
  React.createElement('h2', null, `${colorScheme} · ${contrast} · ${motion} · ${density} · ${direction}`),
  React.createElement(R1ButtonFixture),
  React.createElement(R1ButtonFixture, { disabled: true }),
  React.createElement(R1ButtonFixture, { pending: true }),
  )),
));
