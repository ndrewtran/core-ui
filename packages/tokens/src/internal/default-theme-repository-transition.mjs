import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';

const execFile = promisify(execFileCallback);

export const DEFAULT_THEME_REPOSITORY_STATES = Object.freeze({
  'phase-b': Object.freeze({
    artifactId: 'core:token:button-minimum',
    catalogPackageVersion: '0.2.0',
    reactPackageVersion: '0.0.0',
    sourcePath: 'catalog/tokens/button-minimum.json',
    tokenPackageVersion: '0.1.0',
    toolingPackageVersion: '0.2.0',
    webPackageVersion: '0.0.0',
  }),
  'decision-0004': Object.freeze({
    artifactId: 'core:token:button-minimum',
    catalogPackageVersion: '1.0.0',
    reactPackageVersion: '1.0.0',
    sourcePath: 'catalog/tokens/button-minimum.json',
    tokenPackageVersion: '1.0.0',
    toolingPackageVersion: '0.3.0',
    webPackageVersion: '1.0.0',
  }),
  'post-migration': Object.freeze({
    artifactId: 'core:token:default-theme',
    catalogPackageVersion: '2.0.0',
    reactPackageVersion: '1.0.1',
    sourcePath: 'catalog/tokens/default-theme.json',
    tokenPackageVersion: '2.0.0',
    toolingPackageVersion: '1.0.0',
    webPackageVersion: '1.0.1',
  }),
});

const SNAPSHOT_PATHS = Object.freeze([
  'catalog/components/button/artifact.json',
  'catalog/tokens/button-minimum.json',
  'catalog/tokens/default-theme.json',
  'packages/catalog/catalog-sources.json',
  'packages/catalog/generated',
  'packages/catalog/package.json',
  'packages/react/generated',
  'packages/react/package.json',
  'packages/tokens/package.json',
  'packages/tooling/command-registry.json',
  'packages/tooling/generated',
  'packages/tooling/package.json',
  'packages/tooling/src/local-resolver.mjs',
  'packages/tooling/src/pnpm-adapter.mjs',
  'packages/web/generated',
  'packages/web/package.json',
  'packages/web/src/generate.mjs',
]);

const TRANSITION_GENERATORS = Object.freeze([
  'packages/tokens/src/generate.mjs',
  'packages/catalog/src/generate.mjs',
  'packages/tooling/src/generate.mjs',
  'packages/web/src/generate.mjs',
  'packages/react/src/generate.mjs',
]);

async function exists(path) {
  return stat(path).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  });
}

async function json(path) {
  return parseJsonStrict(await readFile(path, 'utf8'));
}

const REACT_PRIMARY_AUTHORITY = Object.freeze([
  ['strategy/product-scope.md', 'b645bedfad6427f18535898938d2551ce8f6005a0e636c1288f60b8199578b73'],
  ['decisions/0010-amendment-01-react-primary-delivery.md', 'd91e01f48df64c3c0eeb334f64e2b615dbc836867670d4862868138d7ca34341'],
  ['decisions/0010-amendment-02-tale-styling-donor.md', 'd3631a416d3184707222955404c576c10f13f7621296708eb1a3bbc576255d6d'],
]);
const REACT_COMPREHENSIVE_AUTHORITY = Object.freeze([
  ['strategy/product-scope.md', '0cafc0218f0e6795a5d600acb424b4bf514972295c89b48e9042d7faa69a261f'],
  ['decisions/0010-amendment-01-react-primary-delivery.md', 'd91e01f48df64c3c0eeb334f64e2b615dbc836867670d4862868138d7ca34341'],
  ['decisions/0010-amendment-02-tale-styling-donor.md', 'd3631a416d3184707222955404c576c10f13f7621296708eb1a3bbc576255d6d'],
  ['decisions/0010-amendment-03-comprehensive-react-0-1.md', '8ad4be538ad7a35a8c03e01af573cad27a06225e4c91eba61bb7e693e498544a'],
]);
const REACT_PRIMARY_AUTHORITIES = Object.freeze([
  REACT_PRIMARY_AUTHORITY,
  REACT_COMPREHENSIVE_AUTHORITY,
]);

