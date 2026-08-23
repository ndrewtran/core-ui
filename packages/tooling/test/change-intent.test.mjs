import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  canonicalJson,
  sha256Digest,
} from '@core-ui/schema';
import {
  CHANGE_INTENT_BINDINGS,
  CHANGE_INTENT_LOCK_PROFILE,
  ChangeIntentError,
  commandContract,
  commandProcedureIdentity,
  commandRuntimeIdentity,
  validateChangeIntentEnvelope,
  previewChangeIntentEnvelope,
} from '../src/change-intent.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
let producerCounter = 0;
const producerBase = '8979f2d0e4438529638da8269d951b0537d6970e';
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const digestBytes = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function producerClone() {
  const root = mkdtempSync(join(tmpdir(), 'core-ui-change-intent-producer-'));
  execFileSync('git', ['clone', '--local', repositoryRoot, root], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'producer@example.invalid']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'ChangeIntent producer']);
  execFileSync('git', ['-C', root, 'checkout', '-B', `codex/producer-${producerCounter++}`, producerBase], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', producerBase]);
  try { symlinkSync(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'dir'); } catch { /* fixture clone may already have dependencies */ }
  writeFileSync(join(root, '.git', 'info', 'exclude'), 'node_modules\n/node_modules/\n', { flag: 'a' });
  for (const path of [
    'packages/schema/schemas/change-intent-envelope.schema.json',
    'packages/tooling/src/change-intent.mjs',
    'packages/tooling/src/index.mjs',
    'tooling/audits/repository-policy/repository-policy.json',
    'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md',
    'decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md',
  ]) cpSync(join(repositoryRoot, path), join(root, path));
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-m', 'test: producer source'], { stdio: 'ignore' });
  return root;
}
function lockRecord(root, target, name) {
  const task = resolve(root, git(root, 'rev-parse', '--git-path', 'core-ui-r1'));
  const snapshot = JSON.parse(readFileSync(join(root, CHANGE_INTENT_BINDINGS.snapshot.path), 'utf8'));
  const selected = snapshot.families.find(({ family }) => family === target.family);
  const owner = (path, sourceCommit, sourceTree) => ({ path, selector: '/', digest: digestBytes(readFileSync(join(root, path))), sourceCommit, sourceTree });
  const authority = CHANGE_INTENT_BINDINGS.authority;
  const bytes = Buffer.from(canonicalJson({
    profile: CHANGE_INTENT_LOCK_PROFILE,
    schemaVersion: '1.0.0',
    target: { family: selected.family, scopeId: selected.scopeId, tranche: selected.tranche, source: selected.source },
    authority: {
      decision: owner('decisions/0010-amendment-09-r1-bootstrap-delivery-recovery.md', authority.commit, authority.tree),
      acceptance: owner('decisions/0010-amendment-09-r1-bootstrap-delivery-recovery-acceptance.md', authority.commit, authority.tree),
      architecture: owner('strategy/monorepo-architecture.md', authority.commit, authority.tree),
      roadmap: owner('strategy/milestone-roadmap.md', authority.commit, authority.tree),
      productScope: owner('strategy/product-scope.md', authority.commit, authority.tree),
    },
    snapshot: { path: CHANGE_INTENT_BINDINGS.snapshot.path, selector: '/', digest: CHANGE_INTENT_BINDINGS.snapshot.digest, sourceCommit: CHANGE_INTENT_BINDINGS.stage1.commit, sourceTree: CHANGE_INTENT_BINDINGS.stage1.tree },
    snapshotEnvelope: { path: CHANGE_INTENT_BINDINGS.snapshot.envelopePath, selector: '/', digest: CHANGE_INTENT_BINDINGS.snapshot.envelopeDigest, sourceCommit: CHANGE_INTENT_BINDINGS.stage1.commit, sourceTree: CHANGE_INTENT_BINDINGS.stage1.tree },
    baseline: { path: CHANGE_INTENT_BINDINGS.baseline.path, selector: '/', digest: CHANGE_INTENT_BINDINGS.baseline.digest, sourceCommit: CHANGE_INTENT_BINDINGS.baseline.sourceCommit, sourceTree: CHANGE_INTENT_BINDINGS.baseline.sourceTree },
    source: {
      authority: { commit: authority.commit, tree: authority.tree },
      stage1: { commit: CHANGE_INTENT_BINDINGS.stage1.commit, tree: CHANGE_INTENT_BINDINGS.stage1.tree },
      baseline: { commit: CHANGE_INTENT_BINDINGS.baseline.sourceCommit, tree: CHANGE_INTENT_BINDINGS.baseline.sourceTree },
    },
  }), 'utf8');
  const path = `.git/core-ui-r1/${name}.json`;
  mkdirSync(task, { recursive: true });
  writeFileSync(join(task, `${name}.json`), bytes);
  return { path, digest: digestBytes(bytes), byteLength: bytes.byteLength };
}
function changedButtonArtifactBytes(root) {
  const path = 'catalog/components/button/artifact.json';
  const record = JSON.parse(readFileSync(join(root, path), 'utf8'));
  record.summary = `${record.summary} (preview change)`;
  return Buffer.from(canonicalJson(record), 'utf8');
}
function retainedEvidenceFixture(root) {
  const sourceRevision = git(root, 'rev-parse', 'HEAD');
  const sourceTree = git(root, 'rev-parse', 'HEAD^{tree}');
  const evidenceRoot = 'tests/evidence/r1.1-retained';
  const rawPath = `${evidenceRoot}/validation/evidence.txt`;
  const rawBytes = Buffer.from('proof owner passed\n', 'utf8');
  const raw = { path: rawPath, sha256: digestBytes(rawBytes) };
  const validation = {
    schema: 'core-ui-evidence-validation-v1',
    sourceRevision,
    sourceTree,
    executedRevision: sourceRevision,
    executedTree: sourceTree,
    proofTool: { profile: 'core-ui-proof-tool-identity-v1', id: 'proof-tool', version: '1', executablePath: 'tooling/audits/repository-policy/src/evidence-verify.mjs', executableSha256: digestBytes(Buffer.from('proof-tool', 'utf8')) },
    results: [{ command: 'node tooling/audits/repository-policy/src/evidence-verify.mjs', exitState: 0, rawOutput: { ...raw, byteLength: rawBytes.byteLength } }],
  };
  const validationBytes = Buffer.from(canonicalJson(validation), 'utf8');
  const validationRef = { path: `${evidenceRoot}/validation.json`, sha256: digestBytes(validationBytes) };
  const artifact = { schema: 'core-ui-evidence-artifact-v1', sourceRevision, sourceTree, executedRevision: sourceRevision, executedTree: sourceTree, outcome: 'pass', exitState: 0 };
  const artifactBytes = Buffer.from(canonicalJson(artifact), 'utf8');
  const artifactRef = { path: `${evidenceRoot}/artifacts/E-R1.1-01.json`, sha256: digestBytes(artifactBytes) };
  const record = { schema: 'core-ui-evidence-record-v1', sourceRevision, sourceTree, executedRevision: sourceRevision, executedTree: sourceTree, outcome: 'pass', disclosureClass: 'public-sanitized', retentionPolicy: 'content-addressed Git', expiry: 'source or tool drift', validation: validationRef, artifact: artifactRef };
  const recordBytes = Buffer.from(canonicalJson(record), 'utf8');
  const recordRef = { path: `${evidenceRoot}/records/E-R1.1-01.json`, sha256: digestBytes(recordBytes) };
  const index = { schema: 'core-ui-evidence-index-v1', sourceRevision, sourceTree, executedRevision: sourceRevision, executedTree: sourceTree, disclosureClass: 'public-sanitized', retentionPolicy: 'content-addressed Git', expiry: 'source or tool drift', validation: validationRef, records: [recordRef] };
  const indexBytes = Buffer.from(canonicalJson(index), 'utf8');
  return {
    evidence: { path: `${evidenceRoot}/index.json`, digest: digestBytes(indexBytes), byteLength: indexBytes.byteLength },
    afterImages: [
      { path: `${evidenceRoot}/index.json`, bytes: indexBytes },
      { path: validationRef.path, bytes: validationBytes },
      { path: rawPath, bytes: rawBytes },
      { path: recordRef.path, bytes: recordBytes },
      { path: artifactRef.path, bytes: artifactBytes },
    ],
  };
}
async function existingPreview(root, name) {
  const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
  const path = 'catalog/components/button/artifact.json';
  const after = changedButtonArtifactBytes(root);
  return previewChangeIntentEnvelope({
    repositoryRoot: root,
    operation: {
      kind: 'component-implementation',
      target: { family: target.family },
      lock: lockRecord(root, target, name),
      afterImages: [{ path, bytes: after }],
    },
  });
}

