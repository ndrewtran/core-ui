export type MuxUIWebIntegration = 'vanilla' | 'react';
export interface MuxUIWebResources {
  addDocumentListener(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean): () => void;
  acquireScrollLock(): () => void;
  setInert(element: HTMLElement): () => void;
  appendPortal(node: Node): () => void;
  restoreFocusOnRelease(element: HTMLElement): () => void;
}
export interface MuxUIWebClaim { readonly integration: MuxUIWebIntegration; destroy(): void; }
export interface MuxUIWebClaimOptions {
  integration: MuxUIWebIntegration;
  token: object | Function;
  setup?: (resources: MuxUIWebResources) => void | (() => void);
}
export class MuxUIWebOwnershipError extends Error { readonly code: string; readonly details: Readonly<Record<string, unknown>>; }
export function claimRoot(root: Element, options: MuxUIWebClaimOptions): MuxUIWebClaim;
export function connectRoot(root: Element, options: Omit<MuxUIWebClaimOptions, 'integration'>): MuxUIWebClaim;
