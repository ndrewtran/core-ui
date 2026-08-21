import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../../../packages/schema/src/canonical.mjs';
import { renderDeliveryPacket } from '../src/delivery-packet.mjs';
import { loadDeliveryProfile } from '../src/delivery-profile.mjs';
import { buildAuthoredRecord } from './delivery/fixtures.mjs';
import {
  R1_CONTINUOUS_EXECUTION,
  R1ContinuousExecutionError,
  normalizeGitHubPagedCollection,
  normalizeGitHubProtection,
  normalizeGitHubRulesetPages,
  providerRequiredChecks,
  validateRetainedProofTool,
  verifyR1ContinuousExecution,
  verifyR1ContinuousExecutionOperation,
  verifyR1ContinuousExecutionWithDeliveryProfile,
  verifyR1ContinuousExecutionPolicyGate,
} from '../src/r1-continuous-execution-verify.mjs';
import {
  CHANGE_INTENT_BINDINGS,
  CHANGE_INTENT_LOCK_PROFILE,
  commandContract,
  commandProcedureIdentity,
  commandRuntimeIdentity,
  previewChangeIntentEnvelope,
} from '../../../../packages/tooling/src/change-intent.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const authorityCommit = R1_CONTINUOUS_EXECUTION.authorityMerge;
const authorityTree = R1_CONTINUOUS_EXECUTION.authorityTree;
let counter = 0;
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const bytesOf = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const gitBytes = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 });
const changedPaths = (root, base, head) => { const text = git(root, 'diff', '--name-only', `${base}..${head}`, '--'); return text ? text.split('\n').filter(Boolean).sort() : []; };
const state = (root) => ({
  branch: git(root, 'branch', '--show-current'),
  commit: git(root, 'rev-parse', 'HEAD'),
  tree: git(root, 'rev-parse', 'HEAD^{tree}'),
  parents: git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/u).slice(1),
  base: git(root, 'rev-parse', 'HEAD^'),
  baseTree: git(root, 'rev-parse', 'HEAD^^{tree}'),
});
const taskRoot = (root) => resolve(root, git(root, 'rev-parse', '--git-path', 'core-ui-r1'));
const bootstrapObservation = (root) => JSON.parse(readFileSync(join(taskRoot(root), 'bootstrap-receipt.json'), 'utf8')).hosted.observation;
const bootstrapOptions = (root, { recomputeIdentities = false } = {}) => ({ testOnlyBootstrapObservation: true, bootstrapObservationRunner: () => {
  const observation = structuredClone(bootstrapObservation(root));
  const originMain = git(root, 'rev-parse', 'refs/remotes/origin/main');
  if (originMain !== observation.postmerge?.commit) {
    observation.postmerge = {
      ref: 'refs/heads/main',
      commit: originMain,
      tree: git(root, 'rev-parse', `${originMain}^{tree}`),
      orderedParents: git(root, 'rev-list', '--parents', '-n', '1', originMain).split(/\s+/u).slice(1),
    };
  }
  if (recomputeIdentities) {
    const providerPayload = { ...observation };
    delete providerPayload.rawResponseIdentity;
    delete providerPayload.normalizedResponseIdentity;
    const raw = JSON.stringify(providerPayload);
    const normalized = canonicalJson(providerPayload);
    observation.rawResponseIdentity = { source: 'github:rest:raw-observation', digest: sha256(raw), byteLength: Buffer.byteLength(raw) };
    observation.normalizedResponseIdentity = { source: 'github:rest:normalized-observation', digest: sha256(normalized), byteLength: Buffer.byteLength(normalized) };
  }
  return observation;
}, testOnlyCommandRunner: true, commandRunner: () => ({ exitState: 0 }) });
const descriptor = (path, bytes) => ({ path, digest: sha256(bytes), byteLength: bytes.byteLength });
const taskRecord = (root, value, name) => {
  const slot = counter++;
  const fileName = name ?? `record-${slot}.json`;
  const bytes = bytesOf(canonicalJson(value));
  const path = `.git/core-ui-r1/${slot}/${fileName}`;
  const absolute = join(taskRoot(root), `${slot}/${fileName}`);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, bytes);
  return descriptor(path, bytes);
};
const lockRecord = (root, target, name) => {
  const snapshot = JSON.parse(readFileSync(join(root, CHANGE_INTENT_BINDINGS.snapshot.path), 'utf8'));
  const selected = snapshot.families.find(({ family }) => family === target.family);
  if (!selected) throw new Error(`missing locked family ${target.family}`);
  const owner = (path, sourceCommit, sourceTree) => ({ path, selector: '/', digest: sha256(readFileSync(join(root, path))), sourceCommit, sourceTree });
  const authority = CHANGE_INTENT_BINDINGS.authority;
  return taskRecord(root, {
    profile: CHANGE_INTENT_LOCK_PROFILE,
    schemaVersion: '1.0.0',
    target: { family: selected.family, scopeId: selected.scopeId, tranche: selected.tranche, source: selected.source },
    authority: {
      decision: owner('decisions/0010-amendment-06-r1-change-intent-owner.md', authority.commit, authority.tree),
      acceptance: owner('decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md', authority.commit, authority.tree),
      architecture: owner('strategy/monorepo-architecture.md', authority.commit, authority.tree),
      roadmap: owner('strategy/milestone-roadmap.md', authority.commit, authority.tree),
      productScope: owner('strategy/product-scope.md', authority.commit, authority.tree),
    },
    snapshot: { path: CHANGE_INTENT_BINDINGS.snapshot.path, selector: '/', digest: CHANGE_INTENT_BINDINGS.snapshot.digest, sourceCommit: CHANGE_INTENT_BINDINGS.stage1.commit, sourceTree: CHANGE_INTENT_BINDINGS.stage1.tree },
    snapshotEnvelope: { path: CHANGE_INTENT_BINDINGS.snapshot.envelopePath, selector: '/', digest: CHANGE_INTENT_BINDINGS.snapshot.envelopeDigest, sourceCommit: CHANGE_INTENT_BINDINGS.stage1.commit, sourceTree: CHANGE_INTENT_BINDINGS.stage1.tree },
    baseline: { path: CHANGE_INTENT_BINDINGS.baseline.path, selector: '/', digest: CHANGE_INTENT_BINDINGS.baseline.digest, sourceCommit: CHANGE_INTENT_BINDINGS.baseline.sourceCommit, sourceTree: CHANGE_INTENT_BINDINGS.baseline.sourceTree },
    source: {
      authority: { commit: authority.commit, tree: authority.tree },
      stage1: { commit: CHANGE_INTENT_BINDINGS.stage1.commit, tree: CHANGE_INTENT_BINDINGS.stage1.tree },
      baseline: { commit: CHANGE_INTENT_BINDINGS.baseline.sourceCommit, tree: CHANGE_INTENT_BINDINGS.baseline.sourceTree },
    },
  }, name);
};
const sourceRecord = (root) => {
  const current = state(root);
  return taskRecord(root, { profile: 'core-ui-r1-source-v1', branch: current.branch, commit: current.commit, tree: current.tree }, 'source.json');
};

function cloneAuthority() {
  const root = mkdtempSync(join(tmpdir(), 'core-ui-r1-change-intent-'));
  execFileSync('git', ['clone', '--local', repositoryRoot, root], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'r1-change-intent@example.invalid']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'R1 ChangeIntent fixture']);
  execFileSync('git', ['-C', root, 'checkout', '-B', 'main', authorityCommit], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'checkout', '-B', `codex/r1-change-intent-bootstrap-${counter++}`, authorityCommit], { stdio: 'pipe' });
  for (const path of R1_CONTINUOUS_EXECUTION.bootstrapWriteSet) cpSync(join(repositoryRoot, path), join(root, path));
  execFileSync('git', ['-C', root, 'add', ...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet]);
  execFileSync('git', ['-C', root, 'commit', '-m', 'test: exact eight-path ChangeIntent prerequisite'], { stdio: 'pipe' });
  const topic = git(root, 'rev-parse', 'HEAD');
  execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'merge', '--no-ff', '--no-edit', topic], { stdio: 'pipe' });
  const merged = state(root);
  execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', merged.commit]);
  execFileSync('git', ['-C', root, 'checkout', `codex/r1-change-intent-bootstrap-${counter - 1}`], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'branch', '-D', 'main'], { stdio: 'pipe' });
  const bootstrapObservation = { provider: 'github', repository: 'ndrewtran/core-ui', defaultBranch: 'main', protectedRef: 'refs/heads/main', protection: { classic: true, enforceAdmins: true, activeRulesets: [] }, pullRequest: { number: 1, headCommit: topic, baseCommit: authorityCommit, baseRefName: 'main', merged: true, mergeCommit: merged.commit }, requiredChecks: ['Repository policy'], requiredChecksIdentity: { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks: ['Repository policy'], requiredReviews: [] })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks: ['Repository policy'], requiredReviews: [] })) }, requiredReviews: [], requiredReviewsSatisfied: true, requiredReviewBots: [], reviewBots: [], reviews: [], rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256('bootstrap-provider'), byteLength: Buffer.byteLength('bootstrap-provider') }, normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256('bootstrap-normalized'), byteLength: Buffer.byteLength('bootstrap-normalized') }, checks: [{ name: 'Repository policy', headCommit: merged.commit, status: 'completed', conclusion: 'success' }], postmerge: { ref: 'refs/heads/main', commit: merged.commit, tree: merged.tree, orderedParents: merged.parents } };
  const bootstrapOperation = { kind: 'verifier-bootstrap', action: 'postmerge', source: sourceRecord(root), git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 1, mergeMethod: 'merge' } }, permittedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], authorizedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], observedChangedPaths: changedPaths(root, authorityCommit, topic) };
  const bootstrapResult = verifyR1ContinuousExecution(root, bootstrapOperation, { testOnlyObservation: true, observationRunner: () => bootstrapObservation });
  const bootstrapReceiptBytes = bytesOf(canonicalJson(bootstrapResult));
  writeFileSync(join(taskRoot(root), 'bootstrap-receipt.json'), bootstrapReceiptBytes);
  execFileSync('git', ['-C', root, 'branch', 'main', merged.commit], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'checkout', '-B', `codex/r1-change-intent-work-${counter++}`, 'main'], { stdio: 'pipe' });
  return root;
}

function commitFile(root, path, bytes, message) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), bytes);
  execFileSync('git', ['-C', root, 'add', path]);
  execFileSync('git', ['-C', root, 'commit', '-m', message], { stdio: 'pipe' });
}

function prebootstrapTopologyRoot({ synthetic = false, wrongParentOrder = false, nonSoleTopic = false, treeMismatch = false, foreign = false, partial = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'core-ui-r1-prebootstrap-topology-'));
  execFileSync('git', ['clone', '--local', repositoryRoot, root], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'r1-prebootstrap@example.invalid']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'R1 pre-bootstrap topology fixture']);
  const branch = `codex/r1-prebootstrap-${counter++}`;
  execFileSync('git', ['-C', root, 'checkout', '-B', branch, authorityCommit], { stdio: 'pipe' });
  const policyPath = 'tooling/audits/repository-policy/repository-policy.json';
  const selected = partial ? [policyPath, R1_CONTINUOUS_EXECUTION.bootstrapWriteSet.find((path) => path !== policyPath)] : [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet];
  for (const path of new Set(selected)) cpSync(join(repositoryRoot, path), join(root, path));
  if (foreign) {
    writeFileSync(join(root, 'packages/react/src/prebootstrap-foreign.mjs'), bytesOf('export const prebootstrapForeign = true;\n'));
    selected.push('packages/react/src/prebootstrap-foreign.mjs');
  }
  execFileSync('git', ['-C', root, 'add', ...selected]);
  execFileSync('git', ['-C', root, 'commit', '-m', 'test: pre-bootstrap topology topic'], { stdio: 'pipe' });
  let topic = state(root).commit;
  if (nonSoleTopic) {
    const path = R1_CONTINUOUS_EXECUTION.bootstrapWriteSet.find((candidate) => candidate !== policyPath);
    const bytes = readFileSync(join(root, path));
    commitFile(root, path, Buffer.concat([bytes, Buffer.from('\n')]), 'test: non-sole-child topic');
    topic = state(root).commit;
  }
  if (!synthetic) return { root, topic };
  let mergeTree = git(root, 'rev-parse', `${topic}^{tree}`);
  if (treeMismatch) {
    const path = R1_CONTINUOUS_EXECUTION.bootstrapWriteSet.find((candidate) => candidate !== policyPath);
    writeFileSync(join(root, path), Buffer.concat([readFileSync(join(root, path)), Buffer.from('\n')]));
    execFileSync('git', ['-C', root, 'add', path], { stdio: 'pipe' });
    mergeTree = git(root, 'write-tree');
    execFileSync('git', ['-C', root, 'reset', '--hard', topic], { stdio: 'pipe' });
  }
  const parents = wrongParentOrder ? ['-p', topic, '-p', authorityCommit] : ['-p', authorityCommit, '-p', topic];
  const syntheticCommit = execFileSync('git', ['-C', root, 'commit-tree', mergeTree, ...parents], { input: 'test: synthetic prerequisite merge\n', encoding: 'utf8' }).trim();
  execFileSync('git', ['-C', root, 'checkout', '--detach', syntheticCommit], { stdio: 'pipe' });
  return { root, topic, syntheticCommit };
}

