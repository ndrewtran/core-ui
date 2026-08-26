import crosswalk from '../../../catalog/react-r1-3/donor-crosswalk.json' with { type: 'json' };

export const EXPECTED_R13_COMPONENT_SLUGS = Object.freeze([
  'calendar', 'color-area', 'color-field', 'color-picker', 'color-slider', 'color-swatch',
  'color-swatch-picker', 'color-wheel', 'combo-box', 'grid-list', 'list-box', 'menu',
  'radio-group', 'range-calendar', 'select', 'slider', 'table', 'tabs', 'tag-group',
  'toggle-button-group', 'token-field', 'toolbar', 'tree', 'virtualizer',
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const EXPECTED_R13_DONOR_CONTRACT = deepFreeze(crosswalk);
