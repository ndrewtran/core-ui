export interface NativeThemeProjection {
  readonly schema: 'core-ui-react-native-theme-projection-v1';
  readonly package: '@core-ui/react-native';
  readonly componentSupportClaim: 'none';
  readonly source: Readonly<Record<string, string>>;
  readonly profiles: Readonly<Record<'ios' | 'android', Readonly<{
    profile: 'native.ios' | 'native.android';
    theme: Readonly<Record<string, unknown>>;
    themeDigest: string;
  }>>>;
}

export const nativeThemeProjection: NativeThemeProjection;
export const nativeThemes: NativeThemeProjection['profiles'];
