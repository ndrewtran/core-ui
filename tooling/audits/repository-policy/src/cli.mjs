import { resolve } from 'node:path';
import { auditRepository } from './policy.mjs';
import { loadDeliveryProfile } from './delivery-profile.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

try {
  const result = await auditRepository(repositoryRoot);
  const delivery = await loadDeliveryProfile(repositoryRoot);
  console.log(
    `[E-G0.0-01] navigation and path audit passed (${result.owners} major owners)`,
  );
  console.log(
    `[E-G0.0-03] repository policy passed (${result.generatedFiles} projections, `
      + `${result.artifacts} artifacts, ${result.claimedNames} slugs/aliases)`,
  );
  console.log(
    `[E-DELIVERY-01] delivery workflow profile passed (${delivery.fields.length} fields, `
      + `${new Set(delivery.fields.map(({ domain }) => domain)).size} invalidation domains, `
      + `${delivery.owners.size} canonical owners)`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
