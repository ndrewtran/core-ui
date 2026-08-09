// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:4b4d225034d70ebbf86176aba153b8413fa0a0405c4f80c8c1cbbe438f6d84bd
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"bindingSchemaRange":"^2.0.0","bindings":{"web.react":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25","ref":"core:component:button#web.react","specRevision":"sha256:cd6648ebe15200e42afbde6c65c56ca4a21a3e5c17d1ec1d3c2735d7e2baf256","surface":{"artifactRef":"core:component:button","bindingRef":"core:component:button#web.react","bindingSpecRevision":"sha256:cd6648ebe15200e42afbde6c65c56ca4a21a3e5c17d1ec1d3c2735d7e2baf256","cascadeLayers":["core.tokens","core.components","core.utilities"],"events":["core:activate"],"lifecycle":"experimental","publicCustomProperties":["--core-component-button-background","--core-component-button-foreground"],"rootClass":".core-button","slots":["[data-core-slot=\"label\"]"],"states":["data-core-state-disabled"],"styleExport":"@core-ui/web/button.css"},"tokenRequirementSetDigest":"sha256:87e940788e2aa5ad5851efbb06abae0e281dc9d958b82226ff7511fc185ab366"}},"package":"@core-ui/react","schema":"core-ui-renderer-compatibility-v1","sourceRevision":"sha256:8daba3efee87302e3ac95fc030453ac218536bc1b489b464830ac56bdc62bdab","styleSource":"@core-ui/web/button.css","tokenContractRange":"^1.1.0","version":"0.0.0"});
