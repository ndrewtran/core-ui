import React from 'react';
import { Button as AriaButton } from 'react-aria-components';

/**
 * Core's Button is an immediate-action control. The React Aria primitive is
 * deliberately kept behind this boundary so the public package can replace
 * its substrate without changing the Core contract.
 */
export const Button = React.forwardRef(function Button({
  children,
  className,
  disabled = false,
  pending = false,
  onActivate,
  type = 'button',
  'aria-busy': ariaBusy,
  ...props
}, ref) {
  const handlePress = (event) => {
    const activation = {
      type: 'activate',
      pointerType: event.pointerType,
      target: event.target,
    };
    onActivate?.(activation);
  };

  const content = React.createElement('span', {
    className: 'core-button-content',
  }, children);
  const spinner = pending ? React.createElement('svg', {
    className: 'core-button-spinner',
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true',
  }, React.createElement('circle', {
    className: 'core-button-spinner-track', cx: '12', cy: '12', r: '10', strokeWidth: '3',
  }), React.createElement('circle', {
    className: 'core-button-spinner-arc', cx: '12', cy: '12', r: '10', strokeWidth: '3', strokeLinecap: 'round',
  })) : null;
  return React.createElement(AriaButton, {
    ...props,
    ref,
    type,
    className: ['core-button', className].filter(Boolean).join(' '),
    isDisabled: disabled,
    isPending: pending,
    render: (domProps) => React.createElement('button', {
      ...domProps,
      'aria-busy': pending || ariaBusy || undefined,
    }),
    onPress: handlePress,
  }, content, spinner);
});

Button.displayName = 'Button';
