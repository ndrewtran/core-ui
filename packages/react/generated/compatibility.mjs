// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:90d1e97a41bee0e0c234f355c9d4eea74a7df1d491f9548bfc02884850823a35
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"bindingSchemaRange":"^2.0.0","bindings":{"web.react":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25","ref":"core:component:button#web.react","specRevision":"sha256:cd6648ebe15200e42afbde6c65c56ca4a21a3e5c17d1ec1d3c2735d7e2baf256","surface":{"artifactRef":"core:component:button","bindingRef":"core:component:button#web.react","bindingSpecRevision":"sha256:cd6648ebe15200e42afbde6c65c56ca4a21a3e5c17d1ec1d3c2735d7e2baf256","cascadeLayers":["core.tokens","core.components","core.utilities"],"events":["core:activate"],"lifecycle":"experimental","publicCustomProperties":["--core-component-button-background","--core-component-button-foreground"],"rootClass":".core-button","slots":["[data-core-slot=\"label\"]"],"states":["data-core-state-disabled"],"styleExport":"@core-ui/web/button.css"},"tokenRequirementSetDigest":"sha256:87e940788e2aa5ad5851efbb06abae0e281dc9d958b82226ff7511fc185ab366"}},"package":"@core-ui/react","schema":"core-ui-renderer-compatibility-v1","sourceRevision":"sha256:52e10ea1c0c2648e4e4c6395d9200acace353f806ab995d5fd091ff757ef6ef9","styleSource":"@core-ui/web/button.css","tokenContractRange":"^1.1.0","version":"0.0.0"});
