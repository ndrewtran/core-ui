import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from '../../tooling/audits/repository-policy/src/canonical-json.mjs';
import { parseJsonStrict } from '../../packages/schema/src/canonical.mjs';
import {
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from '../../tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs';
import {
  isIgnoredRepositoryEntry,
  sha256,
} from '../../tooling/audits/repository-policy/src/policy.mjs';
import { assertTaleAnnexAcceptanceRecord } from '../../tooling/audits/repository-policy/src/tale-token-annex-acceptance.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const predecessorRoot = 'tests/evidence/authority-39';
const outputRoot = 'tests/evidence/authority-39-annex';
const annexPath = 'decisions/0003-tale-token-classification-annex.json';
const annexAcceptancePath = 'decisions/0003-tale-token-classification-acceptance.json';
const checkOnly = process.argv.includes('--check');
const sourceArgument = process.argv.indexOf('--source');
if (!checkOnly && (sourceArgument === -1 || !process.argv[sourceArgument + 1])) {
  throw new Error('EVIDENCE_SUPERSESSION_SOURCE_REQUIRED: capture needs --source <accepted-source-revision>');
}

const targets = ['g0.1', 'g0.2', 'g0.3', 'g0.4', 'g0.5', 'gate-0', 'g1.0', 'g1.1'];

async function git(...args) {
  const { stdout } = await execFile('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  return stdout.trim();
}

async function gitBytes(...args) {
  const { stdout } = await execFile('git', args, {
    cwd: repositoryRoot,
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

async function readJson(relativePath) {
  const bytes = await readFile(join(repositoryRoot, relativePath), 'utf8');
  return { bytes, value: JSON.parse(bytes) };
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
  for (const path of paths) entries.push({ path, sha256: `sha256:${sha256(await gitBytes('show', `${sourceRevision}:${path}`))}` });
  return entries;
}

async function writeCanonical(relativePath, value) {
  const bytes = canonicalJson(value);
  const absolutePath = join(repositoryRoot, relativePath);
  if (checkOnly) {
    const current = await readFile(absolutePath, 'utf8').catch(() => null);
    if (current !== bytes) throw new Error(`EVIDENCE_SUPERSESSION_DRIFT: ${relativePath}`);
    return bytes;
  }
  await mkdir(resolve(absolutePath, '..'), { recursive: true });
  await writeFile(absolutePath, bytes);
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

let committedAnnexBytes;
let committedAcceptanceBytes;
try {
  committedAnnexBytes = await gitBytes('show', `${sourceRevision}:${annexPath}`);
  committedAcceptanceBytes = await gitBytes('show', `${sourceRevision}:${annexAcceptancePath}`);
} catch {
  throw new Error('EVIDENCE_SUPERSESSION_ACCEPTANCE_REQUIRED: source must contain the exact annex and acceptance record');
}
const committedAnnex = parseJsonStrict(committedAnnexBytes.toString('utf8'));
const committedAcceptance = parseJsonStrict(committedAcceptanceBytes.toString('utf8'));
if (
  committedAnnex.schema !== 'core-ui-tale-token-classification-annex-v1'
  || committedAnnex.decisionId !== 'core-ui:decision:0003'
  || committedAnnex.state !== 'acceptance-candidate'
) {
  throw new Error('EVIDENCE_SUPERSESSION_ANNEX_INVALID: source annex identity is invalid');
}
assertTaleAnnexAcceptanceRecord(
  committedAcceptance,
  annexPath,
  committedAnnexBytes,
  (message) => {
    throw new Error(`EVIDENCE_SUPERSESSION_ACCEPTANCE_INVALID: ${message}`);
  },
);
const acceptanceReference = {
  path: annexAcceptancePath,
  sha256: `sha256:${sha256(committedAcceptanceBytes)}`,
};

const predecessorIndex = await readJson(`${predecessorRoot}/index.json`);
const predecessorByMilestone = new Map(predecessorIndex.value.supersessions.map((reference) => [reference.milestone, reference]));
const otherChildren = new Set();
const evidenceEntries = await readdir(join(repositoryRoot, 'tests/evidence'), { withFileTypes: true });
for (const entry of evidenceEntries.filter((candidate) => candidate.isDirectory() && candidate.name !== 'authority-39-annex')) {
  const index = await readJson(`tests/evidence/${entry.name}/index.json`);
  for (const reference of index.value.supersessions ?? []) {
    const node = await readJson(reference.path);
    if (node.value.previousSupersession?.path) otherChildren.add(node.value.previousSupersession.path);
  }
}
assertAuthorityDecisionShape(committedAcceptance, (message) => {
  throw new Error(`EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: ${message}`);
});

if (!checkOnly) {
  try {
    await access(join(repositoryRoot, outputRoot));
    throw new Error(`EVIDENCE_SUPERSESSION_OUTPUT_EXISTS: ${outputRoot}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const references = [];
for (const directory of targets) {
  const historicalIndexPath = `tests/evidence/${directory}/index.json`;
  const historical = await readJson(historicalIndexPath);
  const previousReference = predecessorByMilestone.get(historical.value.milestone);
  if (!previousReference) throw new Error(`EVIDENCE_SUPERSESSION_PREDECESSOR_MISSING: ${historical.value.milestone}`);
  if (otherChildren.has(previousReference.path)) throw new Error(`EVIDENCE_SUPERSESSION_PREDECESSOR_NOT_TERMINAL: ${previousReference.path}`);
  const previous = await readJson(previousReference.path);
  if (`sha256:${sha256(previous.bytes)}` !== previousReference.sha256) {
    throw new Error(`EVIDENCE_SUPERSESSION_PREDECESSOR_DIGEST: ${previousReference.path}`);
  }
  const paths = historical.value.applicabilityManifest.paths;
  const committedEntries = await committedManifestEntries(sourceRevision, paths);
  const workingEntries = await manifestEntries(paths);
  if (canonicalJson(committedEntries) !== canonicalJson(workingEntries)) {
    throw new Error(`EVIDENCE_SUPERSESSION_WORKTREE_DRIFT: ${historicalIndexPath} differs from ${sourceRevision}`);
  }
  const supersession = {
    affectedAssertions: historical.value.records.map(({ assertionId }) => assertionId).sort(),
    authorization: acceptanceReference,
    currentApplicabilityManifest: {
      algorithm: 'sha256',
      paths,
      profile: 'core-ui-path-manifest-v1',
      sha256: `sha256:${sha256(canonicalJson(committedEntries))}`,
    },
    disclosureClass: 'public-sanitized',
    effectiveAt: committedAcceptance.createdAt,
    evidenceStatus: 'superseded',
    historicalIndex: {
      path: historicalIndexPath,
      sha256: `sha256:${sha256(historical.bytes)}`,
    },
    owner: committedAcceptance.owner,
    previousSupersession: {
      path: previousReference.path,
      sha256: previousReference.sha256,
    },
    reasonCode: 'governing-authority-changed',
    replacementPlan: ['TALE-TOKEN-A', 'TALE-TOKEN-B', 'TALE-TOKEN-C'],
    replacementStatus: 'pending',
    schema: 'core-ui-evidence-applicability-supersession-v1',
    sourceRevision,
    sourceTree,
    supersededApplicabilityManifest: previous.value.currentApplicabilityManifest,
  };
  assertApplicabilitySupersessionShape(supersession, (message) => {
    throw new Error(`EVIDENCE_SUPERSESSION_SCHEMA_INVALID: ${message}`);
  });
  const path = `${outputRoot}/supersessions/${directory}.json`;
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

console.log(`[authority-39-annex] ${checkOnly ? 'verified' : 'captured'} ${references.length} append-only continuation supersessions at ${sourceRevision}`);
