import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { isIgnoredRepositoryEntry, sha256 } from './policy.mjs';

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
  if (manifest.profile !== 'core-ui-path-manifest-v1') {
    throw new EvidenceIntegrityError(
      'EVIDENCE_MANIFEST_PROFILE_INVALID',
      `unsupported applicability manifest profile ${manifest.profile}`,
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
  let indexCount = 0;
  let recordCount = 0;
  let artifactCount = 0;
  let recertificationCount = 0;

  for (const entry of milestones.filter((item) => item.isDirectory())) {
    const indexPath = join(evidenceRoot, entry.name, 'index.json');
    const result = await readCanonicalJson(indexPath);
    indexes.push({
      index: result.value,
      indexBytes: result.bytes,
      relativePath: `tests/evidence/${entry.name}/index.json`,
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
    await assertApplicabilityManifest(
      repositoryRoot,
      leaves[0].recertification.currentApplicabilityManifest,
    );
    recertificationLeaves.set(target, leaves[0].recertification);
  }

  for (const { index, relativePath } of indexes) {
    if (index.applicabilityManifest) {
      try {
        await assertApplicabilityManifest(repositoryRoot, index.applicabilityManifest);
      } catch (error) {
        if (
          !(error instanceof EvidenceIntegrityError)
          || error.code !== 'EVIDENCE_APPLICABILITY_MISMATCH'
          || !recertificationLeaves.has(relativePath)
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
      await assertDigest(repositoryRoot, record.artifact);
      artifactCount += 1;
    }
  }

  return { indexCount, recordCount, artifactCount, recertificationCount };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  try {
    const result = await verifyEvidence(repositoryRoot);
    console.log(
      `[evidence] verified ${result.indexCount} immutable index, `
        + `${result.recordCount} records, ${result.artifactCount} artifacts, and `
        + `${result.recertificationCount} recertifications`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
