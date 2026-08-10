import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from '../../tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs';
import { isIgnoredRepositoryEntry, sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import { verifyDefaultThemeIdentityCorrection } from '../../tooling/audits/repository-policy/src/default-theme-identity-correction-verify.mjs';
import { verifyPhaseCApplicabilityTopologyCorrection } from '../../tooling/audits/repository-policy/src/phase-c-applicability-topology-correction-verify.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');

export const TALE_TOKEN_PHASE_C_PROFILE = Object.freeze({
  schema: 'core-ui-evidence-applicability-profile-v1',
  id: 'TALE-TOKEN-C',
  decision: Object.freeze({
    path: 'decisions/0005-default-theme-token-source-identity.json',
    sha256: 'sha256:747eb372d7cb53351d1cc30f4092cd703feb7986d3ea12814da6974616b85262',
  }),
});
export const TALE_TOKEN_PHASE_C_PROFILE_DIGEST = canonicalDigest(TALE_TOKEN_PHASE_C_PROFILE);
export const TALE_TOKEN_PHASE_C_ROOT_NAMES = Object.freeze([
  'tale-token-phase-c-g0.1',
  'tale-token-phase-c-g0.2',
  'tale-token-phase-c-g0.3',
  'tale-token-phase-c-g0.4',
  'tale-token-phase-c-g0.5',
  'tale-token-phase-c-gate-0',
]);

export function assertTaleTokenPhaseCProfile(value, fail) {
  if (canonicalJson(value) !== canonicalJson(TALE_TOKEN_PHASE_C_PROFILE)) {
    fail('must bind the exact closed TALE-TOKEN-C applicability profile');
  }
}

export function assertTaleTokenPhaseCIndexSet(values, fail) {
  const names = values.map(({ name }) => name).sort();
  const identities = new Set(values.map(({ index }) => (
    `${index.sourceRevision}:${index.sourceTree}:${index.captureTimestamp}`
  )));
  if (
    canonicalJson(names) !== canonicalJson(TALE_TOKEN_PHASE_C_ROOT_NAMES)
    || identities.size !== 1
  ) fail('must retain six exact sibling roots with one source/tree/timestamp');
}
const roots = Object.freeze([
  { key: 'g0.1', milestone: 'G0.1', source: 'tale-token-phase-b-g0.1' },
  { key: 'g0.2', milestone: 'G0.2', source: 'tale-token-phase-b-g0.2' },
  { key: 'g0.3', milestone: 'G0.3', source: 'tale-token-phase-b-g0.3' },
  { key: 'g0.4', milestone: 'G0.4', source: 'tale-token-phase-b-g0.4' },
  { key: 'g0.5', milestone: 'G0.5', source: 'tale-token-phase-b-g0.5' },
  { key: 'gate-0', milestone: 'Gate 0 exit', source: 'tale-token-phase-b-gate-0' },
]);
const targetPath = (key) => `tests/evidence/tale-token-phase-c-${key}`;
const maintenancePath = 'tests/evidence/authority-46-phase-c-applicability';
const outputPaths = Object.freeze([...roots.map(({ key }) => targetPath(key)), maintenancePath]);
const applicabilityPaths = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/foundation',
  'packages/react',
  'packages/tokens',
  'packages/tooling',
  'packages/web',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  'decisions/0003-tale-token-classification-annex.json',
  'decisions/0003-tale-token-classification-acceptance.json',
  'decisions/0004-tale-only-reference-baseline-annex.json',
  'decisions/0004-tale-only-reference-baseline-acceptance.json',
  'decisions/0005-default-theme-token-source-identity.json',
  'decisions/0005-default-theme-token-source-identity-acceptance.json',
  'decisions/0006-phase-c-applicability-topology.json',
  'decisions/0006-phase-c-applicability-topology-acceptance.json',
  'strategy/product-scope.md',
  'tests/fixtures/g1.0',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
  'tests/evidence/authority-39-default-theme-identity',
  'tests/evidence/authority-39-phase-c-applicability-topology',
  'tests/evidence/capture-tale-token-phase-c.mjs',
]);
const acceptancePath = 'decisions/0006-phase-c-applicability-topology-acceptance.json';
const annexPath = 'decisions/0005-default-theme-token-source-identity.json';
const topologyDecisionPath = 'decisions/0006-phase-c-applicability-topology.json';
const checkOnly = process.argv.includes('--check');
const injectedPublishFailureAfter = process.env.CORE_UI_TEST_PHASE_C_CAPTURE_FAIL_AFTER_PUBLISH
  ? Number.parseInt(process.env.CORE_UI_TEST_PHASE_C_CAPTURE_FAIL_AFTER_PUBLISH, 10)
  : null;
