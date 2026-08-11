import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalDigest, canonicalJson, parseJsonStrict } from '../../packages/schema/src/index.mjs';
import { isIgnoredRepositoryEntry, sha256 } from '../../tooling/audits/repository-policy/src/policy.mjs';

export const DEFAULT_THEME_G1_ROOT = 'tests/evidence/default-theme-g1.0';
export const DEFAULT_THEME_G1_PROFILE_SCHEMA = 'core-ui-default-theme-g1.0-evidence-profile-v1';
export const DEFAULT_THEME_G1_PRODUCT_SOURCE = Object.freeze({
  revision: 'f27b8a7ff43d08e2febc3fe5803ffa99377be773',
  tree: 'eb7432f20e4c57c3a86c298d0d838097a4beb3bd',
});
export const DEFAULT_THEME_G1_ASSERTION_IDS = Object.freeze([
  'E-G1.0-01',
  'E-G1.0-02',
  'E-G1.0-03',
  'E-G1.0-04',
  'E-G1.0-05',
  'E-G1.0-06',
  'E-G1.0-07',
  'E-G1.0-08',
]);
export const DEFAULT_THEME_G1_PROOF_TOOL_FILES = Object.freeze([
  'tests/evidence/capture-default-theme-g1.0.mjs',
  'tests/evidence/default-theme-g1.0-profile.mjs',
  'tests/evidence/default-theme-g1.0-profile.test.mjs',
]);
export const DEFAULT_THEME_G1_EXECUTION_PARENT = '347cf26492f39b1302a13095d8d5d875d0abb9f4';
export const DEFAULT_THEME_G1_DISCLOSURE_CLASS = 'public-sanitized';
export const DEFAULT_THEME_G1_RETENTION_POLICY = 'Content-addressed Git records retained by issue #46 pull-request and default-branch history after merge; issue #46 is a mutable locator';
export const DEFAULT_THEME_G1_EXPIRY = 'Any accepted product source, execution tool, Phase C acceptance, six-root binding, applicability manifest, environment tuple, retained result, or later G1.0 withdrawal, rejection, or accepted-digest mismatch';
export const DEFAULT_THEME_G1_EVIDENCE_KINDS = Object.freeze({
  'E-G1.0-01': 'token-graph-denial-corpus',
  'E-G1.0-02': 'cross-target-transform-provenance-audit',
  'E-G1.0-03': 'profile-exact-fallback-denial-fixture',
  'E-G1.0-04': 'requirement-and-packed-compatibility-closure',
  'E-G1.0-05': 'foundation-portability-boundary',
  'E-G1.0-06': 'static-theme-mode-and-runtime-denial',
  'E-G1.0-07': 'platform-safety-closure-and-negative-corpus',
  'E-G1.0-08': 'source-crosswalk-closure-and-negative-corpus',
});
export const DEFAULT_THEME_G1_ACCEPTANCE = Object.freeze({
  acceptedPacket: Object.freeze({
    id: 'default-theme-phase-c-acceptance-v1',
    sha256: 'sha256:99658a577545383945dd5d9ac27a0a0ecc9d58b1196eb38b976337857c65b980',
  }),
  authorAssociation: 'OWNER',
  bodySha256: 'sha256:00378fa18475d83024c9d6d5403ac9c50f3895e5977a67c815e1c3db4e772cf0',
  commentId: 5248490977,
  commentNodeId: 'IC_kwDOTtLjcM8AAAABONWd4Q',
  createdAt: '2026-08-11T02:59:26Z',
  decisionOwner: 'ndrewtran',
  outcome: 'accepted',
  ownerNodeId: 'MDQ6VXNlcjc0MzE0OTg0',
  provider: 'github',
  pullRequestNumber: 51,
  repository: 'ndrewtran/core-ui',
  updatedAt: '2026-08-11T02:59:26Z',
  url: 'https://github.com/ndrewtran/core-ui/pull/51#issuecomment-5248490977',
});
export const DEFAULT_THEME_G1_PHASE_C_ROOTS = Object.freeze([
  Object.freeze({
    path: 'tests/evidence/tale-token-phase-c-g0.1/index.json',
    sha256: 'sha256:8888b5d8000227ab90769a0c662edffc210dafa6d38edd95c9a259a9b681558d',
  }),
  Object.freeze({
    path: 'tests/evidence/tale-token-phase-c-g0.2/index.json',
    sha256: 'sha256:cf56ca5f67d4b2d4ead638d32a9e21bf3abea1b10150568f3f953c66a2917e7f',
  }),
  Object.freeze({
    path: 'tests/evidence/tale-token-phase-c-g0.3/index.json',
    sha256: 'sha256:7e96e9505bdb5018bcf3a4ef5c045d6d87266c79eb528ed9509ec6c6e848ad57',
  }),
  Object.freeze({
    path: 'tests/evidence/tale-token-phase-c-g0.4/index.json',
    sha256: 'sha256:70a90a581534c6b05a0831f829f436ffcfea938fa1e984b3dc9c6800432a3c11',
  }),
  Object.freeze({
    path: 'tests/evidence/tale-token-phase-c-g0.5/index.json',
    sha256: 'sha256:ae02c73bb034331b6938488d488783469b183039f7adc53ae33956c499fdfcfa',
  }),
  Object.freeze({
    path: 'tests/evidence/tale-token-phase-c-gate-0/index.json',
    sha256: 'sha256:3521009caffc21e9a7f7d6dbd024780623717e9854c19637e1305b7a490a3a46',
  }),
]);
export const DEFAULT_THEME_G1_MAINTENANCE_CONTEXT = Object.freeze({
  path: 'tests/evidence/authority-46-phase-c-applicability/index.json',
  role: 'non-proof fourteen-successor integrity topology',
  sha256: 'sha256:b802ff4469c120b2edbde102780d8657cfdba90408e8337db0575c0c7ee1a7ed',
});
export const DEFAULT_THEME_G1_APPLICABILITY_PATHS = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'catalog',
  'decisions/0003-tale-token-classification-annex.json',
  'decisions/0003-tale-token-classification-acceptance.json',
  'decisions/0004-tale-only-reference-baseline-annex.json',
  'decisions/0004-tale-only-reference-baseline-acceptance.json',
  'decisions/0005-default-theme-token-source-identity.json',
  'decisions/0005-default-theme-token-source-identity-acceptance.json',
  'decisions/0006-phase-c-applicability-topology.json',
  'decisions/0006-phase-c-applicability-topology-acceptance.json',
  'strategy/platform-safety-contract.json',
  'strategy/monorepo-architecture.md',
  'strategy/milestone-roadmap.md',
  'strategy/product-scope.md',
  'packages/schema',
  'packages/catalog',
  'packages/tooling',
  'packages/tokens',
  'packages/foundation',
  'packages/web',
  'packages/react',
  'tooling/audits/repository-policy',
  'tests/fixtures/g0.4',
  'tests/fixtures/g1.0',
  'tests/fixtures/tale-token-classification',
  'tests/fixtures/tale-token-phase-b',
]);
export const DEFAULT_THEME_G1_APPLICABILITY_MANIFEST = Object.freeze({
  algorithm: 'sha256',
  paths: DEFAULT_THEME_G1_APPLICABILITY_PATHS,
  profile: 'core-ui-path-manifest-v1',
  sha256: 'sha256:6183881420791463b2f415fb399c75207c4316f9632b6b25c6dae92c3659290a',
});
export const DEFAULT_THEME_G1_EXPECTED_TEST_NAMES = Object.freeze({
  'E-G1.0-01': Object.freeze([
    'E-G1.0-01 rejects cycles, reverse layers, incompatible units, and overrides',
    'DEFAULT-THEME-G1.0 observes the separate literal unit denial',
  ]),
  'E-G1.0-02': Object.freeze([
    'E-G1.0-02 web and native transforms retain canonical provenance without cross-target authority',
    'Decision 0005 changes only renderer source and provenance identity',
    'DEFAULT-THEME-G1.0 rejects direct reference consumption in component recipes',
  ]),
  'E-G1.0-03': Object.freeze([
    'E-G1.0-03 missing required tokens fail per profile and exact proved fallbacks diagnose use',
    'DEFAULT-THEME-G1.0 rejects unproved and incompatible fallbacks',
  ]),
  'E-G1.0-04': Object.freeze([
    'E-G1.0-04 requirement digests track exact semantic closure only',
    'E-G1.0-04 catalog exposes resolved requirement sets matching packed descriptors',
    'E-G1.0-04 test pack projection binds catalog, descriptors, and release maps',
    'E-G1.0-04 query validation rejects open fallback and dependency closure facts',
    'DEFAULT-THEME-G1.0 rejects independent catalog descriptor and release drift',
  ]),
  'E-G1.0-05': Object.freeze([
    'E-G1.0-05 foundation is semantic plus pure logic with interaction honestly absent',
  ]),
  'E-G1.0-06': Object.freeze([
    'E-G1.0-06 static mode output works while runtime switching remains unavailable',
    'DEFAULT-THEME-G1.0 rejects runtime-source drift and undeclared compiler options',
  ]),
  'E-G1.0-07': Object.freeze([
    'E-G1.0-07 catalog and package expose exact platform-safety set digests',
    'E-G1.0-07 compiles closed binding-owned requirement sets without behavior claims',
    'E-G1.0-07 rejects unknown, missing, duplicate, and wrong-profile declarations',
    'E-G1.0-07 unsupported top-level bindings retain a complete declaration and digest',
    'E-G1.0-07 rejects consumer weakening and premature fulfillment',
    'DEFAULT-THEME-G1.0 observes exact binding revisions and the complete RNW disposition',
  ]),
  'E-G1.0-08': Object.freeze([
    'TALE-TOKEN-C materializes the accepted 312-token source and exact crosswalk',
    'TALE-TOKEN-C applies the accepted default-theme artifact identity without changing tokens',
    'TALE-TOKEN-C occurrence projection is exact, ordered, and media-free',
    'TALE-TOKEN-C current source is an independently verified final idempotent result',
    'TALE-TOKEN-C rejects base, target, meaning, collision, and final near-match drift',
    'TALE-TOKEN-C source-crosswalk validation binds coverage, reference targets, groups, and digest',
  ]),
});
export const DEFAULT_THEME_G1_VALIDATION_COMMANDS = Object.freeze([
  'node --test tests/evidence/default-theme-g1.0-profile.test.mjs',
  'node --test packages/tokens/test/token-contract.test.mjs packages/tokens/test/tale-token-materialization.test.mjs packages/schema/test/platform-safety.test.mjs packages/catalog/test/catalog-package.test.mjs packages/foundation/test/foundation-boundary.test.mjs',
  'pnpm --filter @core-ui/schema check',
  'pnpm --filter @core-ui/catalog check',
  'pnpm --filter @core-ui/tokens check',
  'pnpm --filter @core-ui/foundation check',
  'pnpm --filter @core-ui/tooling check',
  'pnpm --filter @core-ui/web check',
  'pnpm --filter @core-ui/react check',
  'pnpm generate:check',
  'pnpm test:agent',
  'pnpm release:prepare',
  'node tooling/audits/repository-policy/src/evidence-verify.mjs',
  'pnpm check',
  'pnpm check:all',
]);
export const DEFAULT_THEME_G1_RESULT_KEYS = Object.freeze([
  'profile', 'focused', 'schema', 'catalog', 'tokens', 'foundation', 'tooling',
  'web', 'react', 'generation', 'agent', 'release', 'evidence', 'check', 'check-all',
]);
const profileCommand = DEFAULT_THEME_G1_VALIDATION_COMMANDS[0];
const focusedCommand = DEFAULT_THEME_G1_VALIDATION_COMMANDS[1];
export const DEFAULT_THEME_G1_RETAINED_COMMANDS = Object.freeze(Object.fromEntries(
  DEFAULT_THEME_G1_ASSERTION_IDS.map((assertionId) => [assertionId, Object.freeze([
    profileCommand,
    focusedCommand,
    ...(
      ['E-G1.0-01', 'E-G1.0-02', 'E-G1.0-03', 'E-G1.0-06', 'E-G1.0-08'].includes(assertionId)
        ? ['pnpm --filter @core-ui/tokens check']
        : []
    ),
    ...(assertionId === 'E-G1.0-04' ? ['pnpm --filter @core-ui/catalog check'] : []),
    ...(assertionId === 'E-G1.0-05' ? ['pnpm --filter @core-ui/foundation check'] : []),
    ...(assertionId === 'E-G1.0-07' ? [
      'pnpm --filter @core-ui/schema check',
      'pnpm --filter @core-ui/catalog check',
    ] : []),
  ])]),
));
export const DEFAULT_THEME_G1_EXPECTED_FACTS = Object.freeze({
  'E-G1.0-01': Object.freeze({
    denialCodes: Object.freeze([
      'CORE_TOKEN_ALIAS_CYCLE',
      'CORE_TOKEN_LAYER_DIRECTION',
      'CORE_TOKEN_TYPE_MISMATCH',
      'CORE_TOKEN_UNIT_MISMATCH',
      'CORE_TOKEN_OVERRIDE_UNAUTHORIZED',
    ]),
    layers: Object.freeze({ component: 5, reference: 296, semantic: 11 }),
    sourceId: 'core:token:default-theme',
    sourceRevision: 'sha256:01982f878f3f4b29bf889fcc0cc9577e1bde3fb69a646f1972e74dd8b9347757',
    tokenContractVersion: '2.0.0',
    tokenCount: 312,
  }),
  'E-G1.0-02': Object.freeze({
    directReferenceConsumption: 'denied',
    native: Object.freeze({ css: false, profiles: Object.freeze(['native.ios', 'native.android']), tokenCount: 312 }),
    reactStylesheetOwner: '@core-ui/web',
    rnw: 'unsupported',
    sourceRevision: 'sha256:01982f878f3f4b29bf889fcc0cc9577e1bde3fb69a646f1972e74dd8b9347757',
    webReferenceCount: 296,
    webStylesheetSha256: 'sha256:9d02905252d915d2aa12ecfa8d269a59f6296240fc2a64e50c2e300382beedd2',
  }),
  'E-G1.0-03': Object.freeze({
    fallbackDiagnostic: 'CORE_TOKEN_FALLBACK_USED',
    fallbackDenials: Object.freeze(['CORE_TOKEN_FALLBACK_UNPROVED', 'CORE_TOKEN_FALLBACK_INVALID']),
    profiles: Object.freeze(['web.html', 'web.react', 'native.ios', 'native.android']),
    requiredMissing: 'CORE_TOKEN_REQUIRED_MISSING',
  }),
  'E-G1.0-04': Object.freeze({
    catalogDigest: 'sha256:0fef5d4d60ba03b9bcdc64ac04acb5253eff17f0aad1e71df4f12f7e0907ebe7',
    catalogVersion: '2.0.0',
    driftDenial: 'G1_0_PACKED_COMPATIBILITY_INVALID',
    packageSchema: 'core-ui-catalog-package-v2',
    packageVersion: '2.0.0',
    queryApiVersion: '2.0.0',
    sourceRevision: 'sha256:579decd13cd6440e7ecf520d6318f5ba5222fb45943d76c1f6705d1fc5d071eb',
    supportedQueryApiVersions: Object.freeze(['1.1.0', '1.2.0', '2.0.0']),
    testPackClassification: 'test-only-synthetic-pack-input',
    tokenRequirementSetDigests: Object.freeze({
      'native.react-native:native.android': 'sha256:78598adeb18b3c3931578e12819a56264a9d1d76afc05d4bf2778adda52f9513',
      'native.react-native:native.ios': 'sha256:994281d2f9a88064469eb311b4f79426a74186ab8c9c31f96ca7c8ef5e45c560',
      'web.html:web.html': 'sha256:1e87a30d8d33853cf7ce2e2d08e5a8eaed08dbf8567fddc09d5e00178818d847',
      'web.react:web.react': 'sha256:0c47bd2103d1f5596dfcd33c56bbd3da431cfd03e3faae93d7972d4f0329ff86',
    }),
  }),
  'E-G1.0-05': Object.freeze({
    exports: Object.freeze(['./logic', './semantic']),
    forbiddenInputs: Object.freeze(['document', 'window', 'navigator', 'react', 'selector', 'UIView', 'android.view']),
    interactionAvailability: 'unproved-absent',
    logicImports: './semantic',
    semanticImports: 'none',
  }),
  'E-G1.0-06': Object.freeze({
    denialCodes: Object.freeze(['CORE_SCHEMA_INVALID', 'CORE_TOKEN_OPTIONS_INVALID']),
    modes: Object.freeze({
      dark: Object.freeze({ colorScheme: 'dark', contrast: 'standard', density: 'comfortable', direction: 'ltr', motion: 'full' }),
      default: Object.freeze({ colorScheme: 'light', contrast: 'standard', density: 'comfortable', direction: 'ltr', motion: 'full' }),
      reduced: Object.freeze({ colorScheme: 'light', contrast: 'standard', density: 'comfortable', direction: 'ltr', motion: 'reduced' }),
    }),
    runtimeSwitching: false,
    sourceAvailability: 'unavailable',
  }),
  'E-G1.0-07': Object.freeze({
    bindingSpecRevisions: Object.freeze({
      'native.react-native': 'sha256:589c901a1ae6d09bcd5606d16bf93f6ba29291d58e4ef6dbb82383692bede2f6',
      'web.html': 'sha256:15e31198000068d6dd2cece6a40a14f036c22368c6f058a2616340f6d78391b0',
      'web.react': 'sha256:8d37bc27dcdf3d71b8662514f4178308a057770e68003299c06218a840dcc011',
    }),
    contractDigest: 'sha256:4ce80ab4d5ee2ebd9db45265b0ab9e5ce56dc18f3c59f17548bc680648705d97',
    contractVersion: '1.0.0',
    denialCodes: Object.freeze([
      'CORE_PLATFORM_SAFETY_REQUIREMENT_UNKNOWN',
      'CORE_PLATFORM_SAFETY_REQUIREMENT_MISSING',
      'CORE_PLATFORM_SAFETY_REQUIREMENT_DUPLICATE',
      'CORE_PLATFORM_SAFETY_DECLARATION_MISSING',
      'CORE_PLATFORM_SAFETY_DECLARATION_DUPLICATE',
      'CORE_PLATFORM_SAFETY_PROFILE_INVALID',
      'CORE_PLATFORM_SAFETY_CONSUMER_WEAKENED',
      'CORE_PLATFORM_SAFETY_PREMATURE_FULFILLMENT',
    ]),
    nonClaims: Object.freeze(['css-native-adaptation', 'behavior', 'accessibility', 'support', 'availability']),
    platformSafetyRequirementSetDigests: Object.freeze({
      'native.react-native:android': 'sha256:9c98f1329080b3f9f554d1a0e10a04fb6d865f23fc1b0208c31f5edcb8c74401',
      'native.react-native:ios': 'sha256:04a803108288a2b341f48e5b8a6bbc04e4592518cc537bf2e95c6cf6764f4105',
      'native.react-native:native.react-native-web': 'sha256:4325d1ac906c4ac90d1fe561b46b9915c59a1ebf43b8d17e906de143fc47eb09',
      'web.html:web.html': 'sha256:472c0ffe34597ba24cafd0bef70c71ecb8d137f08b89193d8571fb51629d05cf',
      'web.react:web.react': 'sha256:b0c2e637ab584e4fe1ef895e050bd0bc2ad79c587e8ed8c5795428fe98f4ef25',
    }),
    rnwDispositions: 'all-reasoned-not-applicable',
  }),
  'E-G1.0-08': Object.freeze({
    admittedReferenceCount: 296,
    crosswalkDigest: 'sha256:7835e06c02297e667b4fd2cf9076d5c604de5a37bb64a7d587b4a0fa7cd5e45e',
    dispositions: Object.freeze({ adapt: 95, adopt: 209, defer: 328, reject: 61 }),
    emittedCoreFactCount: 312,
    entryCount: 693,
    groupCount: 41,
    occurrenceProvenance: 'generated-and-ordered',
    rnwRuntimeClaim: 'none',
  }),
});

