import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';

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

const CURRENT_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
  acceptanceSha256: '4eab442c35b5a946ca8f977d7b9262024fdaf97f71e5c98261b0cb1fccfa6571',
  decisionPath: 'decisions/0010-amendment-06-r1-change-intent-owner.md',
  decisionSha256: 'faa0fec0c62f67ece11b0db4f4dd73e4c5577405fb9594ee1f8b5a658fb3a91d',
  architecturePath: 'strategy/monorepo-architecture.md',
  architectureSha256: '7fb12cb12cc512279a16169d309607213c0361d2708a04967682e9380bba8032',
  roadmapPath: 'strategy/milestone-roadmap.md',
  roadmapSha256: 'ff51b84497612ed59ffcaea71036894e74e4a461e21434f3d3d02dd1deeb2bb1',
  productScopePath: 'strategy/product-scope.md',
  productScopeSha256: 'add747d5986c9039029a99b558ae719969fd18ac113051bbec478bd291da8632',
});

const BASELINE_CURRENT_AUTHORITY = Object.freeze({
  architectureSha256: 'fa94c95f08c659f977af43a4438ffdb8d1774a06332786fae61f03f0799c085b',
  roadmapSha256: '9f321f93a537f69c5604de35f85053d8bf4748e937d6797c9262691e301247a1',
  productScopeSha256: CURRENT_AUTHORITY.productScopeSha256,
});

const IMMUTABLE_CURRENT_PATHS = Object.freeze([
  HISTORICAL_AUTHORITY.acceptancePath,
  HISTORICAL_AUTHORITY.candidatePath,
  HISTORICAL_AUTHORITY.decisionPath,
  HISTORICAL_AUTHORITY.manifestPath,
  CURRENT_AUTHORITY.productScopePath,
  'decisions/0010-amendment-04-r1-continuous-execution.md',
  'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  'decisions/0010-amendment-05-r1-policy-entrypoint.md',
  'decisions/0010-amendment-05-r1-policy-entrypoint-acceptance.md',
]);

const CURRENT_SUCCESSOR_PATHS = Object.freeze([
  CURRENT_AUTHORITY.acceptancePath,
  CURRENT_AUTHORITY.decisionPath,
  CURRENT_AUTHORITY.architecturePath,
  CURRENT_AUTHORITY.roadmapPath,
]);
const CURRENT_SUCCESSOR_ADDITION_PATHS = Object.freeze([
  CURRENT_AUTHORITY.acceptancePath,
  CURRENT_AUTHORITY.decisionPath,
]);

const IMMUTABLE_CURRENT_SHA256 = Object.freeze({
  [HISTORICAL_AUTHORITY.acceptancePath]: HISTORICAL_AUTHORITY.acceptanceSha256,
  [HISTORICAL_AUTHORITY.candidatePath]: '9c74a3227fb35a0ae6f6ab97eed4209014cb258408c3b78ce77947ca74b9fa5f',
  [HISTORICAL_AUTHORITY.decisionPath]: HISTORICAL_AUTHORITY.decisionSha256,
  [HISTORICAL_AUTHORITY.manifestPath]: HISTORICAL_AUTHORITY.manifestSha256,
  [CURRENT_AUTHORITY.productScopePath]: CURRENT_AUTHORITY.productScopeSha256,
  'decisions/0010-amendment-04-r1-continuous-execution.md': HISTORICAL_AUTHORITY.decisionSha256,
  'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md': HISTORICAL_AUTHORITY.acceptanceSha256,
  'decisions/0010-amendment-05-r1-policy-entrypoint.md': 'fae4d66e8040d5579cbb9a5883f56db38859ddd54b03d621080e131b3766ecb2',
  'decisions/0010-amendment-05-r1-policy-entrypoint-acceptance.md': '5f8ccd7b041011ab3645028d01fea49b4f50a84f6d98e61bc6fcabddeab9ff34',
});

const OWNER_COMMENT_URL = /^https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*$/u;
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const fail = (message) => { throw new Error(`R1_CONTINUOUS_AUTHORITY_INVALID: ${message}`); };
const failHistoricalAncestry = (message) => {
  const error = new Error(`R1_CONTINUOUS_AUTHORITY_INVALID: ${message}`);
  error.code = 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID';
  throw error;
};
const renderTemplate = (template, substitutions) => Object.entries(substitutions).reduce(
  (output, [name, value]) => output.replaceAll(`{${name}}`, value),
  template,
);

