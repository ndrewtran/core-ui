import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalDigest } from '@core-ui/schema';
import { renderDeliveryPacket } from '../../src/delivery-packet.mjs';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import { buildAuthoredRecord, clone } from './fixtures.mjs';

function identity(records, id, profile, status) {
  const value = { profile, value: id };
  records.set(id, value);
  return {
    byteLength: Buffer.byteLength(JSON.stringify(value)),
    recordDigest: canonicalDigest(value),
    recordId: id,
    recordProfile: profile,
    ...(status ? { status } : {}),
  };
}

const notApplicable = () => ({
  byteLength: null,
  recordDigest: null,
  recordId: null,
  recordProfile: null,
  status: 'not-applicable',
});

export function registerPacketTests(repositoryRoot) {
  test('E-DELIVERY-04 renders a deterministic advisory packet without dispatch or clearance', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const { record } = buildAuthoredRecord(contract);
    const records = new Map();
    const source = identity(records, 'source', 'core-ui-git-source-identity-v1');
    const artifactSet = identity(records, 'artifacts', 'core-ui-artifact-manifest-v1', 'present');
    const body = identity(records, 'body', 'core-ui-pr-body-v1');
    const output = identity(records, 'check-output', 'core-ui-deterministic-result-v1');
    const command = contract.commands.get('check');
    const input = {
      deterministicResults: [{
        commandId: 'check',
        commandRecordDigest: command.digest,
        commandRecordId: command.id,
        commandRecordProfile: command.value.profile,
        exitState: 0,
        output,
        ownerRef: command.value.ownerRef,
      }],
      profile: 'core-ui-delivery-packet-render-input-v1',
      renderedPrBody: body,
      reviewPhase: 'pre-write-decision-review',
      reviewedObject: { artifactSet, diff: notApplicable(), evidence: notApplicable(), output: notApplicable(), source },
    };
    const first = renderDeliveryPacket(contract, record, input, { records });
    const second = renderDeliveryPacket(contract, record, input, { records });
    assert.deepEqual(first, second);
    assert.equal(first.packet.outputClassification, 'advisory-only');
    assert.equal(first.envelope.profile, 'core-ui-review-packet-v1');
    assert.equal(first.envelope.id, first.packet.id);
    assert.equal('packetId' in first.envelope, false);
    assert.equal('conformanceIdentity' in first.packet, false);
    assert.equal('dispatch' in first, false);
    assert.equal('clearance' in first, false);
  });

  test('E-DELIVERY-04 rejects phase and command ownership substitutions', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const { record } = buildAuthoredRecord(contract);
    const records = new Map();
    const source = identity(records, 'source', 'core-ui-git-source-identity-v1');
    const artifactSet = identity(records, 'artifacts', 'core-ui-artifact-manifest-v1', 'present');
    const body = identity(records, 'body', 'core-ui-pr-body-v1');
    const output = identity(records, 'check-output', 'core-ui-deterministic-result-v1');
    const command = contract.commands.get('check');
    const input = {
      deterministicResults: [{ commandId: 'check', commandRecordDigest: command.digest, commandRecordId: command.id, commandRecordProfile: command.value.profile, exitState: 0, output, ownerRef: command.value.ownerRef }],
      profile: 'core-ui-delivery-packet-render-input-v1', renderedPrBody: body, reviewPhase: 'pre-write-decision-review',
      reviewedObject: { artifactSet, diff: notApplicable(), evidence: notApplicable(), output: notApplicable(), source },
    };
    const wrongPhase = clone(input);
    wrongPhase.reviewedObject.diff = identity(records, 'diff', 'core-ui-git-diff-v1', 'present');
    assert.throws(() => renderDeliveryPacket(contract, record, wrongPhase, { records }), /DELIVERY_PACKET_INVALID/);
    const wrongCommand = clone(input);
    wrongCommand.deterministicResults[0].commandRecordDigest = `sha256:${'f'.repeat(64)}`;
    assert.throws(() => renderDeliveryPacket(contract, record, wrongCommand, { records }), /DELIVERY_PACKET_INVALID/);
    const wrongOwner = clone(input);
    wrongOwner.deterministicResults[0].ownerRef = 'repository-policy-owner';
    assert.throws(() => renderDeliveryPacket(contract, record, wrongOwner, { records }), /DELIVERY_PACKET_INVALID/);
    const wrongProfile = clone(input);
    wrongProfile.deterministicResults[0].commandRecordProfile = 'core-ui-review-packet-v1';
    assert.throws(() => renderDeliveryPacket(contract, record, wrongProfile, { records }), /DELIVERY_SCHEMA_INVALID/);
  });

  test('E-DELIVERY-04 admits every plan-required root command identity', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const { record } = buildAuthoredRecord(contract);
    const records = new Map();
    const source = identity(records, 'source', 'core-ui-git-source-identity-v1');
    const artifactSet = identity(records, 'artifacts', 'core-ui-artifact-manifest-v1', 'present');
    const body = identity(records, 'body', 'core-ui-pr-body-v1');
    const deterministicResults = ['check', 'check:all', 'generate:check'].map((commandId) => {
      const command = contract.commands.get(commandId);
      const output = identity(records, `${command.id}-output`, 'core-ui-deterministic-result-v1');
      return {
        commandId,
        commandRecordDigest: command.digest,
        commandRecordId: command.id,
        commandRecordProfile: command.value.profile,
        exitState: 0,
        output,
        ownerRef: command.value.ownerRef,
      };
    });
    const input = {
      deterministicResults,
      profile: 'core-ui-delivery-packet-render-input-v1',
      renderedPrBody: body,
      reviewPhase: 'pre-write-decision-review',
      reviewedObject: { artifactSet, diff: notApplicable(), evidence: notApplicable(), output: notApplicable(), source },
    };
    const rendered = renderDeliveryPacket(contract, record, input, { records });
    assert.deepEqual(rendered.packet.deterministicResultsDigest, canonicalDigest(deterministicResults));
  });
}