function completedProbe(root, envelope, path) {
  const head = git(root, 'rev-parse', 'HEAD');
  const tree = git(root, 'rev-parse', 'HEAD^{tree}');
  const base = git(root, 'rev-parse', 'refs/remotes/origin/main');
  const diff = execFileSync('git', ['-C', root, 'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${base}..${head}`, '--'], { encoding: 'buffer' });
  const task = resolve(root, git(root, 'rev-parse', '--git-path', 'core-ui-r1'));
  const childBytes = Buffer.from('{}', 'utf8');
  const childPath = '.git/core-ui-r1/state-probe.json';
  writeFileSync(join(task, 'state-probe.json'), childBytes);
  const child = { path: childPath, digest: digestBytes(childBytes), byteLength: childBytes.byteLength };
  const headIdentity = { path: 'git-head', digest: digestBytes(Buffer.from(head, 'utf8')), byteLength: Buffer.byteLength(head) };
  const treeIdentity = { path: 'git-tree', digest: digestBytes(Buffer.from(tree, 'utf8')), byteLength: Buffer.byteLength(tree) };
  return {
    envelopeDigest: envelope.intentId,
    head: headIdentity,
    tree: treeIdentity,
    diff: { path: 'git-diff', digest: digestBytes(diff), byteLength: diff.byteLength },
    changedPaths: [path],
    operationJournal: child,
    deterministicResults: [child],
  };
}
function completedDeterministicRecord(root, binding, command, envelopeSource) {
  const commandRecord = commandContract(root, command);
  const output = (text) => ({ profile: 'core-ui-command-output-v1', encoding: 'utf8', text, digest: digestBytes(Buffer.from(text, 'utf8')), byteLength: Buffer.byteLength(text) });
  const source = { commit: git(root, 'rev-parse', 'HEAD'), tree: git(root, 'rev-parse', 'HEAD^{tree}') };
  const stdout = output('');
  const stderr = output('');
  const producerSourcePath = 'packages/tooling/src/change-intent.mjs';
  const producerSource = readFileSync(join(root, producerSourcePath));
  const producer = { profile: 'core-ui-command-producer-v1', id: 'core-ui-tooling-command-contract', version: '1', sourcePath: producerSourcePath, sourceDigest: digestBytes(producerSource), sourceByteLength: producerSource.byteLength };
  const preimageValue = { profile: 'core-ui-command-result-preimage-v1', command, source, stdout, stderr, exitState: 0, producer };
  const preimageBytes = Buffer.from(canonicalJson(preimageValue), 'utf8');
  const preimageName = `completed-preimage-${producerCounter++}.json`;
  const task = resolve(root, git(root, 'rev-parse', '--git-path', 'core-ui-r1'));
  writeFileSync(join(task, preimageName), preimageBytes);
  const preimage = { path: `.git/core-ui-r1/${preimageName}`, digest: digestBytes(preimageBytes), byteLength: preimageBytes.byteLength };
  const runtime = commandRuntimeIdentity(root, envelopeSource);
  const procedure = commandProcedureIdentity(root, command, source, runtime);
  return { ...binding, profile: 'core-ui-deterministic-result-v1', command, commandId: commandRecord.commandId, commandRecordDigest: commandRecord.digest, commandRecordProfile: commandRecord.value.profile, ownerRef: commandRecord.value.ownerRef, source, runtime, procedure, proofTool: { profile: 'core-ui-proof-tool-identity-v1', id: 'proof-tool', version: '1', executablePath: 'tooling/audits/repository-policy/src/evidence-verify.mjs', executableSha256: digestBytes(readFileSync(join(root, 'tooling/audits/repository-policy/src/evidence-verify.mjs'))) }, result: { profile: 'core-ui-command-result-v1', status: 'passed', producer, preimage, digest: preimage.digest, byteLength: preimage.byteLength }, stdout, stderr, exitState: 0 };
}

function replaceWithSpecialTreeEntry(root, path, state) {
  const absolute = join(root, path);
  if (state === '100755') {
    writeFileSync(absolute, Buffer.from('export const specialTreeState = true;\n', 'utf8'));
    chmodSync(absolute, 0o755);
  } else if (state === '120000') {
    rmSync(absolute, { force: true });
    symlinkSync('special-target.mjs', absolute);
  } else {
    rmSync(absolute, { recursive: true, force: true });
    mkdirSync(absolute, { recursive: true });
    execFileSync('git', ['-C', absolute, 'init', '--quiet']);
    execFileSync('git', ['-C', absolute, 'config', 'user.email', 'special@example.invalid']);
    execFileSync('git', ['-C', absolute, 'config', 'user.name', 'Special tree fixture']);
    writeFileSync(join(absolute, 'nested.txt'), 'gitlink\n');
    execFileSync('git', ['-C', absolute, 'add', 'nested.txt']);
    execFileSync('git', ['-C', absolute, 'commit', '-m', 'test: gitlink'], { stdio: 'ignore' });
  }
  execFileSync('git', ['-C', root, 'add', '-A', '--', path]);
  execFileSync('git', ['-C', root, 'commit', '-m', `test: ${state} image state`], { stdio: 'ignore' });
}

test('command contracts bind filtered checks to the package manifest owner', () => {
  const root = producerClone();
  try {
    const filtered = commandContract(root, 'pnpm --filter @core-ui/react check');
    assert.equal(filtered.commandId, 'workspace.core-ui.react:check');
    assert.equal(filtered.value.ownerRef, 'workspace-package-packages-react');
    assert.notEqual(filtered.value.ownerRef, 'root-command-owner');
    assert.throws(() => commandContract(root, 'pnpm --filter @core-ui/react missing-script'), (error) => error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('producer rejects identity-only after-images and empty absent additions', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const path = 'catalog/components/button/artifact.json';
    const after = changedButtonArtifactBytes(root);
    await assert.rejects(
      () => previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: target.family }, lock: lockRecord(root, target, 'identity-only-after-lock'), afterImages: [{ path, identity: { path, digest: digestBytes(after), byteLength: after.byteLength } }] } }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_IDENTITY_INVALID',
    );
    await assert.rejects(
      () => previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: 'Autocomplete' }, lock: lockRecord(root, { family: 'Autocomplete', scopeId: 'SCOPE-COMP-AUTOCOMPLETE-REACT', tranche: 'R1.2' }, 'empty-absent-after-lock'), afterImages: [{ path: 'catalog/components/autocomplete/artifact.json', bytes: Buffer.alloc(0) }] } }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('producer rejects executable, symlink, and gitlink completed after-image states', async () => {
  for (const state of ['100755', '120000', '160000']) {
    const root = producerClone();
    try {
      git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
      const path = 'packages/react/src/Button.mjs';
      const after = Buffer.from(`export const specialAfterImage = '${state}';\n`, 'utf8');
      const record = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
      const produced = await previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: 'Button' }, lock: lockRecord(root, { family: 'Button' }, `state-${state}-lock`), afterImages: [{ path, bytes: after, record }] } });
      replaceWithSpecialTreeEntry(root, path, state);
      assert.throws(
        () => validateChangeIntentEnvelope({ ...produced.envelope, result: completedProbe(root, produced.envelope, path) }, { repositoryRoot: root, afterImages: [{ path, bytes: after }] }),
        (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID',
        state,
      );
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});


test('ChangeIntent validates the exact producer envelope shape and identity', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const after = changedButtonArtifactBytes(root);
    const result = await previewChangeIntentEnvelope({
      repositoryRoot: root,
      operation: {
        kind: 'component-implementation',
        target: { family: target.family },
        lock: lockRecord(root, target, 'identity-lock'),
        afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: after }],
      },
    });
    const validationOptions = {
      repositoryRoot: root,
      afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: after }],
    };
    assert.doesNotThrow(() => validateChangeIntentEnvelope(result.envelope, validationOptions));
    const changed = structuredClone(result.envelope);
    changed.writeSet[0].path = 'packages/react/src/Other.mjs';
    assert.throws(
      () => validateChangeIntentEnvelope(changed, validationOptions),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_IDENTITY_MISMATCH',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer rejects a target-only or substituted tranche lock', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const lock = lockRecord(root, target, 'target-only-lock');
    const task = resolve(root, git(root, 'rev-parse', '--git-path', 'core-ui-r1'));
    const bytes = Buffer.from(canonicalJson({ target }), 'utf8');
    writeFileSync(join(task, 'target-only-lock.json'), bytes);
    const invalidLock = { path: lock.path, digest: digestBytes(bytes), byteLength: bytes.byteLength };
    await assert.rejects(
      () => previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: target.family }, lock: invalidLock, afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: changedButtonArtifactBytes(root) }] } }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_LOCK_INVALID',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ChangeIntent rejects caller-selected write authority and unknown fields', async () => {
  const root = producerClone();
  try {
    const envelope = structuredClone((await existingPreview(root, 'caller-authority-lock')).envelope);
    envelope.callerSelectedOwners = ['attacker'];
    assert.throws(
      () => validateChangeIntentEnvelope(envelope, { repositoryRoot: root }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_SCHEMA_INVALID',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ChangeIntent uses canonical bytes with no duplicate-key or whitespace alias', async () => {
  const root = producerClone();
  try {
    const envelope = (await existingPreview(root, 'canonical-bytes-lock')).envelope;
    const canonical = canonicalJson(envelope);
    assert.equal(JSON.parse(canonical).intentId, envelope.intentId);
    assert.notEqual(canonical, `{ "profile": "${envelope.profile}" }`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer derives an existing-family envelope through canonical authoring closure', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const after = changedButtonArtifactBytes(root);
    const result = await previewChangeIntentEnvelope({
      repositoryRoot: root,
      operation: {
        kind: 'component-implementation',
        target: { family: target.family },
        lock: lockRecord(root, target, 'existing-lock'),
        afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: after }],
      },
    });
    assert.equal(result.envelope.objective.target.family, 'Button');
    assert.equal(result.envelope.affected.sourceRevision.startsWith('sha256:'), true);
    assert.equal(result.envelope.owners[0].recordId, 'core:component:button');
    assert.deepEqual(result.envelope.affected.staleProof, ['E-R1.1-01', 'E-R1.1-02', 'E-R1.1-03', 'E-R1.1-04']);
    const policy = JSON.parse(readFileSync(join(root, 'tooling/audits/repository-policy/repository-policy.json'), 'utf8'));
    const generated = policy.generatorProjectionGroups.flatMap(({ outputs }) => outputs).sort();
    assert.deepEqual(result.envelope.affected.generatedProjections, generated);
    assert.equal(result.envelope.readiness.retrieval, 'unknown');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer derives an absent locked family from its validated proposed after-image', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Autocomplete', scopeId: 'SCOPE-COMP-AUTOCOMPLETE-REACT', tranche: 'R1.2' };
    const proposed = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
    proposed.id = 'core:component:autocomplete';
    proposed.name = 'Autocomplete';
    const bytes = Buffer.from(`${JSON.stringify(proposed)}\n`, 'utf8');
    const sourceManifestPath = 'packages/catalog/catalog-sources.json';
    const sourceManifest = JSON.parse(readFileSync(join(root, sourceManifestPath), 'utf8'));
    sourceManifest.records = [...sourceManifest.records, { family: 'component', path: 'catalog/components/autocomplete/artifact.json' }].sort((left, right) => left.path.localeCompare(right.path));
    const sourceManifestBytes = Buffer.from(canonicalJson(sourceManifest), 'utf8');
    const afterImages = [{ path: 'catalog/components/autocomplete/artifact.json', bytes }, { path: sourceManifestPath, bytes: sourceManifestBytes }];
    const result = await previewChangeIntentEnvelope({
      repositoryRoot: root,
      operation: {
        kind: 'component-implementation',
        target: { family: target.family },
        lock: lockRecord(root, target, 'absent-lock'),
        afterImages,
      },
    });
    assert.equal(result.envelope.objective.target.family, 'Autocomplete');
    assert.deepEqual(result.envelope.affected.artifacts, ['core:component:autocomplete']);
    assert.equal(result.envelope.affected.packages.some(({ name }) => name === '@core-ui/catalog'), true);
    const policy = JSON.parse(readFileSync(join(root, 'tooling/audits/repository-policy/repository-policy.json'), 'utf8'));
    const generated = policy.generatorProjectionGroups.flatMap(({ outputs }) => outputs).sort();
    assert.deepEqual(result.envelope.affected.generatedProjections, generated);
    assert.equal(result.envelope.checks.some(({ command }) => command === 'pnpm --filter @core-ui/catalog check'), true);
    const forged = structuredClone(result.envelope);
    forged.affected.packages = [];
    const { intentId, ...preimage } = forged;
    forged.intentId = digestBytes(canonicalJson(preimage));
    assert.throws(() => validateChangeIntentEnvelope(forged, { repositoryRoot: root, afterImages }), (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_DERIVATION_INVALID');
    const manifestMutation = (records) => Buffer.from(canonicalJson({ ...sourceManifest, records }), 'utf8');
    const invalidManifests = [
      ['omitted', undefined],
      ['removal', manifestMutation(sourceManifest.records.slice(1))],
      ['replacement', manifestMutation(sourceManifest.records.map((entry, index) => index === 0 ? { ...entry, family: 'guide' } : entry))],
      ['unrelated', manifestMutation([...sourceManifest.records, { family: 'guide', path: 'catalog/guides/forged.json' }])],
      ['duplicate', manifestMutation([...sourceManifest.records, { family: 'component', path: 'catalog/components/autocomplete/artifact.json' }])],
      ['target-mismatch', manifestMutation([...sourceManifest.records.filter(({ path }) => path !== 'catalog/components/autocomplete/artifact.json'), { family: 'component', path: 'catalog/components/other/artifact.json' }])],
      ['component-source-path', manifestMutation([...sourceManifest.records, { family: 'component', path: 'catalog/components/autocomplete/artifact.json', sourcePath: 'catalog/components/button/artifact.json' }])],
      ['component-baseline-occurrences', manifestMutation([...sourceManifest.records, { family: 'component', path: 'catalog/components/autocomplete/artifact.json', baselineOccurrencesPath: 'packages/tokens/generated/tale-token-occurrences.json' }])],
    ];
    for (const [name, manifestBytes] of invalidManifests) {
      const invalidImages = manifestBytes === undefined ? [{ path: 'catalog/components/autocomplete/artifact.json', bytes }] : [{ path: 'catalog/components/autocomplete/artifact.json', bytes }, { path: sourceManifestPath, bytes: manifestBytes }];
      await assert.rejects(
        () => previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'component-implementation', target: { family: target.family }, lock: lockRecord(root, target, `invalid-manifest-${name}`), afterImages: invalidImages } }),
        (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
        name,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer rejects a catalog record that disagrees with its after-image bytes', async () => {
  const root = producerClone();
  try {
    const path = 'catalog/components/button/artifact.json';
    const bytes = readFileSync(join(root, path));
    const record = JSON.parse(bytes);
    record.summary = 'forged catalog summary';
    await assert.rejects(
      () => previewChangeIntentEnvelope({
        repositoryRoot: root,
        operation: {
          kind: 'component-implementation',
          target: { family: 'Button' },
          lock: lockRecord(root, { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' }, 'record-mismatch-lock'),
          afterImages: [{ path, bytes, record }],
        },
      }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer rejects a valid cross-family catalog record at the locked target source', async () => {
  const root = producerClone();
  try {
    const path = 'catalog/components/button/artifact.json';
    const record = JSON.parse(readFileSync(join(root, path), 'utf8'));
    record.id = 'core:component:autocomplete';
    record.name = 'Autocomplete';
    const bytes = Buffer.from(canonicalJson(record), 'utf8');
    await assert.rejects(
      () => previewChangeIntentEnvelope({
        repositoryRoot: root,
        operation: {
          kind: 'component-implementation',
          target: { family: 'Button' },
          lock: lockRecord(root, { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' }, 'cross-family-record-lock'),
          afterImages: [{ path, bytes, record }],
        },
      }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
    );
    const valid = (await existingPreview(root, 'cross-family-validator-lock')).envelope;
    const forged = structuredClone(valid);
    forged.proposal.afterImages[0] = { path, digest: digestBytes(bytes), byteLength: bytes.byteLength };
    const patchBytes = Buffer.from(canonicalJson({ beforeImages: forged.proposal.beforeImages, afterImages: forged.proposal.afterImages }), 'utf8');
    forged.proposal.patch = { path: 'proposal.patch', digest: digestBytes(patchBytes), byteLength: patchBytes.byteLength };
    const { intentId, ...preimage } = forged;
    void intentId;
    forged.intentId = digestBytes(canonicalJson(preimage));
    assert.throws(
      () => validateChangeIntentEnvelope(forged, { repositoryRoot: root, afterImages: [{ path, bytes }] }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer rejects a renderer after-image with a divergent attached canonical record', async () => {
  const root = producerClone();
  try {
    const record = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
    record.summary = 'forged renderer owner';
    await assert.rejects(
      () => previewChangeIntentEnvelope({
        repositoryRoot: root,
        operation: {
          kind: 'component-implementation',
          target: { family: 'Button' },
          lock: lockRecord(root, { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' }, 'renderer-record-mismatch-lock'),
          afterImages: [{ path: 'packages/react/src/Button.mjs', bytes: Buffer.from('export const rendererRecordFixture = true;\n', 'utf8'), record }],
        },
      }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer rejects an absent family renderer after-image without a catalog after-image', async () => {
  const root = producerClone();
  try {
    const record = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
    record.id = 'core:component:autocomplete';
    record.name = 'Autocomplete';
    await assert.rejects(
      () => previewChangeIntentEnvelope({
        repositoryRoot: root,
        operation: {
          kind: 'component-implementation',
          target: { family: 'Autocomplete' },
          lock: lockRecord(root, { family: 'Autocomplete', scopeId: 'SCOPE-COMP-AUTOCOMPLETE-REACT', tranche: 'R1.2' }, 'absent-renderer-record-lock'),
          afterImages: [{ path: 'packages/react/src/Autocomplete.mjs', bytes: Buffer.from('export const absentRendererFixture = true;\n', 'utf8'), record }],
        },
      }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_PROPOSAL_INVALID',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validator re-derives source tree, lockfile, before-images, and patch identities', async () => {
  const root = producerClone();
  try {
    const original = (await existingPreview(root, 'canonical-source-identities')).envelope;
    const validationOptions = {
      repositoryRoot: root,
      afterImages: [{ path: 'catalog/components/button/artifact.json', bytes: changedButtonArtifactBytes(root) }],
    };
    const rehash = (envelope) => {
      const { intentId, ...preimage } = envelope;
      void intentId;
      envelope.intentId = digestBytes(canonicalJson(preimage));
      return envelope;
    };
    for (const [field, mutate, code] of [
      ['source.tree', (envelope) => { envelope.source.tree = '0'.repeat(40); }, 'CORE_CHANGE_INTENT_SOURCE_INVALID'],
      ['source.lockfile', (envelope) => { envelope.source.lockfile.digest = digestBytes(Buffer.from('forged lock')); }, 'CORE_CHANGE_INTENT_SOURCE_INVALID'],
      ['proposal.beforeImages', (envelope) => { envelope.proposal.beforeImages[0].digest = digestBytes(Buffer.from('forged before')); }, 'CORE_CHANGE_INTENT_DERIVATION_INVALID'],
      ['proposal.patch', (envelope) => { envelope.proposal.patch.digest = digestBytes(Buffer.from('forged patch')); }, 'CORE_CHANGE_INTENT_DERIVATION_INVALID'],
    ]) {
      const forged = structuredClone(original);
      mutate(forged);
      rehash(forged);
      assert.throws(() => validateChangeIntentEnvelope(forged, validationOptions), (error) => error instanceof ChangeIntentError && error.code === code, field);
    }
    const postHoc = structuredClone(original);
    postHoc.source.commit = git(root, 'rev-parse', 'HEAD');
    postHoc.source.tree = git(root, 'rev-parse', 'HEAD^{tree}');
    postHoc.source.lockfile = { path: 'pnpm-lock.yaml', digest: digestBytes(readFileSync(join(root, 'pnpm-lock.yaml'))), byteLength: readFileSync(join(root, 'pnpm-lock.yaml')).byteLength };
    rehash(postHoc);
    assert.throws(() => validateChangeIntentEnvelope(postHoc, validationOptions), (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_SOURCE_INVALID');
    const resultForged = { ...structuredClone(original), result: { envelopeDigest: original.intentId, head: original.source.lockfile, tree: original.source.lockfile, diff: original.proposal.patch, changedPaths: [], operationJournal: original.source.lockfile, deterministicResults: [] } };
    assert.throws(() => validateChangeIntentEnvelope(resultForged, validationOptions), (error) => error instanceof ChangeIntentError && ['CORE_CHANGE_INTENT_RESULT_INVALID', 'CORE_CHANGE_INTENT_SCHEMA_INVALID'].includes(error.code));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validator rejects tampered invalidation policy after intent identity recomputation', async () => {
  const root = producerClone();
  try {
    const produced = await existingPreview(root, 'canonical-invalidation-policy');
    const afterImages = [{ path: 'catalog/components/button/artifact.json', bytes: changedButtonArtifactBytes(root) }];
    const rehash = (envelope) => {
      const { intentId, ...preimage } = envelope;
      void intentId;
      envelope.intentId = digestBytes(canonicalJson(preimage));
      return envelope;
    };
    for (const [name, mutate] of [
      ['removed', (invalidation) => invalidation.pop()],
      ['altered', (invalidation) => { invalidation[0].when = 'invalidate on caller preference'; }],
      ['reordered', (invalidation) => invalidation.reverse()],
    ]) {
      const forged = structuredClone(produced.envelope);
      mutate(forged.invalidation);
      rehash(forged);
      assert.throws(
        () => validateChangeIntentEnvelope(forged, { repositoryRoot: root, afterImages }),
        (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_DERIVATION_INVALID',
        name,
      );
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('completed result binds the stable preview to the actual head, tree, diff, journal, and inputs', async () => {
  const root = producerClone();
  try {
    execFileSync('git', ['-C', root, 'update-ref', 'refs/remotes/origin/main', 'HEAD']);
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const after = Buffer.from('export const completedResultFixture = true;\n', 'utf8');
    const record = JSON.parse(readFileSync(join(root, 'catalog/components/button/artifact.json'), 'utf8'));
    const produced = await previewChangeIntentEnvelope({
      repositoryRoot: root,
      operation: {
        kind: 'component-implementation',
        target: { family: target.family },
        lock: lockRecord(root, target, 'completed-lock'),
        afterImages: [{ path: 'packages/react/src/Button.mjs', bytes: after, record }],
      },
    });
    const task = resolve(root, git(root, 'rev-parse', '--git-path', 'core-ui-r1'));
    const taskIdentity = (name, value) => {
      const bytes = Buffer.from(canonicalJson(value), 'utf8');
      writeFileSync(join(task, name), bytes);
      return { path: `.git/core-ui-r1/${name}`, digest: digestBytes(bytes), byteLength: bytes.byteLength };
    };
    mkdirSync(join(root, 'packages/react/src'), { recursive: true });
    writeFileSync(join(root, 'packages/react/src/Button.mjs'), after);
    execFileSync('git', ['-C', root, 'add', 'packages/react/src/Button.mjs']);
    execFileSync('git', ['-C', root, 'commit', '-m', 'test: complete ChangeIntent result'], { stdio: 'ignore' });
    const head = git(root, 'rev-parse', 'HEAD');
    const tree = git(root, 'rev-parse', 'HEAD^{tree}');
    const base = git(root, 'merge-base', 'refs/remotes/origin/main', 'HEAD');
    const diff = execFileSync('git', ['-C', root, 'diff', '--binary', '--full-index', '--no-ext-diff', '--no-textconv', `${base}..${head}`, '--'], { encoding: 'buffer' });
    const binding = { envelopeDigest: produced.envelope.intentId, head: { path: 'git-head', digest: digestBytes(Buffer.from(head, 'utf8')), byteLength: Buffer.byteLength(head) }, tree: { path: 'git-tree', digest: digestBytes(Buffer.from(tree, 'utf8')), byteLength: Buffer.byteLength(tree) } };
    const journal = taskIdentity('completed-journal.json', { ...binding, profile: 'core-ui-change-intent-operation-journal-v1', operationKind: 'component-implementation', status: 'passed' });
    const deterministic = produced.envelope.checks.map(({ command }, index) => taskIdentity(`completed-deterministic-${index}.json`, completedDeterministicRecord(root, binding, command, produced.envelope.source)));
    const result = {
      envelopeDigest: produced.envelope.intentId,
      head: { path: 'git-head', digest: digestBytes(Buffer.from(head, 'utf8')), byteLength: Buffer.byteLength(head) },
      tree: { path: 'git-tree', digest: digestBytes(Buffer.from(tree, 'utf8')), byteLength: Buffer.byteLength(tree) },
      diff: { path: 'git-diff', digest: digestBytes(diff), byteLength: diff.byteLength },
      changedPaths: ['packages/react/src/Button.mjs'],
      operationJournal: journal,
      deterministicResults: deterministic,
    };
    assert.doesNotThrow(() => validateChangeIntentEnvelope({ ...produced.envelope, result }, { repositoryRoot: root }));
    assert.doesNotMatch(JSON.stringify(result), /\/(?:Users|private\/tmp|var\/folders)\//u);
    const retainedDeterministic = JSON.parse(readFileSync(join(task, deterministic[0].path.slice('.git/core-ui-r1/'.length)), 'utf8'));
    assert.equal(retainedDeterministic.runtime.node.path, '<pinned-node-runtime>/node');
    assert.equal(retainedDeterministic.runtime.pnpm.path, '<pinned-package-manager>/pnpm');
    assert.equal(retainedDeterministic.runtime.environment.PATH, '<pinned-node-runtime>:<pinned-package-manager>');
    const nonCanonicalJournalBytes = Buffer.from(` ${canonicalJson({ ...binding, profile: 'core-ui-change-intent-operation-journal-v1', operationKind: 'component-implementation', status: 'passed' })} `, 'utf8');
    writeFileSync(join(task, 'noncanonical-journal.json'), nonCanonicalJournalBytes);
    const nonCanonical = structuredClone({ ...produced.envelope, result });
    nonCanonical.result.operationJournal = { path: '.git/core-ui-r1/noncanonical-journal.json', digest: digestBytes(nonCanonicalJournalBytes), byteLength: nonCanonicalJournalBytes.byteLength };
    assert.throws(() => validateChangeIntentEnvelope(nonCanonical, { repositoryRoot: root }), (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID');
    for (const [field, child] of [
      ['operationJournal', { ...binding, profile: 'core-ui-change-intent-operation-journal-v1', operationKind: 'component-implementation', status: 'failed' }],
      ['deterministicResults', { ...binding, profile: 'core-ui-deterministic-result-v1', command: 'pnpm check', exitState: 1 }],
    ]) {
      const forged = structuredClone({ ...produced.envelope, result });
      const descriptor = taskIdentity(`invalid-${field}.json`, child);
      if (field === 'deterministicResults') forged.result[field] = [descriptor];
      else forged.result[field] = descriptor;
      assert.throws(() => validateChangeIntentEnvelope(forged, { repositoryRoot: root }), (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID', field);
    }
    for (const mutate of [
      (value) => { value.head.digest = digestBytes(Buffer.from('forged-head', 'utf8')); },
      (value) => { value.tree.digest = digestBytes(Buffer.from('forged-tree', 'utf8')); },
      (value) => { value.diff.digest = digestBytes(Buffer.from('forged-diff', 'utf8')); },
      (value) => { value.operationJournal.digest = digestBytes(Buffer.from('forged-journal', 'utf8')); },
      (value) => { value.deterministicResults[0].digest = digestBytes(Buffer.from('forged-result', 'utf8')); },
    ]) {
      const forged = structuredClone({ ...produced.envelope, result });
      mutate(forged.result);
      assert.throws(() => validateChangeIntentEnvelope(forged, { repositoryRoot: root }), (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID');
    }
    for (const [name, mutate] of [
      ['runtime', (value) => { value.runtime.pnpm.version = '10.33.1'; }],
      ['dependency', (value) => { value.runtime.dependency.lockfile.digest = digestBytes(Buffer.from('forged-lockfile')); }],
      ['installed-state', (value) => { value.runtime.dependency.modules.digest = digestBytes(Buffer.from('forged-modules-state')); }],
    ]) {
      const child = JSON.parse(readFileSync(join(task, deterministic[0].path.slice('.git/core-ui-r1/'.length)), 'utf8'));
      mutate(child);
      const forged = structuredClone({ ...produced.envelope, result });
      forged.result.deterministicResults[0] = taskIdentity(`drift-${name}.json`, child);
      assert.throws(() => validateChangeIntentEnvelope(forged, { repositoryRoot: root }), (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_RESULT_INVALID', name);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('producer rejects an unrelated package path beside a valid canonical record', async () => {
  const root = producerClone();
  try {
    const bytes = changedButtonArtifactBytes(root);
    const record = JSON.parse(bytes.toString('utf8'));
    await assert.rejects(
      () => previewChangeIntentEnvelope({
        repositoryRoot: root,
        operation: {
          kind: 'component-implementation',
          target: { family: 'Button' },
          lock: lockRecord(root, { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' }, 'owner-lock'),
          afterImages: [
            { path: 'catalog/components/button/artifact.json', bytes, record },
            { path: 'packages/react/src/unrelated-secret.mjs', bytes: Buffer.from('export const secret = true;\n') },
          ],
        },
      }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_OWNER_UNRESOLVED',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer admits one exact retained-evidence child with proof ownership class', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const fixture = retainedEvidenceFixture(root);
    const result = await previewChangeIntentEnvelope({
      repositoryRoot: root,
      operation: {
        kind: 'retained-evidence-acceptance',
        target: { family: target.family },
        lock: lockRecord(root, target, 'evidence-lock'),
        evidence: fixture.evidence,
        afterImages: fixture.afterImages,
      },
    });
    assert.equal(result.envelope.writeSet.every(({ effect }) => effect === 'evidence-retention-write'), true);
    assert.equal(result.envelope.owners.every(({ owner }) => owner === '@core-ui/repository-policy'), true);
    assert.equal(result.envelope.operation.evidence.path, fixture.evidence.path);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('producer rejects retained evidence whose sole after-image differs', async () => {
  const root = producerClone();
  try {
    const target = { family: 'Button', scopeId: 'SCOPE-COMP-BUTTON-REACT', tranche: 'R1.1' };
    const fixture = retainedEvidenceFixture(root);
    const differentBytes = Buffer.from('{"schema":"core-ui-evidence-index-v1","forged":true}', 'utf8');
    await assert.rejects(
      () => previewChangeIntentEnvelope({ repositoryRoot: root, operation: { kind: 'retained-evidence-acceptance', target: { family: target.family }, lock: lockRecord(root, target, 'evidence-mismatch-lock'), evidence: fixture.evidence, afterImages: fixture.afterImages.map((image) => image.path === fixture.evidence.path ? { path: image.path, bytes: differentBytes } : image) } }),
      (error) => error instanceof ChangeIntentError && error.code === 'CORE_CHANGE_INTENT_EVIDENCE_INVALID',
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});
