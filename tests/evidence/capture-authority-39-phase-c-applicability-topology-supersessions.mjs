import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from '../../tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs';
import {
  isIgnoredRepositoryEntry,
  sha256,
} from '../../tooling/audits/repository-policy/src/policy.mjs';
import { verifyPhaseCApplicabilityTopologyCorrection } from '../../tooling/audits/repository-policy/src/phase-c-applicability-topology-correction-verify.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const outputRoot = 'tests/evidence/authority-39-phase-c-applicability-topology';
const outputDirectoryName = 'authority-39-phase-c-applicability-topology';
const predecessorIndexPath = 'tests/evidence/authority-39-default-theme-identity/index.json';
const decisionPath = 'decisions/0006-phase-c-applicability-topology.json';
const acceptancePath = 'decisions/0006-phase-c-applicability-topology-acceptance.json';
const checkOnly = process.argv.includes('--check');
const sourceArgument = process.argv.indexOf('--source');
const injectedFailureAfter = process.env.CORE_UI_TEST_PHASE_C_AUTHORITY_CAPTURE_FAIL_AFTER
  ? Number.parseInt(process.env.CORE_UI_TEST_PHASE_C_AUTHORITY_CAPTURE_FAIL_AFTER, 10)
  : null;
if (injectedFailureAfter !== null && (!Number.isInteger(injectedFailureAfter) || injectedFailureAfter < 1)) {
  throw new Error('EVIDENCE_SUPERSESSION_TEST_FAILURE_INVALID: injected failure count must be a positive integer');
}
if (!checkOnly && (sourceArgument === -1 || !process.argv[sourceArgument + 1])) {
  throw new Error('EVIDENCE_SUPERSESSION_SOURCE_REQUIRED: capture needs --source <accepted-source-revision>');
}

