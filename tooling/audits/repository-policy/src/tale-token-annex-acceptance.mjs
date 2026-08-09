import { sha256 } from './policy.mjs';

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const OWNER_NODE_ID = 'MDQ6VXNlcjc0MzE0OTg0';
const COMMENT_NODE_ID = /^IC_[A-Za-z0-9_-]+$/u;

export function acceptanceCommentBody({ annexPath, annexSha256, annexBytes }) {
  return [
    'Accept Tale token classification annex',
    `Path: ${annexPath}`,
    `SHA-256: ${annexSha256}`,
    `Bytes: ${annexBytes}`,
    'Decision: accepted',
    'Owner: ndrewtran',
    'Issue: #39',
  ].join('\n');
}

function exactKeys(value, expected, fail, path) {
  const actual = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${path} has an invalid closed shape`);
}

export function assertTaleAnnexAcceptanceRecord(
  record,
  annexPath,
  annexBytes,
  fail,
  acceptanceRecordSchema = 'core-ui-authority-decision-v1',
) {
  exactKeys(record, ['schema', 'decisionId', 'outcome', 'owner', 'ownerNodeId', 'provider', 'repository', 'issueNumber', 'commentId', 'commentNodeId', 'createdAt', 'url', 'bodySha256'], fail, 'acceptance record');
  const annexSha256 = `sha256:${sha256(annexBytes)}`;
  const expectedBody = acceptanceCommentBody({ annexPath, annexSha256, annexBytes: Buffer.byteLength(annexBytes) });
  if (record?.schema !== acceptanceRecordSchema || record?.decisionId !== 'core-ui:decision:0003' || record?.outcome !== 'accepted' || record?.owner !== 'ndrewtran' || record?.provider !== 'github' || record?.repository !== 'ndrewtran/core-ui' || record?.issueNumber !== 39) fail('acceptance identity is invalid');
  if (record?.bodySha256 !== `sha256:${sha256(expectedBody)}`) fail('acceptance annex digest binding is invalid');
  if (!Number.isSafeInteger(record?.commentId) || record.commentId < 1 || !COMMENT_NODE_ID.test(record?.commentNodeId ?? '') || record?.ownerNodeId !== OWNER_NODE_ID || !RFC3339.test(record?.createdAt) || Number.isNaN(Date.parse(record.createdAt)) || record.url !== `https://github.com/ndrewtran/core-ui/issues/39#issuecomment-${record.commentId}`) fail('acceptance comment identity is invalid');
}

export function acceptanceRecordFromGitHubComment(comment, annexPath, annexBytes, fail) {
  const annexSha256 = `sha256:${sha256(annexBytes)}`;
  const expectedBody = acceptanceCommentBody({
    annexPath,
    annexSha256,
    annexBytes: Buffer.byteLength(annexBytes),
  });
  if (
    !Number.isSafeInteger(comment?.id)
    || comment.id < 1
    || !COMMENT_NODE_ID.test(comment?.node_id ?? '')
    || comment?.body !== expectedBody
    || comment?.user?.login !== 'ndrewtran'
    || comment?.user?.node_id !== OWNER_NODE_ID
    || comment?.author_association !== 'OWNER'
    || comment?.issue_url !== 'https://api.github.com/repos/ndrewtran/core-ui/issues/39'
    || comment?.html_url !== `https://github.com/ndrewtran/core-ui/issues/39#issuecomment-${comment.id}`
    || !RFC3339.test(comment?.created_at ?? '')
    || Number.isNaN(Date.parse(comment?.created_at))
  ) fail('authenticated GitHub acceptance comment is invalid');
  return {
    bodySha256: `sha256:${sha256(expectedBody)}`,
    commentId: comment.id,
    commentNodeId: comment.node_id,
    createdAt: comment.created_at,
    decisionId: 'core-ui:decision:0003',
    issueNumber: 39,
    outcome: 'accepted',
    owner: 'ndrewtran',
    ownerNodeId: OWNER_NODE_ID,
    provider: 'github',
    repository: 'ndrewtran/core-ui',
    schema: 'core-ui-authority-decision-v1',
    url: comment.html_url,
  };
}
