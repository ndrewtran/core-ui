import { semanticState } from '../semantic/index.mjs';

export function deriveControlState(input) {
  const state = semanticState(input);
  return Object.freeze({
    ...state,
    actionable: !state.disabled,
    validation: state.invalid ? 'invalid' : 'valid',
  });
}

export function deriveFormSummary(controls) {
  if (!Array.isArray(controls)) throw new TypeError('CORE_FORM_CONTROLS_INVALID');
  const states = controls.map(deriveControlState);
  return Object.freeze({
    valid: states.every(({ invalid }) => !invalid),
    actionable: states.every(({ disabled }) => !disabled),
    requiredCount: states.filter(({ required }) => required).length,
  });
}
