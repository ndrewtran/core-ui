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

const AMENDMENT_07_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-07-r1-external-review-ci-recovery-acceptance.md',
  decisionPath: 'decisions/0010-amendment-07-r1-external-review-ci-recovery.md',
  decisionSha256: 'c827da6fcb13b5b56e9c09ad9e6eb447f2c44588530b81ab1e243ff22bf2f011',
  architecturePath: CURRENT_AUTHORITY.architecturePath,
  architectureSha256: 'a5d3c3545521fc4a9f16ee69ae8c09733d34d7e104bcee33ce12331218b1f94b',
  roadmapPath: CURRENT_AUTHORITY.roadmapPath,
  roadmapSha256: 'f044c3b3b5849f4567a819c54f667eaa6a6ecf4f3e538ada91cf1b74db1b60f6',
  productScopePath: CURRENT_AUTHORITY.productScopePath,
  productScopeSha256: CURRENT_AUTHORITY.productScopeSha256,
  candidateBytes: 20915,
  candidateSha256: '2a830bde833fa1fc2cd5b8343a045d76e1c590c92931a34ab37bf78491e3d13e',
});
const AMENDMENT_08_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery-acceptance.md',
  acceptanceSha256: '2c22b2fdeaf9c09758ec095f237b0e2eb72ea1799988e365f66e176cc1a9d36b',
  decisionPath: 'decisions/0010-amendment-08-r1-readme-historical-compatibility-recovery.md',
  decisionSha256: 'a8d9ea091430ca7b10f1ac9e05f98411b597207e4ae564a4f9e9a754d1c2235f',
  architecturePath: CURRENT_AUTHORITY.architecturePath,
  architectureSha256: AMENDMENT_07_AUTHORITY.architectureSha256,
  roadmapPath: CURRENT_AUTHORITY.roadmapPath,
  roadmapSha256: AMENDMENT_07_AUTHORITY.roadmapSha256,
  productScopePath: CURRENT_AUTHORITY.productScopePath,
  productScopeSha256: CURRENT_AUTHORITY.productScopeSha256,
});
const AMENDMENT_09_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md',
  decisionPath: 'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md',
  decisionSha256: 'b5df5ccf7841dbefc6c0a0f9fe8ff5b24c1693bd495182f4ad1552d640ed29e6',
  architecturePath: CURRENT_AUTHORITY.architecturePath,
  architectureSha256: '0f71afb246a12da877402f5e3617de06cd772c1961f4c03971b78cda8f713d0c',
  roadmapPath: CURRENT_AUTHORITY.roadmapPath,
  roadmapSha256: '73b10ee7c5d15811a732a0f925abb856d1e0fc212b2f48a72ae61cacb376ccd5',
  productScopePath: CURRENT_AUTHORITY.productScopePath,
  productScopeSha256: CURRENT_AUTHORITY.productScopeSha256,
  candidateBytes: 16596,
  candidateSha256: '30189a4aabc58e2628856eb1a7f75e34f8549e08291ea71e89ae672ccc46472d',
});
const AMENDMENT_09_ACCEPTANCE_NONCLAIM = 'This record claims acceptance only; it records no PR, checks, review, merge, implementation, Project, publication, or release outcome.';
const AMENDMENT_09_ACCEPTANCE_AUTHORIZED_ACTION = 'I authorize the exact ten-path authority materialization including the owner acceptance record; its authority issue, protected non-draft PR, and merge after all named deterministic checks and external authority review pass; the exact ten-path PR #92 recovery, protected intermediate merge, postmerge verification, bounded Project README reconciliation, and continuation under the existing R1 continuous-execution envelope. Npm publication and the final R1-exit PR merge remain separate stops.';

export function renderAmendment09AcceptanceStatement({candidateSha256, diffSha256, manifestSha256}) {
  return `I accept Core UI R1 Decision 0010 amendment 09 bootstrap-delivery recovery candidate v1, SHA-256 ${candidateSha256}; pre-acceptance materialization diff, SHA-256 ${diffSha256}; and execution manifest v1, SHA-256 ${manifestSha256}. ${AMENDMENT_09_ACCEPTANCE_AUTHORIZED_ACTION}`;
}

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

