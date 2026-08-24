import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict, sha256Digest } from '../../../../packages/schema/src/canonical.mjs';
import {
  CHANGE_INTENT_BINDINGS,
  CHANGE_INTENT_PROFILE,
  commandProcedureIdentity,
  commandContract,
  parseChangeIntentBytes,
  resolveCommandRuntime,
  validateChangeIntentEnvelope,
} from '../../../../packages/tooling/src/change-intent.mjs';
import { loadDeliveryProfile } from './delivery-profile.mjs';

const PROFILE = 'core-ui-r1-continuous-execution-verifier-v1';
const RESULT_PROFILE = 'core-ui-r1-continuous-execution-v1';
const VERIFIER_PATH = 'tooling/audits/repository-policy/src/r1-continuous-execution-verify.mjs';
const TEST_PATH = 'tooling/audits/repository-policy/test/r1-continuous-execution.test.mjs';
const EVIDENCE_PROOF_TOOL_PATH = 'tooling/audits/repository-policy/src/evidence-verify.mjs';
const POLICY_PATH = 'tooling/audits/repository-policy/repository-policy.json';
const TASK_ROOT = '.git/core-ui-r1/';
const AUTHORITY_COMMIT = CHANGE_INTENT_BINDINGS.authority.commit;
const AUTHORITY_TREE = CHANGE_INTENT_BINDINGS.authority.tree;
const BOOTSTRAP_PULL_REQUEST_NUMBER = 92;
const BOOTSTRAP_HEAD_REF = 'codex/r1-change-intent-prerequisite';
const STAGE1_SOURCE = CHANGE_INTENT_BINDINGS.stage1;
const SNAPSHOT = CHANGE_INTENT_BINDINGS.snapshot;
const BASELINE = CHANGE_INTENT_BINDINGS.baseline;
const PRODUCT_SCOPE = CHANGE_INTENT_BINDINGS.productScope;
const AUTHORITY_PATHS = Object.freeze([
  'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md',
  'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md',
  'strategy/monorepo-architecture.md',
  'strategy/milestone-roadmap.md',
  'strategy/product-scope.md',
]);
const PARENT_AUTHORITY_COMMIT = CHANGE_INTENT_BINDINGS.parentAuthority.commit;
const PARENT_AUTHORITY_TREE = CHANGE_INTENT_BINDINGS.parentAuthority.tree;
const PARENT_AUTHORITY_PATHS = Object.freeze([
  'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery.md',
  'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery-acceptance.md',
]);
const BOOTSTRAP_PATHS = Object.freeze([
  'packages/schema/schemas/change-intent-envelope.schema.json',
  'packages/schema/test/change-intent-envelope.test.mjs',
  'packages/tooling/src/change-intent.mjs',
  'packages/tooling/src/index.mjs',
  'packages/tooling/test/change-intent.test.mjs',
  'tooling/audits/repository-policy/README.md',
  'tooling/audits/repository-policy/repository-policy.json',
  'tooling/audits/repository-policy/src/cli.mjs',
  VERIFIER_PATH,
  TEST_PATH,
].sort());
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const HEX40 = /^[0-9a-f]{40}$/u;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const OPERATION_KINDS = new Set([
  'r1-lock',
  'component-implementation',
  'retained-evidence-acceptance',
  'routine-git-operation',
  'project-migration',
]);
const ROUTINE_ACTIONS = new Set(['branch', 'commit', 'push', 'open-pr', 'check', 'merge', 'postmerge', 'cleanup']);
const EXTERNAL_TRANSITION_ACTIONS = new Set(['branch', 'commit', 'push', 'open-pr', 'merge', 'postmerge', 'cleanup']);
const PASS = new Set(['passed', 'success', 'verified', 'green', 'clear', 'accepted']);
const APPROVED_EVIDENCE_COMMAND = 'node tooling/audits/repository-policy/src/evidence-verify.mjs';
const APPROVED_NO_OP_PREFIXES = Object.freeze(['notes/']);

export const R1_CONTINUOUS_EXECUTION = Object.freeze({
  profile: PROFILE,
  verifierPath: VERIFIER_PATH,
  testPath: TEST_PATH,
  authorityMerge: AUTHORITY_COMMIT,
  authorityTree: AUTHORITY_TREE,
  bootstrapWriteSet: BOOTSTRAP_PATHS,
});

export class R1ContinuousExecutionError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'R1ContinuousExecutionError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => { throw new R1ContinuousExecutionError(code, message, details); };
const bytesOf = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
const sha256 = (value) => sha256Digest(bytesOf(value));

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function object(value, label) {
  if (!isObject(value)) fail('R1_CONTINUOUS_INPUT_INVALID', `${label} must be an object`);
  return value;
}

function exactKeys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail('R1_CONTINUOUS_UNKNOWN_FIELD', `${label}.${key}`);
}

function safePath(value, label) {
  if (typeof value !== 'string' || !SAFE_PATH.test(value)) fail('R1_CONTINUOUS_PATH_INVALID', `${label} is not repository-relative`);
  return value;
}

function exactPaths(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail('R1_CONTINUOUS_WRITE_SET_INVALID', `${label} must be a non-empty path array`);
  const paths = value.map((path) => safePath(path, label));
  if (new Set(paths).size !== paths.length) fail('R1_CONTINUOUS_WRITE_SET_INVALID', `${label} contains duplicates`);
  return paths.sort();
}

function equalPaths(actual, expected, code, message) {
  if (canonicalJson([...actual].sort()) !== canonicalJson([...expected].sort())) fail(code, message, { actual, expected });
}

function strictJson(bytes, label) {
  try {
    const text = bytes.toString('utf8');
    const value = parseJsonStrict(text);
    if (canonicalJson(value) !== text) fail('R1_CONTINUOUS_RECORD_NONCANONICAL', `${label} is not canonical JSON`);
    return value;
  } catch (error) {
    if (error instanceof R1ContinuousExecutionError) throw error;
    fail('R1_CONTINUOUS_RECORD_INVALID', `${label}: ${error.message}`);
  }
}

function git(root, args, encoding = 'utf8') {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (error) {
    fail('R1_CONTINUOUS_SOURCE_UNAVAILABLE', `git ${args.join(' ')} failed`, { cause: error.message });
  }
}

function gitBytes(root, args) {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024 }); }
  catch (error) { fail('R1_CONTINUOUS_SOURCE_UNAVAILABLE', `git ${args.join(' ')} failed`, { cause: error.message }); }
}

function optionalGitBytes(root, args) {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { return undefined; }
}

function gitTreeEntry(root, commit, path, label) {
  const bytes = optionalGitBytes(root, ['ls-tree', '-z', commit, '--', path]);
  if (!bytes || bytes.byteLength === 0) return undefined;
  const line = bytes.toString('utf8').replace(/\0$/u, '');
  const match = /^(\d{6}) (blob|tree|commit) [0-9a-f]{40}\t(.+)$/u.exec(line);
  if (!match || match[3] !== path) fail('R1_CONTINUOUS_SOURCE_INVALID', `${label} has an unsupported Git tree entry`);
  return { mode: match[1], type: match[2] };
}

function committedBlobIdentity(root, commit, reference, label) {
  object(reference, label);
  exactKeys(reference, new Set(['path', 'sha256', 'byteLength', 'assertionId']), label);
  safePath(reference.path, `${label}.path`);
  if (!DIGEST.test(reference.sha256) || !Number.isSafeInteger(reference.byteLength) || reference.byteLength < 0) fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', `${label} identity is malformed`);
  if (reference.assertionId !== undefined && (typeof reference.assertionId !== 'string' || reference.assertionId.length === 0)) fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', `${label}.assertionId is malformed`);
  const entry = gitTreeEntry(root, commit, reference.path, label);
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', `${label} must resolve to a regular 100644 Git blob`);
  const bytes = gitBytes(root, ['show', `${commit}:${reference.path}`]);
  if (bytes.byteLength !== reference.byteLength || sha256(bytes) !== reference.sha256) fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', `${label} digest or byte length does not bind the committed bytes`);
  return bytes;
}

/**
 * Bind a retained proof tool to the regular blob committed in the observed
 * result, then require the executable checkout bytes to be that same blob.
 * The proof owner remains the canonical repository script; callers cannot
 * select an arbitrary executable or substitute live bytes for committed ones.
 */
export function validateRetainedProofTool(repositoryRoot, commit, executablePath, executableSha256) {
  const root = resolve(repositoryRoot);
  if (executablePath !== EVIDENCE_PROOF_TOOL_PATH || !DIGEST.test(executableSha256 ?? '')) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool path or digest is not canonical');
  const entry = gitTreeEntry(root, commit, executablePath, 'evidence proof tool');
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool must be a regular 100644 Git blob');
  const committedBytes = gitBytes(root, ['show', `${commit}:${executablePath}`]);
  if (sha256(committedBytes) !== executableSha256) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool bytes differ from the committed identity');
  const livePath = resolve(root, executablePath);
  let liveStat;
  try { liveStat = lstatSync(livePath); } catch (error) { fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool is unavailable', { cause: error.message }); }
  if (!liveStat.isFile() || liveStat.isSymbolicLink()) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool must be a non-symlink regular file');
  let liveRealPath;
  try { liveRealPath = realpathSync(livePath); } catch (error) { fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool realpath is unavailable', { cause: error.message }); }
  if (liveRealPath !== join(realpathSync(root), executablePath)) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence proof tool resolves outside its approved repository path');
  const liveBytes = readFileSync(liveRealPath);
  if (!liveBytes.equals(committedBytes)) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'live evidence proof tool bytes differ from the observed commit');
  return { path: liveRealPath, bytes: committedBytes };
}

function validateBeforeImageState(root, commit, image, label) {
  const entry = gitTreeEntry(root, commit, image.path, label);
  if (!entry) {
    if (image.byteLength === 0) fail('R1_CONTINUOUS_BEFORE_IMAGE_MISMATCH', `${label} cannot add an empty absent path`);
    return undefined;
  }
  if (entry.mode !== '100644' || entry.type !== 'blob') fail('R1_CONTINUOUS_BEFORE_IMAGE_MISMATCH', `${label} must be an ordinary non-symlink 100644 Git blob`);
  const before = gitBytes(root, ['show', `${commit}:${image.path}`]);
  if (before.byteLength === image.byteLength && sha256(before) === image.digest) fail('R1_CONTINUOUS_BEFORE_IMAGE_MISMATCH', `${label} is identical to its existing before-image`);
  return entry;
}

function validateActualImageState(root, commit, image, label) {
  const entry = gitTreeEntry(root, commit, image.path, label);
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') fail('R1_CONTINUOUS_AFTER_IMAGE_MISMATCH', `${label} must be an ordinary non-symlink 100644 Git blob`);
  const bytes = gitBytes(root, ['show', `${commit}:${image.path}`]);
  if (bytes.byteLength !== image.byteLength || sha256(bytes) !== image.digest) fail('R1_CONTINUOUS_AFTER_IMAGE_MISMATCH', `${label} differs from its proposed after-image`);
  return bytes;
}

function currentGit(root) {
  const commit = git(root, ['rev-parse', 'HEAD']);
  const tree = git(root, ['rev-parse', 'HEAD^{tree}']);
  const branch = git(root, ['branch', '--show-current']);
  const parents = git(root, ['rev-list', '--parents', '-n', '1', commit]).split(/\s+/u).slice(1);
  const base = parents[0];
  const baseTree = base ? git(root, ['rev-parse', `${base}^{tree}`]) : undefined;
  if (!HEX40.test(commit) || !HEX40.test(tree)) fail('R1_CONTINUOUS_SOURCE_INVALID', 'Git source identity is unavailable');
  return { commit, tree, branch, parents, base, baseTree };
}

function changedPaths(root, base, commit) {
  if (!base) fail('R1_CONTINUOUS_BASE_DRIFT', 'source has no parent');
  const text = git(root, ['diff', '--name-only', '--diff-filter=ACDMRTUXB', `${base}..${commit}`, '--']);
  return text ? text.split('\n').filter(Boolean).sort() : [];
}

function generatedMarker(lines, marker) {
  const index = lines.findIndex((line) => line.includes(marker));
  if (index === -1) return undefined;
  return { index, value: lines[index].slice(lines[index].indexOf(marker) + marker.length).trim() };
}

function validateGeneratedProjection(root, commit, itemPath, policy, seen = new Set()) {
  if (seen.has(itemPath)) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} has a cyclic provenance chain`);
  seen.add(itemPath);
  const entry = gitTreeEntry(root, commit, itemPath, `generated projection ${itemPath}`);
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} must be an ordinary 100644 Git blob`);
  const content = gitBytes(root, ['show', `${commit}:${itemPath}`]);
  const text = content.toString('utf8');
  const strict = policy.strictJsonProjections?.find(({ path }) => path === itemPath);
  if (strict) {
    try { parseJsonStrict(text); } catch (error) { fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} is not canonical JSON`, { cause: error.message }); }
    validateGeneratedProjection(root, commit, strict.provenance, policy, seen);
    const provenance = gitBytes(root, ['show', `${commit}:${strict.provenance}`]).toString('utf8');
    const lines = provenance.split('\n');
    const sourceMarker = generatedMarker(lines.slice(0, 8), policy.generatedMarkers.source);
    const digestMarker = generatedMarker(lines.slice(0, 8), policy.generatedMarkers.digest);
    if (!sourceMarker || !digestMarker) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${strict.provenance} omits canonical generation markers`);
    const bodyStart = Math.max(sourceMarker.index, digestMarker.index) + 1;
    let declaration;
    try { declaration = parseJsonStrict(lines.slice(bodyStart).join('\n')); } catch (error) { fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${strict.provenance} is not canonical provenance JSON`, { cause: error.message }); }
    if (!isObject(declaration) || declaration.path !== itemPath || declaration.sha256 !== sha256(content)) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} provenance does not bind its exact generated bytes`);
    return;
  }
  const lines = text.split('\n');
  const sourceMarker = generatedMarker(lines.slice(0, 8), policy.generatedMarkers.source);
  const digestMarker = generatedMarker(lines.slice(0, 8), policy.generatedMarkers.digest);
  if (!sourceMarker || !digestMarker || !SAFE_PATH.test(sourceMarker.value) || sourceMarker.value.startsWith('/') || sourceMarker.value.split('/').includes('..')) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} omits a safe canonical source marker`);
  const sourceEntry = gitTreeEntry(root, commit, sourceMarker.value, `${itemPath} canonical source`);
  const sourceSegments = sourceMarker.value.split('/');
  if (!sourceEntry || sourceEntry.mode !== '100644' || sourceEntry.type !== 'blob' || sourceSegments.some((segment) => policy.projectionPathSegments?.includes(segment))) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} does not identify an ordinary canonical source`);
  const bodyStart = Math.max(sourceMarker.index, digestMarker.index) + 1;
  const body = lines.slice(bodyStart).join('\n');
  if (digestMarker.value !== sha256(body)) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${itemPath} generated body digest is not canonical`);
}

function derivedChangePaths(envelope, kind) {
  if (kind === 'r1-lock' || kind === 'project-migration') return [];
  return [...new Set([
    ...envelope.proposal.afterImages.map(({ path: itemPath }) => itemPath),
    ...(envelope.affected?.generatedProjections ?? []),
  ])].sort();
}

function candidateBase(root, current, bootstrap) {
  // Each protected-main invocation covers only its current default-branch
  // event. Topic branches remain cumulative from the protected baseline so an
  // earlier relevant commit cannot be hidden beneath an irrelevant tip.
  if (current.branch === 'main') return current.base;
  let originMain;
  try { originMain = git(root, ['rev-parse', 'refs/remotes/origin/main']); } catch { originMain = undefined; }
  if (originMain && isAncestor(root, originMain, current.commit)) return originMain;
  if (originMain) {
    try { return git(root, ['merge-base', originMain, current.commit]); } catch { /* fall through to the protected source boundary */ }
  }
  if (bootstrap && isAncestor(root, bootstrap.commit, current.commit)) return bootstrap.commit;
  return current.base;
}

function operationBase(root, actual, operation, bootstrap) {
  if (operation.kind === 'routine-git-operation' && operation.priorResult) {
    try {
      const prior = readTaskJson(root, operation.priorResult, 'operation.priorResult').value;
      const match = typeof prior.diff?.path === 'string' ? /^git-diff:([0-9a-f]{40})\.\.([0-9a-f]{40})$/u.exec(prior.diff.path) : null;
      if (match) return match[1];
    } catch (error) { if (error instanceof R1ContinuousExecutionError) throw error; }
  }
  if (operation.kind !== 'component-implementation') return actual.base;
  let originMain;
  try { originMain = git(root, ['rev-parse', 'refs/remotes/origin/main']); } catch { originMain = undefined; }
  if (originMain && isAncestor(root, originMain, actual.commit)) return originMain;
  if (originMain) {
    try { return git(root, ['merge-base', originMain, actual.commit]); } catch { /* use the authenticated bootstrap boundary below */ }
  }
  if (bootstrap && isAncestor(root, bootstrap.commit, actual.commit)) return bootstrap.commit;
  return actual.base;
}

function binaryDiff(root, base, commit) {
  return gitBytes(root, ['diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${base}..${commit}`, '--']);
}

function diffIdentity(root, base, commit) {
  const bytes = binaryDiff(root, base, commit);
  return { path: `git-diff:${base}..${commit}`, digest: sha256(bytes), byteLength: bytes.byteLength };
}

