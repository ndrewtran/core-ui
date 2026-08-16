import React, { useState } from 'react';
import { Button } from 'react-aria-components';

export function R1ButtonFixture({ disabled = false, pending = false, onPress }) {
  const [pressCount, setPressCount] = useState(0);
  return React.createElement('div', {
    'aria-busy': pending || undefined,
    'data-core-fixture-state': disabled ? 'disabled' : pending ? 'pending' : 'idle',
    'data-core-press-count': pressCount,
  }, React.createElement(Button, {
    className: 'core-r1-button',
    isDisabled: disabled,
    isPending: pending,
    'aria-busy': pending || undefined,
    'aria-disabled': pending || undefined,
    'data-core-state': pending ? 'pending' : pressCount > 0 ? 'pressed' : 'idle',
    onPress: (event) => {
      setPressCount((count) => count + 1);
      onPress?.(event);
    },
  }, pending ? 'Working' : 'Comparison action'));
}
