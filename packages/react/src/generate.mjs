import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson } from '@core-ui/schema';
import { compileWebTheme } from '@core-ui/tokens';
import {
  assertReactR11GeneratedContracts,
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
const buttonSource = await readFile(resolve(packageRoot, 'src/button.mjs'), 'utf8');
const buttonArtifact = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/components/button/artifact.json'), 'utf8'));
const buttonBinding = buttonArtifact.bindings['web.react'];
if (!buttonBinding || !buttonBinding.api.props.includes('pending')
  || buttonBinding.api.props.includes('isPending') || buttonBinding.api.props.includes('isDisabled')) {
  throw new Error('CORE_REACT_BUTTON_CANONICAL_API_DRIFT');
}
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

const cssBody = `${baseTheme.css.trim()}\n\n${modeBlocks.join('\n\n')}\n\n[data-core-direction='rtl'] { direction: rtl; }\n\n.core-button {\n  --core-button-background: var(--core-component-button-background);\n  --core-button-foreground: var(--core-component-button-foreground);\n  --core-button-focus-ring: var(--core-semantic-focus-ring);\n  --core-button-feedback-duration: var(--core-semantic-motion-feedback);\n  display: inline-flex;\n  position: relative;\n  align-items: center;\n  justify-content: center;\n  gap: var(--core-reference-dimension-space-2xs);\n  box-sizing: border-box;\n  min-height: var(--core-component-button-min-height);\n  padding: var(--core-reference-dimension-space-2xs) var(--core-component-button-padding-inline);\n  border: 1px solid transparent;\n  border-radius: var(--core-component-button-radius);\n  font: inherit;\n  line-height: 1;\n  white-space: nowrap;\n  user-select: none;\n  cursor: pointer;\n  background: var(--core-button-background);\n  color: var(--core-button-foreground);\n  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);\n  transition: opacity var(--core-button-feedback-duration) ease, background-color var(--core-button-feedback-duration) ease;\n}\n\n.core-button[data-hovered]:not([data-disabled], [data-pending]) { opacity: 0.9; }\n.core-button[data-pressed]:not([data-disabled], [data-pending]) { opacity: 0.8; }\n.core-button[data-focus-visible] {\n  outline: 2px solid var(--core-button-focus-ring);\n  outline-offset: 2px;\n}\n.core-button[data-disabled] { cursor: not-allowed; opacity: 0.5; }\n.core-button[data-pending] { cursor: progress; }\n\n@media (forced-colors: active) {\n  .core-button {\n    border-color: ButtonText;\n    background: ButtonFace;\n    color: ButtonText;\n    box-shadow: none;\n  }\n  .core-button[data-disabled] { border-color: GrayText; color: GrayText; }\n  .core-button[data-focus-visible] { outline-color: Highlight; }\n}\n\n@media (prefers-contrast: more) {\n  .core-button { border-color: currentColor; }\n}\n\n.core-r1-button {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: var(--core-reference-dimension-space-2xs);\n  box-sizing: border-box;\n  min-height: var(--core-component-button-min-height);\n  padding-inline: var(--core-component-button-padding-inline);\n  border: 1px solid transparent;\n  border-radius: var(--core-component-button-radius);\n  font: inherit;\n  background: var(--core-component-button-background);\n  color: var(--core-component-button-foreground);\n  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);\n  transition: opacity var(--core-semantic-motion-feedback) ease;\n}\n\n.core-r1-button[data-focus-visible] {\n  outline: 2px solid var(--core-semantic-focus-ring);\n  outline-offset: 2px;\n}\n\n.core-r1-button[data-disabled] { opacity: 0.5; }\n.core-r1-button[data-pending] { cursor: progress; }\n`;

const compatibility = {
  schema: 'core-ui-react-compatibility-v1',
  package: manifest.name,
  version: manifest.version,
  upstream: { package: 'react-aria-components', version: '1.20.0', gitHead: '5ecb3333001313e83898cd07644227897e3bae1f' },
  tokenSource: { path: 'catalog/tokens/default-theme.json', sha256: expectedTokenSha256 },
  support: 'unproved; Button export only',
};
const compatibilityBody = `function deepFreeze(value) {\n  if (value && typeof value === 'object' && !Object.isFrozen(value)) {\n    Object.freeze(value);\n    for (const child of Object.values(value)) deepFreeze(child);\n  }\n  return value;\n}\nexport const reactCompatibility = deepFreeze(${canonicalJson(compatibility)});\n`;
const indexBody = "export { reactCompatibility } from './compatibility.mjs';\nexport { Button } from './button.mjs';\n";
const typesBody = `import type * as React from 'react';

export type ButtonPointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual' | undefined;
export interface ButtonActivationEvent {
  readonly type: 'activate';
  readonly pointerType: ButtonPointerType;
  readonly target: HTMLButtonElement;
}
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'disabled' | 'onClick' | 'style'> {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pending?: boolean;
  style?: React.CSSProperties;
  onActivate?: (event: ButtonActivationEvent) => void;
}
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const reactCompatibility: Readonly<Record<string, unknown>>;
`;
const testingBody = "export const reactPlatformSafetyFixture = Object.freeze({ componentSupportClaim: 'none', fixture: 'r1.1-button' });\n";
const readmeBody = `# @core-ui/react\n\nExperimental, unpublished R1.1 Button slice for the standalone Core UI React renderer.\n\n- Button is a Core-owned public export for the \`web.react\` binding.\n- React Aria Components 1.20.0 is an internal replaceable substrate.\n- Core owns the Button API, tokens, styling, accessibility, lifecycle, and support boundary.\n- Tale UI is a pinned styling donor, never a dependency.\n\nThe package remains private and unpublished until the separately authorized React prerelease boundary.\n`;
const descriptorRecord = {
  schema: 'core-ui-renderer-descriptor-v1', generatedFrom: 'packages/react/src/generate.mjs',
  package: manifest.name, version: manifest.version, support: 'unproved; Button export only',
  bindings: [{
    binding: 'core:component:button#web.react', export: 'Button', module: '.',
    lifecycle: 'experimental', strategy: 'direct', runtimeProfile: 'web.react',
    selector: '.core-button', states: buttonArtifact.states, api: buttonBinding.api,
  }],
  exports: [{ name: 'Button', kind: 'component', binding: 'core:component:button#web.react', module: '.' }],
};
const releaseRecord = {
  schema: 'core-ui-react-release-candidate-v1', generatedFrom: 'packages/react/src/generate.mjs',
  package: manifest.name, version: manifest.version, lifecycle: 'experimental',
  componentExports: [{ name: 'Button', export: 'Button', binding: 'core:component:button#web.react', module: '.' }],
  bindings: [{ binding: 'core:component:button#web.react', package: manifest.name, export: 'Button', lifecycle: 'experimental', strategy: 'direct', runtimeProfile: 'web.react' }],
  runtimeProfiles: ['web.react'],
  packagePrivate: manifest.private,
  catalog: { status: 'bound', component: 'core:component:button', binding: 'core:component:button#web.react', states: buttonArtifact.states },
  tokenSource: { path: 'catalog/tokens/default-theme.json', sha256: expectedTokenSha256 },
  evidence: { status: 'pending', ids: ['E-R1.1-01', 'E-R1.1-02', 'E-R1.1-03', 'E-R1.1-04'] },
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
  result: { cssSha256: `sha256:${sha256(cssBody)}`, selector: '.core-button', status: 'adapted-for-r1.1-button' },
};
assertReactR11GeneratedContracts({ descriptor: descriptorRecord, release: releaseRecord, donorComparison: donorComparisonRecord, manifest, crosswalk });
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
  ['button.mjs', generatedText('packages/react/src/button.mjs', buttonSource)],
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

console.log('[react] generated standalone R1.1 Button projection from canonical token and donor owners');