async function reviewFixture(root, role, actual, intent, workClass = 'renderer-behavior') {
  const contract = await loadDeliveryProfile(root);
  const envelope = JSON.parse(readFileSync(join(taskRoot(root), intent.path.slice('.git/core-ui-r1/'.length)), 'utf8'));
  const diff = gitBytes(root, 'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${actual.base}..${actual.commit}`, '--');
  const { record, records } = buildAuthoredRecord(contract, { stage: 'PACKET_RENDERED', workClass });
  const raw = new Map();
  const addRaw = (id, value, profile = value.profile) => {
    records.set(id, value);
    const bytes = bytesOf(canonicalJson(value));
    const identity = { id, profile, digest: sha256(bytes), byteLength: bytes.byteLength };
    raw.set(id, { value, bytes, identity });
    return { byteLength: bytes.byteLength, recordDigest: sha256(canonicalJson(value)), recordId: id, recordProfile: profile };
  };
  const present = (reference) => ({ ...reference, status: 'present' });
  const source = addRaw('source', { profile: 'core-ui-git-source-identity-v1', source: { commit: actual.commit, tree: actual.tree } });
  const artifactSet = present(addRaw('artifacts', { profile: 'core-ui-artifact-manifest-v1', paths: envelope.proposal.afterImages.map(({ path }) => path) }));
  const diffRaw = addRaw('diff-output', { profile: 'core-ui-git-diff-v1', base: actual.base, commit: actual.commit, digest: sha256(diff), byteLength: diff.byteLength });
  const evidence = addRaw('evidence-output', { profile: 'core-ui-evidence-set-v1', command: 'evidence', exitState: 0, source: actual });
  const deterministicResults = envelope.checks.map(({ command }, index) => {
    const commandRecord = commandContract(root, command);
    contract.commands.set(commandRecord.commandId, commandRecord);
    const output = addRaw(`check-output-${index}`, { profile: 'core-ui-deterministic-result-v1', command, exitState: 0, source: actual });
    return { commandId: commandRecord.commandId, commandRecordDigest: commandRecord.digest, commandRecordId: commandRecord.id, commandRecordProfile: commandRecord.value.profile, exitState: 0, output, ownerRef: commandRecord.value.ownerRef };
  });
  const output = addRaw('operation-output', { profile: 'core-ui-derived-output-v1', operation: envelope.operation.kind, exitState: 0, source: actual });
  const packetInput = {
    deterministicResults,
    profile: 'core-ui-delivery-packet-render-input-v1',
    renderedPrBody: undefined,
    reviewPhase: 'post-proof-review',
    reviewedObject: {
      artifactSet,
      diff: present(addRaw('diff', { profile: 'core-ui-git-diff-v1', base: actual.base, commit: actual.commit, digest: sha256(diff), byteLength: diff.byteLength })),
      evidence: present(evidence),
      output: present(output),
      source,
    },
  };
  const bodySeed = addRaw('body', { profile: 'core-ui-pr-body-v1', packet: role });
  packetInput.renderedPrBody = bodySeed;
  const first = renderDeliveryPacket(contract, record, packetInput, { records });
  const body = addRaw('body', JSON.parse(first.body), 'core-ui-pr-body-v1');
  packetInput.renderedPrBody = body;
  const rendered = renderDeliveryPacket(contract, record, packetInput, { records });
  record.packet = rendered.packet;
  const packet = taskRecord(root, rendered.packet, `${role}-packet.json`);
  const reviewedIdentities = [
    { id: intent.path, digest: intent.digest },
    { id: `git-diff:${actual.base}..${actual.commit}`, digest: sha256(diff) },
    ...envelope.proposal.afterImages.map(({ path, digest }) => ({ id: path, digest })),
  ];
  const proofs = [];
  for (const [id, value] of raw) {
    const proof = taskRecord(root, { profile: 'core-ui-deterministic-proof-v1', role, source: actual, subject: value.identity }, `${role}-${id}-proof.json`);
    proofs.push(proof);
    reviewedIdentities.push({ id: value.identity.id, digest: value.identity.digest });
    reviewedIdentities.push({ id: proof.path, digest: proof.digest });
  }
  reviewedIdentities.push({ id: packet.path, digest: packet.digest });
  const reviewerIdentity = role === 'core-ui-evidence-reviewer' ? '/root/reviewer/evidence' : '/root/reviewer/renderer';
  const review = taskRecord(root, {
    profile: 'core-ui-advisory-review-result-v1',
    role,
    outcome: 'clear',
    independence: 'independent',
    outputClassification: 'advisory-only',
    reviewerIdentity,
    ownerRef: 'repository-policy-owner',
    reviewedSource: { commit: actual.commit, tree: actual.tree },
    reviewedIdentities,
    packet: { profile: 'core-ui-review-packet-v1', id: rendered.packet.id, digest: packet.digest, reviewPhase: 'post-proof-review' },
    authorityAndEvidenceInspected: ['authority', 'envelope', 'diff'],
    deterministicProofStillRequired: ['focused checks'],
    disclosure: { audience: ['repository'], class: 'public-repository-sanitized', expiry: 'never', retention: 'git' },
    humanDecision: { owner: 'Andrew', ownerDocumentDigest: sha256(bytesOf('owner')), ownerRef: 'repository-policy-owner', ownerSelector: '/acceptanceTopology/owner', recommendation: 'accept', recordDigest: null, recordId: null, recordProfile: null, recordedDecision: 'pending', required: true },
    trackerReconciliation: 'none',
    scopeNotReviewed: ['publication'],
    findings: [],
  }, `${role}.json`);
  const assignmentPreimage = {
    profile: 'core-ui-advisory-review-assignment-v1',
    ownerRef: 'repository-policy-owner',
    independence: true,
    role,
    reviewerIdentity,
  };
  const assignmentRecord = taskRecord(root, assignmentPreimage, `${role}-assignment-record.json`);
  const assignment = {
    assignmentOwnerRef: assignmentPreimage.ownerRef,
    assignmentRecordDigest: assignmentRecord.digest,
    assignmentRecordProfile: assignmentPreimage.profile,
    assignmentRecordRef: assignmentRecord.path,
    independence: assignmentPreimage.independence,
    reviewerIdentity: assignmentPreimage.reviewerIdentity,
    role: assignmentPreimage.role,
  };
  const reviewInput = taskRecord(root, { role, reviewedSource: { commit: actual.commit, tree: actual.tree }, reviewedIdentities, packet, proof: proofs, deterministicResults }, `${role}-review-input.json`);
  return { review, assignment, reviewInput };
}

function completedDeterministicRecord(root, envelopeDigest, head, tree, command, envelopeSource) {
  const commandRecord = commandContract(root, command);
  const output = (text) => ({ profile: 'core-ui-command-output-v1', encoding: 'utf8', text, digest: sha256(bytesOf(text)), byteLength: Buffer.byteLength(text) });
  const source = { commit: git(root, 'rev-parse', 'HEAD'), tree: git(root, 'rev-parse', 'HEAD^{tree}') };
  const stdout = output('');
  const stderr = output('');
  const producerSourcePath = 'packages/tooling/src/change-intent.mjs';
  const producerSource = readFileSync(join(root, producerSourcePath));
  const producer = { profile: 'core-ui-command-producer-v1', id: 'core-ui-tooling-command-contract', version: '1', sourcePath: producerSourcePath, sourceDigest: sha256(producerSource), sourceByteLength: producerSource.byteLength };
  const preimageValue = { profile: 'core-ui-command-result-preimage-v1', command, source, stdout, stderr, exitState: 0, producer };
  const preimageBytes = bytesOf(canonicalJson(preimageValue));
  const preimage = taskRecord(root, preimageValue, `completed-preimage-${counter++}.json`);
  const runtime = commandRuntimeIdentity(root, envelopeSource);
  const procedure = commandProcedureIdentity(root, command, source, runtime);
  return { profile: 'core-ui-deterministic-result-v1', envelopeDigest, head, tree, command, commandId: commandRecord.commandId, commandRecordDigest: commandRecord.digest, commandRecordProfile: commandRecord.value.profile, ownerRef: commandRecord.value.ownerRef, source, runtime, procedure, proofTool: { profile: 'core-ui-proof-tool-identity-v1', id: 'proof-tool', version: '1', executablePath: 'tooling/audits/repository-policy/src/evidence-verify.mjs', executableSha256: sha256(readFileSync(join(root, 'tooling/audits/repository-policy/src/evidence-verify.mjs'))) }, result: { profile: 'core-ui-command-result-v1', status: 'passed', producer, preimage, digest: sha256(preimageBytes), byteLength: preimageBytes.byteLength }, stdout, stderr, exitState: 0 };
}

function completedResultInput(root, envelope, operationKind) {
  const current = state(root);
  const base = operationKind === 'component-implementation'
    ? git(root, 'rev-parse', 'refs/remotes/origin/main')
    : current.base;
  const head = { path: 'git-head', digest: sha256(bytesOf(current.commit)), byteLength: Buffer.byteLength(current.commit) };
  const tree = { path: 'git-tree', digest: sha256(bytesOf(current.tree)), byteLength: Buffer.byteLength(current.tree) };
  const diffBytes = gitBytes(root, 'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${base}..${current.commit}`, '--');
  const diff = { path: 'git-diff', digest: sha256(diffBytes), byteLength: diffBytes.byteLength };
  const { intentId: ignoredIntentId, ...intentPreimage } = envelope;
  void ignoredIntentId;
  const subject = { algorithm: 'sha256', digest: envelope.intentId, byteLength: Buffer.byteLength(canonicalJson(intentPreimage)) };
  const operationJournal = taskRecord(root, { profile: 'core-ui-change-intent-operation-journal-v1', envelopeDigest: envelope.intentId, head, tree, operationKind, status: 'passed' }, `${operationKind}-completed-journal.json`);
    const deterministicResults = envelope.checks.map(({ command }, index) => taskRecord(root, completedDeterministicRecord(root, envelope.intentId, head, tree, command, envelope.source), `${operationKind}-completed-check-${index}.json`));
  const reviewedInputs = [taskRecord(root, { profile: 'core-ui-review-input-v1', envelopeDigest: envelope.intentId, head, tree, subject }, `${operationKind}-completed-review.json`)];
  return { envelopeDigest: envelope.intentId, head, tree, diff, changedPaths: changedPaths(root, base, current.commit), operationJournal, deterministicResults, reviewedInputs };
}

async function componentFixture(root) {
  try { symlinkSync(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'dir'); } catch { /* fixture clone may already have dependencies */ }
  writeFileSync(join(root, '.git', 'info', 'exclude'), 'node_modules\n/node_modules/\n', { flag: 'a' });
  const lock = lockRecord(root, { family: 'Button' }, 'lock.json');
  const after = bytesOf('export const changeIntentFixture = true;\n');
  const record = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
  const produced = await previewChangeIntentEnvelope({
    repositoryRoot: root,
    operation: {
      kind: 'component-implementation',
      target: { family: 'Button' },
      lock,
    afterImages: [{ path: 'packages/react/src/Button.mjs', bytes: after, record }],
    },
  });
  commitFile(root, 'packages/react/src/Button.mjs', after, 'test: component fixture');
  const completed = await previewChangeIntentEnvelope({
    repositoryRoot: root,
    operation: {
      kind: 'component-implementation',
      target: { family: 'Button' },
      lock,
      afterImages: [{ path: 'packages/react/src/Button.mjs', bytes: after, record }],
      completedResult: completedResultInput(root, produced.envelope, 'component-implementation'),
    },
  });
  const intent = taskRecord(root, completed.envelope, 'intent.json');
  const current = state(root);
  const source = sourceRecord(root);
  const reviews = await Promise.all(['core-ui-evidence-reviewer', 'core-ui-renderer-reviewer'].map((role) => reviewFixture(root, role, current, intent)));
  const operation = {
    kind: 'component-implementation',
    source,
    intent,
    lock,
    permittedWriteSet: ['packages/react/src/Button.mjs'],
    authorizedWriteSet: ['packages/react/src/Button.mjs'],
    review: reviews.map(({ review }) => review),
    reviewAssignments: reviews.map(({ assignment }) => assignment),
    reviewInputs: reviews.map(({ reviewInput }) => reviewInput),
    observedChangedPaths: ['packages/react/src/Button.mjs'],
    bootstrapReceipt: descriptor('.git/core-ui-r1/bootstrap-receipt.json', readFileSync(join(taskRoot(root), 'bootstrap-receipt.json'))),
  };
  return { operation, current, intent, lock, produced: completed };
}

test('completed catalog operation binds the exact generator-derived projection closure', async () => {
  const root = cloneAuthority();
  try {
    try { symlinkSync(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'dir'); } catch { /* fixture clone may already have dependencies */ }
    writeFileSync(join(root, '.git', 'info', 'exclude'), 'node_modules\n/node_modules/\n', { flag: 'a' });
    const lock = lockRecord(root, { family: 'Button' }, 'catalog-projection-lock.json');
    const record = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
    record.summary = `${record.summary} (generator projection fixture)`;
    const after = bytesOf(canonicalJson(record));
    const produced = await previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: 'Button' }, lock, afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: after }] } });
    const policy = JSON.parse(readFileSync(join(root, 'tooling/audits/repository-policy/repository-policy.json'), 'utf8'));
    const expectedProjectionPaths = policy.generatorProjectionGroups.flatMap(({ outputs }) => outputs).sort();
    assert.deepEqual(produced.envelope.affected.generatedProjections, expectedProjectionPaths);
    writeFileSync(join(root, 'catalog/components/button/artifact.json'), after);
    execFileSync(process.execPath, ['packages/catalog/src/generate.mjs'], { cwd: root, env: { ...process.env, PATH: `${resolve(process.execPath, '..')}:${process.env.PATH ?? ''}` }, stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'add', 'catalog/components/button/artifact.json', 'packages/catalog/generated']);
    execFileSync('git', ['-C', root, 'commit', '-m', 'test: generated catalog projections'], { stdio: 'pipe' });
    const completed = await previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: 'Button' }, lock, afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: after }], completedResult: completedResultInput(root, produced.envelope, 'component-implementation') } });
    const intent = taskRecord(root, completed.envelope, 'catalog-projection-intent.json');
    const current = state(root);
    const reviews = await Promise.all(['core-ui-evidence-reviewer', 'core-ui-renderer-reviewer'].map((role) => reviewFixture(root, role, current, intent)));
    const operation = { kind: 'component-implementation', source: sourceRecord(root), intent, lock, permittedWriteSet: ['catalog/components/button/artifact.json'], authorizedWriteSet: ['catalog/components/button/artifact.json'], review: reviews.map(({ review }) => review), reviewAssignments: reviews.map(({ assignment }) => assignment), reviewInputs: reviews.map(({ reviewInput }) => reviewInput), observedChangedPaths: changedPaths(root, git(root, 'rev-parse', 'refs/remotes/origin/main'), current.commit), bootstrapReceipt: descriptor('.git/core-ui-r1/bootstrap-receipt.json', readFileSync(join(taskRoot(root), 'bootstrap-receipt.json'))) };
    const passed = await verifyR1ContinuousExecutionWithDeliveryProfile(root, operation, bootstrapOptions(root));
    assert.deepEqual(passed.authorizedWriteSet, ['catalog/components/button/artifact.json']);
    assert.deepEqual(passed.observedChangedPaths, changedPaths(root, git(root, 'rev-parse', 'refs/remotes/origin/main'), current.commit));
    writeFileSync(join(root, 'packages/catalog/generated/stale-projection.json'), '{}\n');
    execFileSync('git', ['-C', root, 'add', 'packages/catalog/generated/stale-projection.json']);
    execFileSync('git', ['-C', root, 'commit', '-m', 'test: stale generated projection'], { stdio: 'pipe' });
    assert.throws(() => verifyR1ContinuousExecution(root, { ...operation, source: sourceRecord(root) }, bootstrapOptions(root)), (error) => ['R1_CONTINUOUS_CHANGE_INTENT_WRITE_SET_INVALID', 'CORE_CHANGE_INTENT_RESULT_INVALID'].includes(error.code));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

