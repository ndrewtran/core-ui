import type {
  AccessibilityActionEvent,
  AccessibilityActionInfo,
  AccessibilityRole,
  GestureResponderEvent,
  ViewProps,
} from 'react-native';
export {
  assertNativeProfileSupported,
  nativeProfileProjection,
  nativeProfiles,
  queryNativeProfile,
} from './profiles.mjs';
export type { NativeProfile, NativeProfileId, NativeProfileProjection } from './profiles.mjs';
export type NativeAccessibilityProps = Readonly<Pick<
  ViewProps,
  | 'accessibilityActions'
  | 'accessibilityRole'
  | 'accessibilityState'
  | 'accessibilityValue'
  | 'onAccessibilityAction'
>>;
type NativeAccessibilityBaseInput = {
  role: AccessibilityRole;
  disabled?: boolean;
  value?: unknown;
};
type NativeAccessibilityActionsInput = {
  actions: readonly [AccessibilityActionInfo, ...AccessibilityActionInfo[]];
  onAction: (actionName: string, event: AccessibilityActionEvent) => void;
};
type NativeAccessibilityNoActionsInput = {
  actions?: undefined;
  onAction?: undefined;
};
export function createNativeAccessibilityProps(
  input: NativeAccessibilityBaseInput & NativeAccessibilityActionsInput,
): NativeAccessibilityProps & Readonly<{
  accessibilityActions: readonly AccessibilityActionInfo[];
  onAccessibilityAction: NonNullable<ViewProps['onAccessibilityAction']>;
}>;
export function createNativeAccessibilityProps(
  input: NativeAccessibilityBaseInput & NativeAccessibilityNoActionsInput,
): NativeAccessibilityProps & Readonly<{
  accessibilityActions: readonly [];
  onAccessibilityAction?: never;
}>;
export type NativeResponderProps = Readonly<Pick<
  ViewProps,
  'onResponderGrant' | 'onResponderRelease' | 'onStartShouldSetResponder'
>>;
export function createNativeResponderProps(input?: {
  onGrant?: (event: GestureResponderEvent) => void;
  onRelease?: (event: GestureResponderEvent) => void;
}): NativeResponderProps;
export function announceNative(message: string): void;
export function focusNative(ref: { focus(): void }): void;