export function defaultThemeG1CaptureProcedure({
  sourceRevision, sourceTree, executedRevision, executedTree, timestamp: captureTimestamp,
}) {
  return [
    'node tests/evidence/capture-default-theme-g1.0.mjs',
    `--source ${sourceRevision}`,
    `--tree ${sourceTree}`,
    `--executed ${executedRevision}`,
    `--executed-tree ${executedTree}`,
    `--timestamp ${captureTimestamp}`,
  ].join(' ');
}

const shaReference = /^sha256:[0-9a-f]{64}$/u;
const gitObject = /^[0-9a-f]{40}$/u;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const exactKeys = (value, keys) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort())
);

function defaultFail(message) {
  throw new Error(`DEFAULT_THEME_G1_PROFILE_INVALID: ${message}`);
}

export function assertDefaultThemeG1ExecutionTopology({ changes, parents, revision, tree }, fail = defaultFail) {
  const expectedChanges = DEFAULT_THEME_G1_PROOF_TOOL_FILES.map((path) => `A\t${path}`);
  if (
    !gitObject.test(revision)
    || !gitObject.test(tree)
    || canonicalJson(parents) !== canonicalJson([DEFAULT_THEME_G1_EXECUTION_PARENT])
    || canonicalJson(changes) !== canonicalJson(expectedChanges)
  ) fail('execution must be one exact three-file child of the accepted merged main');
  return { revision, tree };
}

