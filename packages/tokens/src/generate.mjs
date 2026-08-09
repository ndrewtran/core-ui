import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import { generatedText } from '../../../tooling/audits/repository-policy/src/policy.mjs';
import {
  TALE_TOKEN_ANNEX_PATH,
  TALE_TOKEN_SOURCE_PATH,
  projectedTaleTokenOccurrences,
} from './tale-token-materialization.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const outputPath = 'packages/tokens/generated/tale-token-occurrences.json';
const provenancePath = `${outputPath}.provenance`;
const annex = parseJsonStrict(await readFile(join(repositoryRoot, TALE_TOKEN_ANNEX_PATH), 'utf8'));
const source = parseJsonStrict(await readFile(join(repositoryRoot, TALE_TOKEN_SOURCE_PATH), 'utf8'));
const repositoryPolicy = parseJsonStrict(await readFile(
  join(repositoryRoot, 'tooling/audits/repository-policy/repository-policy.json'),
  'utf8',
));
const bytes = `${canonicalJson(projectedTaleTokenOccurrences(annex, source))}\n`;
const provenanceBody = `${canonicalJson({
  path: outputPath,
  sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
})}\n`;
const outputs = [
  { path: outputPath, expected: bytes },
  {
    path: provenancePath,
    expected: generatedText({
      source: TALE_TOKEN_ANNEX_PATH,
      body: provenanceBody,
      policy: repositoryPolicy,
    }),
  },
];

for (const output of outputs) {
  const absolutePath = join(repositoryRoot, output.path);
  if (process.argv.includes('--check')) {
    const actual = await readFile(absolutePath, 'utf8').catch(() => null);
    if (actual !== output.expected) {
      console.error(`TOKENS_GENERATED_DRIFT: ${output.path} must be regenerated`);
      process.exitCode = 1;
    } else {
      console.log(`[tokens] generated output matches accepted annex: ${output.path}`);
    }
  } else {
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, output.expected);
    console.log(`[tokens] generated ${output.path}`);
  }
}
