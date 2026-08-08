const INTENTS = new Set(['action', 'field', 'selection', 'overlay', 'form']);

export function assertSemanticIntent(value) {
  if (!INTENTS.has(value)) throw new TypeError(`CORE_SEMANTIC_INTENT_INVALID: ${value}`);
  return value;
}

export function semanticState({ intent, disabled = false, invalid = false, required = false }) {
  return Object.freeze({
    intent: assertSemanticIntent(intent),
    disabled: Boolean(disabled),
    invalid: Boolean(invalid),
    required: Boolean(required),
  });
}

export const semanticIntents = Object.freeze([...INTENTS]);
