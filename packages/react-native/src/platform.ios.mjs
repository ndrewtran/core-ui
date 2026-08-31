import { DynamicColorIOS, I18nManager, PixelRatio } from 'react-native';
import { assertNativeProfileSupported } from './profiles.mjs';

export const iosProfile = assertNativeProfileSupported('ios');

export function createIosAdaptations({ light, dark } = {}) {
  if (typeof light !== 'string' || typeof dark !== 'string') {
    throw new TypeError('MUXUI_REACT_NATIVE_DYNAMIC_COLOR_INVALID: ios');
  }
  return Object.freeze({
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
    dynamicColor: DynamicColorIOS({ light, dark }),
    fontScale: PixelRatio.getFontScale(),
    platformAccessibilityMapping: 'native.ios',
  });
}
