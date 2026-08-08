import type { ComponentPropsWithoutRef, RefObject } from 'react';
import type { CoreWebResources } from '@core-ui/web/runtime';
import type { ButtonWebReactBinding } from '@core-ui/web/bindings';

export const reactCompatibility: Readonly<Record<string, unknown>>;

export type CoreReactRootRef<ElementType extends HTMLElement = HTMLElement> = RefObject<ElementType | null>;
export type CoreButtonReactHostProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'disabled' | 'onClick'
> & {
  disabled?: ButtonWebReactBinding['props']['disabled'];
  onActivate?: (event: ButtonWebReactBinding['events']['activate']) => void;
};
export function useCoreRootOwnership<ElementType extends HTMLElement = HTMLElement>(
  rootRef: CoreReactRootRef<ElementType>,
  setup?: (resources: CoreWebResources) => void | (() => void),
): void;
