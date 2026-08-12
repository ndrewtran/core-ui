import {
  AccessibilityInfo,
  DynamicColorIOS,
  I18nManager,
  PixelRatio,
  PlatformColor,
} from 'react-native';
import {
  announceNative,
  createNativeAccessibilityProps,
  createNativeResponderProps,
  focusNative,
} from '../src/index.mjs';
import { composeNativePrimitive } from '../src/runtime.mjs';
import { createAndroidAdaptations } from '../src/platform.android.mjs';
import { createIosAdaptations } from '../src/platform.ios.mjs';

describe('E-G1.2-02 production React Native JavaScript substrate', () => {
  test.each([
    ['view', 'View'],
    ['text', 'Text'],
    ['pressable', 'Pressable'],
  ])('composes the production %s primitive in the Jest native host', (primitive, expectedType) => {
    const element = composeNativePrimitive({
      primitive,
      passthrough: { testID: `fixture-${primitive}` },
      accessibility: primitive === 'pressable'
        ? createNativeAccessibilityProps({
          role: 'button',
          disabled: false,
          value: 'ready',
          actions: [{ name: 'activate' }],
          onAction: jest.fn(),
        })
        : {},
      children: primitive === 'view' ? undefined : 'Label',
    });
    expect(element.type).toBe(expectedType);
    expect(element.props.testID).toBe(`fixture-${primitive}`);
  });

  test('maps accessibility, announcements, focus, and responder ownership', () => {
    const accessibility = createNativeAccessibilityProps({
      role: 'button',
      disabled: true,
      value: 'busy',
      actions: [{ name: 'activate', label: 'Activate' }],
      onAction: jest.fn(),
    });
    expect(accessibility).toMatchObject({
      accessibilityActions: [{ name: 'activate', label: 'Activate' }],
      accessibilityRole: 'button',
      accessibilityState: { disabled: true },
      accessibilityValue: { text: 'busy' },
    });
    expect(typeof accessibility.onAccessibilityAction).toBe('function');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announceNative('Updated');
    expect(announce).toHaveBeenCalledWith('Updated');
    const focus = jest.fn();
    focusNative({ focus });
    expect(focus).toHaveBeenCalledTimes(1);
    const onGrant = jest.fn();
    const onRelease = jest.fn();
    const responders = createNativeResponderProps({ onGrant, onRelease });
    expect(responders.onStartShouldSetResponder()).toBe(true);
    responders.onResponderGrant({ id: 'grant' });
    responders.onResponderRelease({ id: 'release' });
    expect(onGrant).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  test('binds every declared accessibility action to a validated handler', () => {
    const onAction = jest.fn();
    const props = createNativeAccessibilityProps({
      role: 'button',
      actions: [{ name: 'activate', label: 'Activate' }],
      onAction,
    });
    const event = { nativeEvent: { actionName: 'activate' } };
    props.onAccessibilityAction(event);
    expect(onAction).toHaveBeenCalledWith('activate', event);
    expect(() => props.onAccessibilityAction({ nativeEvent: { actionName: 'escape' } }))
      .toThrow('CORE_REACT_NATIVE_ACCESSIBILITY_INVALID: unknown action');
    expect(() => createNativeAccessibilityProps({ role: 'button', actions: [{ name: 'activate' }] }))
      .toThrow('CORE_REACT_NATIVE_ACCESSIBILITY_INVALID: action handler');
  });

  test('observes profile-specific native-module calls without claiming native OS execution', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.25);
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: true });
    const iosColor = createIosAdaptations({ light: '#fff', dark: '#000' });
    const androidColor = createAndroidAdaptations({ color: '?attr/colorAccent' });
    expect(DynamicColorIOS).toHaveBeenCalledWith({ light: '#fff', dark: '#000' });
    expect(PlatformColor).toHaveBeenCalledWith('?attr/colorAccent');
    expect(iosColor).toMatchObject({ direction: 'rtl', fontScale: 1.25, platformAccessibilityMapping: 'native.ios' });
    expect(androidColor).toMatchObject({ direction: 'rtl', fontScale: 1.25, platformAccessibilityMapping: 'native.android' });
  });

  test('does not expose consumer switches for required native safety adaptations', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false });
    const iosColor = createIosAdaptations({
      light: '#fff',
      dark: '#000',
      dynamicColor: false,
      direction: 'rtl',
      fontScale: 0,
      platformAccessibilityMapping: null,
    });
    const androidColor = createAndroidAdaptations({
      color: '?attr/colorAccent',
      dynamicColor: false,
      direction: 'rtl',
      fontScale: 0,
      platformAccessibilityMapping: null,
    });
    expect(iosColor).toMatchObject({
      direction: 'ltr',
      fontScale: 1.5,
      platformAccessibilityMapping: 'native.ios',
    });
    expect(androidColor).toMatchObject({
      direction: 'ltr',
      fontScale: 1.5,
      platformAccessibilityMapping: 'native.android',
    });
    expect(DynamicColorIOS).toHaveBeenCalledWith({ light: '#fff', dark: '#000' });
    expect(PlatformColor).toHaveBeenCalledWith('?attr/colorAccent');
  });
});
