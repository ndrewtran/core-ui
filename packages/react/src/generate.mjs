import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson } from '@core-ui/schema';
import { compileWebTheme } from '@core-ui/tokens';
import {
  assertReactR10GeneratedContracts,
  assertReactR10SourceContracts,
} from './r1-contracts.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(packageRoot, '../..');
const generatedRoot = resolve(packageRoot, 'generated');
const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
const tokenPath = resolve(repositoryRoot, 'catalog/tokens/default-theme.json');
const tokenRaw = await readFile(tokenPath);
const tokenSha256 = createHash('sha256').update(tokenRaw).digest('hex');
const expectedTokenSha256 = 'cd4aca7d436ce080bed36f1358924bed0c130dacb94455dfb5eb9cf96eabdb8f';
if (tokenSha256 !== expectedTokenSha256) throw new Error('CORE_REACT_TOKEN_SOURCE_DRIFT');
const tokenSource = JSON.parse(tokenRaw);
const snapshot = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-0/upstream-snapshot.json'), 'utf8'));
const upstreamExportsRaw = await readFile(resolve(repositoryRoot, 'catalog/react-r1-0/upstream-exports.json'));
const upstreamExports = JSON.parse(upstreamExportsRaw);
const crosswalk = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-0/donor-crosswalk.json'), 'utf8'));
const license = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-0/license.json'), 'utf8'));
assertReactR10SourceContracts({ snapshot, upstreamExports, upstreamExportsBytes: upstreamExportsRaw, crosswalk, license });

