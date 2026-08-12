import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { canonicalDigest, canonicalJson, parseJsonStrict, sha256Digest } from '@core-ui/schema';
import {
  DeliveryWorkflowError,
  loadDeliveryProfile,
  validateDeliverySchema,
} from './delivery-profile.mjs';

const OPERAND_OPTIONS = [
  '--record',
  '--reverse-patch',
  '--postconditions',
  '--scan-preimages',
  '--proof-tool',
  '--current-identity',
];

function fail(message, details = {}) {
  throw new DeliveryWorkflowError('DELIVERY_ROLLBACK_INCOMPLETE', message, details);
}

function exactSet(values) {
  return [...new Set(values)].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail(`${label} has the wrong closed field set`);
  }
}

function requireMapRecord(map, id, digest, label) {
  const record = map.get(id);
  if (!record) fail(`${label} preimage is missing for ${id}`);
  if (canonicalDigest(record) !== digest) fail(`${label} digest mismatch for ${id}`);
  return record;
}

function validateOperand(contract, kind, value) {
  const schema = contract.profile.rollbackOperandSchemas[kind];
  if (!schema) fail(`rollback operand schema is missing for ${kind}`);
  validateDeliverySchema(schema, value, {
    rootSchema: schema,
    schemaAt: `/rollbackOperandSchemas/${kind}`,
  });
}

function validatePostcondition(record, entry, expectedPaths, current, isLatest) {
  exactKeys(record, [
    'currentCommit',
    'currentTree',
    'pathAssertions',
    'profile',
    'step',
  ], `postcondition ${entry.recordId}`);
  if (record.profile !== entry.recordProfile || record.step !== entry.step) {
    fail(`postcondition identity mismatch for ${entry.step}`);
  }
  if (!Array.isArray(record.pathAssertions)) {
    fail(`postcondition path assertions must be an array for ${entry.step}`);
  }
  for (const assertion of record.pathAssertions) {
    exactKeys(assertion, ['path', 'sha256'], `postcondition path assertion for ${entry.step}`);
    if (typeof assertion.path !== 'string'
        || (assertion.sha256 !== 'absent' && !/^sha256:[0-9a-f]{64}$/u.test(assertion.sha256))) {
      fail(`postcondition path assertion is invalid for ${entry.step}`);
    }
  }
  const paths = record.pathAssertions.map(({ path }) => path);
  if (canonicalJson(paths) !== canonicalJson(expectedPaths)) {
    fail(`postcondition path set mismatch for ${entry.step}`);
  }
  if (isLatest && (record.currentCommit !== current.commit || record.currentTree !== current.tree)) {
    fail(`latest postcondition source mismatch for ${entry.step}`);
  }
}

function validateScanPreimage(contract, rollback, observation, preimage, proofToolInput, finalComplete) {
  validateOperand(contract, 'scan', preimage);
  const command = contract.profile.referenceScanCommands[observation.commandRef];
  if (!command || preimage.commandDigest !== canonicalDigest(command)
      || observation.commandDigest !== preimage.commandDigest) {
    fail(`reference scan command mismatch for ${observation.commandRef}`);
  }
  if (preimage.currentCommit !== rollback.current.commit || preimage.currentTree !== rollback.current.tree
      || observation.currentCommit !== preimage.currentCommit || observation.currentTree !== preimage.currentTree) {
    fail(`reference scan source mismatch for ${observation.commandRef}`);
  }
  if (!Array.isArray(preimage.matches)
      || observation.matchesDigest !== canonicalDigest(preimage.matches)
      || observation.resultDigest !== canonicalDigest(preimage)
      || observation.stdoutDigest !== sha256Digest(preimage.stdout)
      || observation.stderrDigest !== sha256Digest(preimage.stderr)
      || observation.exitState !== preimage.exitState) {
    fail(`reference scan result mismatch for ${observation.commandRef}`);
  }
  const proofDigest = canonicalDigest(proofToolInput);
  if (preimage.proofToolRecordId !== proofToolInput.id
      || preimage.proofToolRecordProfile !== proofToolInput.profile
      || preimage.proofToolRecordDigest !== proofDigest
      || observation.proofToolRecordId !== proofToolInput.id
      || observation.proofToolRecordProfile !== proofToolInput.profile
      || observation.proofToolRecordDigest !== proofDigest) {
    fail(`reference scan proof-tool mismatch for ${observation.commandRef}`);
  }
  if (finalComplete && (preimage.exitState !== command.expectedFinalExitState || preimage.matches.length !== 0)) {
    fail(`final reference scan did not prove absence for ${observation.commandRef}`);
  }
}

