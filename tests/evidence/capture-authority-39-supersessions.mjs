import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
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

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const outputRoot = 'tests/evidence/authority-39';
const checkOnly = process.argv.includes('--check');
const sourceArgument = process.argv.indexOf('--source');
if (sourceArgument !== -1 && !process.argv[sourceArgument + 1]) {
  throw new Error('EVIDENCE_SUPERSESSION_SOURCE_REQUIRED: --source needs one Git revision');
}

const targets = [
  'g0.1',
  'g0.2',
  'g0.3',
  'g0.4',
  'g0.5',
  'gate-0',
  'g1.0',
  'g1.1',
];

async function git(...args) {
  const { stdout } = await execFile('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
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
        if (isIgnoredRepositoryEntry(child)) continue;
        await visit(join(relativePath, child));
      }
      return;
    }
    const bytes = await readFile(absolutePath);
    entries.push({ path: relativePath, sha256: `sha256:${sha256(bytes)}` });
  }

  for (const relativePath of declaredPaths) await visit(relativePath);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function committedManifestEntries(sourceRevision, declaredPaths) {
  const names = await gitBytes(
    'ls-tree',
    '-r',
    '-z',
    '--name-only',
    sourceRevision,
    '--',
    ...declaredPaths,
  );
  const paths = names.toString('utf8').split('\0').filter(Boolean).sort();
  const entries = [];
  for (const path of paths) {
    const bytes = await gitBytes('show', `${sourceRevision}:${path}`);
    entries.push({ path, sha256: `sha256:${sha256(bytes)}` });
  }
  return entries;
}

async function writeCanonical(relativePath, value) {
  const bytes = canonicalJson(value);
  const absolutePath = join(repositoryRoot, relativePath);
  if (checkOnly) {
    const current = await readFile(absolutePath, 'utf8').catch(() => null);
    if (current !== bytes) {
      throw new Error(`EVIDENCE_SUPERSESSION_DRIFT: ${relativePath} is not reproducible`);
    }
    return bytes;
  }
  await mkdir(resolve(absolutePath, '..'), { recursive: true });
  await writeFile(absolutePath, bytes);
  return bytes;
}

const retainedOutputIndex = checkOnly
  ? await readJson(`${outputRoot}/index.json`)
  : null;
const sourceRevision = sourceArgument === -1
  ? retainedOutputIndex?.value.sourceRevision ?? await git('rev-parse', 'HEAD')
  : await git('rev-parse', process.argv[sourceArgument + 1]);
const sourceTree = await git('rev-parse', `${sourceRevision}^{tree}`);
if (
  retainedOutputIndex
  && (
    retainedOutputIndex.value.sourceRevision !== sourceRevision
    || retainedOutputIndex.value.sourceTree !== sourceTree
  )
) {
  throw new Error('EVIDENCE_SUPERSESSION_SOURCE_MISMATCH: retained source identity changed');
}

const indexEntries = await readdir(join(repositoryRoot, 'tests/evidence'), {
  withFileTypes: true,
});
const recertificationNodes = new Map();
for (const entry of indexEntries.filter((candidate) => candidate.isDirectory())) {
  const indexPath = `tests/evidence/${entry.name}/index.json`;
  const { value: index } = await readJson(indexPath);
  for (const reference of index.recertifications ?? []) {
    const { value: recertification } = await readJson(reference.path);
    recertificationNodes.set(reference.path, { recertification, reference });
  }
}
const recertificationChildren = new Set(
  [...recertificationNodes.values()]
    .map(({ recertification }) => recertification.previousRecertification?.path)
    .filter(Boolean),
);

const supersessionReferences = [];
const authorityDecisionPath = 'decisions/0002-tale-token-authority.json';
const authorityDecision = await readJson(authorityDecisionPath);
assertAuthorityDecisionShape(authorityDecision.value, (message) => {
  throw new Error(`EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID: ${message}`);
});

for (const directory of targets) {
  const historicalIndexPath = `tests/evidence/${directory}/index.json`;
  const historical = await readJson(historicalIndexPath);
  const recertificationLeaves = [...recertificationNodes.values()].filter(
    ({ recertification, reference }) => (
      recertification.historicalIndex.path === historicalIndexPath
      && !recertificationChildren.has(reference.path)
    ),
  );
  if (recertificationLeaves.length > 1) {
    throw new Error(`EVIDENCE_RECERTIFICATION_FORK: ${historicalIndexPath}`);
  }
  const recertificationLeaf = recertificationLeaves[0];
  const supersededApplicabilityManifest = recertificationLeaf
    ? recertificationLeaf.recertification.currentApplicabilityManifest
    : historical.value.applicabilityManifest;
  const committedEntries = await committedManifestEntries(
    sourceRevision,
    historical.value.applicabilityManifest.paths,
  );
  const workingEntries = await manifestEntries(historical.value.applicabilityManifest.paths);
  if (canonicalJson(committedEntries) !== canonicalJson(workingEntries)) {
    throw new Error(
      `EVIDENCE_SUPERSESSION_WORKTREE_DRIFT: ${historicalIndexPath} differs from ${sourceRevision}`,
    );
  }
  const currentApplicabilityManifest = {
    algorithm: 'sha256',
    paths: historical.value.applicabilityManifest.paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: `sha256:${sha256(canonicalJson(committedEntries))}`,
  };
  const supersession = {
    affectedAssertions: historical.value.records
      .map(({ assertionId }) => assertionId)
      .sort(),
    authorization: {
      path: authorityDecisionPath,
      sha256: `sha256:${sha256(authorityDecision.bytes)}`,
    },
    currentApplicabilityManifest,
    disclosureClass: 'public-sanitized',
    effectiveAt: authorityDecision.value.createdAt,
    evidenceStatus: 'superseded',
    historicalIndex: {
      path: historicalIndexPath,
      sha256: `sha256:${sha256(historical.bytes)}`,
    },
    owner: authorityDecision.value.owner,
    reasonCode: 'governing-authority-changed',
    replacementPlan: ['TALE-TOKEN-A', 'TALE-TOKEN-B', 'TALE-TOKEN-C'],
    replacementStatus: 'pending',
    schema: 'core-ui-evidence-applicability-supersession-v1',
    sourceRevision,
    sourceTree,
    supersededApplicabilityManifest,
    ...(recertificationLeaf ? {
      supersededRecertification: {
        path: recertificationLeaf.reference.path,
        sha256: recertificationLeaf.reference.sha256,
      },
    } : {}),
  };
  assertApplicabilitySupersessionShape(supersession, (message) => {
    throw new Error(`EVIDENCE_SUPERSESSION_SCHEMA_INVALID: ${message}`);
  });
  const supersessionPath = `${outputRoot}/supersessions/${directory}.json`;
  const supersessionBytes = await writeCanonical(supersessionPath, supersession);
  supersessionReferences.push({
    milestone: historical.value.milestone,
    path: supersessionPath,
    sha256: `sha256:${sha256(supersessionBytes)}`,
  });
}

await writeCanonical(`${outputRoot}/index.json`, {
  supersessions: supersessionReferences,
  records: [],
  schema: 'core-ui-evidence-index-v1',
  sourceRevision,
  sourceTree,
});

console.log(
  `[authority-39] ${checkOnly ? 'verified' : 'captured'} `
    + `${supersessionReferences.length} applicability supersessions at ${sourceRevision}`,
);
