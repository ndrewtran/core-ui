import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { PNG } from 'pngjs';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const appRoot = resolve(import.meta.dirname, '..');
const captureScript = resolve(appRoot, 'visual-migration/bootstrap/capture.mjs');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function digest(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) hash.update(`${entry.name}\0${entry.sha256}\0${entry.width}x${entry.height}\n`);
  return `sha256:${hash.digest('hex')}`;
}

async function inventory(outputDir) {
  const names = (await readdir(outputDir)).filter((name) => name.endsWith('.png')).sort();
  const entries = [];
  for (const name of names) {
    const bytes = await readFile(resolve(outputDir, name));
    const image = PNG.sync.read(bytes);
    entries.push({ name, sha256: createHash('sha256').update(bytes).digest('hex'), width: image.width, height: image.height });
  }
  return entries;
}

async function capture(taleRoot, outputDir) {
  await execFileAsync(process.execPath, [
    captureScript,
    '--tale-root', taleRoot,
    '--output-dir', outputDir,
    '--metadata', `${outputDir}.metadata.json`,
  ], { cwd: appRoot, maxBuffer: 10 * 1024 * 1024 });
}

const taleRoot = argument('--tale-root');
if (!taleRoot) throw new Error('usage: verify-tale-capture-reproducibility.mjs --tale-root <pinned-checkout>');
const temporaryRoot = await mkdtemp('/tmp/core-ui-tale-visual-repro-');
try {
  const firstOutput = resolve(temporaryRoot, 'first');
  const secondOutput = resolve(temporaryRoot, 'second');
  await capture(taleRoot, firstOutput);
  await capture(taleRoot, secondOutput);
  const first = await inventory(firstOutput);
  const second = await inventory(secondOutput);
  if (first.length !== 264 || second.length !== 264) throw new Error(`expected 264 captures per run, got ${first.length} and ${second.length}`);
  const mismatches = first.flatMap((entry, index) => {
    const other = second[index];
    return !other || entry.name !== other.name || entry.sha256 !== other.sha256 || entry.width !== other.width || entry.height !== other.height
      ? [{ first: entry, second: other }]
      : [];
  });
  if (mismatches.length > 0) throw new Error(`pinned Tale recapture is not reproducible (${mismatches.length} mismatches): ${JSON.stringify(mismatches.slice(0, 3))}`);
  console.log(`Reproducible pinned Tale captures: ${first.length} artifacts, digest ${digest(first)}`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
