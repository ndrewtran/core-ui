import { readFile, readdir } from 'node:fs/promises';
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

export async function verifyEvidence(repositoryRoot) {
  const evidenceRoot = join(repositoryRoot, 'tests/evidence');
  const milestones = await readdir(evidenceRoot, { withFileTypes: true }).catch(() => []);
  let indexCount = 0;
  let recordCount = 0;
  let artifactCount = 0;

  for (const entry of milestones.filter((item) => item.isDirectory())) {
    const indexPath = join(evidenceRoot, entry.name, 'index.json');
    const { value: index } = await readCanonicalJson(indexPath);
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
