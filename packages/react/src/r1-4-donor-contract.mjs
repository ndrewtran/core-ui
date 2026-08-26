import crosswalk from '../../../catalog/react-r1-4/donor-crosswalk.json' with { type: 'json' };

export const EXPECTED_R14_COMPONENT_SLUGS = Object.freeze([
  'drop-zone', 'file-trigger', 'dialog', 'popover', 'preview-trigger', 'toast', 'tooltip',
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const EXPECTED_R14_DONOR_CONTRACT = deepFreeze(crosswalk);