if (
  injectedPublishFailureAfter !== null
  && (!Number.isInteger(injectedPublishFailureAfter) || injectedPublishFailureAfter < 1)
) throw new Error('TALE_TOKEN_PHASE_C_TEST_FAILURE_INVALID');

export function parseTaleTokenPhaseCArguments(args) {
  const allowed = new Set(['--source', '--tree', '--timestamp']);
  const result = {};
  if (args.length !== 6) throw new Error('TALE_TOKEN_PHASE_C_ARGUMENT_INVALID');
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || Object.hasOwn(result, name) || value?.startsWith('--')) {
      throw new Error('TALE_TOKEN_PHASE_C_ARGUMENT_INVALID');
    }
    result[name] = value;
  }
  if (
    !result['--source']
    || !/^[0-9a-f]{40}$/u.test(result['--tree'] ?? '')
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(result['--timestamp'] ?? '')
  ) throw new Error('TALE_TOKEN_PHASE_C_ARGUMENT_REQUIRED');
  return {
    source: result['--source'],
    timestamp: result['--timestamp'],
    tree: result['--tree'],
  };
}

export function assertTruthfulTaleTokenPhaseCTimestamp(value, sourceValue, nowValue = new Date()) {
  const timestamp = new Date(value);
  const sourceTimestamp = new Date(sourceValue);
  if (
    Number.isNaN(timestamp.valueOf())
    || Number.isNaN(sourceTimestamp.valueOf())
    || timestamp.toISOString().replace('.000Z', 'Z') !== value
    || timestamp < sourceTimestamp
    || timestamp > nowValue
  ) throw new Error('TALE_TOKEN_PHASE_C_TIMESTAMP_INVALID');
}

