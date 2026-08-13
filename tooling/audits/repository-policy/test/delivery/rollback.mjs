import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { canonicalDigest, canonicalJson, sha256Digest } from '@core-ui/schema';
import { loadDeliveryProfile } from '../../src/delivery-profile.mjs';
import {
  runDeliveryRollbackCli,
  validateDeliveryRollback,
} from '../../src/delivery-rollback.mjs';

const COMMIT = (character) => character.repeat(40);
const DIGEST = (character) => `sha256:${character.repeat(64)}`;
const PATCH = Buffer.from('patch');

function proofToolFixture() {
  return {
    executablePath: '/opt/core-ui/bin/rg',
    executableSha256: DIGEST('a'),
    id: 'proof-tool',
    profile: 'core-ui-proof-tool-identity-v1',
    version: '14.1.1',
  };
}

function allWorkflowPaths(contract) {
  return [
    ...Object.values(contract.profile.recoveryStepPaths).flat(),
    ...contract.profile.recoveryPreservedPaths,
  ];
}

function allRecoveryPaths(contract) {
  return Object.values(contract.profile.recoveryStepPaths).flat();
}

function portableScanToolSource(contract) {
  const commands = Object.values(contract.profile.referenceScanCommands).map(({ argv }) => argv.slice(1));
  return `#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
const commands = ${JSON.stringify(commands)};
const argv = process.argv.slice(2);
const command = commands.find((candidate) => JSON.stringify(candidate) === JSON.stringify(argv));
if (!command) process.exit(2);
const exclusions = command.flatMap((value, index) => value === '-g' && command[index + 1]?.startsWith('!') ? [command[index + 1].slice(1)] : []);
const excluded = (relative) => exclusions.some((pattern) => pattern.endsWith('/**') ? relative.startsWith(pattern.slice(0, -2)) : relative === pattern);
const paths = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const absolute = path.join(directory, entry.name);
    if (path.resolve(absolute) === path.resolve(process.argv[1])) continue;
    const relative = path.relative(process.cwd(), absolute).split(path.sep).join('/');
    if (relative === 'bin/rg') continue;
    if (excluded(relative)) continue;
    if (entry.isDirectory()) walk(absolute);
    else paths.push(relative);
  }
};
walk(process.cwd());
if (command[0] === '--files') {
  const matches = paths.filter((relative) => relative.includes('delivery-workflow'));
  if (matches.length) process.stdout.write(matches.join('\\n') + '\\n');
  process.exit(matches.length ? 0 : 1);
}
const term = command[command.indexOf('-F') + 1];
const matches = [];
for (const relative of paths) {
  let text;
  try { text = fs.readFileSync(relative, 'utf8'); } catch { continue; }
  text.split('\\n').forEach((line, index) => {
    if (line.includes(term)) matches.push(relative + ':' + (index + 1) + ':' + line);
  });
}
if (matches.length) process.stdout.write(matches.join('\\n') + '\\n');
process.exit(matches.length ? 0 : 1);
`;
}

function scanFixture(contract, current, proofTool, { final = false } = {}) {
  const preimages = new Map();
  const observations = Object.entries(contract.profile.referenceScanCommands)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([commandRef, command]) => {
      const preimage = {
        commandDigest: canonicalDigest(command),
        currentCommit: current.commit,
        currentTree: current.tree,
        exitState: final ? command.expectedFinalExitState : 0,
        matches: final ? [] : [`live:${commandRef}`],
        proofToolRecordDigest: canonicalDigest(proofTool),
        proofToolRecordId: proofTool.id,
        proofToolRecordProfile: proofTool.profile,
        stderr: '',
        stdout: final ? '' : `live:${commandRef}\n`,
      };
      const resultDigest = canonicalDigest(preimage);
      preimages.set(commandRef, preimage);
      return {
        commandDigest: preimage.commandDigest,
        commandRef,
        currentCommit: current.commit,
        currentTree: current.tree,
        exitState: preimage.exitState,
        matchesDigest: canonicalDigest(preimage.matches),
        proofToolRecordDigest: preimage.proofToolRecordDigest,
        proofToolRecordId: preimage.proofToolRecordId,
        proofToolRecordProfile: preimage.proofToolRecordProfile,
        resultDigest,
        stderrDigest: sha256Digest(preimage.stderr),
        stdoutDigest: sha256Digest(preimage.stdout),
      };
    });
  return { observations, preimages };
}