async function git(...args) {
  const { stdout } = await execFile('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  return stdout.trim();
}

async function gitBytes(...args) {
  const { stdout } = await execFile('git', args, {
    cwd: repositoryRoot,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
}

async function readJson(relativePath) {
  const bytes = await readFile(join(repositoryRoot, relativePath), 'utf8');
  const value = parseJsonStrict(bytes);
  if (canonicalJson(value) !== bytes) {
    throw new Error(`EVIDENCE_SUPERSESSION_NONCANONICAL: ${relativePath}`);
  }
  return { bytes, value };
}

async function manifestEntries(declaredPaths) {
  const entries = [];
  async function visit(relativePath) {
    const absolutePath = join(repositoryRoot, relativePath);
    const metadata = await stat(absolutePath);
    if (metadata.isDirectory()) {
      const children = await readdir(absolutePath);
      children.sort((left, right) => left.localeCompare(right));
      for (const child of children) {
        if (!isIgnoredRepositoryEntry(child)) await visit(join(relativePath, child));
      }
      return;
    }
    entries.push({ path: relativePath, sha256: `sha256:${sha256(await readFile(absolutePath))}` });
  }
  for (const relativePath of declaredPaths) await visit(relativePath);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function committedManifestEntries(sourceRevision, declaredPaths) {
  const names = await gitBytes('ls-tree', '-r', '-z', '--name-only', sourceRevision, '--', ...declaredPaths);
  const paths = names.toString('utf8').split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right));
  const entries = [];
  for (const path of paths) {
    entries.push({ path, sha256: `sha256:${sha256(await gitBytes('show', `${sourceRevision}:${path}`))}` });
  }
  return entries;
}

let stagingOutputRoot = null;
let stagedWriteCount = 0;

function outputPath(relativePath) {
  if (!checkOnly && stagingOutputRoot && relativePath.startsWith(`${outputRoot}/`)) {
    return join(stagingOutputRoot, relativePath.slice(outputRoot.length + 1));
  }
  return join(repositoryRoot, relativePath);
}

async function writeCanonical(relativePath, value) {
  const bytes = canonicalJson(value);
  const absolutePath = outputPath(relativePath);
  if (checkOnly) {
    const current = await readFile(absolutePath, 'utf8').catch(() => null);
    if (current !== bytes) throw new Error(`EVIDENCE_SUPERSESSION_DRIFT: ${relativePath}`);
    return bytes;
  }
  await mkdir(resolve(absolutePath, '..'), { recursive: true });
  await writeFile(absolutePath, bytes);
  stagedWriteCount += 1;
  if (injectedFailureAfter === stagedWriteCount) {
    throw new Error(`EVIDENCE_SUPERSESSION_TEST_FAILURE: injected after ${stagedWriteCount} staged writes`);
  }
  return bytes;
}

const retainedOutput = checkOnly ? await readJson(`${outputRoot}/index.json`) : null;
const sourceRevision = checkOnly
  ? retainedOutput.value.sourceRevision
  : await git('rev-parse', process.argv[sourceArgument + 1]);
const sourceTree = await git('rev-parse', `${sourceRevision}^{tree}`);
if (retainedOutput && (retainedOutput.value.sourceRevision !== sourceRevision || retainedOutput.value.sourceTree !== sourceTree)) {
  throw new Error('EVIDENCE_SUPERSESSION_SOURCE_MISMATCH: retained source identity changed');
}

const requiredAuthorityPaths = [
  acceptancePath,
  decisionPath,
  'strategy/product-scope.md',
  'tests/evidence/capture-authority-39-phase-c-applicability-topology-supersessions.mjs',
  'tooling/audits/repository-policy/src/phase-c-applicability-topology-correction-verify.mjs',
];
const committedAuthority = new Map();
for (const path of requiredAuthorityPaths) {
  const committed = await gitBytes('show', `${sourceRevision}:${path}`).catch(() => null);
  if (!committed) {
    throw new Error(`EVIDENCE_SUPERSESSION_AUTHORITY_REQUIRED: source must contain ${path}`);
  }
  const working = await readFile(join(repositoryRoot, path));
  if (!committed.equals(working)) {
    throw new Error(`EVIDENCE_SUPERSESSION_AUTHORITY_MISMATCH: ${path} differs from source`);
  }
  committedAuthority.set(path, committed);
}
const committedAcceptanceBytes = committedAuthority.get(acceptancePath);
const acceptanceSource = committedAcceptanceBytes.toString('utf8');
const acceptance = parseJsonStrict(acceptanceSource);
if (canonicalJson(acceptance) !== acceptanceSource) {
  throw new Error('EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: receipt is not canonical JSON');
}
assertAuthorityDecisionShape(acceptance, (message) => {
  throw new Error(`EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: ${message}`);
});
if (acceptance.decisionId !== 'core-ui:decision:0006' || acceptance.issueNumber !== 39 || acceptance.owner !== 'ndrewtran') {
  throw new Error('EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: wrong decision 0006 owner or issue');
}
verifyPhaseCApplicabilityTopologyCorrection();
const authorization = { path: acceptancePath, sha256: `sha256:${sha256(committedAcceptanceBytes)}` };
const decision = parseJsonStrict(committedAuthority.get(decisionPath).toString('utf8'));
const topology = decision.proofTopology.authorityStage;
const predecessorIndex = await readJson(predecessorIndexPath);
const expectedPredecessorPaths = topology.targets.map(({ predecessor }) => predecessor.path);
const actualPredecessorPaths = predecessorIndex.value.supersessions.map(({ path }) => path);
if (canonicalJson([...actualPredecessorPaths].sort()) !== canonicalJson([...expectedPredecessorPaths].sort())) {
  throw new Error('EVIDENCE_SUPERSESSION_PREDECESSOR_SET_MISMATCH: decision target set does not match authority-39-reset');
}
const predecessorReferences = new Map(predecessorIndex.value.supersessions.map((reference) => [reference.path, reference]));
const targets = [];
for (const specification of topology.targets) {
  const outputName = specification.name;
  const predecessorPath = specification.predecessor.path;
  const predecessorReference = predecessorReferences.get(predecessorPath);
  const predecessor = await readJson(predecessorPath);
  if (
    predecessorReference?.sha256 !== specification.predecessor.sha256
    || canonicalJson(predecessor.value.affectedAssertions) !== canonicalJson(specification.affectedAssertions)
    || canonicalJson(predecessor.value.historicalIndex) !== canonicalJson(specification.historicalIndex)
    || canonicalJson(predecessor.value.currentApplicabilityManifest) !== canonicalJson(specification.predecessorCurrentApplicabilityManifest)
  ) {
    throw new Error(`EVIDENCE_SUPERSESSION_SPECIFICATION_MISMATCH: ${predecessorPath}`);
  }
  if (predecessorReference.sha256 !== `sha256:${sha256(predecessor.bytes)}`) {
    throw new Error(`EVIDENCE_SUPERSESSION_PREDECESSOR_DIGEST_MISMATCH: ${predecessorPath}`);
  }
  targets.push({
    indexPath: predecessor.value.historicalIndex.path,
    outputName,
    predecessorReference,
    predecessor: predecessor.value,
  });
}

if (!checkOnly) {
  try {
    await access(join(repositoryRoot, outputRoot));
    throw new Error(`EVIDENCE_SUPERSESSION_OUTPUT_EXISTS: ${outputRoot}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const status = await git('status', '--porcelain=v1', '--untracked-files=all');
  if (status) {
    throw new Error('EVIDENCE_SUPERSESSION_WORKTREE_DIRTY: capture requires an exact clean source checkout');
  }
  stagingOutputRoot = await mkdtemp(join(repositoryRoot, 'tests/evidence', `.${outputDirectoryName}.stage-`));
}

const evidenceEntries = await readdir(join(repositoryRoot, 'tests/evidence'), { withFileTypes: true });
const supersessionsByTarget = new Map();
for (const entry of evidenceEntries.filter((candidate) => (
  candidate.isDirectory()
  && candidate.name !== outputDirectoryName
  && !candidate.name.startsWith(`.${outputDirectoryName}.stage-`)
  && !isIgnoredRepositoryEntry(candidate.name)
))) {
  const index = await readJson(`tests/evidence/${entry.name}/index.json`);
  for (const reference of index.value.supersessions ?? []) {
    const node = await readJson(reference.path);
    const target = node.value.historicalIndex.path;
    const nodes = supersessionsByTarget.get(target) ?? [];
    nodes.push({ reference, value: node.value });
    supersessionsByTarget.set(target, nodes);
  }
}

function terminalSupersession(target) {
  const nodes = supersessionsByTarget.get(target) ?? [];
  if (nodes.length === 0) return null;
  const predecessorPaths = new Set(nodes.map(({ value }) => value.previousSupersession?.path).filter(Boolean));
  const leaves = nodes.filter(({ reference }) => !predecessorPaths.has(reference.path));
  if (leaves.length !== 1) throw new Error(`EVIDENCE_SUPERSESSION_FORK: ${target}`);
  return leaves[0];
}

const references = [];
let capturePublished = false;
try {
for (const target of targets) {
  const historical = await readJson(target.indexPath);
  const previous = terminalSupersession(target.indexPath);
  if (
    previous?.reference.path !== target.predecessorReference.path
    || previous?.reference.sha256 !== target.predecessorReference.sha256
    || canonicalJson(previous?.value) !== canonicalJson(target.predecessor)
  ) {
    throw new Error(`EVIDENCE_SUPERSESSION_PREDECESSOR_NOT_TERMINAL: ${target.indexPath}`);
  }
  const paths = historical.value.applicabilityManifest.paths;
  const committedEntries = await committedManifestEntries(sourceRevision, paths);
  const workingEntries = await manifestEntries(paths);
  if (canonicalJson(committedEntries) !== canonicalJson(workingEntries)) {
    throw new Error(`EVIDENCE_SUPERSESSION_WORKTREE_DRIFT: ${target.indexPath} differs from ${sourceRevision}`);
  }
  const supersededManifest = previous.value.currentApplicabilityManifest;
  const supersession = {
    affectedAssertions: historical.value.records.map(({ assertionId }) => assertionId).sort(),
    authorization,
    currentApplicabilityManifest: {
      algorithm: 'sha256',
      paths,
      profile: 'core-ui-path-manifest-v1',
      sha256: `sha256:${sha256(canonicalJson(committedEntries))}`,
    },
    disclosureClass: 'public-sanitized',
    effectiveAt: acceptance.createdAt,
    evidenceStatus: 'superseded',
    historicalIndex: {
      path: target.indexPath,
      sha256: `sha256:${sha256(historical.bytes)}`,
    },
    owner: acceptance.owner,
    previousSupersession: {
      path: previous.reference.path,
      sha256: previous.reference.sha256,
    },
    reasonCode: 'governing-authority-changed',
    replacementPlan: decision.proofTopology.maintenance.replacementPlan,
    replacementStatus: 'pending',
    schema: 'core-ui-evidence-applicability-supersession-v1',
    sourceRevision,
    sourceTree,
    supersededApplicabilityManifest: supersededManifest,
  };
  assertApplicabilitySupersessionShape(supersession, (message) => {
    throw new Error(`EVIDENCE_SUPERSESSION_SCHEMA_INVALID: ${target.indexPath}: ${message}`);
  });
  const path = `${outputRoot}/supersessions/${target.outputName}.json`;
  const bytes = await writeCanonical(path, supersession);
  references.push({ milestone: historical.value.milestone, path, sha256: `sha256:${sha256(bytes)}` });
}

await writeCanonical(`${outputRoot}/index.json`, {
  records: [],
  schema: 'core-ui-evidence-index-v1',
  sourceRevision,
  sourceTree,
  supersessions: references,
});

if (!checkOnly) {
  const stagedFiles = [];
  async function visitStaged(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) await visitStaged(absolutePath);
      else stagedFiles.push(absolutePath.slice(stagingOutputRoot.length + 1));
    }
  }
  await visitStaged(stagingOutputRoot);
  const expectedFiles = ['index.json', ...references.map(({ path }) => path.slice(outputRoot.length + 1))].sort();
  if (canonicalJson(stagedFiles.sort()) !== canonicalJson(expectedFiles)) {
    throw new Error('EVIDENCE_SUPERSESSION_ATOMIC_SET_MISMATCH: staged output is incomplete or contains extra files');
  }
  for (const reference of references) {
    const staged = await readFile(outputPath(reference.path), 'utf8');
    if (`sha256:${sha256(staged)}` !== reference.sha256) {
      throw new Error(`EVIDENCE_SUPERSESSION_ATOMIC_DIGEST_MISMATCH: ${reference.path}`);
    }
  }
  await rename(stagingOutputRoot, join(repositoryRoot, outputRoot));
  capturePublished = true;
}

console.log(`[authority-39-phase-c-applicability-topology] ${checkOnly ? 'verified' : 'captured'} ${references.length} append-only supersessions at ${sourceRevision}`);
} finally {
  if (!checkOnly && stagingOutputRoot && !capturePublished) {
    await rm(stagingOutputRoot, { recursive: true, force: true });
  }
}