const consumedRules = [
  '--color-60', '--color-60-fg', '--radius-m', '--space-xs', '2.25rem minimum height',
  'focus-ring color/rule', 'feedback transition duration', 'inherited typography',
  'donor shadow and opacity details',
];
if (canonicalJson(crosswalk.button.consumedRules) !== canonicalJson(consumedRules)) {
  throw new Error('CORE_REACT_DONOR_CROSSWALK_DRIFT');
}
if (canonicalJson(crosswalk.button.rules.map(({ input }) => input)) !== canonicalJson(consumedRules)) {
  throw new Error('CORE_REACT_DONOR_RULE_UNMAPPED');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function generatedText(source, body, open = '//', close = '') {
  return `${open} @generated-from: ${source}${close}\n${open} @generated-content-sha256: sha256:${sha256(body)}${close}\n${body}`;
}

function generatedCss(source, body) {
  const digestBody = ` */\n${body}`;
  return `/* @generated-from: ${source}\n * @generated-content-sha256: sha256:${sha256(digestBody)}\n${digestBody}`;
}

function declarations(css) {
  return new Map([...css.matchAll(/^  (--[^:]+): (.+);$/gm)].map((match) => [match[1], match[2]]));
}

const axes = [['colorScheme', 'dark'], ['contrast', 'more'], ['motion', 'reduced'], ['density', 'compact']];
const baseTheme = compileWebTheme(tokenSource);
const baseDeclarations = declarations(baseTheme.css);
const modeBlocks = axes.map(([axis, value]) => {
  const variant = declarations(compileWebTheme(tokenSource, { modes: { [axis]: value } }).css);
  const changed = [...variant].filter(([name, tokenValue]) => baseDeclarations.get(name) !== tokenValue);
  const dataAxis = axis.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const values = changed.length === 0 ? '  /* canonical mode has no token delta */' : changed.map(([name, tokenValue]) => `  ${name}: ${tokenValue};`).join('\n');
  return `[data-core-${dataAxis}='${value}'] {\n${values}\n}`;
});

const cssBody = `${baseTheme.css.trim()}\n\n${modeBlocks.join('\n\n')}\n\n[data-core-direction='rtl'] { direction: rtl; }\n\n.core-r1-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: var(--core-reference-dimension-space-2xs);\n  box-sizing: border-box;\n  min-height: var(--core-component-button-min-height);\n  padding-inline: var(--core-component-button-padding-inline);\n  border: 1px solid transparent;\n  border-radius: var(--core-component-button-radius);\n  font: inherit;\n  background: var(--core-component-button-background);\n  color: var(--core-component-button-foreground);\n  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);\n  transition: opacity var(--core-semantic-motion-feedback) ease;\n}\n\n.core-r1-button[data-focus-visible] {\n  outline: 2px solid var(--core-semantic-focus-ring);\n  outline-offset: 2px;\n}\n\n.core-r1-button[data-disabled] { opacity: 0.5; }\n.core-r1-button[data-pending] { cursor: progress; }\n`;

const compatibility = {
  schema: 'core-ui-react-compatibility-v1',
  package: manifest.name,
  version: manifest.version,
  upstream: { package: 'react-aria-components', version: '1.20.0', gitHead: '5ecb3333001313e83898cd07644227897e3bae1f' },
  tokenSource: { path: 'catalog/tokens/default-theme.json', sha256: expectedTokenSha256 },
  support: 'baseline-only; no component export',
};
const compatibilityBody = `function deepFreeze(value) {\n  if (value && typeof value === 'object' && !Object.isFrozen(value)) {\n    Object.freeze(value);\n    for (const child of Object.values(value)) deepFreeze(child);\n  }\n  return value;\n}\nexport const reactCompatibility = deepFreeze(${canonicalJson(compatibility)});\n`;
const indexBody = "export { reactCompatibility } from './compatibility.mjs';\n";
const typesBody = 'export const reactCompatibility: Readonly<Record<string, unknown>>;\n';
const testingBody = "export const reactPlatformSafetyFixture = Object.freeze({ componentSupportClaim: 'none', fixture: 'r1.0-button-comparison' });\n";
const readmeBody = `# @core-ui/react\n\nExperimental, unpublished R1.0 baseline for the standalone Core UI React renderer.\n\n- React Aria Components 1.20.0 is the internal starting point.\n- Core UI owns the public API, tokens, styling, accessibility, lifecycle, and support claims.\n- No component is exported or supported by this baseline.\n- Tale UI is a pinned styling donor, never a dependency.\n\nThe generated stylesheet and private Button fixture exist only to prove the baseline before R1.1. They are not a Button support claim.\n`;
const descriptorRecord = { schema: 'core-ui-renderer-descriptor-v1', generatedFrom: 'packages/react/src/generate.mjs', package: manifest.name, version: manifest.version, bindings: [], exports: [], support: 'none' };
const releaseRecord = {
  schema: 'core-ui-react-release-candidate-v1', generatedFrom: 'packages/react/src/generate.mjs',
  package: manifest.name, version: manifest.version, lifecycle: 'experimental', componentExports: [], bindings: [], runtimeProfiles: [],
  packagePrivate: manifest.private,
  catalog: { status: 'not-applicable', reason: 'R1.0 admits no component or catalog record' },
  tokenSource: { path: 'catalog/tokens/default-theme.json', sha256: expectedTokenSha256 },
  evidence: { status: 'pending', ids: ['E-R1.0-01', 'E-R1.0-02', 'E-R1.0-03', 'E-R1.0-04', 'E-R1.0-05'] },
  advisories: [], exceptions: [],
  publication: { status: 'disabled', requires: ['explicit external publish authorization'] },
  rollback: { status: 'candidate-branch-only-before-merge' },
};
for (const rule of crosswalk.button.rules) {
  if (rule.core.includes('.') && !cssBody.includes(`--core-${rule.core.replaceAll('.', '-')}`)) throw new Error(`CORE_REACT_DONOR_RESULT_MISSING: ${rule.input}`);
}
if (!cssBody.includes('font: inherit') || !cssBody.includes('box-shadow:') || !cssBody.includes('[data-disabled] { opacity:')) {
  throw new Error('CORE_REACT_DONOR_NON_TOKEN_RESULT_MISSING');
}
const donorComparisonRecord = {
  schema: 'core-ui-react-button-donor-comparison-v1', generatedFrom: 'packages/react/src/generate.mjs',
  donor: { commit: crosswalk.donor.commit, tree: crosswalk.donor.tree, buttonBlobs: crosswalk.buttonBlobs },
  disposition: crosswalk.button.disposition, consumedRules: crosswalk.button.rules,
  result: { cssSha256: `sha256:${sha256(cssBody)}`, selector: '.core-r1-button', status: 'adapted-for-private-r1.0-fixture' },
};
assertReactR10GeneratedContracts({ descriptor: descriptorRecord, release: releaseRecord, donorComparison: donorComparisonRecord, manifest, crosswalk });
const descriptor = `${canonicalJson(descriptorRecord)}\n`;
const release = `${canonicalJson(releaseRecord)}\n`;
const donorComparison = `${canonicalJson(donorComparisonRecord)}\n`;
function provenance(path, bytes) {
  const body = `${canonicalJson({ path: `packages/react/generated/${path}`, sha256: `sha256:${sha256(bytes)}` })}\n`;
  return generatedText('packages/react/src/generate.mjs', body);
}

const outputs = new Map([
  ['compatibility.mjs', generatedText('packages/react/src/generate.mjs', compatibilityBody)],
  ['index.mjs', generatedText('packages/react/src/generate.mjs', indexBody)],
  ['index.d.ts', generatedText('packages/react/src/generate.mjs', typesBody)],
  ['testing.mjs', generatedText('packages/react/src/generate.mjs', testingBody)],
  ['styles.css', generatedCss('packages/react/src/generate.mjs', cssBody)],
  ['descriptor.json', descriptor],
  ['descriptor.json.provenance', provenance('descriptor.json', descriptor)],
  ['release.json', release],
  ['release.json.provenance', provenance('release.json', release)],
  ['button-donor-comparison.json', donorComparison],
  ['button-donor-comparison.json.provenance', provenance('button-donor-comparison.json', donorComparison)],
]);
const readme = generatedText('packages/react/src/generate.mjs', readmeBody, '<!--', ' -->');

if (process.argv.includes('--check')) {
  for (const [name, expected] of outputs) {
    if (await readFile(resolve(generatedRoot, name), 'utf8').catch(() => null) !== expected) {
      throw new Error(`CORE_REACT_GENERATED_DRIFT: generated/${name}`);
    }
  }
  if (await readFile(resolve(packageRoot, 'README.md'), 'utf8').catch(() => null) !== readme) {
    throw new Error('CORE_REACT_GENERATED_DRIFT: README.md');
  }
} else {
  await mkdir(generatedRoot, { recursive: true });
  for (const [name, expected] of outputs) await writeFile(resolve(generatedRoot, name), expected);
  await writeFile(resolve(packageRoot, 'README.md'), readme);
}

console.log('[react] generated standalone R1.0 baseline matches canonical token and donor owners');