function postconditionFixture(contract, steps, current) {
  const entries = [];
  const records = new Map();
  steps.forEach((step, index) => {
    const value = {
      currentCommit: current.commit,
      currentTree: current.tree,
      pathAssertions: contract.profile.recoveryStepPaths[step].map((path) => ({ path, sha256: 'absent' })),
      profile: 'core-ui-delivery-rollback-postcondition-v1',
      step,
    };
    const recordId = `postcondition-${index}-${step}`;
    entries.push({
      recordDigest: canonicalDigest(value),
      recordId,
      recordProfile: value.profile,
      step,
    });
    records.set(recordId, value);
  });
  return { entries, records };
}

function rollbackFixture(contract, {
  completedCount = 0,
  current = { commit: COMMIT('4'), tree: COMMIT('5') },
  featureBase = { commit: COMMIT('0'), tree: COMMIT('c') },
  finalScans = false,
  patchBytes = PATCH,
  proofTool = proofToolFixture(),
} = {}) {
  const paths = allWorkflowPaths(contract).map((path, index) => ({ path, sha256: DIGEST(String((index % 9) + 1)) }));
  const midpoint = Math.ceil(paths.length / 2);
  const firstPaths = paths.slice(0, midpoint).sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  const secondPaths = paths.slice(midpoint).sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  const completedSteps = contract.profile.recoverySteps.slice(0, completedCount);
  const postconditions = postconditionFixture(contract, completedSteps, current);
  const scans = scanFixture(contract, current, proofTool, { final: finalScans });
  const workflowWriteSet = [...firstPaths, ...secondPaths];
  const remaining = contract.profile.recoverySteps.slice(completedCount);
  return {
    inputs: {
      currentIdentity: current,
      patchBytes,
      postconditionRecords: postconditions.records,
      proofToolInput: proofTool,
      scanPreimages: scans.preimages,
    },
    rollback: {
      boundaries: [
        { commit: COMMIT('1'), id: 'RB-01', parent: featureBase.commit, pathManifestDigest: canonicalDigest(firstPaths), paths: firstPaths, tree: COMMIT('a') },
        { commit: COMMIT('2'), id: 'RB-02', parent: COMMIT('1'), pathManifestDigest: canonicalDigest(secondPaths), paths: secondPaths, tree: COMMIT('b') },
      ],
      changedPathSet: [],
      completedPostconditions: postconditions.entries,
      completedSteps,
      current,
      failedStep: remaining[0] ?? null,
      featureBase,
      merge: { commit: COMMIT('3'), tree: COMMIT('b') },
      observedReferenceMatches: scans.observations,
      reversePatch: { byteLength: patchBytes.length, digest: sha256Digest(patchBytes) },
      rollbackSource: current,
      sanitizedError: remaining.length ? 'synthetic failure' : null,
      subsetProofDigest: canonicalDigest([]),
      workflowWriteSet,
    },
  };
}

function cliBytes(contract, fixture) {
  const command = contract.profile.recoveryCommands[fixture.rollback.failedStep ?? 'verify-no-live-reference'];
  const paths = Object.fromEntries(command.argv.slice(2).reduce((entries, item, index, argv) => {
    if (item.startsWith('--') && index % 2 === 0) entries.push([item, argv[index + 1]]);
    return entries;
  }, []));
  const postconditions = [...fixture.inputs.postconditionRecords].map(([recordId, value]) => ({ recordId, value }));
  const scans = [...fixture.inputs.scanPreimages].map(([commandRef, value]) => ({ commandRef, value }));
  const files = new Map([
    [paths['--record'], Buffer.from(canonicalJson(fixture.rollback))],
    [paths['--reverse-patch'], PATCH],
    [paths['--postconditions'], Buffer.from(canonicalJson(postconditions))],
    [paths['--scan-preimages'], Buffer.from(canonicalJson(scans))],
    [paths['--proof-tool'], Buffer.from(canonicalJson(fixture.inputs.proofToolInput))],
    [paths['--current-identity'], Buffer.from(canonicalJson(fixture.inputs.currentIdentity))],
  ]);
  return {
    argv: command.argv.slice(2),
    files,
    readBytes: async (path) => {
      if (!files.has(path)) throw new Error(`unexpected read ${path}`);
      return files.get(path);
    },
  };
}