function sourceBeforeImages(root, commit, afterImages) {
  return afterImages.map((image) => {
    validateBeforeImageState(root, commit, image, `source.beforeImages.${image.path}`);
    const bytes = optionalGitBytes(root, ['show', `${commit}:${image.path}`]) ?? Buffer.alloc(0);
    return { path: image.path, digest: sha256(bytes), byteLength: bytes.byteLength };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function proposalPatchIdentity(beforeImages, afterImages) {
  const bytes = bytesOf(canonicalJson({ beforeImages, afterImages }));
  return { path: 'proposal.patch', digest: sha256(bytes), byteLength: bytes.byteLength };
}

function taskAbsolutePath(root, path) {
  safePath(path, 'task record path');
  if (!path.startsWith(TASK_ROOT)) fail('R1_CONTINUOUS_PATH_INVALID', 'record must remain under the task-local root');
  let taskRoot;
  try { taskRoot = realpathSync(resolve(root, git(root, ['rev-parse', '--git-path', 'core-ui-r1']))); }
  catch (error) { fail('R1_CONTINUOUS_PATH_INVALID', 'task-local root is unavailable', { cause: error.message }); }
  const result = resolve(taskRoot, path.slice(TASK_ROOT.length));
  if (!result.startsWith(`${taskRoot}/`)) fail('R1_CONTINUOUS_PATH_INVALID', 'task record escapes the task root');
  let stat;
  try { stat = lstatSync(result); } catch (error) { fail('R1_CONTINUOUS_PATH_INVALID', 'task-local record is unavailable', { cause: error.message }); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('R1_CONTINUOUS_PATH_INVALID', 'task-local record must be a regular non-symlink file');
  let real;
  try { real = realpathSync(result); } catch (error) { fail('R1_CONTINUOUS_PATH_INVALID', 'task-local record cannot be resolved', { cause: error.message }); }
  if (!real.startsWith(`${taskRoot}/`)) fail('R1_CONTINUOUS_PATH_INVALID', 'task-local record resolves outside the task root');
  return real;
}

function descriptor(value, label) {
  object(value, label);
  exactKeys(value, new Set(['path', 'digest', 'byteLength']), label);
  safePath(value.path, `${label}.path`);
  if (!DIGEST.test(value.digest) || !Number.isSafeInteger(value.byteLength) || value.byteLength < 0) fail('R1_CONTINUOUS_IDENTITY_INVALID', label);
  return { path: value.path, digest: value.digest, byteLength: value.byteLength };
}

function readTaskBytes(root, value, label) {
  const identity = descriptor(value, label);
  const bytes = readFileSync(taskAbsolutePath(root, identity.path));
  if (bytes.byteLength !== identity.byteLength || sha256(bytes) !== identity.digest) fail('R1_CONTINUOUS_IDENTITY_MISMATCH', `${label} bytes changed`);
  return { identity, bytes };
}

function readTaskJson(root, value, label) {
  const result = readTaskBytes(root, value, label);
  return { ...result, value: strictJson(result.bytes, label) };
}


function sourceRecord(root, value, operation = {}) {
  const { value: source } = readTaskJson(root, value, 'operation.source');
  exactKeys(source, new Set(['profile', 'branch', 'commit', 'tree']), 'operation.source');
  const actual = currentGit(root);
  if (source.profile !== 'core-ui-r1-source-v1' || source.branch !== actual.branch || source.commit !== actual.commit || source.tree !== actual.tree) {
    fail('R1_CONTINUOUS_SOURCE_DRIFT', 'operation.source does not bind the current checkout');
  }
  const bootstrapCandidate = operation.kind === 'verifier-bootstrap' ? bootstrapTopology(root, actual) : undefined;
  const postmergeMain = actual.branch === 'main' && ['routine-git-operation', 'verifier-bootstrap'].includes(operation.kind) && operation.action === 'postmerge';
  if (actual.branch === 'main' && !postmergeMain) fail('R1_CONTINUOUS_PROTECTED_BRANCH', 'only an exact routine postmerge may run on main');
  if (actual.branch !== 'main' && !actual.branch.startsWith('codex/') && !bootstrapCandidate) fail('R1_CONTINUOUS_PROTECTED_BRANCH', 'operation requires a codex topic branch');
  if (postmergeMain) {
    let originMain;
    try { originMain = git(root, ['rev-parse', 'refs/remotes/origin/main']); } catch { fail('R1_CONTINUOUS_SOURCE_INVALID', 'postmerge main source must bind origin/main'); }
    if (originMain !== actual.commit) fail('R1_CONTINUOUS_SOURCE_DRIFT', 'postmerge main source does not bind origin/main');
  }
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') fail('R1_CONTINUOUS_WORKTREE_DIRTY', 'operation requires a clean worktree');
  return actual;
}

function policy(root) {
  let value;
  try { value = parseJsonStrict(readFileSync(join(root, POLICY_PATH), 'utf8')); }
  catch (error) { fail('R1_CONTINUOUS_POLICY_INTEGRATION_INVALID', `repository policy is unavailable: ${error.message}`); }
  object(value, 'repository policy');
  const integration = object(value.r1ContinuousExecution, 'repository policy.r1ContinuousExecution');
  exactKeys(integration, new Set(['failClosed', 'profile', 'verifierPath', 'testPath', 'manifestPath', 'authorityMerge', 'bootstrapWriteSet', 'policyGate', 'hosted']), 'repository policy.r1ContinuousExecution');
  const merge = object(integration.authorityMerge, 'repository policy.r1ContinuousExecution.authorityMerge');
  exactKeys(merge, new Set(['commit', 'tree']), 'repository policy.r1ContinuousExecution.authorityMerge');
  if (integration.failClosed !== true || integration.profile !== PROFILE || integration.verifierPath !== VERIFIER_PATH || integration.testPath !== TEST_PATH || merge.commit !== AUTHORITY_COMMIT || merge.tree !== AUTHORITY_TREE) fail('R1_CONTINUOUS_POLICY_INTEGRATION_INVALID', 'policy gate is not bound to the accepted authority merge');
  equalPaths(exactPaths(integration.bootstrapWriteSet, 'policy bootstrap write set'), BOOTSTRAP_PATHS, 'R1_CONTINUOUS_POLICY_INTEGRATION_INVALID', 'bootstrap write set is not the exact ten-path implementation set');
  const gate = object(integration.policyGate, 'repository policy.r1ContinuousExecution.policyGate');
  exactKeys(gate, new Set(['requiredEnv', 'descriptorEnv', 'recordRoot', 'noOpPrefixes']), 'repository policy.r1ContinuousExecution.policyGate');
  if (gate.requiredEnv !== 'CORE_UI_R1_OPERATION_REQUIRED' || gate.descriptorEnv !== 'CORE_UI_R1_OPERATION_PATH' || gate.recordRoot !== TASK_ROOT || canonicalJson(gate.noOpPrefixes ?? null) !== canonicalJson([...APPROVED_NO_OP_PREFIXES])) fail('R1_CONTINUOUS_POLICY_INTEGRATION_INVALID', 'policy gate environment/no-op contract changed');
  const hostedConfig = object(integration.hosted, 'repository policy.r1ContinuousExecution.hosted');
  if (hostedConfig.provider !== 'github' || hostedConfig.repository !== 'ndrewtran/core-ui' || hostedConfig.defaultBranch !== 'main' || hostedConfig.protectedRef !== 'refs/heads/main') fail('R1_CONTINUOUS_POLICY_INTEGRATION_INVALID', 'hosted observation binding is not canonical');
  return integration;
}

function verifyAuthority(root) {
  if (git(root, ['rev-parse', `${AUTHORITY_COMMIT}^{tree}`]) !== AUTHORITY_TREE) fail('R1_CONTINUOUS_AUTHORITY_INVALID', 'accepted authority merge tree drifted');
  if (git(root, ['rev-list', '--parents', '-n', '1', AUTHORITY_COMMIT]).split(/\s+/u).slice(1).length !== 2) fail('R1_CONTINUOUS_AUTHORITY_INVALID', 'accepted authority is not a protected merge');
  if (git(root, ['rev-parse', `${PARENT_AUTHORITY_COMMIT}^{tree}`]) !== PARENT_AUTHORITY_TREE) fail('R1_CONTINUOUS_AUTHORITY_INVALID', 'immutable amendment-08 parent authority tree drifted');
  for (const path of PARENT_AUTHORITY_PATHS) {
    const expected = gitBytes(root, ['show', `${PARENT_AUTHORITY_COMMIT}:${path}`]);
    let current;
    try { current = readFileSync(join(root, path)); } catch { fail('R1_CONTINUOUS_AUTHORITY_INVALID', `${path} is absent`); }
    if (!current.equals(expected)) fail('R1_CONTINUOUS_AUTHORITY_INVALID', `${path} differs from immutable amendment-08 parent authority`);
  }
  for (const path of AUTHORITY_PATHS) {
    const expected = gitBytes(root, ['show', `${AUTHORITY_COMMIT}:${path}`]);
    let current;
    try { current = readFileSync(join(root, path)); } catch { fail('R1_CONTINUOUS_AUTHORITY_INVALID', `${path} is absent`); }
    if (!current.equals(expected)) fail('R1_CONTINUOUS_AUTHORITY_INVALID', `${path} differs from the accepted authority merge`);
  }
  return { commit: AUTHORITY_COMMIT, tree: AUTHORITY_TREE };
}

function acceptedBootstrapMerge(root) {
  let main;
  try { main = git(root, ['rev-parse', 'main']); } catch { return undefined; }
  const candidates = git(root, ['rev-list', '--first-parent', '--merges', main]).split(/\s+/u).filter(Boolean);
  for (const commit of candidates) {
    const parents = git(root, ['rev-list', '--parents', '-n', '1', commit]).split(/\s+/u).slice(1);
    if (parents.length !== 2 || parents[0] !== AUTHORITY_COMMIT) continue;
    const topic = parents[1];
    const topicParents = git(root, ['rev-list', '--parents', '-n', '1', topic]).split(/\s+/u).slice(1);
    if (topicParents.length !== 1 || topicParents[0] !== AUTHORITY_COMMIT) continue;
    const paths = changedPaths(root, AUTHORITY_COMMIT, topic);
    if (canonicalJson(paths) !== canonicalJson(BOOTSTRAP_PATHS)) continue;
    if (git(root, ['rev-parse', `${commit}^{tree}`]) !== git(root, ['rev-parse', `${topic}^{tree}`])) continue;
    return { commit, topic, tree: git(root, ['rev-parse', `${commit}^{tree}`]) };
  }
  return undefined;
}

function bootstrapTopology(root, current) {
  if (current.parents[0] !== AUTHORITY_COMMIT) return undefined;
  const topic = current.parents.length === 1 ? current.commit : current.parents.length === 2 ? current.parents[1] : undefined;
  if (!topic) return undefined;
  const topicParents = git(root, ['rev-list', '--parents', '-n', '1', topic]).split(/\s+/u).slice(1);
  if (topicParents.length !== 1 || topicParents[0] !== AUTHORITY_COMMIT) return undefined;
  const topicTree = git(root, ['rev-parse', `${topic}^{tree}`]);
  if (current.parents.length === 2 && (current.tree !== topicTree || canonicalJson(changedPaths(root, AUTHORITY_COMMIT, current.commit)) !== canonicalJson(changedPaths(root, AUTHORITY_COMMIT, topic)))) return undefined;
  const paths = changedPaths(root, AUTHORITY_COMMIT, topic);
  if (canonicalJson(paths) !== canonicalJson(BOOTSTRAP_PATHS)) return undefined;
  return { topic, topicTree, paths, synthetic: current.parents.length === 2 };
}

function isAuthorizedBootstrapCandidate(root, current, actualPaths) {
  if (!Array.isArray(actualPaths) || canonicalJson([...actualPaths].sort()) !== canonicalJson(BOOTSTRAP_PATHS)) return false;
  const topology = bootstrapTopology(root, current);
  return Boolean(topology && canonicalJson(topology.paths) === canonicalJson([...actualPaths].sort()));
}

function verifyBootstrapMainLineage(root, bootstrap) {
  let originMain;
  try { originMain = git(root, ['rev-parse', 'refs/remotes/origin/main']); }
  catch { fail('R1_CONTINUOUS_BOOTSTRAP_PROVIDER_REQUIRED', 'bootstrap receipt must bind the authenticated origin/main ref'); }
  if (!isAncestor(root, bootstrap.commit, originMain)) fail('R1_CONTINUOUS_BOOTSTRAP_SOURCE_INVALID', 'origin/main is not a descendant of the authenticated bootstrap merge');
  return { commit: originMain, tree: git(root, ['rev-parse', `${originMain}^{tree}`]), parents: git(root, ['rev-list', '--parents', '-n', '1', originMain]).split(/\s+/u).slice(1) };
}

function verifyCurrentMainObservation(root, postmerge, bootstrap) {
  const current = verifyBootstrapMainLineage(root, bootstrap);
  if (postmerge?.ref !== 'refs/heads/main' || postmerge.commit !== current.commit || postmerge.tree !== current.tree || canonicalJson(postmerge.orderedParents ?? []) !== canonicalJson(current.parents)) {
    fail('R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_DRIFT', 'fresh provider observation does not bind the exact current origin/main descendant');
  }
  return current;
}

/**
 * Protect the immutable hosted bootstrap facts while allowing the protected
 * branch topology to advance after the prerequisite merge. Provider response
 * identities are intentionally excluded because their raw and normalized
 * payloads contain that mutable topology; the canonical projection retains
 * all security, ruleset, review, attribution, and check observations.
 */
function bootstrapSecurityObservation(observation) {
  const security = { ...observation };
  delete security.postmerge;
  delete security.rawResponseIdentity;
  delete security.normalizedResponseIdentity;
  return security;
}

function bootstrapSecurityObservationIdentity(observation) {
  const bytes = bytesOf(canonicalJson(bootstrapSecurityObservation(observation)));
  return { digest: sha256(bytes), byteLength: bytes.byteLength };
}

function verifyBootstrapReceipt(root, value, bootstrap, options = {}) {
  const receiptBytes = readTaskJson(root, value, 'operation.bootstrapReceipt');
  const receipt = receiptBytes.value;
  exactKeys(receipt, new Set(['profile', 'operationKind', 'source', 'authorizedWriteSet', 'permittedWriteSet', 'observedChangedPaths', 'hosted', 'result', 'outputIdentity']), 'operation.bootstrapReceipt');
  if (receipt.profile !== RESULT_PROFILE || receipt.operationKind !== 'verifier-bootstrap' || receipt.result?.code !== 'R1_CONTINUOUS_BOOTSTRAP_PASSED' || receipt.result?.status !== 'passed') fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt is not a passed verifier result');
  const receiptPayload = { ...receipt };
  delete receiptPayload.outputIdentity;
  if (receipt.outputIdentity?.algorithm !== 'sha256' || receipt.outputIdentity.digest !== sha256(canonicalJson(receiptPayload)) || receipt.outputIdentity.byteLength !== Buffer.byteLength(canonicalJson(receiptPayload))) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt output identity is not exact');
  if (receipt.source?.commit !== bootstrap.topic || receipt.source?.tree !== bootstrap.tree) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt source does not bind the discovered prerequisite topic');
  equalPaths(exactPaths(receipt.authorizedWriteSet, 'bootstrap receipt authorizedWriteSet'), BOOTSTRAP_PATHS, 'R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt authorization is not exact');
  equalPaths(exactPaths(receipt.permittedWriteSet, 'bootstrap receipt permittedWriteSet'), BOOTSTRAP_PATHS, 'R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt permission is not exact');
  const receiptBootstrapPaths = changedPaths(root, AUTHORITY_COMMIT, bootstrap.topic);
  if (canonicalJson(receiptBootstrapPaths) !== canonicalJson(BOOTSTRAP_PATHS)) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt changed paths are not the exact ten-path implementation set');
  equalPaths(exactPaths(receipt.observedChangedPaths, 'bootstrap receipt observedChangedPaths'), receiptBootstrapPaths, 'R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt changed paths are not exact');
  const hostedResult = object(receipt.hosted, 'bootstrap receipt hosted result');
  const observation = object(hostedResult.observation, 'bootstrap receipt hosted observation');
  if (observation.provider !== 'github' || observation.repository !== 'ndrewtran/core-ui' || observation.defaultBranch !== 'main' || observation.protectedRef !== 'refs/heads/main') fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt provider binding is not canonical');
  const pull = object(observation.pullRequest, 'bootstrap receipt pull request');
  if (pull.number !== BOOTSTRAP_PULL_REQUEST_NUMBER || pull.headRefName !== BOOTSTRAP_HEAD_REF || pull.baseRefName !== 'main' || pull.baseCommit !== AUTHORITY_COMMIT || pull.headCommit !== bootstrap.topic || pull.merged !== true || pull.mergeCommit !== bootstrap.commit) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt pull request is not the exact prerequisite merge');
  const postmerge = object(observation.postmerge, 'bootstrap receipt postmerge');
  if (postmerge.ref !== 'refs/heads/main' || postmerge.commit !== bootstrap.commit || postmerge.tree !== bootstrap.tree || canonicalJson(postmerge.orderedParents) !== canonicalJson([AUTHORITY_COMMIT, bootstrap.topic])) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt postmerge topology is not exact');
  const required = providerRequiredChecks(observation);
  if (canonicalJson(hostedResult.requiredChecks ?? []) !== canonicalJson(required) || canonicalJson(hostedResult.requiredChecksIdentity ?? null) !== canonicalJson(observation.requiredChecksIdentity) || hostedResult.rawResponseIdentity?.digest !== observation.rawResponseIdentity?.digest || hostedResult.normalizedResponseIdentity?.digest !== observation.normalizedResponseIdentity?.digest) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt hosted identities are not exact');
  if (!Array.isArray(observation.checks)) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt omits hosted checks');
  for (const name of required) {
    const expectedIntegration = observation.requiredCheckIntegrations?.find(({ context }) => context === name)?.integrationId;
    const matches = observation.checks.filter((check) => check.name === name && check.headCommit === bootstrap.commit && (expectedIntegration === undefined || (check.integrationId ?? check.integration_id ?? check.app?.id ?? null) === expectedIntegration));
    if (matches.length !== 1 || matches[0].status !== 'completed' || matches[0].conclusion !== 'success') fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', `bootstrap receipt check ${name} is not green for the exact merge`);
  }
  const normalizedChecks = observation.checks.map((check) => ({ name: check.name, headCommit: check.headCommit, status: check.status, conclusion: check.conclusion, ...(check.integrationId !== undefined || check.integration_id !== undefined || check.app?.id !== undefined ? { integrationId: check.integrationId ?? check.integration_id ?? check.app?.id ?? null } : {}), ...(check.app ? { app: check.app } : {}) }));
  const checksBytes = bytesOf(canonicalJson(normalizedChecks));
  if (hostedResult.checksIdentity?.source !== 'github:required-main-check-results' || hostedResult.checksIdentity.digest !== sha256(checksBytes) || hostedResult.checksIdentity.byteLength !== checksBytes.byteLength) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_INVALID', 'bootstrap receipt check result identity is not exact');
  if (options.testOnlyBootstrapObservation === true && typeof options.bootstrapObservationRunner !== 'function') fail('R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_INVALID', 'test-only bootstrap observation requires an explicit fixture seam');
  const currentMain = verifyBootstrapMainLineage(root, bootstrap);
  const freshOperation = { kind: 'verifier-bootstrap', action: 'postmerge', bootstrapRefresh: true, git: { providerQuery: { repository: 'ndrewtran/core-ui', pullRequestNumber: BOOTSTRAP_PULL_REQUEST_NUMBER, headRefName: BOOTSTRAP_HEAD_REF } } };
  const freshActual = { commit: bootstrap.topic, tree: bootstrap.tree, base: AUTHORITY_COMMIT, parents: [AUTHORITY_COMMIT] };
  const freshHosted = hosted(root, freshOperation, freshActual, {
    ...options,
    testOnlyObservation: options.testOnlyBootstrapObservation === true,
    observationRunner: options.testOnlyBootstrapObservation === true ? options.bootstrapObservationRunner : undefined,
    bootstrapMerge: bootstrap,
    allowBootstrapMainDescendant: true,
  });
  const receiptObservation = observation;
  const freshObservation = freshHosted.observation;
  verifyCurrentMainObservation(root, freshObservation.postmerge, bootstrap);
  const receiptSecurityIdentity = bootstrapSecurityObservationIdentity(receiptObservation);
  const freshSecurityIdentity = bootstrapSecurityObservationIdentity(freshObservation);
  if (canonicalJson(receiptSecurityIdentity) !== canonicalJson(freshSecurityIdentity)) fail('R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_DRIFT', 'fresh provider security observation differs from bootstrap receipt');
  if (currentMain.commit === bootstrap.commit && canonicalJson(receiptObservation.postmerge ?? null) !== canonicalJson(freshObservation.postmerge ?? null)) fail('R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_DRIFT', 'provider bootstrap postmerge identity changed without an origin/main descendant transition');
  if (canonicalJson(hostedResult.requiredChecks ?? []) !== canonicalJson(freshHosted.requiredChecks ?? []) || canonicalJson(hostedResult.requiredChecksIdentity ?? null) !== canonicalJson(freshHosted.requiredChecksIdentity ?? null) || canonicalJson(hostedResult.checksIdentity ?? null) !== canonicalJson(freshHosted.checksIdentity ?? null)) fail('R1_CONTINUOUS_BOOTSTRAP_OBSERVATION_DRIFT', 'fresh provider result identities differ from bootstrap receipt');
  return receiptBytes.identity;
}

function ownerDigest(root, path) {
  const bytes = gitBytes(root, ['show', `${AUTHORITY_COMMIT}:${path}`]);
  return { path, digest: sha256(bytes), byteLength: bytes.byteLength };
}

function verifyFixedR1Inputs(root, envelope) {
  const snapshot = readFileSync(join(root, SNAPSHOT.path));
  if (snapshot.byteLength !== SNAPSHOT.byteLength || sha256(snapshot) !== SNAPSHOT.digest) fail('R1_CONTINUOUS_LOCK_INVALID', 'Stage1 snapshot bytes are not the exact accepted identity');
  const snapshotValue = strictJson(snapshot, SNAPSHOT.path);
  if (snapshotValue.coreSource?.commit !== STAGE1_SOURCE.commit || snapshotValue.coreSource?.tree !== STAGE1_SOURCE.tree || snapshotValue.families?.length !== 53 || snapshotValue.counts?.newImmutableScopeIds !== 45 || snapshotValue.counts?.existingExactScopeIdsReused !== 8) fail('R1_CONTINUOUS_LOCK_INVALID', 'Stage1 snapshot does not contain the fixed 53-family admission set');
  const snapshotEnvelope = readFileSync(join(root, SNAPSHOT.envelopePath));
  if (snapshotEnvelope.byteLength !== SNAPSHOT.envelopeByteLength || sha256(snapshotEnvelope) !== SNAPSHOT.envelopeDigest) fail('R1_CONTINUOUS_LOCK_INVALID', 'Stage1 snapshot envelope bytes are not exact');
  const envelopeValue = strictJson(snapshotEnvelope, SNAPSHOT.envelopePath);
  if (envelopeValue.source?.commit !== STAGE1_SOURCE.commit || envelopeValue.source?.tree !== STAGE1_SOURCE.tree || envelopeValue.digest !== SNAPSHOT.digest || envelopeValue.byteLength !== SNAPSHOT.byteLength) fail('R1_CONTINUOUS_LOCK_INVALID', 'Stage1 snapshot envelope source binding drifted');
  const baseline = readFileSync(join(root, BASELINE.path));
  if (baseline.byteLength !== BASELINE.byteLength || sha256(baseline) !== BASELINE.digest) fail('R1_CONTINUOUS_BASELINE_INVALID', 'R1.0 baseline bytes are not exact');
  const baselineValue = strictJson(baseline, BASELINE.path);
  if (baselineValue.sourceRevision !== BASELINE.sourceCommit || baselineValue.sourceTree !== BASELINE.sourceTree || baselineValue.milestone !== 'R1.0') fail('R1_CONTINUOUS_BASELINE_INVALID', 'R1.0 baseline source binding drifted');
  const scope = readFileSync(join(root, PRODUCT_SCOPE.path));
  if (sha256(scope) !== PRODUCT_SCOPE.digest || !scope.toString('utf8').startsWith('---\nscopeVersion: 6.0.1\n')) fail('R1_CONTINUOUS_SCOPE_INVALID', 'Product Scope 6.0.1 bytes are not exact');
  const expected = new Map(snapshotValue.families.map((entry) => [entry.family, entry]));
  const target = envelope.objective?.target;
  const selected = expected.get(target?.family);
  if (!selected) fail('R1_CONTINUOUS_FAMILY_UNKNOWN', 'envelope target family is not in the fixed Stage1 snapshot');
  for (const field of ['scopeId', 'tranche', 'source']) if (target[field] !== selected[field]) fail('R1_CONTINUOUS_LOCK_INVALID', `target ${field} does not bind the fixed Stage1 family entry`);
  if (!envelope.authority?.snapshot || envelope.authority.snapshot.digest !== SNAPSHOT.digest || envelope.authority.snapshot.sourceCommit !== STAGE1_SOURCE.commit || envelope.authority.snapshot.sourceTree !== STAGE1_SOURCE.tree) fail('R1_CONTINUOUS_LOCK_INVALID', 'envelope snapshot owner is not exact');
  if (!envelope.authority?.snapshotEnvelope || envelope.authority.snapshotEnvelope.digest !== SNAPSHOT.envelopeDigest || envelope.authority.snapshotEnvelope.sourceCommit !== STAGE1_SOURCE.commit || envelope.authority.snapshotEnvelope.sourceTree !== STAGE1_SOURCE.tree) fail('R1_CONTINUOUS_LOCK_INVALID', 'envelope snapshot-envelope owner is not exact');
  if (!envelope.authority?.baseline || envelope.authority.baseline.digest !== BASELINE.digest || envelope.authority.baseline.sourceCommit !== BASELINE.sourceCommit || envelope.authority.baseline.sourceTree !== BASELINE.sourceTree) fail('R1_CONTINUOUS_BASELINE_INVALID', 'envelope R1.0 baseline owner is not exact');
  if (!envelope.authority?.scope || envelope.authority.scope.digest !== PRODUCT_SCOPE.digest || envelope.authority.scope.sourceCommit !== AUTHORITY_COMMIT || envelope.authority.scope.sourceTree !== AUTHORITY_TREE) fail('R1_CONTINUOUS_SCOPE_INVALID', 'envelope Product Scope owner is not exact');
  return { snapshot: snapshotValue, baseline: baselineValue };
}

function checkIdentity(value, label) {
  const result = descriptor(value, label);
  return result;
}

function routineCompletedExpectation(root, operation) {
  if (operation.kind !== 'routine-git-operation' || operation.priorResult === undefined) return undefined;
  const { value: prior } = readTaskJson(root, operation.priorResult, 'operation.priorResult');
  const match = typeof prior.diff?.path === 'string'
    ? /^git-diff:([0-9a-f]{40})\.\.([0-9a-f]{40})$/u.exec(prior.diff.path)
    : null;
  if (!match || !HEX40.test(prior.source?.commit ?? '') || !HEX40.test(prior.source?.tree ?? '')) {
    fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'routine Git prior result does not bind the completed substantive source');
  }
  return { expectedBase: match[1], expectedHead: prior.source.commit };
}

function verifyEnvelope(root, envelopeDescriptor, actual, operation, completedExpectation) {
  const envelopeBytes = readTaskBytes(root, envelopeDescriptor, 'operation.intent');
  const validation = { repositoryRoot: root, expectedBase: actual.base, ...(completedExpectation ?? {}) };
  const envelope = parseChangeIntentBytes(envelopeBytes.bytes, validation);
  validateChangeIntentEnvelope(envelope, validation);
  verifyFixedR1Inputs(root, envelope);
  if (envelope.profile !== CHANGE_INTENT_PROFILE || (operation.kind !== 'routine-git-operation' && envelope.operation.kind !== operation.kind)) fail('R1_CONTINUOUS_CHANGE_INTENT_BINDING_INVALID', 'operation kind does not bind the exact ChangeIntent envelope');
  if (operation.kind !== 'routine-git-operation' && operation.action !== undefined && envelope.operation.action !== operation.action) fail('R1_CONTINUOUS_CHANGE_INTENT_BINDING_INVALID', 'operation action does not bind the exact ChangeIntent envelope');
  if (operation.kind !== 'routine-git-operation' && operation.transition !== undefined && canonicalJson(envelope.operation.transition ?? null) !== canonicalJson(operation.transition)) fail('R1_CONTINUOUS_TRANSITION_INVALID', 'operation transition does not bind the exact ChangeIntent envelope');
  if ((operation.kind !== 'routine-git-operation' && envelope.source.branch !== actual.branch) || envelope.source.commit !== actual.base || envelope.source.tree !== actual.baseTree) fail('R1_CONTINUOUS_BASE_DRIFT', 'envelope source is not the exact immutable operation base');
  if (operation.kind === 'routine-git-operation' && !isAncestor(root, envelope.source.commit, actual.commit)) fail('R1_CONTINUOUS_BASE_DRIFT', 'routine source is not descended from the intent source');
  for (const [key, expectedPath] of Object.entries({ decision: AUTHORITY_PATHS[0], acceptance: AUTHORITY_PATHS[1], architecture: AUTHORITY_PATHS[2], roadmap: AUTHORITY_PATHS[3], productScope: AUTHORITY_PATHS[4] })) {
    const owner = envelope.authority[key];
    if (owner.path !== expectedPath || owner.sourceCommit !== AUTHORITY_COMMIT || owner.sourceTree !== AUTHORITY_TREE || owner.digest !== ownerDigest(root, expectedPath).digest) fail('R1_CONTINUOUS_CHANGE_INTENT_AUTHORITY_INVALID', `${key} owner is not canonical`);
  }
  if (envelope.authority.lock.path !== SNAPSHOT.path || envelope.authority.lock.digest !== SNAPSHOT.digest || envelope.authority.lock.sourceCommit !== STAGE1_SOURCE.commit || envelope.authority.lock.sourceTree !== STAGE1_SOURCE.tree) fail('R1_CONTINUOUS_CHANGE_INTENT_LOCK_INVALID', 'envelope lock owner is not the accepted snapshot');
  const paths = envelope.writeSet.map(({ path }) => path).sort();
  const afterImages = envelope.proposal.afterImages.map(({ path }) => path).sort();
  if (operation.kind !== 'r1-lock' && canonicalJson(paths) !== canonicalJson(afterImages)) fail('R1_CONTINUOUS_CHANGE_INTENT_WRITE_SET_INVALID', 'envelope write set is not the exact after-image set');
  const expectedBeforeImages = sourceBeforeImages(root, envelope.source.commit, envelope.proposal.afterImages);
  if (canonicalJson(envelope.proposal.beforeImages) !== canonicalJson(expectedBeforeImages)) fail('R1_CONTINUOUS_BEFORE_IMAGE_MISMATCH', 'envelope before-images do not bind the exact source tree');
  if (canonicalJson(envelope.proposal.patch) !== canonicalJson(proposalPatchIdentity(expectedBeforeImages, envelope.proposal.afterImages))) fail('R1_CONTINUOUS_PATCH_MISMATCH', 'envelope patch is not derived from exact before/after images');
  const actualChanged = changedPaths(root, actual.base, actual.commit);
  if (operation.kind === 'r1-lock' && actualChanged.length > 0) fail('R1_CONTINUOUS_R1_LOCK_DIFF_INVALID', 'r1-lock requires an empty actual base..head diff', { actualChanged });
  const expectedChanged = derivedChangePaths(envelope, operation.kind);
  const generatedPaths = expectedChanged.filter((itemPath) => !paths.includes(itemPath));
  let policy;
  if (generatedPaths.length > 0) {
    try { policy = parseJsonStrict(readFileSync(join(root, POLICY_PATH), 'utf8')); }
    catch (error) { fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', 'repository policy is unavailable for generated projection validation', { cause: error.message }); }
    for (const projection of generatedPaths) {
      if (!envelope.affected.generatedProjections.includes(projection)) fail('R1_CONTINUOUS_GENERATED_PROJECTION_INVALID', `${projection} is not in the canonical generated projection closure`);
      validateGeneratedProjection(root, actual.commit, projection, policy);
    }
  }
  equalPaths(actualChanged, expectedChanged, 'R1_CONTINUOUS_CHANGE_INTENT_WRITE_SET_INVALID', 'actual Git paths do not equal the canonical source plus generated projection set');
  for (const image of envelope.proposal.afterImages) {
    validateActualImageState(root, actual.commit, image, `actual after-image ${image.path}`);
  }
  if (operation.kind !== 'r1-lock' && operation.kind !== 'project-migration' && envelope.proposal.afterImages.length === 0) fail('R1_CONTINUOUS_AFTER_IMAGE_MISSING', 'non-lock operation has no proposed after-images');
  if (operation.permittedWriteSet === undefined || operation.authorizedWriteSet === undefined) fail('R1_CONTINUOUS_WRITE_SET_MISMATCH', 'operation must repeat the derived write set for relation checking');
  equalPaths(exactPaths(operation.permittedWriteSet, 'operation.permittedWriteSet', paths.length === 0), paths, 'R1_CONTINUOUS_WRITE_SET_MISMATCH', 'permitted write set differs from ChangeIntent');
  equalPaths(exactPaths(operation.authorizedWriteSet, 'operation.authorizedWriteSet', paths.length === 0), paths, 'R1_CONTINUOUS_WRITE_SET_MISMATCH', 'authorized write set differs from ChangeIntent');
  if (operation.kind === 'component-implementation' || operation.kind === 'retained-evidence-acceptance') {
    if (operation.lock === undefined) fail('R1_CONTINUOUS_CHANGE_INTENT_LOCK_INVALID', `${operation.kind} requires its exact lock identity`);
    const lock = checkIdentity(operation.lock, 'operation.lock');
    if (!envelope.operation.lock || canonicalJson(lock) !== canonicalJson(envelope.operation.lock)) fail('R1_CONTINUOUS_CHANGE_INTENT_LOCK_INVALID', 'operation lock does not bind the envelope lock identity');
  }
  if (operation.kind === 'retained-evidence-acceptance') {
    if (envelope.operation.effectClass !== 'evidence-retention-write' || operation.evidence === undefined) fail('R1_CONTINUOUS_CHANGE_INTENT_EVIDENCE_INVALID', 'evidence operation is not bound to evidence-retention-write');
    const evidence = checkIdentity(operation.evidence, 'operation.evidence');
    if (!envelope.operation.evidence || canonicalJson(evidence) !== canonicalJson(envelope.operation.evidence)) fail('R1_CONTINUOUS_CHANGE_INTENT_EVIDENCE_INVALID', 'operation evidence does not bind the envelope evidence identity');
    if (paths.some((path) => !path.startsWith('tests/evidence/'))) fail('R1_CONTINUOUS_CHANGE_INTENT_EVIDENCE_INVALID', 'evidence write set escapes the evidence root');
    if (envelope.writeSet.some(({ effect }) => effect !== 'evidence-retention-write')) fail('R1_CONTINUOUS_CHANGE_INTENT_EVIDENCE_INVALID', 'evidence write set is not classified as evidence-retention-write');
  }
  return { envelope, identity: envelopeBytes.identity };
}

function verifyRoutineEnvelopeReuse(envelope, prior) {
  if (envelope.result === undefined) fail('R1_CONTINUOUS_CHANGE_INTENT_RESULT_REQUIRED', 'routine Git requires the completed substantive ChangeIntent result');
  const expectedHead = { path: 'git-head', digest: sha256(bytesOf(prior.source.commit)), byteLength: Buffer.byteLength(prior.source.commit) };
  const expectedTree = { path: 'git-tree', digest: sha256(bytesOf(prior.source.tree)), byteLength: Buffer.byteLength(prior.source.tree) };
  if (canonicalJson(envelope.result.head) !== canonicalJson(expectedHead) || canonicalJson(envelope.result.tree) !== canonicalJson(expectedTree) || envelope.result.diff.digest !== prior.diff.digest || envelope.result.diff.byteLength !== prior.diff.byteLength || canonicalJson(envelope.result.changedPaths) !== canonicalJson(prior.observedChangedPaths) || envelope.result.envelopeDigest !== envelope.intentId) {
    fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'routine Git does not reuse the exact completed substantive ChangeIntent result');
  }
}

function deriveIntermediateBoundary(root, envelope, operation, actual, prior) {
  const target = envelope.objective?.target;
  const kind = envelope.operation?.kind;
  const tranche = target?.tranche;
  const isLock = kind === 'r1-lock' && tranche === 'R1.0';
  const isR1Work = ['component-implementation', 'retained-evidence-acceptance'].includes(kind) && /^R1\.[1-4]$/u.test(tranche ?? '');
  if (!isLock && !isR1Work) fail('R1_CONTINUOUS_STOP_BOUNDARY', 'hosted operation is not bound to an admitted intermediate R1.0-R1.4 lineage');
  if (envelope.result === undefined) fail('R1_CONTINUOUS_STOP_BOUNDARY', 'hosted operation omits the completed canonical ChangeIntent result');
  if (operation.kind === 'routine-git-operation') {
    if (!prior?.value || prior.value.result?.code !== 'R1_CONTINUOUS_OPERATION_PASSED' || prior.value.result?.status !== 'passed' || !prior.value.envelope) fail('R1_CONTINUOUS_STOP_BOUNDARY', 'hosted routine operation lacks the exact completed substantive result lineage');
  }
  const paths = kind === 'r1-lock' ? [] : changedPaths(root, actual.base, actual.commit);
  const envelopePaths = derivedChangePaths(envelope, kind);
  if (canonicalJson(paths) !== canonicalJson(envelopePaths)) fail('R1_CONTINUOUS_STOP_BOUNDARY', 'hosted operation write set is not the exact canonical intermediate target');
  return Object.freeze({ kind, tranche, target: { family: target.family, scopeId: target.scopeId, source: target.source }, writeSet: paths, completedResult: { envelopeDigest: envelope.result.envelopeDigest, head: envelope.result.head, tree: envelope.result.tree } });
}

function validateProviderCommitAttribution(observation) {
  const hasAttribution = observation.commitAttribution !== undefined || observation.allCommitsAttributed !== undefined || observation.commitAttributionDigest !== undefined;
  if (!hasAttribution) return undefined;
  if (!Array.isArray(observation.commitAttribution) || observation.commitAttribution.length === 0 || typeof observation.allCommitsAttributed !== 'boolean' || !DIGEST.test(observation.commitAttributionDigest ?? '') || observation.commitAttributionDigest !== sha256(canonicalJson({ commits: observation.commitAttribution, allCommitsAttributed: observation.allCommitsAttributed })) || observation.commitAttribution.some((commit) => !isObject(commit) || Object.keys(commit).some((key) => !['sha', 'user', 'attributed'].includes(key)) || !HEX40.test(commit.sha ?? '') || (commit.user !== null && (typeof commit.user !== 'string' || commit.user.trim() === '')) || typeof commit.attributed !== 'boolean' || commit.attributed !== (typeof commit.user === 'string' && commit.user.trim() !== '')) || new Set(observation.commitAttribution.map(({ sha }) => sha)).size !== observation.commitAttribution.length || observation.allCommitsAttributed !== observation.commitAttribution.every(({ attributed }) => attributed === true)) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider commit attribution is incomplete or not exact');
  return { commits: observation.commitAttribution, allCommitsAttributed: observation.allCommitsAttributed };
}

function compareProviderReview(left, right, leftIndex, rightIndex) {
  const leftTime = Date.parse(left.submittedAt ?? '');
  const rightTime = Date.parse(right.submittedAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  if (Number.isSafeInteger(left.id) && Number.isSafeInteger(right.id) && left.id !== right.id) return left.id - right.id;
  return leftIndex - rightIndex;
}

export function providerRequiredChecks(observation) {
  const protection = isObject(observation.protection) ? observation.protection : {};
  if (protection.requiredReviewThreadResolution === true && observation.reviewThreadsResolved !== true) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider observation cannot prove all required review threads are resolved');
  const attribution = validateProviderCommitAttribution(observation);
  if (protection.extraApprovalForUnattributedChanges !== undefined) {
    if (!Number.isInteger(protection.extraApprovalForUnattributedChanges) || protection.extraApprovalForUnattributedChanges < 1 || !attribution) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider commit attribution is required for extra approval rules');
    if (!attribution.allCommitsAttributed && observation.unattributedChangesApprovalSatisfied !== true) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider observation cannot prove extra approval for unattributed changes');
  }
  if (protection.allowedMergeMethods !== undefined && (!Array.isArray(protection.allowedMergeMethods) || protection.allowedMergeMethods.length === 0 || protection.allowedMergeMethods.some((method) => !['merge', 'squash', 'rebase'].includes(method)))) fail('R1_CONTINUOUS_HOSTED_MERGE_METHOD_INVALID', 'provider allowed merge methods are unsupported');
  if (!Array.isArray(observation.requiredChecks) || observation.requiredChecks.length === 0 || observation.requiredChecks.some((name) => typeof name !== 'string' || name.length === 0) || new Set(observation.requiredChecks).size !== observation.requiredChecks.length || canonicalJson([...observation.requiredChecks].sort()) !== canonicalJson(observation.requiredChecks)) fail('R1_CONTINUOUS_HOSTED_CHECK_RULES_INVALID', 'required checks must be the provider-derived complete ordered set');
  if (observation.requiredCheckIntegrations !== undefined && (!Array.isArray(observation.requiredCheckIntegrations) || observation.requiredCheckIntegrations.length !== observation.requiredChecks.length || canonicalJson([...observation.requiredCheckIntegrations].sort((left, right) => left.context.localeCompare(right.context))) !== canonicalJson(observation.requiredCheckIntegrations) || observation.requiredCheckIntegrations.some(({ context, integrationId }) => typeof context !== 'string' || !observation.requiredChecks.includes(context) || (integrationId !== null && !Number.isInteger(integrationId))))) fail('R1_CONTINUOUS_HOSTED_CHECK_RULES_INVALID', 'required check context/integration identity is incomplete');
  const requiredCheckIntegrations = observation.requiredCheckIntegrations?.length ? observation.requiredCheckIntegrations : undefined;
  const protectionRequirements = {
    ...(protection.requiredReviewThreadResolution === true ? { requiredReviewThreadResolution: true } : {}),
    ...(protection.extraApprovalForUnattributedChanges !== undefined ? { extraApprovalForUnattributedChanges: protection.extraApprovalForUnattributedChanges } : {}),
    ...(protection.allowedMergeMethods ? { allowedMergeMethods: protection.allowedMergeMethods } : {}),
    ...(observation.commitAttributionDigest ? { commitAttributionDigest: observation.commitAttributionDigest } : {}),
  };
  const bytes = bytesOf(canonicalJson({ requiredChecks: observation.requiredChecks, ...(requiredCheckIntegrations ? { requiredCheckIntegrations } : {}), requiredReviews: observation.requiredReviews ?? [], ...protectionRequirements }));
  if (observation.requiredChecksIdentity?.source !== 'github:protected-main-required-checks' || observation.requiredChecksIdentity.digest !== sha256(bytes) || observation.requiredChecksIdentity.byteLength !== bytes.byteLength) fail('R1_CONTINUOUS_HOSTED_CHECK_RULES_INVALID', 'required-check identity is not bound to the complete provider protection response');
  if (!observation.rawResponseIdentity?.digest || !observation.rawResponseIdentity?.byteLength || !DIGEST.test(observation.rawResponseIdentity.digest) || observation.rawResponseIdentity.source !== 'github:rest:raw-observation') fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'raw provider response identity is required');
  if (!observation.normalizedResponseIdentity?.digest || !observation.normalizedResponseIdentity?.byteLength || !DIGEST.test(observation.normalizedResponseIdentity.digest) || observation.normalizedResponseIdentity.source !== 'github:rest:normalized-observation') fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'normalized provider response identity is required');
  const reviews = Array.isArray(observation.reviews) ? observation.reviews : [];
  const headCommit = observation.pullRequest?.headCommit;
  if (typeof headCommit !== 'string' || !HEX40.test(headCommit)) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider review state omits the exact pull-request head');
  const latestByReviewer = new Map();
  for (const [index, review] of reviews.entries()) {
    if (typeof review.reviewer !== 'string' || review.reviewer.trim() === '' || !HEX40.test(review.commitId ?? review.headCommit ?? '') || !['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'].includes(review.state)) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider review state is malformed');
    const prior = latestByReviewer.get(review.reviewer);
    if (!prior || compareProviderReview(prior.review, review, prior.index, index) <= 0) latestByReviewer.set(review.reviewer, { review, index });
  }
  const latestReviews = [...latestByReviewer.values()].map(({ review }) => review);
  if (latestReviews.some(({ state }) => state === 'CHANGES_REQUESTED')) fail('R1_CONTINUOUS_HOSTED_REVIEW_CHANGES_REQUESTED', 'a current-head reviewer has superseded approval with changes requested');
  const approvedReviewers = latestReviews.filter(({ state }) => state === 'APPROVED').map(({ reviewer }) => reviewer);
  if (!Array.isArray(observation.requiredReviews)) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider-required review rules are malformed');
  for (const rule of observation.requiredReviews) {
    if (!isObject(rule) || Object.keys(rule).some((key) => !['approvals', 'codeOwnerReviews', 'dismissStaleReviews', 'requireLastPushApproval'].includes(key)) || !Number.isInteger(rule.approvals) || rule.approvals < 0 || typeof rule.codeOwnerReviews !== 'boolean' || typeof rule.dismissStaleReviews !== 'boolean' || (rule.requireLastPushApproval !== undefined && rule.requireLastPushApproval !== true)) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider-required review rule is malformed');
    if (rule.codeOwnerReviews) fail('R1_CONTINUOUS_HOSTED_REVIEW_UNSUPPORTED', 'code-owner approval cannot be independently proved');
  }
  const reviewsSatisfied = observation.requiredReviews.every(({ approvals, dismissStaleReviews, requireLastPushApproval }) => {
    const eligible = latestReviews.filter(({ state, commitId, headCommit: reviewHead }) => state === 'APPROVED' && (!dismissStaleReviews || (commitId ?? reviewHead) === headCommit)).map(({ reviewer }) => reviewer);
    if (eligible.length < approvals) return false;
    if (!requireLastPushApproval) return true;
    if (typeof observation.lastPushActor !== 'string' || observation.lastPushActor.trim() === '' || approvedReviewers.includes(observation.lastPushActor)) return false;
    return eligible.length >= approvals;
  });
  if (observation.requiredReviews.some(({ requireLastPushApproval }) => requireLastPushApproval) && typeof observation.lastPushActor === 'string' && approvedReviewers.includes(observation.lastPushActor)) fail('R1_CONTINUOUS_HOSTED_REVIEW_SELF_APPROVAL', 'last pusher cannot approve its own latest push');
  if (observation.requiredReviewsSatisfied !== reviewsSatisfied || !reviewsSatisfied) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'provider-required reviews are not independently satisfied at the current head');
  if (observation.requiredReviewBots !== undefined) {
    const currentApprovedReviewers = new Set(latestReviews.filter(({ state, commitId, headCommit: reviewHead }) => state === 'APPROVED' && (commitId ?? reviewHead) === headCommit).map(({ reviewer }) => reviewer));
    const derivedReviewBots = [...new Set([...currentApprovedReviewers].filter((reviewer) => observation.requiredReviewBots.includes(reviewer)))].sort();
    if (!Array.isArray(observation.requiredReviewBots) || observation.requiredReviewBots.some((name) => typeof name !== 'string' || name.length === 0) || canonicalJson([...observation.requiredReviewBots].sort()) !== canonicalJson(observation.requiredReviewBots) || new Set(observation.requiredReviewBots).size !== observation.requiredReviewBots.length || !Array.isArray(observation.reviewBots) || canonicalJson([...observation.reviewBots].sort()) !== canonicalJson(observation.reviewBots) || canonicalJson(observation.reviewBots) !== canonicalJson(observation.requiredReviewBots) || canonicalJson(derivedReviewBots) !== canonicalJson(observation.requiredReviewBots)) fail('R1_CONTINUOUS_HOSTED_REVIEW_BOT_MISSING', 'provider-derived required review-bot set is incomplete or drifted');
  }
  return observation.requiredChecks;
}

function githubRulesetApplies(ruleset, repository) {
  if (ruleset.target === 'tag') return false;
  if (ruleset.target !== 'branch') fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', 'active ruleset target is unsupported');
  const conditions = ruleset.conditions ?? {};
  if (!isObject(conditions) || Object.keys(conditions).some((key) => !['ref_name', 'repository_name'].includes(key))) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', 'active ruleset condition is unsupported');
  const refs = conditions.ref_name ?? {};
  const repositories = conditions.repository_name ?? {};
  const validCondition = (condition, label) => {
    if (!isObject(condition) || Object.keys(condition).some((key) => !['include', 'exclude'].includes(key)) || (condition.include !== undefined && !Array.isArray(condition.include)) || (condition.exclude !== undefined && !Array.isArray(condition.exclude))) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `${label} condition is unsupported`);
    for (const pattern of [...(condition.include ?? []), ...(condition.exclude ?? [])]) if (typeof pattern !== 'string' || pattern.length === 0) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `${label} condition pattern is unsupported`);
  };
  validCondition(refs, 'ref_name');
  validCondition(repositories, 'repository_name');
  const globMatches = (pattern, value, label) => {
    if (typeof pattern !== 'string' || pattern.length === 0 || /[\[\]{}()!+|\\]/u.test(pattern)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `${label} condition pattern is unsupported`);
    const escaped = pattern.replace(/[.+^$?]/gu, '\\$&').replace(/\*\*/gu, '.*').replace(/\*/gu, '[^/]*');
    return new RegExp(`^${escaped}$`, 'u').test(value);
  };
  const refMatches = (pattern) => {
    if (pattern === '~ALL') return true;
    if (pattern === '~DEFAULT_BRANCH') return true;
    const normalized = pattern.startsWith('refs/heads/') ? pattern : `refs/heads/${pattern}`;
    return globMatches(normalized, 'refs/heads/main', 'ref_name');
  };
  const repositoryMatches = (pattern) => pattern === '~ALL' || globMatches(pattern, repository, 'repository_name') || globMatches(pattern, repository.split('/').at(-1), 'repository_name');
  if (Array.isArray(refs.include) && refs.include.length > 0 && !refs.include.some(refMatches)) return false;
  if (Array.isArray(refs.exclude) && refs.exclude.some(refMatches)) return false;
  if (Array.isArray(repositories.include) && repositories.include.length > 0 && !repositories.include.some(repositoryMatches)) return false;
  if (Array.isArray(repositories.exclude) && repositories.exclude.some(repositoryMatches)) return false;
  return true;
}

