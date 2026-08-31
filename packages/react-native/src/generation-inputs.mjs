export function selectReactNativeGenerationInputs(catalogBundle) {
  const component = catalogBundle?.artifacts?.find(({ id }) => id === 'muxui:component:button');
  const tokenArtifact = catalogBundle?.artifacts?.find(({ id }) => id === 'muxui:token:default-theme');
  if (!component) throw new Error('MUXUI_REACT_NATIVE_GENERATION_INPUT_MISSING: muxui:component:button');
  if (!tokenArtifact) throw new Error('MUXUI_REACT_NATIVE_DEFAULT_THEME_REQUIRED: muxui:token:default-theme');
  return { component, tokenArtifact };
}
