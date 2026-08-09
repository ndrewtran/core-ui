import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import {
  assertApplicabilitySupersessionShape,
  assertAuthorityDecisionShape,
} from '../../tooling/audits/repository-policy/src/evidence-applicability-supersession.mjs';
import { isIgnoredRepositoryEntry, sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';
import { assertTaleAnnexAcceptanceRecord } from '../../tooling/audits/repository-policy/src/tale-token-annex-acceptance.mjs';
import {
  TALE_TOKEN_PHASE_B_PROFILE,
  TALE_TOKEN_PHASE_B_PROFILE_DIGEST,
} from './tale-token-phase-b-profile.mjs';
import {
  TALE_TOKEN_PHASE_C_PROFILE,
  TALE_TOKEN_PHASE_C_PROFILE_DIGEST,
} from './tale-token-phase-c-profile.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = resolve(import.meta.dirname, '../..');
const phaseC = process.argv.includes('--phase-c');
const phaseId = phaseC ? 'TALE-TOKEN-C' : 'TALE-TOKEN-B';
const phaseSlug = phaseC ? 'c' : 'b';
const profile = phaseC ? TALE_TOKEN_PHASE_C_PROFILE : TALE_TOKEN_PHASE_B_PROFILE;
const profileDigest = phaseC
  ? TALE_TOKEN_PHASE_C_PROFILE_DIGEST
  : TALE_TOKEN_PHASE_B_PROFILE_DIGEST;
const captureProcedure = phaseC
  ? 'node tests/evidence/capture-tale-token-phase-c.mjs'
  : 'node tests/evidence/capture-tale-token-phase-b.mjs';
const issueNumber = phaseC ? 46 : 44;
const roots = Object.freeze([
  { key: 'g0.1', milestone: 'G0.1', source: `tale-token-phase-${phaseC ? 'b' : 'a'}-g0.1` },
  { key: 'g0.2', milestone: 'G0.2', source: `tale-token-phase-${phaseC ? 'b' : 'a'}-g0.2` },
  { key: 'g0.3', milestone: 'G0.3', source: `tale-token-phase-${phaseC ? 'b' : 'a'}-g0.3` },
  { key: 'g0.4', milestone: 'G0.4', source: `tale-token-phase-${phaseC ? 'b' : 'a'}-g0.4` },
  { key: 'g0.5', milestone: 'G0.5', source: `tale-token-phase-${phaseC ? 'b' : 'a'}-g0.5` },
  { key: 'gate-0', milestone: 'Gate 0 exit', source: `tale-token-phase-${phaseC ? 'b' : 'a'}-gate-0` },
]);
const targetPath = (key) => `tests/evidence/tale-token-phase-${phaseSlug}-${key}`;
const applicabilityPaths = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/tokens',
  'packages/tooling',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  ...(phaseC ? [
    'tests/fixtures/g1.0',
    'tests/fixtures/tale-token-classification',
    'tests/evidence/capture-tale-token-phase-b.mjs',
    'tests/evidence/capture-tale-token-phase-c.mjs',
    'tests/evidence/tale-token-phase-b-profile.mjs',
    'tests/evidence/tale-token-phase-c-profile.mjs',
  ] : [
    'tests/fixtures/tale-token-phase-b',
    'tests/evidence/capture-tale-token-phase-b.mjs',
    'tests/evidence/tale-token-phase-b-profile.mjs',
  ]),
]);
const acceptancePath = 'decisions/0003-tale-token-classification-acceptance.json';
const annexPath = 'decisions/0003-tale-token-classification-annex.json';
const checkOnly = process.argv.includes('--check');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
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
    throw new Error(`TALE_TOKEN_PHASE_B_COMMAND_FAILED: ${command} ${args.join(' ')}\n${output}`);
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

async function terminalSupersessions(root) {
  const evidenceRoot = join(root, 'tests/evidence');
  const entries = await readdir(evidenceRoot, { withFileTypes: true });
  const references = [];
  const predecessorPaths = new Set();
  for (const entry of entries.filter((value) => value.isDirectory())) {
    const index = await readJson(root, `tests/evidence/${entry.name}/index.json`);
    for (const reference of index.value.supersessions ?? []) {
      references.push(reference);
      const node = await readJson(root, reference.path);
      if (node.value.previousSupersession?.path) predecessorPaths.add(node.value.previousSupersession.path);
    }
  }
  return new Map(references
    .filter(({ path }) => !predecessorPaths.has(path))
    .map((reference) => [reference.milestone, reference]));
}

