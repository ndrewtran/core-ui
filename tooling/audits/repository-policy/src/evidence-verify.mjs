import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import {
  assertApplicabilitySupersessionReference,
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from './evidence-applicability-supersession.mjs';
import { sha256 } from './policy.mjs';
import { assertTaleAnnexAcceptanceRecord } from './tale-token-annex-acceptance.mjs';
import {
  assertTaleTokenPhaseAIndexSet,
  assertTaleTokenPhaseAProfile,
} from '../../../../tests/evidence/tale-token-phase-a-profile.mjs';
import {
  assertTaleTokenPhaseBIndexSet,
  assertTaleTokenPhaseBProfile,
  TALE_TOKEN_PHASE_B_PROFILE_DIGEST,
} from '../../../../tests/evidence/tale-token-phase-b-profile.mjs';
import {
  assertTaleTokenPhaseCIndexSet,
  assertTaleTokenPhaseCProfile,
  TALE_TOKEN_PHASE_C_PROFILE_DIGEST,
} from '../../../../tests/evidence/capture-tale-token-phase-c.mjs';
import {
  assertTaleTokenPhaseCV2CommitTopology,
  assertTaleTokenPhaseCV2DirectoryNames,
  assertTaleTokenPhaseCV2IndexSet,
  assertTaleTokenPhaseCV2RootSet,
  isTaleTokenPhaseCV2Name,
} from '../../../../tests/evidence/tale-token-phase-c-v2-profile.mjs';
import {
  G12_MAINTENANCE_ROOT,
  G12_ROOT,
  assertG12MaintenanceRootDirectory,
  assertG12RootDirectory,
  pathManifestAtRevision,
} from '../../../../tests/evidence/g1.2-profile.mjs';
import {
  assertReviewReadinessRoot,
  hasReviewReadinessResidue,
  REVIEW_READINESS_ROOT,
} from '../../../../tests/evidence/delivery-review-readiness-applicability-profile.mjs';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export class EvidenceIntegrityError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'EvidenceIntegrityError';
    this.code = code;
  }
}

export function hasUnsanitizedEvidenceOutput(text, repositoryRoot) {
  const withoutPublicTokenIds = text.replace(
    /"core:token:[a-z0-9]+(?:-[a-z0-9]+)*"/gu,
    '"core:<public-token-id>"',
  );
  return (
    withoutPublicTokenIds.includes(repositoryRoot)
    || /\/(?:Users|Volumes|home|root|tmp|private(?:\/(?:tmp|var\/folders))?|var\/folders)\//u.test(withoutPublicTokenIds)
    || /(?:^|[\s"'(=])[A-Za-z]:\\(?:Users|Temp)\\/mu.test(withoutPublicTokenIds)
    || /(?:authorization|api[-_]?key|token)\s*[:=]\s*\S+/iu.test(withoutPublicTokenIds)
  );
}

async function readCanonicalJson(path) {
  const bytes = await readFile(path, 'utf8');
  const value = JSON.parse(bytes);
  if (bytes !== canonicalJson(value)) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_NOT_CANONICAL',
      `${path} must use core-ui-evidence-json-v1 canonical bytes`,
    );
  }
  return { bytes, value };
}

async function assertDigest(root, reference) {
  const path = join(root, reference.path);
  const { bytes, value } = await readCanonicalJson(path);
  const actual = `sha256:${sha256(bytes)}`;
  if (actual !== reference.sha256) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_DIGEST_MISMATCH',
      `${reference.path} has ${actual}; expected ${reference.sha256}`,
    );
  }
  return value;
}

async function assertFileDigest(root, reference) {
  const bytes = await readFile(join(root, reference.path));
  const actual = `sha256:${sha256(bytes)}`;
  if (actual !== reference.sha256) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_DIGEST_MISMATCH',
      `${reference.path} has ${actual}; expected ${reference.sha256}`,
    );
  }
  return bytes;
}

