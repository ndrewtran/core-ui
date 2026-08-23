import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  canonicalJson,
  parseJsonStrict,
  relationEdges,
  sha256Digest,
  validateCatalogRecords as validateSchemaCatalogRecords,
  validateFamily,
} from '@core-ui/schema';
import {
  affectedClosure,
  loadRepositoryAuthoringContext,
  semanticDiff as semanticDiffOwner,
} from './authoring.mjs';
import { classifyPath, validateGeneratedFile } from '../../../tooling/audits/repository-policy/src/policy.mjs';

const PROFILE = 'core-ui-change-intent-envelope-v1';
const SCHEMA_VERSION = '1.0.0';
const SCHEMA_PATH = 'packages/schema/schemas/change-intent-envelope.schema.json';
const MODULE_REPOSITORY_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const CATALOG_COMPILER_MODULE = new URL('../../catalog/src/compiler.mjs', import.meta.url).href;
const DELIVERY_PROFILE_PATH = 'tooling/audits/repository-policy/delivery-workflow-profile.json';
const EVIDENCE_PROOF_TOOL_PATH = 'tooling/audits/repository-policy/src/evidence-verify.mjs';
const REPOSITORY_POLICY_PATH = 'tooling/audits/repository-policy/repository-policy.json';
const LOGICAL_NODE_PATH = '<pinned-node-runtime>/node';
const LOGICAL_PNPM_PATH = '<pinned-package-manager>/pnpm';
const LOGICAL_PATH = '<pinned-node-runtime>:<pinned-package-manager>';
const WORKSPACE_PATH = 'pnpm-workspace.yaml';
const MODULES_PATH = 'node_modules/.modules.yaml';

/* The tooling package owns these private immutable source bindings. */
export const CHANGE_INTENT_BINDINGS = Object.freeze({
  authority: Object.freeze({ commit: '8979f2d0e4438529638da8269d951b0537d6970e', tree: 'cbcdd2ad1ff87b9a28177ada72744b8018b208f8' }),
  parentAuthority: Object.freeze({ commit: 'cba2d5493cdc2f64615083fe1a59bbc18427c050', tree: '93d0c0e207a0532ea3f1b7747d58893746a77e82' }),
  stage1: Object.freeze({ commit: 'dea987aca51cde9da67fe3cac16c5e69a8c46016', tree: 'af0f923abaf8cdf55acb3c402fa929cfb439335d' }),
  snapshot: Object.freeze({ path: 'catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json', envelopePath: 'catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json.identity.json', byteLength: 168799, digest: 'sha256:84c57480c61c2f844d3529702cf8864741e97ec0a0495e972c185da00f70a282', envelopeByteLength: 442, envelopeDigest: 'sha256:a3ff037abaad8114dc5b910df1e574e0996df90b4b5403b8de561b756fe7870c' }),
  baseline: Object.freeze({ path: 'tests/evidence/react-r1.0/index.json', byteLength: 4747, digest: 'sha256:610717521b7e9d6a74408427637a1cd958399171b1cb677c3a2924f855498cce', sourceCommit: 'e0bbf0d28e19e6a8f11eb20644a93c30c330d68b', sourceTree: '258ce3d576a518a728eff0d61f66a175df80138e' }),
  productScope: Object.freeze({ version: '6.0.1', path: 'strategy/product-scope.md', digest: 'sha256:add747d5986c9039029a99b558ae719969fd18ac113051bbec478bd291da8632' }),
});
export const CHANGE_INTENT_LOCK_PROFILE = 'core-ui-r1-tranche-lock-v1';
const CHANGE_INTENT_LOCK_SCHEMA_VERSION = '1.0.0';
const AUTHORITY_PATHS = Object.freeze({ decision: 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md', acceptance: 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md', architecture: 'strategy/monorepo-architecture.md', roadmap: 'strategy/milestone-roadmap.md', productScope: 'strategy/product-scope.md' });
const PARENT_AUTHORITY_PATHS = Object.freeze({ decision: 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery.md', acceptance: 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery-acceptance.md' });
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const HEX40 = /^[0-9a-f]{40}$/u;
const OPERATION_KINDS = new Set(['r1-lock', 'component-implementation', 'retained-evidence-acceptance', 'routine-git-operation', 'project-migration']);
const EXTERNAL_TRANSITION_ACTIONS = new Set(['branch', 'commit', 'push', 'open-pr', 'merge', 'postmerge', 'cleanup']);
const CANONICAL_INVALIDATION = Object.freeze([
  'authority',
  'lock',
  'source',
  'worktree',
  'patch',
  'after-image',
  'dependency',
  'graph',
  'proof',
  'disclosure',
  'review',
  'base-drift',
].map((domain) => Object.freeze({ domain, when: `invalidate when ${domain} identity or derived result changes` })));
function validateCatalogRecords(records, canonicalRecords) {
  const replacements = new Set(records.map(({ id }) => id));
  validateSchemaCatalogRecords([
    ...canonicalRecords.filter(({ id }) => !replacements.has(id)),
    ...records,
  ]);
}
function canonicalizeProposedRecords(records, canonicalRecords) {
  const byId = new Map(canonicalRecords.map((record) => [record.id, record]));
  return records.map((record) => {
    const canonical = byId.get(record.id);
    return canonical && canonicalJson(canonical) === canonicalJson(record) ? canonical : record;
  });
}
function semanticDiff({ family, before, after, ...options }) {
  try {
    return semanticDiffOwner({ family, before, after, ...options });
  } catch (error) {
    if (canonicalJson(before) === canonicalJson(after)) return { versionEffect: 'none', effect: 'editorial' };
    throw error;
  }
}
function contentVersionEffect(kind, semantic) {
  if (kind === 'r1-lock' || kind === 'retained-evidence-acceptance' || semantic?.versionEffect === undefined || semantic.versionEffect === 'none') return 'none';
  return semantic.versionEffect === 'major' ? 'major' : semantic.versionEffect === 'minor' ? 'minor' : 'patch';
}
export const CHANGE_INTENT_PROFILE = PROFILE;
export const CHANGE_INTENT_SCHEMA_PATH = SCHEMA_PATH;

