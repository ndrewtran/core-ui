// @generated-from: packages/catalog/catalog-sources.json
// @generated-content-sha256: sha256:5dd24329f06d456dfad691ac0ab25d44398c74ebd11caf8ff7fc7fa34f26cc4b
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
export const reactCompatibility = deepFreeze({"bindingSchemaRange":"^2.0.0","bindings":{"web.react":{"lifecycle":"experimental","platformSafetyRequirementSetDigest":"sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25","ref":"core:component:button#web.react","specRevision":"sha256:8d37bc27dcdf3d71b8662514f4178308a057770e68003299c06218a840dcc011","surface":{"artifactRef":"core:component:button","bindingRef":"core:component:button#web.react","bindingSpecRevision":"sha256:8d37bc27dcdf3d71b8662514f4178308a057770e68003299c06218a840dcc011","cascadeLayers":["core.tokens","core.components","core.utilities"],"events":["core:activate"],"lifecycle":"experimental","publicCustomProperties":["--core-component-button-background","--core-component-button-foreground"],"rootClass":".core-button","slots":["[data-core-slot=\"label\"]"],"states":["data-core-state-disabled"],"styleExport":"@core-ui/web/button.css"},"tokenRequirementSetDigest":"sha256:0c47bd2103d1f5596dfcd33c56bbd3da431cfd03e3faae93d7972d4f0329ff86"}},"package":"@core-ui/react","schema":"core-ui-renderer-compatibility-v1","sourceRevision":"sha256:579decd13cd6440e7ecf520d6318f5ba5222fb45943d76c1f6705d1fc5d071eb","styleSource":"@core-ui/web/button.css","tokenContractRange":"^2.0.0","version":"1.0.1"});
