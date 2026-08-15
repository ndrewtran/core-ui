import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../packages/schema/src/index.mjs';
import {
  DEFAULT_THEME_G11_V2_APPLICABILITY_PATHS,
  DEFAULT_THEME_G11_V2_ASSERTION_IDS,
  DEFAULT_THEME_G11_V2_BROWSER_TOOLCHAIN,
  DEFAULT_THEME_G11_V2_EXPECTED_FACTS,
  DEFAULT_THEME_G11_V2_PRODUCT_SOURCE,
  DEFAULT_THEME_G11_V2_PROOF_FILES,
  DEFAULT_THEME_G11_V2_ROOT,
  DEFAULT_THEME_G11_V2_UPSTREAM_G10,
  assertDefaultThemeG11V2CurrentG10,
  assertDefaultThemeG11V2DirectoryNames,
  assertDefaultThemeG11V2Environment,
  assertDefaultThemeG11V2SourceTopology,
  assertDefaultThemeG11V2UpstreamG10,
  hasUnsanitizedDefaultThemeG11V2Output,
  pathManifestAtRevision,
} from './default-theme-g1.1-v2-profile.mjs';
import {
  DefaultThemeG11V2PostValidationDriftError,
  assertDefaultThemeG11V2PostValidationClean,
  normalizeDefaultThemeG11V2Output,
  parseDefaultThemeG11V2Arguments,
  publishDefaultThemeG11V2Atomically,
} from './capture-default-theme-g1.1-v2.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const execFile = promisify(execFileCallback);

async function absent(path) {
  return access(path).then(() => false, (error) => {
    if (error?.code === 'ENOENT') return true;
    throw error;
  });
}

test('DEFAULT-THEME-G1.1-V2 owns exact current identities and six assertions', () => {
  assert.deepEqual(DEFAULT_THEME_G11_V2_PRODUCT_SOURCE, {
    revision: 'd45f52a241624c9ff6a08638684720e9d31842a5',
    tree: '528ae016547593212c40b31c08166a5f9769f0c8',
  });
  assert.equal(DEFAULT_THEME_G11_V2_UPSTREAM_G10.commentId, 5301472350);
  assert.equal(DEFAULT_THEME_G11_V2_UPSTREAM_G10.acceptedPacketSha256, 'sha256:59195089cbe2994bb2ad5469e0268bc897e702f365610c45c546907c130ca85b');
  assert.deepEqual(DEFAULT_THEME_G11_V2_ASSERTION_IDS, [
    'E-G1.1-01', 'E-G1.1-02', 'E-G1.1-03', 'E-G1.1-04',
    'E-G1.1-05', 'E-G1.1-06',
  ]);
  assert.deepEqual(Object.keys(DEFAULT_THEME_G11_V2_EXPECTED_FACTS), DEFAULT_THEME_G11_V2_ASSERTION_IDS);
});

test('DEFAULT-THEME-G1.1-V2 source topology is the exact five-path sole child', () => {
  const changes = DEFAULT_THEME_G11_V2_PROOF_FILES.map((path) => `${path.endsWith('evidence-verify.mjs') ? 'M' : 'A'}\t${path}`);
  assert.doesNotThrow(() => assertDefaultThemeG11V2SourceTopology({
    changes, parents: [DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision],
    revision: '1'.repeat(40), tree: '2'.repeat(40),
  }));
  for (const mutation of [
    { changes: [...changes, 'A\ttests/evidence/unbounded.mjs'] },
    { changes, parents: [] },
    { changes: changes.slice(1) },
  ]) {
    assert.throws(() => assertDefaultThemeG11V2SourceTopology({
      changes: mutation.changes, parents: mutation.parents ?? [DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision],
      revision: '1'.repeat(40), tree: '2'.repeat(40),
    }), /five-path proof-tool child/u);
  }
});

test('DEFAULT-THEME-G1.1-V2 binds the exact accepted current G1.0 root', async () => {
  assert.equal(DEFAULT_THEME_G11_V2_UPSTREAM_G10.index.path, 'tests/evidence/default-theme-g1.0-v2/index.json');
  assert.throws(() => assertDefaultThemeG11V2UpstreamG10({
    ...DEFAULT_THEME_G11_V2_UPSTREAM_G10,
    index: { ...DEFAULT_THEME_G11_V2_UPSTREAM_G10.index, sha256: `sha256:${'0'.repeat(64)}` },
  }), /exact accepted current root/u);
  await assertDefaultThemeG11V2CurrentG10(repositoryRoot);
});

test('DEFAULT-THEME-G1.1-V2 applicability is identical at product source and current checkout', async () => {
  const [product, current] = await Promise.all([
    pathManifestAtRevision(repositoryRoot, DEFAULT_THEME_G11_V2_PRODUCT_SOURCE.revision, DEFAULT_THEME_G11_V2_APPLICABILITY_PATHS),
    pathManifestAtRevision(repositoryRoot, 'HEAD', DEFAULT_THEME_G11_V2_APPLICABILITY_PATHS),
  ]);
  assert.equal(canonicalJson(current), canonicalJson(product));
});

