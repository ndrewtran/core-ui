function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function slugFromArtifactRef(artifactRef) {
  const match = /^core:component:([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(artifactRef);
  if (!match) throw new Error(`CORE_WEB_SURFACE_ARTIFACT_INVALID: ${artifactRef}`);
  return match[1];
}

function hookName(tokenId) {
  return `--core-${tokenId.replaceAll('.', '-')}`;
}

export function compileWebSurface({ artifact, bindingId, packageExports, tokenSource }) {
  const binding = artifact?.record?.bindings?.[bindingId];
  if (!binding || !['web.html', 'web.react'].includes(bindingId)) {
    throw new Error(`CORE_WEB_SURFACE_BINDING_MISSING: ${artifact?.id ?? 'unknown'}#${bindingId}`);
  }
  const slug = slugFromArtifactRef(artifact.id);
  const styleExport = `./${slug}.css`;
  if (!packageExports.includes(styleExport)) {
    throw new Error(`CORE_WEB_SURFACE_EXPORT_MISSING: ${styleExport}`);
  }
  const booleanProps = Object.entries(binding.api.defaults)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([prop]) => prop)
    .sort(compareText);
  const publicCustomProperties = binding.tokenRecipe.requirements
    .filter(({ token }) => tokenSource.tokens[token]?.overridePolicy === 'instance')
    .map(({ token }) => hookName(token))
    .sort(compareText);
  return Object.freeze({
    artifactRef: artifact.id,
    bindingRef: `${artifact.id}#${bindingId}`,
    bindingSpecRevision: artifact.bindingSpecRevisions[bindingId],
    lifecycle: binding.lifecycle,
    rootClass: `.core-${slug}`,
    slots: Object.freeze(binding.api.parts.filter((part) => part !== 'root').sort(compareText)
      .map((part) => `[data-core-slot=\"${part}\"]`)),
    states: Object.freeze(booleanProps.map((prop) => `data-core-state-${prop}`)),
    events: Object.freeze([...binding.api.events].sort(compareText).map((event) => `core:${event}`)),
    publicCustomProperties: Object.freeze(publicCustomProperties),
    cascadeLayers: Object.freeze(['core.tokens', 'core.components', 'core.utilities']),
    styleExport: `@core-ui/web/${slug}.css`,
  });
}
