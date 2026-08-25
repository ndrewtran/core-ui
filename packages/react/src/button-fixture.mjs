import React, { useState } from 'react';
import { Button } from './button.mjs';

export function R1ButtonFixture({ disabled = false, pending = false, onPress }) {
  const [pressCount, setPressCount] = useState(0);
  return React.createElement('div', {
    'aria-busy': pending || undefined,
    'data-core-fixture-state': disabled ? 'disabled' : pending ? 'pending' : 'idle',
    'data-core-press-count': pressCount,
  }, React.createElement(Button, {
    className: 'core-r1-button',
    disabled,
    pending,
    'data-core-state': pending ? 'pending' : pressCount > 0 ? 'pressed' : 'idle',
    onActivate: (event) => {
      setPressCount((count) => count + 1);
      onPress?.(event);
    },
  }, pending ? 'Working' : 'Comparison action'));
}