async function exec(command, args, cwd = repositoryRoot) {
  try {
    const result = await execFile(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    return { command: [command, ...args].join(' '), exitState: 0, output: result.stdout + result.stderr };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw new Error(`TALE_TOKEN_PHASE_C_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
  }
}

async function git(...args) {
  return (await exec('git', args)).output.trim();
}

function normalizeOutput(value, root = repositoryRoot) {
  return value
    .replaceAll(`/private${root}`, '<repository>')
    .replaceAll(root, '<repository>')
    .replace(/\/private\/var\/folders\/[A-Za-z0-9_./-]+/gu, '<temporary>')
    .replace(/\((?:\d+\.)?\d+ms\)/gu, '(duration)')
    .replace(/duration_ms (?:\d+\.)?\d+/gu, 'duration_ms <duration>')
    .replace(/Done in [^\n]+/gu, 'Done in <duration>')
    .replace(/\r\n/gu, '\n');
}

async function writeCanonical(root, relativePath, value) {
  const bytes = canonicalJson(value);
  const path = join(root, relativePath);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
  return bytes;
}

async function manifestEntries(root, declaredPaths) {
  const entries = [];
  async function visit(relativePath) {
    const absolute = join(root, relativePath);
    const metadata = await stat(absolute);
    if (metadata.isDirectory()) {
      const children = (await readdir(absolute)).sort();
      for (const child of children) {
        if (!isIgnoredRepositoryEntry(child)) await visit(join(relativePath, child));
      }
      return;
    }
    entries.push({ path: relativePath, sha256: `sha256:${sha256(await readFile(absolute))}` });
  }
  for (const path of declaredPaths) await visit(path);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function readJson(root, relativePath) {
  const bytes = await readFile(join(root, relativePath), 'utf8');
  return { bytes, value: parseJsonStrict(bytes) };
}

async function environment(root) {
  const [node, pnpm, gitVersion, architecture, product, build] = await Promise.all([
    exec('node', ['--version'], root),
    exec('pnpm', ['--version'], root),
    exec('git', ['--version'], root),
    exec('uname', ['-m'], root),
    exec('sw_vers', ['-productVersion'], root),
    exec('sw_vers', ['-buildVersion'], root),
  ]);
  return {
    architecture: architecture.output.trim(),
    git: gitVersion.output.trim().replace(/^git version /u, ''),
    node: node.output.trim(),
    pnpm: pnpm.output.trim(),
    runnerImage: `local-macos-${product.output.trim()}`,
    runnerImageVersion: build.output.trim(),
    runnerOs: `macOS ${product.output.trim()}`,
  };
}

async function captureAt(root, sourceRevision, expectedSourceTree, captureTimestamp) {
  for (const relativePath of outputPaths) {
    try {
      await access(join(root, relativePath));
      throw new Error(`TALE_TOKEN_PHASE_C_OUTPUT_EXISTS: ${relativePath}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const sourceTree = (await exec('git', ['rev-parse', `${sourceRevision}^{tree}`], root)).output.trim();
  if (sourceTree !== expectedSourceTree) {
    throw new Error('TALE_TOKEN_PHASE_C_TREE_MISMATCH: --tree must equal the exact source tree');
  }
  const head = (await exec('git', ['rev-parse', 'HEAD'], root)).output.trim();
  if (head !== sourceRevision) throw new Error('TALE_TOKEN_PHASE_C_SOURCE_MISMATCH: checkout HEAD must equal --source');
  const worktreeStatus = (await exec(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    root,
  )).output.trim();
  if (worktreeStatus) throw new Error(`TALE_TOKEN_PHASE_C_WORKTREE_DRIFT: ${worktreeStatus}`);
  const sourceTimestamp = (await exec(
    'git',
    ['show', '-s', '--format=%cI', sourceRevision],
    root,
  )).output.trim();
  assertTruthfulTaleTokenPhaseCTimestamp(captureTimestamp, sourceTimestamp);
  await verifyDefaultThemeIdentityCorrection(root, { requireAcceptance: true });
  await verifyPhaseCApplicabilityTopologyCorrection({
    acceptancePath: join(root, 'decisions/0006-phase-c-applicability-topology-acceptance.json'),
    decisionPath: join(root, 'decisions/0006-phase-c-applicability-topology.json'),
    scopePath: join(root, 'strategy/product-scope.md'),
  });
  const committedAnnex = await readFile(join(root, annexPath));
  if (`sha256:${sha256(committedAnnex)}` !== TALE_TOKEN_PHASE_C_PROFILE.decision.sha256) {
    throw new Error('TALE_TOKEN_PHASE_C_PROFILE_DECISION_MISMATCH');
  }
  const committedEntries = await manifestEntries(root, applicabilityPaths);
  const applicabilityManifest = {
    algorithm: 'sha256',
    paths: applicabilityPaths,
    profile: 'core-ui-path-manifest-v1',
    sha256: `sha256:${sha256(canonicalJson(committedEntries))}`,
  };
  const env = await environment(root);
  const commands = {
    schema: await exec('pnpm', ['--filter', '@core-ui/schema', 'check'], root),
    catalog: await exec('pnpm', ['--filter', '@core-ui/catalog', 'check'], root),
    tokens: await exec('pnpm', ['--filter', '@core-ui/tokens', 'check'], root),
    tooling: await exec('pnpm', ['--filter', '@core-ui/tooling', 'check'], root),
    web: await exec('pnpm', ['--filter', '@core-ui/web', 'check'], root),
    react: await exec('pnpm', ['--filter', '@core-ui/react', 'check'], root),
    generation: await exec('pnpm', ['generate:check'], root),
    release: await exec('node', ['tooling/audits/repository-policy/src/release-prepare.mjs'], root),
    agent: await exec('pnpm', ['test:agent'], root),
  };
  const normalized = Object.fromEntries(Object.entries(commands).map(([key, result]) => [key, {
    ...result,
    output: normalizeOutput(result.output, root),
  }]));
  const catalogPackage = (await readJson(root, 'packages/catalog/generated/catalog-package.json')).value;
  const catalogBundle = (await readJson(root, 'packages/catalog/generated/catalog.json')).value;
  const historicalByKey = new Map();
  for (const item of roots) {
    const historical = await readJson(root, `tests/evidence/${item.source}/index.json`);
    historicalByKey.set(item.key, historical);
  }

  async function writeMilestone(item, upstreamEvidence = null, supersessions = []) {
    const outputRoot = targetPath(item.key);
    const historical = historicalByKey.get(item.key).value;
    const commandKeys = item.key === 'g0.1'
      ? ['schema', 'tokens']
      : item.key === 'g0.2'
        ? ['catalog', 'tokens']
        : item.key === 'g0.3'
          ? ['tooling']
          : item.key === 'g0.4'
            ? ['tooling']
            : item.key === 'g0.5'
              ? ['schema', 'tokens', 'tooling']
              : [
                'schema', 'catalog', 'tokens', 'tooling', 'web', 'react',
                'generation', 'release', 'agent',
              ];
    const resultRefs = [];
    for (const key of commandKeys) {
      const path = `${outputRoot}/validation/${key}.txt`;
      const bytes = normalized[key].output;
      await mkdir(resolve(join(root, path), '..'), { recursive: true });
      await writeFile(join(root, path), bytes);
      resultRefs.push({
        command: normalized[key].command,
        exitState: 0,
        rawOutput: { path, sha256: `sha256:${sha256(bytes)}` },
      });
    }
    const validationPath = `${outputRoot}/validation.json`;
    const validationBytes = await writeCanonical(root, validationPath, {
      applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
      captureProcedure: 'node tests/evidence/capture-tale-token-phase-c.mjs',
      environment: env,
      results: resultRefs,
      schema: 'core-ui-evidence-validation-v1',
      sourceRevision,
      sourceTree,
    });
    const validation = { path: validationPath, sha256: `sha256:${sha256(validationBytes)}` };
    const recordRefs = [];
    for (const historicalRef of historical.records) {
      const oldRecord = (await readJson(root, historicalRef.path)).value;
      const artifactPath = `${outputRoot}/artifacts/${oldRecord.assertionId}.json`;
      const artifactBytes = await writeCanonical(root, artifactPath, {
        applicability: {
          applicabilityManifest,
          applicabilityProfileDigest: TALE_TOKEN_PHASE_C_PROFILE_DIGEST,
          catalog: {
            catalogDigest: catalogBundle.catalogDigest,
            catalogVersion: catalogBundle.catalogVersion,
            queryApiVersion: catalogBundle.apiVersion,
            sourceRevision: catalogBundle.sourceRevision,
            supportedQueryApiVersions: catalogBundle.supportedQueryApiVersions,
          },
          catalogPackage: {
            schema: catalogPackage.schema,
            version: catalogPackage.version,
            queryApiVersion: catalogPackage.queryApiVersion,
            supportedQueryApiVersions: catalogPackage.supportedQueryApiVersions,
          },
        },
        applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
        assertionId: oldRecord.assertionId,
        captureTimestamp,
        command: commandKeys.map((key) => normalized[key].command).join(' && '),
        environment: env,
        evidenceKind: oldRecord.evidenceKind,
        executedRevision: sourceRevision,
        executedTree: sourceTree,
        exitState: 0,
        observations: {
          checks: resultRefs.map(({ command, rawOutput }) => ({ command, outputSha256: rawOutput.sha256 })),
          phase: 'TALE-TOKEN-C',
          ...(upstreamEvidence === null ? {} : { upstreamEvidence }),
        },
        outcome: 'pass',
        schema: 'core-ui-evidence-artifact-v1',
        sourceRevision,
        sourceTree,
      });
      const recordPath = `${outputRoot}/records/${oldRecord.assertionId}.json`;
      const recordBytes = await writeCanonical(root, recordPath, {
        activeExceptionRefs: [],
        advisoryRefs: [],
        applicability: {
          applicabilityManifest,
          applicabilityProfileDigest: TALE_TOKEN_PHASE_C_PROFILE_DIGEST,
        },
        applicabilityManifest,
        applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
        artifact: { path: artifactPath, sha256: `sha256:${sha256(artifactBytes)}` },
        assertionId: oldRecord.assertionId,
        captureTimestamp,
        command: commandKeys.map((key) => normalized[key].command).join(' && '),
        disclosureClass: 'public-sanitized',
        environment: env,
        evidenceKind: oldRecord.evidenceKind,
        executedRevision: sourceRevision,
        executedTree: sourceTree,
        expiry: 'Any TALE-TOKEN-C source, catalog/package/query identity, applicability profile, environment tuple, retained result, or human acceptance change',
        milestone: item.milestone,
        outcome: 'pass',
        owner: 'ndrewtran',
        retentionPolicy: 'Content-addressed Git records retained by issue #46 pull-request and default-branch history after merge; issue #46 is a mutable locator',
        schema: 'core-ui-evidence-record-v1',
        sourceRevision,
        sourceTree,
        validation,
      });
      recordRefs.push({
        assertionId: oldRecord.assertionId,
        path: recordPath,
        sha256: `sha256:${sha256(recordBytes)}`,
      });
    }
    const indexPath = `${outputRoot}/index.json`;
    const indexBytes = await writeCanonical(root, indexPath, {
      applicabilityManifest,
      applicabilityProfile: TALE_TOKEN_PHASE_C_PROFILE,
      captureTimestamp,
      disclosureClass: 'public-sanitized',
      milestone: item.milestone,
      owner: 'ndrewtran',
      records: recordRefs,
      retentionPolicy: 'Content-addressed Git records retained by issue #46 pull-request and default-branch history after merge; issue #46 is a mutable locator',
      schema: 'core-ui-evidence-index-v1',
      sourceRevision,
      sourceTree,
      ...(supersessions.length === 0 ? {} : { supersessions }),
      validation,
    });
    return { path: indexPath, sha256: `sha256:${sha256(indexBytes)}`, profileDigest: TALE_TOKEN_PHASE_C_PROFILE_DIGEST };
  }

  const upstream = [];
  for (const item of roots.slice(0, 5)) upstream.push(await writeMilestone(item));
  const g00 = await readJson(root, 'tests/evidence/g0.0/index.json');
  const gateInputs = [
    { path: 'tests/evidence/g0.0/index.json', sha256: `sha256:${sha256(g00.bytes)}`, profileDigest: null },
    ...upstream,
  ];

  const acceptanceBytes = await readFile(join(root, acceptancePath));
  const topologyDecisionBytes = await readFile(join(root, topologyDecisionPath));
  const acceptance = parseJsonStrict(acceptanceBytes.toString('utf8'));
  const topologyDecision = parseJsonStrict(topologyDecisionBytes.toString('utf8'));
  assertAuthorityDecisionShape(acceptance, (message) => {
    throw new Error(`TALE_TOKEN_PHASE_C_AUTHORIZATION_INVALID: ${message}`);
  });
  if (
    acceptance.decisionId !== 'core-ui:decision:0006'
    || acceptance.issueNumber !== 39
    || acceptance.owner !== 'ndrewtran'
  ) throw new Error('TALE_TOKEN_PHASE_C_AUTHORIZATION_INVALID: wrong decision 0006 receipt');
  const authorization = { path: acceptancePath, sha256: `sha256:${sha256(acceptanceBytes)}` };
  const phaseCSupersessionRefs = [];
  const maintenanceSupersessionRefs = [];
  const authorityIndex = await readJson(
    root,
    'tests/evidence/authority-39-phase-c-applicability-topology/index.json',
  );
  const authorityReferences = new Map(
    authorityIndex.value.supersessions.map((reference) => [reference.path, reference]),
  );
  async function writeSuccessor(specification, expectedSuccessorRoot) {
    const predecessorReference = authorityReferences.get(specification.predecessorPath);
    if (!predecessorReference) {
      throw new Error(`TALE_TOKEN_PHASE_C_SUPERSESSION_INVALID: missing ${specification.name} authority-stage terminal`);
    }
    const predecessor = await readJson(root, predecessorReference.path);
    if (
      predecessorReference.sha256 !== `sha256:${sha256(predecessor.bytes)}`
      || canonicalJson(predecessor.value.affectedAssertions) !== canonicalJson(specification.affectedAssertions)
      || canonicalJson(predecessor.value.historicalIndex) !== canonicalJson(specification.historicalIndex)
      || !specification.successorPath.startsWith(`${expectedSuccessorRoot}/supersessions/`)
    ) {
      throw new Error(`TALE_TOKEN_PHASE_C_SUPERSESSION_INVALID: ${specification.name} authority specification`);
    }
    const historical = await readJson(root, predecessor.value.historicalIndex.path);
    if (`sha256:${sha256(historical.bytes)}` !== specification.historicalIndex.sha256) {
      throw new Error(`TALE_TOKEN_PHASE_C_SUPERSESSION_INVALID: ${specification.name} historical digest`);
    }
    const currentEntries = await manifestEntries(
      root,
      predecessor.value.currentApplicabilityManifest.paths,
    );
    const supersession = {
      affectedAssertions: historical.value.records.map(({ assertionId }) => assertionId).sort(),
      authorization,
      currentApplicabilityManifest: {
        algorithm: 'sha256',
        paths: predecessor.value.currentApplicabilityManifest.paths,
        profile: 'core-ui-path-manifest-v1',
        sha256: `sha256:${sha256(canonicalJson(currentEntries))}`,
      },
      disclosureClass: 'public-sanitized',
      effectiveAt: acceptance.createdAt,
      evidenceStatus: 'superseded',
      historicalIndex: predecessor.value.historicalIndex,
      owner: acceptance.owner,
      previousSupersession: {
        path: predecessorReference.path,
        sha256: predecessorReference.sha256,
      },
      reasonCode: 'governing-authority-changed',
      replacementPlan: predecessor.value.replacementPlan,
      replacementStatus: 'pending',
      schema: 'core-ui-evidence-applicability-supersession-v1',
      sourceRevision,
      sourceTree,
      supersededApplicabilityManifest: predecessor.value.currentApplicabilityManifest,
    };
    assertApplicabilitySupersessionShape(supersession, (message) => {
      throw new Error(`TALE_TOKEN_PHASE_C_SUPERSESSION_INVALID: ${message}`);
    });
    const path = specification.successorPath;
    const bytes = await writeCanonical(root, path, supersession);
    return {
      milestone: predecessorReference.milestone,
      path,
      sha256: `sha256:${sha256(bytes)}`,
    };
  }
  for (const specification of topologyDecision.proofTopology.phaseC.successorTargets) {
    phaseCSupersessionRefs.push(await writeSuccessor(specification, targetPath('gate-0')));
  }
  for (const specification of topologyDecision.proofTopology.maintenance.targets) {
    maintenanceSupersessionRefs.push(await writeSuccessor(specification, maintenancePath));
  }
  await writeMilestone(roots[5], {
    assertionCount: 29,
    indexes: gateInputs,
  }, phaseCSupersessionRefs);
  await writeCanonical(root, `${maintenancePath}/index.json`, {
    records: [],
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    supersessions: maintenanceSupersessionRefs,
  });

  await exec('node', ['tooling/audits/repository-policy/src/evidence-verify.mjs'], root);
  await exec('pnpm', ['check'], root);
  await exec('pnpm', ['release:prepare'], root);
  return { sourceRevision, sourceTree };
}

async function compareTrees(expectedRoot, actualRoot) {
  async function files(root, relative = '') {
    const output = [];
    for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) output.push(...await files(root, path));
      else output.push(path);
    }
    return output;
  }
  for (const relative of outputPaths) {
    const expectedFiles = await files(join(expectedRoot, relative));
    const actualFiles = await files(join(actualRoot, relative));
    if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) {
      throw new Error(`TALE_TOKEN_PHASE_C_EVIDENCE_DRIFT: ${relative} file set differs`);
    }
    for (const path of expectedFiles) {
      const [expected, actual] = await Promise.all([
        readFile(join(expectedRoot, relative, path)),
        readFile(join(actualRoot, relative, path)),
      ]);
      if (!expected.equals(actual)) {
        throw new Error(
          `TALE_TOKEN_PHASE_C_EVIDENCE_DRIFT: ${join(relative, path)}\n`
          + `expected sha256:${sha256(expected)}\nactual sha256:${sha256(actual)}\n`
          + `expected ${expected.toString('utf8')}\nactual ${actual.toString('utf8')}`,
        );
      }
    }
  }
}

