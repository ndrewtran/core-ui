import { queryNativeProfile } from './profiles.mjs';

export const reactNativeWebProfile = queryNativeProfile('native.react-native-web');

export function createReactNativeWebAdaptations() {
  throw new TypeError('MUXUI_REACT_NATIVE_PROFILE_UNSUPPORTED: native.react-native-web');
}
