export * from './runtime.d.ts';
export interface CoreWebSurface {
  readonly artifactRef: `core:component:${string}`;
  readonly bindingRef: `${CoreWebSurface['artifactRef']}#${'web.html' | 'web.react'}`;
  readonly bindingSpecRevision: `sha256:${string}`;
  readonly lifecycle: 'experimental';
  readonly rootClass: `.${string}`;
  readonly slots: readonly string[];
  readonly states: readonly string[];
  readonly events: readonly `core:${string}`[];
  readonly publicCustomProperties: readonly `--core-${string}`[];
  readonly cascadeLayers: readonly ['core.tokens', 'core.components', 'core.utilities'];
  readonly styleExport: `@core-ui/web/${string}.css`;
}
export const webSurfaces: Readonly<Record<'web.html' | 'web.react', Readonly<{ surface: CoreWebSurface }> & Record<string, unknown>>>;
export const webCompatibility: Readonly<Record<string, unknown>>;