async function retainedEvidenceOperationFixture(root) {
  try { symlinkSync(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'dir'); } catch { /* clone fixtures normally omit dependencies */ }
  mkdirSync(join(root, 'node_modules', '@core-ui'), { recursive: true });
  writeFileSync(join(root, '.git', 'info', 'exclude'), 'node_modules\n/node_modules/\n', { flag: 'a' });
  for (const packageName of ['catalog', 'schema', 'tokens', 'tooling']) {
    const packageLink = join(root, 'node_modules', '@core-ui', packageName);
    rmSync(packageLink, { recursive: true, force: true });
    cpSync(join(root, 'packages', packageName), packageLink, { recursive: true });
  }
  const target = { family: 'Button' };
  const lock = lockRecord(root, target, 'retained-evidence-lock.json');
  const source = state(root);
  const evidenceRoot = 'tests/evidence/r1.1-retained';
  const proofToolPath = 'tooling/audits/repository-policy/src/evidence-verify.mjs';
  const rawPath = `${evidenceRoot}/validation/evidence.txt`;
  const rawBefore = execFileSync(process.execPath, [realpathSync(join(root, proofToolPath))], { cwd: root, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
  const rawOutput = rawBefore.toString('utf8').replace(/verified (\d+) immutable index/u, (_, count) => `verified ${Number(count) + 1} immutable index`).replace(/, (\d+) records/u, (_, count) => `, ${Number(count) + 1} records`).replace(/, (\d+) artifacts/u, (_, count) => `, ${Number(count) + 1} artifacts`);
  const rawBytes = bytesOf(rawOutput || 'evidence verification passed\n');
  const rawOutputRef = { path: rawPath, sha256: sha256(rawBytes), byteLength: rawBytes.byteLength };
  const validation = {
    schema: 'core-ui-evidence-validation-v1',
    sourceRevision: source.commit,
    sourceTree: source.tree,
    executedRevision: source.commit,
    executedTree: source.tree,
    proofTool: { profile: 'core-ui-proof-tool-identity-v1', id: 'proof-tool', version: '1', executablePath: proofToolPath, executableSha256: sha256(readFileSync(join(root, proofToolPath))) },
    executionEnvironment: { profile: 'core-ui-proof-execution-environment-v1', variables: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH ?? '', TZ: 'UTC' } },
    results: [{ command: 'node tooling/audits/repository-policy/src/evidence-verify.mjs', exitState: 0, rawOutput: rawOutputRef }],
  };
  const validationBytes = bytesOf(canonicalJson(validation));
  const validationRef = { path: `${evidenceRoot}/validation.json`, sha256: sha256(validationBytes), byteLength: validationBytes.byteLength };
  const artifact = { schema: 'core-ui-evidence-artifact-v1', sourceRevision: source.commit, sourceTree: source.tree, executedRevision: source.commit, executedTree: source.tree, outcome: 'pass', exitState: 0 };
  const artifactBytes = bytesOf(canonicalJson(artifact));
  const artifactRef = { path: `${evidenceRoot}/artifacts/E-R1.1-01.json`, sha256: sha256(artifactBytes), byteLength: artifactBytes.byteLength };
  const record = { schema: 'core-ui-evidence-record-v1', assertionId: 'E-R1.1-01', sourceRevision: source.commit, sourceTree: source.tree, executedRevision: source.commit, executedTree: source.tree, outcome: 'pass', disclosureClass: 'public-sanitized', retentionPolicy: 'Content-addressed Git records', expiry: 'Any source, tool, environment, result, authority, or acceptance change', command: 'node tooling/audits/repository-policy/src/evidence-verify.mjs', validation: validationRef, artifact: artifactRef };
  const recordBytes = bytesOf(canonicalJson(record));
  const recordRef = { assertionId: 'E-R1.1-01', path: `${evidenceRoot}/records/E-R1.1-01.json`, sha256: sha256(recordBytes), byteLength: recordBytes.byteLength };
  const index = { schema: 'core-ui-evidence-index-v1', sourceRevision: source.commit, sourceTree: source.tree, executedRevision: source.commit, executedTree: source.tree, milestone: 'R1.1', disclosureClass: 'public-sanitized', retentionPolicy: 'Content-addressed Git records', expiry: 'Any source, tool, environment, result, authority, or acceptance change', validation: validationRef, records: [recordRef] };
  const indexBytes = bytesOf(canonicalJson(index));
  const evidence = { path: `${evidenceRoot}/index.json`, digest: sha256(indexBytes), byteLength: indexBytes.byteLength };
  const afterImages = [
    { path: evidence.path, bytes: indexBytes },
    { path: validationRef.path, bytes: validationBytes },
    { path: rawPath, bytes: rawBytes },
    { path: recordRef.path, bytes: recordBytes },
    { path: artifactRef.path, bytes: artifactBytes },
  ];
  const depsPath = join(root, 'node_modules');
  const parkedDepsPath = join(root, '.git', 'core-ui-r1', 'node_modules');
  renameSync(depsPath, parkedDepsPath);
  const produced = await previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'retained-evidence-acceptance', target, lock, evidence, afterImages } });
  renameSync(parkedDepsPath, depsPath);
  for (const image of afterImages) {
    mkdirSync(join(root, image.path, '..'), { recursive: true });
    writeFileSync(join(root, image.path), image.bytes);
  }
  execFileSync('git', ['-C', root, 'add', ...afterImages.map(({ path }) => path)]);
  execFileSync('git', ['-C', root, 'commit', '-m', 'test: retained R1.1 evidence root'], { stdio: 'pipe' });
  const current = state(root);
  const completed = await previewChangeIntentEnvelope({
    repositoryRoot: root,
    operation: {
      kind: 'retained-evidence-acceptance',
      target,
      lock,
      evidence,
      afterImages,
      completedResult: completedResultInput(root, produced.envelope, 'retained-evidence-acceptance'),
    },
  });
  const intent = taskRecord(root, completed.envelope, 'retained-evidence-intent.json');
  const sourceRecordValue = sourceRecord(root);
  const review = await reviewFixture(root, 'core-ui-evidence-reviewer', current, intent, 'evidence-required');
  const bootstrapReceipt = descriptor('.git/core-ui-r1/bootstrap-receipt.json', readFileSync(join(taskRoot(root), 'bootstrap-receipt.json')));
  const diffBytes = gitBytes(root, 'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${current.base}..${current.commit}`, '--');
  const diff = { path: `git-diff:${current.base}..${current.commit}`, digest: sha256(diffBytes), byteLength: diffBytes.byteLength };
  const resultPayload = { profile: 'core-ui-r1-continuous-execution-v1', operationKind: 'retained-evidence-acceptance', envelope: completed.identity, diff, afterImages: completed.envelope.proposal.afterImages, source: { commit: current.commit, tree: current.tree }, bootstrapReceipt, authorizedWriteSet: completed.writeSet, permittedWriteSet: completed.writeSet, observedChangedPaths: changedPaths(root, current.base, current.commit), result: { code: 'R1_CONTINUOUS_OPERATION_PASSED', status: 'passed' } };
  const result = { ...resultPayload, outputIdentity: { algorithm: 'sha256', digest: sha256(canonicalJson(resultPayload)), byteLength: Buffer.byteLength(canonicalJson(resultPayload)) } };
  const operation = { kind: 'retained-evidence-acceptance', source: sourceRecordValue, intent, lock, evidence, permittedWriteSet: produced.writeSet, authorizedWriteSet: produced.writeSet, review: [review.review], reviewAssignments: [review.assignment], reviewInputs: [review.reviewInput], observedChangedPaths: changedPaths(root, current.base, current.commit), bootstrapReceipt, result: taskRecord(root, result, 'retained-evidence-result.json') };
  return { operation, evidence, produced: completed };
}

