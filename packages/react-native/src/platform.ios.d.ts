import type { ColorValue, DynamicColorIOS } from 'react-native';
import type { NativeProfile } from './profiles.mjs';

export const iosProfile: Extract<NativeProfile, { profile: 'ios' }>;
export function createIosAdaptations(input: {
  light: string;
  dark: string;
}): Readonly<{
  direction: 'ltr' | 'rtl';
  dynamicColor: ReturnType<typeof DynamicColorIOS> | ColorValue;
  fontScale: number;
  platformAccessibilityMapping: 'native.ios';
}>;