const R1_CONTINUOUS_AUTHORITY = Object.freeze({
  historicalCommit: '9a7cf99b0e74b2813998775138f0bc340e82c962',
  historicalTree: '470d0f7bc6751b7f66d49fbf4fdc2d62f6cc89f0',
  historicalParents: [
    'd4bba1a5f004d638936b79b673f0b1c4f9691426',
    '374db5debff52c64929ad3255a6824ce42af756c',
  ],
  acceptancePath: 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  candidatePath: 'decisions/0010-amendment-04-r1-continuous-execution-envelope.md',
  decisionPath: 'decisions/0010-amendment-04-r1-continuous-execution.md',
  decisionSha256: '321fefef4e723ee2d636a4ea6917436bf0babb5c6c7da2a5450e1ffc5c37871f',
  acceptanceSha256: '71134f9a3d30e1d98b55f07e3456f787593ebd8eefd3c6ee5257ac61aea83248',
  candidateSha256: '9c74a3227fb35a0ae6f6ab97eed4209014cb258408c3b78ce77947ca74b9fa5f',
  manifestPath: 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json',
  manifestSha256: '73cb2919c26985315557215ba8735139f8ace8ce31526b38a878982a16450111',
  productScopePath: 'strategy/product-scope.md',
  productScopeSha256: 'add747d5986c9039029a99b558ae719969fd18ac113051bbec478bd291da8632',
  currentAcceptancePath: 'decisions/0010-amendment-06-r1-change-intent-owner-acceptance.md',
  currentDecisionPath: 'decisions/0010-amendment-06-r1-change-intent-owner.md',
  currentArchitecturePath: 'strategy/monorepo-architecture.md',
  currentArchitectureSha256: '7fb12cb12cc512279a16169d309607213c0361d2708a04967682e9380bba8032',
  currentRoadmapPath: 'strategy/milestone-roadmap.md',
  currentRoadmapSha256: 'ff51b84497612ed59ffcaea71036894e74e4a461e21434f3d3d02dd1deeb2bb1',
  currentDecisionSha256: 'faa0fec0c62f67ece11b0db4f4dd73e4c5577405fb9594ee1f8b5a658fb3a91d',
  currentAcceptanceSha256: '4eab442c35b5a946ca8f977d7b9262024fdaf97f71e5c98261b0cb1fccfa6571',
});
const R1_AMENDMENT_07_AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-07-r1-external-review-ci-recovery-acceptance.md',
  decisionPath: 'decisions/0010-amendment-07-r1-external-review-ci-recovery.md',
  decisionSha256: 'c827da6fcb13b5b56e9c09ad9e6eb447f2c44588530b81ab1e243ff22bf2f011',
  architecturePath: R1_CONTINUOUS_AUTHORITY.currentArchitecturePath,
  architectureSha256: 'a5d3c3545521fc4a9f16ee69ae8c09733d34d7e104bcee33ce12331218b1f94b',
  roadmapPath: R1_CONTINUOUS_AUTHORITY.currentRoadmapPath,
  roadmapSha256: 'f044c3b3b5849f4567a819c54f667eaa6a6ecf4f3e538ada91cf1b74db1b60f6',
  candidateBytes: 20915,
  candidateSha256: '2a830bde833fa1fc2cd5b8343a045d76e1c590c92931a34ab37bf78491e3d13e',
});
const HISTORICAL_ANCESTRY_ERROR_CODE = 'R1_CONTINUOUS_AUTHORITY_LINEAGE_INVALID';

const R1_IMMUTABLE_PATHS = Object.freeze([
  R1_CONTINUOUS_AUTHORITY.productScopePath,
  R1_CONTINUOUS_AUTHORITY.candidatePath,
  R1_CONTINUOUS_AUTHORITY.manifestPath,
  R1_CONTINUOUS_AUTHORITY.decisionPath,
  R1_CONTINUOUS_AUTHORITY.acceptancePath,
  'decisions/0010-amendment-05-r1-policy-entrypoint.md',
  'decisions/0010-amendment-05-r1-policy-entrypoint-acceptance.md',
]);

const R1_IMMUTABLE_SHA256 = Object.freeze({
  [R1_CONTINUOUS_AUTHORITY.productScopePath]: R1_CONTINUOUS_AUTHORITY.productScopeSha256,
  [R1_CONTINUOUS_AUTHORITY.candidatePath]: R1_CONTINUOUS_AUTHORITY.candidateSha256,
  [R1_CONTINUOUS_AUTHORITY.manifestPath]: R1_CONTINUOUS_AUTHORITY.manifestSha256,
  [R1_CONTINUOUS_AUTHORITY.decisionPath]: R1_CONTINUOUS_AUTHORITY.decisionSha256,
  [R1_CONTINUOUS_AUTHORITY.acceptancePath]: R1_CONTINUOUS_AUTHORITY.acceptanceSha256,
  'decisions/0010-amendment-05-r1-policy-entrypoint.md': 'fae4d66e8040d5579cbb9a5883f56db38859ddd54b03d621080e131b3766ecb2',
  'decisions/0010-amendment-05-r1-policy-entrypoint-acceptance.md': '5f8ccd7b041011ab3645028d01fea49b4f50a84f6d98e61bc6fcabddeab9ff34',
});

