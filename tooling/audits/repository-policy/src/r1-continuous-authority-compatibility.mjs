import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@muxui/schema';

// This module is retained solely to inspect the immutable pre-reset R1
// materialization. It intentionally exposes no current authority or entry
// predicate: ordinary R1 delivery has no compatibility ladder.
const HISTORICAL_COMMIT = '9a7cf99b0e74b2813998775138f0bc340e82c962';
const HISTORICAL_TREE = '470d0f7bc6751b7f66d49fbf4fdc2d62f6cc89f0';
const HISTORICAL_PARENTS = Object.freeze([
  'd4bba1a5f004d638936b79b673f0b1c4f9691426',
  '374db5debff52c64929ad3255a6824ce42af756c',
]);
const HISTORICAL_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  acceptanceSha256: '71134f9a3d30e1d98b55f07e3456f787593ebd8eefd3c6ee5257ac61aea83248',
  candidatePath: 'decisions/0010-amendment-04-r1-continuous-execution-envelope.md',
  decisionPath: 'decisions/0010-amendment-04-r1-continuous-execution.md',
  decisionSha256: '321fefef4e723ee2d636a4ea6917436bf0babb5c6c7da2a5450e1ffc5c37871f',
  manifestPath: 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json',
  manifestSha256: '73cb2919c26985315557215ba8735139f8ace8ce31526b38a878982a16450111',
});

const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const fail = (message) => { throw new Error(`R1_CONTINUOUS_AUTHORITY_INVALID: ${message}`); };
const failHistoricalAncestry = (message) => {
  const error = new Error(`R1_CONTINUOUS_AUTHORITY_INVALID: ${message}`);
  error.code = 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID';
  throw error;
};
const git = (repositoryRoot, args, encoding = 'utf8') => execFileSync(
  'git', ['-C', repositoryRoot, ...args], { encoding, maxBuffer: 64 * 1024 * 1024 },
);
const historicalBlob = (repositoryRoot, relativePath) => {
  try {
    return git(repositoryRoot, ['show', `${HISTORICAL_COMMIT}:${relativePath}`], 'buffer');
  } catch {
    fail(`historical tree missing ${relativePath}`);
  }
};

function assertHistoricalTopology(repositoryRoot) {
  let details;
  try {
    details = git(repositoryRoot, [
      'show', '-s', '--format=%H%n%T%n%P', HISTORICAL_COMMIT,
    ]).trim().split('\n');
  } catch {
    fail('historical protected merge cannot be resolved');
  }
  try {
    git(repositoryRoot, ['merge-base', '--is-ancestor', HISTORICAL_COMMIT, 'HEAD']);
  } catch {
    failHistoricalAncestry('historical protected merge must be an ancestor of current HEAD');
  }
  if (details[0] !== HISTORICAL_COMMIT || details[1] !== HISTORICAL_TREE
      || canonicalJson(details[2]?.split(' ') ?? []) !== canonicalJson(HISTORICAL_PARENTS)) {
    fail('historical protected merge topology');
  }
}

