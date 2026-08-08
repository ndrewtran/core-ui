import { semanticState } from '../semantic/index.mjs';

export function deriveControlState(input) {
  const state = semanticState(input);
  return Object.freeze({
    ...state,
    actionable: !state.disabled,
    validation: state.invalid ? 'invalid' : 'valid',
  });
}
