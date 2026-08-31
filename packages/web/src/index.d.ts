export * from './runtime.d.ts';
export interface MuxUIWebSurface {
  readonly artifactRef: `muxui:component:${string}`;
  readonly bindingRef: `${MuxUIWebSurface['artifactRef']}#${'web.html' | 'web.react'}`;
  readonly bindingSpecRevision: `sha256:${string}`;
  readonly lifecycle: 'experimental';
  readonly rootClass: `.${string}`;
  readonly slots: readonly string[];
  readonly states: readonly string[];
  readonly events: readonly `muxui:${string}`[];
  readonly publicCustomProperties: readonly `--muxui-${string}`[];
  readonly cascadeLayers: readonly ['muxui.tokens', 'muxui.components', 'muxui.utilities'];
  readonly styleExport: `@muxui/web/${string}.css`;
}
export const webSurfaces: Readonly<Record<'web.html' | 'web.react', Readonly<{ surface: MuxUIWebSurface }> & Record<string, unknown>>>;
export const webCompatibility: Readonly<Record<string, unknown>>;
