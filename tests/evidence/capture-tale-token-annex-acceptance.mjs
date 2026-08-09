import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { canonicalJson } from '../../tooling/audits/repository-policy/src/canonical-json.mjs';
import { acceptanceRecordFromGitHubComment } from '../../tooling/audits/repository-policy/src/tale-token-annex-acceptance.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const annexPath = 'decisions/0003-tale-token-classification-annex.json';
const commentArgument = process.argv.indexOf('--comment-id');
const commentId = Number(process.argv[commentArgument + 1]);
if (commentArgument === -1 || !Number.isSafeInteger(commentId) || commentId < 1) {
  throw new Error('TALE_ANNEX_ACCEPTANCE_COMMENT_REQUIRED: pass --comment-id <positive GitHub comment ID>');
}

const annexBytes = await readFile(resolve(repositoryRoot, annexPath));
const { stdout } = await execFile('gh', [
  'api',
  `repos/ndrewtran/core-ui/issues/comments/${commentId}`,
], { cwd: repositoryRoot, encoding: 'utf8' });
const comment = JSON.parse(stdout);
const record = acceptanceRecordFromGitHubComment(
  comment,
  annexPath,
  annexBytes,
  (message) => { throw new Error(`TALE_ANNEX_ACCEPTANCE_CAPTURE_INVALID: ${message}`); },
);
process.stdout.write(canonicalJson(record));
