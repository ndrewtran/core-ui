export class GenerationProofError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'GenerationProofError';
    this.code = code;
  }
}

export function verifyGenerationState({
  beforeDigest,
  firstDigest,
  secondDigest,
  firstStatus,
  secondStatus,
}) {
  if (firstStatus.trim()) {
    throw new GenerationProofError(
      'GENERATION_WORKTREE_DIRTY',
      `first generation run left worktree changes: ${firstStatus.trim()}`,
    );
  }
  if (secondStatus.trim()) {
    throw new GenerationProofError(
      'GENERATION_WORKTREE_DIRTY',
      `second generation run left worktree changes: ${secondStatus.trim()}`,
    );
  }
  if (beforeDigest !== firstDigest) {
    throw new GenerationProofError(
      'GENERATION_DRIFT',
      'generation changed clean-checkout content; repair the earliest source and commit its projection',
    );
  }
  if (firstDigest !== secondDigest) {
    throw new GenerationProofError(
      'GENERATION_NONDETERMINISTIC',
      'repeated generation produced a different clean-checkout digest',
    );
  }
}