const R1_OWNER_COMMENT_URL = /^https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*$/u;

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

function renderTemplate(template, substitutions) {
  return Object.entries(substitutions).reduce(
    (output, [name, value]) => output.replaceAll(`{${name}}`, value),
    template,
  );
}

async function gitBytes(repositoryRoot, args) {
  return (await execFile('git', ['-C', repositoryRoot, ...args], {encoding: 'buffer'})).stdout;
}

async function stageZeroBytes(repositoryRoot, relativePath) {
  const records = (await gitBytes(repositoryRoot, ['ls-files', '--stage', '-z', '--', relativePath]))
    .toString('utf8').split('\0').filter(Boolean);
  if (records.length !== 1) throw new Error('stage relationship');
  const separator = records[0].indexOf('\t');
  const [mode, blob, stage] = records[0].slice(0, separator).split(' ');
  if (records[0].slice(separator + 1) !== relativePath || mode !== '100644' || stage !== '0') {
    throw new Error('stage relationship');
  }
  const [indexed, index, worktree] = await Promise.all([
    gitBytes(repositoryRoot, ['cat-file', 'blob', blob]),
    gitBytes(repositoryRoot, ['show', `:0:${relativePath}`]),
    readFile(join(repositoryRoot, relativePath)),
  ]);
  if (!indexed.equals(index) || !indexed.equals(worktree)) throw new Error('source/index/worktree mismatch');
  return worktree;
}

async function verifyHistoricalR1Authority(repositoryRoot) {
  try {
    await gitBytes(repositoryRoot, [
      'merge-base', '--is-ancestor', R1_CONTINUOUS_AUTHORITY.historicalCommit, 'HEAD',
    ]);
  } catch {
    const error = new Error(
      'R1_CONTINUOUS_AUTHORITY_INVALID: historical protected merge must be an ancestor of current HEAD',
    );
    error.code = HISTORICAL_ANCESTRY_ERROR_CODE;
    throw error;
  }
  const details = (await gitBytes(repositoryRoot, [
    'show', '-s', '--format=%H%n%T%n%P', R1_CONTINUOUS_AUTHORITY.historicalCommit,
  ])).toString('utf8').trim().split('\n');
  if (details[0] !== R1_CONTINUOUS_AUTHORITY.historicalCommit
      || details[1] !== R1_CONTINUOUS_AUTHORITY.historicalTree
      || canonicalJson(details[2]?.split(' ') ?? []) !== canonicalJson(R1_CONTINUOUS_AUTHORITY.historicalParents)) {
    throw new Error('historical topology');
  }
  const manifestBytes = await gitBytes(repositoryRoot, [
    'show', `${R1_CONTINUOUS_AUTHORITY.historicalCommit}:${R1_CONTINUOUS_AUTHORITY.manifestPath}`,
  ]);
  if (sha256(manifestBytes) !== '73cb2919c26985315557215ba8735139f8ace8ce31526b38a878982a16450111') {
    throw new Error('historical manifest');
  }
  const manifest = parseJsonStrict(manifestBytes.toString('utf8'));
  if (canonicalJson(manifest) !== manifestBytes.toString('utf8') || !Array.isArray(manifest.staticAfterImages)) {
    throw new Error('historical manifest shape');
  }
  for (const image of manifest.staticAfterImages) {
    const bytes = await gitBytes(repositoryRoot, [
      'show', `${R1_CONTINUOUS_AUTHORITY.historicalCommit}:${image.path}`,
    ]);
    if (bytes.byteLength !== image.byteLength || sha256(bytes) !== image.digest) throw new Error('historical after-image');
  }
  const acceptance = await gitBytes(repositoryRoot, [
    'show', `${R1_CONTINUOUS_AUTHORITY.historicalCommit}:${R1_CONTINUOUS_AUTHORITY.acceptancePath}`,
  ]);
  if (sha256(acceptance) !== '71134f9a3d30e1d98b55f07e3456f787593ebd8eefd3c6ee5257ac61aea83248') {
    throw new Error('historical acceptance');
  }
}

