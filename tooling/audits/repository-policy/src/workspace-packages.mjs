import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { normalizePath } from './policy.mjs';

const WORKSPACE_ROOTS = ['apps', 'packages', 'tooling'];
const IGNORED = new Set(['node_modules', 'fixtures']);

async function findManifests(repositoryRoot, current) {
  const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
  const manifests = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED.has(entry.name)) {
        manifests.push(...await findManifests(repositoryRoot, path));
      }
    } else if (entry.isFile() && entry.name === 'package.json') {
      manifests.push(path);
    }
  }
  return manifests;
}

export async function discoverWorkspacePackages(repositoryRoot) {
  const manifests = [];
  for (const root of WORKSPACE_ROOTS) {
    manifests.push(...await findManifests(repositoryRoot, join(repositoryRoot, root)));
  }

  const packages = [];
  for (const manifestPath of manifests) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!manifest.name) continue;
    packages.push({
      name: manifest.name,
      path: normalizePath(relative(repositoryRoot, manifestPath)).replace(/\/package\.json$/, ''),
      manifest,
    });
  }
  return packages.sort((a, b) => a.path.localeCompare(b.path));
}