export function assertDefaultThemeG1ExecutionFiles({ committedDigests, currentDigests, references }, fail = defaultFail) {
  for (const reference of references) {
    if (
      committedDigests[reference.path] !== reference.sha256
      || currentDigests[reference.path] !== reference.sha256
    ) fail(`${reference.path} does not match retained and current proof-tool bytes`);
  }
  return references;
}

export function assertDefaultThemeG1EvidenceMetadata({
  artifact, assertionId, environment, expectedRetainedResults, record,
}, fail = defaultFail) {
  const command = DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId]?.join(' && ');
  if (
    record.command !== command
    || artifact.command !== command
    || record.evidenceKind !== DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId]
    || artifact.evidenceKind !== DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId]
    || canonicalJson(record.environment) !== canonicalJson(environment)
    || canonicalJson(artifact.environment) !== canonicalJson(environment)
    || record.retentionPolicy !== DEFAULT_THEME_G1_RETENTION_POLICY
    || record.expiry !== DEFAULT_THEME_G1_EXPIRY
    || canonicalJson(artifact.observations.retainedResults) !== canonicalJson(expectedRetainedResults)
  ) fail(`${assertionId} procedure, environment, ontology, retention, or result relation is invalid`);
  return { artifact, record };
}

export function createDefaultThemeG1Profile({ executedRevision, executedTree, toolFiles }) {
  return {
    acceptance: DEFAULT_THEME_G1_ACCEPTANCE,
    applicabilityManifest: DEFAULT_THEME_G1_APPLICABILITY_MANIFEST,
    assertionIds: DEFAULT_THEME_G1_ASSERTION_IDS,
    execution: { files: toolFiles, revision: executedRevision, tree: executedTree },
    id: 'DEFAULT-THEME-G1.0',
    maintenanceContext: DEFAULT_THEME_G1_MAINTENANCE_CONTEXT,
    productSource: DEFAULT_THEME_G1_PRODUCT_SOURCE,
    schema: DEFAULT_THEME_G1_PROFILE_SCHEMA,
    upstreamPhaseCRoots: DEFAULT_THEME_G1_PHASE_C_ROOTS,
  };
}

