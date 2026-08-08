import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileCatalog } from '../../packages/catalog/src/compiler.mjs';
import {
  canonicalDigest,
  canonicalJson,
  parseJsonStrict,
} from '../../packages/schema/src/index.mjs';
import {
  parseDense,
  parseHuman,
} from '../../packages/tooling/src/renderers.mjs';
import { resolvePnpmProjectCatalog } from '../../packages/tooling/src/pnpm-adapter.mjs';
import {
  diagnoseCanonicalSource,
  explainRevisions,
  loadRepositoryAuthoringContext,
  scaffoldComponent,
} from '../../packages/tooling/src/authoring.mjs';
import { verifyEvidence } from '../../tooling/audits/repository-policy/src/evidence-verify.mjs';
import {
  isIgnoredRepositoryEntry,
} from '../../tooling/audits/repository-policy/src/policy.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const evidenceRoot = join(repositoryRoot, 'tests/evidence/gate-0');
const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const sourceTree = command('git', ['rev-parse', 'HEAD^{tree}']);
const captureTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
const captureProcedure = 'node tests/evidence/capture-gate-0.mjs';
const assertionId = 'E-GATE0-01';

function command(executable, args, options = {}) {
  return execFileSync(executable, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    ...options,
  }).trim();
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function writeCanonical(path, value) {
  await writeFile(path, canonicalJson(value));
}

async function manifestEntries(paths) {
  const entries = [];
  async function visit(relativePath) {
    const absolutePath = join(repositoryRoot, relativePath);
    const metadata = await stat(absolutePath);
    if (metadata.isDirectory()) {
      const children = await readdir(absolutePath);
      children.sort((left, right) => left.localeCompare(right));
      for (const child of children) {
        if (isIgnoredRepositoryEntry(child)) continue;
        await visit(join(relativePath, child));
      }
    } else if (metadata.isFile()) {
      entries.push({
        path: relativePath,
        sha256: sha256(await readFile(absolutePath)),
      });
    }
  }
  for (const path of paths) await visit(path);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function applicabilityManifest(paths) {
  return {
    algorithm: 'sha256',
    paths,
    profile: 'core-ui-path-manifest-v1',
    sha256: sha256(canonicalJson(await manifestEntries(paths))),
  };
}

function processCli(args, mode) {
  const modeArgs = mode === 'json' ? ['--json'] : mode === 'dense' ? ['--dense'] : [];
  const result = spawnSync(process.execPath, [
    join(repositoryRoot, 'packages/tooling/bin/core.mjs'),
    ...args,
    ...modeArgs,
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || result.stderr !== '') {
    throw new Error(`EVIDENCE_GATE0_CLI_FAILED: ${args[0]} ${mode}`);
  }
  const response = mode === 'json'
    ? parseJsonStrict(result.stdout)
    : mode === 'dense'
      ? parseDense(result.stdout)
      : parseHuman(result.stdout);
  return { output: result.stdout, response };
}

async function upstreamEvidence() {
  const milestones = ['g0.0', 'g0.1', 'g0.2', 'g0.3', 'g0.4', 'g0.5'];
  const values = [];
  for (const milestone of milestones) {
    const path = `tests/evidence/${milestone}/index.json`;
    const bytes = await readFile(join(repositoryRoot, path), 'utf8');
    const index = parseJsonStrict(bytes);
    values.push({
      milestone: index.milestone ?? milestone.toUpperCase(),
      path,
      sha256: sha256(bytes),
      sourceRevision: index.sourceRevision,
      sourceTree: index.sourceTree,
      assertions: index.records.map(({ assertionId: id, path: recordPath, sha256: digest }) => ({
        id,
        path: recordPath,
        sha256: digest,
      })),
      validation: index.validation ?? null,
    });
  }
  return values;
}

const environment = {
  architecture: process.arch,
  git: command('git', ['--version']).replace(/^git version /u, ''),
  node: process.version,
  pnpm: command('pnpm', ['--version']),
  runnerImage: `local-macos-${command('sw_vers', ['-productVersion'])}`,
  runnerImageVersion: command('sw_vers', ['-buildVersion']),
  runnerOs: `macOS ${command('sw_vers', ['-productVersion'])}`,
};

const priorEvidenceVerification = await verifyEvidence(repositoryRoot);
if (
  priorEvidenceVerification.indexCount !== 6
  || priorEvidenceVerification.recordCount !== 29
  || priorEvidenceVerification.artifactCount !== 29
  || priorEvidenceVerification.recertificationCount !== 4
) throw new Error('EVIDENCE_GATE0_UPSTREAM_SET_INCOMPLETE');

const compiled = await compileCatalog({ repositoryRoot });
const context = await loadRepositoryAuthoringContext({
  repositoryRoot,
  expectedSourceRevision: compiled.bundle.sourceRevision,
});
const componentArtifact = compiled.bundle.artifacts.find(
  ({ id }) => id === 'core:component:button',
);
if (!componentArtifact) throw new Error('EVIDENCE_GATE0_COMPONENT_MISSING');
const sourcePath = componentArtifact.source.record;
const sourceBytesBefore = await readFile(join(repositoryRoot, sourcePath), 'utf8');
const { schemaVersion: _schemaVersion, id: _id, kind: _kind, ...decisions } =
  componentArtifact.record;
const scaffold = scaffoldComponent({ slug: 'button', recordPath: sourcePath, decisions });
const validDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: scaffold.record,
  recordPath: sourcePath,
});
const brokenRecord = structuredClone(scaffold.record);
delete brokenRecord.summary;
const brokenDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: brokenRecord,
  recordPath: sourcePath,
});
const repairedRecord = structuredClone(brokenRecord);
repairedRecord.summary = scaffold.record.summary;
const repairedDiagnosis = diagnoseCanonicalSource({
  context,
  family: 'component',
  record: repairedRecord,
  recordPath: sourcePath,
});