function validateRecoveryProfile(contract) {
  const broadExclusions = ['!decisions/**', '!strategy/**', '!tests/evidence/**'];
  const exactExclusions = contract.profile.recoveryPreservedPaths
    .filter((path) => !['decisions/', 'strategy/', 'tests/evidence/'].some((prefix) => path.startsWith(prefix)))
    .map((path) => `!${path}`);
  const expected = exactSet([
    ...broadExclusions,
    '!.agents/skills/core-ui-delivery/SKILL.md',
    '!.github/CODEOWNERS',
    ...exactExclusions,
  ]);
  for (const [commandId, command] of Object.entries(contract.profile.referenceScanCommands)) {
    const actual = exactSet(command.argv.filter((value) => value.startsWith('!')));
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      fail(`reference scan exclusions do not match preserved-path ownership for ${commandId}`);
    }
  }
  const rebind = contract.profile.applicabilityRebindContract;
  const impactOwner = contract.owners.get(rebind?.impactOwnerRef);
  const decisionOwner = contract.owners.get(rebind?.decisionOwnerRef);
  if (!impactOwner || !decisionOwner
      || rebind.impactSourcePointer !== '/authorityApplicability/targets'
      || rebind.initialCaptureTopologyPointer !== '/authorityApplicability/captureTopology'
      || rebind.decisionOwnerSourcePointer !== '/acceptanceTopology/owner') {
    fail('applicability rebind authority owners are unresolved');
  }
  const decision = parseJsonStrict(impactOwner.bytes);
  const decisionOwnerRecord = parseJsonStrict(decisionOwner.bytes);
  const applicability = decision.authorityApplicability;
  const decisionOwnerIdentity = decisionOwnerRecord.acceptanceTopology?.owner;
  if (applicability?.targetCount !== rebind.affectedSuccessorCount
      || applicability?.targets?.length !== rebind.affectedSuccessorCount
      || canonicalDigest(applicability?.targets) !== rebind.affectedSuccessorManifestSha256
      || canonicalDigest(applicability?.captureTopology) !== rebind.initialCaptureTopologySha256
      || typeof decisionOwnerIdentity !== 'string'
      || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u.test(decisionOwnerIdentity)
      || rebind.rebindAuthorization !== 'new-digest-specific-owner-decision-required'
      || rebind.completionBoundary !== 'new-owner-decision-then-versioned-successor-evidence-and-fresh-full-checks') {
    fail('applicability decision boundary does not match Decision 0007');
  }
  const rule = contract.diagnostics.rules.find(({ code }) => code === rebind.diagnosticCode);
  if (!rule || rule.ruleId !== rebind.diagnosticRuleId
      || rule.ownerRef !== rebind.decisionOwnerRef
      || rule.sourcePointer !== rebind.decisionOwnerSourcePointer) {
    fail('applicability rebind diagnostic owner is unresolved');
  }
  return { applicability, rebind, rule };
}

function applicabilityRebindDiagnostic(contract, rollback) {
  const { rebind, rule } = validateRecoveryProfile(contract);
  const diagnostic = {
    code: rule.code,
    details: {
      actual: 'filesystem rollback and live-reference removal complete',
      domain: 'EVIDENCE_BINDING',
      expected: `a new digest-specific owner decision defining versioned successors for target manifest ${rebind.affectedSuccessorManifestSha256} (${rebind.affectedSuccessorCount} terminal nodes)`,
      fieldId: null,
      ownerRef: rebind.decisionOwnerRef,
      pointer: '/rollback',
      schemaPointer: '/applicabilityRebindContract',
    },
    nextAction: rule.nextAction,
    ownerRef: rule.ownerRef,
    retryable: rule.retryable,
    ruleId: rule.ruleId,
  };
  validateDeliverySchema(contract.diagnostics.resultSchema, diagnostic, {
    rootSchema: contract.diagnostics,
    schemaAt: '/resultSchema',
  });
  return {
    diagnostic,
    postconditionDigest: canonicalDigest({
      current: rollback.current,
      diagnostic,
      scans: rollback.observedReferenceMatches,
    }),
  };
}