function classicProtectionFacts(protection) {
  const enforceAdmins = protection.enforce_admins;
  if (enforceAdmins !== undefined && !(typeof enforceAdmins === 'boolean' || (isObject(enforceAdmins) && typeof enforceAdmins.enabled === 'boolean' && Object.keys(enforceAdmins).every((key) => ['enabled', 'url'].includes(key))))) fail('R1_CONTINUOUS_HOSTED_CLASSIC_UNSUPPORTED', 'classic enforce_admins response is unsupported');
  const restrictions = protection.restrictions;
  if (restrictions !== undefined) {
    if (!isObject(restrictions) || Object.keys(restrictions).some((key) => !['url', 'users_url', 'teams_url', 'apps_url', 'users', 'teams', 'apps'].includes(key)) || Object.entries(restrictions).filter(([key]) => ['users', 'teams', 'apps'].includes(key)).some(([, value]) => !Array.isArray(value))) fail('R1_CONTINUOUS_HOSTED_CLASSIC_UNSUPPORTED', 'classic restrictions response is unsupported');
    if (Object.entries(restrictions).filter(([key]) => ['users', 'teams', 'apps'].includes(key)).some(([, value]) => value.length > 0)) fail('R1_CONTINUOUS_HOSTED_RESTRICTION', 'classic branch restrictions cannot be independently proved for this operation');
  }
  const reviewRule = protection.required_pull_request_reviews;
  if (reviewRule?.bypass_pull_request_allowances !== undefined) {
    const bypass = reviewRule.bypass_pull_request_allowances;
    if (!isObject(bypass) || Object.keys(bypass).some((key) => !['users', 'teams', 'apps'].includes(key)) || Object.values(bypass).some((value) => !Array.isArray(value))) fail('R1_CONTINUOUS_HOSTED_CLASSIC_UNSUPPORTED', 'classic pull-request bypass allowances are unsupported');
    if (Object.values(bypass).some((value) => value.length > 0)) fail('R1_CONTINUOUS_HOSTED_REVIEW_BYPASS', 'classic pull-request bypass allowances are not permitted');
  }
  const enabled = typeof enforceAdmins === 'boolean' ? enforceAdmins : enforceAdmins?.enabled;
  if (enabled === false) fail('R1_CONTINUOUS_HOSTED_CLASSIC_BYPASS', 'classic enforce_admins is disabled');
  return { enforceAdmins: enabled === true };
}