async function captureAt(root, sourceRevision, captureTimestamp) {
  for (const { key } of roots) {
    try {
      await access(join(root, targetPath(key)));
      throw new Error(`TALE_TOKEN_PHASE_B_OUTPUT_EXISTS: ${targetPath(key)}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const sourceTree = (await exec('git', ['rev-parse', `${sourceRevision}^{tree}`], root)).output.trim();
  const head = (await exec('git', ['rev-parse', 'HEAD'], root)).output.trim();
  if (head !== sourceRevision) throw new Error('TALE_TOKEN_PHASE_B_SOURCE_MISMATCH: checkout HEAD must equal --source');
  await exec('git', ['diff', '--exit-code', sourceRevision, '--', ...applicabilityPaths], root);
  const untracked = (await exec(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', ...applicabilityPaths],
    root,
  )).output.trim();
  if (untracked) throw new Error(`TALE_TOKEN_PHASE_B_WORKTREE_DRIFT: ${untracked}`);
  const committedAnnex = await readFile(join(root, annexPath));
  if (`sha256:${sha256(committedAnnex)}` !== profile.decision.sha256) {
    throw new Error('TALE_TOKEN_PHASE_B_PROFILE_DECISION_MISMATCH');
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
              : ['schema', 'catalog', 'tokens', 'tooling', 'generation', 'release', 'agent'];
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
      applicabilityProfile: profile,
      captureProcedure,
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
          applicabilityProfileDigest: profileDigest,
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
        applicabilityProfile: profile,
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
          phase: phaseId,
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
          applicabilityProfileDigest: profileDigest,
        },
        applicabilityManifest,
        applicabilityProfile: profile,
        artifact: { path: artifactPath, sha256: `sha256:${sha256(artifactBytes)}` },
        assertionId: oldRecord.assertionId,
        captureTimestamp,
        command: commandKeys.map((key) => normalized[key].command).join(' && '),
        disclosureClass: 'public-sanitized',
        environment: env,
        evidenceKind: oldRecord.evidenceKind,
        executedRevision: sourceRevision,
        executedTree: sourceTree,
        expiry: `Any ${phaseId} source, catalog/package/query identity, applicability profile, environment tuple, retained result, or human acceptance change`,
        milestone: item.milestone,
        outcome: 'pass',
        owner: 'ndrewtran',
        retentionPolicy: `Content-addressed Git records retained by issue #${issueNumber} pull-request and default-branch history after merge; issue #${issueNumber} is a mutable locator`,
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
      applicabilityProfile: profile,
      captureTimestamp,
      disclosureClass: 'public-sanitized',
      milestone: item.milestone,
      owner: 'ndrewtran',
      records: recordRefs,
      retentionPolicy: `Content-addressed Git records retained by issue #${issueNumber} pull-request and default-branch history after merge; issue #${issueNumber} is a mutable locator`,
      schema: 'core-ui-evidence-index-v1',
      sourceRevision,
      sourceTree,
      ...(supersessions.length === 0 ? {} : { supersessions }),
      validation,
    });
    return { path: indexPath, sha256: `sha256:${sha256(indexBytes)}`, profileDigest };
  }

  const upstream = [];
  for (const item of roots.slice(0, 5)) upstream.push(await writeMilestone(item));
  const g00 = await readJson(root, 'tests/evidence/g0.0/index.json');
  const gateInputs = [
    { path: 'tests/evidence/g0.0/index.json', sha256: `sha256:${sha256(g00.bytes)}`, profileDigest: null },
    ...upstream,
  ];

  const acceptanceBytes = await readFile(join(root, acceptancePath));
  const annexBytes = await readFile(join(root, annexPath));
  const acceptance = parseJsonStrict(acceptanceBytes.toString('utf8'));
  assertTaleAnnexAcceptanceRecord(acceptance, annexPath, annexBytes, (message) => {
    throw new Error(`TALE_TOKEN_PHASE_B_ACCEPTANCE_INVALID: ${message}`);
  });
  assertAuthorityDecisionShape(acceptance, (message) => {
    throw new Error(`TALE_TOKEN_PHASE_B_AUTHORIZATION_INVALID: ${message}`);
  });
  const authorization = { path: acceptancePath, sha256: `sha256:${sha256(acceptanceBytes)}` };
  const supersessionRefs = [];
  for (const item of roots) {
    const historicalPath = `tests/evidence/${item.source}/index.json`;
    const historical = await readJson(root, historicalPath);
    const currentEntries = await manifestEntries(root, historical.value.applicabilityManifest.paths);
    const supersession = {
      affectedAssertions: historical.value.records.map(({ assertionId }) => assertionId).sort(),
      authorization,
      currentApplicabilityManifest: {
        algorithm: 'sha256',
        paths: historical.value.applicabilityManifest.paths,
        profile: 'core-ui-path-manifest-v1',
        sha256: `sha256:${sha256(canonicalJson(currentEntries))}`,
      },
      disclosureClass: 'public-sanitized',
      effectiveAt: acceptance.createdAt,
      evidenceStatus: 'superseded',
      historicalIndex: { path: historicalPath, sha256: `sha256:${sha256(historical.bytes)}` },
      owner: acceptance.owner,
      reasonCode: 'governing-authority-changed',
      replacementPlan: phaseC ? ['TALE-TOKEN-C', 'G1.0'] : ['TALE-TOKEN-B', 'TALE-TOKEN-C'],
      replacementStatus: 'pending',
      schema: 'core-ui-evidence-applicability-supersession-v1',
      sourceRevision,
      sourceTree,
      supersededApplicabilityManifest: historical.value.applicabilityManifest,
    };
    assertApplicabilitySupersessionShape(supersession, (message) => {
      throw new Error(`TALE_TOKEN_PHASE_B_SUPERSESSION_INVALID: ${message}`);
    });
    const path = `${targetPath('gate-0')}/supersessions/${item.key}.json`;
    const bytes = await writeCanonical(root, path, supersession);
    supersessionRefs.push({ milestone: historical.value.milestone, path, sha256: `sha256:${sha256(bytes)}` });
  }
  await writeMilestone(roots[5], {
    assertionCount: 29,
    indexes: gateInputs,
  }, supersessionRefs);

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
  for (const { key } of roots) {
    const relative = targetPath(key);
    const expectedFiles = await files(join(expectedRoot, relative));
    const actualFiles = await files(join(actualRoot, relative));
    if (canonicalJson(expectedFiles) !== canonicalJson(actualFiles)) {
      throw new Error(`TALE_TOKEN_PHASE_B_EVIDENCE_DRIFT: ${relative} file set differs`);
    }
    for (const path of expectedFiles) {
      const [expected, actual] = await Promise.all([
        readFile(join(expectedRoot, relative, path)),
        readFile(join(actualRoot, relative, path)),
      ]);
      if (!expected.equals(actual)) {
        throw new Error(
          `TALE_TOKEN_PHASE_B_EVIDENCE_DRIFT: ${join(relative, path)}\n`
          + `expected sha256:${sha256(expected)}\nactual sha256:${sha256(actual)}\n`
          + `expected ${expected.toString('utf8')}\nactual ${actual.toString('utf8')}`,
        );
      }
    }
  }
}