async function withGeneratedOutputs(sourceRevision, sourceTree, captureTimestamp, operation) {
  const temporary = await mkdtemp(join(tmpdir(), 'core-ui-tale-token-phase-c-'));
  const checkout = join(temporary, 'checkout');
  try {
    await exec('git', ['worktree', 'add', '--detach', checkout, sourceRevision]);
    await exec('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], checkout);
    await captureAt(checkout, sourceRevision, sourceTree, captureTimestamp);
    return await operation(checkout);
  } finally {
    await exec('git', ['worktree', 'remove', '--force', checkout]).catch(() => null);
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function publishDirectorySetAtomically({
  afterPublish = async () => {},
  destinationRoot,
  failAfter = null,
  generatedRoot,
  relativePaths,
  rollbackRename = rename,
  verifyStaged = async () => {},
}) {
  const transactionParent = join(destinationRoot, 'tests/evidence');
  await mkdir(transactionParent, { recursive: true });
  const transactionRoot = await mkdtemp(join(transactionParent, '.tale-token-phase-c.transaction-'));
  const published = [];
  try {
    for (const relativePath of relativePaths) {
      const staged = join(transactionRoot, relativePath);
      await mkdir(resolve(staged, '..'), { recursive: true });
      await cp(join(generatedRoot, relativePath), staged, { recursive: true });
    }
    await verifyStaged(transactionRoot);
    for (const [index, relativePath] of relativePaths.entries()) {
      await rename(join(transactionRoot, relativePath), join(destinationRoot, relativePath));
      published.push(relativePath);
      if (failAfter === index + 1) {
        throw new Error(`TALE_TOKEN_PHASE_C_TEST_FAILURE: injected after publishing ${index + 1} roots`);
      }
    }
    await rm(transactionRoot, { recursive: true, force: true });
    await afterPublish();
  } catch (error) {
    const rollbackFailures = [];
    for (const relativePath of [...published].reverse()) {
      const staged = join(transactionRoot, relativePath);
      try {
        await mkdir(resolve(staged, '..'), { recursive: true });
        await rollbackRename(join(destinationRoot, relativePath), staged);
      } catch (rollbackError) {
        rollbackFailures.push(`${relativePath}: ${rollbackError.message}`);
        await rm(join(destinationRoot, relativePath), { recursive: true, force: true }).catch((cleanupError) => {
          rollbackFailures.push(`${relativePath} cleanup: ${cleanupError.message}`);
        });
      }
    }
    const residualPaths = [];
    for (const relativePath of relativePaths) {
      try {
        await access(join(destinationRoot, relativePath));
        residualPaths.push(relativePath);
      } catch (accessError) {
        if (accessError?.code !== 'ENOENT') {
          rollbackFailures.push(`${relativePath} postcondition: ${accessError.message}`);
        }
      }
    }
    if (rollbackFailures.length > 0 || residualPaths.length > 0) {
      throw new Error(
        `TALE_TOKEN_PHASE_C_ROLLBACK_INTEGRITY: original=${error.message}; `
          + `failures=${rollbackFailures.join(' | ') || 'none'}; `
          + `residual=${residualPaths.join(',') || 'none'}`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(transactionRoot, { recursive: true, force: true });
  }
}

async function publishGeneratedOutputs(generatedRoot) {
  await publishDirectorySetAtomically({
    afterPublish: () => exec(
      'node',
      ['tooling/audits/repository-policy/src/evidence-verify.mjs'],
      repositoryRoot,
    ),
    destinationRoot: repositoryRoot,
    failAfter: injectedPublishFailureAfter,
    generatedRoot,
    relativePaths: outputPaths,
    verifyStaged: (transactionRoot) => compareTrees(generatedRoot, transactionRoot),
  });
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
  if (checkOnly) {
    const retained = await readJson(repositoryRoot, `${targetPath('g0.1')}/index.json`);
    const sourceRevision = retained.value.sourceRevision;
    const sourceTree = retained.value.sourceTree;
    const captureTimestamp = retained.value.captureTimestamp;
    for (const relativePath of outputPaths) {
      const index = await readJson(repositoryRoot, `${relativePath}/index.json`);
      if (
        index.value.sourceRevision !== sourceRevision
        || index.value.sourceTree !== sourceTree
        || (relativePath !== maintenancePath && index.value.captureTimestamp !== captureTimestamp)
      ) throw new Error('TALE_TOKEN_PHASE_C_RETAINED_IDENTITY_MISMATCH');
    }
    await withGeneratedOutputs(sourceRevision, sourceTree, captureTimestamp, async (generatedRoot) => {
      await compareTrees(repositoryRoot, generatedRoot);
    });
    console.log(`[TALE-TOKEN-C] verified six proof roots and one maintenance root at ${sourceRevision}`);
  } else {
    const { source, tree, timestamp } = parseTaleTokenPhaseCArguments(process.argv.slice(2));
    const sourceRevision = await git('rev-parse', source);
    const sourceTree = await git('rev-parse', `${sourceRevision}^{tree}`);
    if (sourceTree !== tree) throw new Error('TALE_TOKEN_PHASE_C_TREE_MISMATCH: --tree must equal the exact source tree');
    if (await git('rev-parse', 'HEAD') !== sourceRevision) {
      throw new Error('TALE_TOKEN_PHASE_C_SOURCE_MISMATCH: checkout HEAD must equal --source');
    }
    const status = await git('status', '--porcelain=v1', '--untracked-files=all');
    if (status) throw new Error(`TALE_TOKEN_PHASE_C_WORKTREE_DRIFT: ${status}`);
    for (const relativePath of outputPaths) {
      try {
        await access(join(repositoryRoot, relativePath));
        throw new Error(`TALE_TOKEN_PHASE_C_OUTPUT_EXISTS: ${relativePath}`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    await withGeneratedOutputs(sourceRevision, sourceTree, timestamp, publishGeneratedOutputs);
    console.log(`[TALE-TOKEN-C] captured six proof roots and one maintenance root at ${sourceRevision}`);
  }
}