const currentSuccessorPaths = (authority) => Object.freeze([
  authority.acceptancePath,
  authority.decisionPath,
  authority.architecturePath,
  authority.roadmapPath,
]);
const CURRENT_SUCCESSOR_ADDITION_PATHS = Object.freeze([
  CURRENT_AUTHORITY.acceptancePath,
  CURRENT_AUTHORITY.decisionPath,
]);
const AMENDMENT_07_PATHS = Object.freeze([
  AMENDMENT_07_AUTHORITY.acceptancePath,
  AMENDMENT_07_AUTHORITY.decisionPath,
]);
const AMENDMENT_08_PATHS = Object.freeze([
  AMENDMENT_08_AUTHORITY.acceptancePath,
  AMENDMENT_08_AUTHORITY.decisionPath,
]);
const AMENDMENT_09_PATHS = Object.freeze([
  AMENDMENT_09_AUTHORITY.acceptancePath,
  AMENDMENT_09_AUTHORITY.decisionPath,
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
  const successorPaths = paths.filter((path) => (
    path.startsWith('decisions/0010-amendment-06-')
      || path.startsWith('decisions/0010-amendment-07-')
      || path.startsWith('decisions/0010-amendment-08-')
      || path.startsWith('decisions/0010-amendment-09-')
  ));
  const allowedPathSets = [
    [],
    [...CURRENT_SUCCESSOR_ADDITION_PATHS],
    [...CURRENT_SUCCESSOR_ADDITION_PATHS, ...AMENDMENT_07_PATHS],
    [...CURRENT_SUCCESSOR_ADDITION_PATHS, ...AMENDMENT_07_PATHS, ...AMENDMENT_08_PATHS],
    [...CURRENT_SUCCESSOR_ADDITION_PATHS, ...AMENDMENT_07_PATHS, ...AMENDMENT_08_PATHS, AMENDMENT_09_AUTHORITY.decisionPath],
    [...CURRENT_SUCCESSOR_ADDITION_PATHS, ...AMENDMENT_07_PATHS, ...AMENDMENT_08_PATHS, ...AMENDMENT_09_PATHS],
  ].map((set) => canonicalJson([...set].sort()));
  if (!allowedPathSets.includes(canonicalJson([...successorPaths].sort()))) {
    fail('current successor path set');
  }
}

function assertSuccessorPathsAbsent(repositoryRoot) {
  const present = [
    ...CURRENT_SUCCESSOR_ADDITION_PATHS,
    ...AMENDMENT_07_PATHS,
    ...AMENDMENT_08_PATHS,
    ...AMENDMENT_09_PATHS,
  ].filter((relativePath) => {
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

function assertAmendment07Acceptance(bytes) {
  // Orchestration owns approval, diff, and manifest identity validation; this
  // consumer checks only their strict record shape and internal statement binding.
  const text = bytes.toString('utf8');
  if (!text.startsWith('# Acceptance: Decision 0010 amendment 07\n')) {
    fail('amendment 07 acceptance title');
  }
  const fields = new Map();
  for (const match of text.matchAll(/^- ([^:\n]+):[ \t]*(.*)$/gmu)) {
    const [, name, value] = match;
    if (fields.has(name)) fail(`amendment 07 acceptance duplicate field ${name}`);
    fields.set(name, value);
  }
  const expectedFields = new Set([
    'Decision',
    'Parent decision',
    'Repository',
    'Owner',
    'Outcome',
    'Candidate',
    'Pre-acceptance materialization diff',
    'Execution manifest',
    'Decision path',
    'Acceptance path',
    'Approval instruction',
    'Human acceptance',
    'Approval timestamp',
    'Protected authority PR/merge',
  ]);
  if (canonicalJson([...fields.keys()].sort()) !== canonicalJson([...expectedFields].sort())) {
    fail('amendment 07 acceptance field shape');
  }
  if (fields.get('Decision') !== '`core-ui:decision:0010:amendment:07`'
      || fields.get('Parent decision') !== '`core-ui:decision:0010`'
      || fields.get('Repository') !== '`ndrewtran/core-ui`'
      || fields.get('Owner') !== 'Andrew / `ndrewtran`'
      || fields.get('Outcome') !== 'Accepted'
      || fields.get('Decision path') !== `\`${AMENDMENT_07_AUTHORITY.decisionPath}\``
      || fields.get('Acceptance path') !== `\`${AMENDMENT_07_AUTHORITY.acceptancePath}\``
      || fields.get('Protected authority PR/merge') !== 'Pending; not claimed by this record') {
    fail('amendment 07 acceptance authority binding');
  }
  const candidate = fields.get('Candidate')?.match(/^([\d,]+) bytes, SHA-256 `([0-9a-f]{64})`$/u);
  const diff = fields.get('Pre-acceptance materialization diff')?.match(/^((?:\d+|[1-9]\d{0,2}(?:,\d{3})+)) bytes, SHA-256 `([0-9a-f]{64})`$/u);
  const manifest = fields.get('Execution manifest')?.match(/^((?:\d+|[1-9]\d{0,2}(?:,\d{3})+)) bytes, SHA-256 `([0-9a-f]{64})`$/u);
  if (!candidate || Number(candidate[1].replaceAll(',', '')) !== AMENDMENT_07_AUTHORITY.candidateBytes
      || candidate[2] !== AMENDMENT_07_AUTHORITY.candidateSha256
      || !diff || !manifest
      || !Number.isSafeInteger(Number(diff[1].replaceAll(',', '')))
      || !Number.isSafeInteger(Number(manifest[1].replaceAll(',', '')))) {
    fail('amendment 07 acceptance candidate/diff/manifest binding');
  }
  const approval = text.match(/^- Approval instruction: “([^”\n]+)”$/mu)?.[1];
  const human = text.match(/^- Human acceptance: Andrew \/ `ndrewtran`: “([^”\n]+)”$/mu)?.[1];
  if (!approval || !human || approval !== human || text.split(approval).length - 1 !== 2) {
    fail('amendment 07 acceptance statement binding');
  }
  const timestamp = fields.get('Approval timestamp');
  if (timestamp !== 'Not recorded' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(timestamp)) {
    fail('amendment 07 acceptance timestamp');
  }
  if (!/\bno (?:PR|checks|review|merge|implementation|Project|publication|release)\b/iu.test(text)
      || !/not claimed|has not occurred|has not yet occurred/iu.test(text)) {
    fail('amendment 07 acceptance nonclaims');
  }
}

function assertAmendment06Predecessor(repositoryRoot) {
  for (const [relativePath, expected] of [
    [CURRENT_AUTHORITY.decisionPath, CURRENT_AUTHORITY.decisionSha256],
    [CURRENT_AUTHORITY.acceptancePath, CURRENT_AUTHORITY.acceptanceSha256],
  ]) {
    if (sha256(stageZeroBytes(repositoryRoot, relativePath)) !== expected) {
      fail(`immutable amendment 06 predecessor ${relativePath}`);
    }
  }
}

function assertAmendment08Successor(repositoryRoot) {
  const decision = stageZeroBytes(repositoryRoot, AMENDMENT_08_AUTHORITY.decisionPath);
  const acceptance = stageZeroBytes(repositoryRoot, AMENDMENT_08_AUTHORITY.acceptancePath);
  if (sha256(decision) !== AMENDMENT_08_AUTHORITY.decisionSha256
      || sha256(acceptance) !== AMENDMENT_08_AUTHORITY.acceptanceSha256
      || !decision.toString('utf8').startsWith('# Decision 0010 amendment 08: R1 README historical compatibility recovery\n')
      || !acceptance.toString('utf8').startsWith('# Acceptance: Decision 0010 amendment 08\n')) {
    fail('amendment 08 authority');
  }
}

function assertAmendment07Successor(repositoryRoot) {
  const decision = stageZeroBytes(repositoryRoot, AMENDMENT_07_AUTHORITY.decisionPath);
  const acceptance = stageZeroBytes(repositoryRoot, AMENDMENT_07_AUTHORITY.acceptancePath);
  if (sha256(decision) !== AMENDMENT_07_AUTHORITY.decisionSha256) fail('amendment 07 decision identity');
  assertAmendment07Acceptance(acceptance);
}

function assertAmendment09Decision(bytes) {
  if (sha256(bytes) !== AMENDMENT_09_AUTHORITY.decisionSha256) fail('amendment 09 decision identity');
  const text = bytes.toString('utf8');
  if (!text.startsWith('# Decision 0010 amendment 09: R1 bootstrap-delivery recovery\n')
      || !text.includes('`core-ui:decision:0010:amendment:09`')
      || !text.includes('exact recovered PR #92 ten-path ChangeIntent prerequisite')
      || !/No later bootstrap\s+or recovery exception is\s+implied\./u.test(text)) {
    fail('amendment 09 decision binding');
  }
}

function assertAmendment09Acceptance(bytes) {
  const text = bytes.toString('utf8');
  if (!text.startsWith('# Acceptance: Decision 0010 amendment 09\n')) fail('amendment 09 acceptance title');
  const fields = new Map();
  for (const match of text.matchAll(/^- ([^:\n]+):[ \t]*(.*)$/gmu)) {
    if (fields.has(match[1])) fail('amendment 09 acceptance duplicate field');
    fields.set(match[1], match[2]);
  }
  const expectedFields = new Set([
    'Decision', 'Parent decision', 'Repository', 'Owner', 'Outcome', 'Candidate',
    'Pre-acceptance materialization diff', 'Execution manifest', 'Decision path',
    'Acceptance path', 'Approval instruction', 'Human acceptance',
    'Approval timestamp', 'Protected authority PR/merge',
  ]);
  if (canonicalJson([...fields.keys()].sort()) !== canonicalJson([...expectedFields].sort())
      || fields.get('Decision') !== '`core-ui:decision:0010:amendment:09`'
      || fields.get('Parent decision') !== '`core-ui:decision:0010`'
      || fields.get('Repository') !== '`ndrewtran/core-ui`'
      || fields.get('Owner') !== 'Andrew / `ndrewtran`'
      || fields.get('Outcome') !== 'Accepted'
      || fields.get('Decision path') !== `\`${AMENDMENT_09_AUTHORITY.decisionPath}\``
      || fields.get('Acceptance path') !== `\`${AMENDMENT_09_AUTHORITY.acceptancePath}\``
      || fields.get('Protected authority PR/merge') !== 'Pending; not claimed by this record') {
    fail('amendment 09 acceptance authority binding');
  }
  const parseIdentity = (fieldName) => {
    const match = fields.get(fieldName)?.match(/^((?:[1-9]\d{0,2}(?:,\d{3})+)|(?:[1-9]\d*)) bytes, SHA-256 `([0-9a-f]{64})`$/u);
    if (!match || !Number.isSafeInteger(Number(match[1].replaceAll(',', ''))) || Number(match[1].replaceAll(',', '')) <= 0) {
      fail(`amendment 09 acceptance ${fieldName.toLowerCase()} identity`);
    }
    return {bytes: match[1], sha256: match[2]};
  };
  const candidate = parseIdentity('Candidate');
  const diff = parseIdentity('Pre-acceptance materialization diff');
  const manifest = parseIdentity('Execution manifest');
  if (candidate.bytes !== '16,596' || candidate.sha256 !== AMENDMENT_09_AUTHORITY.candidateSha256) {
    fail('amendment 09 acceptance candidate identity');
  }
  const approval = text.match(/^- Approval instruction: “([^”\n]+)”$/mu)?.[1];
  const human = text.match(/^- Human acceptance: Andrew \/ `ndrewtran`: “([^”\n]+)”$/mu)?.[1];
  const expectedStatement = renderAmendment09AcceptanceStatement({
    candidateSha256: candidate.sha256,
    diffSha256: diff.sha256,
    manifestSha256: manifest.sha256,
  });
  if (!approval || !human || approval !== human || approval !== expectedStatement || text.split(approval).length - 1 !== 2) {
    fail('amendment 09 acceptance statement');
  }
  const expectedRecord = [
    '# Acceptance: Decision 0010 amendment 09',
    '',
    '- Decision: `core-ui:decision:0010:amendment:09`',
    '- Parent decision: `core-ui:decision:0010`',
    '- Repository: `ndrewtran/core-ui`',
    '- Owner: Andrew / `ndrewtran`',
    '- Outcome: Accepted',
    `- Candidate: ${candidate.bytes} bytes, SHA-256 \`${candidate.sha256}\``,
    `- Pre-acceptance materialization diff: ${diff.bytes} bytes, SHA-256 \`${diff.sha256}\``,
    `- Execution manifest: ${manifest.bytes} bytes, SHA-256 \`${manifest.sha256}\``,
    `- Decision path: \`${AMENDMENT_09_AUTHORITY.decisionPath}\``,
    `- Acceptance path: \`${AMENDMENT_09_AUTHORITY.acceptancePath}\``,
    `- Approval instruction: “${expectedStatement}”`,
    `- Human acceptance: Andrew / \`ndrewtran\`: “${expectedStatement}”`,
    '- Approval timestamp: Not recorded',
    '- Protected authority PR/merge: Pending; not claimed by this record',
    '',
    AMENDMENT_09_ACCEPTANCE_NONCLAIM,
    '',
  ].join('\n');
  if (text !== expectedRecord) fail('amendment 09 acceptance record rendering');
}

function expectedCurrentSources(options, verifiedSources, authority = CURRENT_AUTHORITY) {
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
    const expected = authority[`${name}Sha256`];
    if (expected && sha256(bytes) !== expected) fail(`current successor ${name} identity`);
  }
  if (!sources.productScope.toString('utf8').startsWith('---\nscopeVersion: 6.0.1\n')) {
    fail('current Product Scope version');
  }
  if (authority === CURRENT_AUTHORITY) {
    const decisionText = sources.decision.toString('utf8');
    const acceptanceText = sources.acceptance.toString('utf8');
    const v2Statement = 'I accept Core UI R1 ChangeIntent authority compatibility recovery candidate v2, SHA-256 b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b. I authorize its exact eleven-path combined amendment 06 authority and private compatibility materialization, acceptance record, required authority issue, protected non-draft PR, and merge after all named deterministic checks and independent reviews pass; and continuation with the separate exact ten-path ChangeIntent prerequisite and post-prerequisite Project README reconciliation under the previously accepted continuous-execution envelope. The npm-publication and final R1-exit merge boundaries remain unchanged.';
    if (!decisionText.includes('a700be0ac22c627fbc09c6378136b95d982d05c898a51bd126e5609f9bd8e8b9')
        || !decisionText.includes('b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b')
        || !decisionText.includes(v2Statement)
        || !acceptanceText.includes(v2Statement)) {
      fail('current amendment 06 decision and acceptance binding');
    }
  } else if (authority === AMENDMENT_07_AUTHORITY) {
    assertAmendment07Acceptance(sources.acceptance);
  } else if (authority === AMENDMENT_08_AUTHORITY) {
    if (!sources.decision.toString('utf8').startsWith('# Decision 0010 amendment 08: R1 README historical compatibility recovery\n')
        || !sources.acceptance.toString('utf8').startsWith('# Acceptance: Decision 0010 amendment 08\n')) {
      fail('current amendment 08 authority binding');
    }
  } else {
    assertAmendment09Decision(sources.decision);
    if (sources.acceptance) assertAmendment09Acceptance(sources.acceptance);
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
  const amendment07Present = AMENDMENT_07_PATHS.every((relativePath) => {
    try {
      stageZeroBytes(repositoryRoot, relativePath);
      return true;
    } catch {
      return false;
    }
  });
  const amendment08Present = AMENDMENT_08_PATHS.every((relativePath) => {
    try {
      stageZeroBytes(repositoryRoot, relativePath);
      return true;
    } catch {
      return false;
    }
  });
  const amendment09DecisionPresent = (() => {
    try {
      stageZeroBytes(repositoryRoot, AMENDMENT_09_AUTHORITY.decisionPath);
      return true;
    } catch {
      return false;
    }
  })();
  const amendment09AcceptancePresent = (() => {
    try {
      stageZeroBytes(repositoryRoot, AMENDMENT_09_AUTHORITY.acceptancePath);
      return true;
    } catch {
      return false;
    }
  })();
  if (!amendment06Present && baselineArchitecture === BASELINE_CURRENT_AUTHORITY.architectureSha256
      && baselineRoadmap === BASELINE_CURRENT_AUTHORITY.roadmapSha256
      && !amendment07Present && !amendment08Present && !amendment09DecisionPresent) {
    assertSuccessorPathsAbsent(repositoryRoot);
    return {
      sourceMode: 'current',
      historical,
      baseline: true,
      successor: null,
    };
  }
  const authority = amendment09DecisionPresent
    ? AMENDMENT_09_AUTHORITY
    : amendment08Present
      ? AMENDMENT_08_AUTHORITY
      : amendment07Present
        ? AMENDMENT_07_AUTHORITY
        : CURRENT_AUTHORITY;
  if (amendment07Present || amendment08Present || amendment09DecisionPresent) {
    assertAmendment06Predecessor(repositoryRoot);
    if (!amendment07Present) fail('amendment 07 predecessor');
    assertAmendment07Successor(repositoryRoot);
    if (amendment08Present || amendment09DecisionPresent) {
      if (!amendment08Present) fail('amendment 08 predecessor');
      assertAmendment08Successor(repositoryRoot);
    }
    if (amendment09DecisionPresent) {
      const decision = stageZeroBytes(repositoryRoot, AMENDMENT_09_AUTHORITY.decisionPath);
      assertAmendment09Decision(decision);
      if (amendment09AcceptancePresent) {
        assertAmendment09Acceptance(stageZeroBytes(repositoryRoot, AMENDMENT_09_AUTHORITY.acceptancePath));
      }
    }
  }
  const verifiedSources = {
    decision: stageZeroBytes(repositoryRoot, authority.decisionPath),
    architecture: stageZeroBytes(repositoryRoot, authority.architecturePath),
    roadmap: stageZeroBytes(repositoryRoot, authority.roadmapPath),
    productScope: stageZeroBytes(repositoryRoot, authority.productScopePath),
  };
  if (!amendment09DecisionPresent || amendment09AcceptancePresent) {
    verifiedSources.acceptance = stageZeroBytes(repositoryRoot, authority.acceptancePath);
  }
  const sources = expectedCurrentSources(options, verifiedSources, authority);
  return {
    sourceMode: 'current',
    historical,
    successor: {
      accepted: !(amendment09DecisionPresent && !amendment09AcceptancePresent),
      paths: amendment09DecisionPresent && !amendment09AcceptancePresent
        ? [authority.decisionPath, authority.architecturePath, authority.roadmapPath]
        : [...currentSuccessorPaths(authority)],
      decision: {path: authority.decisionPath, bytes: sources.decision.byteLength, sha256: sha256(sources.decision)},
      ...(sources.acceptance ? {
        acceptance: {path: authority.acceptancePath, bytes: sources.acceptance.byteLength, sha256: sha256(sources.acceptance)},
      } : {}),
      architecture: {path: authority.architecturePath, bytes: sources.architecture.byteLength, sha256: sha256(sources.architecture)},
      roadmap: {path: authority.roadmapPath, bytes: sources.roadmap.byteLength, sha256: sha256(sources.roadmap)},
      productScope: {path: authority.productScopePath, bytes: sources.productScope.byteLength, sha256: sha256(sources.productScope), version: '6.0.1'},
    },
  };
}

// Consumers select only the fixed historical audit state or fixed accepted
// successor after-images. There is deliberately no ref/path override.
export function hasAcceptedR1ContinuousAuthority(repositoryRoot, options = {}) {
  try {
    if (options.sourceMode === 'historical') {
      verifyHistoricalR1ContinuousAuthority(repositoryRoot);
    } else if (options.sourceMode === undefined || options.sourceMode === 'current') {
      const result = verifyCurrentR1ContinuousAuthority(repositoryRoot, options);
      if (result.successor?.accepted === false) return false;
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
