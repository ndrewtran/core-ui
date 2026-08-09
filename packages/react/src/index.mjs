import { useEffect, useRef } from 'react';
import { claimRoot } from '@core-ui/web/runtime';

export { reactCompatibility } from '../generated/compatibility.mjs';

export function useCoreRootOwnership(rootRef, setup) {
  const tokenRef = useRef();
  if (tokenRef.current === undefined) tokenRef.current = Object.freeze({});
  const setupRef = useRef(setup);
  setupRef.current = setup;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const claim = claimRoot(root, {
      integration: 'react',
      token: tokenRef.current,
      setup: (resources) => setupRef.current?.(resources),
    });
    return () => claim.destroy();
  }, [rootRef]);
}
