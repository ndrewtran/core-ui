const check = process.argv.includes('--check');

console.log(
  check
    ? 'Repository-policy package owns no projections; generator check is a deterministic no-op.'
    : 'Repository-policy package owns no projections; generation is a deterministic no-op.',
);
