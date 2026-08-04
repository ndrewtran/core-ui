import { resolve } from 'node:path';
import { auditRepository } from './policy.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

try {
  const result = await auditRepository(repositoryRoot);
  console.log(
    `[E-G0.0-01] navigation and path audit passed (${result.owners} major owners)`,
  );
  console.log(
    `[E-G0.0-03] repository policy passed (${result.generatedFiles} projections, `
      + `${result.artifacts} artifacts, ${result.claimedNames} slugs/aliases)`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
