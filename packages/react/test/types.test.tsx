import { useRef, type ComponentPropsWithoutRef } from 'react';
import { useCoreRootOwnership } from '@core-ui/react';

type CoreButtonHostProps = Omit<ComponentPropsWithoutRef<'button'>, 'onClick'> & {
  onActivate?: (event: CustomEvent<void>) => void;
};

function TypeFixture(props: CoreButtonHostProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useCoreRootOwnership(ref, (resources) => {
    resources.addDocumentListener('keydown', () => {});
  });
  return <button {...props} ref={ref} className="core-button" />;
}

const valid = <TypeFixture disabled aria-label="Synthetic" onActivate={() => {}} />;
void valid;

// @ts-expect-error upstream/internal string is not part of the Core refinement
const invalid = <TypeFixture onActivate="activate" />;
void invalid;