function humanInstruction(contract, rollback, step, proofToolInput) {
  const paths = contract.profile.recoveryStepPaths[step];
  if (!Array.isArray(paths)) fail(`recovery path owner is missing for ${step}`);
  const writeSet = exactSet(rollback.workflowWriteSet.map(({ path }) => path));
  if (new Set(paths).size !== paths.length || paths.some((path) => !writeSet.includes(path))) {
    fail(`recovery path set exceeds the admitted workflow write set for ${step}`);
  }
  const patchPath = '.git/core-ui-delivery-rollback/reverse.patch';
  const preflight = [
    `test "$(git rev-parse HEAD)" = '${rollback.current.commit}'`,
    `test "$(git rev-parse 'HEAD^{tree}')" = '${rollback.current.tree}'`,
    `test "$(wc -c < '${patchPath}' | tr -d ' ')" = '${rollback.reversePatch.byteLength}'`,
    `test "sha256:$(shasum -a 256 '${patchPath}' | awk '{print $1}')" = '${rollback.reversePatch.digest}'`,
    `test "sha256:$(shasum -a 256 ${shellQuote(proofToolInput.executablePath)} | awk '{print $1}')" = '${proofToolInput.executableSha256}'`,
  ];
  const patchAction = (group) => group.length === 0 ? [] : [
    [
      `if ! git diff --quiet ${shellQuote(rollback.featureBase.commit)} -- ${group.map(shellQuote).join(' ')}; then`,
      `  git apply --index ${group.map((path) => `--include=${shellQuote(path)}`).join(' ')} ${shellQuote(patchPath)}`,
      'fi',
    ].join('\n'),
  ];
  const terminalBundle = step === 'remove-profile-owners';
  if (terminalBundle && canonicalJson(paths) !== canonicalJson(contract.profile.recoverySelfRemovalPaths)) {
    fail('terminal self-removal path ownership is inconsistent');
  }
  const finalPaths = terminalBundle
    ? contract.profile.recoveryStepPaths['verify-no-live-reference']
    : [];
  const scanActions = () => Object.entries(contract.profile.referenceScanCommands)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, command]) => [
      'status=0',
      `${[proofToolInput.executablePath, ...command.argv.slice(1)].map(shellQuote).join(' ')} || status=$?`,
      `test "$status" -eq '${command.expectedFinalExitState}'`,
    ].join('\n'));
  const terminalActions = terminalBundle ? [
    `git diff --quiet ${shellQuote(rollback.featureBase.commit)} -- ${paths.map(shellQuote).join(' ')}`,
    ...scanActions(),
    ...patchAction(finalPaths),
    `git diff --quiet ${shellQuote(rollback.featureBase.commit)} -- ${finalPaths.map(shellQuote).join(' ')}`,
    ...scanActions(),
    `printf '%s\\n' ${shellQuote(canonicalJson(applicabilityRebindDiagnostic(contract, rollback).diagnostic))} >&2`,
    'exit 42',
  ] : [];
  const argv = ['sh', '-ceu', [
    ...preflight,
    ...patchAction(paths),
    ...terminalActions,
  ].join('\n')];
  return {
    argv,
    commandId: terminalBundle
      ? 'delivery-rollback-human-remove-profile-owners-and-verify'
      : `delivery-rollback-human-${step}`,
    postconditionDigest: canonicalDigest({
      allowedPaths: paths,
      bundledFinalPaths: finalPaths,
      contract: contract.profile.recoveryPostconditionContracts[step],
      current: rollback.current,
      patch: rollback.reversePatch,
      preservedPaths: contract.profile.recoveryPreservedPaths,
      proofToolDigest: canonicalDigest(proofToolInput),
      referenceScanCommands: contract.profile.referenceScanCommands,
      step,
    }),
  };
}

