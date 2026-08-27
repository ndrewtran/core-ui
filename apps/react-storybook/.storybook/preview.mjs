import React from 'react';
import * as Core from '@core-ui/react';
import '@core-ui/react/styles.css';
import './preview.css';

const colorSchemeItems = [
  { value: 'light', title: 'Light' },
  { value: 'dark', title: 'Dark' },
];

function applyColorScheme(scheme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-core-color-scheme', scheme);
  }
}

function StorySurface({ children, scheme, viewMode }) {
  const surfaceRef = React.useRef(null);

  React.useEffect(() => {
    if (viewMode !== 'story') return undefined;
    const managed = new Map();
    const isOverlayHost = (element) => element instanceof HTMLElement
      && (element.style.display === 'contents'
        || element.hasAttribute('data-overlay-container')
        || element.classList.contains('core-dialog-backdrop')
        || element.classList.contains('core-toast-region'));
    const annotateOverlayHosts = () => {
      for (const child of document.body.children) {
        if (!isOverlayHost(child) || managed.has(child)) continue;
        const originalRole = child.getAttribute('role');
        const originalLabel = child.getAttribute('aria-label');
        if (!originalRole) child.setAttribute('role', 'region');
        if (!originalLabel && !child.hasAttribute('aria-labelledby')) {
          child.setAttribute('aria-label', 'Core UI overlay');
        }
        managed.set(child, { originalRole, originalLabel });
      }
    };
    const observer = new MutationObserver(annotateOverlayHosts);
    observer.observe(document.body, { childList: true });
    annotateOverlayHosts();
    return () => {
      observer.disconnect();
      for (const [element, { originalRole, originalLabel }] of managed) {
        if (originalRole === null) {
          if (element.getAttribute('role') === 'region') element.removeAttribute('role');
        } else if (element.getAttribute('role') === 'region') {
          element.setAttribute('role', originalRole);
        }
        if (originalLabel === null) {
          if (element.getAttribute('aria-label') === 'Core UI overlay') element.removeAttribute('aria-label');
        } else if (element.getAttribute('aria-label') === 'Core UI overlay') {
          element.setAttribute('aria-label', originalLabel);
        }
      }
    };
  }, [viewMode]);

  const surfaceElement = viewMode === 'story' ? 'main' : 'div';
  return React.createElement(
    surfaceElement,
    {
      ref: surfaceRef,
      className: 'core-storybook-surface',
      'data-core-color-scheme': scheme,
    },
    children,
  );
}

/** Keep every story inside the Core toast context so the Toast family is interactive. */
export default {
  globalTypes: {
    colorScheme: {
      name: 'Color scheme',
      description: 'Choose the Core light or dark theme.',
      defaultValue: 'light',
      toolbar: {
        icon: 'contrast',
        items: colorSchemeItems,
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const scheme = context.globals?.colorScheme === 'dark' ? 'dark' : 'light';
      applyColorScheme(scheme);
      return React.createElement(
        StorySurface,
        { scheme, viewMode: context.viewMode },
        React.createElement(Core.ToastProvider, null, React.createElement(Story)),
      );
    },
  ],
  parameters: {
    controls: {
      expanded: true,
    },
    a11y: {
      test: 'error',
    },
  },
};
