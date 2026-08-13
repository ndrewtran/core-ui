import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { canonicalJson } from '../../tooling/audits/repository-policy/src/canonical-json.mjs';
import {
  assertApplicabilitySupersessionShape,
  assertApplicabilitySupersessionReference,
} from '../../tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs';

const execFile = promisify(execFileCallback);

export const REVIEW_READINESS_ROOT = 'tests/evidence/authority-58-delivery-review-readiness-applicability-v1';
export const REVIEW_READINESS_DECISION = 'decisions/0009-delivery-review-readiness.json';
export const REVIEW_READINESS_ACCEPTANCE = 'decisions/0009-delivery-review-readiness-acceptance.json';
export const REVIEW_READINESS_PREDECESSOR_ROOT = 'tests/evidence/authority-11-g1-2-applicability-v1';
export const REVIEW_READINESS_ACCEPTED_BASE = '7ede0cbb758b8306ecab1a7cdcec55a1b3505a64';
export const REVIEW_READINESS_SOURCE = '63dee2c988759ec803f71a0353a6630bf612826c';
export const REVIEW_READINESS_EVIDENCE = '082b93fdf6f1e279f5a6e32372f43d553df7852c';
export const REVIEW_READINESS_PROTECTED_MERGE = '4ff5f4b8e08e3735febe46c639e760b1da269777';
export const REVIEW_READINESS_PLAN_SHA256 = 'sha256:43a7b1724b4e107e253703952ac4839f7c99880f4b96e56b8e73e56de1aded7d';
export const REVIEW_READINESS_TASK_ID = '019ff5d8-5a4b-7252-958d-bab8b0087c34';
export const REVIEW_READINESS_REPLACEMENT_PLAN = [
  'E-DELIVERY-01', 'E-DELIVERY-02', 'E-DELIVERY-03', 'E-DELIVERY-04',
  'E-DELIVERY-05', 'E-DELIVERY-06', 'E-DELIVERY-07', 'E-DELIVERY-08',
];
export const REVIEW_READINESS_TARGETS = [
  'default-theme-g1.0', 'default-theme-g1.1', 'g0.1', 'g0.2', 'g0.3', 'g0.4', 'g0.5', 'g1.0', 'g1.1', 'g1.2', 'gate-0',
  'tale-token-phase-a-g0.1', 'tale-token-phase-a-g0.2', 'tale-token-phase-a-g0.3', 'tale-token-phase-a-g0.4', 'tale-token-phase-a-g0.5', 'tale-token-phase-a-gate-0',
  'tale-token-phase-b-g0.1', 'tale-token-phase-b-g0.2', 'tale-token-phase-b-g0.3', 'tale-token-phase-b-g0.4', 'tale-token-phase-b-g0.5', 'tale-token-phase-b-gate-0',
  'tale-token-phase-c-g0.1', 'tale-token-phase-c-g0.2', 'tale-token-phase-c-g0.3', 'tale-token-phase-c-g0.4', 'tale-token-phase-c-g0.5', 'tale-token-phase-c-gate-0',
];

