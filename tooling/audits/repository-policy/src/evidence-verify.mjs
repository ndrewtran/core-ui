import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import {
  assertApplicabilitySupersessionReference,
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from './evidence-applicability-supersession.mjs';
import { isIgnoredRepositoryEntry, sha256 } from './policy.mjs';
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
} from '../../../../tests/evidence/tale-token-phase-c-profile.mjs';

export class EvidenceIntegrityError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'EvidenceIntegrityError';
    this.code = code;
  }
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

async function manifestEntries(repositoryRoot, declaredPaths) {
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
    if (!metadata.isFile()) {
      throw new EvidenceIntegrityError(
        'EVIDENCE_MANIFEST_ENTRY_INVALID',
        `${relativePath} is not a regular file`,
      );
    }
    const bytes = await readFile(absolutePath);
    entries.push({ path: relativePath, sha256: `sha256:${sha256(bytes)}` });
  }

  for (const relativePath of declaredPaths) await visit(relativePath);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function assertApplicabilityManifest(repositoryRoot, manifest) {
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
  const entries = await manifestEntries(repositoryRoot, manifest.paths);
  const actual = `sha256:${sha256(canonicalJson(entries))}`;
  if (actual !== manifest.sha256) {
    throw new EvidenceIntegrityError(
      'EVIDENCE_APPLICABILITY_MISMATCH',
      `applicable source paths have ${actual}; expected ${manifest.sha256}`,
    );
  }
}

export async function verifyEvidence(repositoryRoot) {
  const evidenceRoot = join(repositoryRoot, 'tests/evidence');
  const milestones = await readdir(evidenceRoot, { withFileTypes: true }).catch(() => []);
  const indexes = [];
  const phaseAIndexes = [];
  const phaseBIndexes = [];
  const phaseCIndexes = [];
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
    if (entry.name.startsWith('tale-token-phase-c-')) {
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
      const affectedAssertions = historical
        ? historical.index.records.map(({ assertionId }) => assertionId).sort()
        : [];
      if (historical && reference.milestone !== historical.index.milestone) {
        throw new EvidenceIntegrityError(
          'EVIDENCE_SUPERSESSION_MILESTONE_MISMATCH',
          `${reference.path} names ${reference.milestone}; expected ${historical.index.milestone}`,
        );
      }
      if (
        !historical?.index.applicabilityManifest
        || supersession.historicalIndex.sha256 !== historicalDigest
        || supersession.sourceRevision !== owner.index.sourceRevision
        || supersession.sourceTree !== owner.index.sourceTree
        || supersession.owner !== authorityDecision.owner
        || supersession.effectiveAt !== authorityDecision.createdAt
        || canonicalJson(supersession.affectedAssertions) !== canonicalJson(affectedAssertions)
        || canonicalJson(supersession.currentApplicabilityManifest.paths)
          !== canonicalJson(historical.index.applicabilityManifest.paths)
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
        const expectedManifest = recertificationLeaf
          ? recertificationLeaf.recertification.currentApplicabilityManifest
          : historical.index.applicabilityManifest;
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
      );
    }
  }

  for (const { index, relativePath } of indexes) {
    if (index.applicabilityManifest) {
      try {
        await assertApplicabilityManifest(repositoryRoot, index.applicabilityManifest);
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
      if (
        text.includes(repositoryRoot)
        || /\/(?:Users|private\/var)\//u.test(text)
        || /(?:authorization|api[-_]?key|token)\s*[:=]\s*\S+/iu.test(text)
      ) {
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
              `${relativePath} must own exactly six Phase B supersessions`,
            );
          }
          for (const reference of index.supersessions) {
            const node = await assertDigest(repositoryRoot, reference);
            const file = reference.path.split('/').at(-1);
            const expectedHistorical = `tests/evidence/tale-token-phase-b-${file.replace(/\.json$/u, '')}/index.json`;
            if (node.historicalIndex?.path !== expectedHistorical) {
              throw new EvidenceIntegrityError(
                'EVIDENCE_SUPERSESSION_INVALID',
                `${reference.path} must target ${expectedHistorical}`,
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
