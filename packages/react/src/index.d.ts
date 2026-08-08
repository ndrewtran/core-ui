import type { RefObject } from 'react';
import type { CoreWebResources } from '@core-ui/web/runtime';

export const reactCompatibility: Readonly<Record<string, unknown>>;

export type CoreReactRootRef<ElementType extends HTMLElement = HTMLElement> = RefObject<ElementType | null>;
export function useCoreRootOwnership<ElementType extends HTMLElement = HTMLElement>(
  rootRef: CoreReactRootRef<ElementType>,
  setup?: (resources: CoreWebResources) => void | (() => void),
): void;
