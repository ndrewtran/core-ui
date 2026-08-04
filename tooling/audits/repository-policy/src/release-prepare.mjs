import { resolve } from 'node:path';
import { discoverWorkspacePackages } from './workspace-packages.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const packages = await discoverWorkspacePackages(repositoryRoot);
const publishable = packages.filter(({ manifest }) => manifest.private !== true);

if (publishable.length > 0) {
  console.error(
    `FOUNDATION_RELEASE_FORBIDDEN: G0.0 has unexpected publishable packages: ${publishable.map(({ name }) => name).join(', ')}`,
  );
  process.exit(1);
}

console.log(
  'Foundation checks passed; no publishable package or public release candidate exists at G0.0.',
);
