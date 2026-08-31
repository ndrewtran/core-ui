import { I18nManager, PixelRatio, PlatformColor } from 'react-native';
import { assertNativeProfileSupported } from './profiles.mjs';

export const androidProfile = assertNativeProfileSupported('android');

export function createAndroidAdaptations({ color } = {}) {
  if (typeof color !== 'string' || color.length === 0) {
    throw new TypeError('MUXUI_REACT_NATIVE_DYNAMIC_COLOR_INVALID: android');
  }
  return Object.freeze({
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
    dynamicColor: PlatformColor(color),
    fontScale: PixelRatio.getFontScale(),
    platformAccessibilityMapping: 'native.android',
  });
}