const repeatedCompilation = await compileCatalog({ repositoryRoot });

const projectResolution = resolvePnpmProjectCatalog();
if (projectResolution.type !== 'success') {
  throw new Error(`EVIDENCE_GATE0_RESOLUTION_FAILED: ${projectResolution.error.code}`);
}
const api = projectResolution.api;
const operationCases = [
  {
    operation: 'manifest',
    args: ['manifest', '--detail', 'full'],
    response: api.getManifest({ detail: 'full' }),
  },
  {
    operation: 'list',
    args: ['list', '--detail', 'brief', '--limit', '1'],
    response: api.listArtifacts({
      cursor: null,
      detail: 'brief',
      kind: null,
      limit: 1,
      platform: null,
      purpose: null,
    }),
  },
  {
    operation: 'search',
    args: ['search', 'button', '--detail', 'brief', '--limit', '1'],
    response: api.searchArtifacts({
      cursor: null,
      detail: 'brief',
      limit: 1,
      platform: null,
      purpose: null,
      query: 'button',
    }),
  },
  {
    operation: 'get',
    args: ['get', componentArtifact.id, '--detail', 'full'],
    response: api.getArtifact({
      detail: 'full',
      id: componentArtifact.id,
      platform: null,
      purpose: null,
      section: null,
    }),
  },
];
const surfaceObservations = operationCases.map(({ operation, args, response }) => {
  const outputs = Object.fromEntries(['human', 'json', 'dense'].map((mode) => [
    mode,
    processCli(args, mode),
  ]));
  const responseBytes = canonicalJson(response);
  const roundTrips = Object.fromEntries(Object.entries(outputs).map(([mode, result]) => [
    mode,
    canonicalJson(result.response) === responseBytes,
  ]));
  if (!Object.values(roundTrips).every(Boolean)) {
    throw new Error(`EVIDENCE_GATE0_SURFACE_PARITY_FAILED: ${operation}`);
  }
  return {
    operation,
    responseType: response.type,
    responseDigest: canonicalDigest(response),
    authority: response.meta.resolution.authority,
    catalogSource: response.meta.resolution.catalogSource,
    compatibility: response.meta.resolution.compatibility,
    outputDigests: Object.fromEntries(Object.entries(outputs).map(([mode, result]) => [
      mode,
      sha256(result.output),
    ])),
    roundTrips,
  };
});

const examples = compiled.bundle.artifacts
  .filter(({ kind }) => kind === 'example')
  .map(({ record }) => record);
