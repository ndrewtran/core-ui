export type CoreWebIntegration = 'vanilla' | 'react';
export interface CoreWebResources {
  addDocumentListener(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean): () => void;
  acquireScrollLock(): () => void;
  setInert(element: HTMLElement): () => void;
  appendPortal(node: Node): () => void;
  restoreFocusOnRelease(element: HTMLElement): () => void;
}
export interface CoreWebClaim { readonly integration: CoreWebIntegration; destroy(): void; }
export interface CoreWebClaimOptions {
  integration: CoreWebIntegration;
  token: object | Function;
  setup?: (resources: CoreWebResources) => void | (() => void);
}
export class CoreWebOwnershipError extends Error { readonly code: string; readonly details: Readonly<Record<string, unknown>>; }
export function claimRoot(root: Element, options: CoreWebClaimOptions): CoreWebClaim;
export function connectRoot(root: Element, options: Omit<CoreWebClaimOptions, 'integration'>): CoreWebClaim;