export function assertDefaultThemeG1Profile(value, fail = defaultFail) {
  if (!exactKeys(value, [
    'acceptance', 'applicabilityManifest', 'assertionIds', 'execution', 'id',
    'maintenanceContext', 'productSource', 'schema', 'upstreamPhaseCRoots',
  ])) fail('profile keys must be exact');
  if (
    canonicalJson(value.acceptance) !== canonicalJson(DEFAULT_THEME_G1_ACCEPTANCE)
    || canonicalJson(value.applicabilityManifest) !== canonicalJson(DEFAULT_THEME_G1_APPLICABILITY_MANIFEST)
    || canonicalJson(value.assertionIds) !== canonicalJson(DEFAULT_THEME_G1_ASSERTION_IDS)
    || value.id !== 'DEFAULT-THEME-G1.0'
    || canonicalJson(value.maintenanceContext) !== canonicalJson(DEFAULT_THEME_G1_MAINTENANCE_CONTEXT)
    || canonicalJson(value.productSource) !== canonicalJson(DEFAULT_THEME_G1_PRODUCT_SOURCE)
    || value.schema !== DEFAULT_THEME_G1_PROFILE_SCHEMA
    || canonicalJson(value.upstreamPhaseCRoots) !== canonicalJson(DEFAULT_THEME_G1_PHASE_C_ROOTS)
  ) fail('profile fixed identity does not match');
  if (!exactKeys(value.execution, ['files', 'revision', 'tree'])) {
    fail('execution keys must be exact');
  }
  if (!gitObject.test(value.execution.revision) || !gitObject.test(value.execution.tree)) {
    fail('execution revision and tree must be full Git object IDs');
  }
  if (
    !Array.isArray(value.execution.files)
    || value.execution.files.length !== DEFAULT_THEME_G1_PROOF_TOOL_FILES.length
    || canonicalJson(value.execution.files.map(({ path }) => path))
      !== canonicalJson(DEFAULT_THEME_G1_PROOF_TOOL_FILES)
    || value.execution.files.some((reference) => (
      !exactKeys(reference, ['path', 'sha256']) || !shaReference.test(reference.sha256)
    ))
  ) fail('execution files must bind the exact proof-tool paths and digests');
  return value;
}

