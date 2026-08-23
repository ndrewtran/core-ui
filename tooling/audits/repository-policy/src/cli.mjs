import { resolve } from 'node:path';

const HOSTILE_RUNTIME_KEYS = Object.freeze([
  'NODE_OPTIONS',
  'NODE_DEBUG',
  'NODE_PATH',
  'NODE_EXTRA_CA_CERTS',
  'LD_PRELOAD',
  'DYLD_INSERT_LIBRARIES',
]);

function assertSafeRuntimeEnvironment(environment) {
  const hostile = HOSTILE_RUNTIME_KEYS.filter((key) => typeof environment[key] === 'string' && environment[key] !== '');
  if (hostile.length > 0) throw new Error(`R1_CONTINUOUS_HOSTILE_ENV: refusing verifier imports with ${hostile.join(', ')}`);
}

const repositoryRoot = resolve(process.env.CORE_UI_REPOSITORY ?? resolve(import.meta.dirname, '../../../..'));

try {
  assertSafeRuntimeEnvironment(process.env);
  const [{ auditRepository }, { loadDeliveryProfile }, { verifyR1ContinuousExecutionWithDeliveryProfile, verifyR1ContinuousExecutionPolicyGate }] = await Promise.all([
    import('./policy.mjs'),
    import('./delivery-profile.mjs'),
    import('./r1-continuous-execution-verify.mjs'),
  ]);
  if (process.argv[2] === '--r1-operation' && typeof process.argv[3] !== 'string') throw new Error('R1_CONTINUOUS_OPERATION_MISSING: --r1-operation requires a task-local descriptor path');
  const explicitOperation = process.argv[2] === '--r1-operation' ? process.argv[3] : undefined;
  const r1 = explicitOperation
    ? { profile: 'core-ui-r1-continuous-execution-verifier-v1', mode: 'operation', status: 'passed', operationPath: explicitOperation, result: await verifyR1ContinuousExecutionWithDeliveryProfile(repositoryRoot, explicitOperation) }
    : verifyR1ContinuousExecutionPolicyGate(repositoryRoot);
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
  if (r1.mode === 'operation') {
    console.log(`[E-R1-01] deterministic operation verification passed (${r1.result.operationKind}); post-proof and ready-merge review remain external`);
  } else {
    console.log('[E-R1-01] source-inspection passed; no operation, review, or merge clearance was authorized');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
