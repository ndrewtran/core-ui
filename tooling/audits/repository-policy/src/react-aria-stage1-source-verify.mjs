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

export const R1_ENTRY_BINDING = Object.freeze({
  decision: Object.freeze({
    bytes: 18779,
    path: 'decisions/0010-amendment-03-comprehensive-react-0-1.md',
    sha256: '8ad4be538ad7a35a8c03e01af573cad27a06225e4c91eba61bb7e693e498544a',
  }),
  productScope: Object.freeze({
    bytes: 122969,
    path: 'strategy/product-scope.md',
    sha256: '0cafc0218f0e6795a5d600acb424b4bf514972295c89b48e9042d7faa69a261f',
    version: '6.0.0',
  }),
  roadmap: Object.freeze({
    bytes: 155570,
    path: 'strategy/milestone-roadmap.md',
    sha256: '006bd9a9b9141c10440fffd9d8f2dcadf77a47e1175a072a0e52acd784795ca0',
  }),
});

const digest = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`REACT_ARIA_STAGE1_SOURCE_INVALID: ${message}`); };
const git = (repositoryRoot, args) => execFileSync('git', ['-C', repositoryRoot, ...args], {encoding: 'utf8'}).trim();
const gitBytes = (repositoryRoot, commit, path) => execFileSync(
  'git',
  ['-C', repositoryRoot, 'show', `${commit}:${path}`],
  {maxBuffer: 64 * 1024 * 1024},
);

function readArtifact(repositoryRoot, artifact) {
  const bytes = readFileSync(join(repositoryRoot, artifact.path));
  if (bytes.byteLength !== artifact.bytes || digest(bytes) !== artifact.sha256) {
    fail(`artifact identity ${artifact.path}`);
  }
  return bytes;
}

function readTextArtifact(repositoryRoot, artifact) {
  const bytes = readFileSync(join(repositoryRoot, artifact.path));
  if (bytes.byteLength !== artifact.bytes || digest(bytes) !== artifact.sha256) {
    fail(`authority identity ${artifact.path}`);
  }
  return bytes.toString('utf8');
}

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
    source: {commit: sourceCommit, tree: sourceTree},
    artifacts: {
      evaluator: {bytes: evaluatorBytes.byteLength, sha256: digest(evaluatorBytes)},
      snapshot: {bytes: snapshotBytes.byteLength, sha256: digest(snapshotBytes)},
      envelope: {bytes: envelopeBytes.byteLength, sha256: digest(envelopeBytes)},
    },
    counts: {families: snapshot.families.length, newImmutableIds: snapshot.counts.newImmutableScopeIds, reusedIds: snapshot.counts.existingExactScopeIdsReused, rawExports: snapshot.rawExports.length},
  };
}

export function verifyReactR1Entry(repositoryRoot, options = {}) {
  const productScopeSource = options.productScopeSource
    ?? readTextArtifact(repositoryRoot, R1_ENTRY_BINDING.productScope);
  const decisionSource = options.decisionSource
    ?? readTextArtifact(repositoryRoot, R1_ENTRY_BINDING.decision);
  const roadmapSource = options.roadmapSource
    ?? readTextArtifact(repositoryRoot, R1_ENTRY_BINDING.roadmap);

  if (Buffer.byteLength(productScopeSource) !== R1_ENTRY_BINDING.productScope.bytes
      || digest(productScopeSource) !== R1_ENTRY_BINDING.productScope.sha256
      || !productScopeSource.startsWith('---\nscopeVersion: 6.0.0\n')) {
    fail('R1.0 Product Scope 6.0.0 applicability binding');
  }
  if (Buffer.byteLength(decisionSource) !== R1_ENTRY_BINDING.decision.bytes
      || digest(decisionSource) !== R1_ENTRY_BINDING.decision.sha256
      || !decisionSource.includes('Human acceptance: Andrew / ndrewtran: “I accept Core UI comprehensive React 0.1 authority candidate v1')) {
    fail('R1.0 Decision 0010 amendment-03 identity');
  }
  for (const binding of [
    `${STAGE1_SOURCE.commit}`,
    `${STAGE1_SOURCE.tree}`,
    STAGE1_ARTIFACTS.evaluator.sha256,
    STAGE1_ARTIFACTS.snapshot.sha256,
    STAGE1_ARTIFACTS.envelope.sha256,
  ]) {
    if (!decisionSource.includes(binding)) fail('R1.0 Decision Stage 1 binding');
  }
  if (Buffer.byteLength(roadmapSource) !== R1_ENTRY_BINDING.roadmap.bytes
      || digest(roadmapSource) !== R1_ENTRY_BINDING.roadmap.sha256
      || !roadmapSource.includes('Current R1.0 evidence locator: pending; no current R1.0 evidence acceptance')
      || !roadmapSource.includes('is recorded. Existing pre-amendment R1.0 evidence is historical-only')
      || !roadmapSource.includes('historical audit locator only; it is not a current R1 entry or completion rule')) {
    fail('R1.0 Roadmap applicability gate');
  }

  const stage1 = verifyReactAriaStage1Source(repositoryRoot, {
    sourceRef: options.stage1SourceRef,
  });
  if (!stage1.accepted || stage1.source.commit !== STAGE1_SOURCE.commit
      || stage1.source.tree !== STAGE1_SOURCE.tree
      || stage1.artifacts.snapshot.sha256 !== STAGE1_ARTIFACTS.snapshot.sha256
      || stage1.artifacts.envelope.sha256 !== STAGE1_ARTIFACTS.envelope.sha256) {
    fail('R1.0 immutable Stage 1 verifier result');
  }

  return {
    accepted: true,
    activation: {
      permitted: false,
      reason: 'current R1.0 evidence locator is pending; historical evidence cannot activate this entry',
      status: 'blocked-pending-current-evidence',
    },
    applicability: {
      currentEvidenceLocator: null,
      historicalEvidence: { sufficient: false, status: 'historical-only' },
      status: 'pending-current-evidence',
    },
    decision: { bytes: R1_ENTRY_BINDING.decision.bytes, sha256: R1_ENTRY_BINDING.decision.sha256 },
    productScope: { bytes: R1_ENTRY_BINDING.productScope.bytes, sha256: R1_ENTRY_BINDING.productScope.sha256, version: R1_ENTRY_BINDING.productScope.version },
    stage1,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const repositoryRoot = process.env.CORE_UI_REPOSITORY ?? process.cwd();
  process.stdout.write(`${JSON.stringify(verifyReactAriaStage1Source(repositoryRoot))}\n`);
}
