#!/usr/bin/env node
import { canonicalJson, sha256Digest } from '@core-ui/schema';
import { evaluateDeliveryInvocation } from './delivery-conformance.mjs';
import { deriveDeliveryHandoff } from './delivery-handoff.mjs';
import { DeliveryWorkflowError, validateDeliverySchema } from './delivery-profile.mjs';

const OUTPUT_PROFILE = 'core-ui-delivery-advisory-output-v1';
const ADMITTED_DIAGNOSTICS = new Set([
  'DELIVERY_ADVISORY_ARGUMENT_INVALID',
  'DELIVERY_ADVISORY_INTERNAL',
  'DELIVERY_CONFORMANCE_INVALID',
  'DELIVERY_HANDOFF_INVALID',
  'DELIVERY_INPUT_BOUNDS_EXCEEDED',
  'DELIVERY_INVOCATION_INVALID',
  'DELIVERY_INVOCATION_STALE',
  'DELIVERY_INVOCATION_UNSAFE',
  'DELIVERY_PACKET_INVALID',
  'DELIVERY_SCHEMA_INVALID',
]);

function diagnostic(error) {
  const admitted = error instanceof DeliveryWorkflowError && ADMITTED_DIAGNOSTICS.has(error.code)
    ? error.code
    : 'DELIVERY_ADVISORY_INTERNAL';
  return `${canonicalJson({ code: admitted, message: error.message, profile: 'core-ui-delivery-advisory-diagnostic-v1' })}\n`;
}

export async function runDeliveryAdvisory({ repositoryRoot, invocationPath }) {
  const evaluation = await evaluateDeliveryInvocation(repositoryRoot, invocationPath);
  const handoff = deriveDeliveryHandoff(evaluation.contract, evaluation);
  const payload = {
    conformanceIdentity: evaluation.identity,
    failedRuleIds: evaluation.payload.failedRuleIds,
    handoffIdentity: handoff.identity,
    nonDispatchRewindOperation: evaluation.payload.status === 'satisfied'
      ? null
      : handoff.payload.nextOperationId,
    packetIdentity: evaluation.packet.envelope,
    profile: OUTPUT_PROFILE,
    repositorySource: evaluation.invocation.repositorySource,
    status: evaluation.payload.status,
  };
  validateDeliverySchema(evaluation.contract.schema.$defs.advisoryOutput, payload, {
    rootSchema: evaluation.contract.schema,
    schemaAt: '/$defs/advisoryOutput',
  });
  const stdout = `${canonicalJson(payload)}\n`;
  return {
    exitCode: payload.status === 'satisfied' ? 0 : 1,
    identity: {
      algorithm: 'sha256',
      byteLength: Buffer.byteLength(stdout),
      digest: sha256Digest(stdout),
      id: `delivery-advisory-${sha256Digest(stdout).slice(-16)}`,
      profile: OUTPUT_PROFILE,
    },
    payload,
    stderr: '',
    stdout,
  };
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--invocation' || !argv[1]) {
    throw new DeliveryWorkflowError('DELIVERY_ADVISORY_ARGUMENT_INVALID', 'usage: delivery-advisory.mjs --invocation <manifest.json>');
  }
  return argv[1];
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const invocationPath = parseArguments(process.argv.slice(2));
    const result = await runDeliveryAdvisory({ repositoryRoot: process.cwd(), invocationPath });
    process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(diagnostic(error));
    process.exitCode = 2;
  }
}

export { OUTPUT_PROFILE };