export class ChangeIntentError extends Error {
  constructor(code, message, details = {}) { super(`${code}: ${message}`); this.name = 'ChangeIntentError'; this.code = code; this.details = details; }
}
const fail = (code, message, details) => { throw new ChangeIntentError(code, message, details); };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const object = (value, label) => { if (!isObject(value)) fail('CORE_CHANGE_INTENT_INPUT_INVALID', `${label} must be an object`); return value; };
const bytesOf = (value, label = 'bytes') => { if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value); if (typeof value === 'string') return Buffer.from(value, 'utf8'); fail('CORE_CHANGE_INTENT_INPUT_INVALID', `${label} must be UTF-8 text or bytes`); };
const sha256 = (value) => sha256Digest(bytesOf(value));
function path(value, label) { if (typeof value !== 'string' || !SAFE_PATH.test(value)) fail('CORE_CHANGE_INTENT_PATH_INVALID', `${label} must be repository-relative`, { value }); return value; }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) fail('CORE_CHANGE_INTENT_IDENTITY_INVALID', `${label} must be a sha256 digest`, { value }); return value; }
function identity(pathValue, bytes, label = pathValue) { path(pathValue, `${label}.path`); const content = bytesOf(bytes, `${label}.bytes`); return { path: pathValue, digest: sha256(content), byteLength: content.byteLength }; }
function descriptor(value, label) { object(value, label); const unknown = Object.keys(value).filter((key) => !['path', 'digest', 'byteLength'].includes(key)); if (unknown.length) fail('CORE_CHANGE_INTENT_UNKNOWN_FIELD', `${label} contains unknown fields`, { unknown }); path(value.path, `${label}.path`); digest(value.digest, `${label}.digest`); if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 0) fail('CORE_CHANGE_INTENT_IDENTITY_INVALID', `${label}.byteLength must be a non-negative safe integer`); return { path: value.path, digest: value.digest, byteLength: value.byteLength }; }
function git(root, args, encoding = 'utf8') { try { return execFileSync('git', ['-C', root, ...args], { encoding, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); } catch (error) { fail('CORE_CHANGE_INTENT_SOURCE_UNAVAILABLE', `git ${args.join(' ')} failed`, { cause: error.message }); } }
function gitBytes(root, args) { try { return execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024 }); } catch (error) { fail('CORE_CHANGE_INTENT_SOURCE_UNAVAILABLE', `git ${args.join(' ')} failed`, { cause: error.message }); } }
function optionalGitBytes(root, args) { try { return execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return undefined; } }
function isAncestor(root, ancestor, descendant) { try { execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', ancestor, descendant], { stdio: ['ignore', 'pipe', 'pipe'] }); return true; } catch { return false; } }
function gitTreeEntry(root, commit, itemPath, label) {
  const bytes = optionalGitBytes(root, ['ls-tree', '-z', commit, '--', itemPath]);
  if (!bytes || bytes.byteLength === 0) return undefined;
  const line = bytes.toString('utf8').replace(/\0$/u, '');
  const match = /^(\d{6}) (blob|tree|commit) [0-9a-f]{40}\t(.+)$/u.exec(line);
  if (!match || match[3] !== itemPath) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', `${label} has an unsupported Git tree entry`);
  return { mode: match[1], type: match[2] };
}
function validateBeforeImageState(root, commit, image, label) {
  const entry = gitTreeEntry(root, commit, image.path, label);
  if (!entry) {
    if (image.byteLength === 0) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${label} cannot add an empty absent path`);
    return undefined;
  }
  if (entry.mode !== '100644' || entry.type !== 'blob') fail('CORE_CHANGE_INTENT_SOURCE_INVALID', `${label} must be an ordinary non-symlink 100644 Git blob`);
  const before = gitBytes(root, ['show', `${commit}:${image.path}`]);
  if (before.byteLength === image.byteLength && sha256(before) === image.digest) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${label} is identical to its existing before-image`);
  return entry;
}
function validateActualImageState(root, commit, image, label) {
  const entry = gitTreeEntry(root, commit, image.path, label);
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} must be an ordinary non-symlink 100644 Git blob`);
  const bytes = gitBytes(root, ['show', `${commit}:${image.path}`]);
  if (bytes.byteLength !== image.byteLength || sha256(bytes) !== image.digest) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} differs from its completed after-image`);
  return bytes;
}
function operationBase(root, commit, kind) {
  if (kind !== 'component-implementation') return commit;
  let originMain;
  try { originMain = git(root, ['rev-parse', 'refs/remotes/origin/main']); } catch { originMain = undefined; }
  if (originMain && isAncestor(root, originMain, commit)) return originMain;
  if (originMain) {
    try { return git(root, ['merge-base', originMain, commit]); } catch { /* use the immutable authority boundary below */ }
  }
  if (isAncestor(root, CHANGE_INTENT_BINDINGS.authority.commit, commit)) return CHANGE_INTENT_BINDINGS.authority.commit;
  return commit;
}
function sourceCommitState(root, commit) {
  const tree = git(root, ['rev-parse', `${commit}^{tree}`]);
  const lockBytes = gitBytes(root, ['show', `${commit}:pnpm-lock.yaml`]);
  if (!HEX40.test(commit) || !HEX40.test(tree)) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', 'source commit/tree identity is not canonical');
  return { commit, tree, lockfile: identity('pnpm-lock.yaml', lockBytes) };
}
function sourceState(root, kind, { completed = false } = {}) {
  const head = git(root, ['rev-parse', 'HEAD']);
  const commit = completed && kind === 'retained-evidence-acceptance'
    ? git(root, ['rev-parse', 'HEAD^'])
    : operationBase(root, head, kind);
  const source = sourceCommitState(root, commit);
  const branch = git(root, ['branch', '--show-current']);
  if (!/^codex\/[A-Za-z0-9._/-]+$/u.test(branch)) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', 'producer requires a codex topic checkout');
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') fail('CORE_CHANGE_INTENT_WORKTREE_DRIFT', 'producer requires a clean worktree');
  const workingLock = readFileSync(join(root, 'pnpm-lock.yaml'));
  if (workingLock.byteLength !== source.lockfile.byteLength || sha256(workingLock) !== source.lockfile.digest) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', 'clean worktree lockfile differs from the source commit');
  return { commit, tree: source.tree, branch, cleanWorktree: true, lockfile: source.lockfile };
}
function readAuthorityIdentity(root, filePath, selector = '/') { const bytes = gitBytes(root, ['show', `${CHANGE_INTENT_BINDINGS.authority.commit}:${filePath}`]); if (!readFileSync(join(root, filePath)).equals(bytes)) fail('CORE_CHANGE_INTENT_AUTHORITY_DRIFT', `${filePath} differs from accepted authority merge`); return { path: filePath, selector, digest: sha256(bytes), sourceCommit: CHANGE_INTENT_BINDINGS.authority.commit, sourceTree: CHANGE_INTENT_BINDINGS.authority.tree }; }
function verifyParentAuthority(root) {
  const parent = CHANGE_INTENT_BINDINGS.parentAuthority;
  if (git(root, ['rev-parse', `${parent.commit}^{tree}`]) !== parent.tree) fail('CORE_CHANGE_INTENT_AUTHORITY_DRIFT', 'immutable amendment-08 parent authority tree drifted');
  for (const filePath of Object.values(PARENT_AUTHORITY_PATHS)) {
    const expected = gitBytes(root, ['show', `${parent.commit}:${filePath}`]);
    if (!readFileSync(join(root, filePath)).equals(expected)) fail('CORE_CHANGE_INTENT_AUTHORITY_DRIFT', `${filePath} differs from immutable amendment-08 parent authority`);
  }
}
function fixedInputs(root) {
  const binding = CHANGE_INTENT_BINDINGS; const snapshotBytes = readFileSync(join(root, binding.snapshot.path)); const snapshotIdentity = identity(binding.snapshot.path, snapshotBytes); if (snapshotIdentity.byteLength !== binding.snapshot.byteLength || snapshotIdentity.digest !== binding.snapshot.digest) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'Stage1 family snapshot bytes drifted'); const snapshot = parseJsonStrict(snapshotBytes.toString('utf8')); if (snapshot.coreSource?.commit !== binding.stage1.commit || snapshot.coreSource?.tree !== binding.stage1.tree || snapshot.families?.length !== 53 || snapshot.counts?.newImmutableScopeIds !== 45 || snapshot.counts?.existingExactScopeIdsReused !== 8) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'Stage1 snapshot does not bind the exact 53-family source');
  const envelopeBytes = readFileSync(join(root, binding.snapshot.envelopePath)); const snapshotEnvelope = identity(binding.snapshot.envelopePath, envelopeBytes); const snapshotEnvelopeValue = parseJsonStrict(envelopeBytes.toString('utf8')); if (snapshotEnvelope.byteLength !== binding.snapshot.envelopeByteLength || snapshotEnvelope.digest !== binding.snapshot.envelopeDigest || snapshotEnvelopeValue.source?.commit !== binding.stage1.commit || snapshotEnvelopeValue.source?.tree !== binding.stage1.tree || snapshotEnvelopeValue.digest !== binding.snapshot.digest || snapshotEnvelopeValue.byteLength !== binding.snapshot.byteLength) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'Stage1 snapshot envelope binding drifted');
  const baselineBytes = readFileSync(join(root, binding.baseline.path)); const baseline = identity(binding.baseline.path, baselineBytes); const baselineValue = parseJsonStrict(baselineBytes.toString('utf8')); if (baseline.byteLength !== binding.baseline.byteLength || baseline.digest !== binding.baseline.digest || baselineValue.sourceRevision !== binding.baseline.sourceCommit || baselineValue.sourceTree !== binding.baseline.sourceTree || baselineValue.milestone !== 'R1.0') fail('CORE_CHANGE_INTENT_BASELINE_INVALID', 'R1.0 baseline identity is not exact');
  const scopeBytes = readFileSync(join(root, binding.productScope.path)); const scope = identity(binding.productScope.path, scopeBytes); if (scope.digest !== binding.productScope.digest || !scopeBytes.toString('utf8').startsWith('---\nscopeVersion: 6.0.1\n')) fail('CORE_CHANGE_INTENT_SCOPE_INVALID', 'Product Scope 6.0.1 bytes drifted'); return { snapshot, snapshotIdentity, snapshotEnvelope, baseline, baselineValue, scope };
}
function authority(root, fixed) { const fixedOwner = (value, sourceCommit, sourceTree) => ({ path: value.path, digest: value.digest, sourceCommit, sourceTree, selector: '/' }); verifyParentAuthority(root); return { decision: readAuthorityIdentity(root, AUTHORITY_PATHS.decision), acceptance: readAuthorityIdentity(root, AUTHORITY_PATHS.acceptance), architecture: readAuthorityIdentity(root, AUTHORITY_PATHS.architecture), roadmap: readAuthorityIdentity(root, AUTHORITY_PATHS.roadmap), productScope: readAuthorityIdentity(root, AUTHORITY_PATHS.productScope), lock: fixedOwner(fixed.snapshotIdentity, CHANGE_INTENT_BINDINGS.stage1.commit, CHANGE_INTENT_BINDINGS.stage1.tree), snapshot: fixedOwner(fixed.snapshotIdentity, CHANGE_INTENT_BINDINGS.stage1.commit, CHANGE_INTENT_BINDINGS.stage1.tree), snapshotEnvelope: fixedOwner(fixed.snapshotEnvelope, CHANGE_INTENT_BINDINGS.stage1.commit, CHANGE_INTENT_BINDINGS.stage1.tree), baseline: fixedOwner(fixed.baseline, fixed.baselineValue.sourceRevision, fixed.baselineValue.sourceTree), scope: fixedOwner(fixed.scope, CHANGE_INTENT_BINDINGS.authority.commit, CHANGE_INTENT_BINDINGS.authority.tree) }; }
function sameIdentity(actual, expected, label) { if (!actual || actual.path !== expected.path || actual.digest !== expected.digest || actual.sourceCommit !== expected.sourceCommit || actual.sourceTree !== expected.sourceTree) fail('CORE_CHANGE_INTENT_AUTHORITY_DRIFT', `${label} is not the exact canonical identity`); }
function familyEntry(fixed, family) { if (typeof family !== 'string' || family.length === 0) fail('CORE_CHANGE_INTENT_FAMILY_INVALID', 'family must be explicitly selected for snapshot validation'); const matches = fixed.snapshot.families.filter((entry) => entry.family === family); if (matches.length !== 1) fail(matches.length === 0 ? 'CORE_CHANGE_INTENT_FAMILY_UNKNOWN' : 'CORE_CHANGE_INTENT_FAMILY_DUPLICATE', `family ${family} is not exactly one fixed Stage1 family`); return matches[0]; }
function deriveTarget(fixed, operation, input) { const requested = operation.target ?? input.target; const entry = familyEntry(fixed, requested?.family ?? operation.family ?? input.family); const target = { family: entry.family, scopeId: entry.scopeId, tranche: entry.tranche, source: entry.source }; for (const [field, actual] of Object.entries({ scopeId: requested?.scopeId, tranche: requested?.tranche, source: requested?.source })) if (actual !== undefined && actual !== target[field]) fail('CORE_CHANGE_INTENT_LOCK_INVALID', `caller ${field} does not match fixed Stage1 family lock`); return target; }
function operationInput(input) {
  object(input, 'producer input');
  const operation = input.operation ?? input;
  object(operation, 'operation');
  const kind = operation.kind ?? operation.operationKind;
  if (!OPERATION_KINDS.has(kind)) fail('CORE_CHANGE_INTENT_OPERATION_INVALID', 'operation kind is not admitted');
  const effectClass = { 'r1-lock': 'explanation-only', 'routine-git-operation': 'explanation-only', 'retained-evidence-acceptance': 'evidence-retention-write', 'project-migration': 'project-write', 'component-implementation': 'renderer-source-write' }[kind];
  if (operation.effectClass !== undefined && operation.effectClass !== effectClass) fail('CORE_CHANGE_INTENT_EFFECT_INVALID', 'caller-selected effect is not accepted');
  const actions = { 'r1-lock': new Set(['check']), 'component-implementation': new Set(['commit', 'check']), 'retained-evidence-acceptance': new Set(['commit', 'check']), 'routine-git-operation': new Set(['branch', 'commit', 'push', 'open-pr', 'check', 'merge', 'postmerge', 'cleanup']), 'project-migration': new Set(['commit', 'check']) }[kind];
  if (operation.action !== undefined && !actions.has(operation.action)) fail('CORE_CHANGE_INTENT_OPERATION_INVALID', `${kind} does not admit action ${operation.action}`);
  if (Object.hasOwn(operation, 'version') || Object.hasOwn(operation, 'versionEffect') || Object.hasOwn(operation, 'proof') || Object.hasOwn(operation, 'staleProof') || Object.hasOwn(operation, 'owner')) fail('CORE_CHANGE_INTENT_DERIVED_FIELD_INVALID', 'caller-selected version, proof, owner, or effect facts are not accepted');
  if (['review', 'reviewer', 'reviewAssignments', 'reviewInputs', 'reviewResult', 'clearance', 'reviewClearance', 'readyMergeClearance'].some((field) => Object.hasOwn(operation, field))) fail('CORE_CHANGE_INTENT_REVIEW_OWNERSHIP_INVALID', 'review assignment, result, or clearance is external orchestration state');
  if (kind === 'retained-evidence-acceptance' && operation.evidence === undefined) fail('CORE_CHANGE_INTENT_EVIDENCE_INVALID', 'retained evidence requires an exact evidence identity');
  let transition;
  if (EXTERNAL_TRANSITION_ACTIONS.has(operation.action)) {
    if (operation.transition === undefined) fail('CORE_CHANGE_INTENT_TRANSITION_INVALID', `${operation.action} requires exact external transition identities`);
    object(operation.transition, 'operation.transition');
    exactObjectKeys(operation.transition, new Set(['preimage', 'result']), 'operation.transition');
    transition = { preimage: descriptor(operation.transition.preimage, 'operation.transition.preimage'), result: descriptor(operation.transition.result, 'operation.transition.result') };
  } else if (operation.transition !== undefined) {
    fail('CORE_CHANGE_INTENT_TRANSITION_INVALID', 'transition identities are only admitted for external transition actions');
  }
  return { operation, kind, effectClass, transition };
}
function imageBytes(image, label) { object(image, label); if (Object.hasOwn(image, 'bytes')) return bytesOf(image.bytes, `${label}.bytes`); if (Object.hasOwn(image, 'value')) return Buffer.from(`${canonicalJson(image.value)}\n`, 'utf8'); if (Object.hasOwn(image, 'text')) return bytesOf(image.text, `${label}.text`); return undefined; }
function normalizeImages(images, label) { if (images === undefined) return []; if (!Array.isArray(images)) fail('CORE_CHANGE_INTENT_INPUT_INVALID', `${label} must be an array`); const normalized = images.map((item, index) => { const current = object(item, `${label}[${index}]`); path(current.path, `${label}[${index}].path`); const bytes = imageBytes(current, `${label}[${index}]`); if (!bytes) fail('CORE_CHANGE_INTENT_IDENTITY_INVALID', `${label}[${index}] requires bytes, value, or text`); return identity(current.path, bytes, `${label}[${index}]`); }); if (new Set(normalized.map(({ path: itemPath }) => itemPath)).size !== normalized.length) fail('CORE_CHANGE_INTENT_WRITE_SET_INVALID', `${label} contains duplicate paths`); return normalized.sort((left, right) => left.path.localeCompare(right.path)); }
function sourceBeforeImages(root, commit, afterImages) {
  return afterImages.map((image) => {
    validateBeforeImageState(root, commit, image, `source.beforeImages.${image.path}`);
    return identity(image.path, optionalGitBytes(root, ['show', `${commit}:${image.path}`]) ?? Buffer.alloc(0), `source.beforeImages.${image.path}`);
  }).sort((left, right) => left.path.localeCompare(right.path));
}
function canonicalPatchIdentity(beforeImages, afterImages) {
  return identity('proposal.patch', Buffer.from(canonicalJson({ beforeImages, afterImages }), 'utf8'), 'proposal.patch');
}
function completedRecord(root, value, label) {
  const result = descriptor(value, label);
  if (!result.path.startsWith('.git/core-ui-r1/')) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} must remain task-local`);
  let bytes;
  try { bytes = readFileSync(taskPath(root, result.path)); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} is unavailable`, { cause: error.message }); }
  if (bytes.byteLength !== result.byteLength || sha256(bytes) !== result.digest) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} bytes changed`);
  let record;
  try { record = parseJsonStrict(bytes.toString('utf8')); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} is not canonical JSON`, { cause: error.message }); }
  if (canonicalJson(record) !== bytes.toString('utf8')) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} is not the exact canonical JSON byte sequence`);
  return { identity: result, record };
}
function workspacePackageManifest(root, packageName, label) {
  const files = git(root, ['ls-files', '--', 'apps/**/package.json', 'packages/**/package.json', 'tooling/**/package.json']).split('\n').filter(Boolean);
  const matches = files.map((filePath) => {
    const bytes = readFileSync(join(root, filePath));
    const value = parseJsonStrict(bytes.toString('utf8'));
    return { bytes, filePath, value };
  }).filter(({ value }) => value.name === packageName);
  if (matches.length !== 1) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} filtered command does not resolve to one canonical workspace package`);
  return matches[0];
}
export function commandContract(root, command, label = 'command') {
  if (typeof command !== 'string' || command.length === 0) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.command is required`);
  const filtered = /^pnpm --filter ([^ ]+) ([A-Za-z0-9][A-Za-z0-9:._-]*)$/u.exec(command);
  const rootCommand = /^pnpm (?:run )?([A-Za-z0-9][A-Za-z0-9:._-]*)$/u.exec(command);
  let commandId;
  let id;
  let ownerDocumentDigest;
  let ownerRef;
  let argv;
  let scriptBody;
  if (filtered) {
    const [, packageName, script] = filtered;
    const packageRecord = workspacePackageManifest(root, packageName, label);
    if (typeof packageRecord.value.scripts?.[script] !== 'string' || packageRecord.value.scripts[script].length === 0) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.command is not owned by the filtered workspace package script`);
    commandId = `workspace.${packageName.replace(/^@/u, '').replaceAll('/', '.')}:${script}`;
    id = `workspace-package.${packageName.replace(/^@/u, '').replaceAll('/', '.')}.${script.replaceAll(':', '.')}`;
    ownerDocumentDigest = sha256(packageRecord.bytes);
    ownerRef = `workspace-package-${packageRecord.filePath.replace(/\/package\.json$/u, '').replaceAll('/', '-')}`;
    argv = ['pnpm', '--filter', packageName, script];
    scriptBody = packageRecord.value.scripts[script];
  } else if (rootCommand) {
    const [, script] = rootCommand;
    const packageBytes = readFileSync(join(root, 'package.json'));
    const packageValue = parseJsonStrict(packageBytes.toString('utf8'));
    scriptBody = packageValue.scripts?.[script];
    if (typeof scriptBody !== 'string' || scriptBody.length === 0) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.command is not owned by the canonical root command profile`);
    commandId = script;
    id = `root-command.${script.replaceAll(':', '.')}`;
    ownerDocumentDigest = sha256(packageBytes);
    ownerRef = 'root-command-owner';
    argv = ['pnpm', 'run', script];
  } else {
    fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.command is not an admitted canonical pnpm command`);
  }
  const value = { argv, commandId, ownerDocumentDigest, ownerRef, profile: 'core-ui-owned-command-v1', scriptBody };
  return { commandId, id, digest: sha256(canonicalJson(value)), value };
}
function resolvedPnpm(root, label) {
  let executable;
  try {
    executable = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['pnpm'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/u).find(Boolean)?.trim();
    if (!executable) throw new Error('pnpm executable was not resolved');
    executable = realpathSync(executable);
    const stat = lstatSync(executable);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('resolved pnpm executable is not a regular file');
  } catch (error) {
    fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime.pnpm cannot be resolved`, { cause: error.message });
  }
  return executable;
}
function resolvedNode(label) {
  try {
    const executable = realpathSync(process.execPath);
    const stat = lstatSync(executable);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('resolved node executable is not a regular file');
    return executable;
  } catch (error) {
    fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime.node cannot be resolved`, { cause: error.message });
  }
}
function executableIdentity(executablePath, version, label) {
  let executableBytes;
  try { executableBytes = readFileSync(executablePath); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime executable is unavailable`, { cause: error.message }); }
  return { path: executablePath, version, digest: sha256(executableBytes), byteLength: executableBytes.byteLength };
}
function runtimeFileIdentity(root, relativePath, label) {
  try { return identity(relativePath, readFileSync(join(root, relativePath)), label); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime dependency state is unavailable`, { cause: error.message }); }
}
function commandRuntimeMaterials(root, source, label) {
  const policyBytes = readFileSync(join(root, REPOSITORY_POLICY_PATH));
  const policy = parseJsonStrict(policyBytes.toString('utf8'));
  const expectedNode = policy.toolchain?.node;
  const expectedPnpm = policy.toolchain?.pnpm;
  const nodePath = resolvedNode(label);
  let nodeVersion;
  try { nodeVersion = execFileSync(nodePath, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime.node cannot be verified`, { cause: error.message }); }
  const pnpmPath = resolvedPnpm(root, label);
  let pnpmVersion;
  try { pnpmVersion = execFileSync(pnpmPath, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime.pnpm cannot be verified`, { cause: error.message }); }
  if (nodeVersion !== `v${expectedNode}` || pnpmVersion !== expectedPnpm) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime toolchain does not match the repository policy`);
  if (!source?.lockfile || canonicalJson(source.lockfile) !== canonicalJson(identity('pnpm-lock.yaml', readFileSync(join(root, 'pnpm-lock.yaml'))))) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime dependency lockfile is not the exact current source identity`);
  const packageBytes = readFileSync(join(root, 'package.json'));
  const policyIdentity = identity(REPOSITORY_POLICY_PATH, policyBytes);
  return {
    node: executableIdentity(nodePath, nodeVersion, label),
    pnpm: executableIdentity(pnpmPath, pnpmVersion, label),
    dependency: {
      profile: 'core-ui-dependency-preparation-v1',
      policy: policyIdentity,
      lockfile: source.lockfile,
      workspace: runtimeFileIdentity(root, WORKSPACE_PATH, label),
      modules: runtimeFileIdentity(root, MODULES_PATH, label),
      packageJson: identity('package.json', packageBytes),
      preparation: policy.dependencyPreparation,
    },
  };
}
function logicalRuntime(materials) {
  return {
    profile: 'core-ui-command-runtime-v1',
    node: { path: LOGICAL_NODE_PATH, version: materials.node.version, digest: materials.node.digest, byteLength: materials.node.byteLength },
    pnpm: { path: LOGICAL_PNPM_PATH, version: materials.pnpm.version, digest: materials.pnpm.digest, byteLength: materials.pnpm.byteLength },
    environment: { PATH: LOGICAL_PATH, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
    dependency: materials.dependency,
  };
}
export function commandRuntimeIdentity(root, source, label = 'command') {
  return logicalRuntime(commandRuntimeMaterials(root, source, label));
}
export function resolveCommandRuntime(root, source, expected, label = 'command') {
  const materials = commandRuntimeMaterials(root, source, label);
  const runtime = logicalRuntime(materials);
  if (expected !== undefined && canonicalJson(expected) !== canonicalJson(runtime)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.runtime/dependency identity drifted`);
  return {
    runtime,
    nodePath: materials.node.path,
    pnpmPath: materials.pnpm.path,
    environment: { PATH: `${dirname(materials.node.path)}:${dirname(materials.pnpm.path)}`, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
  };
}
export function commandProcedureIdentity(root, command, source, runtime, label = 'command') {
  const contract = commandContract(root, command, label);
  return {
    profile: 'core-ui-command-procedure-v1',
    command,
    commandId: contract.commandId,
    commandRecordDigest: contract.digest,
    commandRecordProfile: contract.value.profile,
    ownerRef: contract.value.ownerRef,
    argv: [runtime.pnpm.path, ...contract.value.argv.slice(1)],
    source,
    runtimeDigest: sha256(canonicalJson(runtime)),
  };
}
function proofToolIdentity(root, label) {
  let bytes;
  try { bytes = readFileSync(join(root, EVIDENCE_PROOF_TOOL_PATH)); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.proofTool is unavailable`, { cause: error.message }); }
  return { profile: 'core-ui-proof-tool-identity-v1', id: 'proof-tool', version: '1', executablePath: EVIDENCE_PROOF_TOOL_PATH, executableSha256: sha256(bytes) };
}
function commandProducerIdentity(root, label) {
  const sourcePath = 'packages/tooling/src/change-intent.mjs';
  let bytes;
  try { bytes = readFileSync(join(root, sourcePath)); } catch (error) { fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label}.producer is unavailable`, { cause: error.message }); }
  return { profile: 'core-ui-command-producer-v1', id: 'core-ui-tooling-command-contract', version: '1', sourcePath, sourceDigest: sha256(bytes), sourceByteLength: bytes.byteLength };
}
function validateCommandOutput(value, label) {
  exactObjectKeys(value, new Set(['profile', 'encoding', 'text', 'digest', 'byteLength']), label);
  if (value.profile !== 'core-ui-command-output-v1' || value.encoding !== 'utf8' || typeof value.text !== 'string' || value.digest !== sha256(bytesOf(value.text)) || value.byteLength !== Buffer.byteLength(value.text)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} is not a content-addressed command output`);
}
const COMPLETED_CHILD_PROFILES = Object.freeze({
  journal: 'core-ui-change-intent-operation-journal-v1',
  deterministic: 'core-ui-deterministic-result-v1',
});
function validateCompletedChildRecord(record, expected, envelope, kind, childType, label) {
  const profiles = {
    journal: { profile: COMPLETED_CHILD_PROFILES.journal, keys: ['profile', 'envelopeDigest', 'head', 'tree', 'operationKind', 'status'] },
    deterministic: { profile: COMPLETED_CHILD_PROFILES.deterministic, keys: ['profile', 'envelopeDigest', 'head', 'tree', 'command', 'commandId', 'commandRecordDigest', 'commandRecordProfile', 'ownerRef', 'source', 'runtime', 'procedure', 'proofTool', 'result', 'stdout', 'stderr', 'exitState'] },
  };
  const spec = profiles[childType];
  if (!spec) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} has no admitted child-record type`);
  if (!isObject(record) || Object.keys(record).some((key) => !spec.keys.includes(key)) || spec.keys.some((key) => !Object.hasOwn(record, key))) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} has an invalid closed record shape`);
  if (record.profile !== spec.profile || record.envelopeDigest !== expected.envelopeDigest || canonicalJson(record.head) !== canonicalJson(expected.head) || canonicalJson(record.tree) !== canonicalJson(expected.tree)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind the exact completed head, tree, and preview identity`);
  if (childType === 'journal' && (record.operationKind !== kind || record.status !== 'passed')) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} is not a passed journal for the exact operation`);
  if (childType === 'deterministic') {
    if (typeof record.command !== 'string' || record.command.length === 0 || !Number.isSafeInteger(record.exitState) || record.exitState !== 0 || !envelope.checks.some(({ command }) => command === record.command)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} is not a passed canonical result for a required check`);
    const command = commandContract(expected.root, record.command, label);
    if (record.commandId !== command.commandId || record.commandRecordDigest !== command.digest || record.commandRecordProfile !== command.value.profile || record.ownerRef !== command.value.ownerRef) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind its canonical command owner contract`);
    if (canonicalJson(record.source) !== canonicalJson(expected.source)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind its executed source identity`);
    const runtime = commandRuntimeIdentity(expected.root, envelope.source, label);
    if (canonicalJson(record.runtime) !== canonicalJson(runtime)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind the exact runtime and dependency identity`);
    const procedure = commandProcedureIdentity(expected.root, record.command, record.source, runtime, label);
    if (canonicalJson(record.procedure) !== canonicalJson(procedure)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind the exact command procedure identity`);
    if (canonicalJson(record.proofTool) !== canonicalJson(proofToolIdentity(expected.root, label))) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind its proof-tool identity`);
    validateCommandOutput(record.stdout, `${label}.stdout`);
    validateCommandOutput(record.stderr, `${label}.stderr`);
    const producer = commandProducerIdentity(expected.root, label);
    const result = record.result;
    if (!isObject(result) || Object.keys(result).some((key) => !['profile', 'status', 'producer', 'preimage', 'digest', 'byteLength'].includes(key)) || result.profile !== 'core-ui-command-result-v1' || result.status !== 'passed' || canonicalJson(result.producer) !== canonicalJson(producer)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind the canonical command producer`);
    const preimage = completedRecord(expected.root, result.preimage, `${label}.result.preimage`);
    const expectedPreimage = { profile: 'core-ui-command-result-preimage-v1', command: record.command, source: record.source, stdout: record.stdout, stderr: record.stderr, exitState: record.exitState, producer };
    if (canonicalJson(preimage.record) !== canonicalJson(expectedPreimage) || result.digest !== preimage.identity.digest || result.byteLength !== preimage.identity.byteLength) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} does not bind the immutable command result preimage`);
  }
  return record;
}
function completedResultIdentities(root, values, label, envelope, expected, kind, childType) {
  if (!Array.isArray(values) || values.length === 0) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} must contain canonical task-local records`);
  const commands = [];
  const identities = values.map((value, index) => {
    const child = completedRecord(root, value, `${label}[${index}]`);
    validateCompletedChildRecord(child.record, expected, envelope, kind, childType, `${label}[${index}]`);
    if (childType === 'deterministic') commands.push(child.record.command);
    return child.identity;
  });
  if (new Set(identities.map(({ path: itemPath }) => itemPath)).size !== identities.length) fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} contains duplicate records`);
  if (childType === 'deterministic') {
    const expectedCommands = envelope.checks.map(({ command }) => command);
    if (commands.length !== expectedCommands.length || new Set(commands).size !== commands.length || canonicalJson([...commands].sort()) !== canonicalJson([...expectedCommands].sort())) {
      fail('CORE_CHANGE_INTENT_RESULT_INVALID', `${label} must contain exactly one passed record for every required check`);
    }
  }
  return identities.sort((left, right) => left.path.localeCompare(right.path));
}
function completedResult(root, value, envelope, kind, expectedBase, expectedCommit) {
  object(value, 'envelope.result');
  exactObjectKeys(value, new Set(['envelopeDigest', 'head', 'tree', 'diff', 'changedPaths', 'operationJournal', 'deterministicResults']), 'envelope.result');
  if (value.envelopeDigest !== envelope.intentId) fail('CORE_CHANGE_INTENT_RESULT_INVALID', 'completed result does not bind the stable preview identity');
  const commit = expectedCommit ?? git(root, ['rev-parse', 'HEAD']);
  const tree = git(root, ['rev-parse', `${commit}^{tree}`]);
  const base = expectedBase ?? operationBase(root, commit, kind);
  const expectedHead = identity('git-head', bytesOf(commit));
  const expectedTree = identity('git-tree', bytesOf(tree));
  const expectedDiff = identity('git-diff', gitBytes(root, ['diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${base}..${commit}`, '--']));
  const changed = kind === 'r1-lock' ? [] : (git(root, ['diff', '--name-only', '--diff-filter=ACDMRTUXB', `${base}..${commit}`, '--']) || '').split('\n').filter(Boolean).sort();
  if (canonicalJson(value.head) !== canonicalJson(expectedHead) || canonicalJson(value.tree) !== canonicalJson(expectedTree) || canonicalJson(value.diff) !== canonicalJson(expectedDiff) || canonicalJson(value.changedPaths ?? []) !== canonicalJson(changed)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', 'completed result does not bind the actual head, tree, diff, or changed paths');
  const afterImages = envelope.proposal.afterImages.map((image) => {
    validateActualImageState(root, commit, image, `completed after-image ${image.path}`);
    return image.path;
  }).sort();
  const projections = kind === 'r1-lock' || kind === 'project-migration' ? [] : [...(envelope.affected?.generatedProjections ?? [])].sort();
  for (const projection of projections) {
    const entry = gitTreeEntry(root, commit, projection, `completed generated projection ${projection}`);
    if (!entry || entry.mode !== '100644' || entry.type !== 'blob') fail('CORE_CHANGE_INTENT_RESULT_INVALID', `completed generated projection ${projection} is not an ordinary 100644 Git blob`);
  }
  const expectedPaths = [...new Set([...afterImages, ...projections])].sort();
  if (kind !== 'r1-lock' && canonicalJson(expectedPaths) !== canonicalJson(changed)) fail('CORE_CHANGE_INTENT_RESULT_INVALID', 'completed result paths do not equal the canonical source plus generated projection set');
  const journalRecord = completedRecord(root, value.operationJournal, 'envelope.result.operationJournal');
  const expectedRecordBinding = { root, envelopeDigest: envelope.intentId, head: expectedHead, tree: expectedTree, source: { commit, tree } };
  validateCompletedChildRecord(journalRecord.record, expectedRecordBinding, envelope, kind, 'journal', 'operation journal');
  const journal = journalRecord.identity;
  const deterministicResults = completedResultIdentities(root, value.deterministicResults, 'envelope.result.deterministicResults', envelope, expectedRecordBinding, kind, 'deterministic');
  return { envelopeDigest: value.envelopeDigest, head: expectedHead, tree: expectedTree, diff: expectedDiff, changedPaths: changed, operationJournal: journal, deterministicResults };
}
function validateSourceBinding(root, source, kind, expectedBase) {
  exactObjectKeys(source, new Set(['commit', 'tree', 'branch', 'cleanWorktree', 'lockfile']), 'envelope.source');
  if (!HEX40.test(source.commit) || !HEX40.test(source.tree) || !/^codex\/[A-Za-z0-9._/-]+$/u.test(source.branch) || source.cleanWorktree !== true) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', 'source is not a clean canonical topic snapshot');
  const head = git(root, ['rev-parse', 'HEAD']);
  const expectedCommit = expectedBase ?? operationBase(root, head, kind);
  if (source.commit !== expectedCommit) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', 'source does not bind the immutable operation base');
  const canonical = sourceCommitState(root, source.commit);
  if (source.tree !== canonical.tree || canonicalJson(source.lockfile) !== canonicalJson(canonical.lockfile)) fail('CORE_CHANGE_INTENT_SOURCE_INVALID', 'source commit/tree/lockfile identity is not canonical');
}
function parsedAfterImageRecord(image) {
  const bytes = imageBytes(image, `proposal.afterImages.${image.path}`);
  let parsed;
  if (bytes && image.path.endsWith('.json')) {
    try {
      parsed = parseJsonStrict(bytes.toString('utf8'));
      if (typeof parsed.kind === 'string') validateFamily(parsed.kind, parsed);
      else parsed = undefined;
    } catch (error) {
      if (image.path.startsWith('catalog/')) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} is not a validated canonical after-image`, { cause: error.message });
      parsed = undefined;
    }
  }
  if (parsed && image.record !== undefined && canonicalJson(image.record) !== canonicalJson(parsed)) {
    fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} caller record differs from its canonical after-image`);
  }
  if (parsed) return parsed;
  if (image.path.startsWith('catalog/') && bytes) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} is not a canonical catalog record`);
  return undefined;
}
function currentRecords(context) { return context.catalogBundle.artifacts.map((artifact) => ({ id: artifact.id, value: artifact.record, source: artifact.source })); }
function canonicalCurrentRecord(root, context, record, sourceCommit) {
  const artifact = context.catalogBundle.artifacts.find(({ record: value }) => value?.id === record?.id || value?.name === record?.name);
  const recordPath = artifact?.source?.record;
  if (!recordPath) return undefined;
  let bytes;
  try { bytes = sourceCommit ? gitBytes(root, ['show', `${sourceCommit}:${recordPath}`]) : readFileSync(join(root, recordPath)); } catch (error) { fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${recordPath} canonical catalog source is unavailable`, { cause: error.message }); }
  let parsed;
  try { parsed = parseJsonStrict(bytes.toString('utf8')); validateFamily(parsed.kind, parsed); } catch (error) { fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${recordPath} canonical catalog source is invalid`, { cause: error.message }); }
  if (canonicalJson(parsed) !== canonicalJson(artifact.record)) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${recordPath} differs from the compiled canonical catalog record`);
  return parsed;
}
function semanticRevisionContext(root, context, component) {
  const artifacts = context.catalogBundle.artifacts;
  return {
    examples: artifacts.filter(({ kind }) => kind === 'example').map(({ record }) => record),
    tokenSources: artifacts.filter(({ kind }) => kind === 'token').map(({ record }) => record),
    exampleSources: Object.fromEntries(
      artifacts
        .filter(({ kind, source }) => kind === 'example' && typeof source?.content === 'string')
        .map(({ id, source }) => [id, readFileSync(join(root, source.content), 'utf8')]),
    ),
    tokenRequirementSets: component?.tokenRequirementSets ?? {},
    platformSafetyRequirementSets: component?.platformSafetyRequirementSets ?? {},
  };
}
function validateTargetRecordBinding(context, image, record, targetFamily, currentTarget) {
  if (!record) return;
  if (record.name !== targetFamily) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} record family does not match locked target ${targetFamily}`);
  if (currentTarget?.id !== undefined && record.id !== currentTarget.id) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} record id does not match the canonical locked target`);
  if (image.path.startsWith('catalog/')) {
    const expectedPath = currentTarget
      ? canonicalRecordSource(context, currentTarget)
      : `catalog/components/${recordSlug({ name: targetFamily })}/artifact.json`;
    if (image.path !== expectedPath) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} is not the canonical catalog source for locked target ${targetFamily}`);
  }
}
function mirrorCatalogPreview(source, target, overrides, prefix = '') {
  mkdirSync(target, { recursive: true });
  const descendants = [...overrides.keys()].filter((itemPath) => itemPath.startsWith(`${prefix ? `${prefix}/` : ''}`));
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const destination = join(target, entry.name);
    const override = overrides.get(itemPath);
    if (override !== undefined) {
      writeFileSync(destination, override);
    } else if (entry.isDirectory() && descendants.some((pathValue) => pathValue.startsWith(`${itemPath}/`))) {
      mirrorCatalogPreview(join(source, entry.name), destination, overrides, itemPath);
    } else {
      symlinkSync(join(source, entry.name), destination, entry.isDirectory() ? 'dir' : 'file');
    }
  }
  for (const [itemPath, bytes] of overrides) {
    if (itemPath === prefix || !itemPath.startsWith(`${prefix ? `${prefix}/` : ''}`)) continue;
    const relative = prefix ? itemPath.slice(prefix.length + 1) : itemPath;
    const parts = relative.split('/');
    const destination = join(target, ...parts);
    mkdirSync(dirname(destination), { recursive: true });
    if (!existsSync(destination)) writeFileSync(destination, bytes);
  }
}
function validateCatalogCompilerPreview(root, manifestBytes, recordPath, recordBytes) {
  const previewRoot = mkdtempSync(join(tmpdir(), 'core-ui-change-intent-catalog-preview-'));
  try {
    mirrorCatalogPreview(root, previewRoot, new Map([
      ['packages/catalog/catalog-sources.json', manifestBytes],
      [recordPath, recordBytes],
    ]));
    execFileSync(process.execPath, [
      '--input-type=module',
      '-e',
      `const { compileCatalog } = await import(${JSON.stringify(CATALOG_COMPILER_MODULE)}); await compileCatalog({ repositoryRoot: process.argv.at(-1) });`,
      previewRoot,
    ], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (error) {
    fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'proposed catalog sources do not pass the canonical compiler', { cause: error.stderr?.trim() || error.message });
  } finally {
    rmSync(previewRoot, { recursive: true, force: true });
  }
}
function validateNewCatalogManifest(root, context, images, targetFamily) {
  const manifestImage = images.find((image) => image.path === context.sourceManifestPath);
  if (!manifestImage) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'a new locked catalog family requires the canonical source manifest after-image');
  let proposedManifest;
  try { proposedManifest = parseJsonStrict(imageBytes(manifestImage, `${context.sourceManifestPath}.bytes`).toString('utf8')); }
  catch (error) { fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'catalog source manifest after-image is not canonical JSON', { cause: error.message }); }
  const allowed = new Set(['schema', 'authorityDecisionPath', 'commandRegistryPath', 'pageBudgetProfilePath', 'platformSafetyContractPath', 'queryApiVersion', 'records', 'supportedQueryApiVersions']);
  if (!isObject(proposedManifest) || Object.keys(proposedManifest).some((key) => !allowed.has(key)) || !Array.isArray(proposedManifest.records)) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'catalog source manifest after-image has an invalid closed shape');
  const currentManifest = context.sourceManifest;
  const { records: currentRecords, ...currentMetadata } = currentManifest;
  const { records: proposedRecordsValue, ...proposedMetadata } = proposedManifest;
  if (canonicalJson(currentMetadata) !== canonicalJson(proposedMetadata)) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'new-family source manifest changes a non-membership field');
  const currentByPath = new Map(currentRecords.map((entry) => [entry.path, entry]));
  const proposedByPath = new Map();
  for (const entry of proposedRecordsValue) {
    if (!isObject(entry) || typeof entry.path !== 'string' || proposedByPath.has(entry.path)) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'new-family source manifest has duplicate or invalid entries');
    proposedByPath.set(entry.path, entry);
  }
  for (const [entryPath, entry] of currentByPath) {
    if (!proposedByPath.has(entryPath) || canonicalJson(proposedByPath.get(entryPath)) !== canonicalJson(entry)) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'new-family source manifest removes or replaces an existing entry');
  }
  const extras = proposedRecordsValue.filter((entry) => !currentByPath.has(entry.path));
  const expectedPath = `catalog/components/${recordSlug({ name: targetFamily })}/artifact.json`;
  if (extras.length !== 1 || extras[0].family !== 'component' || extras[0].path !== expectedPath) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'new-family source manifest must add only the exact locked component source');
  const recordImage = images.find((image) => image.path === expectedPath);
  if (!recordImage) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'a new locked catalog family requires the exact component source after-image');
  const compilerManifest = {
    ...proposedManifest,
    records: proposedRecordsValue.filter(({ family, path: itemPath }) => family === 'token-source' || itemPath === expectedPath),
  };
  validateCatalogCompilerPreview(root, Buffer.from(`${canonicalJson(compilerManifest)}\n`, 'utf8'), expectedPath, imageBytes(recordImage, `${expectedPath}.bytes`));
}
function proposedRecords(root, context, images, targetFamily, sourceCommit) {
  const current = currentRecords(context);
  const existing = current.find(({ value }) => value?.name === targetFamily)?.value;
  if (!existing) validateNewCatalogManifest(root, context, images, targetFamily);
  const currentTarget = existing ? canonicalCurrentRecord(root, context, existing, sourceCommit) : undefined;
  const parsed = images.map((image) => parsedAfterImageRecord(image));
  images.forEach((image, index) => validateTargetRecordBinding(context, image, parsed[index] ?? image.record, targetFamily, currentTarget));
  const catalogTarget = parsed.find((record, index) => record?.name === targetFamily && images[index].path.startsWith('catalog/'));
  const canonicalTarget = catalogTarget ?? currentTarget;
  const records = images.map((image, index) => {
    if (parsed[index]) return parsed[index];
    if (image.record !== undefined) {
      const supplied = structuredClone(image.record);
      try { validateFamily(supplied.kind, supplied); } catch (error) { fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} attached record is invalid`, { cause: error.message }); }
      if (!canonicalTarget || canonicalJson(supplied) !== canonicalJson(canonicalTarget)) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', `${image.path} attached record is not the exact canonical catalog record for ${targetFamily}`);
      return canonicalTarget;
    }
    if (canonicalTarget && context.workspacePackages.some(({ path: packagePath }) => image.path === packagePath || image.path.startsWith(`${packagePath}/`))) return canonicalTarget;
    return undefined;
  });
  return { records, current, canonicalTarget };
}
function canonicalPackageForPath(context, itemPath) { return context.workspacePackages.filter((item) => itemPath === item.path || itemPath.startsWith(`${item.path}/`)).sort((left, right) => right.path.length - left.path.length)[0] ?? null; }
function declaredSourceEntry(context, itemPath) { return context.sourceManifest.records.find((entry) => entry.path === itemPath || entry.sourcePath === itemPath); }
function recordSlug(record) { return String(record.name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, ''); }
function canonicalRecordSource(context, record) {
  const existing = context.catalogBundle.artifacts.find(({ record: value }) => value?.id === record?.id || value?.name === record?.name);
  return existing?.source?.record ?? `catalog/components/${recordSlug(record)}/artifact.json`;
}
function packagePathMatchesRecord(itemPath, packageOwner, record) {
  if (!record || packageOwner?.name !== '@core-ui/react') return false;
  const relativePath = itemPath.slice(`${packageOwner.path}/`.length);
  if (!/^(?:src|test)\//u.test(relativePath)) return false;
  const fileName = relativePath.split('/').at(-1)?.replace(/\.[^.]+$/u, '').replace(/\.test$/u, '').toLowerCase();
  return fileName === recordSlug(record);
}
function ownerForImage(context, image, record, closure, operationKind) {
  const itemPath = image.path;
  if (classifyPath(itemPath, context.repositoryPolicy) === 'projection'
      || itemPath.includes('/generated/') || itemPath.includes('/dist/') || itemPath.includes('/build/')) {
    fail('CORE_CHANGE_INTENT_OWNER_UNRESOLVED', `${itemPath} is a projection, not an owner`);
  }
  const sourceEntry = declaredSourceEntry(context, itemPath);
  const catalogSourceManifest = itemPath === context.sourceManifestPath;
  const packageOwner = canonicalPackageForPath(context, itemPath);
  const proposedCatalogSource = record && itemPath === canonicalRecordSource(context, record);
  const packageRecordSource = packagePathMatchesRecord(itemPath, packageOwner, record);
  const retainedEvidencePath = operationKind === 'retained-evidence-acceptance'
    && itemPath.startsWith('tests/evidence/') && classifyPath(itemPath, context.repositoryPolicy) === 'proof';
  const affectedPackage = closure.packages.some(({ name }) => name === packageOwner?.name);
  if (!sourceEntry && !packageOwner && !proposedCatalogSource && !retainedEvidencePath) {
    fail('CORE_CHANGE_INTENT_OWNER_UNRESOLVED', `${itemPath} is not declared by a canonical owner`);
  }
  if (packageOwner && !affectedPackage) {
    fail('CORE_CHANGE_INTENT_OWNER_UNRESOLVED', `${itemPath} is not in canonical affected package graph`);
  }
  if (!record && (itemPath.startsWith('catalog/') || sourceEntry?.family === 'component')) {
    fail('CORE_CHANGE_INTENT_OWNER_UNRESOLVED', `${itemPath} requires a validated canonical after-image`);
  }
  if (packageOwner && !sourceEntry && !proposedCatalogSource && !packageRecordSource && !catalogSourceManifest) {
    fail('CORE_CHANGE_INTENT_OWNER_UNRESOLVED', `${itemPath} is not correlated to a canonical record or package-owned source/test convention`);
  }
  const owner = packageOwner?.name ?? (sourceEntry?.family === 'component' || proposedCatalogSource || catalogSourceManifest ? '@core-ui/catalog' : retainedEvidencePath ? '@core-ui/repository-policy' : null);
  if (!owner) fail('CORE_CHANGE_INTENT_OWNER_UNRESOLVED', `${itemPath} has no canonical package owner`);
  const renderer = owner === '@core-ui/react';
  const effect = operationKind === 'retained-evidence-acceptance'
    ? 'evidence-retention-write' : renderer ? 'renderer-source-write' : 'canonical-source-write';
  return {
    path: itemPath,
    owner,
    selector: retainedEvidencePath
      ? 'repository-policy:retained-evidence'
      : catalogSourceManifest
        ? 'workspace-package:packages/catalog:source-manifest'
        : `workspace-package:${packageOwner?.path ?? sourceEntry?.path ?? 'validated-proposed-catalog-record'}`,
    source: image,
    effect,
    recordId: record?.id ?? null,
  };
}
function canonicalCatalogDependencyClosure(context) {
  const seed = context.catalogBundle.artifacts.find(({ source }) => source?.record?.startsWith('catalog/'))?.source?.record;
  if (!seed) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'canonical catalog dependency source is unavailable for a new family');
  try {
    return affectedClosure({ context, sourcePaths: [seed], artifactIds: [] });
  } catch (error) {
    fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'canonical catalog dependency closure is unavailable for a new family', { cause: error.message });
  }
}
function generatorProjectionClosure(context, closure) {
  const projections = closure.projections ?? [];
  const derived = new Set();
  for (const group of context.repositoryPolicy.generatorProjectionGroups ?? []) {
    if (!isObject(group) || !Array.isArray(group.whenCanonicalSourcePrefixes) || !Array.isArray(group.whenProjectionsInclude) || !Array.isArray(group.outputs)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'repository policy generator projection group is malformed');
    if (group.whenCanonicalSourcePrefixes.some((prefix) => typeof prefix === 'string' && closure.canonicalSources.some((source) => source.startsWith(prefix)))
      && group.whenProjectionsInclude.every((projection) => projections.includes(projection))) {
      for (const output of group.outputs) {
        if (typeof output !== 'string' || !SAFE_PATH.test(output)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'repository policy generator projection output is not a safe repository path');
        derived.add(output);
      }
    }
  }
  return [...derived].sort();
}
function localProposedGraph(context, proposed, current, sourcePaths, artifactIds) {
  const currentIds = new Set(current.map(({ id }) => id));
  const currentSourcePaths = sourcePaths.filter((itemPath) => context.sourceManifest.records.some((entry) => entry.path === itemPath || entry.sourcePath === itemPath));
  const knownArtifacts = artifactIds.filter((id) => currentIds.has(id));
  const canonical = currentSourcePaths.length
    ? affectedClosure({ context, sourcePaths: currentSourcePaths, artifactIds: knownArtifacts })
    : { sourceRevision: context.sourceRevision, canonicalSources: [], artifacts: [], relations: [], projections: [], packages: [], requiredChecks: [], deferred: [] };
  const proposedIds = proposed.map((value) => value.id).filter(Boolean);
  const proposedEdges = relationEdges(proposed);
  const proposedSources = sourcePaths.filter((itemPath) => !canonical.canonicalSources.includes(itemPath));
  const newCatalogRecord = proposed.some(({ id }) => !currentIds.has(id)) && proposedSources.some((itemPath) => itemPath.startsWith('catalog/'));
  const catalogDependencies = newCatalogRecord ? canonicalCatalogDependencyClosure(context) : undefined;
  const proposedPackages = proposedSources.map((itemPath) => canonicalPackageForPath(context, itemPath)).filter(Boolean).map(({ name, path: itemPath }) => ({ name, path: itemPath }));
  const dependencyPackages = catalogDependencies?.packages ?? [];
  const dependencyChecks = catalogDependencies?.requiredChecks ?? [];
  const dependencyProjections = catalogDependencies?.projections ?? [];
  const proposedClosure = {
    ...canonical,
    sourceRevision: context.sourceRevision,
    canonicalSources: [...new Set([...canonical.canonicalSources, ...proposedSources])].sort(),
    artifacts: [...new Set([...canonical.artifacts, ...proposedIds])].sort(),
    relations: [...new Set([...canonical.relations.map((edge) => canonicalJson(edge)), ...proposedEdges.map((edge) => canonicalJson(edge))])].map((edge) => parseJsonStrict(edge)),
    projections: [...new Set([...canonical.projections, ...dependencyProjections])].sort(),
    packages: [...new Map([...canonical.packages, ...dependencyPackages, ...proposedPackages].map((item) => [item.name, item])).values()].sort((left, right) => left.name.localeCompare(right.name)),
    requiredChecks: [...new Set([...canonical.requiredChecks, ...dependencyChecks])].sort(),
    deferred: canonical.deferred.length ? canonical.deferred : [{ capability: 'renderer-proof-evaluation-closure', readiness: 'unavailable', earliestBoundary: 'Gate 1' }],
  };
  proposedClosure.generatedProjections = generatorProjectionClosure(context, proposedClosure);
  return proposedClosure;
}
function checksForClosure(closure, kind, proofIds) { const nextClosure = { ...closure, staleProof: kind === 'retained-evidence-acceptance' ? [...(closure.staleProof ?? [])] : [...proofIds] }; const checks = nextClosure.requiredChecks?.map((command) => ({ command, owner: command.startsWith('pnpm --filter ') ? nextClosure.packages.find(({ name }) => command.includes(name))?.path ?? 'repository-root' : 'repository-root' })) ?? []; if (kind !== 'r1-lock' && !checks.some(({ command }) => command === 'pnpm check')) checks.push({ command: 'pnpm check', owner: 'repository-root' }); if (!checks.some(({ command }) => command === 'pnpm generate:check')) checks.push({ command: 'pnpm generate:check', owner: 'repository-root' }); return { closure: nextClosure, checks: [...new Map(checks.map((check) => [check.command, check])).values()].sort((left, right) => left.command.localeCompare(right.command)) }; }
function roadmapProofIds(root, tranche) { const roadmap = gitBytes(root, ['show', `${CHANGE_INTENT_BINDINGS.authority.commit}:${AUTHORITY_PATHS.roadmap}`]).toString('utf8'); const escaped = tranche.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); const ids = [...new Set(roadmap.match(new RegExp(`\\bE-${escaped}-\\d{2}\\b`, 'gu')) ?? [])].sort(); if (ids.length === 0) fail('CORE_CHANGE_INTENT_PROOF_INVALID', `roadmap contains no exact evidence IDs for ${tranche}`); return ids; }
function reviewRoles(root, kind) {
  if (kind === 'r1-lock' || kind === 'routine-git-operation' || kind === 'project-migration') return [];
  const profile = parseJsonStrict(readFileSync(join(root, DELIVERY_PROFILE_PATH), 'utf8'));
  const workClass = kind === 'retained-evidence-acceptance' ? 'evidence-required' : 'renderer-behavior';
  const route = profile.reviewerRoutes?.[workClass];
  if (!Array.isArray(route) || route.some((role) => typeof role !== 'string' || role.length === 0)) fail('CORE_CHANGE_INTENT_REVIEW_INVALID', 'canonical delivery reviewer route is unavailable');
  return [...route];
}
function lockIdentity(root, value, target, fixed) {
  const lock = descriptor(value, 'operation.lock');
  if (!lock.path.startsWith('.git/core-ui-r1/')) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'lock must be an immutable task-local record');
  const bytes = readFileSync(taskPath(root, lock.path));
  if (bytes.byteLength !== lock.byteLength || sha256(bytes) !== lock.digest) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'lock record bytes changed');
  let record;
  try { record = parseJsonStrict(bytes.toString('utf8')); } catch (error) { fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'lock record is not canonical JSON', { cause: error.message }); }
  validateTrancheLockRecord(root, record, target, fixed);
  return lock;
}

