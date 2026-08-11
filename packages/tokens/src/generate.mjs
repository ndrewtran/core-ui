import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canonicalJson, parseJsonStrict } from '@core-ui/schema';
import {
  projectTaleBaselineOccurrences,
  TALE_TOKEN_MATERIALIZATION_IDENTITIES,
  TALE_TOKEN_MATERIALIZATION_PATHS,
} from './tale-token-materialization.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const outputPath = 'packages/tokens/generated/tale-token-occurrences.json';
const provenancePath = `${outputPath}.provenance`;
const sourcePath = TALE_TOKEN_MATERIALIZATION_PATHS.parentDecision;
const parentBytes = await readFile(resolve(repositoryRoot, sourcePath), 'utf8');
const digest = `sha256:${createHash('sha256').update(parentBytes).digest('hex')}`;
if (digest !== TALE_TOKEN_MATERIALIZATION_IDENTITIES.parentDecision) {
  throw new Error('CORE_TALE_RESET_DECISION_MISMATCH: parent decision digest');
}
const occurrences = projectTaleBaselineOccurrences(parseJsonStrict(parentBytes));
const expected = `${canonicalJson(occurrences)}\n`;
const outputDigest = `sha256:${createHash('sha256').update(expected).digest('hex')}`;
const provenanceBody = `${canonicalJson({ path: outputPath, sha256: outputDigest })}\n`;
const provenanceDigest = `sha256:${createHash('sha256').update(provenanceBody).digest('hex')}`;
const expectedProvenance = [
  `// @generated-from: ${sourcePath}`,
  `// @generated-content-sha256: ${provenanceDigest}`,
  provenanceBody,
].join('\n');
const outputs = [
  { path: resolve(repositoryRoot, outputPath), expected, label: outputPath },
  { path: resolve(repositoryRoot, provenancePath), expected: expectedProvenance, label: provenancePath },
];
for (const output of outputs) {
  if (process.argv.includes('--check')) {
    const actual = await readFile(output.path, 'utf8').catch(() => null);
    if (actual !== output.expected) {
      console.error(`CORE_TALE_OCCURRENCE_PROJECTION_DRIFT: ${output.label}`);
      process.exitCode = 1;
    }
  } else {
    await mkdir(dirname(output.path), { recursive: true });
    await writeFile(output.path, output.expected);
  }
}
if (!process.exitCode) console.log('[tokens] Tale occurrence projection matches accepted decision 0003');
