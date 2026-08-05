import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { generatedText, normalizePath } from '../../../tooling/audits/repository-policy/src/policy.mjs';
import { buildCommandProjections, commandSurfaceModule } from './registry.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const source = 'packages/tooling/command-registry.json';
const outputs = [
  {
    path: 'packages/tooling/generated/command-surface.mjs',
    body: (projections) => commandSurfaceModule(projections),
  },
  {
    path: 'packages/tooling/generated/response-types.d.ts',
    body: (projections) => projections.responseTypes,
  },
];

const registry = JSON.parse(await readFile(join(repositoryRoot, source), 'utf8'));
const policy = JSON.parse(await readFile(
  join(repositoryRoot, 'tooling/audits/repository-policy/repository-policy.json'),
  'utf8',
));
const projections = buildCommandProjections(registry);

for (const output of outputs) {
  const expected = generatedText({ source, body: output.body(projections), policy });
  const outputPath = join(repositoryRoot, output.path);
  if (process.argv.includes('--check')) {
    const actual = await readFile(outputPath, 'utf8').catch(() => null);
    if (actual !== expected) {
      console.error(
        `CLI_GENERATED_SURFACE_DRIFT: ${normalizePath(output.path)} must be regenerated from ${source}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`[tooling] generated surface matches ${source}: ${normalizePath(output.path)}`);
    }
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, expected);
    console.log(`[tooling] generated ${normalizePath(output.path)}`);
  }
}