export function validateDeliveryRollback(contract, rollback, {
  currentIdentity,
  patchBytes,
  postconditionRecords,
  proofToolInput,
  scanPreimages,
} = {}) {
  validateDeliverySchema(contract.schema.$defs.workflowRecord.properties.rollback, rollback, {
    rootSchema: contract.schema,
    schemaAt: '/$defs/workflowRecord/properties/rollback',
  });
  if (!(postconditionRecords instanceof Map) || !(scanPreimages instanceof Map)) {
    fail('rollback preimage maps are required');
  }
  validateOperand(contract, 'currentIdentity', currentIdentity);
  validateOperand(contract, 'proofTool', proofToolInput);
  validateRecoveryProfile(contract);
  if (canonicalJson(currentIdentity) !== canonicalJson(rollback.current)) {
    fail('current source identity is missing or stale');
  }
  const steps = contract.profile.recoverySteps;
  if (rollback.boundaries.map(({ id }) => id).join(',') !== 'RB-01,RB-02') {
    fail('rollback boundaries must be exactly RB-01 then RB-02');
  }
  if (rollback.boundaries[0].parent !== rollback.featureBase.commit
      || rollback.boundaries[1].parent !== rollback.boundaries[0].commit) {
    fail('rollback boundary parent topology is invalid');
  }
  for (const boundary of rollback.boundaries) {
    const sorted = [...boundary.paths].sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
    if (new Set(sorted.map(({ path }) => path)).size !== sorted.length
        || boundary.pathManifestDigest !== canonicalDigest(sorted)) {
      fail(`rollback boundary ${boundary.id} path manifest is invalid`);
    }
  }
  const writeSet = exactSet(rollback.workflowWriteSet.map(({ path }) => path));
  if (writeSet.length !== rollback.workflowWriteSet.length) fail('workflow write set contains duplicate paths');
  const boundaryUnion = exactSet(rollback.boundaries.flatMap(({ paths }) => paths.map(({ path }) => path)));
  if (canonicalJson(writeSet) !== canonicalJson(boundaryUnion)) fail('workflow write set does not equal the two-boundary union');
  const recoveryPaths = contract.profile.recoverySteps
    .flatMap((step) => contract.profile.recoveryStepPaths[step]);
  const preservedPaths = contract.profile.recoveryPreservedPaths;
  if (!Array.isArray(preservedPaths)
      || new Set(recoveryPaths).size !== recoveryPaths.length
      || new Set(preservedPaths).size !== preservedPaths.length
      || recoveryPaths.some((path) => preservedPaths.includes(path))
      || canonicalJson(writeSet) !== canonicalJson(exactSet([...recoveryPaths, ...preservedPaths]))) {
    fail('workflow write set does not equal the disjoint recovery and preserved-authority partition');
  }
  const changed = exactSet(rollback.changedPathSet);
  if (changed.some((path) => !writeSet.includes(path))) fail('changed path set exceeds the admitted workflow write set');
  if (changed.some((path) => preservedPaths.includes(path))) {
    fail('changed path set intersects preserved authority, product, or evidence-support paths');
  }
  if (rollback.subsetProofDigest !== canonicalDigest(changed)) {
    fail('changed-path subset proof digest is stale');
  }
  if (patchBytes === undefined) fail('reverse patch bytes are required');
  const byteLength = Buffer.byteLength(patchBytes);
  if (rollback.reversePatch.byteLength !== byteLength || rollback.reversePatch.digest !== sha256Digest(patchBytes)) {
    fail('reverse patch bytes do not match the recorded rollback boundary');
  }
  const completed = rollback.completedSteps;
  if (completed.some((step, index) => step !== steps[index])) fail('completed rollback steps must be an ordered prefix');
  if (rollback.completedPostconditions.length !== completed.length) fail('each completed step requires one postcondition');
  rollback.completedPostconditions.forEach((entry, index) => {
    if (entry.step !== completed[index]) fail(`postcondition order does not match ${entry.step}`);
    const record = requireMapRecord(postconditionRecords, entry.recordId, entry.recordDigest, 'postcondition');
    validateOperand(contract, 'postcondition', record);
    validatePostcondition(
      record,
      entry,
      contract.profile.recoveryStepPaths[entry.step],
      rollback.current,
      index === completed.length - 1,
    );
  });
  if (postconditionRecords.size !== completed.length) fail('postcondition preimage set contains unbound records');
  const expectedScans = Object.keys(contract.profile.referenceScanCommands).sort();
  if (canonicalJson(rollback.observedReferenceMatches.map(({ commandRef }) => commandRef)) !== canonicalJson(expectedScans)) {
    fail('reference scan set is incomplete or unordered');
  }
  if (scanPreimages.size !== expectedScans.length) fail('reference scan preimage set contains unbound records');
  const finalComplete = completed.length === steps.length;
  for (const observation of rollback.observedReferenceMatches) {
    const preimage = requireMapRecord(scanPreimages, observation.commandRef, observation.resultDigest, 'reference scan');
    validateScanPreimage(contract, rollback, observation, preimage, proofToolInput, finalComplete);
  }
  const remaining = steps.slice(completed.length);
  if (rollback.failedStep !== (remaining[0] ?? null)) fail('failedStep does not identify the next incomplete recovery step');
  if (remaining.length === 0) {
    const rebindResult = applicabilityRebindDiagnostic(contract, rollback);
    return {
      applicabilityRebindRequired: true,
      diagnostic: rebindResult.diagnostic,
      nextCommand: {
        argv: [],
        commandId: 'delivery-rollback-applicability-rebind-required',
        postconditionDigest: rebindResult.postconditionDigest,
      },
      remainingRecoverySteps: [],
    };
  }
  if (remaining[0] === 'verify-no-live-reference') {
    fail('terminal verification must resume from the stored remove-profile-owners bundle');
  }
  return {
    nextCommand: humanInstruction(contract, rollback, remaining[0], proofToolInput),
    remainingRecoverySteps: remaining,
  };
}