function assertHistoricalManifest(repositoryRoot) {
  assertHistoricalTopology(repositoryRoot);
  const manifestBytes = historicalBlob(repositoryRoot, HISTORICAL_AUTHORITY.manifestPath);
  if (sha256(manifestBytes) !== HISTORICAL_AUTHORITY.manifestSha256) {
    fail('historical materialization manifest identity');
  }
  let manifest;
  try {
    manifest = parseJsonStrict(manifestBytes.toString('utf8'));
  } catch {
    fail('historical materialization manifest JSON');
  }
  const candidateBytes = historicalBlob(repositoryRoot, HISTORICAL_AUTHORITY.candidatePath);
  if (canonicalJson(manifest) !== manifestBytes.toString('utf8')
      || manifest.profile !== 'core-ui-r1-continuous-execution-materialization-manifest-v1'
      || manifest.selfPath !== HISTORICAL_AUTHORITY.manifestPath
      || manifest.candidate?.path !== HISTORICAL_AUTHORITY.candidatePath
      || manifest.candidate?.algorithm !== 'sha256'
      || manifest.candidate?.digest !== sha256(candidateBytes)
      || manifest.candidate?.byteLength !== candidateBytes.byteLength) {
    fail('historical materialization manifest binding');
  }
  if (!Array.isArray(manifest.staticAfterImages)) fail('historical static after-image list');
  const seen = new Set();
  for (const image of manifest.staticAfterImages) {
    if (image.algorithm !== 'sha256' || typeof image.path !== 'string'
        || image.path.startsWith('/') || image.path.split('/').includes('..') || seen.has(image.path)) {
      fail('historical static after-image shape');
    }
    seen.add(image.path);
    const bytes = historicalBlob(repositoryRoot, image.path);
    if (bytes.byteLength !== image.byteLength || sha256(bytes) !== image.digest) {
      fail(`historical static after-image ${image.path}`);
    }
  }
  const expectedWriteSet = new Set([
    HISTORICAL_AUTHORITY.acceptancePath,
    HISTORICAL_AUTHORITY.manifestPath,
    ...manifest.staticAfterImages.map(({ path }) => path),
  ]);
  if (!Array.isArray(manifest.writeSet)
      || manifest.writeSet.length !== expectedWriteSet.size
      || manifest.writeSet.some((path) => !expectedWriteSet.has(path))) {
    fail('historical materialization write set');
  }
  const acceptanceBytes = historicalBlob(repositoryRoot, HISTORICAL_AUTHORITY.acceptancePath);
  if (sha256(acceptanceBytes) !== HISTORICAL_AUTHORITY.acceptanceSha256) fail('historical acceptance identity');
  const acceptance = acceptanceBytes.toString('utf8');
  const ownerCommentUrl = acceptance.match(
    /^Owner record: `(https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*)`$/mu,
  )?.[1];
  if (!ownerCommentUrl) fail('historical owner record');
  const manifestSha256 = sha256(manifestBytes);
  const ownerStatement = manifest.acceptanceRecordRenderer.ownerStatementTemplate
    .replaceAll('{candidateSha256}', manifest.candidate.digest)
    .replaceAll('{manifestSha256}', manifestSha256);
  const expectedAcceptance = manifest.acceptanceRecordRenderer.outputTemplate
    .replaceAll('{candidateSha256}', manifest.candidate.digest)
    .replaceAll('{manifestSha256}', manifestSha256)
    .replaceAll('{ownerCommentUrl}', ownerCommentUrl)
    .replaceAll('{ownerStatement}', ownerStatement)
    .replaceAll('{ownerStatementSha256}', sha256(ownerStatement));
  if (acceptance !== expectedAcceptance) fail('historical acceptance rendering');
  return {
    commit: HISTORICAL_COMMIT,
    tree: HISTORICAL_TREE,
    parents: [...HISTORICAL_PARENTS],
    manifest: {bytes: manifestBytes.byteLength, sha256: manifestSha256},
    productScope: manifest.staticAfterImages.find(({ path }) => path === 'strategy/product-scope.md'),
  };
}

export function verifyHistoricalR1ContinuousAuthority(repositoryRoot) {
  return {sourceMode: 'historical', ...assertHistoricalManifest(repositoryRoot)};
}

/** Current compatibility is retired and cannot prove R1 entry or delivery. */
export function verifyCurrentR1ContinuousAuthority() {
  throw new Error('R1_CONTINUOUS_AUTHORITY_HISTORICAL_ONLY: current compatibility is retired; use the explicit historical resolver for audit only');
}

/** Historical audit callers must opt into the immutable historical source. */
export function hasAcceptedR1ContinuousAuthority(repositoryRoot, options = {}) {
  if (options.sourceMode !== 'historical') return false;
  try {
    verifyHistoricalR1ContinuousAuthority(repositoryRoot);
    return true;
  } catch (error) {
    if (error?.code === 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID') throw error;
    return false;
  }
}