function lockOwner(value, label) {
  object(value, label);
  const allowed = new Set(['path', 'selector', 'digest', 'sourceCommit', 'sourceTree']);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail('CORE_CHANGE_INTENT_LOCK_INVALID', `${label} contains unknown fields`);
  if (value.selector !== '/' || !SAFE_PATH.test(value.path) || !DIGEST.test(value.digest) || !HEX40.test(value.sourceCommit) || !HEX40.test(value.sourceTree)) fail('CORE_CHANGE_INTENT_LOCK_INVALID', `${label} is not an exact owner identity`);
  return value;
}

function expectedTrancheLock(root, target, fixed) {
  const owners = authority(root, fixed);
  return {
    profile: CHANGE_INTENT_LOCK_PROFILE,
    schemaVersion: CHANGE_INTENT_LOCK_SCHEMA_VERSION,
    target,
    authority: {
      decision: owners.decision,
      acceptance: owners.acceptance,
      architecture: owners.architecture,
      roadmap: owners.roadmap,
      productScope: owners.productScope,
    },
    snapshot: owners.snapshot,
    snapshotEnvelope: owners.snapshotEnvelope,
    baseline: owners.baseline,
    source: {
      authority: { commit: CHANGE_INTENT_BINDINGS.authority.commit, tree: CHANGE_INTENT_BINDINGS.authority.tree },
      stage1: { commit: CHANGE_INTENT_BINDINGS.stage1.commit, tree: CHANGE_INTENT_BINDINGS.stage1.tree },
      baseline: { commit: CHANGE_INTENT_BINDINGS.baseline.sourceCommit, tree: CHANGE_INTENT_BINDINGS.baseline.sourceTree },
    },
  };
}

