import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';

const AUTHORITY = Object.freeze({
  acceptancePath: 'decisions/0010-amendment-04-r1-continuous-execution-acceptance.md',
  candidatePath: 'decisions/0010-amendment-04-r1-continuous-execution-envelope.md',
  decisionPath: 'decisions/0010-amendment-04-r1-continuous-execution.md',
  decisionSha256: '321fefef4e723ee2d636a4ea6917436bf0babb5c6c7da2a5450e1ffc5c37871f',
  manifestPath: 'decisions/0010-amendment-04-r1-continuous-execution-materialization.json',
  productScopePath: 'strategy/product-scope.md',
});

const OWNER_COMMENT_URL = /^https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*$/u;
const sha256 = (source) => createHash('sha256').update(source).digest('hex');
const renderTemplate = (template, substitutions) => Object.entries(substitutions).reduce(
  (output, [name, value]) => output.replaceAll(`{${name}}`, value),
  template,
);
const readOptional = (repositoryRoot, relativePath) => {
  try {
    return readFileSync(join(repositoryRoot, relativePath));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};
const readStage0Blob = (repositoryRoot, relativePath) => {
  try {
    const records = execFileSync('git', [
      '-C',
      repositoryRoot,
      'ls-files',
      '--stage',
      '-z',
      '--',
      relativePath,
    ], { encoding: 'buffer' }).toString('utf8').split('\0').filter(Boolean);
    if (records.length !== 1) return null;
    const separator = records[0].indexOf('\t');
    if (separator < 0 || records[0].slice(separator + 1) !== relativePath) return null;
    const [mode, blob, stage] = records[0].slice(0, separator).split(' ');
    if (mode !== '100644' || stage !== '0' || !/^[0-9a-f]{40}$/u.test(blob) || /^0{40}$/u.test(blob)) return null;
    const indexedBytes = execFileSync('git', [
      '-C',
      repositoryRoot,
      'cat-file',
      'blob',
      blob,
    ], { encoding: 'buffer' });
    const indexBytes = execFileSync('git', [
      '-C',
      repositoryRoot,
      'show',
      `:0:${relativePath}`,
    ], { encoding: 'buffer' });
    if (!indexedBytes.equals(indexBytes)) return null;
    return indexedBytes;
  } catch {
    return null;
  }
};
const acceptanceMatchesStage0Blob = (repositoryRoot, relativePath, acceptanceBytes) => {
  const indexedBytes = readStage0Blob(repositoryRoot, relativePath);
  return indexedBytes !== null && indexedBytes.equals(acceptanceBytes);
};

// The acceptance record is valid only when the worktree bytes are bound to a
// non-zero stage-0 index blob. This rejects worktree-only and intent-to-add
// receipts before any authority claims are consumed.
const isBoundAcceptance = (repositoryRoot, relativePath, acceptanceBytes) => {
  try {
    return acceptanceMatchesStage0Blob(repositoryRoot, relativePath, acceptanceBytes);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

// This consumes the accepted manifest relationship; it owns no authority fact.
export function hasAcceptedR1ContinuousAuthority(repositoryRoot, { productScopeSource } = {}) {
  const acceptanceBytes = readOptional(repositoryRoot, AUTHORITY.acceptancePath);
  if (!acceptanceBytes || !isBoundAcceptance(repositoryRoot, AUTHORITY.acceptancePath, acceptanceBytes)) return false;
  const decision = readOptional(repositoryRoot, AUTHORITY.decisionPath);
  const candidate = readOptional(repositoryRoot, AUTHORITY.candidatePath);
  const manifestBytes = readOptional(repositoryRoot, AUTHORITY.manifestPath);
  if (!decision || !candidate || !manifestBytes || !acceptanceBytes) return false;
  if (sha256(decision) !== AUTHORITY.decisionSha256) return false;

  let manifest;
  try {
    manifest = parseJsonStrict(manifestBytes.toString('utf8'));
  } catch {
    return false;
  }
  if (canonicalJson(manifest) !== manifestBytes.toString('utf8')) return false;
  const renderer = manifest.acceptanceRecordRenderer;
  if (
    manifest.profile !== 'core-ui-r1-continuous-execution-materialization-manifest-v1'
    || manifest.selfPath !== AUTHORITY.manifestPath
    || manifest.candidate?.path !== AUTHORITY.candidatePath
    || manifest.candidate?.algorithm !== 'sha256'
    || manifest.candidate?.byteLength !== candidate.byteLength
    || manifest.candidate?.digest !== sha256(candidate)
    || renderer?.outputPath !== AUTHORITY.acceptancePath
    || renderer?.owner !== 'Andrew / ndrewtran'
    || renderer?.ownerComment?.author !== 'ndrewtran'
    || renderer?.ownerComment?.repository !== 'ndrewtran/core-ui'
    || renderer?.ownerComment?.body !== 'exact-rendered-owner-statement'
    || renderer?.ownerComment?.urlPattern !== 'https://github.com/ndrewtran/core-ui/pull/{authorityPrNumber}#issuecomment-{commentId}'
    || typeof renderer?.ownerStatementTemplate !== 'string'
    || typeof renderer?.outputTemplate !== 'string'
    || canonicalJson(renderer?.substitutions) !== canonicalJson([
      'candidateSha256',
      'manifestSha256',
      'ownerCommentUrl',
      'ownerStatement',
      'ownerStatementSha256',
    ])
  ) return false;

  if (!Array.isArray(manifest.staticAfterImages)) return false;
  const imagePaths = new Set();
  let productScopeBound = false;
  for (const image of manifest.staticAfterImages) {
    if (
      image.algorithm !== 'sha256'
      || typeof image.path !== 'string'
      || image.path.startsWith('/')
      || image.path.split('/').includes('..')
      || imagePaths.has(image.path)
    ) return false;
    imagePaths.add(image.path);
    const source = image.path === AUTHORITY.productScopePath && productScopeSource !== undefined
      ? Buffer.from(productScopeSource)
      : readOptional(repositoryRoot, image.path);
    if (!source || image.byteLength !== source.byteLength || image.digest !== sha256(source)) return false;
    if (image.path === AUTHORITY.productScopePath) productScopeBound = true;
  }
  if (!productScopeBound) return false;
  const expectedWriteSet = new Set([
    AUTHORITY.acceptancePath,
    AUTHORITY.manifestPath,
    ...manifest.staticAfterImages.map(({ path }) => path),
  ]);
  if (
    !Array.isArray(manifest.writeSet)
    || manifest.writeSet.length !== expectedWriteSet.size
    || manifest.writeSet.some((path) => !expectedWriteSet.has(path))
  ) return false;

  const acceptance = acceptanceBytes.toString('utf8');
  const ownerCommentMatch = acceptance.match(/^Owner record: `(https:\/\/github\.com\/ndrewtran\/core-ui\/pull\/[1-9]\d*#issuecomment-[1-9]\d*)`$/mu);
  const ownerCommentUrl = ownerCommentMatch?.[1];
  if (!ownerCommentUrl || !OWNER_COMMENT_URL.test(ownerCommentUrl)) return false;
  const manifestSha256 = sha256(manifestBytes);
  const ownerStatement = renderTemplate(renderer.ownerStatementTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
  });
  return acceptance === renderTemplate(renderer.outputTemplate, {
    candidateSha256: manifest.candidate.digest,
    manifestSha256,
    ownerCommentUrl,
    ownerStatement,
    ownerStatementSha256: sha256(ownerStatement),
  });
}
