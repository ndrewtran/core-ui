import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { catalogJson } from '@muxui/catalog/bundle';
import { canonicalDigest, canonicalJson } from '@muxui/schema';
import { compileNativeTheme } from '@muxui/tokens';
import { selectReactNativeGenerationInputs } from './generation-inputs.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(packageRoot, '../..');
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const bundle = JSON.parse(catalogJson);

const { component, tokenArtifact } = selectReactNativeGenerationInputs(bundle);
const binding = component.record.bindings['native.react-native'];
if (!binding) throw new Error('MUXUI_REACT_NATIVE_GENERATION_INPUT_MISSING: native.react-native binding');

const sourcePath = 'packages/catalog/catalog-sources.json';
const profiles = [
  { id: 'native.ios', platform: 'ios' },
  { id: 'native.android', platform: 'android' },
];
const runtimeProfiles = Object.fromEntries(Object.entries(binding.runtimeProfiles).map(([profile, value]) => {
  const safety = binding.platformSafety.find((entry) => entry.profile === profile);
  if (!safety) throw new Error(`MUXUI_REACT_NATIVE_GENERATION_INPUT_MISSING: ${profile} platform safety`);
  return [profile, { ...value, profile, validationProfile: safety.validationProfile }];
}));
if (canonicalJson(Object.keys(runtimeProfiles)) !== canonicalJson(['android', 'ios', 'native.react-native-web'])) {
  throw new Error('MUXUI_REACT_NATIVE_GENERATION_INPUT_INVALID: runtime profiles');
}
const projection = {
  schema: 'muxui-react-native-theme-projection-v1',
  package: manifest.name,
  componentSupportClaim: 'none',
  source: {
    catalogDigest: bundle.catalogDigest,
    catalogSourceRevision: bundle.sourceRevision,
    tokenId: tokenArtifact.id,
    tokenSourceRevision: tokenArtifact.contentRevision,
    tokenContractVersion: tokenArtifact.record.tokenContractVersion,
    transformOwner: '@muxui/tokens#compileNativeTheme',
  },
  profiles: Object.fromEntries(profiles.map(({ id, platform }) => {
    const theme = compileNativeTheme(tokenArtifact.record, { profile: id });
    return [platform, {
      profile: id,
      theme,
      themeDigest: canonicalDigest(theme),
    }];
  })),
};

const safetySets = Object.fromEntries(Object.entries(runtimeProfiles).map(([profile]) => {
  const key = `native.react-native:${profile === 'native.react-native-web' ? profile : profile}`;
  const set = component.platformSafetyRequirementSets[key];
  if (!set) throw new Error(`MUXUI_REACT_NATIVE_GENERATION_INPUT_MISSING: ${key}`);
  return [profile, set];
}));
const contractDigests = new Set(Object.values(safetySets).map(({ contractDigest }) => contractDigest));
if (contractDigests.size !== 1) throw new Error('MUXUI_REACT_NATIVE_GENERATION_INPUT_INVALID: platform safety contract');
const nativeProfileProjection = {
  schema: 'muxui-react-native-profile-projection-v1',
  package: manifest.name,
  componentId: component.id,
  bindingRef: `${component.id}#native.react-native`,
  bindingContentRevision: component.bindingContentRevisions['native.react-native'],
  bindingSpecRevision: component.bindingSpecRevisions['native.react-native'],
  componentSupportClaim: 'none',
  platformSafetyContractDigest: [...contractDigests][0],
  profiles: Object.fromEntries(Object.entries(runtimeProfiles).map(([profile, value]) => [profile, {
    ...value,
    platformSafetyRequirementSetDigest: safetySets[profile].digest,
    ...(profile === 'native.react-native-web' ? {} : {
      tokenRequirementSetDigest: component.tokenRequirementSets[`native.react-native:native.${profile}`]?.digest,
    }),
  }])),
};
if (Object.entries(nativeProfileProjection.profiles).some(([profile, value]) => (
  profile !== 'native.react-native-web' && !value.tokenRequirementSetDigest
))) throw new Error('MUXUI_REACT_NATIVE_GENERATION_INPUT_MISSING: native token requirement set');

const moduleBody = [
  'function deepFreeze(value) {',
  "  if (value && typeof value === 'object' && !Object.isFrozen(value)) {",
  '    Object.freeze(value);',
  '    for (const item of Object.values(value)) deepFreeze(item);',
  '  }',
  '  return value;',
  '}',
  `export const nativeThemeProjection = deepFreeze(${canonicalJson(projection)});`,
  'export const nativeThemes = nativeThemeProjection.profiles;',
  '',
].join('\n');