function git(repositoryRoot, args, encoding = 'utf8') {
  return execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function historicalBlob(repositoryRoot, relativePath) {
  try {
    return git(repositoryRoot, ['show', `${HISTORICAL_COMMIT}:${relativePath}`], 'buffer');
  } catch {
    fail(`historical tree missing ${relativePath}`);
  }
}

function worktreeBytes(repositoryRoot, relativePath) {
  try {
    return readFileSync(join(repositoryRoot, relativePath));
  } catch {
    fail(`current successor missing ${relativePath}`);
  }
}

function stageZeroBytes(repositoryRoot, relativePath) {
  let records;
  try {
    records = git(repositoryRoot, ['ls-files', '--stage', '-z', '--', relativePath], 'buffer')
      .toString('utf8').split('\0').filter(Boolean);
  } catch {
    fail(`current source/index relationship ${relativePath}`);
  }
  if (records.length !== 1) fail(`current source/index relationship ${relativePath}`);
  const separator = records[0].indexOf('\t');
  if (separator < 0 || records[0].slice(separator + 1) !== relativePath) {
    fail(`current source/index relationship ${relativePath}`);
  }
  const [mode, blob, stage] = records[0].slice(0, separator).split(' ');
  if (mode !== '100644' || stage !== '0' || !/^[0-9a-f]{40}$/u.test(blob) || /^0{40}$/u.test(blob)) {
    fail(`current source/index relationship ${relativePath}`);
  }
  const indexed = git(repositoryRoot, ['cat-file', 'blob', blob], 'buffer');
  const index = git(repositoryRoot, ['show', `:0:${relativePath}`], 'buffer');
  const worktree = worktreeBytes(repositoryRoot, relativePath);
  if (!indexed.equals(index) || !indexed.equals(worktree)) {
    fail(`current source/index/worktree mismatch ${relativePath}`);
  }
  return worktree;
}

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
  if (!ownerCommentUrl || !OWNER_COMMENT_URL.test(ownerCommentUrl)) fail('historical owner record');
  const manifestSha256 = sha256(manifestBytes);
  const ownerStatement = renderTemplate(manifest.acceptanceRecordRenderer.ownerStatementTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
  });
  const expectedAcceptance = renderTemplate(manifest.acceptanceRecordRenderer.outputTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
    ownerCommentUrl,
    ownerStatement,
    ownerStatementSha256: sha256(ownerStatement),
  });
  if (acceptance !== expectedAcceptance) fail('historical acceptance rendering');
  return {
    commit: HISTORICAL_COMMIT,
    tree: HISTORICAL_TREE,
    parents: [...HISTORICAL_PARENTS],
    manifest: {bytes: manifestBytes.byteLength, sha256: manifestSha256},
    productScope: manifest.staticAfterImages.find(({ path }) => path === 'strategy/product-scope.md'),
  };
}

function assertCurrentImmutableSources(repositoryRoot) {
  for (const relativePath of IMMUTABLE_CURRENT_PATHS) {
    const bytes = stageZeroBytes(repositoryRoot, relativePath);
    if (sha256(bytes) !== IMMUTABLE_CURRENT_SHA256[relativePath]) {
      fail(`immutable amendment history ${relativePath}`);
    }
  }
}

function assertNoExtraSuccessorPaths(repositoryRoot) {
  let paths;
  try {
    paths = git(repositoryRoot, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], 'buffer')
      .toString('utf8').split('\0').filter(Boolean);
  } catch {
    fail('current successor path inventory');
  }
  const amendment06Paths = paths.filter((path) => path.startsWith('decisions/0010-amendment-06-'));
  if (amendment06Paths.length !== 0
      && canonicalJson([...amendment06Paths].sort()) !== canonicalJson([
        CURRENT_AUTHORITY.acceptancePath,
        CURRENT_AUTHORITY.decisionPath,
      ].sort())) {
    fail('current successor path set');
  }
}

function assertSuccessorPathsAbsent(repositoryRoot) {
  const present = CURRENT_SUCCESSOR_ADDITION_PATHS.filter((relativePath) => {
    let indexedOrUntracked;
    try {
      indexedOrUntracked = git(repositoryRoot, [
        'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', relativePath,
      ], 'buffer').toString('utf8').split('\0').filter(Boolean).length > 0;
    } catch {
      fail('current successor path inventory');
    }
    let worktreePresent;
    try {
      readFileSync(join(repositoryRoot, relativePath));
      worktreePresent = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') fail('current successor path inventory');
      worktreePresent = false;
    }
    return indexedOrUntracked || worktreePresent;
  });
  if (present.length > 0) fail(`current successor paths must be absent for baseline: ${present.join(', ')}`);
}

