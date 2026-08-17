import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverWorkspacePackages } from './workspace-packages.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const packages = await discoverWorkspacePackages(repositoryRoot);
const reactCandidate = packages.filter(({ name, manifest }) => (
  name === '@core-ui/react' && manifest.version === '0.1.0-alpha.0'
));
const publishable = packages.filter(({ manifest }) => manifest.private !== true);

if (publishable.length !== 0) {
  console.error(
    `FOUNDATION_RELEASE_FORBIDDEN: packages cannot become publishable before an exact external publish authorization: ${publishable.map(({ name }) => name).join(', ')}`,
  );
  process.exit(1);
}

if (reactCandidate.length !== 1
  || reactCandidate[0].manifest.private !== true
  || reactCandidate[0].manifest.scripts?.prepublishOnly !== 'node src/publish-guard.mjs') {
  console.error('R1.0_PUBLICATION_GUARD_INVALID: the packable React baseline must remain private with its fail-closed prepublish guard');
  process.exit(1);
}

if (reactCandidate.length === 1) {
  const temp = mkdtempSync(join(tmpdir(), 'core-ui-r1-release-'));
  try {
    const packed = spawnSync('pnpm', ['pack', '--pack-destination', temp], {
      cwd: resolve(repositoryRoot, 'packages/react'), encoding: 'utf8', stdio: 'pipe',
    });
    if (packed.status !== 0) throw new Error(`R1.0_PACK_FAILED: ${packed.stderr}`);
    const archive = join(temp, 'core-ui-react-0.1.0-alpha.0.tgz');
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
    if (listing.status !== 0) throw new Error('R1.0_PACK_ARCHIVE_MISSING');
    const entries = listing.stdout.trim().split('\n');
    for (const required of ['package/generated/index.mjs', 'package/generated/index.d.ts', 'package/generated/compatibility.mjs', 'package/generated/styles.css', 'package/generated/descriptor.json', 'package/generated/release.json', 'package/generated/button-donor-comparison.json', 'package/LICENSE', 'package/NOTICE', 'package/README.md']) {
      if (!entries.includes(required)) throw new Error(`R1.0_PACK_CONTENT_MISSING: ${required}`);
    }
    if (entries.some((entry) => entry.startsWith('package/src/') || entry.startsWith('package/test/'))) {
      throw new Error('R1.0_PACK_PRIVATE_SOURCE_LEAK');
    }
    const packedManifest = JSON.parse(spawnSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }).stdout);
    if (packedManifest.version !== '0.1.0-alpha.0'
      || packedManifest.private !== true
      || JSON.stringify(packedManifest.dependencies) !== JSON.stringify({ 'react-aria-components': '1.20.0' })
      || packedManifest.peerDependencies?.react !== '>=19.2.0 <20'
      || packedManifest.peerDependencies?.['react-dom'] !== '>=19.2.0 <20'
      || JSON.stringify(packedManifest).includes('workspace:')
      || JSON.stringify(packedManifest).includes('@core-ui/web')
      || JSON.stringify(packedManifest).includes('tale-ui')) {
      throw new Error('R1.0_PACK_MANIFEST_INVALID');
    }
    const entrySource = spawnSync('tar', ['-xOzf', archive, 'package/generated/index.mjs'], { encoding: 'utf8' }).stdout;
    if (/\bButton\b|react-aria-components/u.test(entrySource)) throw new Error('R1.0_PACK_COMPONENT_EXPORT_FORBIDDEN');
    const consumer = join(temp, 'consumer');
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), `${JSON.stringify({
      name: 'core-ui-r1-clean-consumer', private: true, type: 'module',
      dependencies: { '@core-ui/react': 'file:../core-ui-react-0.1.0-alpha.0.tgz', react: '19.2.8', 'react-dom': '19.2.8' },
    }, null, 2)}\n`);
    const install = spawnSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: consumer, encoding: 'utf8', stdio: 'pipe' });
    if (install.status !== 0) throw new Error(`R1.0_PACK_CONSUMER_INSTALL_FAILED: ${install.stderr}`);
    const consumerCheck = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      const main = await import('@core-ui/react');
      const compatibility = await import('@core-ui/react/compatibility');
      const testing = await import('@core-ui/react/testing');
      if (Object.keys(main).join(',') !== 'reactCompatibility') throw new Error('unexpected public entry');
      if (compatibility.reactCompatibility.version !== '0.1.0-alpha.0') throw new Error('compatibility version');
      if (testing.reactPlatformSafetyFixture.componentSupportClaim !== 'none') throw new Error('support claim');
      if (!import.meta.resolve('@core-ui/react/styles.css').endsWith('/generated/styles.css')) throw new Error('styles resolution');
      let rejected = false;
      try { await import('@core-ui/react/button'); } catch (error) { rejected = error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'; }
      if (!rejected) throw new Error('undeclared component subpath resolved');
    `], { cwd: consumer, encoding: 'utf8', stdio: 'pipe' });
    if (consumerCheck.status !== 0) throw new Error(`R1.0_PACK_CONSUMER_IMPORT_FAILED: ${consumerCheck.stderr}`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
  console.log('R1.0 release boundary passed; @core-ui/react remains technically private and unpublished.');
  process.exit(0);
}

console.log(
  'Foundation checks passed; no publishable package or public release candidate exists.',
);
