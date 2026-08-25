// @generated-from: packages/react/src/button.mjs
// @generated-content-sha256: sha256:d4d5a96d6a25c76c34d536cce595392b132a532ba316f95d4c8250a2e4e8ccee
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
  }, children);
});

Button.displayName = 'Button';