/** Normalize detailed GitHub rulesets together with optional classic protection. */
export function normalizeGitHubRulesetPages(pages) {
  if (!Array.isArray(pages)) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'provider ruleset pagination response is not an array');
  return pages.flatMap((page) => {
    if (Array.isArray(page)) return page;
    if (!isObject(page) || !Array.isArray(page.rulesets)) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'provider ruleset pagination page is malformed');
    return page.rulesets;
  });
}

export function normalizeGitHubPagedCollection(pages, label = 'provider collection') {
  if (!Array.isArray(pages) || pages.length === 0 || pages.some((page) => !Array.isArray(page))) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', `${label} pagination is incomplete or malformed`);
  const items = pages.flat();
  const ids = items.map((item) => item?.id);
  let direction;
  for (let index = 1; index < ids.length; index += 1) {
    const step = Math.sign(ids[index] - ids[index - 1]);
    if (step === 0 || (direction !== undefined && step !== direction)) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', `${label} pagination ordering is ambiguous or duplicated`);
    direction ??= step;
  }
  if (items.some((item) => !isObject(item) || !Number.isSafeInteger(item.id)) || new Set(ids).size !== ids.length) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', `${label} pagination ordering is ambiguous or duplicated`);
  return items;
}

export function normalizeGitHubProtection({ repository, protection = {}, rulesets = [], rulesetDetails = [] }) {
  if (!isObject(protection) || !Array.isArray(rulesets) || !Array.isArray(rulesetDetails)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', 'provider protection response is malformed');
  const detailIds = new Set();
  for (const detail of rulesetDetails) {
    if (!isObject(detail) || detail.id === undefined) continue;
    if (detailIds.has(detail.id)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `ruleset detail ${detail.id} is duplicated`);
    detailIds.add(detail.id);
  }
  const details = new Map(rulesetDetails.filter((ruleset) => ruleset?.id !== undefined).map((ruleset) => [ruleset.id, ruleset]));
  const activeRulesets = [];
  const summaryIds = new Set();
  for (const summary of rulesets) {
    if (!isObject(summary)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', 'ruleset summary is malformed');
    if (summary.enforcement === 'disabled' || summary.enforcement === 'inactive') continue;
    if (!Number.isInteger(summary.id)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', 'ruleset summary omits an exact id');
    if (summaryIds.has(summary.id)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `ruleset summary ${summary.id} is duplicated`);
    summaryIds.add(summary.id);
    if (summary.enforcement !== 'active' && summary.enforcement !== undefined) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', 'ruleset enforcement is unsupported');
    const detail = details.get(summary.id);
    if (!detail) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `active ruleset ${summary.id} detail is unavailable`);
    if (detail.enforcement === 'disabled' || detail.enforcement === 'inactive') continue;
    if (detail.enforcement !== undefined && detail.enforcement !== 'active') fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `ruleset ${summary.id} detail enforcement is unsupported`);
    const merged = { ...summary, ...detail };
    if (!githubRulesetApplies(merged, repository)) continue;
    if (merged.bypass_actors !== undefined && !Array.isArray(merged.bypass_actors)) fail('R1_CONTINUOUS_HOSTED_RULESET_UNSUPPORTED', `applicable ruleset ${summary.id} bypass actors are malformed`);
    if (Array.isArray(merged.bypass_actors) && merged.bypass_actors.length > 0) fail('R1_CONTINUOUS_HOSTED_RULESET_BYPASS', `applicable ruleset ${summary.id} has bypass actors`);
    activeRulesets.push(merged);
  }
  const rules = activeRulesets.flatMap((ruleset) => ruleset.rules ?? []);
  const rulesetChecks = [];
  const requiredCheckIntegrations = [];
  const rulesetReviews = [];
  const requiredReviewBots = [];
  let requiredReviewThreadResolution = false;
  let extraApprovalForUnattributedChanges = 0;
  let allowedMergeMethods;
  for (const rule of rules) {
    if (!isObject(rule) || typeof rule.type !== 'string' || Object.keys(rule).some((key) => !['type', 'parameters'].includes(key))) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'active ruleset rule shape is unsupported');
    const parameters = rule.parameters ?? {};
    if (!isObject(parameters)) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', `active ruleset ${rule.type} parameters are unsupported`);
    if (['deletion', 'non_fast_forward'].includes(rule.type)) {
      if (Object.keys(parameters).length !== 0) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', `${rule.type} rule parameters are unsupported`);
      continue;
    }
    if (rule.type === 'required_status_checks') {
      if (Object.keys(parameters).some((key) => !['required_status_checks', 'do_not_enforce_on_create', 'strict_required_status_checks_policy'].includes(key)) || !Array.isArray(parameters.required_status_checks) || (parameters.do_not_enforce_on_create !== undefined && typeof parameters.do_not_enforce_on_create !== 'boolean') || (parameters.strict_required_status_checks_policy !== undefined && typeof parameters.strict_required_status_checks_policy !== 'boolean')) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'required status check parameters are unsupported');
      for (const check of parameters.required_status_checks) {
        if (!isObject(check) || typeof check.context !== 'string' || check.context.length === 0 || Object.keys(check).some((key) => !['context', 'integration_id'].includes(key)) || (check.integration_id !== undefined && check.integration_id !== null && !Number.isInteger(check.integration_id))) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'required status check entry is unsupported');
        rulesetChecks.push(check.context);
        requiredCheckIntegrations.push({ context: check.context, integrationId: check.integration_id ?? null });
      }
    } else if (rule.type === 'pull_request') {
      const allowed = ['required_approving_review_count', 'dismiss_stale_reviews_on_push', 'require_code_owner_review', 'require_last_push_approval', 'required_review_thread_resolution', 'require_extra_approval_for_unattributed_changes', 'required_reviewers', 'allowed_merge_methods'];
      if (Object.keys(parameters).some((key) => !allowed.includes(key)) || !Number.isInteger(parameters.required_approving_review_count) || parameters.required_approving_review_count < 0 || (parameters.dismiss_stale_reviews_on_push !== undefined && typeof parameters.dismiss_stale_reviews_on_push !== 'boolean') || (parameters.require_code_owner_review !== undefined && typeof parameters.require_code_owner_review !== 'boolean') || (parameters.require_last_push_approval !== undefined && typeof parameters.require_last_push_approval !== 'boolean') || (parameters.required_review_thread_resolution !== undefined && typeof parameters.required_review_thread_resolution !== 'boolean') || (parameters.require_extra_approval_for_unattributed_changes !== undefined && typeof parameters.require_extra_approval_for_unattributed_changes !== 'boolean')) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'pull request rule parameters are unsupported');
      rulesetReviews.push({ approvals: parameters.required_approving_review_count, codeOwnerReviews: parameters.require_code_owner_review === true, dismissStaleReviews: parameters.dismiss_stale_reviews_on_push === true, ...(parameters.require_last_push_approval === true ? { requireLastPushApproval: true } : {}) });
      if (parameters.required_review_thread_resolution === true) requiredReviewThreadResolution = true;
      if (parameters.require_extra_approval_for_unattributed_changes === true) extraApprovalForUnattributedChanges = Math.max(extraApprovalForUnattributedChanges, 1);
      if (parameters.allowed_merge_methods !== undefined) {
        if (!Array.isArray(parameters.allowed_merge_methods) || parameters.allowed_merge_methods.length === 0 || parameters.allowed_merge_methods.some((method) => !['merge', 'squash', 'rebase'].includes(method)) || new Set(parameters.allowed_merge_methods).size !== parameters.allowed_merge_methods.length) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'pull request allowed merge methods are unsupported');
        const methods = [...parameters.allowed_merge_methods].sort();
        if (allowedMergeMethods && canonicalJson(allowedMergeMethods) !== canonicalJson(methods)) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'active rulesets disagree on allowed merge methods');
        allowedMergeMethods = methods;
      }
      if (parameters.required_reviewers !== undefined) {
        if (!Array.isArray(parameters.required_reviewers)) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'pull request required reviewers are unsupported');
        for (const reviewer of parameters.required_reviewers) {
          const name = typeof reviewer === 'string' ? reviewer : reviewer?.login ?? reviewer?.name;
          if (typeof name !== 'string' || name.length === 0) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'pull request required reviewer identity is unsupported');
          requiredReviewBots.push(name);
        }
      }
    } else if (rule.type === 'required_reviewers') {
      if (Object.keys(parameters).some((key) => !['reviewers', 'reviewer'].includes(key))) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'required reviewer parameters are unsupported');
      const reviewers = parameters.reviewers ?? parameters.reviewer;
      if (!Array.isArray(reviewers)) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'required reviewer list is unsupported');
      for (const reviewer of reviewers) {
        const name = typeof reviewer === 'string' ? reviewer : reviewer?.login ?? reviewer?.name;
        if (typeof name !== 'string' || name.length === 0) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'required reviewer identity is unsupported');
        requiredReviewBots.push(name);
      }
    } else if (rule.type === 'required_review_thread_resolution') {
      if (Object.keys(parameters).length !== 0) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'required review thread resolution parameters are unsupported');
      requiredReviewThreadResolution = true;
    } else if (rule.type === 'require_extra_approval_for_unattributed_changes') {
      if (Object.keys(parameters).some((key) => key !== 'approvals_required') || !Number.isInteger(parameters.approvals_required) || parameters.approvals_required < 1) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'extra approval parameters are unsupported');
      extraApprovalForUnattributedChanges = Math.max(extraApprovalForUnattributedChanges, parameters.approvals_required);
    } else if (rule.type === 'allowed_merge_methods') {
      if (Object.keys(parameters).some((key) => key !== 'allowed_merge_methods') || !Array.isArray(parameters.allowed_merge_methods) || parameters.allowed_merge_methods.length === 0 || parameters.allowed_merge_methods.some((method) => !['merge', 'squash', 'rebase'].includes(method)) || new Set(parameters.allowed_merge_methods).size !== parameters.allowed_merge_methods.length) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'allowed merge methods are unsupported');
      const methods = [...parameters.allowed_merge_methods].sort();
      if (allowedMergeMethods && canonicalJson(allowedMergeMethods) !== canonicalJson(methods)) fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', 'active rulesets disagree on allowed merge methods');
      allowedMergeMethods = methods;
    } else {
      fail('R1_CONTINUOUS_HOSTED_RULE_UNSUPPORTED', `active ruleset rule ${rule.type} is unsupported`);
    }
  }
  const classicCheckEntries = protection.required_status_checks?.checks ?? [];
  const classicCheckContexts = new Set(classicCheckEntries.map(({ context }) => context));
  const classicChecks = [...(protection.required_status_checks?.contexts ?? []).filter((context) => !classicCheckContexts.has(context)), ...classicCheckEntries.map(({ context }) => context)];
  if (protection.required_status_checks !== undefined && (!isObject(protection.required_status_checks) || Object.keys(protection.required_status_checks).some((key) => !['url', 'strict', 'contexts', 'contexts_url', 'checks', 'checks_url'].includes(key)) || (protection.required_status_checks.contexts !== undefined && (!Array.isArray(protection.required_status_checks.contexts) || protection.required_status_checks.contexts.some((context) => typeof context !== 'string' || context.length === 0))) || (protection.required_status_checks.checks !== undefined && (!Array.isArray(protection.required_status_checks.checks) || protection.required_status_checks.checks.some((check) => !isObject(check) || Object.keys(check).some((key) => !['context', 'app_id'].includes(key)) || typeof check.context !== 'string' || check.context.length === 0 || (check.app_id !== undefined && check.app_id !== null && !Number.isInteger(check.app_id))))))) fail('R1_CONTINUOUS_HOSTED_CLASSIC_UNSUPPORTED', 'classic required status checks are unsupported');
  for (const context of protection.required_status_checks?.contexts ?? []) if (!classicCheckContexts.has(context)) requiredCheckIntegrations.push({ context, integrationId: null });
  for (const check of classicCheckEntries) requiredCheckIntegrations.push({ context: check.context, integrationId: check.app_id ?? null });
  const requiredChecks = [...new Set([...classicChecks, ...rulesetChecks].filter(Boolean))].sort();
  const reviewRule = protection.required_pull_request_reviews;
  const classicFacts = classicProtectionFacts(protection);
  if (reviewRule !== undefined && (!isObject(reviewRule) || typeof (reviewRule.required_approving_review_count ?? 0) !== 'number' || (reviewRule.require_code_owner_reviews !== undefined && typeof reviewRule.require_code_owner_reviews !== 'boolean') || (reviewRule.dismiss_stale_reviews !== undefined && typeof reviewRule.dismiss_stale_reviews !== 'boolean') || (reviewRule.require_last_push_approval !== undefined && typeof reviewRule.require_last_push_approval !== 'boolean'))) fail('R1_CONTINUOUS_HOSTED_CLASSIC_UNSUPPORTED', 'classic pull-request review requirements are unsupported');
  const classicReviews = reviewRule ? [{ approvals: reviewRule.required_approving_review_count ?? 0, codeOwnerReviews: reviewRule.require_code_owner_reviews === true, dismissStaleReviews: reviewRule.dismiss_stale_reviews === true, ...(reviewRule.require_last_push_approval === true ? { requireLastPushApproval: true } : {}) }] : [];
  const requiredReviews = [...classicReviews, ...rulesetReviews].filter((review, index, all) => all.findIndex((candidate) => canonicalJson(candidate) === canonicalJson(review)) === index);
  const integrationMap = new Map();
  for (const entry of requiredCheckIntegrations) {
    const existing = integrationMap.get(entry.context);
    if (existing && existing.integrationId !== entry.integrationId) fail('R1_CONTINUOUS_HOSTED_CLASSIC_UNSUPPORTED', `required check ${entry.context} has conflicting integration identities`);
    integrationMap.set(entry.context, entry);
  }
  const integrations = [...integrationMap.values()].sort((left, right) => left.context.localeCompare(right.context));
  return { activeRulesets, requiredChecks, requiredCheckIntegrations: integrations, requiredReviews, requiredReviewBots: [...new Set(requiredReviewBots)].sort(), requiredReviewThreadResolution, extraApprovalForUnattributedChanges, ...(allowedMergeMethods ? { allowedMergeMethods } : {}), classic: classicFacts };
}

