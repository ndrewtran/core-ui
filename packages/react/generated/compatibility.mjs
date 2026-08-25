// @generated-from: packages/react/src/generate.mjs
// @generated-content-sha256: sha256:535bd0e84af580c30c5a76fa8cf55bb8d4c88859e4074fc70434d0791dca44ae
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"package":"@core-ui/react","schema":"core-ui-react-compatibility-v1","support":"unproved; Button export only","tokenSource":{"path":"catalog/tokens/default-theme.json","sha256":"cd4aca7d436ce080bed36f1358924bed0c130dacb94455dfb5eb9cf96eabdb8f"},"upstream":{"gitHead":"5ecb3333001313e83898cd07644227897e3bae1f","package":"react-aria-components","version":"1.20.0"},"version":"0.1.0-alpha.0"});
