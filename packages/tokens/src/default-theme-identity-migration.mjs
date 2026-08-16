import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { canonicalDigest, canonicalJson, parseJsonStrict, validateFamily } from '@core-ui/schema';
import {
  assertDefaultThemeRepositoryState,
  transitionDefaultThemeRepository,
} from './internal/default-theme-repository-transition.mjs';

const execFile = promisify(execFileCallback);
const HISTORICAL_PRODUCT_SCOPE_SOURCE = 'b27cb4fb3d71f8feca9505684201286d76f62d42';
const AUTHORITY = Object.freeze({
  acceptance: Object.freeze({ bytes: 495, sha256: 'sha256:48ac9f5af1990743224ab8fbdf093d08c092268842714a7d238a7d21b03c5c57' }),
  decision: Object.freeze({ bytes: 26344, sha256: 'sha256:747eb372d7cb53351d1cc30f4092cd703feb7986d3ea12814da6974616b85262' }),
  applicabilityAcceptance: Object.freeze({ bytes: 495, path: 'decisions/0006-phase-c-applicability-topology-acceptance.json', sha256: 'sha256:f94112578a689735a720ba66c75e695d5a7c3f01dbb88e34d56a1b7492f4e34f' }),
  applicabilityDecision: Object.freeze({ bytes: 48867, path: 'decisions/0006-phase-c-applicability-topology.json', sha256: 'sha256:5451cad5a62d9acf2bf53bfe7cbda6419a982232f062d926130cab7ebba39c6c' }),
  deliveryAcceptance: Object.freeze({ bytes: 558, path: 'decisions/0007-delivery-workflow-authority-acceptance.json', sha256: 'sha256:282defb18bd1d897c14dc62e3ebc44cabf0d3cdbf4cd8c0419d71b9d1d03ed8d' }),
  deliveryDecision: Object.freeze({ bytes: 40822, path: 'decisions/0007-delivery-workflow-authority.json', sha256: 'sha256:97aa9d33adb4da0cd9b6bf4d692993b8b8938401d73cb7cb20912c3f6e382c8f' }),
  phaseCProductScope: Object.freeze({ bytes: 86594, path: 'strategy/product-scope.md', sha256: 'sha256:0346e60bc4e7e448fc50723604f51ae6796bcd77ddb799773a95029db21bd309' }),
  productScope: Object.freeze({ bytes: 90165, path: 'strategy/product-scope.md', sha256: 'sha256:7c8404e20d01f6a0cc975b17a7893f5594f6f0d313806a6fced9d0c62d886873' }),
});
const CURRENT_REFERENCE_SCAN_EXCLUSIONS = new Set([
  'packages/tokens/src/default-theme-identity-migration.mjs',
  'packages/tokens/src/tale-token-materialization.mjs',
  'tooling/audits/repository-policy/src/default-theme-identity-correction-verify.mjs',
  'tooling/audits/repository-policy/src/tale-token-baseline-reset-verify.mjs',
]);
const COMMITTED_FILE_SHA_CACHE = new Map();
const MANIFEST_KEYS = Object.freeze(['algorithm', 'paths', 'profile', 'sha256']);
const REFERENCE_KEYS = Object.freeze(['path', 'sha256']);
const SUPERSESSION_KEYS = Object.freeze([
  'affectedAssertions',
  'authorization',
  'currentApplicabilityManifest',
  'disclosureClass',
  'effectiveAt',
  'evidenceStatus',
  'historicalIndex',
  'owner',
  'previousSupersession',
  'reasonCode',
  'replacementPlan',
  'replacementStatus',
  'schema',
  'sourceRevision',
  'sourceTree',
  'supersededApplicabilityManifest',
]);

export const DEFAULT_THEME_IDENTITY_PATHS = Object.freeze({
  acceptance: 'decisions/0005-default-theme-token-source-identity-acceptance.json',
  decision: 'decisions/0005-default-theme-token-source-identity.json',
  postMigration: 'catalog/tokens/default-theme.json',
  preMigration: 'catalog/tokens/button-minimum.json',
});

export const DEFAULT_THEME_IDENTITY = Object.freeze({
  postMigration: Object.freeze({
    artifactId: 'core:token:default-theme',
    bytes: 548292,
    canonicalSha256: 'sha256:01982f878f3f4b29bf889fcc0cc9577e1bde3fb69a646f1972e74dd8b9347757',
    rawSha256: 'sha256:cd4aca7d436ce080bed36f1358924bed0c130dacb94455dfb5eb9cf96eabdb8f',
  }),
  preMigration: Object.freeze({
    artifactId: 'core:token:button-minimum',
    bytes: 548293,
    canonicalSha256: 'sha256:670f2a45ada8c90b39e6de4bc4e6fef9e175313607c428067c21b7c2b1c5eac2',
    rawSha256: 'sha256:3ba5d4f87176191f9af629ae3942e5e08cb0c280ff658d04f7afb92e16ef6dd9',
  }),
});

export class DefaultThemeIdentityMigrationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'DefaultThemeIdentityMigrationError';
  }
}