function expectedCurrentSources(options, verifiedSources) {
  const sources = {...verifiedSources};
  const overrides = {
    decision: options.authorityDecisionSource,
    acceptance: options.authorityAcceptanceSource,
    architecture: options.authorityArchitectureSource,
    roadmap: options.authorityRoadmapSource,
    productScope: options.productScopeSource,
  };
  for (const [name, override] of Object.entries(overrides)) {
    if (override !== undefined && !Buffer.from(override).equals(sources[name])) {
      fail(`current successor ${name} source/index/worktree mismatch`);
    }
  }
  for (const [name, bytes] of Object.entries(sources)) {
    const expected = CURRENT_AUTHORITY[`${name}Sha256`];
    if (!expected || sha256(bytes) !== expected) fail(`current successor ${name} identity`);
  }
  if (!sources.productScope.toString('utf8').startsWith('---\nscopeVersion: 6.0.1\n')) {
    fail('current Product Scope version');
  }
  const decisionText = sources.decision.toString('utf8');
  const acceptanceText = sources.acceptance.toString('utf8');
  const v2Statement = 'I accept Core UI R1 ChangeIntent authority compatibility recovery candidate v2, SHA-256 b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b. I authorize its exact eleven-path combined amendment 06 authority and private compatibility materialization, acceptance record, required authority issue, protected non-draft PR, and merge after all named deterministic checks and independent reviews pass; and continuation with the separate exact ten-path ChangeIntent prerequisite and post-prerequisite Project README reconciliation under the previously accepted continuous-execution envelope. The npm-publication and final R1-exit merge boundaries remain unchanged.';
  if (!decisionText.includes('a700be0ac22c627fbc09c6378136b95d982d05c898a51bd126e5609f9bd8e8b9')
      || !decisionText.includes('b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b')
      || !decisionText.includes(v2Statement)
      || !acceptanceText.includes(v2Statement)) {
    fail('current amendment 06 decision and acceptance binding');
  }
  return sources;
}

export function verifyHistoricalR1ContinuousAuthority(repositoryRoot) {
  return {sourceMode: 'historical', ...assertHistoricalManifest(repositoryRoot)};
}

export function verifyCurrentR1ContinuousAuthority(repositoryRoot, options = {}) {
  const historical = assertHistoricalManifest(repositoryRoot);
  assertCurrentImmutableSources(repositoryRoot);
  assertNoExtraSuccessorPaths(repositoryRoot);
  const baselineArchitecture = sha256(stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.architecturePath));
  const baselineRoadmap = sha256(stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.roadmapPath));
  const amendment06Present = [CURRENT_AUTHORITY.acceptancePath, CURRENT_AUTHORITY.decisionPath]
    .every((relativePath) => {
      try {
        stageZeroBytes(repositoryRoot, relativePath);
        return true;
      } catch {
        return false;
      }
    });
  if (!amendment06Present && baselineArchitecture === BASELINE_CURRENT_AUTHORITY.architectureSha256
      && baselineRoadmap === BASELINE_CURRENT_AUTHORITY.roadmapSha256) {
    assertSuccessorPathsAbsent(repositoryRoot);
    return {
      sourceMode: 'current',
      historical,
      baseline: true,
      successor: null,
    };
  }
  const verifiedSources = {
    decision: stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.decisionPath),
    acceptance: stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.acceptancePath),
    architecture: stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.architecturePath),
    roadmap: stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.roadmapPath),
    productScope: stageZeroBytes(repositoryRoot, CURRENT_AUTHORITY.productScopePath),
  };
  const sources = expectedCurrentSources(options, verifiedSources);
  return {
    sourceMode: 'current',
    historical,
    successor: {
      paths: [...CURRENT_SUCCESSOR_PATHS],
      decision: {bytes: sources.decision.byteLength, sha256: sha256(sources.decision)},
      acceptance: {bytes: sources.acceptance.byteLength, sha256: sha256(sources.acceptance)},
      architecture: {bytes: sources.architecture.byteLength, sha256: sha256(sources.architecture)},
      roadmap: {bytes: sources.roadmap.byteLength, sha256: sha256(sources.roadmap)},
      productScope: {bytes: sources.productScope.byteLength, sha256: sha256(sources.productScope), version: '6.0.1'},
    },
  };
}

// Consumers select only the fixed historical audit state or the fixed current
// amendment-06 successor. There is deliberately no ref/path override.
export function hasAcceptedR1ContinuousAuthority(repositoryRoot, options = {}) {
  try {
    if (options.sourceMode === 'historical') {
      verifyHistoricalR1ContinuousAuthority(repositoryRoot);
    } else if (options.sourceMode === undefined || options.sourceMode === 'current') {
      verifyCurrentR1ContinuousAuthority(repositoryRoot, options);
    } else {
      return false;
    }
    return true;
  } catch (error) {
    if (error?.code === 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID') throw error;
    if (error?.code && error.code !== 'ENOENT') throw error;
    return false;
  }
}