async function rejectExtraSuccessorPaths(repositoryRoot) {
  const paths = (await gitBytes(repositoryRoot, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']))
    .toString('utf8').split('\0').filter(Boolean)
    .filter((path) => (
      path.startsWith('decisions/0010-amendment-06-')
        || path.startsWith('decisions/0010-amendment-07-')
    )).sort();
  const acceptedPathSets = [
    [],
    [R1_CONTINUOUS_AUTHORITY.currentAcceptancePath, R1_CONTINUOUS_AUTHORITY.currentDecisionPath],
    [
      R1_CONTINUOUS_AUTHORITY.currentAcceptancePath,
      R1_CONTINUOUS_AUTHORITY.currentDecisionPath,
      R1_AMENDMENT_07_AUTHORITY.acceptancePath,
      R1_AMENDMENT_07_AUTHORITY.decisionPath,
    ],
  ].map((set) => canonicalJson([...set].sort()));
  if (!acceptedPathSets.includes(canonicalJson(paths))) {
    throw new Error('successor path set');
  }
}

async function assertSuccessorPathsAbsent(repositoryRoot) {
  const present = [];
  for (const relativePath of [
    R1_CONTINUOUS_AUTHORITY.currentAcceptancePath,
    R1_CONTINUOUS_AUTHORITY.currentDecisionPath,
    R1_AMENDMENT_07_AUTHORITY.acceptancePath,
    R1_AMENDMENT_07_AUTHORITY.decisionPath,
  ]) {
    const indexedOrUntracked = (await gitBytes(repositoryRoot, [
      'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', relativePath,
    ])).toString('utf8').split('\0').filter(Boolean).length > 0;
    if (indexedOrUntracked || await exists(join(repositoryRoot, relativePath))) present.push(relativePath);
  }
  if (present.length > 0) {
    throw new Error(`CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: current successor paths must be absent for baseline: ${present.join(', ')}`);
  }
}

function validateAmendment07Acceptance(bytes) {
  // Orchestration owns approval, diff, and manifest identity validation; this
  // consumer checks only their strict record shape and internal statement binding.
  const text = bytes.toString('utf8');
  if (!text.startsWith('# Acceptance: Decision 0010 amendment 07\n')) throw new Error('acceptance title');
  const fields = new Map();
  for (const match of text.matchAll(/^- ([^:\n]+):[ \t]*(.*)$/gmu)) {
    if (fields.has(match[1])) throw new Error('acceptance duplicate field');
    fields.set(match[1], match[2]);
  }
  const expected = new Set([
    'Decision', 'Parent decision', 'Repository', 'Owner', 'Outcome', 'Candidate',
    'Pre-acceptance materialization diff', 'Execution manifest', 'Decision path',
    'Acceptance path', 'Approval instruction', 'Human acceptance', 'Approval timestamp',
    'Protected authority PR/merge',
  ]);
  if (canonicalJson([...fields.keys()].sort()) !== canonicalJson([...expected].sort())) throw new Error('acceptance shape');
  if (fields.get('Decision') !== '`core-ui:decision:0010:amendment:07`'
      || fields.get('Parent decision') !== '`core-ui:decision:0010`'
      || fields.get('Repository') !== '`ndrewtran/core-ui`'
      || fields.get('Owner') !== 'Andrew / `ndrewtran`'
      || fields.get('Outcome') !== 'Accepted'
      || fields.get('Decision path') !== `\`${R1_AMENDMENT_07_AUTHORITY.decisionPath}\``
      || fields.get('Acceptance path') !== `\`${R1_AMENDMENT_07_AUTHORITY.acceptancePath}\``
      || fields.get('Protected authority PR/merge') !== 'Pending; not claimed by this record') throw new Error('acceptance authority');
  const binding = (name, bytesExpected, digestExpected) => {
    const match = fields.get(name)?.match(/^([\d,]+) bytes, SHA-256 `([0-9a-f]{64})`$/u);
    return match && Number(match[1].replaceAll(',', '')) === bytesExpected && match[2] === digestExpected;
  };
  const diff = fields.get('Pre-acceptance materialization diff')?.match(/^((?:\d+|[1-9]\d{0,2}(?:,\d{3})+)) bytes, SHA-256 `([0-9a-f]{64})`$/u);
  const manifest = fields.get('Execution manifest')?.match(/^((?:\d+|[1-9]\d{0,2}(?:,\d{3})+)) bytes, SHA-256 `([0-9a-f]{64})`$/u);
  if (!binding('Candidate', R1_AMENDMENT_07_AUTHORITY.candidateBytes, R1_AMENDMENT_07_AUTHORITY.candidateSha256)
      || !diff || !manifest
      || !Number.isSafeInteger(Number(diff[1].replaceAll(',', '')))
      || !Number.isSafeInteger(Number(manifest[1].replaceAll(',', '')))) throw new Error('acceptance identity');
  const approval = text.match(/^- Approval instruction: “([^”\n]+)”$/mu)?.[1];
  const human = text.match(/^- Human acceptance: Andrew \/ `ndrewtran`: “([^”\n]+)”$/mu)?.[1];
  if (!approval || approval !== human || text.split(approval).length - 1 !== 2) throw new Error('acceptance statement');
  const timestamp = fields.get('Approval timestamp');
  if (timestamp !== 'Not recorded' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(timestamp)) throw new Error('acceptance timestamp');
  if (!/\bno (?:PR|checks|review|merge|implementation|Project|publication|release)\b/iu.test(text)
      || !/not claimed|has not occurred|has not yet occurred/iu.test(text)) throw new Error('acceptance nonclaims');
}

async function hasAcceptedR1ContinuousAuthority(repositoryRoot) {
  try {
    await verifyHistoricalR1Authority(repositoryRoot);
    await rejectExtraSuccessorPaths(repositoryRoot);
    const immutable = Object.fromEntries(await Promise.all(R1_IMMUTABLE_PATHS.map(async (path) => [
      path,
      await stageZeroBytes(repositoryRoot, path),
    ])));
    for (const path of R1_IMMUTABLE_PATHS) {
      if (sha256(immutable[path]) !== R1_IMMUTABLE_SHA256[path]) throw new Error('immutable authority');
    }
    const architecture = await stageZeroBytes(repositoryRoot, R1_CONTINUOUS_AUTHORITY.currentArchitecturePath);
    const roadmap = await stageZeroBytes(repositoryRoot, R1_CONTINUOUS_AUTHORITY.currentRoadmapPath);
    const architectureSha256 = sha256(architecture);
    const roadmapSha256 = sha256(roadmap);
    const hasCurrent = await Promise.all([
      stageZeroBytes(repositoryRoot, R1_CONTINUOUS_AUTHORITY.currentDecisionPath),
      stageZeroBytes(repositoryRoot, R1_CONTINUOUS_AUTHORITY.currentAcceptancePath),
    ]).then(() => true).catch(() => false);
    const hasAmendment07 = await Promise.all([
      stageZeroBytes(repositoryRoot, R1_AMENDMENT_07_AUTHORITY.decisionPath),
      stageZeroBytes(repositoryRoot, R1_AMENDMENT_07_AUTHORITY.acceptancePath),
    ]).then(() => true).catch(() => false);
    if (!hasCurrent && !hasAmendment07) {
      if (architectureSha256 === 'fa94c95f08c659f977af43a4438ffdb8d1774a06332786fae61f03f0799c085b'
          && roadmapSha256 === '9f321f93a537f69c5604de35f85053d8bf4748e937d6797c9262691e301247a1') {
        await assertSuccessorPathsAbsent(repositoryRoot);
        return true;
      }
      throw new Error('missing current successor');
    }
    if (hasAmendment07) {
      const predecessor = await Promise.all([
        stageZeroBytes(repositoryRoot, R1_CONTINUOUS_AUTHORITY.currentDecisionPath),
        stageZeroBytes(repositoryRoot, R1_CONTINUOUS_AUTHORITY.currentAcceptancePath),
      ]);
      if (sha256(predecessor[0]) !== R1_CONTINUOUS_AUTHORITY.currentDecisionSha256
          || sha256(predecessor[1]) !== R1_CONTINUOUS_AUTHORITY.currentAcceptanceSha256
          || architectureSha256 !== R1_AMENDMENT_07_AUTHORITY.architectureSha256
          || roadmapSha256 !== R1_AMENDMENT_07_AUTHORITY.roadmapSha256) throw new Error('amendment 07 authority');
      const [decision, acceptance] = await Promise.all([
        stageZeroBytes(repositoryRoot, R1_AMENDMENT_07_AUTHORITY.decisionPath),
        stageZeroBytes(repositoryRoot, R1_AMENDMENT_07_AUTHORITY.acceptancePath),
      ]);
      if (sha256(decision) !== R1_AMENDMENT_07_AUTHORITY.decisionSha256) throw new Error('amendment 07 decision');
      validateAmendment07Acceptance(acceptance);
      return true;
    }
    const currentPaths = [
      R1_CONTINUOUS_AUTHORITY.currentDecisionPath,
      R1_CONTINUOUS_AUTHORITY.currentAcceptancePath,
      R1_CONTINUOUS_AUTHORITY.currentArchitecturePath,
      R1_CONTINUOUS_AUTHORITY.currentRoadmapPath,
    ];
    const current = Object.fromEntries(await Promise.all(currentPaths.map(async (path) => [
      path,
      await stageZeroBytes(repositoryRoot, path),
    ])));
    const statement = 'I accept Core UI R1 ChangeIntent authority compatibility recovery candidate v2, SHA-256 b79aee6b4ff9167495ef2aec28055b73254865bd9f70ca2676e9bb679fc8299b. I authorize its exact eleven-path combined amendment 06 authority and private compatibility materialization, acceptance record, required authority issue, protected non-draft PR, and merge after all named deterministic checks and independent reviews pass; and continuation with the separate exact ten-path ChangeIntent prerequisite and post-prerequisite Project README reconciliation under the previously accepted continuous-execution envelope. The npm-publication and final R1-exit merge boundaries remain unchanged.';
    if (sha256(current[R1_CONTINUOUS_AUTHORITY.currentDecisionPath]) !== R1_CONTINUOUS_AUTHORITY.currentDecisionSha256
        || sha256(current[R1_CONTINUOUS_AUTHORITY.currentAcceptancePath]) !== R1_CONTINUOUS_AUTHORITY.currentAcceptanceSha256
        || sha256(current[R1_CONTINUOUS_AUTHORITY.currentArchitecturePath]) !== R1_CONTINUOUS_AUTHORITY.currentArchitectureSha256
        || sha256(current[R1_CONTINUOUS_AUTHORITY.currentRoadmapPath]) !== R1_CONTINUOUS_AUTHORITY.currentRoadmapSha256
        || !current[R1_CONTINUOUS_AUTHORITY.currentDecisionPath].toString('utf8').includes(statement)
        || !current[R1_CONTINUOUS_AUTHORITY.currentAcceptancePath].toString('utf8').includes(statement)
        || !current[R1_CONTINUOUS_AUTHORITY.currentDecisionPath].toString('utf8').includes('a700be0ac22c627fbc09c6378136b95d982d05c898a51bd126e5609f9bd8e8b9')
        || !current[R1_CONTINUOUS_AUTHORITY.currentAcceptancePath].toString('utf8').includes('a700be0ac22c627fbc09c6378136b95d982d05c898a51bd126e5609f9bd8e8b9')) {
      throw new Error('current successor authority');
    }
    return true;
  } catch (error) {
    if (error?.code === HISTORICAL_ANCESTRY_ERROR_CODE) throw error;
    return false;
  }
}

export async function hasAcceptedReactPrimaryAuthority(repositoryRoot) {
  for (const authority of REACT_PRIMARY_AUTHORITIES) {
    let matches = true;
    for (const [relativePath, expected] of authority) {
      const source = await readFile(join(repositoryRoot, relativePath)).catch(() => null);
      if (!source || createHash('sha256').update(source).digest('hex') !== expected) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return hasAcceptedR1ContinuousAuthority(repositoryRoot);
}

function replaceExact(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${label} expected one ${from}`);
  return source.replace(from, to);
}

async function setPackageVersion(repositoryRoot, relativePath, fromVersion, toVersion) {
  const path = join(repositoryRoot, relativePath);
  const source = await readFile(path, 'utf8');
  const current = parseJsonStrict(source).version;
  if (relativePath === 'packages/react/package.json' && current === '0.1.0-alpha.0'
    && await hasAcceptedReactPrimaryAuthority(repositoryRoot)) return;
  if (current !== fromVersion) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath} expected ${fromVersion}`);
  }
  await writeFile(path, replaceExact(
    source,
    `\"version\": \"${fromVersion}\"`,
    `\"version\": \"${toVersion}\"`,
    `${relativePath} version`,
  ));
}

async function setAuthoredState(repositoryRoot, from, to) {
  const buttonPath = join(repositoryRoot, 'catalog/components/button/artifact.json');
  const button = await readFile(buttonPath, 'utf8');
  if (Object.values(parseJsonStrict(button).bindings).some(({ tokenRecipe }) => tokenRecipe.source !== from.artifactId)) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${buttonPath}`);
  }
  if (from.artifactId !== to.artifactId) await writeFile(buttonPath, button.replaceAll(from.artifactId, to.artifactId));

  const sourcesPath = join(repositoryRoot, 'packages/catalog/catalog-sources.json');
  let sources = await readFile(sourcesPath, 'utf8');
  if (parseJsonStrict(sources).records.find(({ family }) => family === 'token-source')?.path !== from.sourcePath) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${sourcesPath}`);
  }
  if (from.sourcePath !== to.sourcePath) {
    sources = replaceExact(sources, `\"path\": \"${from.sourcePath}\"`, `\"path\": \"${to.sourcePath}\"`, sourcesPath);
  }
  const baselineLine = ',\n      "baselineOccurrencesPath": "packages/tokens/generated/tale-token-occurrences.json"';
  if (to === DEFAULT_THEME_REPOSITORY_STATES['phase-b']) {
    sources = replaceExact(sources, baselineLine, '', `${sourcesPath} baseline`);
  } else if (from === DEFAULT_THEME_REPOSITORY_STATES['phase-b']) {
    sources = replaceExact(
      sources,
      `\"path\": \"${to.sourcePath}\"`,
      `\"path\": \"${to.sourcePath}\"${baselineLine}`,
      `${sourcesPath} baseline`,
    );
  }
  await writeFile(sourcesPath, sources);

  await Promise.all([
    setPackageVersion(repositoryRoot, 'packages/catalog/package.json', from.catalogPackageVersion, to.catalogPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/react/package.json', from.reactPackageVersion, to.reactPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/tokens/package.json', from.tokenPackageVersion, to.tokenPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/tooling/package.json', from.toolingPackageVersion, to.toolingPackageVersion),
    setPackageVersion(repositoryRoot, 'packages/web/package.json', from.webPackageVersion, to.webPackageVersion),
  ]);

  const registryPath = join(repositoryRoot, 'packages/tooling/command-registry.json');
  let registry = await readFile(registryPath, 'utf8');
  if (parseJsonStrict(registry).cli.version !== from.toolingPackageVersion) {
    throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${registryPath} version`);
  }
  registry = replaceExact(
    registry,
    `\"version\": \"${from.toolingPackageVersion}\"`,
    `\"version\": \"${to.toolingPackageVersion}\"`,
    `${registryPath} version`,
  );
  if (from.artifactId !== to.artifactId) {
    registry = replaceExact(registry, from.artifactId, to.artifactId, `${registryPath} artifact ID`);
  }
  await writeFile(registryPath, registry);

  for (const relativePath of [
    'packages/tooling/src/local-resolver.mjs',
    'packages/tooling/src/pnpm-adapter.mjs',
  ]) {
    const path = join(repositoryRoot, relativePath);
    const source = await readFile(path, 'utf8');
    await writeFile(path, replaceExact(
      source,
      `const TOOLING_VERSION = '${from.toolingPackageVersion}';`,
      `const TOOLING_VERSION = '${to.toolingPackageVersion}';`,
      relativePath,
    ));
  }
  const webGeneratorPath = join(repositoryRoot, 'packages/web/src/generate.mjs');
  const webGenerator = await readFile(webGeneratorPath, 'utf8');
  if (from.artifactId !== to.artifactId) {
    await writeFile(webGeneratorPath, replaceExact(
      webGenerator,
      `id }) => id === '${from.artifactId}'`,
      `id }) => id === '${to.artifactId}'`,
      'packages/web/src/generate.mjs',
    ));
  }
}

export async function assertDefaultThemeRepositoryState(repositoryRoot, stateName) {
  const state = DEFAULT_THEME_REPOSITORY_STATES[stateName];
  if (!state) throw new Error(`CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: unknown repository state ${stateName}`);
  const button = await json(join(repositoryRoot, 'catalog/components/button/artifact.json'));
  if (Object.values(button.bindings).some(({ tokenRecipe }) => tokenRecipe.source !== state.artifactId)) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: component token recipe');
  }
  const sources = await json(join(repositoryRoot, 'packages/catalog/catalog-sources.json'));
  if (sources.records.find(({ family }) => family === 'token-source')?.path !== state.sourcePath) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: catalog source path');
  }
  const tokenSourceRecord = sources.records.find(({ family }) => family === 'token-source');
  const expectedBaseline = stateName === 'phase-b'
    ? undefined
    : 'packages/tokens/generated/tale-token-occurrences.json';
  if (tokenSourceRecord.baselineOccurrencesPath !== expectedBaseline) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: catalog baseline occurrence source');
  }
  for (const [relativePath, version] of [
    ['packages/catalog/package.json', state.catalogPackageVersion],
    ['packages/react/package.json', state.reactPackageVersion],
    ['packages/tokens/package.json', state.tokenPackageVersion],
    ['packages/tooling/package.json', state.toolingPackageVersion],
    ['packages/web/package.json', state.webPackageVersion],
  ]) {
    const actualVersion = (await json(join(repositoryRoot, relativePath))).version;
    const currentR1 = relativePath === 'packages/react/package.json'
      && actualVersion === '0.1.0-alpha.0'
      && await hasAcceptedReactPrimaryAuthority(repositoryRoot);
    if (actualVersion !== version && !currentR1) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath} version`);
    }
  }
  const registry = await json(join(repositoryRoot, 'packages/tooling/command-registry.json'));
  const get = registry.commands.find(({ name }) => name === 'get');
  if (
    registry.cli.version !== state.toolingPackageVersion
    || !get.examples.some((example) => example.includes(state.artifactId))
  ) throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: command registry');
  for (const relativePath of [
    'packages/tooling/src/local-resolver.mjs',
    'packages/tooling/src/pnpm-adapter.mjs',
  ]) {
    const source = await readFile(join(repositoryRoot, relativePath), 'utf8');
    if (!source.includes(`const TOOLING_VERSION = '${state.toolingPackageVersion}';`)) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath}`);
    }
  }
  const webGenerator = await readFile(join(repositoryRoot, 'packages/web/src/generate.mjs'), 'utf8');
  if (!webGenerator.includes(`id }) => id === '${state.artifactId}'`)) {
    throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: packages/web/src/generate.mjs');
  }
  const bundle = await json(join(repositoryRoot, 'packages/catalog/generated/catalog.json'));
  const tokenArtifacts = bundle.artifacts.filter(({ kind }) => kind === 'token');
  if (
    bundle.catalogVersion !== state.catalogPackageVersion
    || tokenArtifacts.length !== 1
    || tokenArtifacts[0].id !== state.artifactId
  ) throw new Error('CORE_TOKEN_IDENTITY_REFERENCE_STALE: generated catalog tuple');
  for (const [relativePath, version] of [
    ['packages/react/generated/compatibility.mjs', state.reactPackageVersion],
    ['packages/web/generated/compatibility.mjs', state.webPackageVersion],
  ]) {
    const source = await readFile(join(repositoryRoot, relativePath), 'utf8');
    const r1GeneratedCompatibility = relativePath === 'packages/react/generated/compatibility.mjs'
      && source.includes('0.1.0-alpha.0') && await hasAcceptedReactPrimaryAuthority(repositoryRoot);
    if (!source.includes(`\"version\":\"${version}\"`) && !r1GeneratedCompatibility) {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${relativePath}`);
    }
  }
  for (const script of TRANSITION_GENERATORS) {
    if (script === 'packages/react/src/generate.mjs'
      && await hasAcceptedReactPrimaryAuthority(repositoryRoot)
      && (await json(join(repositoryRoot, 'packages/react/package.json'))).version === '0.1.0-alpha.0') continue;
    await execFile(process.execPath, [script, '--check'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).catch((error) => {
      throw new Error(`CORE_TOKEN_IDENTITY_REFERENCE_STALE: ${script}: ${error.message}`);
    });
  }
}

async function snapshot(repositoryRoot) {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-default-theme-transition-'));
  const present = [];
  for (const relativePath of SNAPSHOT_PATHS) {
    const source = join(repositoryRoot, relativePath);
    if (!await exists(source)) continue;
    present.push(relativePath);
    const target = join(root, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
  return { present, root };
}

async function restore(repositoryRoot, saved) {
  for (const relativePath of SNAPSHOT_PATHS) await rm(join(repositoryRoot, relativePath), { recursive: true, force: true });
  for (const relativePath of saved.present) {
    const source = join(saved.root, relativePath);
    const target = join(repositoryRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
}

export async function transitionDefaultThemeRepository(repositoryRoot, {
  fromState,
  toState,
  writeSource,
  validate,
}) {
  const from = DEFAULT_THEME_REPOSITORY_STATES[fromState];
  const to = DEFAULT_THEME_REPOSITORY_STATES[toState];
  if (!from || !to || fromState === toState) throw new Error('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH: repository state transition');
  await assertDefaultThemeRepositoryState(repositoryRoot, fromState);
  const saved = await snapshot(repositoryRoot);
  try {
    await writeSource();
    await setAuthoredState(repositoryRoot, from, to);
    for (const generator of TRANSITION_GENERATORS) {
      if (generator === 'packages/react/src/generate.mjs'
        && await hasAcceptedReactPrimaryAuthority(repositoryRoot)
        && (await json(join(repositoryRoot, 'packages/react/package.json'))).version === '0.1.0-alpha.0') continue;
      await execFile(process.execPath, [generator], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
    }
    await assertDefaultThemeRepositoryState(repositoryRoot, toState);
    await validate();
  } catch (error) {
    await restore(repositoryRoot, saved);
    throw error;
  } finally {
    await rm(saved.root, { recursive: true, force: true });
  }
}
