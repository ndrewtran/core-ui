const check = process.argv.includes('--check');

console.log(
  check
    ? 'No G0.0 package projections are enabled; generator check is a deterministic no-op.'
    : 'No G0.0 package projections are enabled; generation is a deterministic no-op.',
);
