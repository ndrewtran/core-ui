// @generated-from: packages/react/src/generate.mjs
// @generated-content-sha256: sha256:4abb43b2b816bb7d5ddb421310b830129c24e762607647a960d4dc7c87ca2eaa
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"package":"@core-ui/react","schema":"core-ui-react-compatibility-v1","support":"baseline-only; no component export","tokenSource":{"path":"catalog/tokens/default-theme.json","sha256":"cd4aca7d436ce080bed36f1358924bed0c130dacb94455dfb5eb9cf96eabdb8f"},"upstream":{"gitHead":"5ecb3333001313e83898cd07644227897e3bae1f","package":"react-aria-components","version":"1.20.0"},"version":"0.1.0-alpha.0"});