const profileModuleBody = [
  'function deepFreeze(value) {',
  "  if (value && typeof value === 'object' && !Object.isFrozen(value)) {",
  '    Object.freeze(value);',
  '    for (const item of Object.values(value)) deepFreeze(item);',
  '  }',
  '  return value;',
  '}',
  `export const nativeProfileProjection = deepFreeze(${canonicalJson(nativeProfileProjection)});`,
  'export const nativeProfiles = nativeProfileProjection.profiles;',
  '',
].join('\n');

const profileTypeCases = Object.entries(nativeProfileProjection.profiles).map(([profile, value]) => {
  const fields = [
    `profile: '${profile}';`,
    `validationProfile: '${value.validationProfile}';`,
    `strategy: '${value.strategy}';`,
    ...(value.lifecycle === undefined ? [] : [`lifecycle: '${value.lifecycle}';`]),
    ...(value.reason === undefined ? [] : [`reason: ${JSON.stringify(value.reason)};`]),
    `platformSafetyRequirementSetDigest: ${JSON.stringify(value.platformSafetyRequirementSetDigest)};`,
    ...(value.tokenRequirementSetDigest === undefined ? [] : [
      `tokenRequirementSetDigest: ${JSON.stringify(value.tokenRequirementSetDigest)};`,
    ]),
  ];
  return `  | { ${fields.join(' ')} }`;
}).join('\n');
const profileTypesBody = [
  `export type NativeProfileId = ${Object.keys(runtimeProfiles).map((profile) => `'${profile}'`).join(' | ')};`,
  'export type NativeProfile = Readonly<',
  profileTypeCases,
  '>;',
  'export interface NativeProfileProjection {',
  "  readonly schema: 'muxui-react-native-profile-projection-v1';",
  "  readonly package: '@muxui/react-native';",
  "  readonly componentId: 'muxui:component:button';",
  "  readonly bindingRef: 'muxui:component:button#native.react-native';",
  `  readonly bindingContentRevision: ${JSON.stringify(nativeProfileProjection.bindingContentRevision)};`,
  `  readonly bindingSpecRevision: ${JSON.stringify(nativeProfileProjection.bindingSpecRevision)};`,
  "  readonly componentSupportClaim: 'none';",
  `  readonly platformSafetyContractDigest: ${JSON.stringify(nativeProfileProjection.platformSafetyContractDigest)};`,
  '  readonly profiles: Readonly<Record<NativeProfileId, NativeProfile>>;',
  '}',
  'export const nativeProfileProjection: NativeProfileProjection;',
  'export const nativeProfiles: Readonly<Record<NativeProfileId, NativeProfile>>;',
  '',
].join('\n');

const provenance = {
  schema: 'muxui-react-native-theme-provenance-v1',
  projectionDigest: canonicalDigest(projection),
  sourcePath,
  packagePath: 'packages/react-native/package.json',
  inputs: {
    catalogDigest: bundle.catalogDigest,
    catalogSourceRevision: bundle.sourceRevision,
    tokenSourceRevision: tokenArtifact.contentRevision,
    tokenContractVersion: tokenArtifact.record.tokenContractVersion,
    transformOwner: '@muxui/tokens#compileNativeTheme',
  },
};
const provenanceBody = `${canonicalJson(provenance)}\n`;

function generated(body) {
  const digest = createHash('sha256').update(body).digest('hex');
  return `// @generated-from: ${sourcePath}\n// @generated-content-sha256: sha256:${digest}\n${body}`;
}

const outputs = [
  { path: resolve(packageRoot, 'generated/native-themes.mjs'), expected: generated(moduleBody) },
  { path: resolve(packageRoot, 'generated/native-themes.mjs.provenance'), expected: generated(provenanceBody) },
  { path: resolve(packageRoot, 'generated/native-profiles.mjs'), expected: generated(profileModuleBody) },
  { path: resolve(packageRoot, 'generated/native-profiles.d.mts'), expected: generated(profileTypesBody) },
];

for (const output of outputs) {
  if (process.argv.includes('--check')) {
    const actual = await readFile(output.path, 'utf8').catch(() => null);
    if (actual !== output.expected) {
      console.error(`MUXUI_REACT_NATIVE_GENERATED_DRIFT: ${output.path.slice(repositoryRoot.length + 1)} must be regenerated`);
      process.exitCode = 1;
    }
  } else {
    await mkdir(dirname(output.path), { recursive: true });
    await writeFile(output.path, output.expected);
  }
}

if (!process.exitCode) console.log('[react-native] generated native theme projections match canonical inputs');