export function renderRollbackStatus(result) {
  return `${canonicalJson(result)}\n`;
}

function parseCliArguments(argv) {
  if (argv.length !== 2 + (OPERAND_OPTIONS.length * 2)) fail('rollback renderer received an incomplete operand set');
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if ((option !== '--resume-step' && !OPERAND_OPTIONS.includes(option)) || values.has(option) || !value) {
      fail(`rollback renderer received an invalid or duplicate operand ${option}`);
    }
    values.set(option, value);
  }
  if (!values.has('--resume-step') || OPERAND_OPTIONS.some((option) => !values.has(option))) {
    fail('rollback renderer is missing a required operand');
  }
  return values;
}

async function readCanonicalJson(readBytes, path, maxBytes, label) {
  const bytes = await readBytes(path);
  if (bytes.length > maxBytes) fail(`${label} exceeds the admitted byte limit`);
  const text = bytes.toString('utf8');
  const value = parseJsonStrict(text);
  if (canonicalJson(value) !== text) fail(`${label} is not canonical JSON`);
  return value;
}

function recordsMap(entries, key, label) {
  if (!Array.isArray(entries)) fail(`${label} must be an array`);
  const result = new Map();
  for (const entry of entries) {
    exactKeys(entry, [key, 'value'], label);
    if (result.has(entry[key])) fail(`${label} contains duplicate ${entry[key]}`);
    result.set(entry[key], entry.value);
  }
  return result;
}

export async function runDeliveryRollbackCli({
  argv = process.argv.slice(2),
  repositoryRoot = process.cwd(),
  readBytes = readFile,
  stderr = (value) => process.stderr.write(value),
  stdout = (value) => process.stdout.write(value),
} = {}) {
  try {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const values = parseCliArguments(argv);
    const step = values.get('--resume-step');
    const expected = contract.profile.recoveryCommands[step];
    if (!expected || canonicalJson(expected.argv.slice(2)) !== canonicalJson(argv)) {
      fail('rollback renderer invocation does not match the profile-owned command');
    }
    const limit = contract.profile.limits.maxPacketBytes;
    const [rollback, postconditions, scans, proofToolInput, currentIdentity, patchBytes] = await Promise.all([
      readCanonicalJson(readBytes, values.get('--record'), limit, 'rollback record'),
      readCanonicalJson(readBytes, values.get('--postconditions'), limit, 'postcondition preimages'),
      readCanonicalJson(readBytes, values.get('--scan-preimages'), contract.profile.limits.maxLogBytes, 'scan preimages'),
      readCanonicalJson(readBytes, values.get('--proof-tool'), limit, 'proof-tool identity'),
      readCanonicalJson(readBytes, values.get('--current-identity'), limit, 'current identity'),
      readBytes(values.get('--reverse-patch')),
    ]);
    if (patchBytes.length > contract.profile.limits.maxLogBytes) fail('reverse patch exceeds the admitted byte limit');
    const result = validateDeliveryRollback(contract, rollback, {
      currentIdentity,
      patchBytes,
      postconditionRecords: recordsMap(postconditions, 'recordId', 'postcondition preimages'),
      proofToolInput,
      scanPreimages: recordsMap(scans, 'commandRef', 'scan preimages'),
    });
    if (result.applicabilityRebindRequired) {
      stderr(renderRollbackStatus(result.diagnostic));
      return 1;
    }
    if (result.remainingRecoverySteps.length > 0) {
      stderr(renderRollbackStatus({
        code: 'DELIVERY_ROLLBACK_INCOMPLETE',
        instruction: result.nextCommand,
        remainingRecoverySteps: result.remainingRecoverySteps,
      }));
      return 1;
    }
    stdout(renderRollbackStatus(result));
    return 0;
  } catch (error) {
    const code = error instanceof DeliveryWorkflowError ? error.code : 'DELIVERY_ROLLBACK_INCOMPLETE';
    stderr(renderRollbackStatus({ code, message: error.message }));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runDeliveryRollbackCli();
}
