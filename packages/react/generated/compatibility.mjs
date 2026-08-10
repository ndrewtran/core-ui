// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:7fcde6195ee43b8b56c4f48d4978a3425efb39aa0bb3e0f9e8a3eb32a8f3f035
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"bindingSchemaRange":"^2.0.0","bindings":{"web.react":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25","ref":"core:component:button#web.react","specRevision":"sha256:c3b4e6d587f561c8c3f51af2c5f923ba29f3fc55bc54def46b7298f7b6d66572","surface":{"artifactRef":"core:component:button","bindingRef":"core:component:button#web.react","bindingSpecRevision":"sha256:c3b4e6d587f561c8c3f51af2c5f923ba29f3fc55bc54def46b7298f7b6d66572","cascadeLayers":["core.tokens","core.components","core.utilities"],"events":["core:activate"],"lifecycle":"experimental","publicCustomProperties":["--core-component-button-background","--core-component-button-foreground"],"rootClass":".core-button","slots":["[data-core-slot=\"label\"]"],"states":["data-core-state-disabled"],"styleExport":"@core-ui/web/button.css"},"tokenRequirementSetDigest":"sha256:57240bb00b840bd300c712ca692e69728bd4047954e6a4c6db1eab7bf6c94ca7"}},"package":"@core-ui/react","schema":"core-ui-renderer-compatibility-v1","sourceRevision":"sha256:6e6f549990f9e80effd93c9be8f31766ceaeebb87900de0d633a150aec2c3771","styleSource":"@core-ui/web/button.css","tokenContractRange":"^2.0.0","version":"1.0.0"});