test('R1 policy entrypoint remains fail-closed and no-op without operation mode', () => {
  const result = verifyR1ContinuousExecutionPolicyGate(repositoryRoot, {});
  assert.deepEqual(result, { profile: 'core-ui-r1-continuous-execution-verifier-v1', mode: 'ready', status: 'no-op' });
  assert.equal(Object.hasOwn(result, 'result'), false);
  assert.throws(
    () => verifyR1ContinuousExecutionPolicyGate(repositoryRoot, { CORE_UI_R1_OPERATION_REQUIRED: '1' }),
    (error) => error.code === 'R1_CONTINUOUS_POLICY_GATE_INPUT_MISSING',
  );
});

test('admitted prerequisite bootstrap passes with the exact eight-path implementation set', () => {
  const root = mkdtempSync(join(tmpdir(), 'core-ui-r1-bootstrap-'));
  try {
    execFileSync('git', ['clone', '--local', repositoryRoot, root], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'config', 'user.email', 'bootstrap@example.invalid']);
    execFileSync('git', ['-C', root, 'config', 'user.name', 'Bootstrap fixture']);
    execFileSync('git', ['-C', root, 'checkout', '-B', `codex/r1-bootstrap-${counter++}`, authorityCommit], { stdio: 'pipe' });
    for (const path of R1_CONTINUOUS_EXECUTION.bootstrapWriteSet) cpSync(join(repositoryRoot, path), join(root, path));
    execFileSync('git', ['-C', root, 'add', ...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet]);
    execFileSync('git', ['-C', root, 'commit', '-m', 'test: exact eight-path bootstrap'], { stdio: 'pipe' });
    const topic = state(root);
    execFileSync('git', ['-C', root, 'branch', 'main', authorityCommit]);
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'merge', '--no-ff', '--no-edit', topic.commit], { stdio: 'pipe' });
    const merged = state(root);
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', merged.commit]);
    execFileSync('git', ['-C', root, 'checkout', `codex/r1-bootstrap-${counter - 1}`], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'branch', '-D', 'main'], { stdio: 'pipe' });
    const source = sourceRecord(root);
    const requiredChecks = ['Repository policy'];
    const requiredChecksIdentity = { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks, requiredReviews: [] })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks, requiredReviews: [] })) };
    const observation = { provider: 'github', repository: 'ndrewtran/core-ui', defaultBranch: 'main', protectedRef: 'refs/heads/main', protection: { classic: true, enforceAdmins: true, activeRulesets: [] }, pullRequest: { number: 1, headCommit: topic.commit, baseCommit: authorityCommit, baseRefName: 'main', merged: true, mergeCommit: merged.commit }, requiredChecks, requiredChecksIdentity, requiredReviews: [], requiredReviewsSatisfied: true, requiredReviewBots: [], reviewBots: [], reviews: [], rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256('bootstrap-provider'), byteLength: Buffer.byteLength('bootstrap-provider') }, normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256('bootstrap-normalized'), byteLength: Buffer.byteLength('bootstrap-normalized') }, checks: [{ name: 'Repository policy', headCommit: merged.commit, status: 'completed', conclusion: 'success' }], postmerge: { ref: 'refs/heads/main', commit: merged.commit, tree: merged.tree, orderedParents: merged.parents } };
    const operation = { kind: 'verifier-bootstrap', action: 'postmerge', source, git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 1, mergeMethod: 'merge' } }, permittedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], authorizedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], observedChangedPaths: changedPaths(root, authorityCommit, topic.commit) };
    assert.equal(verifyR1ContinuousExecution(root, operation, { testOnlyObservation: true, observationRunner: () => observation }).result.code, 'R1_CONTINUOUS_BOOTSTRAP_PASSED');
    assert.throws(() => verifyR1ContinuousExecution(root, { ...operation, git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 2, mergeMethod: 'merge' } } }, { testOnlyObservation: true, observationRunner: () => ({ ...observation, pullRequest: { ...observation.pullRequest, number: 2, baseCommit: topic.commit } }) }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID');
    assert.equal(topic.base, authorityCommit);
    const extra = structuredClone(operation);
    extra.permittedWriteSet.push('packages/react/src/forged.mjs');
    assert.throws(() => verifyR1ContinuousExecution(root, extra), (error) => error.code === 'R1_CONTINUOUS_WRITE_SET_MISMATCH');
    execFileSync('git', ['-C', root, 'branch', 'main', merged.commit]);
    execFileSync('git', ['-C', root, 'checkout', '-B', `codex/r1-bootstrap-replay-${counter++}`, topic.commit], { stdio: 'pipe' });
    const replay = { ...operation, source: sourceRecord(root) };
    assert.throws(() => verifyR1ContinuousExecution(root, replay, { testOnlyObservation: true, observationRunner: () => observation }), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_CONSUMED');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('standard protected-main checkout verifies the discovered bootstrap merge once and rejects a topic replay', () => {
  const root = cloneAuthority();
  try {
    const receipt = JSON.parse(readFileSync(join(taskRoot(root), 'bootstrap-receipt.json'), 'utf8'));
    const operation = {
      kind: 'verifier-bootstrap',
      action: 'postmerge',
      source: undefined,
      git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: receipt.hosted.observation.pullRequest.number, mergeMethod: 'merge' } },
      permittedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet],
      authorizedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet],
      observedChangedPaths: [...receipt.observedChangedPaths],
    };
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    operation.source = sourceRecord(root);
    const verified = verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => structuredClone(receipt.hosted.observation) });
    assert.equal(verified.result.code, 'R1_CONTINUOUS_BOOTSTRAP_PASSED');
    assert.equal(verified.source.commit, receipt.hosted.observation.pullRequest.headCommit);

    execFileSync('git', ['-C', root, 'checkout', '-B', `codex/r1-bootstrap-replay-${counter++}`, receipt.source.commit], { stdio: 'pipe' });
    assert.throws(
      () => verifyR1ContinuousExecution(root, { ...operation, source: sourceRecord(root) }, bootstrapOptions(root)),
      (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_CONSUMED',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('bootstrap rejects omitted implementation paths and excluded index or README changes', () => {
  const variants = [
    { name: 'omitted-required', selected: R1_CONTINUOUS_EXECUTION.bootstrapWriteSet.slice(1) },
    { name: 'excluded-index', selected: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet, 'packages/tooling/src/index.mjs'], modify: 'packages/tooling/src/index.mjs' },
    { name: 'excluded-readme', selected: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet, 'tooling/audits/repository-policy/README.md'], modify: 'tooling/audits/repository-policy/README.md' },
  ];
  for (const variant of variants) {
    const root = mkdtempSync(join(tmpdir(), `core-ui-r1-bootstrap-${variant.name}-`));
    try {
      execFileSync('git', ['clone', '--local', repositoryRoot, root], { stdio: 'pipe' });
      execFileSync('git', ['-C', root, 'config', 'user.email', 'bootstrap@example.invalid']);
      execFileSync('git', ['-C', root, 'config', 'user.name', 'Bootstrap fixture']);
      const branch = `codex/r1-bootstrap-${variant.name}-${counter++}`;
      execFileSync('git', ['-C', root, 'checkout', '-B', branch, authorityCommit], { stdio: 'pipe' });
      for (const path of variant.selected) cpSync(join(repositoryRoot, path), join(root, path));
      if (variant.modify) writeFileSync(join(root, variant.modify), Buffer.concat([readFileSync(join(root, variant.modify)), bytesOf('\nfixture excluded path\n')]));
      execFileSync('git', ['-C', root, 'add', '-A']);
      execFileSync('git', ['-C', root, 'commit', '-m', `test: reject ${variant.name}`], { stdio: 'pipe' });
      const topic = state(root);
      execFileSync('git', ['-C', root, 'branch', 'main', authorityCommit]);
      execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
      execFileSync('git', ['-C', root, 'merge', '--no-ff', '--no-edit', topic.commit], { stdio: 'pipe' });
      const merged = state(root);
      execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', merged.commit]);
      execFileSync('git', ['-C', root, 'checkout', branch], { stdio: 'pipe' });
      const requiredChecks = ['Repository policy'];
      const requiredChecksIdentity = { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks, requiredReviews: [] })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks, requiredReviews: [] })) };
      const observation = { provider: 'github', repository: 'ndrewtran/core-ui', defaultBranch: 'main', protectedRef: 'refs/heads/main', protection: { classic: true, enforceAdmins: true, activeRulesets: [] }, pullRequest: { number: 1, headCommit: topic.commit, baseCommit: authorityCommit, baseRefName: 'main', merged: true, mergeCommit: merged.commit }, requiredChecks, requiredChecksIdentity, requiredReviews: [], requiredReviewsSatisfied: true, requiredReviewBots: [], reviewBots: [], reviews: [], rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256('bootstrap-provider'), byteLength: Buffer.byteLength('bootstrap-provider') }, normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256('bootstrap-normalized'), byteLength: Buffer.byteLength('bootstrap-normalized') }, checks: [{ name: 'Repository policy', headCommit: merged.commit, status: 'completed', conclusion: 'success' }], postmerge: { ref: 'refs/heads/main', commit: merged.commit, tree: merged.tree, orderedParents: merged.parents } };
      const operation = { kind: 'verifier-bootstrap', action: 'postmerge', source: sourceRecord(root), git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 1, mergeMethod: 'merge' } }, permittedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], authorizedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], observedChangedPaths: changedPaths(root, authorityCommit, topic.commit) };
      assert.throws(() => verifyR1ContinuousExecution(root, operation, { testOnlyObservation: true, observationRunner: () => observation }), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_TOPOLOGY_INVALID', variant.name);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('bootstrap rejects an unlisted eleventh actual path', () => {
  const root = cloneAuthority();
  try {
    const branch = `codex/r1-bootstrap-extra-${counter++}`;
    execFileSync('git', ['-C', root, 'checkout', '-B', branch, authorityCommit], { stdio: 'pipe' });
    for (const path of R1_CONTINUOUS_EXECUTION.bootstrapWriteSet) cpSync(join(repositoryRoot, path), join(root, path));
    writeFileSync(join(root, 'packages/react/src/unlisted-bootstrap.mjs'), bytesOf('export const unlisted = true;\n'));
    execFileSync('git', ['-C', root, 'add', ...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet, 'packages/react/src/unlisted-bootstrap.mjs']);
    execFileSync('git', ['-C', root, 'commit', '-m', 'test: unlisted bootstrap path'], { stdio: 'pipe' });
    const topic = state(root);
    execFileSync('git', ['-C', root, 'branch', '-f', 'main', authorityCommit], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'merge', '--no-ff', '--no-edit', topic.commit], { stdio: 'pipe' });
    const merged = state(root);
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', merged.commit]);
    execFileSync('git', ['-C', root, 'checkout', branch], { stdio: 'pipe' });
    const requiredChecks = ['Repository policy'];
    const requiredChecksIdentity = { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks, requiredReviews: [] })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks, requiredReviews: [] })) };
    const observation = { provider: 'github', repository: 'ndrewtran/core-ui', defaultBranch: 'main', protectedRef: 'refs/heads/main', protection: { classic: true, enforceAdmins: true, activeRulesets: [] }, pullRequest: { number: 1, headCommit: topic.commit, baseCommit: authorityCommit, baseRefName: 'main', merged: true, mergeCommit: merged.commit }, requiredChecks, requiredChecksIdentity, requiredReviews: [], requiredReviewsSatisfied: true, requiredReviewBots: [], reviewBots: [], reviews: [], rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256('bootstrap-provider'), byteLength: Buffer.byteLength('bootstrap-provider') }, normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256('bootstrap-normalized'), byteLength: Buffer.byteLength('bootstrap-normalized') }, checks: [{ name: 'Repository policy', headCommit: merged.commit, status: 'completed', conclusion: 'success' }], postmerge: { ref: 'refs/heads/main', commit: merged.commit, tree: merged.tree, orderedParents: merged.parents } };
    const operation = { kind: 'verifier-bootstrap', action: 'postmerge', source: sourceRecord(root), git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 1, mergeMethod: 'merge' } }, permittedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], authorizedWriteSet: [...R1_CONTINUOUS_EXECUTION.bootstrapWriteSet], observedChangedPaths: changedPaths(root, authorityCommit, topic.commit) };
    assert.throws(() => verifyR1ContinuousExecution(root, operation, { testOnlyObservation: true, observationRunner: () => observation }), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_TOPOLOGY_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('bootstrap receipt accepts a later origin/main descendant but rejects wrong lineage', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const workBranch = state(root).branch;
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    commitFile(root, 'strategy/r1-lineage-fixture.md', bytesOf('descendant\n'), 'test: advance protected main');
    const descendant = state(root).commit;
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', descendant]);
    execFileSync('git', ['-C', root, 'checkout', workBranch], { stdio: 'pipe' });
    const descendantOptions = bootstrapOptions(root, { recomputeIdentities: true });
    const originalObservation = bootstrapObservation(root);
    const descendantObservation = descendantOptions.bootstrapObservationRunner();
    assert.notEqual(descendantObservation.rawResponseIdentity.digest, originalObservation.rawResponseIdentity.digest);
    assert.notEqual(descendantObservation.normalizedResponseIdentity.digest, originalObservation.normalizedResponseIdentity.digest);
    assert.equal((await verifyR1ContinuousExecutionWithDeliveryProfile(root, fixture.operation, descendantOptions)).result.status, 'passed');
    const securityDriftOptions = bootstrapOptions(root, { recomputeIdentities: true });
    const stableRunner = securityDriftOptions.bootstrapObservationRunner;
    securityDriftOptions.bootstrapObservationRunner = () => {
      const observation = stableRunner();
      observation.protection.enforceAdmins = false;
      return observation;
    };
    assert.throws(
      () => verifyR1ContinuousExecution(root, fixture.operation, securityDriftOptions),
      (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_DRIFT',
    );
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', authorityCommit]);
    assert.throws(() => verifyR1ContinuousExecution(root, fixture.operation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_SOURCE_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('r1-lock binds an empty actual base..head diff', async () => {
  const root = cloneAuthority();
  try {
    execFileSync('git', ['-C', root, 'commit', '--allow-empty', '-m', 'test: empty R1 lock head'], { stdio: 'pipe' });
    const lockIntent = await previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'r1-lock', target: { family: 'Button' } } });
    const intent = taskRecord(root, lockIntent.envelope, 'r1-lock-intent.json');
    commitFile(root, 'packages/react/src/r1-lock-extra.mjs', bytesOf('export const extra = true;\n'), 'test: forged R1 lock path');
    const operation = {
      kind: 'r1-lock',
      source: sourceRecord(root),
      intent,
      permittedWriteSet: [],
      authorizedWriteSet: [],
      observedChangedPaths: [],
      review: [],
      reviewAssignments: [],
      reviewInputs: [],
      bootstrapReceipt: descriptor('.git/core-ui-r1/bootstrap-receipt.json', readFileSync(join(taskRoot(root), 'bootstrap-receipt.json'))),
    };
    assert.throws(() => verifyR1ContinuousExecution(root, operation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_R1_LOCK_DIFF_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normal policy gate derives post-bootstrap operation necessity from the actual diff', () => {
  const root = cloneAuthority();
  try {
    commitFile(root, 'packages/react/src/gate-relevant.mjs', bytesOf('export const gateRelevant = true;\n'), 'test: gate relevant change');
    assert.throws(() => verifyR1ContinuousExecutionPolicyGate(root, {}), (error) => error.code === 'R1_CONTINUOUS_POLICY_GATE_OPERATION_REQUIRED');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normal policy gate rejects unbound repository policy paths instead of treating them as no-op', () => {
  for (const path of ['.github/workflows/forged.yml', 'package.json', 'pnpm-lock.yaml', 'AGENTS.md']) {
    const root = cloneAuthority();
    try {
      commitFile(root, path, bytesOf(path.endsWith('.yml') ? 'name: forged\n' : 'forged\n'), `test: unbound ${path}`);
      assert.throws(() => verifyR1ContinuousExecutionPolicyGate(root, {}), (error) => error.code === 'R1_CONTINUOUS_POLICY_GATE_OPERATION_REQUIRED', path);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('normal policy gate ignores a candidate-supplied no-op prefix and rejects its self-exemption', () => {
  const root = cloneAuthority();
  try {
    const policy = JSON.parse(readFileSync(join(root, 'tooling/audits/repository-policy/repository-policy.json'), 'utf8'));
    policy.r1ContinuousExecution.policyGate.noOpPrefixes = ['packages/tooling/'];
    commitFile(root, 'tooling/audits/repository-policy/repository-policy.json', bytesOf(canonicalJson(policy)), 'test: forge no-op prefix');
    commitFile(root, 'notes/forged-no-op.txt', bytesOf('must not self-exempt\n'), 'test: forge no-op tip');
    assert.throws(() => verifyR1ContinuousExecutionPolicyGate(root, {}), (error) => error.code === 'R1_CONTINUOUS_POLICY_INTEGRATION_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normal policy gate keeps a relevant earlier commit visible beneath an irrelevant tip', () => {
  const root = cloneAuthority();
  try {
    commitFile(root, 'packages/react/src/cumulative-gate-relevant.mjs', bytesOf('export const cumulativeGateRelevant = true;\n'), 'test: first relevant gate change');
    commitFile(root, 'notes/r1-gate-irrelevant.txt', bytesOf('tip only\n'), 'test: unrelated tip change');
    assert.throws(
      () => verifyR1ContinuousExecutionPolicyGate(root, {}),
      (error) => error.code === 'R1_CONTINUOUS_POLICY_GATE_OPERATION_REQUIRED',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normal main gate uses the current event boundary after a verified relevant history', () => {
  const root = cloneAuthority();
  try {
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    commitFile(root, 'packages/react/src/main-gate-relevant.mjs', bytesOf('export const mainGateRelevant = true;\n'), 'test: relevant main gate change');
    assert.throws(
      () => verifyR1ContinuousExecutionPolicyGate(root, {}),
      (error) => error.code === 'R1_CONTINUOUS_POLICY_GATE_OPERATION_REQUIRED',
    );

    // The protected provider boundary advances only after that event has
    // been verified. A later ordinary main commit must not reopen history
    // back to the bootstrap merge.
    const verifiedHead = state(root).commit;
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', verifiedHead], { stdio: 'pipe' });
    commitFile(root, 'notes/r1-main-gate-irrelevant.txt', bytesOf('ordinary main tip\n'), 'test: unrelated main tip');
    assert.deepEqual(verifyR1ContinuousExecutionPolicyGate(root, {}), { profile: 'core-ui-r1-continuous-execution-verifier-v1', mode: 'ready', status: 'no-op' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('component verification uses the protected baseline and rejects a hidden earlier topic commit', async () => {
  const root = cloneAuthority();
  try {
    commitFile(root, 'packages/react/src/hidden-earlier-change.mjs', bytesOf('export const hiddenEarlierChange = true;\n'), 'test: hidden earlier topic change');
    await assert.rejects(
      () => componentFixture(root),
      (error) => error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('direct repository-policy R1 operation entrypoint confines descriptors to the task root', () => {
  const root = cloneAuthority();
  try {
    const cli = resolve(repositoryRoot, 'tooling/audits/repository-policy/src/cli.mjs');
    const result = spawnSync(process.execPath, [cli, '--r1-operation', resolve(root, 'outside-operation.json')], {
      cwd: root,
      env: { ...process.env, CORE_UI_REPOSITORY: root },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /R1_CONTINUOUS_(?:POLICY_GATE_INPUT_MISSING|PATH_INVALID)/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('direct repository-policy CLI rejects hostile runtime injection before verifier imports', () => {
  const cli = resolve(repositoryRoot, 'tooling/audits/repository-policy/src/cli.mjs');
  const result = spawnSync(process.execPath, [cli], {
    cwd: repositoryRoot,
    env: { ...process.env, CORE_UI_REPOSITORY: repositoryRoot, NODE_DEBUG: 'r1-test-injection' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /R1_CONTINUOUS_HOSTILE_ENV/u);
});

test('direct verifier executable rejects absolute, traversal, outside-root, and symlink inputs', () => {
  const root = cloneAuthority();
  try {
    const verifier = resolve(repositoryRoot, 'tooling/audits/repository-policy/src/r1-continuous-execution-verify.mjs');
    const task = taskRoot(root);
    const outside = resolve(root, 'outside-operation.json');
    writeFileSync(outside, '{}');
    const symlink = join(task, 'symlink-operation.json');
    symlinkSync(outside, symlink);
    for (const input of [resolve(task, 'operation.json'), '../outside-operation.json', '.git/core-ui-r1/symlink-operation.json']) {
      const result = spawnSync(process.execPath, [verifier, '--input', input], { cwd: root, env: { ...process.env, CORE_UI_REPOSITORY: root }, encoding: 'utf8' });
      assert.notEqual(result.status, 0, input);
      assert.match(`${result.stdout}${result.stderr}`, /R1_CONTINUOUS_(?:POLICY_GATE_INPUT_MISSING|PATH_INVALID)/u, input);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pre-bootstrap no-op is limited to the exact prerequisite topology', () => {
  const root = mkdtempSync(join(tmpdir(), 'core-ui-r1-unbootstrapped-'));
  try {
    execFileSync('git', ['clone', '--local', repositoryRoot, root], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'config', 'user.email', 'r1-unbootstrapped@example.invalid']);
    execFileSync('git', ['-C', root, 'config', 'user.name', 'R1 unbootstrapped fixture']);
    execFileSync('git', ['-C', root, 'checkout', '-B', `codex/r1-unbootstrapped-${counter++}`, authorityCommit], { stdio: 'pipe' });
    cpSync(join(repositoryRoot, 'tooling/audits/repository-policy/repository-policy.json'), join(root, 'tooling/audits/repository-policy/repository-policy.json'));
    execFileSync('git', ['-C', root, 'add', 'tooling/audits/repository-policy/repository-policy.json']);
    execFileSync('git', ['-C', root, 'commit', '-m', 'test: install policy gate fixture'], { stdio: 'pipe' });
    commitFile(root, 'packages/react/src/foreign-prebootstrap.mjs', bytesOf('export const foreignPrebootstrap = true;\n'), 'test: foreign pre-bootstrap change');
    assert.throws(
      () => verifyR1ContinuousExecutionPolicyGate(root, {}),
      (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_REQUIRED',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pre-bootstrap policy gate admits exact local and detached synthetic prerequisite topology', () => {
  const local = prebootstrapTopologyRoot();
  try {
    assert.deepEqual(verifyR1ContinuousExecutionPolicyGate(local.root, {}), { profile: 'core-ui-r1-continuous-execution-verifier-v1', mode: 'ready', status: 'no-op' });
  } finally { rmSync(local.root, { recursive: true, force: true }); }
  const synthetic = prebootstrapTopologyRoot({ synthetic: true });
  try {
    assert.equal(git(synthetic.root, 'branch', '--show-current'), '');
    assert.deepEqual(verifyR1ContinuousExecutionPolicyGate(synthetic.root, {}), { profile: 'core-ui-r1-continuous-execution-verifier-v1', mode: 'ready', status: 'no-op' });
  } finally { rmSync(synthetic.root, { recursive: true, force: true }); }
});

test('pre-bootstrap policy gate rejects malformed detached synthetic prerequisite topology', () => {
  for (const fixture of [
    { wrongParentOrder: true },
    { nonSoleTopic: true },
    { treeMismatch: true },
    { foreign: true },
    { partial: true, foreign: true },
  ]) {
    const root = prebootstrapTopologyRoot({ ...fixture, synthetic: true });
    try {
      assert.throws(() => verifyR1ContinuousExecutionPolicyGate(root.root, {}), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_REQUIRED', JSON.stringify(fixture));
    } finally { rmSync(root.root, { recursive: true, force: true }); }
  }
  const arbitrary = prebootstrapTopologyRoot({ synthetic: true });
  try {
    execFileSync('git', ['-C', arbitrary.root, 'checkout', '--detach', authorityCommit], { stdio: 'pipe' });
    cpSync(join(repositoryRoot, 'tooling/audits/repository-policy/repository-policy.json'), join(arbitrary.root, 'tooling/audits/repository-policy/repository-policy.json'));
    assert.throws(() => verifyR1ContinuousExecutionPolicyGate(arbitrary.root, {}), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_REQUIRED');
  } finally { rmSync(arbitrary.root, { recursive: true, force: true }); }
});

test('component operation binds exact ChangeIntent, lock, write set, and reviewer identities', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    assert.equal((await verifyR1ContinuousExecutionWithDeliveryProfile(root, fixture.operation, bootstrapOptions(root))).result.code, 'R1_CONTINUOUS_OPERATION_PASSED');
    const missingBootstrapReceipt = structuredClone(fixture.operation);
    delete missingBootstrapReceipt.bootstrapReceipt;
    assert.throws(() => verifyR1ContinuousExecution(root, missingBootstrapReceipt), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_RECEIPT_REQUIRED');
    const forgedBootstrapReceipt = JSON.parse(readFileSync(join(taskRoot(root), 'bootstrap-receipt.json'), 'utf8'));
    forgedBootstrapReceipt.hosted.observation.protection.enforceAdmins = false;
    const forgedBootstrapOperation = structuredClone(fixture.operation);
    forgedBootstrapOperation.bootstrapReceipt = taskRecord(root, forgedBootstrapReceipt, 'forged-bootstrap-receipt.json');
    const { outputIdentity: ignoredBootstrapIdentity, ...forgedBootstrapPayload } = forgedBootstrapReceipt;
    void ignoredBootstrapIdentity;
    forgedBootstrapReceipt.outputIdentity = { algorithm: 'sha256', digest: sha256(canonicalJson(forgedBootstrapPayload)), byteLength: Buffer.byteLength(canonicalJson(forgedBootstrapPayload)) };
    forgedBootstrapOperation.bootstrapReceipt = taskRecord(root, forgedBootstrapReceipt, 'forged-bootstrap-receipt-self-hashed.json');
    assert.throws(() => verifyR1ContinuousExecution(root, forgedBootstrapOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_DRIFT');
    const forgedOwner = structuredClone(fixture.operation);
    const forgedIntentPath = forgedOwner.intent.path;
    const forgedIntentFile = join(taskRoot(root), forgedIntentPath.slice('.git/core-ui-r1/'.length));
    const originalIntentBytes = readFileSync(forgedIntentFile);
    const forgedEnvelope = JSON.parse(originalIntentBytes.toString('utf8'));
    forgedEnvelope.owners[0].owner = '@core-ui/forged-owner';
    const { intentId: ignoredIntentId, result: ignoredResult, ...forgedPreimage } = forgedEnvelope;
    void ignoredIntentId;
    void ignoredResult;
    forgedEnvelope.intentId = sha256(canonicalJson(forgedPreimage));
    const forgedIntentBytes = bytesOf(canonicalJson(forgedEnvelope));
    writeFileSync(forgedIntentFile, forgedIntentBytes);
    forgedOwner.intent = descriptor(forgedIntentPath, forgedIntentBytes);
    assert.throws(
      () => verifyR1ContinuousExecution(root, forgedOwner, bootstrapOptions(root)),
      (error) => ['CORE_CHANGE_INTENT_DERIVATION_INVALID', 'CORE_CHANGE_INTENT_RESULT_INVALID'].includes(error.code),
    );
    writeFileSync(forgedIntentFile, originalIntentBytes);
    const mismatched = structuredClone(fixture.operation);
    mismatched.lock = taskRecord(root, { lock: 'different' }, 'different-lock.json');
    assert.throws(() => verifyR1ContinuousExecution(root, mismatched, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_CHANGE_INTENT_LOCK_INVALID');
    const fakePacket = structuredClone(fixture.operation);
    const originalInputPath = fakePacket.reviewInputs[0].path;
    const originalInputBytes = readFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)));
    const fakeInput = JSON.parse(originalInputBytes.toString('utf8'));
    fakeInput.packet = taskRecord(root, { profile: 'core-ui-review-packet-v1', id: 'forged-packet', reviewPhase: 'post-proof-review' }, 'forged-packet.json');
    const fakeInputBytes = bytesOf(canonicalJson(fakeInput));
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), fakeInputBytes);
    fakePacket.reviewInputs[0] = descriptor(originalInputPath, fakeInputBytes);
    assert.throws(() => verifyR1ContinuousExecution(root, fakePacket, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_REVIEW_PACKET_INVALID');
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), originalInputBytes);
    const fakeAssignmentOperation = structuredClone(fixture.operation);
    fakeAssignmentOperation.reviewAssignments[0].reviewerIdentity = '/root/reviewer/renderer';
    assert.throws(() => verifyR1ContinuousExecution(root, fakeAssignmentOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_REVIEW_ASSIGNMENT_INVALID');
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), originalInputBytes);
    const incompleteManifestOperation = structuredClone(fixture.operation);
    const incompleteManifestInput = JSON.parse(originalInputBytes.toString('utf8'));
    incompleteManifestInput.deterministicResults = incompleteManifestInput.deterministicResults.slice(1);
    const incompleteManifestBytes = bytesOf(canonicalJson(incompleteManifestInput));
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), incompleteManifestBytes);
    incompleteManifestOperation.reviewInputs[0] = descriptor(originalInputPath, incompleteManifestBytes);
    assert.throws(() => verifyR1ContinuousExecution(root, incompleteManifestOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_REVIEW_PROOF_INVALID');
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), originalInputBytes);
    const digestSubstitutionOperation = structuredClone(fixture.operation);
    const digestSubstitutionInput = JSON.parse(originalInputBytes.toString('utf8'));
    digestSubstitutionInput.deterministicResults[0].output.recordDigest = sha256(bytesOf('substituted-output'));
    const digestSubstitutionBytes = bytesOf(canonicalJson(digestSubstitutionInput));
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), digestSubstitutionBytes);
    digestSubstitutionOperation.reviewInputs[0] = descriptor(originalInputPath, digestSubstitutionBytes);
    assert.throws(() => verifyR1ContinuousExecution(root, digestSubstitutionOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_REVIEW_PROOF_INVALID');
    writeFileSync(join(taskRoot(root), originalInputPath.slice('.git/core-ui-r1/'.length)), originalInputBytes);
    const fakeProofOperation = structuredClone(fixture.operation);
    const proofInputPath = fakeProofOperation.reviewInputs[0].path;
    const proofInput = JSON.parse(readFileSync(join(taskRoot(root), proofInputPath.slice('.git/core-ui-r1/'.length)), 'utf8'));
    proofInput.proof[0] = taskRecord(root, { profile: 'core-ui-deterministic-proof-v1', role: proofInput.role, source: proofInput.reviewedSource, subject: { id: 'forged-proof', digest: sha256(bytesOf('forged-proof')), byteLength: 12, profile: 'core-ui-deterministic-result-v1' } }, 'forged-proof.json');
    const proofInputBytes = bytesOf(canonicalJson(proofInput));
    writeFileSync(join(taskRoot(root), proofInputPath.slice('.git/core-ui-r1/'.length)), proofInputBytes);
    fakeProofOperation.reviewInputs[0] = descriptor(proofInputPath, proofInputBytes);
    assert.throws(() => verifyR1ContinuousExecution(root, fakeProofOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_REVIEW_PROOF_INVALID');
    const arbitrary = structuredClone(fixture.operation);
    const reviewRecord = JSON.parse(readFileSync(join(taskRoot(root), arbitrary.review[0].path.slice('.git/core-ui-r1/'.length)), 'utf8'));
    reviewRecord.reviewerIdentity = 'arbitrary-agent';
    const bytes = bytesOf(canonicalJson(reviewRecord));
    const reviewPath = arbitrary.review[0].path;
    writeFileSync(join(taskRoot(root), reviewPath.slice('.git/core-ui-r1/'.length)), bytes);
    arbitrary.review[0] = descriptor(reviewPath, bytes);
    assert.throws(() => verifyR1ContinuousExecution(root, arbitrary, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_REVIEW_IDENTITY_INVALID' || error.code === 'R1_CONTINUOUS_REVIEW_ASSIGNMENT_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('component work on main is rejected before operation routing', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    execFileSync('git', ['-C', root, 'branch', '-f', 'main', fixture.current.commit]);
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    const operation = { ...fixture.operation, source: sourceRecord(root) };
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation),
      (error) => error.code === 'R1_CONTINUOUS_PROTECTED_BRANCH',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('component operation rejects executable, symlink, and gitlink actual after-image states', async () => {
  for (const stateName of ['100755', '120000', '160000']) {
    const root = cloneAuthority();
    try {
      const fixture = await componentFixture(root);
      const path = 'packages/react/src/Button.mjs';
      const absolute = join(root, path);
      if (stateName === '100755') {
        chmodSync(absolute, 0o755);
      } else if (stateName === '120000') {
        const target = join(taskRoot(root), 'verifier-special-target.mjs');
        writeFileSync(target, bytesOf('export const changeIntentFixture = true;\n'));
        rmSync(absolute, { force: true });
        symlinkSync('../../../.git/core-ui-r1/verifier-special-target.mjs', absolute);
      } else {
        rmSync(absolute, { recursive: true, force: true });
        mkdirSync(absolute, { recursive: true });
        execFileSync('git', ['-C', absolute, 'init', '--quiet']);
        execFileSync('git', ['-C', absolute, 'config', 'user.email', 'verifier-special@example.invalid']);
        execFileSync('git', ['-C', absolute, 'config', 'user.name', 'Verifier special state']);
        writeFileSync(join(absolute, 'nested.txt'), 'gitlink\n');
        execFileSync('git', ['-C', absolute, 'add', 'nested.txt']);
        execFileSync('git', ['-C', absolute, 'commit', '-m', 'test: verifier gitlink'], { stdio: 'ignore' });
      }
      execFileSync('git', ['-C', root, 'add', '-A', '--', path]);
      execFileSync('git', ['-C', root, 'commit', '-m', `test: verifier ${stateName} after-image`], { stdio: 'ignore' });
      const forged = { ...fixture.operation, source: sourceRecord(root) };
      assert.throws(
        () => verifyR1ContinuousExecution(root, forged, bootstrapOptions(root)),
        (error) => ['CORE_CHANGE_INTENT_RESULT_INVALID', 'CORE_CHANGE_INTENT_AFTER_IMAGE_MISSING'].includes(error.code),
        stateName,
      );
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('completed deterministic results require verifier command execution', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const injected = { ...bootstrapOptions(root), testOnlyCommandRunner: false, commandRunner: () => ({ exitState: 0 }) };
    assert.throws(
      () => verifyR1ContinuousExecution(root, fixture.operation, injected),
      (error) => error.code === 'R1_CONTINUOUS_RESULT_EXECUTION_INVALID',
    );
    const executed = [];
    const verified = verifyR1ContinuousExecution(root, fixture.operation, {
      ...bootstrapOptions(root),
      commandRunner: ({ command }) => { executed.push(command); return { exitState: 0 }; },
    });
    assert.equal(verified.result.status, 'passed');
    assert.deepEqual([...executed].sort(), fixture.produced.envelope.checks.map(({ command }) => command).sort());
    const deterministicPath = fixture.produced.envelope.result.deterministicResults[0].path;
    const deterministicRecord = JSON.parse(readFileSync(join(taskRoot(root), deterministicPath.slice('.git/core-ui-r1/'.length)), 'utf8'));
    assert.doesNotMatch(JSON.stringify(deterministicRecord), /\/(?:Users|private\/tmp|var\/folders)\//u);
    assert.equal(deterministicRecord.runtime.node.path, '<pinned-node-runtime>/node');
    assert.equal(deterministicRecord.runtime.pnpm.path, '<pinned-package-manager>/pnpm');
    assert.throws(
      () => verifyR1ContinuousExecution(root, fixture.operation, {
        ...bootstrapOptions(root),
        commandRunner: () => ({ exitState: 0, stdout: 'forged deterministic output' }),
      }),
      (error) => error.code === 'R1_CONTINUOUS_RESULT_EXECUTION_FAILED',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('retained evidence binds the canonical index, validation, record, artifact, and owner verification', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await retainedEvidenceOperationFixture(root);
    const passed = await verifyR1ContinuousExecutionWithDeliveryProfile(root, fixture.operation, bootstrapOptions(root));
    assert.equal(passed.result.code, 'R1_CONTINUOUS_OPERATION_PASSED');
    const forged = structuredClone(fixture.operation);
    forged.evidence.digest = sha256(bytesOf('forged evidence index'));
    assert.throws(
      () => verifyR1ContinuousExecution(root, forged, bootstrapOptions(root)),
      (error) => error.code === 'R1_CONTINUOUS_CHANGE_INTENT_EVIDENCE_INVALID',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('retained proof tool binds the approved committed regular blob and exact live bytes', () => {
  const root = cloneAuthority();
  const proofToolPath = 'tooling/audits/repository-policy/src/evidence-verify.mjs';
  try {
    const commit = state(root).commit;
    const committed = gitBytes(root, 'show', `${commit}:${proofToolPath}`);
    const digest = sha256(committed);
    assert.equal(validateRetainedProofTool(root, commit, proofToolPath, digest).bytes.equals(committed), true);
    for (const executablePath of ['../evidence-verify.mjs', '.git/core-ui-r1/proof-tool.mjs', '/tmp/evidence-verify.mjs']) {
      assert.throws(() => validateRetainedProofTool(root, commit, executablePath, digest), (error) => error.code === 'R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID');
    }
    const livePath = join(root, proofToolPath);
    const original = readFileSync(livePath);
    rmSync(livePath);
    symlinkSync(join(root, 'outside-proof-tool.mjs'), livePath);
    writeFileSync(join(root, 'outside-proof-tool.mjs'), original);
    assert.throws(() => validateRetainedProofTool(root, commit, proofToolPath, digest), (error) => error.code === 'R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID');
    rmSync(livePath);
    writeFileSync(livePath, Buffer.concat([original, Buffer.from('\nforged\n', 'utf8')]));
    assert.throws(() => validateRetainedProofTool(root, commit, proofToolPath, digest), (error) => error.code === 'R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('task-local operation, intent, review, proof, and assignment locators reject symlinks', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const link = (target, name) => {
      const targetAbsolute = join(taskRoot(root), target.path.slice('.git/core-ui-r1/'.length));
      const linkAbsolute = join(taskRoot(root), name);
      symlinkSync(targetAbsolute, linkAbsolute);
      return { ...target, path: `.git/core-ui-r1/${name}` };
    };
    const operationRecord = taskRecord(root, fixture.operation, 'operation-record.json');
    assert.throws(() => verifyR1ContinuousExecutionOperation(root, link(operationRecord, 'operation-link.json').path), (error) => error.code === 'R1_CONTINUOUS_PATH_INVALID');
    const intentOperation = structuredClone(fixture.operation);
    intentOperation.intent = link(fixture.intent, 'intent-link.json');
    assert.throws(() => verifyR1ContinuousExecution(root, intentOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_PATH_INVALID');
    const reviewOperation = structuredClone(fixture.operation);
    reviewOperation.review[0] = link(fixture.operation.review[0], 'review-link.json');
    assert.throws(() => verifyR1ContinuousExecution(root, reviewOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_PATH_INVALID');
    const proofOperation = structuredClone(fixture.operation);
    const proofInputPath = proofOperation.reviewInputs[0].path;
    const proofInputFile = join(taskRoot(root), proofInputPath.slice('.git/core-ui-r1/'.length));
    const proofInput = JSON.parse(readFileSync(proofInputFile, 'utf8'));
    proofInput.proof[0] = link(proofInput.proof[0], 'proof-link.json');
    const proofInputBytes = bytesOf(canonicalJson(proofInput));
    writeFileSync(proofInputFile, proofInputBytes);
    proofOperation.reviewInputs[0] = descriptor(proofInputPath, proofInputBytes);
    assert.throws(() => verifyR1ContinuousExecution(root, proofOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_PATH_INVALID');
    const assignmentOperation = structuredClone(fixture.operation);
    assignmentOperation.reviewAssignments[0].assignmentRecordRef = link({ path: assignmentOperation.reviewAssignments[0].assignmentRecordRef, digest: assignmentOperation.reviewAssignments[0].assignmentRecordDigest, byteLength: 1 }, 'assignment-link.json').path;
    assert.throws(() => verifyR1ContinuousExecution(root, assignmentOperation, bootstrapOptions(root)), (error) => error.code === 'R1_CONTINUOUS_PATH_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('hosted observation injection is unavailable without the explicit test seam', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const passed = await verifyR1ContinuousExecutionWithDeliveryProfile(root, fixture.operation, bootstrapOptions(root));
    const prior = taskRecord(root, passed, 'injection-prior.json');
    const operation = {
      ...fixture.operation,
      kind: 'routine-git-operation',
      action: 'check',
      source: sourceRecord(root),
      priorResult: prior,
      bootstrapReceipt: fixture.operation.bootstrapReceipt,
      git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 101, mergeMethod: 'merge' } },
    };
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), observationRunner: () => ({}) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('independent reviewer assignment and exact proof closure are mandatory', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const missing = structuredClone(fixture.operation);
    delete missing.reviewAssignments;
    assert.throws(
      () => verifyR1ContinuousExecution(root, missing, bootstrapOptions(root)),
      (error) => error.code === 'R1_CONTINUOUS_REVIEW_ASSIGNMENT_MISSING',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('routine Git cannot relabel a changed path and omitted hosted checks fail closed', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const result = await verifyR1ContinuousExecutionWithDeliveryProfile(root, fixture.operation, bootstrapOptions(root));
    const prior = taskRecord(root, result, 'prior-result.json');
    commitFile(root, 'packages/react/src/forged-routine.mjs', bytesOf('export const forged = true;\n'), 'test: forged routine path');
    const current = state(root);
    const routineSource = sourceRecord(root);
    const routine = { kind: 'routine-git-operation', action: 'check', source: routineSource, intent: fixture.intent, priorResult: prior, bootstrapReceipt: fixture.operation.bootstrapReceipt, permittedWriteSet: ['packages/react/src/Button.mjs'], authorizedWriteSet: ['packages/react/src/Button.mjs'], review: fixture.operation.review, reviewAssignments: fixture.operation.reviewAssignments, reviewInputs: fixture.operation.reviewInputs, git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 101, mergeMethod: 'merge' } } };
    assert.equal(current.commit !== fixture.current.commit, true);
    assert.throws(() => verifyR1ContinuousExecution(root, routine, { ...bootstrapOptions(root), observationRunner: () => ({ provider: 'github', repository: 'ndrewtran/core-ui', pullRequest: { number: 101, headCommit: current.commit, baseCommit: current.base, baseRefName: 'main', mergeable: true, mergeableState: 'clean' }, requiredChecks: ['Repository policy'], requiredChecksIdentity: { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks: ['Repository policy'] })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks: ['Repository policy'] })) }, checks: [] }) }), (error) => error.code === 'R1_CONTINUOUS_CHANGE_INTENT_WRITE_SET_INVALID' || error.code === 'R1_CONTINUOUS_PRIOR_RESULT_INVALID' || error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('hosted operation binds provider-derived checks and postmerge topology', async () => {
  const root = cloneAuthority();
  try {
    const fixture = await componentFixture(root);
    const passed = await verifyR1ContinuousExecutionWithDeliveryProfile(root, fixture.operation, bootstrapOptions(root));
    const prior = taskRecord(root, passed, 'hosted-component-prior.json');
    const current = fixture.current;
    const source = sourceRecord(root);
    const requiredChecks = ['Repository policy'];
    const requiredCheckIntegrations = [{ context: 'Repository policy', integrationId: null }];
    const requiredChecksIdentity = { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks, requiredReviews: [] })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks, requiredReviews: [] })) };
    const observation = (action, result = 'success', requiredReviews = [], requiredReviewBots = [], observedState = current, reviews = [], lastPushActor) => ({
      provider: 'github', repository: 'ndrewtran/core-ui', defaultBranch: 'main', protectedRef: 'refs/heads/main',
      pullRequest: { number: 101, headCommit: current.commit, baseCommit: current.base, baseRefName: 'main', mergeable: true, mergeableState: 'clean', merged: action === 'postmerge', mergeCommit: action === 'postmerge' ? observedState.commit : null },
      requiredChecks, requiredCheckIntegrations, requiredChecksIdentity: { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson({ requiredChecks, requiredCheckIntegrations, requiredReviews })), byteLength: Buffer.byteLength(canonicalJson({ requiredChecks, requiredCheckIntegrations, requiredReviews })) }, requiredReviews,
      requiredReviewsSatisfied: requiredReviews.length === 0,
      ...(lastPushActor ? { lastPushActor } : {}),
      requiredReviewBots,
      reviewBots: requiredReviewBots,
      reviews,
      rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256(bytesOf('provider')), byteLength: Buffer.byteLength('provider') },
      normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256(bytesOf('normalized-provider')), byteLength: Buffer.byteLength('normalized-provider') },
      checks: result === 'omitted' ? [] : [{ name: 'Repository policy', headCommit: observedState.commit, status: result === 'pending' ? 'in_progress' : 'completed', conclusion: result === 'failure' ? 'failure' : 'success' }],
      ...(action === 'postmerge' ? { postmerge: { ref: 'refs/heads/main', commit: observedState.commit, tree: observedState.tree, orderedParents: observedState.parents } } : {}),
    });
    const operation = { kind: 'routine-git-operation', action: 'check', source, intent: fixture.intent, priorResult: prior, bootstrapReceipt: fixture.operation.bootstrapReceipt, permittedWriteSet: ['packages/react/src/Button.mjs'], authorizedWriteSet: ['packages/react/src/Button.mjs'], review: fixture.operation.review, reviewAssignments: fixture.operation.reviewAssignments, reviewInputs: fixture.operation.reviewInputs, git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 101, mergeMethod: 'merge' } } };
    for (const result of ['omitted', 'failure', 'pending']) {
      assert.throws(
        () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', result) }),
        (error) => error.code === 'R1_CONTINUOUS_HOSTED_CHECK_FAILED',
      );
    }
    const premerge = verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check') });
    operation.priorResult = taskRecord(root, premerge, 'hosted-prior.json');
    assert.equal(premerge.hosted.requiredChecks[0], 'Repository policy');
    assert.equal(verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [], []) }).hosted.normalizedResponseIdentity.source, 'github:rest:normalized-observation');
    assert.throws(
      () => verifyR1ContinuousExecution(root, { ...operation, git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: 101, mergeMethod: 'squash' } } }, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check') }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_MERGE_METHOD_INVALID',
    );
    const wrongApp = observation('check');
    wrongApp.checks = [{ ...wrongApp.checks[0], integrationId: 42 }];
    assert.throws(() => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => wrongApp }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_CHECK_FAILED');
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [{ approvals: 1 }], []) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: false }], [], current, [{ reviewer: 'review-bot', state: 'APPROVED', commitId: current.commit, dismissed: false }, { reviewer: 'review-bot', state: 'CHANGES_REQUESTED', commitId: current.commit, dismissed: false }]) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_CHANGES_REQUESTED',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [{ approvals: 1, codeOwnerReviews: true, dismissStaleReviews: false }], [], current, [{ reviewer: 'review-bot', state: 'APPROVED', commitId: current.commit, dismissed: false }]) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_UNSUPPORTED',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: true }], [], current, [{ reviewer: 'review-bot', state: 'APPROVED', commitId: current.base, dismissed: false }]) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED',
    );
    const staleAllowed = observation('check', 'success', [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: false }], [], current, [{ reviewer: 'review-bot', state: 'APPROVED', commitId: current.base, dismissed: false }]);
    staleAllowed.requiredReviewsSatisfied = true;
    assert.equal(verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => staleAllowed }).result.status, 'passed');
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: false, requireLastPushApproval: true }], [], current, [{ reviewer: 'review-bot', state: 'APPROVED', commitId: current.commit, dismissed: false }]) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: false, requireLastPushApproval: true }], [], current, [{ reviewer: 'review-bot', state: 'APPROVED', commitId: current.commit, dismissed: false }], 'review-bot') }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_SELF_APPROVAL',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, operation, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check', 'success', [], ['review-bot']) }),
      (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_BOT_MISSING',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, { ...operation, action: 'merge', final: true }, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('check') }),
      (error) => error.code === 'R1_CONTINUOUS_STOP_BOUNDARY',
    );
    const topic = current.commit;
    execFileSync('git', ['-C', root, 'checkout', 'main'], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, 'merge', '--no-ff', '--no-edit', topic], { stdio: 'pipe' });
    const merged = state(root);
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', merged.commit]);
    const mergedReviews = await Promise.all(['core-ui-evidence-reviewer', 'core-ui-renderer-reviewer'].map((role) => reviewFixture(root, role, merged, fixture.intent)));
    const postmerge = { ...operation, action: 'postmerge', source: sourceRecord(root), review: mergedReviews.map(({ review }) => review), reviewAssignments: mergedReviews.map(({ assignment }) => assignment), reviewInputs: mergedReviews.map(({ reviewInput }) => reviewInput) };
    assert.equal(verifyR1ContinuousExecution(root, postmerge, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => observation('postmerge', 'success', [], [], merged) }).hosted.requiredChecks[0], 'Repository policy');
    assert.throws(
      () => verifyR1ContinuousExecution(root, postmerge, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => ({ ...observation('postmerge', 'success', [], [], merged), postmerge: { ref: 'refs/heads/main', commit: merged.commit, tree: merged.tree, orderedParents: ['drifted-parent'] } }) }),
      (error) => error.code === 'R1_CONTINUOUS_POSTMERGE_INVALID',
    );
    assert.throws(
      () => verifyR1ContinuousExecution(root, postmerge, { ...bootstrapOptions(root), testOnlyObservation: true, observationRunner: () => ({ ...observation('postmerge', 'success', [], [], merged), pullRequest: { ...observation('postmerge', 'success', [], [], merged).pullRequest, mergeCommit: '0'.repeat(40) } }) }),
      (error) => error.code === 'R1_CONTINUOUS_POSTMERGE_INVALID',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ruleset list summaries normalize with fetched details for ruleset-only protection', () => {
  const normalized = normalizeGitHubProtection({
    repository: 'ndrewtran/core-ui',
    rulesets: [{ id: 7, enforcement: 'active', name: 'main ruleset' }],
    rulesetDetails: [{
      id: 7,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: ['refs/heads/main'] }, repository_name: { include: ['ndrewtran/core-ui'] } },
      rules: [
        { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Repository policy' }] } },
        { type: 'pull_request', parameters: { required_approving_review_count: 1 } },
        { type: 'required_reviewers', parameters: { reviewers: [{ login: 'review-bot' }] } },
      ],
    }],
  });
  assert.deepEqual(normalized.requiredChecks, ['Repository policy']);
  assert.deepEqual(normalized.requiredReviews, [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: false }]);
  assert.deepEqual(normalized.requiredReviewBots, ['review-bot']);
});

test('current ruleset review, merge, and thread requirements remain explicit and fail closed', () => {
  const normalized = normalizeGitHubProtection({
    repository: 'ndrewtran/core-ui',
    rulesets: [{ id: 70, enforcement: 'active' }],
    rulesetDetails: [{
      id: 70,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: ['main'] } },
      rules: [
        { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Repository policy' }] } },
        { type: 'required_review_thread_resolution', parameters: {} },
        { type: 'require_extra_approval_for_unattributed_changes', parameters: { approvals_required: 1 } },
        { type: 'allowed_merge_methods', parameters: { allowed_merge_methods: ['merge', 'squash'] } },
      ],
    }],
  });
  assert.equal(normalized.requiredReviewThreadResolution, true);
  assert.equal(normalized.extraApprovalForUnattributedChanges, 1);
  assert.deepEqual(normalized.allowedMergeMethods, ['merge', 'squash']);
});

test('current GitHub ruleset shape accepts no-parameter safety rules and closed pull-request parameters', () => {
  const normalized = normalizeGitHubProtection({
    repository: 'ndrewtran/core-ui',
    rulesets: [{ id: 20354075, enforcement: 'active' }],
    rulesetDetails: [{
      id: 20354075,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } },
      rules: [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
        { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Repository policy' }], do_not_enforce_on_create: true, strict_required_status_checks_policy: true } },
        { type: 'pull_request', parameters: { allowed_merge_methods: ['merge', 'squash', 'rebase'], dismiss_stale_reviews_on_push: true, require_code_owner_review: false, require_extra_approval_for_unattributed_changes: true, require_last_push_approval: false, required_approving_review_count: 0, required_review_thread_resolution: true, required_reviewers: [] } },
      ],
    }],
  });
  assert.deepEqual(normalized.requiredChecks, ['Repository policy']);
  assert.deepEqual(normalized.requiredReviews, [{ approvals: 0, codeOwnerReviews: false, dismissStaleReviews: true }]);
  assert.equal(normalized.requiredReviewThreadResolution, true);
  assert.equal(normalized.extraApprovalForUnattributedChanges, 1);
  assert.deepEqual(normalized.allowedMergeMethods, ['merge', 'rebase', 'squash']);
  assert.deepEqual(normalized.requiredReviewBots, []);
  assert.throws(() => normalizeGitHubProtection({ repository: 'ndrewtran/core-ui', rulesets: [{ id: 20354075, enforcement: 'active' }], rulesetDetails: [{ id: 20354075, enforcement: 'active', target: 'branch', conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } }, rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0, required_review_thread_resolution: 'yes' } }] }] }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED');
});

test('hosted current rules require provider proof of resolved threads and unattributed approval', () => {
  const protection = { requiredReviewThreadResolution: true, extraApprovalForUnattributedChanges: 1 };
  const requiredChecks = ['Repository policy'];
  const requiredReviews = [];
  const attributedCommits = [{ sha: 'a'.repeat(40), user: 'alice', attributed: true }];
  const attributedDigest = sha256(canonicalJson({ commits: attributedCommits, allCommitsAttributed: true }));
  const identity = (commitAttributionDigest) => {
    const preimage = { requiredChecks, requiredReviews, ...protection, commitAttributionDigest };
    return { source: 'github:protected-main-required-checks', digest: sha256(canonicalJson(preimage)), byteLength: Buffer.byteLength(canonicalJson(preimage)) };
  };
  const base = { protection, requiredChecks, requiredReviews, requiredChecksIdentity: identity(attributedDigest), commitAttribution: attributedCommits, allCommitsAttributed: true, commitAttributionDigest: attributedDigest, rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256('raw'), byteLength: 3 }, normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256('normalized'), byteLength: 10 }, pullRequest: { headCommit: 'a'.repeat(40) }, reviews: [], requiredReviewsSatisfied: true };
  assert.throws(() => providerRequiredChecks(base), (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED');
  const unattributedCommits = [{ sha: 'b'.repeat(40), user: null, attributed: false }];
  const unattributedDigest = sha256(canonicalJson({ commits: unattributedCommits, allCommitsAttributed: false }));
  const unresolved = { ...base, reviewThreadsResolved: true, commitAttribution: unattributedCommits, allCommitsAttributed: false, commitAttributionDigest: unattributedDigest, requiredChecksIdentity: identity(unattributedDigest) };
  assert.throws(() => providerRequiredChecks(unresolved), (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED');
  assert.deepEqual(providerRequiredChecks({ ...base, reviewThreadsResolved: true }), requiredChecks);
  assert.deepEqual(providerRequiredChecks({ ...unresolved, unattributedChangesApprovalSatisfied: true }), requiredChecks);
});

test('ruleset pagination retains later-page protection and broad main ref patterns', () => {
  const rulesets = normalizeGitHubRulesetPages([
    { rulesets: [{ id: 6, enforcement: 'active', name: 'unrelated first page' }] },
    { rulesets: [{ id: 7, enforcement: 'active', name: 'main later page' }] },
  ]);
  const normalized = normalizeGitHubProtection({
    repository: 'ndrewtran/core-ui',
    rulesets,
    rulesetDetails: [{ id: 6, enforcement: 'active', target: 'branch', conditions: { ref_name: { include: ['refs/heads/release/*'] } }, rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Release-only' }] } }] }, { id: 7, enforcement: 'active', target: 'branch', conditions: { ref_name: { include: ['refs/heads/*'] }, repository_name: { include: ['ndrewtran/*'] } }, rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Repository policy' }] } }] }],
  });
  assert.deepEqual(normalized.requiredChecks, ['Repository policy']);
  assert.throws(() => normalizeGitHubRulesetPages([{ rulesets: null }]), (error) => error.code === 'R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID');
});

test('hosted review/check pagination requires complete stable ordering and retains late blockers', () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, state: 'APPROVED' }));
  const laterPage = [{ id: 101, state: 'CHANGES_REQUESTED' }];
  const items = normalizeGitHubPagedCollection([firstPage, laterPage], 'pull-request reviews');
  assert.equal(items.length, 101);
  assert.equal(items.at(-1).state, 'CHANGES_REQUESTED');
  assert.throws(
    () => normalizeGitHubPagedCollection([firstPage, [{ id: 100, state: 'APPROVED' }]], 'check-runs'),
    (error) => error.code === 'R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID',
  );
  assert.throws(
    () => normalizeGitHubPagedCollection([firstPage, [{ id: 102, state: 'APPROVED' }, { id: 101, state: 'APPROVED' }]], 'reviews'),
    (error) => error.code === 'R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID',
  );
});

test('required checks retain exact integration identity and classic bypass state is fail-closed', () => {
  const normalized = normalizeGitHubProtection({
    repository: 'ndrewtran/core-ui',
    rulesets: [{ id: 17, enforcement: 'active' }],
    rulesetDetails: [{
      id: 17,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: ['refs/heads/main'] }, repository_name: { include: ['ndrewtran/core-ui'] } },
      rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Repository policy', integration_id: 42 }] } }],
    }],
  });
  assert.deepEqual(normalized.requiredCheckIntegrations, [{ context: 'Repository policy', integrationId: 42 }]);
  assert.deepEqual(normalizeGitHubProtection({ protection: { enforce_admins: { url: 'https://api.github.test/enforce', enabled: true }, required_status_checks: { url: 'https://api.github.test/checks', contexts: ['Repository policy'], checks: [{ context: 'Repository policy', app_id: 42 }], strict: true }, required_pull_request_reviews: { required_approving_review_count: 1, require_last_push_approval: true } } }).requiredCheckIntegrations, [{ context: 'Repository policy', integrationId: 42 }]);
  assert.deepEqual(normalizeGitHubProtection({ protection: { enforce_admins: { url: 'https://api.github.test/enforce', enabled: true }, required_status_checks: { url: 'https://api.github.test/checks', contexts: ['Repository policy'], strict: true }, required_pull_request_reviews: { required_approving_review_count: 1, require_last_push_approval: true } } }).requiredReviews, [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: false, requireLastPushApproval: true }]);
  assert.throws(() => normalizeGitHubProtection({ protection: { enforce_admins: false } }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_CLASSIC_BYPASS');
  assert.throws(() => normalizeGitHubProtection({ protection: { restrictions: { users: ['admin'], teams: [], apps: [] } } }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_RESTRICTION');
  assert.throws(() => normalizeGitHubProtection({ protection: { required_pull_request_reviews: { bypass_pull_request_allowances: { users: [{ login: 'admin' }], teams: [], apps: [] } } } }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_REVIEW_BYPASS');
});

test('ruleset normalization combines classic and applicable ruleset protection', () => {
  const normalized = normalizeGitHubProtection({
    repository: 'ndrewtran/core-ui',
    protection: { required_status_checks: { contexts: ['Classic check'] }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true } },
    rulesets: [{ id: 8, enforcement: 'active' }, { id: 10, enforcement: 'active' }],
    rulesetDetails: [{
      id: 8,
      enforcement: 'active',
      target: 'branch',
      conditions: { ref_name: { include: ['refs/heads/main'] }, repository_name: { include: ['ndrewtran/core-ui'] } },
      rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Ruleset check' }] } }],
    }, {
      id: 10,
      enforcement: 'active',
      target: 'tag',
      conditions: { ref_name: { include: ['refs/tags/v*'] } },
      rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Tag-only check' }] } }],
    }],
  });
  assert.deepEqual(normalized.requiredChecks, ['Classic check', 'Ruleset check']);
  assert.deepEqual(normalized.requiredReviews, [{ approvals: 1, codeOwnerReviews: false, dismissStaleReviews: true }]);
});

test('ruleset normalization rejects unsupported targets, rules, and bypass actors', () => {
  const base = { repository: 'ndrewtran/core-ui', rulesets: [{ id: 9, enforcement: 'active' }] };
  const detail = (overrides = {}) => ({ id: 9, enforcement: 'active', target: 'branch', conditions: { ref_name: { include: ['refs/heads/main'] } }, rules: [], ...overrides });
  assert.throws(() => normalizeGitHubProtection({ ...base, rulesetDetails: [detail({ target: 'pull_request' })] }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED');
  assert.throws(() => normalizeGitHubProtection({ ...base, rulesetDetails: [detail({ rules: [{ type: 'unknown_rule', parameters: {} }] })] }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED');
  assert.throws(() => normalizeGitHubProtection({ ...base, rulesetDetails: [detail({ bypass_actors: [{ actor_id: 1 }] })] }), (error) => error.code === 'R1_CONTINUOUS_HOSTED_RULESET_BYPASS');
});
