import { resolve } from 'node:path';

const repositoryRoot = resolve(process.env.MUXUI_REPOSITORY ?? resolve(import.meta.dirname, '../../../..'));

try {
  const { auditRepository } = await import('./policy.mjs');
  const result = await auditRepository(repositoryRoot);
  console.log(`[E-G0.0-01] navigation and path audit passed (${result.owners} major owners)`);
  console.log(
    `[E-G0.0-03] repository policy passed (${result.generatedFiles} projections, `
      + `${result.artifacts} artifacts, ${result.claimedNames} slugs/aliases)`,
  );
  console.log(
    `[MUXUI-IDENTITY] current identity passed (${result.identity.scanned} files scanned, `
      + `${result.identity.allowlisted} retained files allowlisted)`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
