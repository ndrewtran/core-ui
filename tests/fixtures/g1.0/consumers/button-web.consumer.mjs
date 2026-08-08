export function consumeButtonStaticWebTransform(transform, { target }) {
  if (!['web.html', 'web.react'].includes(target)) {
    throw new Error(`G1_0_ENTRY_WEB_TARGET_INVALID: ${target}`);
  }
  if (
    transform?.kind !== 'web.css.static'
    || typeof transform.css !== 'string'
    || transform.css.trim().length === 0
    || transform.runtimeSwitching !== false
    || transform.provenance?.source !== 'canonical-token-source'
    || transform.provenance?.digest?.startsWith('sha256:') !== true
  ) {
    throw new Error('G1_0_ENTRY_WEB_TRANSFORM_INVALID');
  }
  return {
    slice: 'Button',
    target,
    stylesheet: transform.css,
    sourceDigest: transform.provenance.digest,
    runtimeSwitching: 'unavailable',
  };
}
