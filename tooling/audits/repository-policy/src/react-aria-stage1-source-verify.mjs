import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const STAGE1_SOURCE = Object.freeze({
  commit: 'dea987aca51cde9da67fe3cac16c5e69a8c46016',
  tree: 'af0f923abaf8cdf55acb3c402fa929cfb439335d',
});

export const STAGE1_ARTIFACTS = Object.freeze({
  evaluator: Object.freeze({
    bytes: 19040,
    path: 'tooling/audits/repository-policy/src/react-aria-family-evaluate.mjs',
    sha256: 'c29ca2c662e89fd63897cf21ece58282db1fda2f5f9ba8eb5e67a6e4e429338d',
  }),
  snapshot: Object.freeze({
    bytes: 168799,
    path: 'catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json',
    sha256: '84c57480c61c2f844d3529702cf8864741e97ec0a0495e972c185da00f70a282',
  }),
  envelope: Object.freeze({
    bytes: 442,
    path: 'catalog/react-r1-0/react-aria-1.20.0-family-evaluation.snapshot.json.identity.json',
    sha256: 'a3ff037abaad8114dc5b910df1e574e0996df90b4b5403b8de561b756fe7870c',
  }),
});

const digest = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`REACT_ARIA_STAGE1_SOURCE_INVALID: ${message}`); };
const git = (repositoryRoot, args) => execFileSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' }).trim();
const gitBytes = (repositoryRoot, commit, path) => execFileSync(
  'git', ['-C', repositoryRoot, 'show', `${commit}:${path}`], { maxBuffer: 64 * 1024 * 1024 },
);

function readArtifact(repositoryRoot, artifact) {
  const bytes = readFileSync(join(repositoryRoot, artifact.path));
  if (bytes.byteLength !== artifact.bytes || digest(bytes) !== artifact.sha256) {
    fail(`artifact identity ${artifact.path}`);
  }
  return bytes;
}

/** Verify the immutable Stage 1 source selector, evaluator, snapshot, and counts. */
export function verifyReactAriaStage1Source(repositoryRoot, options = {}) {
  const sourceRef = options.sourceRef ?? process.env.CORE_UI_STAGE1_SOURCE_REF ?? STAGE1_SOURCE.commit;
  if (!/^[0-9a-f]{40}$/u.test(sourceRef)) fail('source selector must be one immutable 40-hex commit');

  let sourceCommit;
  try {
    sourceCommit = git(repositoryRoot, ['rev-parse', sourceRef]);
  } catch {
    fail('committed source selector cannot be resolved');
  }
  if (sourceCommit !== STAGE1_SOURCE.commit) fail('committed source drift');

  let sourceTree;
  try {
    sourceTree = git(repositoryRoot, ['rev-parse', `${sourceCommit}^{tree}`]);
  } catch {
    fail('committed source tree cannot be resolved');
  }
  if (sourceTree !== STAGE1_SOURCE.tree) fail('committed source tree drift');

  const evaluatorBytes = readArtifact(repositoryRoot, STAGE1_ARTIFACTS.evaluator);
  const snapshotBytes = readArtifact(repositoryRoot, STAGE1_ARTIFACTS.snapshot);
  const envelopeBytes = readArtifact(repositoryRoot, STAGE1_ARTIFACTS.envelope);
  const snapshot = JSON.parse(snapshotBytes);
  const envelope = JSON.parse(envelopeBytes);
  if (snapshot.coreSource?.commit !== sourceCommit || snapshot.coreSource?.tree !== sourceTree) {
    fail('snapshot committed source binding');
  }
  if (envelope.byteLength !== STAGE1_ARTIFACTS.snapshot.bytes
      || envelope.digest !== `sha256:${STAGE1_ARTIFACTS.snapshot.sha256}`
      || envelope.source?.commit !== sourceCommit
      || envelope.source?.tree !== sourceTree
      || envelope.tool?.digest !== `sha256:${STAGE1_ARTIFACTS.evaluator.sha256}`) {
    fail('snapshot envelope binding');
  }

  const committedSnapshotBytes = gitBytes(repositoryRoot, sourceCommit, 'catalog/react-r1-0/upstream-snapshot.json');
  const committedExportsBytes = gitBytes(repositoryRoot, sourceCommit, 'catalog/react-r1-0/upstream-exports.json');
  const committedSnapshot = JSON.parse(committedSnapshotBytes);
  if (snapshot.inputs?.coreRawClassification?.sha256 !== `sha256:${digest(committedSnapshotBytes)}`
      || snapshot.inputs?.coreRawExports?.sha256 !== `sha256:${digest(committedExportsBytes)}`
      || committedSnapshot.items?.length !== 613
      || snapshot.rawExports?.length !== 613
      || snapshot.families?.length !== 53
      || snapshot.counts?.newImmutableScopeIds !== 45
      || snapshot.counts?.existingExactScopeIdsReused !== 8) {
    fail('committed baseline comparison or Stage 1 counts');
  }

  return {
    accepted: true,
    source: { commit: sourceCommit, tree: sourceTree },
    artifacts: {
      evaluator: { bytes: evaluatorBytes.byteLength, sha256: digest(evaluatorBytes) },
      snapshot: { bytes: snapshotBytes.byteLength, sha256: digest(snapshotBytes) },
      envelope: { bytes: envelopeBytes.byteLength, sha256: digest(envelopeBytes) },
    },
    counts: {
      families: snapshot.families.length,
      newImmutableIds: snapshot.counts.newImmutableScopeIds,
      reusedIds: snapshot.counts.existingExactScopeIdsReused,
      rawExports: snapshot.rawExports.length,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const repositoryRoot = process.env.CORE_UI_REPOSITORY ?? process.cwd();
  process.stdout.write(`${JSON.stringify(verifyReactAriaStage1Source(repositoryRoot))}\n`);
}