function assertReference(reference, expectedPath, fail) {
  if (
    !exactKeys(reference, ['path', 'sha256'])
    || reference.path !== expectedPath
    || !shaReference.test(reference.sha256)
  ) fail(`${expectedPath} reference is invalid`);
}

export function assertDefaultThemeG1IndexShape(index, fail = defaultFail) {
  if (!exactKeys(index, [
    'applicabilityManifest', 'applicabilityProfile', 'captureTimestamp', 'disclosureClass',
    'executedRevision', 'executedTree', 'milestone', 'owner', 'records',
    'recertifications', 'retentionPolicy', 'schema', 'sourceRevision', 'sourceTree',
    'supersessions', 'validation',
  ])) fail('index keys must be exact');
  assertDefaultThemeG1Profile(index.applicabilityProfile, fail);
  if (
    canonicalJson(index.applicabilityManifest) !== canonicalJson(DEFAULT_THEME_G1_APPLICABILITY_MANIFEST)
    || index.sourceRevision !== DEFAULT_THEME_G1_PRODUCT_SOURCE.revision
    || index.sourceTree !== DEFAULT_THEME_G1_PRODUCT_SOURCE.tree
    || index.executedRevision !== index.applicabilityProfile.execution.revision
    || index.executedTree !== index.applicabilityProfile.execution.tree
    || !timestamp.test(index.captureTimestamp)
    || index.captureTimestamp < DEFAULT_THEME_G1_ACCEPTANCE.updatedAt
    || index.disclosureClass !== DEFAULT_THEME_G1_DISCLOSURE_CLASS
    || index.milestone !== 'G1.0'
    || index.owner !== 'ndrewtran'
    || index.schema !== 'core-ui-evidence-index-v1'
    || !Array.isArray(index.recertifications)
    || index.recertifications.length !== 0
    || !Array.isArray(index.supersessions)
    || index.supersessions.length !== 0
    || index.retentionPolicy !== DEFAULT_THEME_G1_RETENTION_POLICY
  ) fail('index identity or topology is invalid');
  if (
    !Array.isArray(index.records)
    || canonicalJson(index.records.map(({ assertionId }) => assertionId))
      !== canonicalJson(DEFAULT_THEME_G1_ASSERTION_IDS)
  ) fail('index must bind eight exact ordered assertion IDs');
  for (const [position, assertionId] of DEFAULT_THEME_G1_ASSERTION_IDS.entries()) {
    const reference = index.records[position];
    if (
      !exactKeys(reference, ['assertionId', 'path', 'sha256'])
      || reference.path !== `${DEFAULT_THEME_G1_ROOT}/records/${assertionId}.json`
      || !shaReference.test(reference.sha256)
      || reference.assertionId !== assertionId
    ) {
      fail(`${assertionId} record reference must own its assertion ID`);
    }
  }
  assertReference(index.validation, `${DEFAULT_THEME_G1_ROOT}/validation.json`, fail);
  return index;
}

