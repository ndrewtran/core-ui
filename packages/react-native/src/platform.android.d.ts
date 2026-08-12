import type { ColorValue, PlatformColor } from 'react-native';
import type { NativeProfile } from './profiles.mjs';

export const androidProfile: Extract<NativeProfile, { profile: 'android' }>;
export function createAndroidAdaptations(input: {
  color: string;
}): Readonly<{
  direction: 'ltr' | 'rtl';
  dynamicColor: ReturnType<typeof PlatformColor> | ColorValue;
  fontScale: number;
  platformAccessibilityMapping: 'native.android';
}>;