const tokenSources = compiled.bundle.artifacts
  .filter(({ kind }) => kind === 'token')
  .map(({ record }) => record);
const exampleSources = {};
for (const artifact of compiled.bundle.artifacts.filter(({ kind }) => kind === 'example')) {
  exampleSources[artifact.id] = await readFile(
    join(repositoryRoot, artifact.source.content),
    'utf8',
  );
}
const revisionExplanation = explainRevisions({
  family: 'component',
  record: scaffold.record,
  bindingId: 'web.react',
  examples,
  exampleSources,
  tokenSources,
});

const chainFailures = [
  ['canonical-source-valid', validDiagnosis.valid],
  ['deliberate-error-invalid', !brokenDiagnosis.valid],
  [
    'deliberate-error-path',
    brokenDiagnosis.diagnostics[0]?.details.source.path === '$/summary',
  ],
  [
    'deliberate-error-owner',
    brokenDiagnosis.diagnostics[0]?.details.owner.schemaPointer === '#/properties/summary',
  ],
  ['repair-valid', repairedDiagnosis.valid],
  ['repair-exact', canonicalJson(scaffold.record) === canonicalJson(repairedRecord)],
  [
    'repeated-source-revision',
    repeatedCompilation.bundle.sourceRevision === compiled.bundle.sourceRevision,
  ],
  [
    'repeated-catalog-digest',
    repeatedCompilation.bundle.catalogDigest === compiled.bundle.catalogDigest,
  ],
  ['repeated-byte-identity', repeatedCompilation.bytes === compiled.bytes],
  [
    'resolved-source-revision',
    projectResolution.package.sourceRevision === compiled.bundle.sourceRevision,
  ],
  [
    'resolved-catalog-digest',
    projectResolution.package.catalogDigest === compiled.bundle.catalogDigest,
  ],
  [
    'installed-local-authority',
    surfaceObservations.every(({ authority }) => authority === 'installed-local'),
  ],
  [
    'scaffold-semantic-source',
    canonicalJson(scaffold.record) === canonicalJson(parseJsonStrict(sourceBytesBefore)),
  ],
  [
    'source-bytes-unchanged',
    await readFile(join(repositoryRoot, sourcePath), 'utf8') === sourceBytesBefore,
  ],
].filter(([, passed]) => !passed).map(([name]) => name);
if (chainFailures.length > 0) {
  throw new Error(`EVIDENCE_GATE0_CHAIN_FAILED: ${chainFailures.join(', ')}`);
}

