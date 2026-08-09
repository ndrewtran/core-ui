// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:04d6d6b5c870c8140ab8c5bd08397895365bdb20cd87d1d46f016e4fbe33de5f
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"bindingSchemaRange":"^2.0.0","bindings":{"web.react":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25","ref":"core:component:button#web.react","specRevision":"sha256:19a3e2b835f4cac55859b57d8dac8265674b7cce0bde92da622f1c72f61c5bff","surface":{"artifactRef":"core:component:button","bindingRef":"core:component:button#web.react","bindingSpecRevision":"sha256:19a3e2b835f4cac55859b57d8dac8265674b7cce0bde92da622f1c72f61c5bff","cascadeLayers":["core.tokens","core.components","core.utilities"],"events":["core:activate"],"lifecycle":"experimental","publicCustomProperties":["--core-component-button-background","--core-component-button-foreground"],"rootClass":".core-button","slots":["[data-core-slot=\"label\"]"],"states":["data-core-state-disabled"],"styleExport":"@core-ui/web/button.css"},"tokenRequirementSetDigest":"sha256:8ace2cb7e8cc7c349e74b57043dee9ecfc4a172c9332befe4e8fa11c9651ebc8"}},"package":"@core-ui/react","schema":"core-ui-renderer-compatibility-v1","sourceRevision":"sha256:69fa8f0f4a1397f45218b27c014a5d7e31a62b8d8b873cf51c00dc883b6ba420","styleSource":"@core-ui/web/button.css","tokenContractRange":"^1.1.0","version":"0.0.0"});