export async function resolveReviewReadinessSourceIdentity(repositoryRoot) {
  const head = (await git(repositoryRoot, ['rev-parse', 'HEAD'])).trim();
  const historicalIdentity = {
    applicability: 'not-evaluated',
    sourceRevision: REVIEW_READINESS_SOURCE,
    sourceTree: '7ff715b1f7585af00a46474ed6840717d38353d6',
  };

  const [mergeParents, evidenceParents, mergeTree, evidenceTree, sourceTree] = await Promise.all([
    gitValue(repositoryRoot, ['show', '-s', '--format=%P', REVIEW_READINESS_PROTECTED_MERGE], 'protected merge parents'),
    gitValue(repositoryRoot, ['show', '-s', '--format=%P', REVIEW_READINESS_EVIDENCE], 'evidence child parent'),
    gitValue(repositoryRoot, ['rev-parse', `${REVIEW_READINESS_PROTECTED_MERGE}^{tree}`], 'protected merge tree'),
    gitValue(repositoryRoot, ['rev-parse', `${REVIEW_READINESS_EVIDENCE}^{tree}`], 'evidence child tree'),
    gitValue(repositoryRoot, ['rev-parse', `${REVIEW_READINESS_SOURCE}^{tree}`], 'historical source tree'),
  ]);
  if (mergeParents !== `${REVIEW_READINESS_ACCEPTED_BASE} ${REVIEW_READINESS_EVIDENCE}`
      || evidenceParents !== REVIEW_READINESS_SOURCE
      || mergeTree !== '5b4e2aa4191abc77a4dd13435777242e702e79bf'
      || evidenceTree !== '5b4e2aa4191abc77a4dd13435777242e702e79bf'
      || sourceTree !== historicalIdentity.sourceTree) {
    fail('protected Decision 0009 history does not match the accepted topology');
  }

  if ([REVIEW_READINESS_SOURCE, REVIEW_READINESS_EVIDENCE].includes(head)) return historicalIdentity;

  if (head !== REVIEW_READINESS_PROTECTED_MERGE
      && !(await isAncestor(repositoryRoot, REVIEW_READINESS_PROTECTED_MERGE, head))) {
    fail('evaluated revision must descend from the protected Decision 0009 merge');
  }

  const [decisionSha256, acceptanceSha256, evidenceRootTree] = await Promise.all([
    contentSha256At(repositoryRoot, head, REVIEW_READINESS_DECISION, 'Decision 0009 record'),
    contentSha256At(repositoryRoot, head, REVIEW_READINESS_ACCEPTANCE, 'Decision 0009 acceptance receipt'),
    gitValue(repositoryRoot, ['rev-parse', `${head}:${REVIEW_READINESS_ROOT}`], 'authority-58 evidence root'),
  ]);
  if (decisionSha256 !== 'sha256:bab49f8c9fde54ccbbab9e1db6196d2e1972b8b7085d053c0efe684d654a1419') {
    fail('Decision 0009 record identity does not match the accepted bytes');
  }
  if (acceptanceSha256 !== 'sha256:563011b263a0f5f697673fedcab11560b8c37387432d80cfdfbeec069ccfa6dd') {
    fail('Decision 0009 acceptance receipt identity does not match the accepted bytes');
  }
  if (evidenceRootTree !== 'a2175fc53bc0e283f89deb870f1d92aada69bfd3') {
    fail('authority-58 evidence root does not match the retained tree');
  }

  return historicalIdentity;
}

const SHA = /^sha256:[0-9a-f]{64}$/u;
const GIT = /^[0-9a-f]{40}$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const sha256Digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const parseJsonStrict = (value) => JSON.parse(value);

function fail(message) {
  throw new Error(`DELIVERY_REVIEW_READINESS_PROFILE_INVALID: ${message}`);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(`${label} has the wrong fields`);
  }
}

function canonicalBytes(value) {
  return canonicalJson(value);
}

async function readCanonical(path) {
  const bytes = await readFile(path, 'utf8');
  const value = parseJsonStrict(bytes);
  if (canonicalBytes(value) !== bytes) fail(`${path} is not canonical evidence JSON`);
  return { bytes, value };
}

