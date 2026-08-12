import { queryNativeProfile } from './profiles.mjs';

export const reactNativeWebProfile = queryNativeProfile('native.react-native-web');

export function createReactNativeWebAdaptations() {
  throw new TypeError('CORE_REACT_NATIVE_PROFILE_UNSUPPORTED: native.react-native-web');
}