function defaultObservation(operation, actual) {
  const query = operation.git?.providerQuery;
  const repository = 'ndrewtran/core-ui';
  const run = (endpoint) => {
    try { return JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })); }
    catch (error) { fail('R1_CONTINUOUS_HOSTED_OBSERVATION_FAILED', `GitHub observation failed for ${endpoint}`, { cause: error.stderr?.toString() || error.message }); }
  };
  if (operation.kind === 'verifier-bootstrap' && operation.action === 'postmerge' && (query.pullRequestNumber !== BOOTSTRAP_PULL_REQUEST_NUMBER || query.headRefName !== BOOTSTRAP_HEAD_REF)) {
    fail('R1_CONTINUOUS_HOSTED_QUERY_INVALID', 'bootstrap observation must query only PR #92 at the canonical prerequisite head ref');
  }
  const pull = run(`repos/${repository}/pulls/${query.pullRequestNumber}`);
  const branch = pull.base?.ref;
  if (branch !== 'main' || pull.base?.repo?.full_name !== repository || pull.head?.repo?.full_name !== repository || (operation.kind === 'verifier-bootstrap' && operation.action === 'postmerge' && pull.head?.ref !== BOOTSTRAP_HEAD_REF)) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'provider PR is not the exact same-repository main prerequisite PR');
  let protection = {};
  try {
    protection = run(`repos/${repository}/branches/main/protection`);
  } catch (error) {
    if (!/\b404\b/u.test(error.details?.cause ?? '')) throw error;
  }
  const rulesetPages = (() => {
    try {
      const bytes = execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repository}/rulesets?includes_parents=true`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
      const pages = JSON.parse(bytes);
      return pages;
    } catch (error) {
      if (error instanceof R1ContinuousExecutionError) throw error;
      fail('R1_CONTINUOUS_HOSTED_OBSERVATION_FAILED', 'GitHub ruleset pagination failed', { cause: error.stderr?.toString() || error.message });
    }
  })();
  const rulesets = normalizeGitHubRulesetPages(rulesetPages);
  const candidates = rulesets.filter((ruleset) => ruleset.enforcement === 'active' || ruleset.enforcement === undefined);
  const rulesetDetails = candidates.map((ruleset) => {
    if (!Number.isInteger(ruleset.id)) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'provider ruleset summary omits an exact id');
    return run(`repos/${repository}/rulesets/${ruleset.id}`);
  });
  const normalizedProtection = normalizeGitHubProtection({ repository, protection, rulesets, rulesetDetails });
  const { activeRulesets, requiredChecks, requiredCheckIntegrations, requiredReviews, requiredReviewBots, requiredReviewThreadResolution, extraApprovalForUnattributedChanges, allowedMergeMethods, classic } = normalizedProtection;
  if (Object.keys(protection).length === 0 && activeRulesets.length === 0) fail('R1_CONTINUOUS_HOSTED_CHECK_RULES_INVALID', 'main has no applicable active protection source');
  if (!requiredChecks.length) fail('R1_CONTINUOUS_HOSTED_CHECK_RULES_INVALID', 'protected main has no provider-derived required checks');
  const runPages = (endpoint, label) => {
    try {
      const bytes = execFileSync('gh', ['api', '--paginate', '--slurp', endpoint], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
      const pages = JSON.parse(bytes);
      return { pages, items: normalizeGitHubPagedCollection(pages, label) };
    } catch (error) {
      if (error instanceof R1ContinuousExecutionError) throw error;
      fail('R1_CONTINUOUS_HOSTED_OBSERVATION_FAILED', `GitHub ${label} pagination failed`, { cause: error.stderr?.toString() || error.message });
    }
  };
  const reviewPages = runPages(`repos/${repository}/pulls/${pull.number}/reviews?per_page=100`, 'pull-request reviews');
  const reviews = reviewPages.items;
  const commitPages = (() => {
    try {
      const bytes = execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repository}/pulls/${pull.number}/commits?per_page=100`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
      const pages = JSON.parse(bytes);
      if (!Array.isArray(pages) || pages.length === 0 || pages.some((page) => !Array.isArray(page))) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'GitHub pull-request commit pagination is incomplete or malformed');
      const commits = pages.flat();
      if (commits.some((commit) => !isObject(commit) || !HEX40.test(commit.sha ?? '') || (commit.author !== undefined && commit.author !== null && (!isObject(commit.author) || typeof commit.author.login !== 'string' || commit.author.login.trim() === '')))) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'GitHub pull-request commit attribution is malformed');
      if (commits.length === 0 || new Set(commits.map(({ sha }) => sha)).size !== commits.length) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'GitHub pull-request commit pagination is empty or contains duplicate commits');
      return { pages, commits };
    } catch (error) {
      if (error instanceof R1ContinuousExecutionError) throw error;
      fail('R1_CONTINUOUS_HOSTED_OBSERVATION_FAILED', 'GitHub pull-request commit pagination failed', { cause: error.stderr?.toString() || error.message });
    }
  })();
  const commitAttribution = commitPages.commits.map(({ sha, author }) => ({ sha, user: author?.login ?? null, attributed: typeof author?.login === 'string' && author.login.trim() !== '' }));
  const allCommitsAttributed = commitAttribution.every(({ attributed }) => attributed);
  const commitAttributionDigest = sha256(canonicalJson({ commits: commitAttribution, allCommitsAttributed }));
  const requiredChecksPreimage = { requiredChecks, ...(requiredCheckIntegrations.some(({ integrationId }) => integrationId !== null) ? { requiredCheckIntegrations } : {}), requiredReviews, ...(requiredReviewThreadResolution ? { requiredReviewThreadResolution: true } : {}), ...(extraApprovalForUnattributedChanges ? { extraApprovalForUnattributedChanges } : {}), ...(allowedMergeMethods ? { allowedMergeMethods } : {}), commitAttributionDigest };
  const requiredChecksIdentity = { source: 'github:protected-main-required-checks', digest: sha256(bytesOf(canonicalJson(requiredChecksPreimage))), byteLength: Buffer.byteLength(canonicalJson(requiredChecksPreimage)) };
  const runGraphql = (queryText, variables = {}) => {
    const args = ['api', 'graphql', '-f', `query=${queryText}`];
    for (const [key, value] of Object.entries(variables)) args.push('-F', `${key}=${value}`);
    try { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })); }
    catch (error) { fail('R1_CONTINUOUS_HOSTED_OBSERVATION_FAILED', 'GitHub GraphQL observation failed', { cause: error.stderr?.toString() || error.message }); }
  };
  const reviewThreadQuery = 'query($number:Int!,$after:String){repository(owner:"ndrewtran",name:"core-ui"){pullRequest(number:$number){reviewThreads(first:100,after:$after){nodes{isResolved}pageInfo{hasNextPage,endCursor}}}}}';
  const reviewThreads = [];
  let reviewThreadCursor;
  for (;;) {
    const variables = { number: pull.number, ...(reviewThreadCursor ? { after: reviewThreadCursor } : {}) };
    const page = runGraphql(reviewThreadQuery, variables);
    const connection = page?.data?.repository?.pullRequest?.reviewThreads;
    if (!isObject(connection) || !Array.isArray(connection.nodes) || !isObject(connection.pageInfo) || typeof connection.pageInfo.hasNextPage !== 'boolean') fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'GitHub GraphQL review-thread pagination is incomplete');
    if (connection.nodes.some((thread) => !isObject(thread) || typeof thread.isResolved !== 'boolean')) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'GitHub GraphQL review-thread state is malformed');
    reviewThreads.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    if (typeof connection.pageInfo.endCursor !== 'string' || connection.pageInfo.endCursor.length === 0 || connection.pageInfo.endCursor === reviewThreadCursor) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'GitHub GraphQL review-thread pagination did not advance');
    reviewThreadCursor = connection.pageInfo.endCursor;
  }
  const reviewThreadsResolved = reviewThreads.every(({ isResolved }) => isResolved === true);
  const latestProviderReviews = new Map();
  for (const [index, review] of reviews.entries()) {
    if (!review.user?.login) continue;
    const prior = latestProviderReviews.get(review.user.login);
    if (!prior || compareProviderReview(prior.review, review, prior.index, index) <= 0) latestProviderReviews.set(review.user.login, { review, index });
  }
  const approvedReviews = [...latestProviderReviews.values()].map(({ review }) => review).filter(({ state }) => state === 'APPROVED');
  const currentApprovedReviewers = new Set(approvedReviews.filter(({ commit_id: commitId }) => (commitId ?? pull.head?.sha) === pull.head?.sha).map(({ user }) => user.login));
  const requiresLastPushApproval = requiredReviews.some(({ requireLastPushApproval }) => requireLastPushApproval === true);
  if (requiresLastPushApproval) fail('R1_CONTINUOUS_HOSTED_REVIEW_REQUIRED', 'GitHub REST observation cannot prove the actual last pusher independently of commit author/committer');
  const lastPushResponse = undefined;
  const lastPushActor = undefined;
  const requiredReviewsSatisfied = requiredReviews.every(({ approvals, dismissStaleReviews }) => approvedReviews.filter(({ commit_id: commitId }) => !dismissStaleReviews || (commitId ?? pull.head?.sha) === pull.head?.sha).length >= approvals);
  const unattributedChangesApprovalSatisfied = allCommitsAttributed || currentApprovedReviewers.size >= extraApprovalForUnattributedChanges;
  const checkCommit = operation.action === 'postmerge' ? (operation.kind === 'verifier-bootstrap' && operation.bootstrapRefresh === true ? pull.merge_commit_sha : undefined) : pull.head?.sha;
  const checkRunPages = checkCommit ? runPages(`repos/${repository}/commits/${checkCommit}/check-runs?per_page=100`, 'commit check-runs') : undefined;
  let postmerge;
  if (operation.action === 'postmerge') {
    const ref = run(`repos/${repository}/git/ref/heads/main`);
    const merged = run(`repos/${repository}/git/commits/${ref.object?.sha}`);
    postmerge = { ref: 'refs/heads/main', commit: ref.object?.sha, tree: merged.tree?.sha, orderedParents: (merged.parents ?? []).map(({ sha }) => sha) };
    const mergedRuns = runPages(`repos/${repository}/commits/${operation.kind === 'verifier-bootstrap' && operation.bootstrapRefresh === true ? pull.merge_commit_sha : postmerge.commit}/check-runs?per_page=100`, 'postmerge check-runs');
    postmerge.checkRuns = mergedRuns.pages;
  }
  const reviewBots = [...new Set(approvedReviews.map((review) => review.user?.login).filter((login) => requiredReviewBots.includes(login)))].sort();
  const raw = JSON.stringify({ pull, protection, rulesets, rulesetDetails, activeRulesets, reviewPages: reviewPages.pages, commitPages: commitPages.pages, commitAttribution, allCommitsAttributed, reviewThreads, lastPushResponse, checkRunPages: checkRunPages?.pages, postmerge });
  const checkItems = checkRunPages?.items ?? (operation.action === 'postmerge' ? postmerge?.checkRuns?.flat?.() : []) ?? [];
  const checks = checkItems.map((check) => ({ name: check.name, status: check.status, conclusion: check.conclusion, headCommit: check.head_sha ?? (operation.action === 'postmerge' ? (operation.kind === 'verifier-bootstrap' && operation.bootstrapRefresh === true ? pull.merge_commit_sha : postmerge.commit) : pull.head?.sha), ...(check.integration_id !== undefined || check.app?.id !== undefined ? { integrationId: check.integration_id ?? check.app?.id ?? null } : {}), ...(check.app ? { app: { id: check.app.id ?? null, slug: check.app.slug ?? null, name: check.app.name ?? null } } : {}) }));
  const observation = { provider: 'github', repository, defaultBranch: 'main', protectedRef: 'refs/heads/main', protection: { classic: Object.keys(protection).length > 0, enforceAdmins: classic.enforceAdmins, activeRulesets: activeRulesets.map(({ id, name }) => ({ id, name: name ?? null })), ...(requiredReviewThreadResolution ? { requiredReviewThreadResolution: true } : {}), ...(extraApprovalForUnattributedChanges ? { extraApprovalForUnattributedChanges } : {}), ...(allowedMergeMethods ? { allowedMergeMethods } : {}) }, pullRequest: { number: pull.number, headCommit: pull.head?.sha, headRefName: pull.head?.ref, baseCommit: pull.base?.sha, baseRefName: branch, mergeable: pull.mergeable, mergeableState: pull.mergeable_state, merged: pull.merged === true, mergeCommit: pull.merge_commit_sha ?? null }, requiredChecks, ...(requiredCheckIntegrations.some(({ integrationId }) => integrationId !== null) ? { requiredCheckIntegrations } : {}), requiredChecksIdentity, requiredReviews, requiredReviewsSatisfied, requiredReviewBots, reviewBots, commitAttribution, allCommitsAttributed, commitAttributionDigest, reviewThreadsResolved, unattributedChangesApprovalSatisfied, reviews: reviews.map(({ id, user, state, submitted_at: submittedAt, commit_id: commitId }) => ({ ...(Number.isSafeInteger(id) ? { id } : {}), reviewer: user?.login, state, submittedAt, commitId, dismissed: state === 'DISMISSED' })), checks, ...(postmerge ? { postmerge } : {}) };
  const normalized = canonicalJson(observation);
  return { ...observation, rawResponseIdentity: { source: 'github:rest:raw-observation', digest: sha256(bytesOf(raw)), byteLength: Buffer.byteLength(raw) }, normalizedResponseIdentity: { source: 'github:rest:normalized-observation', digest: sha256(bytesOf(normalized)), byteLength: Buffer.byteLength(normalized) } };
}