async function git(repositoryRoot, args, encoding = 'utf8') {
  return (await execFile('git', args, { cwd: repositoryRoot, encoding, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

async function gitValue(repositoryRoot, args, label) {
  try {
    return (await git(repositoryRoot, args)).trim();
  } catch {
    fail(`${label} is missing or unreadable`);
  }
}

async function isAncestor(repositoryRoot, ancestor, descendant) {
  try {
    await git(repositoryRoot, ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch (error) {
    if (error?.code === 1) return false;
    fail('protected Decision 0009 ancestry is missing or unreadable');
  }
}

async function contentSha256At(repositoryRoot, revision, path, label) {
  try {
    return sha256Digest(await git(repositoryRoot, ['show', `${revision}:${path}`], 'buffer'));
  } catch {
    fail(`${label} is missing or unreadable`);
  }
}

async function manifestAtRevision(repositoryRoot, revision, paths) {
  const names = await git(repositoryRoot, ['ls-tree', '-r', '-z', '--name-only', revision, '--', ...paths], 'buffer');
  const entries = [];
  for (const path of names.toString('utf8').split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right))) {
    const bytes = await git(repositoryRoot, ['show', `${revision}:${path}`], 'buffer');
    entries.push({ path, sha256: sha256Digest(bytes) });
  }
  return {
    algorithm: 'sha256',
    paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: sha256Digest(canonicalJson(entries)),
  };
}

async function g12Predecessor(repositoryRoot) {
  const indexPath = 'tests/evidence/g1.2/index.json';
  const index = await readCanonical(join(repositoryRoot, indexPath));
  if (index.value.records.length !== 5) fail('G1.2 predecessor must retain five records');
  const records = await Promise.all(index.value.records.map(({ path, sha256 }) => readCanonical(join(repositoryRoot, path)).then((record) => {
    if (sha256Digest(record.bytes) !== sha256) fail(`G1.2 predecessor record digest mismatch: ${path}`);
    return record.value;
  })));
  const manifests = records.map(({ applicabilityManifest }) => canonicalJson(applicabilityManifest));
  if (new Set(manifests).size !== 1) fail('G1.2 predecessor applicability is not uniform');
  return {
    affectedAssertions: records.map(({ assertionId }) => assertionId).sort(),
    historicalIndex: { path: indexPath, sha256: sha256Digest(index.bytes) },
    milestone: 'G1.2',
    previousSupersession: undefined,
    replacementPlan: [...REVIEW_READINESS_REPLACEMENT_PLAN, ...records.map(({ assertionId }) => assertionId).sort()],
    supersededApplicabilityManifest: records[0].applicabilityManifest,
  };
}

async function existingPredecessor(repositoryRoot, target) {
  const path = `${REVIEW_READINESS_PREDECESSOR_ROOT}/supersessions/${target}.json`;
  const predecessor = await readCanonical(join(repositoryRoot, path));
  assertApplicabilitySupersessionShape(predecessor.value, fail);
  return {
    affectedAssertions: predecessor.value.affectedAssertions,
    historicalIndex: predecessor.value.historicalIndex,
    milestone: target.endsWith('gate-0') || target === 'gate-0' ? 'Gate 0 exit' : predecessor.value.affectedAssertions[0].replace(/^E-([A-Z0-9.]+)-.*$/u, '$1'),
    previousSupersession: { path, sha256: sha256Digest(predecessor.bytes) },
    replacementPlan: predecessor.value.replacementPlan,
    supersededApplicabilityManifest: predecessor.value.currentApplicabilityManifest,
  };
}

export async function reviewReadinessTargetManifest(repositoryRoot) {
  const targets = [];
  for (const target of REVIEW_READINESS_TARGETS) {
    const predecessor = target === 'g1.2'
      ? await g12Predecessor(repositoryRoot)
      : await existingPredecessor(repositoryRoot, target);
    targets.push({
      action: 'supersede',
      evidenceStatus: 'superseded',
      name: target,
      predecessor,
      replacementStatus: 'pending',
      successorPath: `${REVIEW_READINESS_ROOT}/supersessions/${target}.json`,
    });
  }
  return targets;
}

export async function buildReviewReadinessRoot(repositoryRoot, { sourceRevision, sourceTree, timestamp }) {
  if (!GIT.test(sourceRevision) || !GIT.test(sourceTree) || !RFC3339.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    fail('source, tree, or capture timestamp is malformed');
  }
  const receipt = await readCanonical(join(repositoryRoot, REVIEW_READINESS_ACCEPTANCE));
  assertReviewReadinessAcceptance(receipt.value);
  const authorization = { path: REVIEW_READINESS_ACCEPTANCE, sha256: sha256Digest(receipt.bytes) };
  const targets = await reviewReadinessTargetManifest(repositoryRoot);
  const files = new Map();
  const supersessions = [];
  for (const target of targets) {
    const currentApplicabilityManifest = await manifestAtRevision(
      repositoryRoot,
      sourceRevision,
      target.predecessor.supersededApplicabilityManifest.paths,
    );
    if (currentApplicabilityManifest.sha256 === target.predecessor.supersededApplicabilityManifest.sha256) {
      fail(`${target.name} did not change applicability`);
    }
    const value = {
      affectedAssertions: target.predecessor.affectedAssertions,
      authorization,
      currentApplicabilityManifest,
      disclosureClass: 'public-sanitized',
      effectiveAt: timestamp,
      evidenceStatus: target.evidenceStatus,
      historicalIndex: target.predecessor.historicalIndex,
      owner: 'ndrewtran',
      ...(target.predecessor.previousSupersession ? { previousSupersession: target.predecessor.previousSupersession } : {}),
      reasonCode: 'governing-authority-changed',
      replacementPlan: target.predecessor.replacementPlan,
      replacementStatus: target.replacementStatus,
      schema: 'core-ui-evidence-applicability-supersession-v1',
      sourceRevision,
      sourceTree,
      supersededApplicabilityManifest: target.predecessor.supersededApplicabilityManifest,
    };
    assertApplicabilitySupersessionShape(value, fail);
    const bytes = canonicalBytes(value);
    files.set(target.successorPath, bytes);
    supersessions.push({ milestone: target.predecessor.milestone, path: target.successorPath, sha256: sha256Digest(bytes) });
  }
  supersessions.forEach((reference) => assertApplicabilitySupersessionReference(reference, fail));
  const index = {
    records: [],
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    supersessions,
  };
  files.set(`${REVIEW_READINESS_ROOT}/index.json`, canonicalBytes(index));
  return files;
}

export function assertReviewReadinessAcceptance(value) {
  exactKeys(value, [
    'candidate', 'decisionId', 'issueNumber', 'manifest', 'outcome', 'owner', 'plan',
    'provider', 'repository', 'schema', 'taskProvenance',
  ], 'acceptance receipt');
  if (value.schema !== 'core-ui-task-provenance-authority-acceptance-v1'
      || value.decisionId !== 'core-ui:decision:0009'
      || value.issueNumber !== 58
      || value.outcome !== 'accepted'
      || value.owner !== 'ndrewtran'
      || value.provider !== 'codex-task'
      || value.repository !== 'ndrewtran/core-ui') fail('acceptance receipt identity is wrong');
  exactKeys(value.plan, ['path', 'sha256'], 'acceptance plan');
  if (value.plan.path !== '/tmp/core-ui-review-readiness-proposal-v1.final.md'
      || value.plan.sha256 !== REVIEW_READINESS_PLAN_SHA256) fail('acceptance plan identity is wrong');
  exactKeys(value.taskProvenance, ['approvalInstruction', 'approvalTimestamp', 'githubCommentClaimed', 'taskId'], 'task provenance');
  if (value.taskProvenance.taskId !== REVIEW_READINESS_TASK_ID
      || value.taskProvenance.approvalInstruction !== 'exact-plan-approved-for-bounded-execution'
      || value.taskProvenance.approvalTimestamp !== null
      || value.taskProvenance.githubCommentClaimed !== false) fail('task provenance is not truthful');
  exactKeys(value.candidate, ['byteLength', 'path', 'sha256'], 'acceptance candidate');
  exactKeys(value.manifest, ['entryCount', 'profile', 'sha256'], 'accepted manifest');
  if (value.candidate.path !== REVIEW_READINESS_DECISION || !SHA.test(value.candidate.sha256)
      || value.manifest.profile !== 'core-ui-proposed-source-artifact-manifest-v1'
      || !SHA.test(value.manifest.sha256)) fail('accepted candidate or manifest is malformed');
}

export async function assertReviewReadinessRoot(repositoryRoot, rootPath = join(repositoryRoot, REVIEW_READINESS_ROOT)) {
  const index = await readCanonical(join(rootPath, 'index.json'));
  if (index.value.schema !== 'core-ui-evidence-index-v1' || index.value.records.length !== 0
      || index.value.supersessions.length !== REVIEW_READINESS_TARGETS.length) fail('continuation index shape is wrong');
  const expectedPaths = new Set(['index.json', ...REVIEW_READINESS_TARGETS.map((name) => `supersessions/${name}.json`)]);
  async function walk(directory, prefix = '') {
    const output = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) output.push(...await walk(join(directory, entry.name), path));
      else if (entry.isFile()) output.push(path);
      else fail(`${path} is not a regular file`);
    }
    return output;
  }
  const actualPaths = await walk(rootPath);
  if (actualPaths.length !== expectedPaths.size || actualPaths.some((path) => !expectedPaths.has(path))) fail('continuation root file set is wrong');
  const references = new Map(index.value.supersessions.map((reference) => [reference.path, reference]));
  const targets = await reviewReadinessTargetManifest(repositoryRoot);
  for (const target of targets) {
    const relativePath = target.successorPath;
    const reference = references.get(relativePath);
    if (!reference) fail(`missing continuation reference for ${target.name}`);
    const record = await readCanonical(join(rootPath, 'supersessions', `${target.name}.json`));
    if (sha256Digest(record.bytes) !== reference.sha256) fail(`${target.name} digest mismatch`);
    assertApplicabilitySupersessionShape(record.value, fail);
    if (record.value.sourceRevision !== index.value.sourceRevision || record.value.sourceTree !== index.value.sourceTree
        || record.value.owner !== 'ndrewtran' || record.value.authorization.path !== REVIEW_READINESS_ACCEPTANCE
        || canonicalJson(record.value.affectedAssertions) !== canonicalJson(target.predecessor.affectedAssertions)
        || canonicalJson(record.value.replacementPlan) !== canonicalJson(target.predecessor.replacementPlan)
        || canonicalJson(record.value.supersededApplicabilityManifest) !== canonicalJson(target.predecessor.supersededApplicabilityManifest)
        || canonicalJson(record.value.previousSupersession) !== canonicalJson(target.predecessor.previousSupersession)) {
      fail(`${target.name} does not bind its exact predecessor and accepted semantics`);
    }
  }
  const allBytes = await Promise.all(actualPaths.map((path) => readFile(join(rootPath, path), 'utf8')));
  const publicText = allBytes.join('\n');
  if (/-----BEGIN |(?:ghp|github_pat|sk)-[A-Za-z0-9_-]{16,}|\/Users\/|\/home\//u.test(publicText)) {
    fail('continuation root contains private or credential-like material');
  }
  return { fileCount: actualPaths.length, index: index.value, indexSha256: sha256Digest(index.bytes) };
}

export async function assertReviewReadinessSourceTopology(repositoryRoot, sourceRevision, sourceTree) {
  const [tree, parents] = await Promise.all([
    git(repositoryRoot, ['rev-parse', `${sourceRevision}^{tree}`]),
    git(repositoryRoot, ['show', '-s', '--format=%P', sourceRevision]),
  ]);
  if (tree.trim() !== sourceTree || parents.trim() !== REVIEW_READINESS_ACCEPTED_BASE) {
    fail('source commit must have the accepted base as sole parent and the declared tree');
  }
  const changed = (await git(repositoryRoot, ['diff-tree', '--no-commit-id', '--name-only', '-r', sourceRevision]))
    .trim().split('\n').filter(Boolean);
  if (changed.some((path) => path.startsWith(`${REVIEW_READINESS_ROOT}/`))) fail('source commit contains generated continuation evidence');
  return changed.sort();
}

export async function hasReviewReadinessResidue(repositoryRoot) {
  const evidenceRoot = join(repositoryRoot, 'tests/evidence');
  const entries = await readdir(evidenceRoot).catch(() => []);
  return entries.filter((name) => name.startsWith('.delivery-review-readiness-') || name.includes('authority-58') && name.includes('staging'));
}

export async function pathExists(path) {
  return stat(path).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}