test('DEFAULT-THEME-G1.1-V2 arguments are exact', () => {
  const values = parseDefaultThemeG11V2Arguments([
    '--source', '1'.repeat(40), '--tree', '2'.repeat(40), '--executed', '3'.repeat(40),
    '--executed-tree', '4'.repeat(40), '--timestamp', '2026-08-15T02:00:00Z',
  ]);
  assert.equal(values.executedRevision, '3'.repeat(40));
  assert.throws(() => parseDefaultThemeG11V2Arguments(['--source', '1'.repeat(40)]), /ARGUMENT_INVALID/u);
});

test('DEFAULT-THEME-G1.1-V2 environment retains exact browser tooling without a path', () => {
  const value = {
    architecture: 'arm64', axe: DEFAULT_THEME_G11_V2_BROWSER_TOOLCHAIN.axe,
    browser: 'Google Chrome 151.0.7922.77', browserExecutableSha256: `sha256:${'a'.repeat(64)}`,
    browserResolution: 'system-google-chrome', git: '2.50.1', node: 'v24.19.0',
    playwright: DEFAULT_THEME_G11_V2_BROWSER_TOOLCHAIN.playwright, pnpm: '10.33.0',
    runnerImage: 'local-macos-26.0', runnerImageVersion: '25A354', runnerOs: 'macOS 26.0',
  };
  assert.doesNotThrow(() => assertDefaultThemeG11V2Environment(value));
  assert.throws(() => assertDefaultThemeG11V2Environment({ ...value, browserPath: '/Applications/Google Chrome.app' }), /PROFILE_INVALID/u);
});

test('DEFAULT-THEME-G1.1-V2 normalization and privacy checks reject local and credential output', () => {
  const normalized = normalizeDefaultThemeG11V2Output(
    `${repositoryRoot}/file (12.3ms)\r\n`
      + 'Progress: resolved 513, reused 513, downloaded 0, added 510\r\n'
      + 'Progress: resolved 513, reused 513, downloaded 0, added 513, done\r\n'
      + 'Time:        0.311 s, estimated 1 s\r\n',
    repositoryRoot,
  );
  assert.equal(normalized, '<repository>/file (duration)\n'
    + 'Progress: resolved 513, reused 513, downloaded 0, added <progress>\n'
    + 'Progress: resolved 513, reused 513, downloaded 0, added 513, done\n'
    + 'Time: <duration>\n');
  assert.equal(hasUnsanitizedDefaultThemeG11V2Output(normalized, repositoryRoot), false);
  assert.equal(hasUnsanitizedDefaultThemeG11V2Output('/Users/admin/private', repositoryRoot), true);
  assert.equal(hasUnsanitizedDefaultThemeG11V2Output('api_key=secret', repositoryRoot), true);
});

test('DEFAULT-THEME-G1.1-V2 directory routing is absent-safe and fail-closed', () => {
  assert.equal(assertDefaultThemeG11V2DirectoryNames(['g0.0']), false);
  assert.equal(assertDefaultThemeG11V2DirectoryNames(['default-theme-g1.1-v2']), true);
  assert.throws(() => assertDefaultThemeG11V2DirectoryNames([
    'default-theme-g1.1-v2', 'default-theme-g1.1-v2-copy',
  ]), /exactly one/u);
});

test('DEFAULT-THEME-G1.1-V2 publication is atomic and rolls back after failure', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'default-theme-g11-v2-atomic-'));
  const repository = join(temporary, 'repository');
  const generated = join(temporary, 'generated');
  const generatedRoot = join(generated, DEFAULT_THEME_G11_V2_ROOT);
  const destination = join(repository, DEFAULT_THEME_G11_V2_ROOT);
  try {
    await mkdir(generatedRoot, { recursive: true });
    await mkdir(join(repository, 'tests/evidence'), { recursive: true });
    await writeFile(join(generatedRoot, 'marker.txt'), 'exact');
    await assert.rejects(publishDefaultThemeG11V2Atomically({
      repository, generatedRoot: generated, afterPublish: async () => { throw new Error('injected'); },
    }), /injected/u);
    assert.equal(await absent(destination), true);
    await publishDefaultThemeG11V2Atomically({ repository, generatedRoot: generated });
    assert.equal(await readFile(join(destination, 'marker.txt'), 'utf8'), 'exact');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('DEFAULT-THEME-G1.1-V2 rejects post-validation drift before publication', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'default-theme-g11-v2-drift-'));
  const output = join(repository, DEFAULT_THEME_G11_V2_ROOT);
  try {
    await execFile('git', ['init', '--quiet'], { cwd: repository });
    await writeFile(join(repository, 'tracked.txt'), 'before');
    await execFile('git', ['add', 'tracked.txt'], { cwd: repository });
    await execFile('git', [
      '-c', 'user.name=Core UI Test',
      '-c', 'user.email=core-ui@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ], { cwd: repository });
    await writeFile(join(repository, 'tracked.txt'), 'validation mutation');
    await assert.rejects(
      assertDefaultThemeG11V2PostValidationClean(repository),
      (error) => error instanceof DefaultThemeG11V2PostValidationDriftError
        && error.code === 'DEFAULT_THEME_G11_V2_POST_VALIDATION_DRIFT',
    );
    assert.equal(await absent(output), true);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('DEFAULT-THEME-G1.1-V2 retained root is absent before capture', async () => {
  assert.equal(await absent(join(repositoryRoot, DEFAULT_THEME_G11_V2_ROOT)), true);
});
