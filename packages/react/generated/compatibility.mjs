// @generated-from: packages/react/src/generate.mjs
// @generated-content-sha256: sha256:059670f54550e75844b4f5d79a52b9a521a586f19bd74fe2fd89dcd319bd207a
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"package":"@core-ui/react","schema":"core-ui-react-compatibility-v1","support":"unproved; R1.4 React exports only","tokenSource":{"path":"catalog/tokens/default-theme.json","sha256":"cd4aca7d436ce080bed36f1358924bed0c130dacb94455dfb5eb9cf96eabdb8f"},"upstream":{"gitHead":"5ecb3333001313e83898cd07644227897e3bae1f","package":"react-aria-components","version":"1.20.0"},"version":"0.1.0-alpha.0"});