function hosted(root, operation, actual, options) {
  const isPostmerge = operation.action === 'postmerge';
  const isBootstrapPostmerge = isPostmerge && operation.kind === 'verifier-bootstrap';
  if (!operation.git?.providerQuery) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_REQUIRED', 'hosted operation requires a provider query');
  exactKeys(operation.git.providerQuery, new Set(['repository', 'pullRequestNumber', 'mergeMethod', ...(isBootstrapPostmerge ? ['headRefName'] : [])]), 'operation.git.providerQuery');
  if (operation.git.providerQuery.repository !== 'ndrewtran/core-ui' || !Number.isInteger(operation.git.providerQuery.pullRequestNumber) || operation.git.providerQuery.pullRequestNumber < 1) fail('R1_CONTINUOUS_HOSTED_QUERY_INVALID', 'provider query is not the canonical repository query');
  if (isBootstrapPostmerge && (operation.git.providerQuery.pullRequestNumber !== BOOTSTRAP_PULL_REQUEST_NUMBER || operation.git.providerQuery.headRefName !== BOOTSTRAP_HEAD_REF)) fail('R1_CONTINUOUS_HOSTED_QUERY_INVALID', 'bootstrap operation must bind only PR #92 and the canonical prerequisite head ref');
  if (typeof options.observationRunner === 'function' && options.testOnlyObservation !== true) {
    fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'injected hosted observations require the explicit test-only seam');
  }
  const observation = options.testOnlyObservation === true && typeof options.observationRunner === 'function'
    ? options.observationRunner({ kind: 'github-hosted', query: operation.git.providerQuery })
    : defaultObservation(operation, actual);
  object(observation, 'authenticated hosted observation');
  if (observation.provider !== 'github' || observation.repository !== 'ndrewtran/core-ui' || observation.defaultBranch !== 'main' || observation.protectedRef !== 'refs/heads/main') fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'hosted observation repository/default branch/protected ref is not canonical');
  const pull = object(observation.pullRequest, 'authenticated hosted observation.pullRequest');
  if (pull.number !== operation.git.providerQuery.pullRequestNumber || pull.baseRefName !== 'main' || (isBootstrapPostmerge && pull.headRefName !== BOOTSTRAP_HEAD_REF) || (!isPostmerge && (pull.headCommit !== actual.commit || pull.baseCommit !== actual.base)) || (isBootstrapPostmerge && (pull.headCommit !== actual.commit || pull.baseCommit !== AUTHORITY_COMMIT))) fail('R1_CONTINUOUS_HOSTED_OBSERVATION_INVALID', 'hosted pull request does not bind the exact head/base/ref');
  if (isPostmerge && (pull.merged !== true || (isBootstrapPostmerge ? !HEX40.test(pull.mergeCommit ?? '') : pull.mergeCommit !== actual.commit))) fail('R1_CONTINUOUS_POSTMERGE_INVALID', 'provider pull request is not the exact merged pull request');
  if (operation.action === 'merge' && (pull.mergeable !== true || String(pull.mergeableState).toLowerCase() !== 'clean')) fail('R1_CONTINUOUS_MERGE_INELIGIBLE', 'hosted pull request is not cleanly mergeable');
  const allowedMergeMethods = observation.protection?.allowedMergeMethods;
  if (!isPostmerge && ['open-pr', 'check', 'merge'].includes(operation.action) && operation.git.providerQuery.mergeMethod !== 'merge') fail('R1_CONTINUOUS_HOSTED_MERGE_METHOD_INVALID', 'premerge operations require the exact merge-commit method');
  if (operation.action === 'merge' && allowedMergeMethods !== undefined && (!Array.isArray(allowedMergeMethods) || !operation.git.providerQuery.mergeMethod || !allowedMergeMethods.includes(operation.git.providerQuery.mergeMethod))) fail('R1_CONTINUOUS_HOSTED_MERGE_METHOD_INVALID', 'merge method is not provider-allowed or was not independently bound');
  if (!isBootstrapPostmerge && !options.intermediateBoundary) fail('R1_CONTINUOUS_STOP_BOUNDARY', 'hosted operation requires an internally derived intermediate R1 lineage');
  // Final R1 exit/publication is a separate authority decision. The private
  // prerequisite never accepts caller markers as that decision, and rejects
  // any marker even when the intermediate lineage is otherwise valid.
  if (!isBootstrapPostmerge && (Object.hasOwn(operation, 'final') || Object.hasOwn(operation, 'mergeClass') || operation.project !== undefined)) fail('R1_CONTINUOUS_STOP_BOUNDARY', 'final R1 publication/exit requires a separate digest-bound human decision');
  const required = providerRequiredChecks(observation);
  if (!Array.isArray(observation.checks)) fail('R1_CONTINUOUS_HOSTED_CHECK_MISSING', 'hosted check result set is missing');
  for (const name of required) {
    const expectedCommit = isPostmerge ? (isBootstrapPostmerge && options.allowBootstrapMainDescendant === true ? pull.mergeCommit : observation.postmerge?.commit) : actual.commit;
    const expectedIntegration = observation.requiredCheckIntegrations?.find(({ context }) => context === name)?.integrationId;
    const matches = observation.checks.filter((check) => check.name === name && check.headCommit === expectedCommit && (expectedIntegration === undefined || (check.integrationId ?? check.integration_id ?? check.app?.id ?? null) === expectedIntegration));
    if (matches.length !== 1 || matches[0].status !== 'completed' || matches[0].conclusion !== 'success') fail('R1_CONTINUOUS_HOSTED_CHECK_FAILED', `required hosted check ${name} is missing or not green for the exact head`);
  }
  if (isPostmerge) {
    const merged = object(observation.postmerge, 'authenticated hosted observation.postmerge');
    const expectedBootstrapMerge = options.bootstrapMerge;
    if (merged.ref !== 'refs/heads/main' || (!isBootstrapPostmerge && (merged.commit !== actual.commit || merged.tree !== actual.tree)) || (isBootstrapPostmerge && options.allowBootstrapMainDescendant !== true && pull.mergeCommit !== merged.commit) || (isBootstrapPostmerge && expectedBootstrapMerge && (pull.mergeCommit !== expectedBootstrapMerge.commit || !isAncestor(root, expectedBootstrapMerge.commit, merged.commit))) || !Array.isArray(merged.orderedParents) || (!isBootstrapPostmerge && canonicalJson(merged.orderedParents) !== canonicalJson([pull.baseCommit, pull.headCommit])) || (!isBootstrapPostmerge && canonicalJson(merged.orderedParents) !== canonicalJson(actual.parents)) || (isBootstrapPostmerge && options.allowBootstrapMainDescendant !== true && canonicalJson(merged.orderedParents) !== canonicalJson([AUTHORITY_COMMIT, expectedBootstrapMerge?.topic ?? pull.headCommit]))) fail('R1_CONTINUOUS_POSTMERGE_INVALID', 'postmerge observation does not bind exact merged main commit/tree/parents');
    if (isBootstrapPostmerge && options.allowBootstrapMainDescendant === true) verifyCurrentMainObservation(root, merged, expectedBootstrapMerge);
    const prior = options.priorResult?.value ?? options.priorResult;
    const priorPull = prior?.hosted?.observation?.pullRequest;
    if (operation.kind !== 'verifier-bootstrap' && (!prior?.hosted || canonicalJson(prior.hosted.requiredChecks ?? []) !== canonicalJson(required) || canonicalJson(prior.hosted.requiredChecksIdentity ?? null) !== canonicalJson(observation.requiredChecksIdentity) || priorPull?.number !== pull.number || priorPull?.baseCommit !== pull.baseCommit || priorPull?.headCommit !== pull.headCommit)) fail('R1_CONTINUOUS_POSTMERGE_INVALID', 'postmerge observation does not bind the exact premerge provider check set and pull request');
  }
  const checks = observation.checks.map((check) => ({ name: check.name, headCommit: check.headCommit, status: check.status, conclusion: check.conclusion, ...(check.integrationId !== undefined || check.integration_id !== undefined || check.app?.id !== undefined ? { integrationId: check.integrationId ?? check.integration_id ?? check.app?.id ?? null } : {}), ...(check.app ? { app: check.app } : {}) }));
  const checksBytes = bytesOf(canonicalJson(checks));
  return { requiredChecks: required, requiredChecksIdentity: observation.requiredChecksIdentity, checksIdentity: { source: 'github:required-main-check-results', digest: sha256(checksBytes), byteLength: checksBytes.byteLength }, rawResponseIdentity: observation.rawResponseIdentity, normalizedResponseIdentity: observation.normalizedResponseIdentity, observation };
}