async function readCanonicalJson(repositoryRoot, relativePath) {
  const bytes = await readFile(join(repositoryRoot, relativePath), 'utf8');
  const value = parseJsonStrict(bytes);
  if (bytes !== canonicalJson(value)) defaultFail(`${relativePath} is not canonical JSON`);
  return { bytes, value };
}

async function verifyReference(repositoryRoot, reference) {
  const result = await readCanonicalJson(repositoryRoot, reference.path);
  if (`sha256:${sha256(result.bytes)}` !== reference.sha256) {
    defaultFail(`${reference.path} digest does not match`);
  }
  return result.value;
}

function git(repositoryRoot, ...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

export async function manifestEntries(repositoryRoot, declaredPaths) {
  const entries = [];
  async function visit(relativePath) {
    const absolutePath = join(repositoryRoot, relativePath);
    const metadata = await stat(absolutePath);
    if (metadata.isDirectory()) {
      for (const child of (await readdir(absolutePath)).sort((left, right) => left.localeCompare(right))) {
        if (!isIgnoredRepositoryEntry(child)) await visit(join(relativePath, child));
      }
      return;
    }
    entries.push({ path: relativePath, sha256: `sha256:${sha256(await readFile(absolutePath))}` });
  }
  for (const path of declaredPaths) await visit(path);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function manifestEntriesAtRevision(repositoryRoot, revision, declaredPaths) {
  const names = git(repositoryRoot, 'ls-tree', '-r', '--name-only', revision, '--', ...declaredPaths)
    .split('\n').filter(Boolean).sort((left, right) => left.localeCompare(right));
  return names.map((path) => ({
    path,
    sha256: `sha256:${sha256(execFileSync('git', ['show', `${revision}:${path}`], {
      cwd: repositoryRoot,
    }))}`,
  }));
}

export async function assertDefaultThemeG1Root(repositoryRootInput) {
  const repositoryRoot = resolve(repositoryRootInput);
  const index = (await readCanonicalJson(repositoryRoot, `${DEFAULT_THEME_G1_ROOT}/index.json`)).value;
  assertDefaultThemeG1IndexShape(index);
  if (
    git(repositoryRoot, 'rev-parse', `${index.sourceRevision}^{tree}`) !== index.sourceTree
    || git(repositoryRoot, 'rev-parse', `${index.executedRevision}^{tree}`) !== index.executedTree
  ) defaultFail('source or execution Git tree does not match');
  const revisionLine = git(repositoryRoot, 'rev-list', '--parents', '-n', '1', index.executedRevision)
    .split(' ');
  const changes = git(
    repositoryRoot,
    'diff-tree', '--no-commit-id', '--name-status', '-r', index.executedRevision,
  ).split('\n').filter(Boolean);
  assertDefaultThemeG1ExecutionTopology({
    changes,
    parents: revisionLine.slice(1),
    revision: revisionLine[0],
    tree: index.executedTree,
  });
  const productEntries = manifestEntriesAtRevision(
    repositoryRoot,
    index.sourceRevision,
    DEFAULT_THEME_G1_APPLICABILITY_PATHS,
  );
  if (
    productEntries.length !== 192
    || Buffer.byteLength(canonicalJson(productEntries)) !== 26878
    || `sha256:${sha256(canonicalJson(productEntries))}`
      !== DEFAULT_THEME_G1_APPLICABILITY_MANIFEST.sha256
  ) defaultFail('product applicability preimage does not match');
  const currentEntries = await manifestEntries(repositoryRoot, DEFAULT_THEME_G1_APPLICABILITY_PATHS);
  if (canonicalJson(currentEntries) !== canonicalJson(productEntries)) {
    defaultFail('executed checkout has product-source applicability drift');
  }
  const committedDigests = {};
  const currentDigests = {};
  for (const reference of index.applicabilityProfile.execution.files) {
    const committed = execFileSync('git', ['show', `${index.executedRevision}:${reference.path}`], {
      cwd: repositoryRoot,
    });
    committedDigests[reference.path] = `sha256:${sha256(committed)}`;
    const current = await readFile(join(repositoryRoot, reference.path));
    currentDigests[reference.path] = `sha256:${sha256(current)}`;
  }
  assertDefaultThemeG1ExecutionFiles({
    committedDigests,
    currentDigests,
    references: index.applicabilityProfile.execution.files,
  });
  for (const reference of [
    ...DEFAULT_THEME_G1_PHASE_C_ROOTS,
    DEFAULT_THEME_G1_MAINTENANCE_CONTEXT,
  ]) {
    const bytes = await readFile(join(repositoryRoot, reference.path));
    if (`sha256:${sha256(bytes)}` !== reference.sha256) {
      defaultFail(`${reference.path} does not match accepted Phase C`);
    }
  }
  const validation = await verifyReference(repositoryRoot, index.validation);
  if (!exactKeys(validation, [
    'applicabilityProfile', 'captureProcedure', 'environment', 'executedRevision',
    'executedTree', 'results', 'schema', 'sourceRevision', 'sourceTree',
  ])) defaultFail('validation keys must be exact');
  if (
    canonicalJson(validation.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
    || validation.sourceRevision !== index.sourceRevision
    || validation.sourceTree !== index.sourceTree
    || validation.executedRevision !== index.executedRevision
    || validation.executedTree !== index.executedTree
    || validation.captureProcedure !== defaultThemeG1CaptureProcedure({
      sourceRevision: index.sourceRevision,
      sourceTree: index.sourceTree,
      executedRevision: index.executedRevision,
      executedTree: index.executedTree,
      timestamp: index.captureTimestamp,
    })
    || validation.schema !== 'core-ui-evidence-validation-v1'
    || !exactKeys(validation.environment, [
      'architecture', 'git', 'node', 'pnpm', 'runnerImage', 'runnerImageVersion', 'runnerOs',
    ])
    || Object.values(validation.environment).some((value) => typeof value !== 'string' || value.length === 0)
    || !Array.isArray(validation.results)
    || validation.results.length !== 15
    || canonicalJson(validation.results.map(({ command }) => command))
      !== canonicalJson(DEFAULT_THEME_G1_VALIDATION_COMMANDS)
  ) defaultFail('validation identity or exact result count is invalid');
  for (const [position, result] of validation.results.entries()) {
    if (
      !exactKeys(result, ['command', 'exitState', 'rawOutput'])
      || result.exitState !== 0
      || !exactKeys(result.rawOutput, ['path', 'sha256'])
      || !shaReference.test(result.rawOutput.sha256)
      || result.rawOutput.path !== `${DEFAULT_THEME_G1_ROOT}/validation/${[
        'profile', 'focused', 'schema', 'catalog', 'tokens', 'foundation', 'tooling',
        'web', 'react', 'generation', 'agent', 'release', 'evidence', 'check', 'check-all',
      ][position]}.txt`
    ) {
      defaultFail('validation result shape or exit state is invalid');
    }
    const bytes = await readFile(join(repositoryRoot, result.rawOutput.path));
    if (`sha256:${sha256(bytes)}` !== result.rawOutput.sha256) {
      defaultFail(`${result.rawOutput.path} does not match validation digest`);
    }
  }
  const validationResults = new Map(validation.results.map((result) => [result.command, result]));
  for (const [position, reference] of index.records.entries()) {
    const assertionId = DEFAULT_THEME_G1_ASSERTION_IDS[position];
    const record = await verifyReference(repositoryRoot, reference);
    if (!exactKeys(record, [
      'activeExceptionRefs', 'advisoryRefs', 'applicabilityManifest',
      'applicabilityProfile', 'artifact', 'assertionId', 'captureTimestamp', 'command',
      'disclosureClass', 'environment', 'evidenceKind', 'executedRevision', 'executedTree',
      'expiry', 'milestone', 'outcome', 'owner', 'retentionPolicy', 'schema',
      'sourceRevision', 'sourceTree', 'validation',
    ])) defaultFail(`${assertionId} record keys must be exact`);
    if (
      record.assertionId !== assertionId
      || record.captureTimestamp !== index.captureTimestamp
      || record.sourceRevision !== index.sourceRevision
      || record.sourceTree !== index.sourceTree
      || record.executedRevision !== index.executedRevision
      || record.executedTree !== index.executedTree
      || canonicalJson(record.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
      || canonicalJson(record.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
      || canonicalJson(record.validation) !== canonicalJson(index.validation)
      || record.command !== DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].join(' && ')
      || canonicalJson(record.environment) !== canonicalJson(validation.environment)
      || record.evidenceKind !== DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId]
      || record.retentionPolicy !== DEFAULT_THEME_G1_RETENTION_POLICY
      || record.expiry !== DEFAULT_THEME_G1_EXPIRY
      || record.outcome !== 'pass'
      || record.milestone !== 'G1.0'
      || record.schema !== 'core-ui-evidence-record-v1'
      || record.owner !== 'ndrewtran'
      || record.disclosureClass !== DEFAULT_THEME_G1_DISCLOSURE_CLASS
      || record.activeExceptionRefs.length !== 0
      || record.advisoryRefs.length !== 0
    ) defaultFail(`${assertionId} record identity is invalid`);
    assertReference(record.artifact, `${DEFAULT_THEME_G1_ROOT}/artifacts/${assertionId}.json`, defaultFail);
    const artifact = await verifyReference(repositoryRoot, record.artifact);
    if (!exactKeys(artifact, [
      'applicabilityManifest', 'applicabilityProfile', 'assertionId', 'captureTimestamp',
      'command', 'environment', 'evidenceKind', 'executedRevision', 'executedTree',
      'exitState', 'observations', 'outcome', 'schema', 'sourceRevision', 'sourceTree',
    ])) defaultFail(`${assertionId} artifact keys must be exact`);
    if (
      artifact.assertionId !== assertionId
      || artifact.captureTimestamp !== index.captureTimestamp
      || artifact.sourceRevision !== index.sourceRevision
      || artifact.sourceTree !== index.sourceTree
      || artifact.executedRevision !== index.executedRevision
      || artifact.executedTree !== index.executedTree
      || canonicalJson(artifact.applicabilityProfile) !== canonicalJson(index.applicabilityProfile)
      || canonicalJson(artifact.applicabilityManifest) !== canonicalJson(index.applicabilityManifest)
      || artifact.command !== record.command
      || canonicalJson(artifact.environment) !== canonicalJson(validation.environment)
      || artifact.evidenceKind !== DEFAULT_THEME_G1_EVIDENCE_KINDS[assertionId]
      || artifact.exitState !== 0
      || artifact.outcome !== 'pass'
      || artifact.schema !== 'core-ui-evidence-artifact-v1'
      || !exactKeys(artifact.observations, ['facts', 'retainedResults', 'testNames'])
      || !Array.isArray(artifact.observations.retainedResults)
      || artifact.observations.retainedResults.length
        !== DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].length
      || artifact.observations.retainedResults.some((result) => (
        !exactKeys(result, ['command', 'outputSha256'])
        || !DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].includes(result.command)
        || !shaReference.test(result.outputSha256)
      ))
      || canonicalJson(artifact.observations.retainedResults)
        !== canonicalJson(DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].map((command) => ({
          command,
          outputSha256: validationResults.get(command)?.rawOutput.sha256,
        })))
      || canonicalJson(artifact.observations.testNames)
        !== canonicalJson(DEFAULT_THEME_G1_EXPECTED_TEST_NAMES[assertionId])
      || canonicalJson(artifact.observations.facts)
        !== canonicalJson(DEFAULT_THEME_G1_EXPECTED_FACTS[assertionId])
    ) defaultFail(`${assertionId} artifact identity or observations are invalid`);
    assertDefaultThemeG1EvidenceMetadata({
      artifact,
      assertionId,
      environment: validation.environment,
      expectedRetainedResults: DEFAULT_THEME_G1_RETAINED_COMMANDS[assertionId].map((command) => ({
        command,
        outputSha256: validationResults.get(command)?.rawOutput.sha256,
      })),
      record,
    });
  }
  return {
    assertionCount: DEFAULT_THEME_G1_ASSERTION_IDS.length,
    executedRevision: index.executedRevision,
    profileDigest: canonicalDigest(index.applicabilityProfile),
    sourceRevision: index.sourceRevision,
  };
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
  const repositoryRoot = resolve(import.meta.dirname, '../..');
  try {
    const result = await assertDefaultThemeG1Root(repositoryRoot);
    console.log(`[G1.0] verified ${result.assertionCount} exact records at ${result.sourceRevision} using ${result.executedRevision}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
