export function consumeButtonStaticNativeTransform(transform, { profile }) {
  if (!['native.ios', 'native.android'].includes(profile)) {
    throw new Error(`G1_0_ENTRY_NATIVE_PROFILE_INVALID: ${profile}`);
  }
  if (
    transform?.kind !== 'native.theme.static'
    || transform.profile !== profile
    || transform.theme === null
    || typeof transform.theme !== 'object'
    || Array.isArray(transform.theme)
    || transform.runtimeSwitching !== false
    || transform.provenance?.source !== 'canonical-token-source'
    || transform.provenance?.digest?.startsWith('sha256:') !== true
    || Object.hasOwn(transform, 'css')
    || Object.hasOwn(transform, 'cssSource')
  ) {
    throw new Error('G1_0_ENTRY_NATIVE_TRANSFORM_INVALID');
  }
  return {
    slice: 'Button',
    profile,
    theme: transform.theme,
    sourceDigest: transform.provenance.digest,
    runtimeSwitching: 'unavailable',
  };
}