export async function resolveG12EvidenceIdentity(repositoryRoot, revision = 'HEAD') {
  const indexPaths = [`${G12_ROOT}/index.json`, `${G12_MAINTENANCE_ROOT}/index.json`];
  const additions = (await execFile(
    'git',
    ['log', '--full-history', '--format=%H', '--diff-filter=A', revision, '--', ...indexPaths],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )).stdout.trim().split('\n').filter(Boolean);
  const uniqueAdditions = [...new Set(additions)];
  if (uniqueAdditions.length !== 1) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_G12_TOPOLOGY_INVALID',
      'G1.2 roots must have one unique reachable introduction commit',
    );
  }
  const evidenceRevision = uniqueAdditions[0];
  const parents = (await execFile(
    'git',
    ['show', '-s', '--format=%P', evidenceRevision],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )).stdout.trim().split(' ').filter(Boolean);
  if (parents.length !== 1) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_G12_TOPOLOGY_INVALID',
      'G1.2 evidence introduction must have one source parent',
    );
  }
  for (const root of [G12_ROOT, G12_MAINTENANCE_ROOT]) {
    const parentRoot = await execFile(
      'git',
      ['cat-file', '-e', `${parents[0]}:${root}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    ).then(() => true, () => false);
    if (parentRoot) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_G12_TOPOLOGY_INVALID',
        'G1.2 evidence roots must be absent from the source parent',
      );
    }
  }
  const changed = (await execFile(
    'git',
    ['diff-tree', '--no-commit-id', '--name-status', '-r', evidenceRevision],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )).stdout.trim().split('\n').filter(Boolean).map((line) => {
    const [status, path] = line.split('\t');
    return { path, status };
  });
  if (changed.length === 0 || changed.some(({ path, status }) => (
    status !== 'A'
    || ![G12_ROOT, G12_MAINTENANCE_ROOT].some((root) => path?.startsWith(`${root}/`))
  ))) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_G12_TOPOLOGY_INVALID',
      'G1.2 evidence introduction must add only the two evidence roots',
    );
  }
  for (const root of [G12_ROOT, G12_MAINTENANCE_ROOT]) {
    const introductionTree = (await execFile(
      'git',
      ['rev-parse', `${evidenceRevision}:${root}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )).stdout.trim();
    const reviewedTree = (await execFile(
      'git',
      ['rev-parse', `${revision}:${root}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )).stdout.trim();
    if (reviewedTree !== introductionTree) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_G12_TOPOLOGY_INVALID',
        'G1.2 evidence roots must remain byte-identical to their introduction commit',
      );
    }
  }
  return {
    evidenceRevision,
    evidenceTree: (await execFile(
      'git',
      ['rev-parse', `${evidenceRevision}^{tree}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )).stdout.trim(),
    sourceRevision: parents[0],
    sourceTree: (await execFile(
      'git',
      ['rev-parse', `${parents[0]}^{tree}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )).stdout.trim(),
  };
}

async function assertApplicabilityManifest(
  repositoryRoot,
  manifest,
  sourceRevision,
) {
  if (
    manifest?.algorithm !== 'sha256'
    || manifest?.profile !== 'core-ui-path-manifest-v1'
    || !Array.isArray(manifest?.paths)
    || !/^sha256:[0-9a-f]{64}$/u.test(manifest?.sha256)
  ) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_MANIFEST_PROFILE_INVALID',
      'applicability manifest must use the sha256 core-ui-path-manifest-v1 profile',
    );
  }
  if (!/^[0-9a-f]{40}$/u.test(sourceRevision ?? '')) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_SOURCE_MISMATCH',
      'applicability manifest requires an exact source revision',
    );
  }
  for (const path of manifest.paths) {
    try {
      await execFile('git', ['cat-file', '-e', `${sourceRevision}:${path}`], {
        cwd: repositoryRoot,
      });
    } catch {
      throw new EvidenceIntegrityError(
        'EVIDENCE_MANIFEST_ENTRY_INVALID',
        `${path} is missing from recorded source ${sourceRevision}`,
      );
    }
  }
  const actual = await pathManifestAtRevision(repositoryRoot, sourceRevision, manifest.paths);
  if (actual.sha256 !== manifest.sha256) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_APPLICABILITY_MISMATCH',
      `applicable source paths at ${sourceRevision} have ${actual.sha256}; expected ${manifest.sha256}`,
    );
  }
}

export async function verifyEvidence(repositoryRoot, {
  allowTransactionJournal,
  g12ExpectedIdentity,
  phaseCV2ExpectedIdentity,
} = {}) {
  const evidenceRoot = join(repositoryRoot, 'tests/evidence');
  const transactionJournal = join(evidenceRoot, '.g1-2-transaction.json');
  if (await stat(transactionJournal).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }) && allowTransactionJournal !== transactionJournal) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_TRANSACTION_INCOMPLETE',
      'G1.2 evidence publication journal is present; recover before reading evidence',
    );
  }
  const milestones = await readdir(evidenceRoot, { withFileTypes: true }).catch(() => []);
  const milestoneNames = new Set(milestones.filter((entry) => entry.isDirectory()).map(({ name }) => name));
  const hasPhaseCV2 = assertTaleTokenPhaseCV2DirectoryNames([...milestoneNames], (message) => {
    throw new EvidenceIntegrityError('EVIDENCE_PHASE_C_V2_TOPOLOGY_INVALID', message);
  });
  if (hasPhaseCV2) {
    try {
      let expected = phaseCV2ExpectedIdentity;
      if (!expected) {
        const first = await readCanonicalJson(join(
          evidenceRoot,
          'tale-token-phase-c-g0.1-v2/index.json',
        ));
        expected = {
          sourceRevision: first.value.sourceRevision,
          sourceTree: first.value.sourceTree,
          timestamp: first.value.captureTimestamp,
        };
      }
      const sourceTime = new Date((await execFile(
        'git',
        ['show', '-s', '--format=%cI', expected.sourceRevision],
        { cwd: repositoryRoot, encoding: 'utf8' },
      )).stdout.trim());
      const captured = new Date(expected.timestamp);
      if (Number.isNaN(captured.valueOf()) || captured < sourceTime || captured > new Date()) {
        throw new Error('capture timestamp outside source/current bounds');
      }
      await assertTaleTokenPhaseCV2RootSet(repositoryRoot, expected);
      await assertTaleTokenPhaseCV2CommitTopology(repositoryRoot, expected, {
        allowUncommitted: phaseCV2ExpectedIdentity !== undefined,
      });
    } catch (error) {
      if (error instanceof EvidenceIntegrityError) throw error;
      throw new EvidenceIntegrityError('EVIDENCE_PHASE_C_V2_PROFILE_INVALID', error.message);
    }
  }
  const reviewReadinessResidue = await hasReviewReadinessResidue(repositoryRoot);
  if (reviewReadinessResidue.length > 0) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_TRANSACTION_INCOMPLETE',
      `delivery review readiness residue remains: ${reviewReadinessResidue.join(', ')}`,
    );
  }
  if (milestoneNames.has(REVIEW_READINESS_ROOT.replace('tests/evidence/', ''))) {
    try {
      await assertReviewReadinessRoot(repositoryRoot);
    } catch (error) {
      throw new EvidenceIntegrityError('EVIDENCE_REVIEW_READINESS_PROFILE_INVALID', error.message);
    }
  }
  const hasG12 = milestoneNames.has(G12_ROOT.replace('tests/evidence/', ''));
  const hasG12Maintenance = milestoneNames.has(G12_MAINTENANCE_ROOT.replace('tests/evidence/', ''));
  if (hasG12 !== hasG12Maintenance) {
    throw new EvidenceIntegrityError('EVIDENCE_G12_TOPOLOGY_INVALID', 'both G1.2 roots must exist together');
  }
  if (hasG12) {
    let expected = g12ExpectedIdentity;
    if (!expected) {
      expected = await resolveG12EvidenceIdentity(repositoryRoot);
    }
    try {
      const root = await assertG12RootDirectory(repositoryRoot, G12_ROOT, expected);
      await assertG12MaintenanceRootDirectory(repositoryRoot, G12_MAINTENANCE_ROOT, expected);
      const validation = JSON.parse(await readFile(join(repositoryRoot, root.validation.path), 'utf8'));
      const captured = new Date(validation.captureProcedure.split('--timestamp ')[1]);
      const sourceTime = new Date((await execFile('git', ['show', '-s', '--format=%cI', expected.sourceRevision], { cwd: repositoryRoot, encoding: 'utf8' })).stdout.trim());
      if (Number.isNaN(captured.valueOf()) || captured < sourceTime || captured > new Date()) {
        throw new Error('capture timestamp outside source/current bounds');
      }
    } catch (error) {
      throw new EvidenceIntegrityError('EVIDENCE_G12_PROFILE_INVALID', error.message);
    }
  }
  const indexes = [];
  const phaseAIndexes = [];
  const phaseBIndexes = [];
  const phaseCIndexes = [];
  const phaseCV2Indexes = [];
  let indexCount = 0;
  let recordCount = 0;
  let artifactCount = 0;
  let recertificationCount = 0;
  let supersessionCount = 0;

  for (const entry of milestones.filter((item) => item.isDirectory())) {
    const indexPath = join(evidenceRoot, entry.name, 'index.json');
    const result = await readCanonicalJson(indexPath);
    if (entry.name.startsWith('tale-token-phase-a-')) {
      assertTaleTokenPhaseAProfile(result.value.applicabilityProfile, (message) => {
        throw new EvidenceIntegrityError(
          'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
          `tests/evidence/${entry.name}/index.json ${message}`,
        );
      });
      phaseAIndexes.push({ name: entry.name, index: result.value });
    }
    if (entry.name.startsWith('tale-token-phase-b-')) {
      assertTaleTokenPhaseBProfile(result.value.applicabilityProfile, (message) => {
        throw new EvidenceIntegrityError(
          'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
          `tests/evidence/${entry.name}/index.json ${message}`,
        );
      });
      phaseBIndexes.push({ name: entry.name, index: result.value });
    }
    if (isTaleTokenPhaseCV2Name(entry.name)) {
      assertTaleTokenPhaseCProfile(result.value.applicabilityProfile, (message) => {
        throw new EvidenceIntegrityError(
          'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
          `tests/evidence/${entry.name}/index.json ${message}`,
        );
      });
      phaseCV2Indexes.push({ name: entry.name, index: result.value });
    } else if (entry.name.startsWith('tale-token-phase-c-')) {
      assertTaleTokenPhaseCProfile(result.value.applicabilityProfile, (message) => {
        throw new EvidenceIntegrityError(
          'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
          `tests/evidence/${entry.name}/index.json ${message}`,
        );
      });
      phaseCIndexes.push({ name: entry.name, index: result.value });
    }
    indexes.push({
      index: result.value,
      indexBytes: result.bytes,
      relativePath: `tests/evidence/${entry.name}/index.json`,
    });
  }

  if (phaseAIndexes.length > 0) {
    assertTaleTokenPhaseAIndexSet(phaseAIndexes, (message) => {
      throw new EvidenceIntegrityError(
        'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
        `TALE-TOKEN-A ${message}`,
      );
    });
  }
  if (phaseBIndexes.length > 0) {
    assertTaleTokenPhaseBIndexSet(phaseBIndexes, (message) => {
      throw new EvidenceIntegrityError(
        'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
        `TALE-TOKEN-B ${message}`,
      );
    });
  }
  if (phaseCIndexes.length > 0) {
    assertTaleTokenPhaseCIndexSet(phaseCIndexes, (message) => {
      throw new EvidenceIntegrityError(
        'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
        `TALE-TOKEN-C ${message}`,
      );
    });
  }
  if (phaseCV2Indexes.length > 0) {
    assertTaleTokenPhaseCV2IndexSet(phaseCV2Indexes, (message) => {
      throw new EvidenceIntegrityError(
        'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
        `TALE-TOKEN-C v2 ${message}`,
      );
    });
  }
  const phaseCTopologyDecision = (
    phaseCIndexes.length > 0
    || indexes.some(({ relativePath }) => (
      relativePath === 'tests/evidence/authority-46-phase-c-applicability/index.json'
    ))
  ) ? (await readCanonicalJson(join(
      repositoryRoot,
      'decisions/0006-phase-c-applicability-topology.json',
    ))).value : null;

  const recertificationNodes = new Map();
  for (const owner of indexes) {
    for (const reference of owner.index.recertifications ?? []) {
      const recertification = await assertDigest(repositoryRoot, reference);
      const target = recertification.historicalIndex?.path;
      if (
        ![
          'core-ui-evidence-recertification-v1',
          'core-ui-evidence-recertification-v2',
        ].includes(recertification.schema)
        || recertification.outcome !== 'pass'
        || typeof target !== 'string'
        || recertificationNodes.has(reference.path)
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_INVALID',
          `${reference.path} must be one uniquely addressed passing recertification`,
        );
      }
      const historical = indexes.find(({ relativePath }) => relativePath === target);
      if (!historical) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_INVALID',
          `${reference.path} targets an unknown historical index`,
        );
      }
      const historicalDigest = `sha256:${sha256(historical.indexBytes)}`;
      if (
        recertification.historicalIndex.sha256 !== historicalDigest
        || canonicalJson(recertification.currentApplicabilityManifest.paths)
          !== canonicalJson(historical.index.applicabilityManifest.paths)
        || recertification.sourceRevision !== owner.index.sourceRevision
        || recertification.sourceTree !== owner.index.sourceTree
        || Boolean(recertification.validation) !== Boolean(owner.index.validation)
        || (
          owner.index.validation
          && canonicalJson(recertification.validation) !== canonicalJson(owner.index.validation)
        )
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_INVALID',
          `${reference.path} does not bind the historical and current evidence identities`,
        );
      }
      if (
        recertification.schema === 'core-ui-evidence-recertification-v1'
        && recertification.previousRecertification !== undefined
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_INVALID',
          `${reference.path} uses a v1 schema with a chain predecessor`,
        );
      }
      recertificationNodes.set(reference.path, {
        owner,
        recertification,
        reference,
        target,
      });
      recertificationCount += 1;
    }
  }

  async function historicalApplicability(historical) {
    if (historical.index.applicabilityManifest) {
      return { manifest: historical.index.applicabilityManifest, milestone: historical.index.milestone };
    }
    if (!Array.isArray(historical.index.records) || historical.index.records.length === 0) return null;
    const records = await Promise.all(historical.index.records.map((reference) => assertDigest(repositoryRoot, reference)));
    const manifests = records.map(({ applicabilityManifest }) => canonicalJson(applicabilityManifest));
    const milestones = records.map(({ milestone }) => milestone);
    if (new Set(manifests).size !== 1 || new Set(milestones).size !== 1) return null;
    return { manifest: records[0].applicabilityManifest, milestone: milestones[0] };
  }

  const recertificationLeaves = new Map();
  const nodesByTarget = Map.groupBy(
    recertificationNodes.values(),
    ({ target }) => target,
  );
  for (const [target, nodes] of nodesByTarget) {
    const historical = indexes.find(({ relativePath }) => relativePath === target);
    const children = new Map();
    const roots = [];
    for (const node of nodes) {
      const previous = node.recertification.previousRecertification;
      if (previous === undefined) {
        roots.push(node);
        if (
          canonicalJson(node.recertification.historicalApplicabilityManifest)
          !== canonicalJson(historical.index.applicabilityManifest)
        ) {
          throw new EvidenceIntegrityError(
            'EVIDENCE_RECERTIFICATION_INVALID',
            `${node.reference.path} root does not bind the historical applicability manifest`,
          );
        }
        continue;
      }
      if (node.recertification.schema !== 'core-ui-evidence-recertification-v2') {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_INVALID',
          `${node.reference.path} must use v2 to extend a recertification chain`,
        );
      }
      if (previous.path === node.reference.path) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_CYCLE',
          `${node.reference.path} cannot name itself as its predecessor`,
        );
      }
      const predecessor = recertificationNodes.get(previous.path);
      if (
        !predecessor
        || predecessor.target !== target
        || previous.sha256 !== predecessor.reference.sha256
        || canonicalJson(node.recertification.historicalApplicabilityManifest)
          !== canonicalJson(predecessor.recertification.currentApplicabilityManifest)
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_INVALID',
          `${node.reference.path} does not bind its exact predecessor`,
        );
      }
      const successorPaths = children.get(previous.path) ?? [];
      successorPaths.push(node.reference.path);
      children.set(previous.path, successorPaths);
    }
    if (roots.length !== 1 || [...children.values()].some((paths) => paths.length !== 1)) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_RECERTIFICATION_FORK',
        `${target} must have one root and at most one successor per certificate`,
      );
    }
    const leaves = nodes.filter(({ reference }) => !children.has(reference.path));
    if (leaves.length !== 1) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_RECERTIFICATION_FORK',
        `${target} must have exactly one terminal certificate`,
      );
    }
    const visited = new Set();
    let cursor = leaves[0];
    while (cursor) {
      if (visited.has(cursor.reference.path)) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RECERTIFICATION_CYCLE',
          `${target} contains a recertification cycle`,
        );
      }
      visited.add(cursor.reference.path);
      const previousPath = cursor.recertification.previousRecertification?.path;
      cursor = previousPath === undefined ? null : recertificationNodes.get(previousPath);
    }
    if (visited.size !== nodes.length || !visited.has(roots[0].reference.path)) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_RECERTIFICATION_INVALID',
        `${target} contains a disconnected or cyclic recertification chain`,
      );
    }
    recertificationLeaves.set(target, leaves[0]);
  }

  const supersessionNodes = new Map();
  for (const owner of indexes) {
    for (const reference of owner.index.supersessions ?? []) {
      assertApplicabilitySupersessionReference(reference, (message) => {
        throw new EvidenceIntegrityError('EVIDENCE_SUPERSESSION_SCHEMA_INVALID', message);
      });
      if (supersessionNodes.has(reference.path)) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_DUPLICATE_REFERENCE',
          `${reference.path} is referenced more than once`,
        );
      }
      const supersession = await assertDigest(repositoryRoot, reference);
      assertApplicabilitySupersessionShape(supersession, (message) => {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_SCHEMA_INVALID',
          `${reference.path}: ${message}`,
        );
      });
      const authorityDecision = await assertDigest(repositoryRoot, supersession.authorization);
      assertAuthorityDecisionShape(authorityDecision, (message) => {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_AUTHORIZATION_INVALID',
          `${supersession.authorization.path}: ${message}`,
        );
      });
      const target = supersession.historicalIndex?.path;
      const historical = indexes.find(({ relativePath }) => relativePath === target);
      const historicalDigest = historical
        ? `sha256:${sha256(historical.indexBytes)}`
        : null;
      const historicalIdentity = historical ? await historicalApplicability(historical) : null;
      const affectedAssertions = historical
        ? historical.index.records.map(({ assertionId }) => assertionId).sort()
        : [];
      if (historicalIdentity && reference.milestone !== historicalIdentity.milestone) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_MILESTONE_MISMATCH',
          `${reference.path} names ${reference.milestone}; expected ${historicalIdentity.milestone}`,
        );
      }
      if (
        !historicalIdentity?.manifest
        || supersession.historicalIndex.sha256 !== historicalDigest
        || supersession.sourceRevision !== owner.index.sourceRevision
        || supersession.sourceTree !== owner.index.sourceTree
        || supersession.owner !== authorityDecision.owner
        || (authorityDecision.schema === 'core-ui-authority-decision-v1'
          && supersession.effectiveAt !== authorityDecision.createdAt)
        || canonicalJson(supersession.affectedAssertions) !== canonicalJson(affectedAssertions)
        || canonicalJson(supersession.currentApplicabilityManifest.paths)
          !== canonicalJson(historicalIdentity.manifest.paths)
        || supersession.currentApplicabilityManifest.sha256
          === supersession.supersededApplicabilityManifest.sha256
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_INVALID',
          `${reference.path} must be one uniquely addressed applicability supersession`,
        );
      }
      supersessionNodes.set(reference.path, {
        supersession,
        owner,
        reference,
        target,
      });
      supersessionCount += 1;
    }
  }

  const supersessionLeaves = new Map();
  const supersededIndexPaths = new Set(
    [...supersessionNodes.values()].map(({ target }) => target),
  );
  const supersessionsByTarget = Map.groupBy(
    supersessionNodes.values(),
    ({ target }) => target,
  );
  for (const [target, nodes] of supersessionsByTarget) {
    const historical = indexes.find(({ relativePath }) => relativePath === target);
    const recertificationLeaf = recertificationLeaves.get(target);
    const children = new Map();
    const roots = [];
    for (const node of nodes) {
      const previous = node.supersession.previousSupersession;
      if (previous === undefined) {
        roots.push(node);
        const historicalIdentity = await historicalApplicability(historical);
        const expectedManifest = recertificationLeaf
          ? recertificationLeaf.recertification.currentApplicabilityManifest
          : historicalIdentity?.manifest;
        const expectedRecertification = recertificationLeaf
          ? {
              path: recertificationLeaf.reference.path,
              sha256: recertificationLeaf.reference.sha256,
            }
          : undefined;
        const boundRecertification = node.supersession.supersededRecertification;
        if (
          recertificationLeaf
          && boundRecertification?.path !== recertificationLeaf.reference.path
        ) {
          throw new EvidenceIntegrityError(
            'EVIDENCE_RECERTIFICATION_AFTER_SUPERSESSION',
            `${target} cannot extend a recertification chain after supersession`,
          );
        }
        if (
          canonicalJson(node.supersession.supersededApplicabilityManifest)
            !== canonicalJson(expectedManifest)
          || canonicalJson(node.supersession.supersededRecertification)
            !== canonicalJson(expectedRecertification)
        ) {
          throw new EvidenceIntegrityError(
            'EVIDENCE_SUPERSESSION_INVALID',
            `${node.reference.path} root does not bind the terminal historical evidence identity`,
          );
        }
        continue;
      }
      if (previous.path === node.reference.path) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_CYCLE',
          `${node.reference.path} cannot name itself as its predecessor`,
        );
      }
      const predecessor = supersessionNodes.get(previous.path);
      if (
        !predecessor
        || predecessor.target !== target
        || previous.sha256 !== predecessor.reference.sha256
        || node.supersession.supersededRecertification !== undefined
        || canonicalJson(node.supersession.supersededApplicabilityManifest)
          !== canonicalJson(predecessor.supersession.currentApplicabilityManifest)
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_INVALID',
          `${node.reference.path} does not bind its exact predecessor`,
        );
      }
      const successorPaths = children.get(previous.path) ?? [];
      successorPaths.push(node.reference.path);
      children.set(previous.path, successorPaths);
    }
    for (const node of nodes) {
      const visited = new Set();
      let cursor = node;
      while (cursor?.supersession.previousSupersession) {
        if (visited.has(cursor.reference.path)) {
          throw new EvidenceIntegrityError(
            'EVIDENCE_SUPERSESSION_CYCLE',
            `${target} contains a supersession cycle`,
          );
        }
        visited.add(cursor.reference.path);
        cursor = supersessionNodes.get(cursor.supersession.previousSupersession.path);
      }
    }
    if (roots.length !== 1 || [...children.values()].some((paths) => paths.length !== 1)) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_SUPERSESSION_FORK',
        `${target} must have one supersession root and at most one successor per supersession`,
      );
    }
    const leaves = nodes.filter(({ reference }) => !children.has(reference.path));
    if (leaves.length !== 1) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_SUPERSESSION_FORK',
        `${target} must have exactly one terminal supersession`,
      );
    }
    const visited = new Set();
    let cursor = leaves[0];
    while (cursor) {
      if (visited.has(cursor.reference.path)) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_CYCLE',
          `${target} contains a supersession cycle`,
        );
      }
      visited.add(cursor.reference.path);
      const previousPath = cursor.supersession.previousSupersession?.path;
      cursor = previousPath === undefined ? null : supersessionNodes.get(previousPath);
    }
    if (visited.size !== nodes.length || !visited.has(roots[0].reference.path)) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_SUPERSESSION_INVALID',
        `${target} contains a disconnected or cyclic supersession chain`,
      );
    }
    const taleAuthorityChain = roots[0].supersession.authorization.path
      === 'decisions/0002-tale-token-authority.json';
    for (const node of nodes) {
      const supersession = node.supersession;
      if (
        !taleAuthorityChain
        || supersession.previousSupersession?.path !== roots[0].reference.path
      ) continue;
      const acceptancePath = 'decisions/0003-tale-token-classification-acceptance.json';
      const annexPath = 'decisions/0003-tale-token-classification-annex.json';
      if (supersession.authorization.path !== acceptancePath) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_ACCEPTANCE_REQUIRED',
          `${node.reference.path} authorization must bind ${acceptancePath}`,
        );
      }
      const acceptance = await assertDigest(repositoryRoot, supersession.authorization);
      const annexBytes = await readFile(join(repositoryRoot, annexPath));
      assertTaleAnnexAcceptanceRecord(
        acceptance,
        annexPath,
        annexBytes,
        (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_SUPERSESSION_ACCEPTANCE_INVALID',
            `${acceptancePath}: ${message}`,
          );
        },
      );
    }
    if (!supersededIndexPaths.has(leaves[0].owner.relativePath)) {
      await assertApplicabilityManifest(
        repositoryRoot,
        leaves[0].supersession.currentApplicabilityManifest,
        leaves[0].supersession.sourceRevision,
      );
    }
    supersessionLeaves.set(target, leaves[0]);
  }

  for (const [target, leaf] of recertificationLeaves) {
    if (supersessionLeaves.has(target)) continue;
    if (!supersededIndexPaths.has(leaf.owner.relativePath)) {
      await assertApplicabilityManifest(
        repositoryRoot,
        leaf.recertification.currentApplicabilityManifest,
        leaf.recertification.sourceRevision,
      );
    }
  }

  for (const { index, relativePath } of indexes) {
    if (relativePath === 'tests/evidence/authority-46-phase-c-applicability/index.json') {
      const specifications = phaseCTopologyDecision.proofTopology.maintenance.targets;
      if (
        index.records.length !== 0
        || Object.hasOwn(index, 'applicabilityProfile')
        || Object.hasOwn(index, 'milestone')
        || Object.hasOwn(index, 'applicabilityManifest')
        || !Array.isArray(index.supersessions)
        || canonicalJson(index.supersessions.map(({ path }) => path))
          !== canonicalJson(specifications.map(({ successorPath }) => successorPath))
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_INVALID',
          `${relativePath} must be the exact zero-record fourteen-successor maintenance root`,
        );
      }
      for (const [position, reference] of index.supersessions.entries()) {
        const specification = specifications[position];
        const node = await assertDigest(repositoryRoot, reference);
        if (
          node.previousSupersession?.path !== specification.predecessorPath
          || node.authorization?.path
            !== 'decisions/0006-phase-c-applicability-topology-acceptance.json'
          || canonicalJson(node.affectedAssertions) !== canonicalJson(specification.affectedAssertions)
          || canonicalJson(node.historicalIndex) !== canonicalJson(specification.historicalIndex)
          || node.sourceRevision !== index.sourceRevision
          || node.sourceTree !== index.sourceTree
        ) {
          throw new EvidenceIntegrityError(
            'EVIDENCE_SUPERSESSION_INVALID',
            `${reference.path} must extend its exact Decision-0006 maintenance predecessor`,
          );
        }
      }
    }
    if (index.applicabilityManifest) {
      try {
        await assertApplicabilityManifest(
          repositoryRoot,
          index.applicabilityManifest,
          index.sourceRevision,
        );
      } catch (error) {
        if (
          !(error instanceof EvidenceIntegrityError)
          || error.code !== 'EVIDENCE_APPLICABILITY_MISMATCH'
          || (
            !recertificationLeaves.has(relativePath)
            && !supersessionLeaves.has(relativePath)
          )
        ) throw error;
      }
    }
    const indexValidation = index.validation
      ? await assertDigest(repositoryRoot, index.validation)
      : null;
    for (const result of indexValidation?.results ?? []) {
      if (!result.rawOutput) continue;
      const rawOutput = await assertFileDigest(repositoryRoot, result.rawOutput);
      const text = rawOutput.toString('utf8');
      if (hasUnsanitizedEvidenceOutput(text, repositoryRoot)) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_RAW_OUTPUT_UNSANITIZED',
          `${result.rawOutput.path} contains a private path or credential-shaped value`,
        );
      }
    }
    indexCount += 1;
    for (const reference of index.records) {
      const record = await assertDigest(repositoryRoot, reference);
      if (relativePath.startsWith('tests/evidence/tale-token-phase-a-')) {
        assertTaleTokenPhaseAProfile(record.applicabilityProfile, (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
            `${reference.path} ${message}`,
          );
        });
      }
      if (relativePath.startsWith('tests/evidence/tale-token-phase-b-')) {
        assertTaleTokenPhaseBProfile(record.applicabilityProfile, (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
            `${reference.path} ${message}`,
          );
        });
      }
      if (relativePath.startsWith('tests/evidence/tale-token-phase-c-')) {
        assertTaleTokenPhaseCProfile(record.applicabilityProfile, (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
            `${reference.path} ${message}`,
          );
        });
      }
      recordCount += 1;
      if (record.assertionId !== reference.assertionId) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_ASSERTION_MISMATCH',
          `${reference.path} does not own ${reference.assertionId}`,
        );
      }
      if (record.sourceRevision !== index.sourceRevision) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SOURCE_MISMATCH',
          `${reference.path} does not match index source revision`,
        );
      }
      if (
        index.applicabilityManifest
        && canonicalJson(record.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_APPLICABILITY_MISMATCH',
          `${reference.path} does not match the index applicability manifest`,
        );
      }
      if (
        Boolean(record.validation) !== Boolean(index.validation)
        || (
          index.validation
          && canonicalJson(record.validation) !== canonicalJson(index.validation)
        )
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_VALIDATION_MISMATCH',
          `${reference.path} does not match the index validation reference`,
        );
      }
      if (
        indexValidation
        && (
          indexValidation.sourceRevision !== record.sourceRevision
          || indexValidation.sourceTree !== record.sourceTree
        )
      ) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_VALIDATION_SOURCE_MISMATCH',
          `${reference.path} validation does not match its source identity`,
        );
      }
      const artifact = await assertDigest(repositoryRoot, record.artifact);
      if (relativePath.startsWith('tests/evidence/tale-token-phase-a-')) {
        assertTaleTokenPhaseAProfile(artifact.applicabilityProfile, (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
            `${record.artifact.path} ${message}`,
          );
        });
        if (relativePath === 'tests/evidence/tale-token-phase-a-gate-0/index.json') {
          const expectedPaths = [
            'tests/evidence/g0.0/index.json',
            'tests/evidence/tale-token-phase-a-g0.1/index.json',
            'tests/evidence/tale-token-phase-a-g0.2/index.json',
            'tests/evidence/tale-token-phase-a-g0.3/index.json',
            'tests/evidence/tale-token-phase-a-g0.4/index.json',
            'tests/evidence/tale-token-phase-a-g0.5/index.json',
          ];
          const upstream = artifact.observations?.upstreamEvidence?.indexes;
          if (
            !Array.isArray(upstream)
            || canonicalJson(upstream.map(({ path }) => path)) !== canonicalJson(expectedPaths)
          ) {
            throw new EvidenceIntegrityError(
              'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
              `${record.artifact.path} must bind G0.0 plus five exact TALE-TOKEN-A indexes`,
            );
          }
          for (const upstreamReference of upstream) {
            const bytes = await readFile(join(repositoryRoot, upstreamReference.path));
            const expectedProfile = upstreamReference.path === 'tests/evidence/g0.0/index.json'
              ? null
              : 'sha256:082e73351726a92a13d1aa5f9cf890d58c01189be84d71b54c35ec3ae3a4cfcb';
            if (
              upstreamReference.sha256 !== `sha256:${sha256(bytes)}`
              || upstreamReference.profileDigest !== expectedProfile
            ) {
              throw new EvidenceIntegrityError(
                'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
                `${record.artifact.path} has an invalid upstream profile/index binding`,
              );
            }
          }
        }
      }
      if (relativePath.startsWith('tests/evidence/tale-token-phase-b-')) {
        assertTaleTokenPhaseBProfile(artifact.applicabilityProfile, (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
            `${record.artifact.path} ${message}`,
          );
        });
        if (relativePath === 'tests/evidence/tale-token-phase-b-gate-0/index.json') {
          const expectedPaths = [
            'tests/evidence/g0.0/index.json',
            'tests/evidence/tale-token-phase-b-g0.1/index.json',
            'tests/evidence/tale-token-phase-b-g0.2/index.json',
            'tests/evidence/tale-token-phase-b-g0.3/index.json',
            'tests/evidence/tale-token-phase-b-g0.4/index.json',
            'tests/evidence/tale-token-phase-b-g0.5/index.json',
          ];
          const upstream = artifact.observations?.upstreamEvidence?.indexes;
          if (
            !Array.isArray(upstream)
            || canonicalJson(upstream.map(({ path }) => path)) !== canonicalJson(expectedPaths)
          ) {
            throw new EvidenceIntegrityError(
              'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
              `${record.artifact.path} must bind G0.0 plus five exact TALE-TOKEN-B indexes`,
            );
          }
          for (const upstreamReference of upstream) {
            const bytes = await readFile(join(repositoryRoot, upstreamReference.path));
            const expectedProfile = upstreamReference.path === 'tests/evidence/g0.0/index.json'
              ? null
              : TALE_TOKEN_PHASE_B_PROFILE_DIGEST;
            if (
              upstreamReference.sha256 !== `sha256:${sha256(bytes)}`
              || upstreamReference.profileDigest !== expectedProfile
            ) {
              throw new EvidenceIntegrityError(
                'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
                `${record.artifact.path} has an invalid upstream profile/index binding`,
              );
            }
          }
          const expectedSupersessionPaths = [
            'tests/evidence/tale-token-phase-b-gate-0/supersessions/g0.1.json',
            'tests/evidence/tale-token-phase-b-gate-0/supersessions/g0.2.json',
            'tests/evidence/tale-token-phase-b-gate-0/supersessions/g0.3.json',
            'tests/evidence/tale-token-phase-b-gate-0/supersessions/g0.4.json',
            'tests/evidence/tale-token-phase-b-gate-0/supersessions/g0.5.json',
            'tests/evidence/tale-token-phase-b-gate-0/supersessions/gate-0.json',
          ];
          if (
            !Array.isArray(index.supersessions)
            || canonicalJson(index.supersessions.map(({ path }) => path))
              !== canonicalJson(expectedSupersessionPaths)
          ) {
            throw new EvidenceIntegrityError(
              'EVIDENCE_SUPERSESSION_INVALID',
              `${relativePath} must own exactly six Phase A supersessions`,
            );
          }
          for (const reference of index.supersessions) {
            const node = await assertDigest(repositoryRoot, reference);
            const file = reference.path.split('/').at(-1);
            const expectedHistorical = `tests/evidence/tale-token-phase-a-${file.replace(/\.json$/u, '')}/index.json`;
            if (node.historicalIndex?.path !== expectedHistorical) {
              throw new EvidenceIntegrityError(
                'EVIDENCE_SUPERSESSION_INVALID',
                `${reference.path} must target ${expectedHistorical}`,
              );
            }
          }
        }
      }
      if (relativePath.startsWith('tests/evidence/tale-token-phase-c-')) {
        assertTaleTokenPhaseCProfile(artifact.applicabilityProfile, (message) => {
          throw new EvidenceIntegrityError(
            'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
            `${record.artifact.path} ${message}`,
          );
        });
        if (relativePath === 'tests/evidence/tale-token-phase-c-gate-0/index.json') {
          const expectedPaths = [
            'tests/evidence/g0.0/index.json',
            'tests/evidence/tale-token-phase-c-g0.1/index.json',
            'tests/evidence/tale-token-phase-c-g0.2/index.json',
            'tests/evidence/tale-token-phase-c-g0.3/index.json',
            'tests/evidence/tale-token-phase-c-g0.4/index.json',
            'tests/evidence/tale-token-phase-c-g0.5/index.json',
          ];
          const upstream = artifact.observations?.upstreamEvidence?.indexes;
          if (
            !Array.isArray(upstream)
            || canonicalJson(upstream.map(({ path }) => path)) !== canonicalJson(expectedPaths)
          ) {
            throw new EvidenceIntegrityError(
              'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
              `${record.artifact.path} must bind G0.0 plus five exact TALE-TOKEN-C indexes`,
            );
          }
          for (const upstreamReference of upstream) {
            const bytes = await readFile(join(repositoryRoot, upstreamReference.path));
            const expectedProfile = upstreamReference.path === 'tests/evidence/g0.0/index.json'
              ? null
              : TALE_TOKEN_PHASE_C_PROFILE_DIGEST;
            if (
              upstreamReference.sha256 !== `sha256:${sha256(bytes)}`
              || upstreamReference.profileDigest !== expectedProfile
            ) {
              throw new EvidenceIntegrityError(
                'EVIDENCE_APPLICABILITY_PROFILE_INVALID',
                `${record.artifact.path} has an invalid upstream profile/index binding`,
              );
            }
          }
          const expectedSupersessionPaths = [
            'tests/evidence/tale-token-phase-c-gate-0/supersessions/g0.1.json',
            'tests/evidence/tale-token-phase-c-gate-0/supersessions/g0.2.json',
            'tests/evidence/tale-token-phase-c-gate-0/supersessions/g0.3.json',
            'tests/evidence/tale-token-phase-c-gate-0/supersessions/g0.4.json',
            'tests/evidence/tale-token-phase-c-gate-0/supersessions/g0.5.json',
            'tests/evidence/tale-token-phase-c-gate-0/supersessions/gate-0.json',
          ];
          if (
            !Array.isArray(index.supersessions)
            || canonicalJson(index.supersessions.map(({ path }) => path))
              !== canonicalJson(expectedSupersessionPaths)
          ) {
            throw new EvidenceIntegrityError(
              'EVIDENCE_SUPERSESSION_INVALID',
              `${relativePath} must own exactly six Phase-B applicability supersessions`,
            );
          }
          for (const reference of index.supersessions) {
            const node = await assertDigest(repositoryRoot, reference);
            const name = reference.path.split('/').at(-1);
            if (
              node.previousSupersession?.path
                !== `tests/evidence/authority-39-phase-c-applicability-topology/supersessions/phase-b-${name}`
              || node.authorization?.path
                !== 'decisions/0006-phase-c-applicability-topology-acceptance.json'
              || node.historicalIndex?.path
                !== `tests/evidence/tale-token-phase-b-${name.replace('.json', '')}/index.json`
            ) {
              throw new EvidenceIntegrityError(
                'EVIDENCE_SUPERSESSION_INVALID',
                `${reference.path} must extend its exact Phase-B decision-0006 authority-stage predecessor`,
              );
            }
          }
        }
      }
      artifactCount += 1;
    }
  }

  return {
    indexCount,
    recordCount,
    artifactCount,
    recertificationCount,
    supersessionCount,
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  try {
    const result = await verifyEvidence(repositoryRoot);
    console.log(
      `[evidence] verified ${result.indexCount} immutable index, `
        + `${result.recordCount} records, ${result.artifactCount} artifacts, and `
        + `${result.recertificationCount} recertifications and `
        + `${result.supersessionCount} supersessions`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
