import type { GestureResponderEvent, ViewProps } from 'react-native';
import {
  assertNativeProfileSupported,
  createNativeAccessibilityProps,
  createNativeResponderProps,
  nativeProfileProjection,
  nativeProfiles,
  queryNativeProfile,
  type NativeAccessibilityProps,
  type NativeResponderProps,
} from '@muxui/react-native';
import { androidProfile } from '@muxui/react-native/android';
import { iosProfile } from '@muxui/react-native/ios';
import { nativeProfileProjection as subpathProjection } from '@muxui/react-native/profiles';
import { nativeThemeProjection } from '@muxui/react-native/theme';

const exactAndroid: 'android' = androidProfile.profile;
const exactIos: 'ios' = iosProfile.profile;
const exactQuery: 'android' = queryNativeProfile('android').profile;
const exactSupported: 'ios' = assertNativeProfileSupported('ios').profile;
const sameProjection: typeof nativeProfileProjection = subpathProjection;
void [exactAndroid, exactIos, exactQuery, exactSupported, sameProjection, nativeProfiles, nativeThemeProjection];

const accessibility = createNativeAccessibilityProps({
  role: 'button',
  disabled: false,
  actions: [{ name: 'activate', label: 'Activate' }],
  onAction(actionName, event) {
    const exactName: string = actionName;
    const exactEvent: NonNullable<ViewProps['onAccessibilityAction']> = () => {
      void event.nativeEvent.actionName;
    };
    void exactName;
    void exactEvent;
  },
});
const accessibilitySurface: NativeAccessibilityProps = accessibility;
void accessibilitySurface;
const hostAccessibility: ViewProps = accessibility;
const exactHandler: NonNullable<ViewProps['onAccessibilityAction']> = accessibility.onAccessibilityAction;
void exactHandler;
void hostAccessibility;

const responders: NativeResponderProps = createNativeResponderProps({
  onGrant(event) {
    const exact: GestureResponderEvent = event;
    void exact;
  },
  onRelease(event) {
    const exact: GestureResponderEvent = event;
    void exact;
  },
});
const hostResponders: ViewProps = responders;
void hostResponders;

// @ts-expect-error invalid is not a React Native AccessibilityState field
createNativeAccessibilityProps({ role: 'button', invalid: true });

// @ts-expect-error required is not a React Native AccessibilityState field
createNativeAccessibilityProps({ role: 'button', required: true });

// @ts-expect-error an action list requires a handler
createNativeAccessibilityProps({ role: 'button', actions: [{ name: 'activate' }] });

// @ts-expect-error a handler requires a non-empty action list
createNativeAccessibilityProps({ role: 'button', onAction() {} });

// @ts-expect-error an empty action list cannot claim an action handler
createNativeAccessibilityProps({ role: 'button', actions: [], onAction() {} });

// @ts-expect-error primitive composition is package-internal, not a public consumer API
import { composeNativePrimitive } from '@muxui/react-native';
void composeNativePrimitive;