const upstream = await upstreamEvidence();
if (upstream.flatMap(({ assertions }) => assertions).length !== 29) {
  throw new Error('EVIDENCE_GATE0_UPSTREAM_ASSERTION_COUNT_MISMATCH');
}
const paths = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'packages/schema',
  'packages/catalog',
  'packages/tooling',
  'tooling/audits/repository-policy',
  'tests/evidence/capture-gate-0.mjs',
  'tests/evidence/g0.0',
  'tests/evidence/g0.1',
  'tests/evidence/g0.2',
  'tests/evidence/g0.3',
  'tests/evidence/g0.4',
  'tests/evidence/g0.5',
];
const manifest = await applicabilityManifest(paths);
const privacyPattern = /(?:\/(?:Users|home)\/|[A-Za-z]:\\|credential|password|token=|https?:\/\/[^\s"]+\?)/iu;
const observations = {
  chain: [
    { step: 'scaffold-canonical-source', mode: scaffold.mode, path: scaffold.recordPath },
    {
      step: 'validate-ownership-and-relations',
      valid: validDiagnosis.valid,
      artifactCount: compiled.bundle.artifacts.length,
      relationCount: compiled.bundle.relations.length,
    },
    {
      step: 'compile-deterministic-catalog',
      catalogDigest: compiled.bundle.catalogDigest,
      sourceRevision: compiled.bundle.sourceRevision,
      repeatedBytesEqual: repeatedCompilation.bytes === compiled.bytes,
    },
    {
      step: 'resolve-project-local-authority',
      authority: 'installed-local',
      catalogDigest: projectResolution.package.catalogDigest,
      catalogVersion: projectResolution.package.catalogVersion,
      sourceRevision: projectResolution.package.sourceRevision,
    },
    {
      step: 'manifest-list-search-get-api-cli',
      operations: surfaceObservations.map(({ operation }) => operation),
    },
    {
      step: 'render-human-json-dense-equivalently',
      equivalentOperationCount: surfaceObservations.length,
    },
    {
      step: 'explain-revisions-and-repair-source-error',
      revisionAxes: revisionExplanation.axes.map(({ name, digest, normalizedInputs }) => ({
        name,
        digest,
        normalizedInputDigest: canonicalDigest(normalizedInputs),
      })),
      diagnostic: brokenDiagnosis.diagnostics[0],
      repairedValid: repairedDiagnosis.valid,
    },
  ],
  sourceMutation: {
    attempted: false,
    sourceBytesChanged: false,
    projectionEdits: [],
  },
  surfaces: surfaceObservations,
  upstreamEvidence: {
    verifier: priorEvidenceVerification,
    assertionCount: 29,
    indexes: upstream,
  },
};
if (privacyPattern.test(canonicalJson(observations))) {
  throw new Error('EVIDENCE_GATE0_PRIVACY_SCAN_FAILED');
}

const rollbackOrDisable = {
  actions: [
    'Revert the exact Gate 0 integration capture and retained-evidence commits.',
    'Keep Gate 0 incomplete and retain failed or superseded evidence for diagnosis.',
    'Preserve all packages as private and prohibit publication.',
  ],
  packagePublication: 'prohibited',
  projectStatus: 'active',
};

async function writePacket(validation = null) {
  await Promise.all([
    mkdir(join(evidenceRoot, 'artifacts'), { recursive: true }),
    mkdir(join(evidenceRoot, 'records'), { recursive: true }),
    mkdir(join(evidenceRoot, 'validation'), { recursive: true }),
  ]);
  const artifactPath = join(evidenceRoot, `artifacts/${assertionId}.json`);
  await writeCanonical(artifactPath, {
    applicability: {
      applicabilityManifest: manifest,
      catalog: {
        artifactCount: compiled.bundle.artifacts.length,
        catalogDigest: compiled.bundle.catalogDigest,
        catalogVersion: compiled.bundle.catalogVersion,
        relationCount: compiled.bundle.relations.length,
        sourceRevision: compiled.bundle.sourceRevision,
      },
      upstreamIndexCount: upstream.length,
      upstreamAssertionCount: 29,
    },
    assertionId,
    captureTimestamp,
    command: captureProcedure,
    environment,
    evidenceKind: 'gate-0-uninterrupted-integration-transcript',
    executedRevision: sourceRevision,
    executedTree: sourceTree,
    exitState: 0,
    observations,
    outcome: 'pass',
    rollbackOrDisable,
    schema: 'core-ui-evidence-artifact-v1',
    sourceRevision,
    sourceTree,
  });
  const artifactReference = {
    path: `tests/evidence/gate-0/artifacts/${assertionId}.json`,
    sha256: sha256(await readFile(artifactPath)),
  };
  const recordPath = join(evidenceRoot, `records/${assertionId}.json`);
  await writeCanonical(recordPath, {
    activeExceptionRefs: [],
    advisoryRefs: [],
    applicability: {
      applicabilityManifest: manifest,
      catalogDigest: compiled.bundle.catalogDigest,
      catalogSourceRevision: compiled.bundle.sourceRevision,
      upstreamIndexes: upstream.map(({ milestone, path, sha256: digest }) => ({
        milestone,
        path,
        sha256: digest,
      })),
    },
    applicabilityManifest: manifest,
    artifact: artifactReference,
    assertionId,
    captureTimestamp,
    command: captureProcedure,
    disclosureClass: 'public-sanitized',
    environment,
    evidenceKind: 'gate-0-uninterrupted-integration-transcript',
    executedRevision: sourceRevision,
    executedTree: sourceTree,
    expiry: 'Any enforced applicability-manifest mismatch or change to retained Gate 0 evidence, canonical sources, schemas, compiler, resolver, API, CLI, renderers, authoring behavior, runtime tuple, or retained result bytes',
    milestone: 'Gate 0 exit',
    outcome: 'pass',
    owner: 'ndrewtran',
    retentionPolicy: 'Content-addressed Git objects retained by the Gate 0 integration pull request and default-branch history after merge; issue #8 is a mutable locator',
    rollbackOrDisable,
    schema: 'core-ui-evidence-record-v1',
    sourceRevision,
    sourceTree,
    ...(validation === null ? {} : { validation }),
  });
  const recordReference = {
    assertionId,
    path: `tests/evidence/gate-0/records/${assertionId}.json`,
    sha256: sha256(await readFile(recordPath)),
  };
  await writeCanonical(join(evidenceRoot, 'index.json'), {
    applicabilityManifest: manifest,
    captureTimestamp,
    disclosureClass: 'public-sanitized',
    milestone: 'Gate 0 exit',
    owner: 'ndrewtran',
    records: [recordReference],
    rollbackOrDisable,
    retentionPolicy: 'Content-addressed Git records retained by the Gate 0 integration pull request and default-branch history after merge; issue #8 is a mutable locator',
    schema: 'core-ui-evidence-index-v1',
    sourceRevision,
    sourceTree,
    ...(validation === null ? {} : { validation }),
  });
}

await writePacket();

async function validationResult(commandName, args, assertions) {
  const result = spawnSync('pnpm', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(`EVIDENCE_VALIDATION_COMMAND_FAILED: ${commandName}\n${output}`);
  }
  const observedAssertions = assertions.map(({ id, pattern }) => {
    const match = output.match(pattern);
    if (!match) throw new Error(`EVIDENCE_VALIDATION_ASSERTION_MISSING: ${id}`);
    return { id, value: match[1] ?? true };
  });
  const sanitizedOutput = output
    .replaceAll(repositoryRoot, '<repository-root>')
    .replace(/\/(?:private\/)?var\/folders\/[^\s)]+/gu, '<temporary-path>');
  if (/\/(?:Users|private\/var)\//u.test(sanitizedOutput)) {
    throw new Error(`EVIDENCE_VALIDATION_OUTPUT_UNSANITIZED: ${commandName}`);
  }
  const outputPath = `tests/evidence/gate-0/validation/${commandName
    .replaceAll(/[^a-z0-9]+/giu, '-')
    .replaceAll(/^-|-$/gu, '')}.txt`;
  await writeFile(join(repositoryRoot, outputPath), sanitizedOutput);
  return {
    command: commandName,
    exitState: 0,
    observedAssertions,
    rawOutput: {
      path: outputPath,
      sha256: sha256(sanitizedOutput),
    },
  };
}

const validationResults = [
  await validationResult('pnpm check', ['check'], [
    {
      id: 'evidence-index-count',
      pattern: /\[evidence\] verified (7 immutable index, 30 records, 30 artifacts, and 4 recertifications)/u,
    },
  ]),
  await validationResult('pnpm check:all', ['check:all'], [
    {
      id: 'evidence-index-count',
      pattern: /\[evidence\] verified (7 immutable index, 30 records, 30 artifacts, and 4 recertifications)/u,
    },
  ]),
  await validationResult('pnpm generate:check', ['generate:check'], [
    {
      id: 'generation-identity',
      pattern: /remained clean after two generation runs \((sha256:[a-f0-9]{64})\)/u,
    },
  ]),
  await validationResult('pnpm release:prepare', ['release:prepare'], [
    {
      id: 'release-boundary',
      pattern: /(Foundation checks passed; no publishable package or public release candidate exists\.)/u,
    },
    {
      id: 'generation-identity',
      pattern: /remained clean after two generation runs \((sha256:[a-f0-9]{64})\)/u,
    },
  ]),
];
const verificationPath = join(evidenceRoot, 'verification.json');
await writeCanonical(verificationPath, {
  captureProcedure,
  environment,
  results: validationResults,
  schema: 'core-ui-evidence-validation-v1',
  sourceRevision,
  sourceTree,
});
const validation = {
  path: 'tests/evidence/gate-0/verification.json',
  sha256: sha256(await readFile(verificationPath)),
};
await writePacket(validation);

console.log(`[evidence] captured Gate 0 integration at ${sourceRevision}`);
