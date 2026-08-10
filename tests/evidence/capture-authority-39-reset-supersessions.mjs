import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from '../../tooling/audits/repository-policy/src/canonical-json.mjs';
import {
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from '../../tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs';
import {
  isIgnoredRepositoryEntry,
  sha256,
} from '../../tooling/audits/repository-policy/src/policy.mjs';
import { verifyTaleTokenBaselineReset } from '../../tooling/audits/repository-policy/src/tale-token-baseline-reset-verify.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const outputRoot = 'tests/evidence/authority-39-reset';
const acceptancePath = 'decisions/0004-tale-only-reference-baseline-acceptance.json';
const checkOnly = process.argv.includes('--check');
const sourceArgument = process.argv.indexOf('--source');
if (!checkOnly && (sourceArgument === -1 || !process.argv[sourceArgument + 1])) {
  throw new Error('EVIDENCE_SUPERSESSION_SOURCE_REQUIRED: capture needs --source <accepted-source-revision>');
}

const historicalSlugs = ['g0.1', 'g0.2', 'g0.3', 'g0.4', 'g0.5', 'gate-0', 'g1.0', 'g1.1'];
const gateZeroSlugs = ['g0.1', 'g0.2', 'g0.3', 'g0.4', 'g0.5', 'gate-0'];
const targets = [
  ...historicalSlugs.map((slug) => ({
    indexPath: `tests/evidence/${slug}/index.json`,
    outputName: `historical-${slug}`,
  })),
  ...gateZeroSlugs.map((slug) => ({
    indexPath: `tests/evidence/tale-token-phase-a-${slug}/index.json`,
    outputName: `phase-a-${slug}`,
  })),
  ...gateZeroSlugs.map((slug) => ({
    indexPath: `tests/evidence/tale-token-phase-b-${slug}/index.json`,
    outputName: `phase-b-${slug}`,
  })),
];

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
  for (const path of paths) {
    entries.push({ path, sha256: `sha256:${sha256(await gitBytes('show', `${sourceRevision}:${path}`))}` });
  }
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

const committedAcceptanceBytes = await gitBytes('show', `${sourceRevision}:${acceptancePath}`).catch(() => null);
if (!committedAcceptanceBytes) {
  throw new Error('EVIDENCE_SUPERSESSION_ACCEPTANCE_REQUIRED: source must contain decision 0004 acceptance');
}
const workingAcceptanceBytes = await readFile(join(repositoryRoot, acceptancePath));
if (!committedAcceptanceBytes.equals(workingAcceptanceBytes)) {
  throw new Error('EVIDENCE_SUPERSESSION_ACCEPTANCE_MISMATCH: working acceptance differs from source');
}
const acceptance = JSON.parse(committedAcceptanceBytes.toString('utf8'));
assertAuthorityDecisionShape(acceptance, (message) => {
  throw new Error(`EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: ${message}`);
});
if (acceptance.decisionId !== 'core-ui:decision:0004' || acceptance.issueNumber !== 39 || acceptance.owner !== 'ndrewtran') {
  throw new Error('EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: wrong decision 0004 owner or issue');
}
await verifyTaleTokenBaselineReset(repositoryRoot, { requireAcceptance: true });
const authorization = { path: acceptancePath, sha256: `sha256:${sha256(committedAcceptanceBytes)}` };

if (!checkOnly) {
  try {
    await access(join(repositoryRoot, outputRoot));
    throw new Error(`EVIDENCE_SUPERSESSION_OUTPUT_EXISTS: ${outputRoot}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const evidenceEntries = await readdir(join(repositoryRoot, 'tests/evidence'), { withFileTypes: true });
const supersessionsByTarget = new Map();
for (const entry of evidenceEntries.filter((candidate) => candidate.isDirectory() && candidate.name !== 'authority-39-reset')) {
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
for (const target of targets) {
  const historical = await readJson(target.indexPath);
  const previous = terminalSupersession(target.indexPath);
  const paths = historical.value.applicabilityManifest.paths;
  const committedEntries = await committedManifestEntries(sourceRevision, paths);
  const workingEntries = await manifestEntries(paths);
  if (canonicalJson(committedEntries) !== canonicalJson(workingEntries)) {
    throw new Error(`EVIDENCE_SUPERSESSION_WORKTREE_DRIFT: ${target.indexPath} differs from ${sourceRevision}`);
  }
  const supersededManifest = previous?.value.currentApplicabilityManifest ?? historical.value.applicabilityManifest;
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
    ...(previous ? {
      previousSupersession: {
        path: previous.reference.path,
        sha256: previous.reference.sha256,
      },
    } : {}),
    reasonCode: 'governing-authority-changed',
    replacementPlan: ['TALE-TOKEN-C', 'E-G1.0', 'E-G1.1'],
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

console.log(`[authority-39-reset] ${checkOnly ? 'verified' : 'captured'} ${references.length} append-only supersessions at ${sourceRevision}`);
