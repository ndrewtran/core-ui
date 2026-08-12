import { createElement } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  Text,
  View,
} from 'react-native';
import { deriveControlState } from '@core-ui/foundation/logic';

const PRIMITIVES = Object.freeze({ pressable: Pressable, text: Text, view: View });
const PASSTHROUGH = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'accessible',
  'hitSlop',
  'nativeID',
  'onLayout',
  'style',
  'testID',
]);

function closedObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`CORE_REACT_NATIVE_INPUT_INVALID: ${label}`);
  }
  return value;
}

export function filterNativePassthrough(value = {}) {
  closedObject(value, 'passthrough must be an object');
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (!PASSTHROUGH.has(key)) {
      throw new TypeError(`CORE_REACT_NATIVE_PASSTHROUGH_INVALID: ${key}`);
    }
    result[key] = value[key];
  }
  return Object.freeze(result);
}

export function createNativeAccessibilityProps({
  role,
  disabled = false,
  value,
  actions = [],
  onAction,
} = {}) {
  if (typeof role !== 'string' || role.length === 0 || typeof disabled !== 'boolean'
    || !Array.isArray(actions)) {
    throw new TypeError('CORE_REACT_NATIVE_ACCESSIBILITY_INVALID');
  }
  if (actions.some((action) => !action || typeof action !== 'object' || Array.isArray(action)
    || typeof action.name !== 'string' || action.name.length === 0
    || (action.label !== undefined && typeof action.label !== 'string'))
    || new Set(actions.map(({ name }) => name)).size !== actions.length) {
    throw new TypeError('CORE_REACT_NATIVE_ACCESSIBILITY_INVALID: actions');
  }
  if ((actions.length > 0 && typeof onAction !== 'function')
    || (actions.length === 0 && onAction !== undefined)) {
    throw new TypeError('CORE_REACT_NATIVE_ACCESSIBILITY_INVALID: action handler');
  }
  const state = deriveControlState({ intent: 'action', disabled });
  const actionNames = new Set(actions.map(({ name }) => name));
  return Object.freeze({
    accessibilityActions: actions.map((action) => Object.freeze({ ...action })),
    accessibilityRole: role,
    accessibilityState: Object.freeze({ disabled: state.disabled }),
    ...(value === undefined ? {} : { accessibilityValue: Object.freeze({ text: String(value) }) }),
    ...(actions.length === 0 ? {} : {
      onAccessibilityAction(event) {
        const actionName = event?.nativeEvent?.actionName;
        if (typeof actionName !== 'string' || !actionNames.has(actionName)) {
          throw new TypeError('CORE_REACT_NATIVE_ACCESSIBILITY_INVALID: unknown action');
        }
        onAction(actionName, event);
      },
    }),
  });
}

export function createNativeResponderProps({ onGrant, onRelease } = {}) {
  if (onGrant !== undefined && typeof onGrant !== 'function') {
    throw new TypeError('CORE_REACT_NATIVE_RESPONDER_INVALID: onGrant');
  }
  if (onRelease !== undefined && typeof onRelease !== 'function') {
    throw new TypeError('CORE_REACT_NATIVE_RESPONDER_INVALID: onRelease');
  }
  let owner = false;
  return Object.freeze({
    onResponderGrant(event) {
      owner = true;
      onGrant?.(event);
    },
    onResponderRelease(event) {
      if (!owner) throw new TypeError('CORE_REACT_NATIVE_RESPONDER_INVALID: release without ownership');
      owner = false;
      onRelease?.(event);
    },
    onStartShouldSetResponder() {
      return true;
    },
  });
}

export function composeNativePrimitive({
  primitive,
  passthrough = {},
  accessibility = {},
  responder = {},
  children,
} = {}) {
  const Component = PRIMITIVES[primitive];
  if (!Component) throw new TypeError(`CORE_REACT_NATIVE_PRIMITIVE_INVALID: ${primitive}`);
  closedObject(accessibility, 'accessibility must be an object');
  closedObject(responder, 'responder must be an object');
  return createElement(
    Component,
    { ...filterNativePassthrough(passthrough), ...accessibility, ...responder },
    children,
  );
}

export function announceNative(message) {
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new TypeError('CORE_REACT_NATIVE_ANNOUNCEMENT_INVALID');
  }
  AccessibilityInfo.announceForAccessibility(message);
}

export function focusNative(ref) {
  if (!ref || typeof ref.focus !== 'function') {
    throw new TypeError('CORE_REACT_NATIVE_FOCUS_INVALID');
  }
  ref.focus();
}
