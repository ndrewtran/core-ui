import { useRef } from 'react';
import { useCoreRootOwnership, type CoreButtonReactHostProps } from '@core-ui/react';
import type { ButtonWebReactBinding } from '@core-ui/web/bindings';

function TypeFixture(props: CoreButtonReactHostProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useCoreRootOwnership(ref, (resources) => {
    resources.addDocumentListener('keydown', () => {});
  });
  return <button {...props} ref={ref} className="core-button" />;
}

const valid = <TypeFixture disabled aria-label="Synthetic" onActivate={() => {}} />;
void valid;

const bindingOwnedDisabled: ButtonWebReactBinding['props']['disabled'] = true;
void bindingOwnedDisabled;

// @ts-expect-error upstream/internal string is not part of the Core refinement
const invalid = <TypeFixture onActivate="activate" />;
void invalid;
