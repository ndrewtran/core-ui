export {
  nativeProfileProjection,
  nativeProfiles,
} from '../generated/native-profiles.mjs';
export type {
  NativeProfile,
  NativeProfileId,
  NativeProfileProjection,
} from '../generated/native-profiles.mjs';
import type { NativeProfile, NativeProfileId } from '../generated/native-profiles.mjs';

export function queryNativeProfile<P extends NativeProfileId>(profile: P): Extract<NativeProfile, { profile: P }>;
export function assertNativeProfileSupported<P extends NativeProfileId>(profile: P): Extract<NativeProfile, { profile: P }>;