function fail(code, message) {
  throw new DefaultThemeIdentityMigrationError(code, message);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function strict(bytes, label) {
  try {
    return parseJsonStrict(bytes);
  } catch (error) {
    fail('CORE_TOKEN_IDENTITY_SOURCE_DRIFT', `${label}: ${error.message}`);
  }
}

function strictCanonical(bytes, label) {
  const value = strict(bytes, label);
  if (canonicalJson(value) !== bytes) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${label} canonical JSON`);
  }
  return value;
}

function assertExact(bytes, expected, label) {
  const value = strict(bytes, label);
  if (
    Buffer.byteLength(bytes) !== expected.bytes
    || sha256(bytes) !== expected.rawSha256
    || canonicalDigest(value) !== expected.canonicalSha256
    || value.id !== expected.artifactId
  ) fail('CORE_TOKEN_IDENTITY_SOURCE_DRIFT', label);
  validateFamily('token-source', value);
  return value;
}

function assertKeys(value, expected, label) {
  const actual = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  if (canonicalJson(actual) !== canonicalJson([...expected].sort())) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${label} fields`);
  }
}

function assertCanonicalReference(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', label);
  }
}

async function exactAuthorityFile(repositoryRoot, path, expected) {
  const bytes = await readFile(join(repositoryRoot, path), 'utf8').catch(() => null);
  if (
    bytes === null
    || Buffer.byteLength(bytes) !== expected.bytes
    || sha256(bytes) !== expected.sha256
  ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', path);
  return bytes;
}

async function exactHistoricalAuthorityFile(repositoryRoot, revision, path, expected) {
  const result = await execFile('git', ['show', `${revision}:${path}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).catch(() => null);
  const bytes = result?.stdout ?? null;
  if (
    bytes === null
    || Buffer.byteLength(bytes) !== expected.bytes
    || sha256(bytes) !== expected.sha256
  ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', path);
  return bytes;
}

async function filesUnder(repositoryRoot, relativePath) {
  const metadata = await stat(join(repositoryRoot, relativePath)).catch((error) => (
    error?.code === 'ENOENT' ? null : Promise.reject(error)
  ));
  if (metadata === null) return [];
  if (!metadata.isDirectory()) return [relativePath];
  const output = [];
  for (const entry of (await readdir(join(repositoryRoot, relativePath))).sort()) {
    output.push(...await filesUnder(repositoryRoot, join(relativePath, entry)));
  }
  return output;
}

async function revisionManifest(repositoryRoot, revision, paths) {
  const entries = new Map();
  for (const path of paths) {
    const tree = await execFile('git', ['ls-tree', '-r', revision, '--', path], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }).catch(() => null);
    if (tree === null) fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', `revision ${revision} unavailable`);
    for (const line of tree.stdout.trim().split('\n').filter(Boolean)) {
      const match = line.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/u);
      if (!match) fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', `invalid tree entry ${line}`);
      entries.set(match[2], { blob: match[1], path: match[2] });
    }
  }
  return [...entries.values()].sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
}

async function assertRevisionPathsExact(
  repositoryRoot,
  revision,
  paths,
  label,
  errorCode = 'CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT',
) {
  const expected = await revisionManifest(repositoryRoot, revision, paths);
  const actualPaths = [];
  for (const path of paths) actualPaths.push(...await filesUnder(repositoryRoot, path));
  const expectedPaths = expected.map(({ path }) => path).sort();
  const sortedActual = [...new Set(actualPaths)].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(expectedPaths)) {
    fail(errorCode, `${label} path set`);
  }
  for (const entry of expected) {
    const current = await execFile('git', ['hash-object', '--', entry.path], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).catch(() => null);
    if (current?.stdout.trim() !== entry.blob) fail(errorCode, entry.path);
  }
}

async function committedManifestEntries(repositoryRoot, revision, paths) {
  const names = await execFile('git', ['ls-tree', '-r', '-z', '--name-only', revision, '--', ...paths], {
    cwd: repositoryRoot,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  }).catch(() => null);
  if (names === null) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${revision} manifest paths`);
  const entries = [];
  for (const path of names.stdout.toString('utf8').split('\0').filter(Boolean).sort((left, right) => left.localeCompare(right))) {
    const cacheKey = `${repositoryRoot}\0${revision}\0${path}`;
    let digest = COMMITTED_FILE_SHA_CACHE.get(cacheKey);
    if (!digest) {
      const bytes = await execFile('git', ['show', `${revision}:${path}`], {
        cwd: repositoryRoot,
        encoding: 'buffer',
        maxBuffer: 32 * 1024 * 1024,
      }).catch(() => null);
      if (bytes === null) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${revision}:${path}`);
      digest = sha256(bytes.stdout);
      COMMITTED_FILE_SHA_CACHE.set(cacheKey, digest);
    }
    entries.push({ path, sha256: digest });
  }
  return entries;
}

async function assertIntroductionParent(
  repositoryRoot,
  indexPath,
  sourceRevision,
  { allowPendingCapture = false } = {},
) {
  const additions = await execFile('git', ['log', '--format=%H', '--diff-filter=A', '--', indexPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).catch(() => null);
  if (additions === null) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${indexPath} history unavailable`);
  }
  const commits = additions.stdout.trim().split('\n').filter(Boolean);
  if (commits.length === 0 && allowPendingCapture) {
    const head = await execFile('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).catch(() => null);
    const rootPath = dirname(indexPath);
    const status = await execFile(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all', '--', rootPath],
      { cwd: repositoryRoot, encoding: 'utf8' },
    ).catch(() => null);
    const pendingPaths = status?.stdout.trim().split('\n').filter(Boolean).map((line) => (
      line.startsWith('?? ') ? line.slice(3) : null
    )) ?? [];
    const actualPaths = await filesUnder(repositoryRoot, rootPath);
    if (
      head?.stdout.trim() !== sourceRevision
      || pendingPaths.includes(null)
      || canonicalJson(pendingPaths.sort()) !== canonicalJson(actualPaths.sort())
    ) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${indexPath} pending capture state`);
    }
    return null;
  }
  if (commits.length !== 1) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${indexPath} introduction commit`);
  }
  const parents = await execFile('git', ['rev-list', '--parents', '-n', '1', commits[0]], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).catch(() => null);
  const identities = parents?.stdout.trim().split(' ').filter(Boolean) ?? [];
  if (identities.length !== 2 || identities[1] !== sourceRevision) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${indexPath} source parent`);
  }
  return commits[0];
}

async function exactPhaseCSuccessors(repositoryRoot, topologyDecision) {
  const phaseRootPaths = topologyDecision.proofTopology.phaseC.rootPaths;
  const maintenanceRootPath = topologyDecision.proofTopology.maintenance.rootPath;
  const rootPaths = [...phaseRootPaths, maintenanceRootPath];
  const rootIndexes = [];
  for (const rootPath of rootPaths) {
    const indexBytes = await readFile(join(repositoryRoot, rootPath), 'utf8').catch(() => null);
    rootIndexes.push(indexBytes === null ? null : {
      path: rootPath,
      value: strictCanonical(indexBytes, rootPath),
    });
  }
  const presentCount = rootIndexes.filter(Boolean).length;
  const expectedTargets = [
    ...topologyDecision.proofTopology.phaseC.successorTargets,
    ...topologyDecision.proofTopology.maintenance.targets,
  ];
  if (presentCount === 0) {
    for (const { successorPath } of expectedTargets) {
      if (await stat(join(repositoryRoot, successorPath)).then(() => true).catch(() => false)) {
        fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${successorPath} exists without its Decision-owned root`);
      }
    }
    return { children: new Map(), rootIndexes: [] };
  }
  if (presentCount !== rootPaths.length) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'Decision-0006 Phase C root partition is partial');
  }

  for (const root of rootIndexes.slice(0, -2)) {
    if (Object.hasOwn(root.value, 'supersessions')) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${root.path} must not own supersessions`);
    }
  }
  const gate = rootIndexes.at(-2);
  const maintenance = rootIndexes.at(-1);
  assertKeys(maintenance.value, ['records', 'schema', 'sourceRevision', 'sourceTree', 'supersessions'], maintenance.path);
  if (
    maintenance.value.schema !== 'core-ui-evidence-index-v1'
    || !Array.isArray(maintenance.value.records)
    || maintenance.value.records.length !== 0
  ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${maintenance.path} index`);

  const rootTargets = new Map([
    [gate.path, topologyDecision.proofTopology.phaseC.successorTargets],
    [maintenance.path, topologyDecision.proofTopology.maintenance.targets],
  ]);
  const output = new Map();
  for (const root of [gate, maintenance]) {
    const targets = rootTargets.get(root.path);
    const references = root.value.supersessions;
    if (!Array.isArray(references) || references.length !== targets.length) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${root.path} supersession count`);
    }
    const expectedPaths = targets.map(({ successorPath }) => successorPath).sort();
    const actualPaths = references.map(({ path }) => path).sort();
    if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${root.path} supersession ownership`);
    }
    for (const reference of references) {
      assertKeys(reference, ['milestone', 'path', 'sha256'], `${reference.path} index reference`);
      const bytes = await readFile(join(repositoryRoot, reference.path), 'utf8').catch(() => null);
      if (bytes === null || reference.sha256 !== sha256(bytes)) {
        fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${reference.path} reference`);
      }
      const successor = strictCanonical(bytes, reference.path);
      const previous = successor.previousSupersession?.path;
      if (!previous) continue;
      const children = output.get(previous) ?? [];
      children.push({ indexPath: root.path, path: reference.path, successor });
      output.set(previous, children);
    }
  }
  return { children: output, rootIndexes };
}

async function assertAuthorityStageRoot(repositoryRoot, topologyDecision, acceptance) {
  const stage = topologyDecision.proofTopology?.authorityStage;
  const indexPath = stage?.rootPath;
  const indexBytes = indexPath ? await readFile(join(repositoryRoot, indexPath), 'utf8').catch(() => null) : null;
  if (indexBytes === null) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 authority-stage root');
  const index = strictCanonical(indexBytes, indexPath);
  assertKeys(index, ['records', 'schema', 'sourceRevision', 'sourceTree', 'supersessions'], 'decision-0006 authority-stage index');
  if (
    index.schema !== 'core-ui-evidence-index-v1'
    || !Array.isArray(index.records)
    || index.records.length !== 0
    || !Array.isArray(index.supersessions)
    || index.supersessions.length !== stage.targetCount
  ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 authority-stage index');
  const sourceTree = await execFile('git', ['rev-parse', `${index.sourceRevision}^{tree}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).catch(() => null);
  if (sourceTree?.stdout.trim() !== index.sourceTree) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 authority-stage source tree');
  }
  const introductionCommit = await assertIntroductionParent(repositoryRoot, indexPath, index.sourceRevision);
  await assertRevisionPathsExact(
    repositoryRoot,
    introductionCommit,
    [dirname(indexPath)],
    'decision-0006 authority-stage retained bytes',
    'CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH',
  );
  for (const [path, expected] of [
    [DEFAULT_THEME_IDENTITY_PATHS.decision, AUTHORITY.decision],
    [DEFAULT_THEME_IDENTITY_PATHS.acceptance, AUTHORITY.acceptance],
    [AUTHORITY.applicabilityDecision.path, AUTHORITY.applicabilityDecision],
    [AUTHORITY.applicabilityAcceptance.path, AUTHORITY.applicabilityAcceptance],
    [AUTHORITY.phaseCProductScope.path, AUTHORITY.phaseCProductScope],
  ]) {
    const committed = await execFile('git', ['show', `${index.sourceRevision}:${path}`], {
      cwd: repositoryRoot,
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
    }).catch(() => null);
    if (committed === null || sha256(committed.stdout) !== expected.sha256) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `decision-0006 source binding ${path}`);
    }
  }
  const stagePaths = stage.targets.map(({ successorPath }) => successorPath);
  if (new Set(stagePaths).size !== stage.targetCount || new Set(index.supersessions.map(({ path }) => path)).size !== stage.targetCount) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 authority-stage path uniqueness');
  }
  const references = new Map(index.supersessions.map((reference) => [reference.path, reference]));
  for (const target of stage.targets) {
    const reference = references.get(target.successorPath);
    assertKeys(reference, ['milestone', 'path', 'sha256'], `${target.successorPath} index reference`);
    const bytes = await readFile(join(repositoryRoot, target.successorPath), 'utf8').catch(() => null);
    if (bytes === null || reference?.sha256 !== sha256(bytes)) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', target.successorPath);
    }
    const successor = strictCanonical(bytes, target.successorPath);
    assertKeys(successor, SUPERSESSION_KEYS, target.successorPath);
    assertKeys(successor.authorization, REFERENCE_KEYS, `${target.successorPath} authorization`);
    assertKeys(successor.historicalIndex, REFERENCE_KEYS, `${target.successorPath} historical index`);
    assertKeys(successor.previousSupersession, REFERENCE_KEYS, `${target.successorPath} predecessor`);
    assertKeys(successor.currentApplicabilityManifest, MANIFEST_KEYS, `${target.successorPath} current manifest`);
    assertKeys(successor.supersededApplicabilityManifest, MANIFEST_KEYS, `${target.successorPath} superseded manifest`);
    const historicalBytes = await readFile(join(repositoryRoot, target.historicalIndex.path), 'utf8').catch(() => null);
    const predecessorBytes = await readFile(join(repositoryRoot, target.predecessor.path), 'utf8').catch(() => null);
    if (
      historicalBytes === null
      || predecessorBytes === null
      || sha256(historicalBytes) !== target.historicalIndex.sha256
      || sha256(predecessorBytes) !== target.predecessor.sha256
    ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${target.successorPath} predecessor identity`);
    const historical = strictCanonical(historicalBytes, target.historicalIndex.path);
    const currentEntries = await committedManifestEntries(
      repositoryRoot,
      index.sourceRevision,
      target.predecessorCurrentApplicabilityManifest.paths,
    );
    const expectedCurrentManifest = {
      algorithm: 'sha256',
      paths: target.predecessorCurrentApplicabilityManifest.paths,
      profile: 'core-ui-path-manifest-v1',
      sha256: sha256(canonicalJson(currentEntries)),
    };
    if (
      successor.schema !== 'core-ui-evidence-applicability-supersession-v1'
      || successor.sourceRevision !== index.sourceRevision
      || successor.sourceTree !== index.sourceTree
      || successor.disclosureClass !== 'public-sanitized'
      || successor.effectiveAt !== acceptance.createdAt
      || successor.evidenceStatus !== 'superseded'
      || successor.owner !== acceptance.owner
      || successor.reasonCode !== topologyDecision.proofTopology.maintenance.reasonCode
      || successor.replacementStatus !== topologyDecision.proofTopology.maintenance.replacementStatus
      || successor.authorization?.path !== AUTHORITY.applicabilityAcceptance.path
      || successor.authorization?.sha256 !== AUTHORITY.applicabilityAcceptance.sha256
      || successor.previousSupersession?.path !== target.predecessor.path
      || successor.previousSupersession?.sha256 !== target.predecessor.sha256
      || successor.historicalIndex?.path !== target.historicalIndex.path
      || successor.historicalIndex?.sha256 !== target.historicalIndex.sha256
      || JSON.stringify(successor.affectedAssertions) !== JSON.stringify(target.affectedAssertions)
    ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${target.successorPath} topology`);
    assertCanonicalReference(successor.replacementPlan, topologyDecision.proofTopology.maintenance.replacementPlan, `${target.successorPath} replacement plan`);
    assertCanonicalReference(successor.supersededApplicabilityManifest, target.predecessorCurrentApplicabilityManifest, `${target.successorPath} superseded manifest`);
    assertCanonicalReference(successor.currentApplicabilityManifest, expectedCurrentManifest, `${target.successorPath} current manifest`);
    const historicalAssertions = historical.records.map(({ assertionId }) => assertionId).sort();
    if (
      reference.milestone !== historical.milestone
      || canonicalJson(historicalAssertions) !== canonicalJson([...target.affectedAssertions].sort())
    ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${target.successorPath} historical index closure`);
  }

  const allowedChildren = new Map([
    ...topologyDecision.proofTopology.phaseC.successorTargets,
    ...topologyDecision.proofTopology.maintenance.targets,
  ].map((target) => [target.predecessorPath, target]));
  const phaseC = await exactPhaseCSuccessors(repositoryRoot, topologyDecision);
  const children = phaseC.children;
  const childCounts = [];
  const childSourceIdentities = new Set();
  const stageReferences = new Map(index.supersessions.map((reference) => [reference.path, reference]));
  for (const path of stagePaths) {
    const actual = children.get(path) ?? [];
    const expected = allowedChildren.get(path);
    if (actual.length > 1 || (actual.length === 1 && actual[0].path !== expected?.successorPath)) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${path} terminal/fork closure`);
    }
    if (actual.length === 1) {
      const child = actual[0];
      const successor = child.successor;
      assertKeys(successor, SUPERSESSION_KEYS, child.path);
      assertKeys(successor.authorization, REFERENCE_KEYS, `${child.path} authorization`);
      assertKeys(successor.historicalIndex, REFERENCE_KEYS, `${child.path} historical index`);
      assertKeys(successor.previousSupersession, REFERENCE_KEYS, `${child.path} predecessor`);
      assertKeys(successor.currentApplicabilityManifest, MANIFEST_KEYS, `${child.path} current manifest`);
      assertKeys(successor.supersededApplicabilityManifest, MANIFEST_KEYS, `${child.path} superseded manifest`);
      const parent = strictCanonical(
        await readFile(join(repositoryRoot, path), 'utf8'),
        path,
      );
      const historicalBytes = await readFile(join(repositoryRoot, expected.historicalIndex.path), 'utf8');
      const historical = strictCanonical(historicalBytes, expected.historicalIndex.path);
      const currentEntries = await committedManifestEntries(
        repositoryRoot,
        successor.sourceRevision,
        historical.applicabilityManifest.paths,
      );
      const expectedCurrentManifest = {
        algorithm: 'sha256',
        paths: historical.applicabilityManifest.paths,
        profile: 'core-ui-path-manifest-v1',
        sha256: sha256(canonicalJson(currentEntries)),
      };
      if (
        successor.schema !== 'core-ui-evidence-applicability-supersession-v1'
        || successor.authorization.path !== AUTHORITY.applicabilityAcceptance.path
        || successor.authorization.sha256 !== AUTHORITY.applicabilityAcceptance.sha256
        || successor.previousSupersession.path !== path
        || successor.previousSupersession.sha256 !== stageReferences.get(path)?.sha256
        || successor.historicalIndex.path !== expected.historicalIndex.path
        || successor.historicalIndex.sha256 !== expected.historicalIndex.sha256
        || canonicalJson(successor.affectedAssertions) !== canonicalJson(expected.affectedAssertions)
        || successor.disclosureClass !== 'public-sanitized'
        || successor.effectiveAt !== acceptance.createdAt
        || successor.evidenceStatus !== 'superseded'
        || successor.owner !== acceptance.owner
        || successor.reasonCode !== topologyDecision.proofTopology.maintenance.reasonCode
        || successor.replacementStatus !== topologyDecision.proofTopology.maintenance.replacementStatus
        || canonicalJson(successor.replacementPlan) !== canonicalJson(topologyDecision.proofTopology.maintenance.replacementPlan)
        || canonicalJson(successor.supersededApplicabilityManifest) !== canonicalJson(parent.currentApplicabilityManifest)
        || canonicalJson(successor.currentApplicabilityManifest) !== canonicalJson(expectedCurrentManifest)
      ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${child.path} successor closure`);
      const tree = await execFile('git', ['rev-parse', `${successor.sourceRevision}^{tree}`], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).catch(() => null);
      if (tree?.stdout.trim() !== successor.sourceTree) {
        fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `${child.path} source tree`);
      }
      await assertIntroductionParent(repositoryRoot, child.indexPath, successor.sourceRevision, {
        allowPendingCapture: true,
      });
      childSourceIdentities.add(`${successor.sourceRevision}:${successor.sourceTree}`);
    }
    childCounts.push(actual.length);
  }
  const childTotal = childCounts.reduce((sum, value) => sum + value, 0);
  if (childTotal !== 0 && childTotal !== stage.targetCount) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 successor partition is partial');
  }
  if (childTotal === stage.targetCount && childSourceIdentities.size !== 1) {
    fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 successor source identity is mixed');
  }
  if (childTotal === stage.targetCount) {
    for (const root of phaseC.rootIndexes) {
      await assertIntroductionParent(repositoryRoot, root.path, root.value.sourceRevision, {
        allowPendingCapture: true,
      });
      childSourceIdentities.add(`${root.value.sourceRevision}:${root.value.sourceTree}`);
    }
    if (childSourceIdentities.size !== 1) {
      fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 root and successor source identity is mixed');
    }
  }
}

async function assertRepositoryFacts(repositoryRoot, decision, sourceState) {
  const immutable = decision.implementation.pathClassification.immutableHistory
    .prePhaseCEvidenceImmutableManifest;
  const authorityTopology = decision.evidenceTopology.authorityApplicabilitySupersession;
  const authorityIndexBytes = await readFile(join(repositoryRoot, authorityTopology.rootPath), 'utf8')
    .catch(() => null);
  if (authorityIndexBytes === null) {
    fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'retained decision-0005 authority root unavailable');
  }
  const authorityIndex = strictCanonical(authorityIndexBytes, authorityTopology.rootPath);
  assertKeys(authorityIndex, ['records', 'schema', 'sourceRevision', 'sourceTree', 'supersessions'], authorityTopology.rootPath);
  if (
    authorityIndex.schema !== 'core-ui-evidence-index-v1'
    || !Array.isArray(authorityIndex.records)
    || authorityIndex.records.length !== 0
    || !Array.isArray(authorityIndex.supersessions)
    || authorityIndex.supersessions.length !== authorityTopology.targetCount
  ) fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'retained decision-0005 authority root shape');
  const authoritySourceTree = await execFile(
    'git',
    ['rev-parse', `${authorityIndex.sourceRevision}^{tree}`],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ).catch(() => null);
  if (authoritySourceTree?.stdout.trim() !== authorityIndex.sourceTree) {
    fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'retained decision-0005 authority source unavailable');
  }
  await assertIntroductionParent(repositoryRoot, authorityTopology.rootPath, authorityIndex.sourceRevision);

  const excludedPaths = new Set([
    ...immutable.excludedActiveCaptureScripts,
    authorityTopology.captureScript,
  ]);
  const entries = (await revisionManifest(
    repositoryRoot,
    authorityIndex.sourceRevision,
    ['tests/evidence'],
  )).filter(({ path }) => !excludedPaths.has(path));
  const manifestBytes = canonicalJson(entries);
  if (
    entries.length !== immutable.entryCount
    || Buffer.byteLength(manifestBytes) !== immutable.canonicalBytes
    || sha256(manifestBytes) !== immutable.sha256
  ) {
    fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'immutable evidence manifest identity');
  }
  for (const entry of entries) {
    const current = await execFile('git', ['hash-object', '--', entry.path], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).catch(() => null);
    if (current?.stdout.trim() !== entry.blob) {
      fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', entry.path);
    }
  }

  const immutableHistory = decision.implementation.pathClassification.immutableHistory;
  const immutableHistoryPaths = [
    ...immutableHistory.paths,
  ];
  await assertRevisionPathsExact(
    repositoryRoot,
    authorityIndex.sourceRevision,
    immutableHistoryPaths,
    'accepted decisions, Phase-B source, and installed fixture',
  );
  const [decision0002Blob, phaseBSourceBlob, phaseBInstalledCatalogTree] = await Promise.all([
    execFile('git', ['rev-parse', `${authorityIndex.sourceRevision}:${immutableHistory.decision0002.path}`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }),
    execFile('git', ['hash-object', '--', immutableHistory.phaseBSource.path], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }),
    execFile('git', ['rev-parse', `HEAD:${immutableHistory.phaseBInstalledCatalogTree.path}`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }),
  ]).catch(() => []);
  if (
    decision0002Blob?.stdout.trim() !== immutableHistory.decision0002.blob
    || phaseBSourceBlob?.stdout.trim() !== immutableHistory.phaseBSource.blob
    || phaseBInstalledCatalogTree?.stdout.trim() !== immutableHistory.phaseBInstalledCatalogTree.tree
  ) fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'accepted immutable-history identities');
  await assertRevisionPathsExact(
    repositoryRoot,
    'HEAD',
    [immutableHistory.phaseBInstalledCatalogTree.path],
    'installed Phase-B fixture',
  );

  if (sourceState === null) return;

  const classification = decision.implementation.pathClassification;
  const declared = [...classification.authoredCurrent, ...classification.generatedCurrent]
    .map((path) => (
      sourceState === 'post-migration'
        ? path
        : path.replace(DEFAULT_THEME_IDENTITY_PATHS.postMigration, DEFAULT_THEME_IDENTITY_PATHS.preMigration)
    ));
  const files = [];
  for (const path of declared) {
    if (CURRENT_REFERENCE_SCAN_EXCLUSIONS.has(path)) continue;
    files.push(...await filesUnder(repositoryRoot, path));
  }
  const forbiddenId = sourceState === 'post-migration'
    ? DEFAULT_THEME_IDENTITY.preMigration.artifactId
    : DEFAULT_THEME_IDENTITY.postMigration.artifactId;
  const forbiddenPath = sourceState === 'post-migration'
    ? DEFAULT_THEME_IDENTITY_PATHS.preMigration
    : DEFAULT_THEME_IDENTITY_PATHS.postMigration;
  const generatedCatalog = await readFile(join(repositoryRoot, 'packages/catalog/generated/catalog.json'), 'utf8');
  if (generatedCatalog.includes(forbiddenId)) {
    fail('CORE_TOKEN_IDENTITY_ALIAS_UNAUTHORIZED', `current generated catalog exposes ${forbiddenId}`);
  }
  for (const path of [...new Set(files)]) {
    const bytes = await readFile(join(repositoryRoot, path));
    if (
      bytes.includes(forbiddenId)
      || bytes.includes(forbiddenPath)
    ) fail('CORE_TOKEN_IDENTITY_REFERENCE_STALE', path);
  }
}

async function acceptedAuthority(repositoryRoot) {
  const [
    decisionBytes,
    ,
    topologyBytes,
    topologyAcceptanceBytes,
    deliveryDecisionBytes,
    deliveryAcceptanceBytes,
  ] = await Promise.all([
    exactAuthorityFile(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.decision, AUTHORITY.decision),
    exactAuthorityFile(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.acceptance, AUTHORITY.acceptance),
    exactAuthorityFile(repositoryRoot, AUTHORITY.applicabilityDecision.path, AUTHORITY.applicabilityDecision),
    exactAuthorityFile(repositoryRoot, AUTHORITY.applicabilityAcceptance.path, AUTHORITY.applicabilityAcceptance),
    exactAuthorityFile(repositoryRoot, AUTHORITY.deliveryDecision.path, AUTHORITY.deliveryDecision),
    exactAuthorityFile(repositoryRoot, AUTHORITY.deliveryAcceptance.path, AUTHORITY.deliveryAcceptance),
    exactHistoricalAuthorityFile(
      repositoryRoot,
      HISTORICAL_PRODUCT_SCOPE_SOURCE,
      AUTHORITY.productScope.path,
      AUTHORITY.productScope,
    ),
  ]);
  const decision = strict(decisionBytes, DEFAULT_THEME_IDENTITY_PATHS.decision);
  const topologyDecision = strict(topologyBytes, AUTHORITY.applicabilityDecision.path);
  const topologyAcceptance = strict(topologyAcceptanceBytes, AUTHORITY.applicabilityAcceptance.path);
  const deliveryDecision = strict(deliveryDecisionBytes, AUTHORITY.deliveryDecision.path);
  const deliveryAcceptance = strict(deliveryAcceptanceBytes, AUTHORITY.deliveryAcceptance.path);
  if (
    topologyAcceptance.decisionId !== 'core-ui:decision:0006'
    || topologyAcceptance.issueNumber !== 39
    || topologyAcceptance.owner !== 'ndrewtran'
  ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0006 acceptance identity');
  if (
    deliveryDecision.decisionId !== 'core-ui:decision:0007'
    || deliveryDecision.authorityAmendment?.productScope?.scopeVersion !== '4.0.2'
    || deliveryDecision.authorityAmendment?.productScope?.sha256 !== AUTHORITY.productScope.sha256
    || deliveryDecision.acceptanceTopology?.issueNumber !== 54
    || deliveryDecision.acceptanceTopology?.owner !== 'ndrewtran'
    || deliveryAcceptance.decisionId !== 'core-ui:decision:0007'
    || deliveryAcceptance.issueNumber !== 54
    || deliveryAcceptance.owner !== 'ndrewtran'
    || deliveryAcceptance.outcome !== 'accepted'
    || deliveryAcceptance.authorAssociation !== 'OWNER'
  ) fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', 'decision-0007 acceptance identity');
  await assertAuthorityStageRoot(repositoryRoot, topologyDecision, topologyAcceptance);
  return decision;
}

export async function assertDefaultThemeIdentityAuthority(repositoryRoot) {
  const decision = await acceptedAuthority(repositoryRoot);
  await assertRepositoryFacts(repositoryRoot, decision, null);
}

async function assertAcceptedRepository(repositoryRoot, sourceState) {
  const decision = await acceptedAuthority(repositoryRoot);
  await assertRepositoryFacts(repositoryRoot, decision, sourceState);
  await assertDefaultThemeRepositoryState(
    repositoryRoot,
    sourceState === 'post-migration' ? 'post-migration' : 'decision-0004',
  );
}

function postMigrationResult(changed, mode, state) {
  return {
    changed,
    mode,
    postMigration: {
      artifactId: DEFAULT_THEME_IDENTITY.postMigration.artifactId,
      bytes: DEFAULT_THEME_IDENTITY.postMigration.bytes,
      canonicalSha256: DEFAULT_THEME_IDENTITY.postMigration.canonicalSha256,
      path: DEFAULT_THEME_IDENTITY_PATHS.postMigration,
      rawSha256: DEFAULT_THEME_IDENTITY.postMigration.rawSha256,
    },
    state,
  };
}

export function migrateDefaultThemeIdentityValue(preMigrationSource) {
  const source = structuredClone(preMigrationSource);
  if (
    source?.id !== DEFAULT_THEME_IDENTITY.preMigration.artifactId
    || canonicalDigest(source) !== DEFAULT_THEME_IDENTITY.preMigration.canonicalSha256
  ) fail('CORE_TOKEN_IDENTITY_SOURCE_DRIFT', 'pre-migration token source');
  source.id = DEFAULT_THEME_IDENTITY.postMigration.artifactId;
  validateFamily('token-source', source);
  if (canonicalDigest(source) !== DEFAULT_THEME_IDENTITY.postMigration.canonicalSha256) {
    fail('CORE_TOKEN_IDENTITY_SOURCE_DRIFT', 'post-migration token source');
  }
  return source;
}

function migrateBytes(preMigrationBytes) {
  assertExact(preMigrationBytes, DEFAULT_THEME_IDENTITY.preMigration, 'pre-migration bytes');
  const marker = '"id": "core:token:button-minimum"';
  if (preMigrationBytes.split(marker).length !== 2) {
    fail('CORE_TOKEN_IDENTITY_SOURCE_DRIFT', 'pre-migration identity occurrence');
  }
  const postMigrationBytes = preMigrationBytes.replace(marker, '"id": "core:token:default-theme"');
  assertExact(postMigrationBytes, DEFAULT_THEME_IDENTITY.postMigration, 'post-migration bytes');
  return postMigrationBytes;
}

async function optionalFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function inspectDefaultThemeIdentity(repositoryRoot) {
  const prePath = join(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.preMigration);
  const postPath = join(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.postMigration);
  const [preBytes, postBytes] = await Promise.all([optionalFile(prePath), optionalFile(postPath)]);
  if (preBytes !== null && postBytes !== null) {
    fail('CORE_TOKEN_IDENTITY_SOURCE_AMBIGUOUS', 'both old and new token-source paths exist');
  }
  if (preBytes === null && postBytes === null) {
    fail('CORE_TOKEN_IDENTITY_SOURCE_MISSING', 'neither old nor new token-source path exists');
  }
  if (preBytes !== null) {
    assertExact(preBytes, DEFAULT_THEME_IDENTITY.preMigration, DEFAULT_THEME_IDENTITY_PATHS.preMigration);
    return { bytes: preBytes, state: 'pre-migration' };
  }
  assertExact(postBytes, DEFAULT_THEME_IDENTITY.postMigration, DEFAULT_THEME_IDENTITY_PATHS.postMigration);
  return { bytes: postBytes, state: 'post-migration' };
}

export async function runDefaultThemeIdentityMigration(
  repositoryRoot,
  options = {},
) {
  const { mode = 'write' } = options;
  const inspected = await inspectDefaultThemeIdentity(repositoryRoot);
  await assertAcceptedRepository(repositoryRoot, inspected.state);
  const prePath = join(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.preMigration);
  const postPath = join(repositoryRoot, DEFAULT_THEME_IDENTITY_PATHS.postMigration);
  if (mode === 'check') {
    if (inspected.state !== 'post-migration') {
      fail('CORE_TOKEN_IDENTITY_REFERENCE_STALE', 'current token source still uses the old identity');
    }
    return postMigrationResult(false, mode, inspected.state);
  }
  if (mode === 'dry-run') {
    return postMigrationResult(inspected.state === 'pre-migration', mode, inspected.state);
  }
  if (mode === 'rollback') {
    if (inspected.state === 'post-migration') {
      const preBytes = inspected.bytes.replace('"id": "core:token:default-theme"', '"id": "core:token:button-minimum"');
      assertExact(preBytes, DEFAULT_THEME_IDENTITY.preMigration, 'rollback bytes');
      await transitionDefaultThemeRepository(repositoryRoot, {
        fromState: 'post-migration',
        toState: 'decision-0004',
        writeSource: async () => {
          await writeFile(prePath, preBytes);
          await unlink(postPath);
        },
        validate: async () => {
          const next = await inspectDefaultThemeIdentity(repositoryRoot);
          if (next.state !== 'pre-migration') fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'rollback source state');
          await assertAcceptedRepository(repositoryRoot, next.state);
        },
      });
    }
    return postMigrationResult(inspected.state === 'post-migration', mode, 'pre-migration');
  }
  if (mode !== 'write') fail('CORE_TOKEN_IDENTITY_AUTHORITY_MISMATCH', `unknown mode ${mode}`);
  if (inspected.state === 'pre-migration') {
    const postBytes = migrateBytes(inspected.bytes);
    await transitionDefaultThemeRepository(repositoryRoot, {
      fromState: 'decision-0004',
      toState: 'post-migration',
      writeSource: async () => {
        await writeFile(postPath, postBytes);
        await unlink(prePath);
      },
      validate: async () => {
        const next = await inspectDefaultThemeIdentity(repositoryRoot);
        if (next.state !== 'post-migration') fail('CORE_TOKEN_IDENTITY_ROLLBACK_DRIFT', 'write source state');
        await assertAcceptedRepository(repositoryRoot, next.state);
      },
    });
  }
  return postMigrationResult(inspected.state === 'pre-migration', mode, 'post-migration');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../../..');
  const mode = process.argv.includes('--check') ? 'check'
    : process.argv.includes('--dry-run') ? 'dry-run'
      : process.argv.includes('--rollback') ? 'rollback'
        : 'write';
  process.stdout.write(`${JSON.stringify(await runDefaultThemeIdentityMigration(repositoryRoot, { mode }))}\n`);
}