export function registerRollbackTests(repositoryRoot) {
  test('E-DELIVERY-07 renders every ordered human recovery step without executing it', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const renderedPaths = [];
    const renderedScripts = new Map();
    const terminalIndex = contract.profile.recoverySteps.indexOf('remove-profile-owners');
    for (let index = 0; index <= terminalIndex; index += 1) {
      const fixture = rollbackFixture(contract, { completedCount: index });
      const result = validateDeliveryRollback(contract, fixture.rollback, fixture.inputs);
      const step = contract.profile.recoverySteps[index];
      assert.equal(result.remainingRecoverySteps[0], step);
      assert.equal(result.nextCommand.commandId, step === 'remove-profile-owners'
        ? 'delivery-rollback-human-remove-profile-owners-and-verify'
        : `delivery-rollback-human-${step}`);
      assert.equal(result.nextCommand.commandId.startsWith('delivery-rollback-human-'), true);
      assert.deepEqual(result.nextCommand.argv.slice(0, 2), ['sh', '-ceu']);
      assert.match(result.nextCommand.argv[2], new RegExp(fixture.rollback.current.commit, 'u'));
      assert.match(result.nextCommand.argv[2], new RegExp(fixture.rollback.current.tree, 'u'));
      assert.match(result.nextCommand.argv[2], new RegExp(fixture.rollback.reversePatch.digest, 'u'));
      renderedScripts.set(step, result.nextCommand.argv[2]);
      const includedPaths = [...result.nextCommand.argv[2].matchAll(/--include='([^']+)'/gu)].map((match) => match[1]);
      renderedPaths.push(...includedPaths);
      const expectedPaths = step === 'remove-profile-owners'
        ? [...contract.profile.recoveryStepPaths[step], ...contract.profile.recoveryStepPaths['verify-no-live-reference']]
        : contract.profile.recoveryStepPaths[step];
      assert.deepEqual(includedPaths, expectedPaths);
      if (step === 'remove-profile-owners') {
        assert.match(result.nextCommand.argv[2], /DELIVERY_ROLLBACK_APPLICABILITY_REBIND_REQUIRED/u);
        for (const command of Object.values(contract.profile.referenceScanCommands)) {
          const renderedCommand = [fixture.inputs.proofToolInput.executablePath, ...command.argv.slice(1)]
            .map((value) => `'${value}'`).join(' ');
          assert.equal(result.nextCommand.argv[2].split(renderedCommand).length - 1, 2);
          assert.match(result.nextCommand.argv[2], new RegExp(`test "\\$status" -eq '${command.expectedFinalExitState}'`, 'u'));
        }
      }
      if (includedPaths.length > 0) {
        assert.match(result.nextCommand.argv[2], new RegExp(`git diff --quiet '${fixture.rollback.featureBase.commit}'`, 'u'));
      }
    }
    assert.deepEqual(
      renderedPaths.sort((left, right) => Buffer.from(left).compare(Buffer.from(right))),
      allRecoveryPaths(contract).sort((left, right) => Buffer.from(left).compare(Buffer.from(right))),
    );
    assert.equal(new Set(renderedPaths).size, renderedPaths.length);
    for (const preservedPath of contract.profile.recoveryPreservedPaths) {
      assert.equal(renderedPaths.includes(preservedPath), false);
    }
    const finalScript = renderedScripts.get('remove-profile-owners');
    const firstSelfRemoval = contract.profile.recoverySelfRemovalPaths[0];
    assert.ok(finalScript.indexOf(`--include='${firstSelfRemoval}'`) < finalScript.indexOf("--include='.github/CODEOWNERS'"));
    assert.ok(finalScript.indexOf("--include='.github/CODEOWNERS'") < finalScript.lastIndexOf("'/opt/core-ui/bin/rg'"));
    assert.ok(finalScript.lastIndexOf("'/opt/core-ui/bin/rg'") < finalScript.indexOf('DELIVERY_ROLLBACK_APPLICABILITY_REBIND_REQUIRED'));
    assert.match(finalScript, /shasum -a 256 '\/opt\/core-ui\/bin\/rg'/u);
    for (const selfRemovalPath of contract.profile.recoverySelfRemovalPaths) {
      assert.ok(finalScript.indexOf(`--include='${selfRemovalPath}'`) < finalScript.indexOf('status=0'));
    }
    const broadPreservedPrefixes = ['decisions/', 'strategy/', 'tests/evidence/'];
    for (const command of Object.values(contract.profile.referenceScanCommands)) {
      for (const preservedPath of contract.profile.recoveryPreservedPaths) {
        const coveredByBroadExclusion = broadPreservedPrefixes.some((prefix) => preservedPath.startsWith(prefix));
        assert.equal(coveredByBroadExclusion || command.argv.includes(`!${preservedPath}`), true);
      }
    }
    for (const step of contract.profile.recoverySteps.slice(0, terminalIndex)) {
      for (const runtimePath of contract.profile.recoverySelfRemovalPaths) {
        assert.equal(renderedScripts.get(step).includes(`--include='${runtimePath}'`), false);
      }
    }
    const impossibleIntermediate = rollbackFixture(contract, { completedCount: terminalIndex + 1 });
    assert.throws(
      () => validateDeliveryRollback(contract, impossibleIntermediate.rollback, impossibleIntermediate.inputs),
      /terminal verification must resume from the stored remove-profile-owners bundle/,
    );
  });

  test('E-DELIVERY-07 stored commands execute the ordered path-confined removal and remain replay-safe', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'core-ui-delivery-rollback-'));
    try {
      const git = (args, options = {}) => execFileSync('git', args, {
        cwd: fixtureRoot,
        encoding: options.encoding ?? 'utf8',
        env: {
          ...process.env,
          GIT_AUTHOR_EMAIL: 'core-ui@example.invalid',
          GIT_AUTHOR_NAME: 'Core UI fixture',
          GIT_COMMITTER_EMAIL: 'core-ui@example.invalid',
          GIT_COMMITTER_NAME: 'Core UI fixture',
        },
      });
      git(['init', '-q']);
      git(['commit', '--allow-empty', '-q', '-m', 'base']);
      const featureBase = {
        commit: git(['rev-parse', 'HEAD']).trim(),
        tree: git(['rev-parse', 'HEAD^{tree}']).trim(),
      };
      for (const path of allWorkflowPaths(contract)) {
        const absolute = join(fixtureRoot, path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, `feature:${path}\n`);
      }
      git(['add', '--', '.']);
      git(['commit', '-q', '-m', 'feature']);
      const current = {
        commit: git(['rev-parse', 'HEAD']).trim(),
        tree: git(['rev-parse', 'HEAD^{tree}']).trim(),
      };
      const patchBytes = execFileSync('git', ['diff', '--binary', current.commit, featureBase.commit], { cwd: fixtureRoot });
      const patchPath = join(fixtureRoot, '.git/core-ui-delivery-rollback/reverse.patch');
      await mkdir(dirname(patchPath), { recursive: true });
      await writeFile(patchPath, patchBytes);
      const proofToolPath = join(fixtureRoot, 'bin', 'rg');
      await mkdir(dirname(proofToolPath), { recursive: true });
      await writeFile(proofToolPath, portableScanToolSource(contract));
      await chmod(proofToolPath, 0o755);
      const proofTool = {
        executablePath: proofToolPath,
        executableSha256: sha256Digest(await readFile(proofToolPath)),
        id: 'proof-tool',
        profile: 'core-ui-proof-tool-identity-v1',
        version: 'fixture-resolved',
      };
      const liveReferenceCommand = contract.profile.referenceScanCommands['delivery-reference-scan-paths'];
      const liveReferenceScan = spawnSync(proofToolPath, liveReferenceCommand.argv.slice(1), {
        cwd: fixtureRoot,
        encoding: 'utf8',
        env: process.env,
      });
      assert.equal(liveReferenceScan.status, 0);
      assert.match(liveReferenceScan.stdout, /delivery-workflow/u);
      const terminalIndex = contract.profile.recoverySteps.indexOf('remove-profile-owners');
      let terminalScript;
      for (let index = 0; index <= terminalIndex; index += 1) {
        const fixture = rollbackFixture(contract, {
          completedCount: index,
          current,
          featureBase,
          patchBytes,
          proofTool,
        });
        const result = validateDeliveryRollback(contract, fixture.rollback, fixture.inputs);
        const execution = spawnSync('sh', result.nextCommand.argv.slice(1), {
          cwd: fixtureRoot,
          encoding: 'utf8',
          env: process.env,
        });
        if (index === terminalIndex) {
          terminalScript = result.nextCommand.argv;
          assert.equal(execution.status, 42, `${execution.stdout}\n${execution.stderr}`);
          assert.match(execution.stderr, /DELIVERY_ROLLBACK_APPLICABILITY_REBIND_REQUIRED/u);
        } else {
          assert.equal(execution.status, 0, execution.stderr);
        }
      }
      const removed = git(['diff', '--cached', '--name-only', featureBase.commit])
        .trim().split('\n').filter(Boolean).sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
      assert.deepEqual(
        removed,
        [...contract.profile.recoveryPreservedPaths].sort((left, right) => Buffer.from(left).compare(Buffer.from(right))),
      );
      for (const path of allRecoveryPaths(contract)) {
        await assert.rejects(readFile(join(fixtureRoot, path)), /ENOENT/u);
      }
      for (const path of contract.profile.recoveryPreservedPaths) {
        assert.match(await readFile(join(fixtureRoot, path), 'utf8'), /^feature:/u);
      }
      const replay = spawnSync('sh', terminalScript.slice(1), {
        cwd: fixtureRoot,
        encoding: 'utf8',
        env: process.env,
      });
      assert.equal(replay.status, 42);
      assert.match(replay.stderr, /DELIVERY_ROLLBACK_APPLICABILITY_REBIND_REQUIRED/u);
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  });

  test('E-DELIVERY-07 validates RB-01/RB-02, current identity, patch confinement, and ordered recovery', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const cases = [];
    const expanded = rollbackFixture(contract);
    expanded.rollback.changedPathSet = ['outside/scope'];
    expanded.rollback.subsetProofDigest = canonicalDigest(expanded.rollback.changedPathSet);
    cases.push(expanded);
    const stalePatch = rollbackFixture(contract);
    stalePatch.inputs.patchBytes = Buffer.from('other');
    cases.push(stalePatch);
    const skipped = rollbackFixture(contract);
    skipped.rollback.completedSteps = [contract.profile.recoverySteps[1]];
    cases.push(skipped);
    const staleCurrent = rollbackFixture(contract);
    staleCurrent.inputs.currentIdentity = { ...staleCurrent.rollback.current, tree: COMMIT('9') };
    cases.push(staleCurrent);
    const badBoundary = rollbackFixture(contract);
    badBoundary.rollback.boundaries[1].parent = COMMIT('9');
    cases.push(badBoundary);
    const pathExpansion = rollbackFixture(contract);
    pathExpansion.rollback.workflowWriteSet = pathExpansion.rollback.workflowWriteSet.filter(({ path }) => path !== contract.profile.recoveryStepPaths[contract.profile.recoverySteps[0]][0]);
    cases.push(pathExpansion);
    const preservedMutation = rollbackFixture(contract);
    preservedMutation.rollback.changedPathSet = [contract.profile.recoveryPreservedPaths[0]];
    preservedMutation.rollback.subsetProofDigest = canonicalDigest(preservedMutation.rollback.changedPathSet);
    cases.push(preservedMutation);
    for (const candidate of cases) {
      assert.throws(() => validateDeliveryRollback(contract, candidate.rollback, candidate.inputs), /DELIVERY_ROLLBACK_INCOMPLETE/);
    }
  });

  test('E-DELIVERY-07 requires every completed postcondition and scan/proof preimage', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const missingPostcondition = rollbackFixture(contract, { completedCount: 1 });
    missingPostcondition.inputs.postconditionRecords.clear();
    assert.throws(() => validateDeliveryRollback(contract, missingPostcondition.rollback, missingPostcondition.inputs), /preimage is missing/);
    const missingScan = rollbackFixture(contract);
    missingScan.inputs.scanPreimages.delete(missingScan.rollback.observedReferenceMatches[0].commandRef);
    assert.throws(() => validateDeliveryRollback(contract, missingScan.rollback, missingScan.inputs), /reference scan preimage/);
    const staleProof = rollbackFixture(contract);
    staleProof.inputs.proofToolInput = { ...staleProof.inputs.proofToolInput, version: 'substituted' };
    assert.throws(() => validateDeliveryRollback(contract, staleProof.rollback, staleProof.inputs), /proof-tool mismatch/);
    const invalidProof = rollbackFixture(contract);
    invalidProof.inputs.proofToolInput.version = 14;
    assert.throws(() => validateDeliveryRollback(contract, invalidProof.rollback, invalidProof.inputs), /DELIVERY_SCHEMA_INVALID/);
    const unownedPostconditionField = rollbackFixture(contract, { completedCount: 1 });
    const [, postconditionValue] = [...unownedPostconditionField.inputs.postconditionRecords][0];
    postconditionValue.referenceScanAssertions = [];
    unownedPostconditionField.rollback.completedPostconditions[0].recordDigest = canonicalDigest(postconditionValue);
    assert.throws(() => validateDeliveryRollback(contract, unownedPostconditionField.rollback, unownedPostconditionField.inputs), /DELIVERY_SCHEMA_INVALID/);
    const invalidPostcondition = rollbackFixture(contract, { completedCount: 1 });
    const [, invalidPostconditionValue] = [...invalidPostcondition.inputs.postconditionRecords][0];
    invalidPostconditionValue.currentCommit = 'not-a-commit';
    invalidPostcondition.rollback.completedPostconditions[0].recordDigest = canonicalDigest(invalidPostconditionValue);
    assert.throws(() => validateDeliveryRollback(contract, invalidPostcondition.rollback, invalidPostcondition.inputs), /DELIVERY_SCHEMA_INVALID/);
    const unownedScanField = rollbackFixture(contract);
    const firstObservation = unownedScanField.rollback.observedReferenceMatches[0];
    const scanValue = unownedScanField.inputs.scanPreimages.get(firstObservation.commandRef);
    scanValue.output = 'unowned duplicate';
    firstObservation.resultDigest = canonicalDigest(scanValue);
    assert.throws(() => validateDeliveryRollback(contract, unownedScanField.rollback, unownedScanField.inputs), /DELIVERY_SCHEMA_INVALID/);
    const tamperedScan = rollbackFixture(contract);
    tamperedScan.inputs.scanPreimages.get(tamperedScan.rollback.observedReferenceMatches[0].commandRef).stdout = 'tampered';
    assert.throws(() => validateDeliveryRollback(contract, tamperedScan.rollback, tamperedScan.inputs), /reference scan digest mismatch/);
  });

  test('E-DELIVERY-07 requires applicability rebinding after final reference absence is proved', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const complete = rollbackFixture(contract, { completedCount: contract.profile.recoverySteps.length, finalScans: true });
    const result = validateDeliveryRollback(contract, complete.rollback, complete.inputs);
    assert.deepEqual(result.remainingRecoverySteps, []);
    assert.equal(result.applicabilityRebindRequired, true);
    assert.equal(result.nextCommand.commandId, 'delivery-rollback-applicability-rebind-required');
    assert.deepEqual(Object.keys(result.diagnostic).sort(), [
      'code', 'details', 'nextAction', 'ownerRef', 'retryable', 'ruleId',
    ]);
    assert.equal(result.diagnostic.code, contract.profile.applicabilityRebindContract.diagnosticCode);
    assert.equal(
      result.diagnostic.details.expected,
      `a new digest-specific owner decision defining versioned successors for target manifest ${contract.profile.applicabilityRebindContract.affectedSuccessorManifestSha256} (${contract.profile.applicabilityRebindContract.affectedSuccessorCount} terminal nodes)`,
    );
    assert.equal(result.diagnostic.retryable, false);
    const liveReference = rollbackFixture(contract, { completedCount: contract.profile.recoverySteps.length });
    assert.throws(() => validateDeliveryRollback(contract, liveReference.rollback, liveReference.inputs), /did not prove absence/);
    const wrongTargetContract = {
      ...contract,
      profile: structuredClone(contract.profile),
    };
    wrongTargetContract.profile.applicabilityRebindContract.affectedSuccessorCount = 27;
    assert.throws(
      () => validateDeliveryRollback(wrongTargetContract, complete.rollback, complete.inputs),
      /decision boundary does not match Decision 0009/,
    );
    const reusedInitialTopology = {
      ...contract,
      profile: structuredClone(contract.profile),
    };
    reusedInitialTopology.profile.applicabilityRebindContract.rebindAuthorization = 'reuse-decision-0009-initial-capture';
    assert.throws(
      () => validateDeliveryRollback(reusedInitialTopology, complete.rollback, complete.inputs),
      /decision boundary does not match Decision 0009/,
    );
    const substitutedInitialTopology = {
      ...contract,
      profile: structuredClone(contract.profile),
    };
    substitutedInitialTopology.profile.applicabilityRebindContract.initialCaptureTopologySha256 = `sha256:${'0'.repeat(64)}`;
    assert.throws(
      () => validateDeliveryRollback(substitutedInitialTopology, complete.rollback, complete.inputs),
      /decision boundary does not match Decision 0009/,
    );
    const substitutedTargets = {
      ...contract,
      owners: new Map(contract.owners),
    };
    const impactOwner = structuredClone(substitutedTargets.owners.get('decision-0009'));
    const substitutedDecision = JSON.parse(impactOwner.bytes);
    substitutedDecision.continuationTopology.targets.reverse();
    impactOwner.bytes = canonicalJson(substitutedDecision);
    impactOwner.digest = sha256Digest(impactOwner.bytes);
    substitutedTargets.owners.set('decision-0009', impactOwner);
    assert.throws(
      () => validateDeliveryRollback(substitutedTargets, complete.rollback, complete.inputs),
      /decision boundary does not match Decision 0009/,
    );
  });

  test('E-DELIVERY-07 CLI is fail-closed, exact-output, and leaves repository bytes unchanged', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const sourceBefore = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../../src/delivery-rollback.mjs', import.meta.url)));
    const statusBefore = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: repositoryRoot });
    const incomplete = rollbackFixture(contract, { completedCount: 1 });
    const incompleteCli = cliBytes(contract, incomplete);
    let incompleteOut = '';
    let incompleteErr = '';
    const incompleteExit = await runDeliveryRollbackCli({
      argv: incompleteCli.argv,
      readBytes: incompleteCli.readBytes,
      repositoryRoot,
      stderr: (value) => { incompleteErr += value; },
      stdout: (value) => { incompleteOut += value; },
    });
    assert.equal(incompleteExit, 1);
    assert.equal(incompleteOut, '');
    const rendered = JSON.parse(incompleteErr);
    assert.equal(rendered.code, 'DELIVERY_ROLLBACK_INCOMPLETE');
    assert.equal(rendered.instruction.commandId, 'delivery-rollback-human-remove-test-entrypoint');

    const complete = rollbackFixture(contract, { completedCount: contract.profile.recoverySteps.length, finalScans: true });
    const completeCli = cliBytes(contract, complete);
    let completeOut = '';
    let completeErr = '';
    const completeExit = await runDeliveryRollbackCli({
      argv: completeCli.argv,
      readBytes: completeCli.readBytes,
      repositoryRoot,
      stderr: (value) => { completeErr += value; },
      stdout: (value) => { completeOut += value; },
    });
    assert.equal(completeExit, 1);
    assert.equal(completeOut, '');
    assert.equal(JSON.parse(completeErr).code, 'DELIVERY_ROLLBACK_APPLICABILITY_REBIND_REQUIRED');
    const sourceAfter = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../../src/delivery-rollback.mjs', import.meta.url)));
    const statusAfter = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: repositoryRoot });
    assert.deepEqual(sourceAfter, sourceBefore);
    assert.deepEqual(statusAfter, statusBefore);

    const missingOperand = await runDeliveryRollbackCli({
      argv: completeCli.argv.slice(0, -2),
      readBytes: completeCli.readBytes,
      repositoryRoot,
      stderr: () => {},
      stdout: () => {},
    });
    assert.equal(missingOperand, 1);
    const duplicateOperand = await runDeliveryRollbackCli({
      argv: [...completeCli.argv, '--record', '.git/core-ui-delivery-rollback/record.json'],
      readBytes: completeCli.readBytes,
      repositoryRoot,
      stderr: () => {},
      stdout: () => {},
    });
    assert.equal(duplicateOperand, 1);
    const noncanonicalFiles = new Map(completeCli.files);
    noncanonicalFiles.set('.git/core-ui-delivery-rollback/current.json', Buffer.from(`{ "commit": "${complete.rollback.current.commit}", "tree": "${complete.rollback.current.tree}" }`));
    const noncanonicalExit = await runDeliveryRollbackCli({
      argv: completeCli.argv,
      readBytes: async (path) => noncanonicalFiles.get(path),
      repositoryRoot,
      stderr: () => {},
      stdout: () => {},
    });
    assert.equal(noncanonicalExit, 1);
    const tamperedFiles = new Map(completeCli.files);
    tamperedFiles.set('.git/core-ui-delivery-rollback/current.json', Buffer.from('{}'));
    const tamperedExit = await runDeliveryRollbackCli({
      argv: completeCli.argv,
      readBytes: async (path) => tamperedFiles.get(path),
      repositoryRoot,
      stderr: () => {},
      stdout: () => {},
    });
    assert.equal(tamperedExit, 1);
  });

  test('E-DELIVERY-07 preserves every Decision 0009 authority and continuation path outside the reverse patch', async () => {
    const contract = await loadDeliveryProfile(repositoryRoot);
    const preserved = new Set(contract.profile.recoveryPreservedPaths);
    const removable = new Set(Object.values(contract.profile.recoveryStepPaths).flat());
    for (const path of [
      'decisions/0009-delivery-review-readiness.json',
      'decisions/0009-delivery-review-readiness-acceptance.json',
      'tooling/audits/repository-policy/src/evidence-verify.mjs',
      'tests/evidence/delivery-review-readiness-applicability-profile.mjs',
      'tests/evidence/authority-58-delivery-review-readiness-applicability-v1/index.json',
      ...contract.profile.recoveryPreservedPaths.filter((path) => path.startsWith('tests/evidence/authority-58-delivery-review-readiness-applicability-v1/supersessions/')),
    ]) {
      assert.equal(preserved.has(path), true, `missing preserved path ${path}`);
      assert.equal(removable.has(path), false, `preserved path is removable ${path}`);
    }
    assert.equal([...preserved].filter((path) => path.startsWith('tests/evidence/authority-58-delivery-review-readiness-applicability-v1/')).length, 30);
  });
}
