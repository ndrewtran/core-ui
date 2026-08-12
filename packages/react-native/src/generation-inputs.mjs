export function selectReactNativeGenerationInputs(catalogBundle) {
  const component = catalogBundle?.artifacts?.find(({ id }) => id === 'core:component:button');
  const tokenArtifact = catalogBundle?.artifacts?.find(({ id }) => id === 'core:token:default-theme');
  if (!component) throw new Error('CORE_REACT_NATIVE_GENERATION_INPUT_MISSING: core:component:button');
  if (!tokenArtifact) throw new Error('CORE_REACT_NATIVE_DEFAULT_THEME_REQUIRED: core:token:default-theme');
  return { component, tokenArtifact };
}
