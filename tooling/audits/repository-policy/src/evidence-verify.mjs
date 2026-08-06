import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { sha256 } from './policy.mjs';

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

async function manifestEntries(repositoryRoot, declaredPaths) {
  const entries = [];

  async function visit(relativePath) {
    const absolutePath = join(repositoryRoot, relativePath);
    const metadata = await stat(absolutePath);
    if (metadata.isDirectory()) {
      const children = await readdir(absolutePath);
      children.sort((left, right) => left.localeCompare(right));
      for (const child of children) await visit(join(relativePath, child));
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
  let indexCount = 0;
  let recordCount = 0;
  let artifactCount = 0;

  for (const entry of milestones.filter((item) => item.isDirectory())) {
    const indexPath = join(evidenceRoot, entry.name, 'index.json');
    const { value: index } = await readCanonicalJson(indexPath);
    if (index.applicabilityManifest) {
      await assertApplicabilityManifest(repositoryRoot, index.applicabilityManifest);
    }
    const indexValidation = index.validation
      ? await assertDigest(repositoryRoot, index.validation)
      : null;
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

  return { indexCount, recordCount, artifactCount };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const repositoryRoot = resolve(import.meta.dirname, '../../../..');
  try {
    const result = await verifyEvidence(repositoryRoot);
    console.log(
      `[evidence] verified ${result.indexCount} immutable index, `
        + `${result.recordCount} records, and ${result.artifactCount} artifacts`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