function validateTrancheLockRecord(root, record, target, fixed) {
  const expected = expectedTrancheLock(root, target, fixed);
  const topKeys = new Set(['profile', 'schemaVersion', 'target', 'authority', 'snapshot', 'snapshotEnvelope', 'baseline', 'source']);
  exactObjectKeys(record, topKeys, 'operation.lock');
  if (canonicalJson(record) !== canonicalJson(expected)) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'lock record is not the exact accepted tranche lock');
  for (const key of ['decision', 'acceptance', 'architecture', 'roadmap', 'productScope']) lockOwner(record.authority[key], `operation.lock.authority.${key}`);
  for (const key of ['snapshot', 'snapshotEnvelope', 'baseline']) lockOwner(record[key], `operation.lock.${key}`);
  for (const key of ['authority', 'stage1', 'baseline']) {
    const source = record.source[key];
    if (!isObject(source) || !HEX40.test(source.commit) || !HEX40.test(source.tree) || Object.keys(source).some((item) => !['commit', 'tree'].includes(item))) fail('CORE_CHANGE_INTENT_LOCK_INVALID', `operation.lock.source.${key} is not an exact source binding`);
  }
  return record;
}

function exactObjectKeys(value, allowed, label) {
  object(value, label);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', `${label} contains unknown fields`, { unknown });
}
function envelopePreimage(envelope) { const { intentId, result, ...preimage } = envelope; void result; return preimage; }
function schemaType(value, type) { return type === 'null' ? value === null : type === 'object' ? isObject(value) : type === 'array' ? Array.isArray(value) : type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : type === 'boolean' ? typeof value === 'boolean' : type === 'string' ? typeof value === 'string' : false; }
function schemaCheck(schema, value, at, rootSchema, issues) {
  if (schema.$ref) {
    const target = schema.$ref.startsWith('#/$defs/') ? rootSchema.$defs[schema.$ref.slice('#/$defs/'.length)] : undefined;
    if (!target) issues.push(`${at} unresolved schema reference`);
    else schemaCheck(target, value, at, rootSchema, issues);
    return;
  }
  if (schema.oneOf) {
    let matches = 0;
    for (const branch of schema.oneOf) {
      const branchIssues = [];
      schemaCheck(branch, value, at, rootSchema, branchIssues);
      if (branchIssues.length === 0) matches += 1;
    }
    if (matches !== 1) issues.push(`${at} must match exactly one admitted grammar branch`);
  }
  if (schema.allOf) for (const branch of schema.allOf) schemaCheck(branch, value, at, rootSchema, issues);
  if (schema.if) {
    const conditionIssues = [];
    schemaCheck(schema.if, value, at, rootSchema, conditionIssues);
    if (conditionIssues.length === 0 && schema.then) schemaCheck(schema.then, value, at, rootSchema, issues);
    if (conditionIssues.length !== 0 && schema.else) schemaCheck(schema.else, value, at, rootSchema, issues);
  }
  if (schema.const !== undefined && canonicalJson(value) !== canonicalJson(schema.const)) issues.push(`${at} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => canonicalJson(item) === canonicalJson(value))) issues.push(`${at} must use an admitted value`);
  if (schema.type && ![].concat(schema.type).some((itemType) => schemaType(value, itemType))) {
    issues.push(`${at} has wrong type`);
    return;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push(`${at} is too short`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) issues.push(`${at} has invalid syntax`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(`${at} has too few items`);
    if (schema.uniqueItems && new Set(value.map((item) => canonicalJson(item))).size !== value.length) issues.push(`${at} contains duplicates`);
    if (schema.items) value.forEach((item, index) => schemaCheck(schema.items, item, `${at}/${index}`, rootSchema, issues));
  }
  if (isObject(value)) {
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) issues.push(`${at}/${required} is required`);
    const declared = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) {
      if (schema.additionalProperties === false && !declared.has(key)) issues.push(`${at}/${key} is unknown`);
      if (declared.has(key)) schemaCheck(schema.properties[key], value[key], `${at}/${key}`, rootSchema, issues);
    }
  }
}
export function validateChangeIntentEnvelope(value, { repositoryRoot, afterImages, expectedBase, expectedHead } = {}) {
  object(value, 'envelope');
  const root = resolve(repositoryRoot ?? MODULE_REPOSITORY_ROOT);
  const schema = parseJsonStrict(readFileSync(join(root, SCHEMA_PATH), 'utf8'));
  const issues = [];
  schemaCheck(schema, value, '$', schema, issues);
  if (issues.length) fail('CORE_CHANGE_INTENT_SCHEMA_INVALID', issues.join('; '), { issues });
  if (value.intentId !== sha256(canonicalJson(envelopePreimage(value)))) fail('CORE_CHANGE_INTENT_IDENTITY_MISMATCH', 'intentId is not derived from exact envelope preimage');
  const fixed = fixedInputs(root);
  const expectedAuthority = authority(root, fixed);
  for (const key of Object.keys(expectedAuthority)) sameIdentity(value.authority[key], expectedAuthority[key], `authority.${key}`);
  const selected = familyEntry(fixed, value.objective?.target?.family);
  for (const field of ['scopeId', 'tranche', 'source']) if (value.objective.target[field] !== selected[field]) fail('CORE_CHANGE_INTENT_LOCK_INVALID', `target ${field} does not match fixed Stage1 family entry`);
  if (value.objective.statement !== `Prepare ${value.operation.kind} for ${selected.family}`) fail('CORE_CHANGE_INTENT_OBJECTIVE_INVALID', 'objective is not canonical');
  const { operation, kind, effectClass, transition } = operationInput({ operation: value.operation });
  if (value.operation.effectClass !== effectClass) fail('CORE_CHANGE_INTENT_EFFECT_INVALID', 'effect class is not derived from operation kind');
  if (kind === 'retained-evidence-acceptance' && (value.operation.evidence === undefined || value.proposal.afterImages.length === 0 || !value.proposal.afterImages.some((image) => canonicalJson(image) === canonicalJson(value.operation.evidence)))) {
    fail('CORE_CHANGE_INTENT_EVIDENCE_INVALID', 'retained evidence operation must bind its exact index after-image');
  }
  if ((kind === 'component-implementation' || kind === 'retained-evidence-acceptance') && !value.operation.lock) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'component/evidence operation omits its exact tranche lock');
  if (value.operation.lock) lockIdentity(root, value.operation.lock, value.objective.target, fixed);
  const facts = canonicalDerivedFacts(root, value, { fixed, afterImages, expectedBase });
  if (value.result !== undefined && canonicalJson(value.result) !== canonicalJson(completedResult(root, value.result, value, kind, expectedBase, expectedHead))) fail('CORE_CHANGE_INTENT_RESULT_INVALID', 'completed result is not the exact canonical record for the current checkout');
  const expectedOwners = facts.ownerRows.map(({ path: itemPath, owner, selector, source: ownerSource, recordId }) => ({ path: itemPath, owner, selector, source: ownerSource, recordId }));
  if (canonicalJson(value.owners) !== canonicalJson(expectedOwners)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'owners are not the complete canonical owner closure');
  const expectedWriteSet = kind === 'r1-lock' || kind === 'project-migration' ? [] : facts.ownerRows.map(({ path: itemPath, owner, effect, recordId }) => ({ path: itemPath, owner, effect, recordId }));
  if (canonicalJson(value.writeSet) !== canonicalJson(expectedWriteSet)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'write set is not the complete canonical owner closure');
  if (canonicalJson(value.affected) !== canonicalJson(facts.closure)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'affected closure or stale proof is not canonical');
  const expectedEffect = { version: { content: contentVersionEffect(kind, facts.semantic), binding: 'none', package: 'none' }, rollback: ['restore exact recorded base and remove only recorded write set'], recovery: ['invalidate on authority, lock, source, worktree, patch, after-image, dependency, graph, proof, disclosure, review, or base drift'] };
  if (canonicalJson(value.effects) !== canonicalJson(expectedEffect)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'effects are not canonical');
  if (canonicalJson(value.checks) !== canonicalJson(facts.checks)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'required checks are not canonical');
  const expectedReview = { roles: reviewRoles(root, kind) };
  if (canonicalJson(value.review) !== canonicalJson(expectedReview)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'review route is not canonical');
  if (canonicalJson(value.invalidation) !== canonicalJson(CANONICAL_INVALIDATION)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'invalidation policy is not canonical');
  const expectedReadiness = { retrieval: 'unknown', generation: facts.closure.projections.length ? 'unknown' : 'not-applicable', migration: kind === 'project-migration' ? 'unknown' : 'not-applicable' };
  if (canonicalJson(value.readiness) !== canonicalJson(expectedReadiness)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'readiness is not canonical');
  const expectedConfirmation = { required: true, effects: [effectClass] };
  if (canonicalJson(value.confirmation) !== canonicalJson(expectedConfirmation)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'confirmation policy is not canonical');
  void operation;
  void transition;
  return Object.freeze(value);
}
async function loadAuthoring(root) {
  const catalog = parseJsonStrict(readFileSync(join(root, 'packages/catalog/generated/catalog.json'), 'utf8'));
  const context = await loadRepositoryAuthoringContext({ repositoryRoot: root, expectedSourceRevision: catalog.sourceRevision });
  for (const projection of context.repositoryPolicy.strictJsonProjections ?? []) {
    await validateGeneratedFile(root, projection.path, context.repositoryPolicy);
  }
  return context;
}

function validationWorkspacePackages(root) {
  const files = git(root, ['ls-files', '--', 'apps/**/package.json', 'packages/**/package.json', 'tooling/**/package.json']).split('\n').filter(Boolean);
  return files.map((filePath) => ({
    name: parseJsonStrict(readFileSync(join(root, filePath), 'utf8')).name,
    path: filePath.replace(/\/package\.json$/u, ''),
    manifest: parseJsonStrict(readFileSync(join(root, filePath), 'utf8')),
  })).filter(({ name }) => typeof name === 'string').sort((left, right) => left.path.localeCompare(right.path));
}

function validationContext(root, sourceCommit) {
  const readCanonicalJson = (itemPath) => sourceCommit
    ? parseJsonStrict(gitBytes(root, ['show', `${sourceCommit}:${itemPath}`]).toString('utf8'))
    : parseJsonStrict(readFileSync(join(root, itemPath), 'utf8'));
  const sourceManifest = readCanonicalJson('packages/catalog/catalog-sources.json');
  const catalogBundle = readCanonicalJson('packages/catalog/generated/catalog.json');
  const repositoryPolicy = parseJsonStrict(readFileSync(join(root, 'tooling/audits/repository-policy/repository-policy.json'), 'utf8'));
  const typeProjection = parseJsonStrict(readFileSync(join(root, 'packages/schema/schemas/type-projection.json'), 'utf8'));
  return {
    sourceRevision: catalogBundle.sourceRevision,
    sourceManifestPath: 'packages/catalog/catalog-sources.json',
    catalogBundlePath: 'packages/catalog/generated/catalog.json',
    repositoryPolicyPath: 'tooling/audits/repository-policy/repository-policy.json',
    typeProjectionPath: 'packages/schema/schemas/type-projection.json',
    sourceManifest,
    catalogBundle,
    repositoryPolicy,
    typeProjection,
    workspacePackages: validationWorkspacePackages(root),
  };
}

function validationAfterImages(root, envelope, supplied) {
  const byPath = new Map((supplied ?? []).map((image) => [image.path, image]));
  return envelope.proposal.afterImages.map((descriptorValue) => {
    const provided = byPath.get(descriptorValue.path);
    if (provided) return provided;
    try { return { path: descriptorValue.path, bytes: readFileSync(join(root, descriptorValue.path)) }; }
    catch { fail('CORE_CHANGE_INTENT_AFTER_IMAGE_MISSING', `${descriptorValue.path} bytes are unavailable for canonical validation`); }
  });
}

function canonicalDerivedFacts(root, envelope, { context = validationContext(root, envelope.source?.commit), fixed = fixedInputs(root), afterImages, expectedBase } = {}) {
  const kind = envelope.operation.kind;
  const target = envelope.objective.target;
  const images = validationAfterImages(root, envelope, afterImages);
  const normalizedImages = normalizeImages(images, 'validation.afterImages');
  if (canonicalJson(normalizedImages) !== canonicalJson(envelope.proposal.afterImages)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'envelope after-images are not the exact canonical bytes');
  validateSourceBinding(root, envelope.source, kind, expectedBase);
  const expectedBeforeImages = sourceBeforeImages(root, envelope.source.commit, normalizedImages);
  if (!Array.isArray(envelope.proposal.beforeImages) || canonicalJson(envelope.proposal.beforeImages) !== canonicalJson(expectedBeforeImages)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'before-images are not derived from the exact source tree');
  const expectedPatch = canonicalPatchIdentity(expectedBeforeImages, normalizedImages);
  if (canonicalJson(envelope.proposal.patch) !== canonicalJson(expectedPatch)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'proposal patch is not derived from exact before/after images');
  const current = currentRecords(context);
  const proposedInput = proposedRecords(root, context, images, target.family, envelope.source.commit);
  const proposed = canonicalizeProposedRecords([...new Map(proposedInput.records.filter(Boolean).map((record) => [record.id, record])).values()], current.map(({ value }) => value));
  if (proposed.length) {
    try { validateCatalogRecords(proposed, current.map(({ value }) => value)); }
    catch (error) { fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'canonical proposed owner graph is invalid', { cause: error.message }); }
  }
  const sourcePaths = normalizedImages.map(({ path: itemPath }) => itemPath);
  const currentSourcePaths = sourcePaths.filter((itemPath) => declaredSourceEntry(context, itemPath));
  const currentIds = new Set(current.map(({ id }) => id));
  const currentArtifactIds = proposed.map(({ id }) => id).filter((id) => currentIds.has(id));
  const canonicalClosure = currentSourcePaths.length ? affectedClosure({ context, sourcePaths: currentSourcePaths, artifactIds: currentArtifactIds }) : null;
  const proposedClosure = localProposedGraph(context, proposed, current, sourcePaths, currentArtifactIds);
  const proofIds = roadmapProofIds(root, target.tranche);
  const checked = checksForClosure(proposedClosure, kind, proofIds);
  const recordsByPath = new Map(images.map((image, index) => [image.path, proposedInput.records[index] ?? null]));
  const ownerRows = normalizedImages.map((image) => ownerForImage(context, image, recordsByPath.get(image.path), checked.closure, kind));
  const proposedAfter = proposed.find((value) => value?.name === target.family);
  const canonicalBefore = current.find(({ value }) => value?.name === target.family)?.value;
  let semantic;
  if (canonicalBefore && proposedAfter) {
    try {
      semantic = semanticDiff({
        family: 'component',
        before: canonicalBefore,
        after: proposedAfter,
        revisionContext: semanticRevisionContext(root, context, canonicalBefore),
      });
    }
    catch (error) { fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'canonical semantic diff rejected the proposed record', { cause: error.message }); }
  }
  return { target, images: normalizedImages, beforeImages: expectedBeforeImages, patch: expectedPatch, proposed, closure: checked.closure, checks: checked.checks, ownerRows, semantic, canonicalClosure };
}
async function produceChangeIntentEnvelope({ repositoryRoot, ...input } = {}) {
  const root = resolve(repositoryRoot ?? MODULE_REPOSITORY_ROOT);
  const { operation, kind, effectClass, transition } = operationInput(input);
  for (const field of ['version', 'versionEffect', 'proof', 'staleProof', 'owner']) if (Object.hasOwn(input, field)) fail('CORE_CHANGE_INTENT_DERIVED_FIELD_INVALID', `caller-selected ${field} is not accepted`);
  const completedInput = operation.completedResult ?? input.completedResult ?? input.result;
  const source = sourceState(root, kind, { completed: completedInput !== undefined });
  const fixed = fixedInputs(root);
  const liveContext = await loadAuthoring(root);
  const context = completedInput !== undefined ? validationContext(root, source.commit) : liveContext;
  const proposalInput = operation.proposal ?? input.proposal ?? {};
  object(proposalInput, 'proposal');
  const rawAfter = operation.afterImages ?? input.afterImages ?? proposalInput.afterImages;
  const afterImages = kind === 'r1-lock' && rawAfter === undefined ? [] : normalizeImages(rawAfter, 'proposal.afterImages');
  const derivedBeforeImages = sourceBeforeImages(root, source.commit, afterImages);
  const suppliedBeforeImages = operation.beforeImages ?? input.beforeImages ?? proposalInput.beforeImages;
  if (suppliedBeforeImages !== undefined && canonicalJson(normalizeImages(suppliedBeforeImages, 'proposal.beforeImages')) !== canonicalJson(derivedBeforeImages)) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'caller before-images do not match the exact source tree');
  const beforeImages = derivedBeforeImages;
  if (Object.hasOwn(operation, 'writeSet') || Object.hasOwn(input, 'writeSet') || Object.hasOwn(operation, 'owners') || Object.hasOwn(input, 'owners')) fail('CORE_CHANGE_INTENT_OWNER_CONFLICT', 'caller-supplied owners/writeSet are never accepted');
  if (kind !== 'r1-lock' && afterImages.length === 0) fail('CORE_CHANGE_INTENT_PROPOSAL_MISSING', 'non-explanation operation requires proposed after-images');
  const target = deriveTarget(fixed, operation, input);
  const current = currentRecords(context);
  const proposedSourceImages = rawAfter === undefined ? afterImages : [...rawAfter].sort((left, right) => left.path.localeCompare(right.path));
  const proposedInput = proposedRecords(root, context, proposedSourceImages, target.family, source.commit);
  const proposed = canonicalizeProposedRecords([...new Map(proposedInput.records.filter(Boolean).map((record) => [record.id, record])).values()], current.map(({ value }) => value));
  if (kind !== 'retained-evidence-acceptance' && afterImages.length > 0 && proposed.length === 0) fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'validated canonical after-images are required; filename inference is forbidden');
  if (proposed.length) { try { validateCatalogRecords(proposed, current.map(({ value }) => value)); } catch (error) { fail('CORE_CHANGE_INTENT_PROPOSAL_INVALID', 'proposed owner graph is invalid', { cause: error.message }); } }
  const proofIds = roadmapProofIds(root, target.tranche);
  const currentIds = new Set(current.map(({ id }) => id));
  const sourcePaths = afterImages.map(({ path: itemPath }) => itemPath);
  const currentSourcePaths = sourcePaths.filter((itemPath) => declaredSourceEntry(context, itemPath));
  const currentArtifactIds = proposed.map(({ id }) => id).filter((id) => currentIds.has(id));
  const canonicalClosure = currentSourcePaths.length ? affectedClosure({ context, sourcePaths: currentSourcePaths, artifactIds: currentArtifactIds }) : null;
  const proposedClosure = localProposedGraph(context, proposed, current, sourcePaths, currentArtifactIds);
  const checked = checksForClosure(proposedClosure, kind, proofIds);
  const closure = checked.closure;
  const recordsByPath = new Map(afterImages.map((image, index) => [image.path, proposedInput.records[index] ?? null]));
  const ownerRows = afterImages.map((image) => ownerForImage(context, image, recordsByPath.get(image.path), closure, kind));
  const paths = ownerRows.map(({ path: itemPath }) => itemPath).sort();
  const patch = canonicalPatchIdentity(beforeImages, afterImages);
  const patchSource = proposalInput.patch ?? operation.patch;
  if (patchSource !== undefined && (patchSource.bytes === undefined || canonicalJson(identity('proposal.patch', bytesOf(patchSource.bytes, 'proposal.patch.bytes'))) !== canonicalJson(patch))) fail('CORE_CHANGE_INTENT_DERIVATION_INVALID', 'caller patch does not match the canonical before/after change set');
  const lock = operation.lock ? lockIdentity(root, operation.lock, target, fixed) : undefined;
  if ((kind === 'component-implementation' || kind === 'retained-evidence-acceptance') && !lock) fail('CORE_CHANGE_INTENT_LOCK_INVALID', 'component/evidence operations require exact task-local lock bytes');
  const evidence = operation.evidence ? descriptor(operation.evidence, 'operation.evidence') : undefined;
  if (kind === 'retained-evidence-acceptance' && (!evidence || afterImages.length === 0 || !afterImages.some((image) => canonicalJson(image) === canonicalJson(evidence)))) {
    fail('CORE_CHANGE_INTENT_EVIDENCE_INVALID', 'retained evidence operation must bind its exact index after-image');
  }
  if (operation.beforeRecord !== undefined || operation.afterRecord !== undefined || operation.familyKind !== undefined) fail('CORE_CHANGE_INTENT_SEMANTIC_DIFF_INVALID', 'caller-supplied semantic records or family kind are not accepted');
  const proposedAfter = proposed.find((value) => value.name === target.family);
  const canonicalBefore = current.find(({ value }) => value?.name === target.family)?.value;
  let semantic;
  if (canonicalBefore && proposedAfter) {
    try {
      semantic = semanticDiff({
        family: 'component',
        before: canonicalBefore,
        after: proposedAfter,
        revisionContext: semanticRevisionContext(root, context, canonicalBefore),
      });
    } catch (error) {
      fail('CORE_CHANGE_INTENT_SEMANTIC_DIFF_INVALID', 'canonical semantic diff rejected proposed records', { cause: error.message });
    }
  }
  const expectedObjective = `Prepare ${kind} for ${target.family}`;
  if (operation.objective !== undefined && operation.objective !== expectedObjective) fail('CORE_CHANGE_INTENT_OBJECTIVE_INVALID', 'caller-selected objective is not canonical');
  if (input.objective !== undefined && input.objective !== expectedObjective) fail('CORE_CHANGE_INTENT_OBJECTIVE_INVALID', 'caller-selected objective is not canonical');
  const envelope = { profile: PROFILE, schemaVersion: SCHEMA_VERSION, intentId: `sha256:${'0'.repeat(64)}`, authority: authority(root, fixed), objective: { statement: expectedObjective, target }, operation: { kind, effectClass, ...(operation.action ? { action: operation.action } : {}), ...(transition ? { transition } : {}), ...(lock ? { lock } : {}), ...(evidence ? { evidence } : {}) }, source, proposal: { patch, afterImages, beforeImages }, owners: ownerRows.map(({ path: itemPath, owner, selector, source: ownerSource, recordId }) => ({ path: itemPath, owner, selector, source: ownerSource, recordId })), writeSet: kind === 'r1-lock' || kind === 'project-migration' ? [] : ownerRows.map(({ path: itemPath, owner, effect, recordId }) => ({ path: itemPath, owner, effect, recordId })), affected: closure, effects: { version: { content: contentVersionEffect(kind, semantic), binding: 'none', package: 'none' }, rollback: ['restore exact recorded base and remove only recorded write set'], recovery: ['invalidate on authority, lock, source, worktree, patch, after-image, dependency, graph, proof, disclosure, review, or base drift'] }, checks: checked.checks, review: { roles: reviewRoles(root, kind) }, readiness: { retrieval: 'unknown', generation: closure.projections.length ? 'unknown' : 'not-applicable', migration: kind === 'project-migration' ? 'unknown' : 'not-applicable' }, invalidation: CANONICAL_INVALIDATION, confirmation: { required: true, effects: [effectClass] } };
  envelope.intentId = sha256(canonicalJson(envelopePreimage(envelope)));
  if (completedInput !== undefined) envelope.result = completedResult(root, completedInput, envelope, kind, source.commit);
  validateChangeIntentEnvelope(envelope, { repositoryRoot: root, afterImages: rawAfter ?? [], expectedBase: source.commit });
  const bytes = canonicalChangeIntentBytes(envelope, { repositoryRoot: root, afterImages: rawAfter ?? [], expectedBase: source.commit });
  return Object.freeze({ envelope: Object.freeze(envelope), bytes, identity: changeIntentIdentity(bytes), writeSet: paths, affected: closure, canonicalClosure });
}
export async function deriveChangeIntentEnvelope(input = {}) { return produceChangeIntentEnvelope(input); }
export const previewChangeIntentEnvelope = deriveChangeIntentEnvelope;
export const createChangeIntentEnvelope = deriveChangeIntentEnvelope;
export const createChangeIntent = deriveChangeIntentEnvelope;
export function canonicalChangeIntentBytes(value, options = {}) { validateChangeIntentEnvelope(value, options); return Buffer.from(canonicalJson(value), 'utf8'); }
export function changeIntentIdentity(value, options = {}) { const bytes = Buffer.isBuffer(value) ? value : canonicalChangeIntentBytes(value, options); return { algorithm: 'sha256', digest: sha256(bytes), byteLength: bytes.byteLength }; }
export function parseChangeIntentBytes(bytes, { repositoryRoot, expectedBase, expectedHead } = {}) { const source = bytesOf(bytes, 'envelope bytes'); let value; try { value = parseJsonStrict(source.toString('utf8')); } catch (error) { fail('CORE_CHANGE_INTENT_RECORD_INVALID', error.message); } if (canonicalJson(value) !== source.toString('utf8')) fail('CORE_CHANGE_INTENT_RECORD_NONCANONICAL', 'envelope bytes must be canonical JSON without trailing LF'); validateChangeIntentEnvelope(value, { repositoryRoot, expectedBase, expectedHead }); return value; }
function taskPath(root, itemPath) {
  if (!itemPath.startsWith('.git/core-ui-r1/')) fail('CORE_CHANGE_INTENT_PATH_INVALID', 'record must remain under task-local .git/core-ui-r1');
  const taskRoot = realpathSync(resolve(root, git(root, ['rev-parse', '--git-path', 'core-ui-r1'])));
  const absolute = resolve(taskRoot, itemPath.slice('.git/core-ui-r1/'.length));
  if (!absolute.startsWith(`${taskRoot}/`)) fail('CORE_CHANGE_INTENT_PATH_INVALID', 'record escapes task-local root');
  let stat;
  try { stat = lstatSync(absolute); } catch (error) { fail('CORE_CHANGE_INTENT_PATH_INVALID', 'task-local record is unavailable', { cause: error.message }); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('CORE_CHANGE_INTENT_PATH_INVALID', 'task-local record must be a regular non-symlink file');
  const real = realpathSync(absolute);
  if (!real.startsWith(`${taskRoot}/`)) fail('CORE_CHANGE_INTENT_PATH_INVALID', 'task-local record resolves outside its root');
  return real;
}
export function readChangeIntentRecord(repositoryRoot, record) { const root = resolve(repositoryRoot); const value = descriptor(record, 'change intent record'); const bytes = readFileSync(taskPath(root, value.path)); if (bytes.byteLength !== value.byteLength || sha256(bytes) !== value.digest) fail('CORE_CHANGE_INTENT_IDENTITY_MISMATCH', 'task-local record bytes changed'); return parseChangeIntentBytes(bytes, { repositoryRoot: root }); }
export function recordDescriptor(itemPath, bytes) { return identity(itemPath, bytes, 'record'); }
