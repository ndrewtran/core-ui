export { nativeProfileProjection } from '../generated/native-profiles.mjs';
import { nativeProfileProjection } from '../generated/native-profiles.mjs';

export const nativeProfiles = nativeProfileProjection.profiles;

export function queryNativeProfile(profile) {
  const result = nativeProfiles[profile];
  if (!result) throw new TypeError(`CORE_REACT_NATIVE_PROFILE_INVALID: ${profile}`);
  return result;
}

export function assertNativeProfileSupported(profile) {
  const result = queryNativeProfile(profile);
  if (result.strategy === 'unsupported') {
    throw new TypeError(`CORE_REACT_NATIVE_PROFILE_UNSUPPORTED: ${profile}`);
  }
  return result;
}