function verifyPriorResult(root, value, actual, expectedPaths, expectedIntent, expectedDiff, expectedAfterImages, expectedBootstrapReceipt, allowEquivalentDiff = false) {
  const { identity, value: prior } = readTaskJson(root, value, 'operation.priorResult');
  exactKeys(prior, new Set(['profile', 'operationKind', 'envelope', 'diff', 'afterImages', 'source', 'authorizedWriteSet', 'permittedWriteSet', 'observedChangedPaths', 'bootstrapReceipt', 'result', 'outputIdentity', 'hosted']), 'operation.priorResult');
  if (prior.profile !== RESULT_PROFILE || !['r1-lock', 'component-implementation', 'retained-evidence-acceptance', 'routine-git-operation', 'project-migration'].includes(prior.operationKind) || prior.result?.code !== 'R1_CONTINUOUS_OPERATION_PASSED' || prior.result?.status !== 'passed') fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result is not a passed substantive verifier result');
  if (prior.source?.commit !== actual.commit && !isAncestor(root, prior.source?.commit, actual.commit)) fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result source is not an ancestor');
  if (!prior.envelope || prior.envelope.digest !== expectedIntent.digest || prior.envelope.byteLength !== expectedIntent.byteLength) fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result does not bind the exact ChangeIntent identity');
  if (!prior.bootstrapReceipt || prior.bootstrapReceipt.digest !== expectedBootstrapReceipt.digest || prior.bootstrapReceipt.byteLength !== expectedBootstrapReceipt.byteLength) fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result does not bind the exact bootstrap receipt');
  if (!prior.diff || (canonicalJson(prior.diff) !== canonicalJson(expectedDiff) && !(allowEquivalentDiff && prior.diff.digest === expectedDiff.digest && prior.diff.byteLength === expectedDiff.byteLength))) fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result does not bind the exact Git diff identity');
  if (!Array.isArray(prior.afterImages) || canonicalJson(prior.afterImages) !== canonicalJson(expectedAfterImages)) fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result after-image binding is incomplete');
  equalPaths(exactPaths(prior.permittedWriteSet, 'prior.permittedWriteSet', true), expectedPaths, 'R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'routine paths differ from the prior result');
  equalPaths(exactPaths(prior.authorizedWriteSet, 'prior.authorizedWriteSet', true), expectedPaths, 'R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'routine authorization differs from the prior result');
  const payload = { ...prior };
  delete payload.outputIdentity;
  if (prior.outputIdentity?.algorithm !== 'sha256' || prior.outputIdentity.digest !== sha256(canonicalJson(payload)) || prior.outputIdentity.byteLength !== Buffer.byteLength(canonicalJson(payload))) fail('R1_CONTINUOUS_PRIOR_RESULT_INVALID', 'prior result output identity is not exact');
  return { identity, value: prior };
}

function isAncestor(root, ancestor, descendant) {
  if (!HEX40.test(ancestor ?? '') || !HEX40.test(descendant ?? '')) return false;
  try { execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', ancestor, descendant], { stdio: ['ignore', 'pipe', 'pipe'] }); return true; } catch { return false; }
}

function output(payload) {
  const body = canonicalJson(payload);
  return { ...payload, outputIdentity: { algorithm: 'sha256', digest: sha256(body), byteLength: Buffer.byteLength(body) } };
}

function verifyOperationResult(root, value, actual, intent, paths, operationKind, expectedBootstrapReceipt) {
  if (value === undefined) return;
  const { value: result } = readTaskJson(root, value, 'operation.result');
  exactKeys(result, new Set(['profile', 'operationKind', 'envelope', 'diff', 'afterImages', 'source', 'authorizedWriteSet', 'permittedWriteSet', 'observedChangedPaths', 'bootstrapReceipt', 'hosted', 'result', 'outputIdentity']), 'operation.result');
  if (result.profile !== RESULT_PROFILE || result.result?.code !== 'R1_CONTINUOUS_OPERATION_PASSED' || result.result?.status !== 'passed') fail('R1_CONTINUOUS_RESULT_INVALID', 'operation result is not a passed canonical verifier result');
  if (result.operationKind !== operationKind) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result kind differs from the exact operation');
  if (result.envelope?.digest !== intent.identity.digest || result.envelope?.byteLength !== intent.identity.byteLength) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result envelope identity differs from the exact intent');
  if (!result.bootstrapReceipt || result.bootstrapReceipt.digest !== expectedBootstrapReceipt.digest || result.bootstrapReceipt.byteLength !== expectedBootstrapReceipt.byteLength) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result bootstrap receipt differs from the exact operation');
  if (canonicalJson(result.authorizedWriteSet ?? []) !== canonicalJson(paths) || canonicalJson(result.permittedWriteSet ?? []) !== canonicalJson(paths)) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result write-set identity differs from the exact intent');
  if (result.source?.commit !== actual.commit || result.source?.tree !== actual.tree) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result source identity is stale');
  const expectedDiff = operationKind === 'r1-lock' ? null : diffIdentity(root, actual.base, actual.commit);
  if (canonicalJson(result.diff ?? null) !== canonicalJson(expectedDiff) || canonicalJson(result.afterImages ?? []) !== canonicalJson(intent.envelope.proposal.afterImages)) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result diff or after-image identities differ from the exact intent');
  const expectedChangedPaths = operationKind === 'r1-lock' ? [] : changedPaths(root, actual.base, actual.commit);
  if (canonicalJson(result.observedChangedPaths ?? []) !== canonicalJson(expectedChangedPaths)) fail('R1_CONTINUOUS_RESULT_SUBSTITUTION', 'operation result changed-path identity differs from the actual Git result');
  const payload = { ...result };
  delete payload.outputIdentity;
  if (result.outputIdentity?.algorithm !== 'sha256' || result.outputIdentity.digest !== sha256(canonicalJson(payload)) || result.outputIdentity.byteLength !== Buffer.byteLength(canonicalJson(payload))) fail('R1_CONTINUOUS_RESULT_INVALID', 'operation result output identity is not exact');
}

function executeCompletedCommands(root, envelope, operationKind, options = {}) {
  if (operationKind === 'routine-git-operation' || !envelope.result) return;
  const records = envelope.result.deterministicResults ?? [];
  if (records.length === 0) fail('R1_CONTINUOUS_RESULT_EXECUTION_INVALID', 'completed operation has no deterministic command records');
  if (options.commandRunner !== undefined && options.testOnlyCommandRunner !== true) fail('R1_CONTINUOUS_RESULT_EXECUTION_INVALID', 'command runner injection requires the explicit test-only seam');
  for (const descriptorValue of records) {
    const { value: record } = readTaskJson(root, descriptorValue, 'completed deterministic result');
    const contract = commandContract(root, record.command, 'completed deterministic result');
    const execution = resolveCommandRuntime(root, envelope.source, record.runtime, 'completed deterministic result');
    const runtime = execution.runtime;
    if (canonicalJson(record.runtime) !== canonicalJson(runtime)) fail('R1_CONTINUOUS_RESULT_EXECUTION_INVALID', `${record.command} runtime/dependency identity drifted`);
    const procedure = commandProcedureIdentity(root, record.command, record.source, runtime, 'completed deterministic result');
    if (canonicalJson(record.procedure) !== canonicalJson(procedure)) fail('R1_CONTINUOUS_RESULT_EXECUTION_INVALID', `${record.command} procedure identity drifted`);
    const outputIdentity = (bytes) => {
      const text = bytes.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(bytes)) fail('R1_CONTINUOUS_RESULT_EXECUTION_FAILED', `${record.command} emitted non-UTF-8 output`);
      return { profile: 'core-ui-command-output-v1', encoding: 'utf8', text, digest: sha256(bytes), byteLength: bytes.byteLength };
    };
    if (options.testOnlyCommandRunner === true) {
      if (typeof options.commandRunner !== 'function') fail('R1_CONTINUOUS_RESULT_EXECUTION_INVALID', 'test-only command runner seam is unavailable');
      let fixtureResult;
      try { fixtureResult = options.commandRunner({ root, command: record.command, argv: contract.value.argv, contract: contract.value }); }
      catch (error) { fail('R1_CONTINUOUS_RESULT_EXECUTION_FAILED', `${record.command} test command runner failed`, { cause: error.message }); }
      if (!isObject(fixtureResult) || fixtureResult.exitState !== 0) fail('R1_CONTINUOUS_RESULT_EXECUTION_FAILED', `${record.command} did not complete successfully in the test command runner`);
      const fixtureStdout = fixtureResult.stdout === undefined ? Buffer.alloc(0) : bytesOf(fixtureResult.stdout);
      const fixtureStderr = fixtureResult.stderr === undefined ? Buffer.alloc(0) : bytesOf(fixtureResult.stderr);
      if (canonicalJson(outputIdentity(fixtureStdout)) !== canonicalJson(record.stdout) || canonicalJson(outputIdentity(fixtureStderr)) !== canonicalJson(record.stderr)) fail('R1_CONTINUOUS_RESULT_EXECUTION_FAILED', `${record.command} test output differs from the completed record`);
      continue;
    }
    const child = spawnSync(execution.pnpmPath, contract.value.argv.slice(1), {
      cwd: root,
      encoding: 'buffer',
      env: execution.environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
    if (child.error) fail('R1_CONTINUOUS_RESULT_EXECUTION_FAILED', `${record.command} could not execute`, { cause: child.error.message });
    if (child.status !== record.exitState || canonicalJson(outputIdentity(child.stdout ?? Buffer.alloc(0))) !== canonicalJson(record.stdout) || canonicalJson(outputIdentity(child.stderr ?? Buffer.alloc(0))) !== canonicalJson(record.stderr)) fail('R1_CONTINUOUS_RESULT_EXECUTION_FAILED', `${record.command} output or exit identity differs from the completed record`);
  }
}

function verifyEvidenceRetention(root, operation, envelope, actual, paths) {
  if (actual.parents.length !== 1) fail('R1_CONTINUOUS_EVIDENCE_HISTORY_MUTATION', 'retained evidence cannot rewrite history');
  const evidencePath = operation.evidence?.path;
  const rootMatch = typeof evidencePath === 'string' ? /^(tests\/evidence\/[^/]+)\/index\.json$/u.exec(evidencePath) : null;
  if (!rootMatch || envelope.operation.evidence?.path !== evidencePath || !paths.includes(evidencePath)) fail('R1_CONTINUOUS_EVIDENCE_INVALID', 'evidence identity must bind the new canonical evidence index');
  const evidenceRoot = rootMatch[1];
  if (paths.some((path) => !path.startsWith(`${evidenceRoot}/`))) fail('R1_CONTINUOUS_EVIDENCE_WRITE_SET_INVALID', 'retained evidence write set must remain inside one new evidence root');
  for (const path of paths) {
    try { git(root, ['cat-file', '-e', `${actual.base}:${path}`]); fail('R1_CONTINUOUS_EVIDENCE_HISTORY_MUTATION', `${path} already exists in the evidence source parent`); } catch (error) {
      if (error instanceof R1ContinuousExecutionError && error.code !== 'R1_CONTINUOUS_SOURCE_UNAVAILABLE') throw error;
    }
  }
  const indexBytes = committedBlobIdentity(root, actual.commit, { path: evidencePath, sha256: operation.evidence.digest, byteLength: operation.evidence.byteLength }, evidencePath);
  const readCommitted = (reference, label) => strictJson(committedBlobIdentity(root, actual.commit, reference, label), label);
  const index = strictJson(indexBytes, evidencePath);
  const expectedExecution = { commit: envelope.source.commit, tree: envelope.source.tree };
  if (index.schema !== 'core-ui-evidence-index-v1' || index.sourceRevision !== actual.base || index.sourceTree !== actual.baseTree || index.executedRevision !== expectedExecution.commit || index.executedTree !== expectedExecution.tree || index.disclosureClass !== 'public-sanitized' || typeof index.retentionPolicy !== 'string' || index.retentionPolicy.trim() === '' || typeof index.expiry !== 'string' || index.expiry.trim() === '' || !Array.isArray(index.records) || index.records.length === 0 || !index.validation?.path) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence index does not bind source, executed source, proof, disclosure, retention, and expiry identities');
  if (!paths.includes(index.validation.path) || !DIGEST.test(index.validation.sha256 ?? '') || !Number.isSafeInteger(index.validation.byteLength)) fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', 'evidence index validation is not retained with an exact byte identity in the write set');
  const validation = readCommitted(index.validation, index.validation.path);
  if (validation.schema !== 'core-ui-evidence-validation-v1' || validation.sourceRevision !== actual.base || validation.sourceTree !== actual.baseTree || validation.executedRevision !== expectedExecution.commit || validation.executedTree !== expectedExecution.tree || !isObject(validation.proofTool) || validation.proofTool.profile !== 'core-ui-proof-tool-identity-v1' || validation.proofTool.id !== 'proof-tool' || typeof validation.proofTool.version !== 'string' || typeof validation.proofTool.executablePath !== 'string' || !DIGEST.test(validation.proofTool.executableSha256 ?? '') || !Array.isArray(validation.results) || validation.results.length === 0) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence validation does not bind the exact proof tool and executed source');
  const proofTool = validateRetainedProofTool(root, actual.commit, validation.proofTool.executablePath, validation.proofTool.executableSha256);
  if (validation.executionEnvironment !== undefined) {
    exactKeys(validation.executionEnvironment, new Set(['profile', 'variables']), 'evidence validation.executionEnvironment');
    if (validation.executionEnvironment.profile !== 'core-ui-proof-execution-environment-v1' || !isObject(validation.executionEnvironment.variables) || canonicalJson(Object.keys(validation.executionEnvironment.variables).sort()) !== canonicalJson(['LANG', 'LC_ALL', 'PATH', 'TZ']) || validation.executionEnvironment.variables.LANG !== 'C' || validation.executionEnvironment.variables.LC_ALL !== 'C' || validation.executionEnvironment.variables.PATH !== (process.env.PATH ?? '') || validation.executionEnvironment.variables.TZ !== 'UTC') fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence validation execution environment is not the permitted minimal environment');
  } else fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'evidence validation omits its permitted execution environment identity');
  if (validation.results.length !== 1 || validation.results.some((result) => !isObject(result) || result.exitState !== 0 || result.command !== APPROVED_EVIDENCE_COMMAND || !result.rawOutput?.path || !DIGEST.test(result.rawOutput.sha256 ?? '') || !Number.isSafeInteger(result.rawOutput.byteLength) || !paths.includes(result.rawOutput.path))) fail('R1_CONTINUOUS_EVIDENCE_RESULT_INVALID', 'evidence validation omits the approved retained deterministic result/output identity');
  for (const result of validation.results) {
    committedBlobIdentity(root, actual.commit, result.rawOutput, `evidence validation raw output ${result.rawOutput.path}`);
  }
  for (const reference of index.records) {
    if (!isObject(reference) || typeof reference.path !== 'string' || !paths.includes(reference.path) || !DIGEST.test(reference.sha256 ?? '') || !Number.isSafeInteger(reference.byteLength)) fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', 'evidence index record reference is outside the exact write set or lacks byte identity');
    const record = readCommitted(reference, reference.path);
    if (record.schema !== 'core-ui-evidence-record-v1' || record.sourceRevision !== actual.base || record.sourceTree !== actual.baseTree || record.executedRevision !== expectedExecution.commit || record.executedTree !== expectedExecution.tree || record.outcome !== 'pass' || record.disclosureClass !== index.disclosureClass || record.retentionPolicy !== index.retentionPolicy || record.expiry !== index.expiry || canonicalJson(record.validation ?? null) !== canonicalJson(index.validation) || !record.artifact?.path || !paths.includes(record.artifact.path) || !DIGEST.test(record.artifact.sha256 ?? '') || !Number.isSafeInteger(record.artifact.byteLength)) fail('R1_CONTINUOUS_EVIDENCE_RELATION_INVALID', `${reference.path} does not bind its canonical artifact and source identities`);
    const artifact = readCommitted(record.artifact, record.artifact.path);
    if (artifact.schema !== 'core-ui-evidence-artifact-v1' || artifact.sourceRevision !== actual.base || artifact.sourceTree !== actual.baseTree || artifact.executedRevision !== expectedExecution.commit || artifact.executedTree !== expectedExecution.tree || artifact.outcome !== 'pass' || artifact.exitState !== 0) fail('R1_CONTINUOUS_EVIDENCE_ARTIFACT_INVALID', `${record.artifact.path} is not the exact passed retained artifact`);
  }
  const hostileKeys = ['NODE_OPTIONS', 'NODE_DEBUG', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES'];
  if (hostileKeys.some((key) => typeof process.env[key] === 'string' && process.env[key] !== '')) fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'proof execution environment contains loader or debug injection');
  const proofEnv = { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH ?? '', TZ: 'UTC' };
  let output;
  try {
    output = execFileSync(process.execPath, [proofTool.path], { cwd: root, encoding: 'buffer', env: proofEnv, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  } catch (error) { fail('R1_CONTINUOUS_EVIDENCE_PROFILE_INVALID', 'canonical evidence owner rejected the retained root', { cause: error.stderr?.toString() || error.message }); }
  const outputResult = validation.results.find(({ command }) => command === 'node tooling/audits/repository-policy/src/evidence-verify.mjs') ?? validation.results[0];
  const outputBytes = gitBytes(root, ['show', `${actual.commit}:${outputResult.rawOutput.path}`]);
  if (outputBytes.byteLength !== outputResult.rawOutput.byteLength || sha256(outputBytes) !== outputResult.rawOutput.sha256 || !outputBytes.equals(output)) fail('R1_CONTINUOUS_EVIDENCE_RESULT_INVALID', 'canonical evidence verification output is not the retained deterministic output');
}

function verifyBootstrap(root, operation, options) {
  if (operation.action !== 'postmerge' || !operation.git?.providerQuery) fail('R1_CONTINUOUS_BOOTSTRAP_HOSTED_REQUIRED', 'bootstrap unlock requires an authenticated postmerge provider observation');
  const actual = sourceRecord(root, operation.source, operation);
  const topology = bootstrapTopology(root, actual);
  if (actual.base !== AUTHORITY_COMMIT || actual.baseTree !== AUTHORITY_TREE || !topology) fail('R1_CONTINUOUS_BOOTSTRAP_TOPOLOGY_INVALID', 'bootstrap must be the exact authority child or synthetic authority/topic merge');
  const discoveredBootstrap = acceptedBootstrapMerge(root);
  if (discoveredBootstrap && (actual.commit !== discoveredBootstrap.commit || actual.branch !== 'main')) fail('R1_CONTINUOUS_BOOTSTRAP_CONSUMED', 'the protected bootstrap merge has already been consumed');
  equalPaths(exactPaths(operation.permittedWriteSet, 'bootstrap.permittedWriteSet'), BOOTSTRAP_PATHS, 'R1_CONTINUOUS_WRITE_SET_MISMATCH', 'bootstrap permitted write set is not exact');
  equalPaths(exactPaths(operation.authorizedWriteSet, 'bootstrap.authorizedWriteSet'), BOOTSTRAP_PATHS, 'R1_CONTINUOUS_WRITE_SET_MISMATCH', 'bootstrap authorized write set is not exact');
  const actualBootstrapPaths = changedPaths(root, AUTHORITY_COMMIT, actual.commit);
  if (canonicalJson(actualBootstrapPaths) !== canonicalJson(topology.paths)) fail('R1_CONTINUOUS_BOOTSTRAP_TOPOLOGY_INVALID', 'bootstrap merge paths do not equal the exact authority/topic diff');
  equalPaths(exactPaths(operation.observedChangedPaths, 'bootstrap.observedChangedPaths'), actualBootstrapPaths, 'R1_CONTINUOUS_CHANGED_PATHS_DRIFT', 'bootstrap observed paths do not bind the actual Git diff');
  if (canonicalJson(actualBootstrapPaths) !== canonicalJson(BOOTSTRAP_PATHS)) fail('R1_CONTINUOUS_BOOTSTRAP_TOPOLOGY_INVALID', 'bootstrap Git diff is not the exact ten-path implementation set');
  const hostedActual = { ...actual, commit: topology.topic, tree: topology.topicTree, base: AUTHORITY_COMMIT, baseTree: AUTHORITY_TREE, parents: [AUTHORITY_COMMIT] };
  const hostedResult = hosted(root, { ...operation, kind: 'verifier-bootstrap' }, hostedActual, options ?? {});
  return output({
    profile: RESULT_PROFILE,
    operationKind: 'verifier-bootstrap',
    source: { commit: topology.topic, tree: topology.topicTree },
    authorizedWriteSet: BOOTSTRAP_PATHS,
    permittedWriteSet: BOOTSTRAP_PATHS,
    observedChangedPaths: actualBootstrapPaths,
    hosted: hostedResult,
    result: { code: 'R1_CONTINUOUS_BOOTSTRAP_PASSED', status: 'passed' },
  });
}

function operationKeys(operation) {
  exactKeys(operation, new Set([
    'kind', 'source', 'intent', 'permittedWriteSet', 'authorizedWriteSet', 'lock', 'evidence',
    'priorResult', 'bootstrapReceipt', 'git', 'action', 'final', 'mergeClass', 'project', 'observedChangedPaths', 'result', 'diff', 'afterImages', 'transition',
  ]), 'operation');
}

function verifyTransitionBinding(operation) {
  if (operation.transition === undefined) return;
  if (!EXTERNAL_TRANSITION_ACTIONS.has(operation.action)) fail('R1_CONTINUOUS_TRANSITION_INVALID', 'transition identities require an admitted external transition action');
  exactKeys(operation.transition, new Set(['preimage', 'result']), 'operation.transition');
  const preimage = checkIdentity(operation.transition.preimage, 'operation.transition.preimage');
  if (operation.source === undefined || canonicalJson(preimage) !== canonicalJson(checkIdentity(operation.source, 'operation.source'))) fail('R1_CONTINUOUS_TRANSITION_PREIMAGE_INVALID', 'external transition preimage does not bind operation.source');
  if (operation.result === undefined) fail('R1_CONTINUOUS_TRANSITION_RESULT_REQUIRED', 'external transition result requires operation.result');
  const result = checkIdentity(operation.transition.result, 'operation.transition.result');
  if (canonicalJson(result) !== canonicalJson(checkIdentity(operation.result, 'operation.result'))) fail('R1_CONTINUOUS_TRANSITION_RESULT_INVALID', 'external transition result does not bind operation.result');
}

function verifyOperation(root, operation, options) {
  operationKeys(operation);
  verifyTransitionBinding(operation);
  if (!OPERATION_KINDS.has(operation.kind)) fail('R1_CONTINUOUS_OPERATION_UNKNOWN', 'operation kind is not admitted');
  const actionSets = {
    'r1-lock': new Set(['check']),
    'component-implementation': new Set(['commit', 'check']),
    'retained-evidence-acceptance': new Set(['commit', 'check']),
    'routine-git-operation': ROUTINE_ACTIONS,
    'project-migration': new Set(['commit', 'check']),
  };
  if (operation.action !== undefined && !actionSets[operation.kind]?.has(operation.action)) fail('R1_CONTINUOUS_GIT_ACTION_INVALID', `${operation.kind} does not admit action ${operation.action}`);
  if (!operation.intent) fail('R1_CONTINUOUS_CHANGE_INTENT_REQUIRED', 'operation requires the canonical ChangeIntent envelope');
  const authority = verifyAuthority(root);
  const bootstrap = acceptedBootstrapMerge(root);
  if (!bootstrap) fail('R1_CONTINUOUS_BOOTSTRAP_REQUIRED', 'the protected exact ten-path prerequisite merge has not completed');
  verifyBootstrapMainLineage(root, bootstrap);
  const sourceActual = sourceRecord(root, operation.source, operation);
  if (!isAncestor(root, bootstrap.commit, sourceActual.commit)) fail('R1_CONTINUOUS_BOOTSTRAP_SOURCE_INVALID', 'source is not descended from the accepted prerequisite merge');
  const base = operationBase(root, sourceActual, operation, bootstrap);
  const actual = { ...sourceActual, base, baseTree: git(root, ['rev-parse', `${base}^{tree}`]) };
  if (operation.bootstrapReceipt === undefined) fail('R1_CONTINUOUS_BOOTSTRAP_RECEIPT_REQUIRED', 'every operation must bind an authenticated bootstrap receipt');
  const bootstrapReceipt = verifyBootstrapReceipt(root, operation.bootstrapReceipt, bootstrap, options);
  if (operation.kind === 'routine-git-operation' && operation.action === 'branch') {
    if (operation.priorResult !== undefined) fail('R1_CONTINUOUS_OPERATION_RELATION_INVALID', 'branch cannot claim a substantive prior result');
    if (operation.permittedWriteSet === undefined || operation.authorizedWriteSet === undefined) fail('R1_CONTINUOUS_WRITE_SET_MISMATCH', 'branch must declare the empty derived write set');
    equalPaths(exactPaths(operation.permittedWriteSet, 'operation.permittedWriteSet', true), [], 'R1_CONTINUOUS_WRITE_SET_MISMATCH', 'branch write set is not empty');
    equalPaths(exactPaths(operation.authorizedWriteSet, 'operation.authorizedWriteSet', true), [], 'R1_CONTINUOUS_WRITE_SET_MISMATCH', 'branch authorization is not empty');
    return output({ profile: RESULT_PROFILE, operationKind: operation.kind, source: { commit: actual.commit, tree: actual.tree }, authorizedWriteSet: [], permittedWriteSet: [], observedChangedPaths: [], bootstrapReceipt, result: { code: 'R1_CONTINUOUS_OPERATION_PASSED', status: 'passed' } });
  }
  if (operation.kind === 'project-migration') fail('R1_CONTINUOUS_PROJECT_WRITE_UNAVAILABLE', 'Project-only migration is separately bound and unavailable to this repository prerequisite');
  const completedExpectation = routineCompletedExpectation(root, operation);
  const intent = verifyEnvelope(root, operation.intent, actual, operation, completedExpectation);
  if (['component-implementation', 'retained-evidence-acceptance'].includes(operation.kind) && intent.envelope.result === undefined) {
    fail('R1_CONTINUOUS_CHANGE_INTENT_RESULT_REQUIRED', `${operation.kind} requires the completed ChangeIntent result in the envelope`);
  }
  executeCompletedCommands(root, intent.envelope, operation.kind, options);
  verifyOperationResult(root, operation.result, actual, intent, intent.envelope.writeSet.map(({ path }) => path).sort(), operation.kind, bootstrapReceipt);
  if (operation.observedChangedPaths !== undefined) equalPaths(exactPaths(operation.observedChangedPaths, 'operation.observedChangedPaths', true), operation.kind === 'r1-lock' ? [] : changedPaths(root, actual.base, actual.commit), 'R1_CONTINUOUS_CHANGED_PATHS_DRIFT', 'observed paths do not bind Git');
  let hostedResult;
  if (operation.kind === 'routine-git-operation') {
    if (operation.priorResult === undefined) fail('R1_CONTINUOUS_PRIOR_RESULT_REQUIRED', 'routine Git requires the exact prior passing verifier result');
    const currentDiff = diffIdentity(root, actual.base, actual.commit);
    const prior = verifyPriorResult(root, operation.priorResult, actual, changedPaths(root, actual.base, actual.commit), intent.identity, currentDiff, intent.envelope.proposal.afterImages, bootstrapReceipt, operation.action === 'postmerge');
    verifyRoutineEnvelopeReuse(intent.envelope, prior.value);
    if (operation.intent === undefined) fail('R1_CONTINUOUS_CHANGE_INTENT_REQUIRED', 'routine Git must bind the same ChangeIntent envelope');
    if (['open-pr', 'check', 'merge', 'postmerge'].includes(operation.action)) {
      const intermediateBoundary = deriveIntermediateBoundary(root, intent.envelope, operation, actual, prior);
      hostedResult = hosted(root, operation, actual, { ...options, priorResult: prior, intermediateBoundary });
    }
  }
  const paths = intent.envelope.writeSet.map(({ path }) => path).sort();
  if (operation.kind === 'retained-evidence-acceptance') verifyEvidenceRetention(root, operation, intent.envelope, actual, paths);
  return output({
    profile: RESULT_PROFILE,
    operationKind: operation.kind,
    envelope: intent.identity,
    diff: operation.kind === 'r1-lock' ? null : diffIdentity(root, actual.base, actual.commit),
    afterImages: intent.envelope.proposal.afterImages,
    source: { commit: actual.commit, tree: actual.tree },
    bootstrapReceipt,
    authorizedWriteSet: paths,
    permittedWriteSet: paths,
    observedChangedPaths: operation.kind === 'r1-lock' ? [] : changedPaths(root, actual.base, actual.commit),
    ...(hostedResult ? { hosted: hostedResult } : {}),
    result: { code: 'R1_CONTINUOUS_OPERATION_PASSED', status: 'passed' },
  });
}

export function verifyR1ContinuousExecution(repositoryRoot, input = {}, options = {}) {
  const root = resolve(repositoryRoot);
  policy(root);
  const operation = input.operation ?? input;
  object(operation, 'operation');
  if (operation.kind === 'verifier-bootstrap') return verifyBootstrap(root, operation, options);
  return verifyOperation(root, operation, options);
}

export function verifyR1ContinuousExecutionOperation(repositoryRoot, input, options = {}) {
  if (typeof input !== 'string') return verifyR1ContinuousExecution(repositoryRoot, input, options);
  const root = resolve(repositoryRoot);
  if (!input.startsWith(TASK_ROOT)) fail('R1_CONTINUOUS_POLICY_GATE_INPUT_MISSING', 'operation descriptor must remain task-local');
  const operation = strictJson(readFileSync(taskAbsolutePath(root, input)), input);
  return verifyR1ContinuousExecution(root, operation, options);
}

export async function verifyR1ContinuousExecutionWithDeliveryProfile(repositoryRoot, input = {}, options = {}) {
  const root = resolve(repositoryRoot);
  const deliveryContract = await loadDeliveryProfile(root);
  const operation = typeof input === 'string'
    ? strictJson(readFileSync(taskAbsolutePath(root, input)), input)
    : input;
  return verifyR1ContinuousExecution(root, operation, { ...options, deliveryContract });
}

export function verifyR1ContinuousExecutionPolicyGate(repositoryRoot, environment = process.env) {
  const root = resolve(repositoryRoot);
  const integration = policy(root);
  verifyAuthority(root);
  const required = environment[integration.policyGate.requiredEnv];
  const descriptorPath = environment[integration.policyGate.descriptorEnv];
  const bootstrap = acceptedBootstrapMerge(root);
  const current = currentGit(root);
  const base = candidateBase(root, current, bootstrap);
  const actualPaths = base ? changedPaths(root, base, current.commit) : [];
  const bootstrapException = bootstrap
    ? current.commit === bootstrap.commit && canonicalJson(actualPaths) === canonicalJson(BOOTSTRAP_PATHS)
    : isAuthorizedBootstrapCandidate(root, current, actualPaths);
  const authorityInspection = !bootstrap && current.commit === AUTHORITY_COMMIT && actualPaths.length === 0;
  const explicitlyNoOp = actualPaths.length > 0 && actualPaths.every((pathValue) => APPROVED_NO_OP_PREFIXES.some((prefix) => pathValue.startsWith(prefix)));
  if (required === undefined && descriptorPath === undefined) {
    if (!bootstrap && current.parents.length > 1 && !bootstrapException && !authorityInspection) fail('R1_CONTINUOUS_BOOTSTRAP_REQUIRED', 'detached merge topology is not the exact prerequisite candidate');
    if (authorityInspection || bootstrapException || actualPaths.length === 0 || (bootstrap && explicitlyNoOp)) return {
      profile: PROFILE,
      mode: 'source-inspection',
      status: 'passed',
      authorized: false,
      operationAuthorized: false,
      postProofReviewClearance: false,
      readyMergeClearance: false,
      source: { commit: current.commit, tree: current.tree },
      inspectedChangedPaths: actualPaths,
    };
    if (!bootstrap) fail('R1_CONTINUOUS_BOOTSTRAP_REQUIRED', 'ordinary changes cannot use the pre-bootstrap prerequisite exception');
    return {
      profile: PROFILE,
      mode: 'source-inspection',
      status: 'passed',
      authorized: false,
      operationAuthorized: false,
      postProofReviewClearance: false,
      readyMergeClearance: false,
      source: { commit: current.commit, tree: current.tree },
      inspectedChangedPaths: actualPaths,
    };
  }
  if (descriptorPath === undefined && required !== undefined) fail('R1_CONTINUOUS_POLICY_GATE_INPUT_MISSING', `${integration.policyGate.descriptorEnv} must name a task-local descriptor`);
  if (required === undefined && descriptorPath !== undefined) fail('R1_CONTINUOUS_POLICY_GATE_REQUIRED', 'operation mode environment must provide both required and descriptor variables');
  if (required !== '1') fail('R1_CONTINUOUS_POLICY_GATE_REQUIRED', `${integration.policyGate.requiredEnv}=1 is required for operation mode`);
  if (typeof descriptorPath !== 'string' || !descriptorPath.startsWith(TASK_ROOT)) fail('R1_CONTINUOUS_POLICY_GATE_INPUT_MISSING', `${integration.policyGate.descriptorEnv} must name a task-local descriptor`);
  return { profile: PROFILE, mode: 'operation', status: 'passed', operationPath: descriptorPath, result: verifyR1ContinuousExecutionOperation(root, descriptorPath) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const repositoryRoot = process.env.CORE_UI_REPOSITORY ?? resolve(import.meta.dirname, '../../../..');
  const inputPath = process.argv[2] === '--input' ? process.argv[3] : process.argv[2];
  try {
    if (!inputPath) fail('R1_CONTINUOUS_OPERATION_MISSING', 'usage: --input <operation.json>');
    process.stdout.write(`${canonicalJson(verifyR1ContinuousExecutionOperation(repositoryRoot, inputPath))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