if (checkOnly) {
  const retained = await readJson(repositoryRoot, `${targetPath('g0.1')}/index.json`);
  const sourceRevision = retained.value.sourceRevision;
  const captureTimestamp = retained.value.captureTimestamp;
  for (const { key } of roots) {
    const index = await readJson(repositoryRoot, `${targetPath(key)}/index.json`);
    if (
      index.value.sourceRevision !== sourceRevision
      || index.value.captureTimestamp !== captureTimestamp
    ) throw new Error('TALE_TOKEN_PHASE_B_RETAINED_IDENTITY_MISMATCH');
  }
  const temporary = await mkdtemp(join(tmpdir(), `core-ui-tale-token-phase-${phaseSlug}-`));
  const checkout = join(temporary, 'checkout');
  try {
    await exec('git', ['worktree', 'add', '--detach', checkout, sourceRevision]);
    await exec('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'], checkout);
    await captureAt(checkout, sourceRevision, captureTimestamp);
    await compareTrees(repositoryRoot, checkout);
  } finally {
    await exec('git', ['worktree', 'remove', '--force', checkout]).catch(() => null);
    await rm(temporary, { recursive: true, force: true });
  }
  console.log(`[${phaseId}] verified six exact evidence roots at ${sourceRevision}`);
} else {
  const source = argument('--source');
  const timestamp = argument('--timestamp');
  if (!source || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(timestamp ?? '')) {
    throw new Error('TALE_TOKEN_PHASE_B_ARGUMENT_REQUIRED: --source <commit> and --timestamp <UTC-second>');
  }
  const sourceRevision = await git('rev-parse', source);
  await captureAt(repositoryRoot, sourceRevision, timestamp);
  console.log(`[${phaseId}] captured six exact evidence roots at ${sourceRevision}`);
}
