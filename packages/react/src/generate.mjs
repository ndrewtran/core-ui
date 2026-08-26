import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson } from '@core-ui/schema';
import { compileWebTheme } from '@core-ui/tokens';
import {
  assertReactR10SourceContracts,
  assertReactR11GeneratedContracts,
  assertReactR12GeneratedContracts,
  assertReactR13GeneratedContracts,
} from './r1-contracts.mjs';
import { EXPECTED_R12_COMPONENT_SLUGS, EXPECTED_R12_DONOR_CONTRACT } from './r1-2-donor-contract.mjs';
import { EXPECTED_R13_COMPONENT_SLUGS, EXPECTED_R13_DONOR_CONTRACT } from './r1-3-donor-contract.mjs';

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
const r12Crosswalk = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-2/donor-crosswalk.json'), 'utf8'));
const r13Crosswalk = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-3/donor-crosswalk.json'), 'utf8'));
const license = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/react-r1-0/license.json'), 'utf8'));
const r11Slugs = ['button', 'breadcrumbs', 'checkbox', 'disclosure', 'disclosure-group', 'group', 'link', 'meter', 'progress-bar', 'separator', 'toggle-button'];
const r12Slugs = [...EXPECTED_R12_COMPONENT_SLUGS];
const r13Slugs = [...EXPECTED_R13_COMPONENT_SLUGS];
const buttonSource = await readFile(resolve(packageRoot, 'src/button.mjs'), 'utf8');
const componentSource = await readFile(resolve(packageRoot, 'src/components.mjs'), 'utf8');
const fieldsSource = await readFile(resolve(packageRoot, 'src/fields.mjs'), 'utf8');
const collectionsSource = await readFile(resolve(packageRoot, 'src/collections.mjs'), 'utf8');
const buttonArtifact = JSON.parse(await readFile(resolve(repositoryRoot, 'catalog/components/button/artifact.json'), 'utf8'));
const buttonBinding = buttonArtifact.bindings['web.react'];
if (!buttonBinding || !buttonBinding.api.props.includes('pending')
  || buttonBinding.api.props.includes('isPending') || buttonBinding.api.props.includes('isDisabled')) {
  throw new Error('CORE_REACT_BUTTON_CANONICAL_API_DRIFT');
}
assertReactR10SourceContracts({ snapshot, upstreamExports, upstreamExportsBytes: upstreamExportsRaw, crosswalk, license });
const componentArtifacts = [
  buttonArtifact,
  ...await Promise.all([
    'breadcrumbs', 'checkbox', 'disclosure', 'disclosure-group', 'group', 'link', 'meter', 'progress-bar', 'separator', 'toggle-button',
    'autocomplete', 'checkbox-group', 'date-field', 'date-picker', 'date-range-picker', 'form', 'number-field', 'search-field', 'switch', 'text-field', 'time-field',
    ...r13Slugs,
  ].map(async (slug) => JSON.parse(await readFile(resolve(repositoryRoot, `catalog/components/${slug}/artifact.json`), 'utf8')))),
];
if (componentArtifacts.length !== 46 || new Set(componentArtifacts.map(({ id }) => id)).size !== 46) {
  throw new Error('CORE_REACT_R1_COMPONENT_ALLOCATION_DRIFT');
}
for (const artifact of componentArtifacts) {
  const binding = artifact.bindings['web.react'];
  if (!binding || binding.api.props.some((prop) => /^is[A-Z]/u.test(prop))) {
    throw new Error(`CORE_REACT_${artifact.name.toUpperCase()}_CANONICAL_API_DRIFT`);
  }
  if (artifact.name !== 'Button' && r11Slugs.includes(artifact.id.slice('core:component:'.length))) {
    const slug = artifact.id.slice('core:component:'.length);
    const componentCrosswalk = crosswalk.components?.[slug];
    if (!componentCrosswalk
      || canonicalJson(componentCrosswalk.consumedRules) !== canonicalJson(componentCrosswalk.rules.map(({ input }) => input))) {
      throw new Error(`CORE_REACT_${artifact.name.toUpperCase()}_DONOR_CROSSWALK_DRIFT`);
    }
  } else if (r12Slugs.includes(artifact.id.slice('core:component:'.length))) {
    const slug = artifact.id.slice('core:component:'.length);
    const componentCrosswalk = r12Crosswalk.components?.[slug];
    if (!componentCrosswalk
      || canonicalJson(componentCrosswalk.consumedRules) !== canonicalJson(componentCrosswalk.rules.map(({ input }) => input))) {
      throw new Error(`CORE_REACT_${artifact.name.toUpperCase()}_DONOR_CROSSWALK_DRIFT`);
    }
  } else if (r13Slugs.includes(artifact.id.slice('core:component:'.length))) {
    const slug = artifact.id.slice('core:component:'.length);
    const componentCrosswalk = r13Crosswalk.components?.[slug];
    if (!componentCrosswalk
      || canonicalJson(componentCrosswalk.consumedRules) !== canonicalJson(componentCrosswalk.rules.map(({ input }) => input))) {
      throw new Error(`CORE_REACT_${artifact.name.toUpperCase()}_DONOR_CROSSWALK_DRIFT`);
    }
  }
}

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

const componentCss = `
.core-breadcrumbs { display: block; }
.core-breadcrumbs-list { display: flex; flex-wrap: wrap; gap: var(--core-reference-dimension-space-2xs); margin: 0; padding: 0; list-style: none; }
.core-breadcrumbs-link, .core-link { color: inherit; text-underline-offset: 0.15em; transition: opacity var(--core-semantic-motion-feedback) ease; }
.core-breadcrumbs-link:focus-visible, .core-link:focus-visible { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-breadcrumbs-current { font-weight: 600; }
.core-checkbox { display: inline-flex; align-items: center; gap: var(--core-reference-dimension-space-2xs); cursor: pointer; }
.core-checkbox-indicator { display: inline-grid; place-items: center; inline-size: 1.125rem; block-size: 1.125rem; flex: 0 0 auto; border: 1.5px solid currentColor; border-radius: var(--core-semantic-control-radius); background: transparent; color: currentColor; font-size: 0.8rem; font-weight: 700; line-height: 1; }
.core-checkbox-indicator[data-selected], .core-checkbox-indicator[data-indeterminate] { border-color: var(--core-semantic-selection-track); background: var(--core-semantic-selection-track); color: Canvas; }
.core-checkbox-indicator[data-selected]::before { content: '✓'; }
.core-checkbox-indicator[data-indeterminate]::before { content: '−'; }
.core-checkbox input { accent-color: var(--core-semantic-selection-track); }
.core-checkbox:focus-within { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-checkbox[data-focus-visible] { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-checkbox[data-invalid] .core-checkbox-indicator { border-color: var(--core-semantic-feedback-invalid); }
.core-checkbox[data-disabled] { cursor: not-allowed; opacity: 0.55; }
.core-disclosure, .core-disclosure-group, .core-group { border: 1px solid currentColor; border-radius: var(--core-semantic-control-radius); padding: var(--core-semantic-control-padding-inline); }
.core-disclosure-trigger, .core-toggle-button { border: 1px solid transparent; border-radius: var(--core-semantic-control-radius); padding: var(--core-semantic-control-padding-inline); font: inherit; cursor: pointer; }
.core-disclosure-trigger:focus-visible, .core-toggle-button:focus-visible { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-disclosure-panel { padding-block-start: var(--core-reference-dimension-space-2xs); }
.core-group[data-disabled] { opacity: 0.55; }
.core-link[data-disabled] { cursor: not-allowed; opacity: 0.55; }
.core-meter, .core-progress-bar { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-meter-track, .core-progress-bar-track { overflow: hidden; min-block-size: 0.5rem; border-radius: var(--core-semantic-control-radius); background: color-mix(in srgb, currentColor 20%, transparent); }
.core-meter-fill, .core-progress-bar-fill { min-block-size: inherit; border-radius: inherit; background: var(--core-semantic-selection-track); transition: inline-size var(--core-semantic-motion-feedback) ease; }
.core-progress-bar[data-indeterminate] .core-progress-bar-fill { inline-size: 35%; }
.core-separator { border: 0; background: currentColor; opacity: 0.45; }
.core-separator-horizontal { block-size: 1px; inline-size: 100%; }
.core-separator-vertical { block-size: 100%; inline-size: 1px; min-block-size: 1rem; }
.core-toggle-button[aria-pressed='true'] { background: var(--core-semantic-action-background); color: var(--core-semantic-action-foreground); }
.core-toggle-button:disabled { cursor: not-allowed; opacity: 0.55; }
@media (prefers-reduced-motion: reduce) { .core-breadcrumbs-link, .core-link, .core-meter-fill, .core-progress-bar-fill { transition: none; } }
@media (forced-colors: active) { .core-disclosure, .core-disclosure-group, .core-group, .core-toggle-button, .core-checkbox input, .core-checkbox-indicator { border-color: ButtonText; } .core-checkbox-indicator[data-selected], .core-checkbox-indicator[data-indeterminate] { background: Highlight; color: HighlightText; } .core-meter-fill, .core-progress-bar-fill { background: Highlight; } .core-separator { background: ButtonText; } }
`;
const collectionCss = `
.core-calendar, .core-range-calendar { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-calendar-grid { border-spacing: .125rem; }
.core-calendar-cell, .core-range-calendar-cell { inline-size: 2rem; block-size: 2rem; border: 0; border-radius: var(--core-semantic-control-radius); color: inherit; font: inherit; }
.core-calendar-cell[data-focused], .core-range-calendar-cell[data-focused], .core-calendar-cell[aria-selected='true'], .core-range-calendar-cell[aria-selected='true'] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-color-area, .core-color-slider, .core-color-wheel { position: relative; outline: none; }
.core-color-area { inline-size: 14rem; block-size: 10rem; border-radius: var(--core-semantic-control-radius); background: linear-gradient(to right, transparent, var(--core-semantic-selection-track)), linear-gradient(to top, #000, transparent); }
.core-color-area-thumb, .core-color-slider-thumb, .core-color-wheel-thumb { position: absolute; inline-size: 1rem; block-size: 1rem; border: 2px solid CanvasText; border-radius: 50%; box-shadow: 0 0 0 1px Canvas; outline: none; }
.core-color-area-thumb[data-focus-visible], .core-color-slider-thumb[data-focus-visible], .core-color-wheel-thumb[data-focus-visible] { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-color-slider { display: grid; gap: var(--core-reference-dimension-space-2xs); min-inline-size: 12rem; }
.core-color-slider-track, .core-slider-track { position: relative; display: block; block-size: .5rem; border-radius: var(--core-semantic-control-radius); background: linear-gradient(to right, var(--core-semantic-selection-track), transparent); }
.core-color-slider-fill, .core-slider-fill { block-size: 100%; border-radius: inherit; background: var(--core-semantic-selection-track); }
.core-color-wheel { inline-size: 12rem; block-size: 12rem; }
.core-color-wheel-track { inline-size: 100%; block-size: 100%; border-radius: 50%; background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
.core-color-picker { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-color-field { display: grid; gap: var(--core-reference-dimension-space-2xs); max-inline-size: 24rem; }
.core-color-swatch { display: inline-block; inline-size: 1.5rem; block-size: 1.5rem; border: 1px solid currentColor; border-radius: var(--core-semantic-control-radius); }
.core-color-swatch-picker { display: flex; flex-wrap: wrap; gap: var(--core-reference-dimension-space-2xs); }
.core-color-swatch-picker-item[aria-selected='true'] { outline: 2px solid var(--core-semantic-selection-track); outline-offset: 2px; }
.core-combo-box, .core-select { position: relative; display: grid; gap: var(--core-reference-dimension-space-2xs); max-inline-size: 24rem; }
.core-combo-box-trigger, .core-select-trigger { min-block-size: var(--core-semantic-control-min-height); border: 1px solid currentColor; border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-field-background); color: inherit; font: inherit; }
.core-combo-box-popover, .core-select-popover { min-inline-size: 14rem; padding: var(--core-semantic-control-padding-inline); border: 1px solid currentColor; border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-overlay-background); }
.core-combo-box-list, .core-select-list, .core-list-box, .core-grid-list { display: flex; flex-direction: column; gap: var(--core-reference-dimension-space-2xs); margin: 0; padding: var(--core-semantic-control-padding-inline); list-style: none; }
.core-combo-box-option, .core-select-option, .core-list-box-item, .core-grid-list-item, .core-menu-item { padding: var(--core-reference-dimension-space-2xs) var(--core-semantic-control-padding-inline); border-radius: var(--core-semantic-control-radius); }
.core-combo-box-option[data-focused], .core-select-option[data-focused], .core-list-box-item[aria-selected='true'], .core-grid-list-item[aria-selected='true'], .core-menu-item[data-focused] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-list-box-item[data-focus-visible], .core-grid-list-item[data-focus-visible], .core-color-swatch-picker-item[data-focus-visible], .core-table-row[data-focus-visible] { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-radio-group { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-radio { display: inline-flex; align-items: center; gap: var(--core-reference-dimension-space-2xs); cursor: pointer; }
.core-radio-indicator { display: inline-grid; place-items: center; inline-size: 1rem; block-size: 1rem; flex: 0 0 auto; border: 1.5px solid currentColor; border-radius: 50%; background: transparent; }
.core-radio[data-selected] .core-radio-indicator { border-color: var(--core-semantic-selection-track); background: var(--core-semantic-selection-track); box-shadow: inset 0 0 0 .25rem Canvas; }
.core-radio:focus-within, .core-radio[data-focus-visible] { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-radio[data-disabled] { cursor: not-allowed; opacity: .55; }
.core-radio[data-readonly] { cursor: default; }
.core-slider { display: grid; gap: var(--core-reference-dimension-space-2xs); min-inline-size: 12rem; }
.core-table { border-collapse: collapse; }
.core-table-cell, .core-table-column { padding: var(--core-reference-dimension-space-2xs) var(--core-semantic-control-padding-inline); border-block-end: 1px solid currentColor; text-align: start; }
.core-table-row[aria-selected='true'] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-tabs { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-tab-list { display: flex; gap: var(--core-reference-dimension-space-2xs); }
.core-tab { padding: var(--core-reference-dimension-space-2xs) var(--core-semantic-control-padding-inline); border: 0; border-radius: var(--core-semantic-control-radius); background: transparent; color: inherit; font: inherit; }
.core-tab[aria-selected='true'] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-tab-panel { padding: var(--core-reference-dimension-space-2xs); }
.core-tag-group, .core-token-field { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-tag-list { display: flex; flex-wrap: wrap; gap: var(--core-reference-dimension-space-2xs); }
.core-tag, .core-token { display: inline-flex; align-items: center; gap: var(--core-reference-dimension-space-2xs); padding: .125rem var(--core-semantic-control-padding-inline); border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-selection-track); color: Canvas; }
.core-tag-remove { border: 0; background: transparent; color: inherit; font: inherit; }
.core-toggle-button-group { display: inline-flex; gap: var(--core-reference-dimension-space-2xs); }
.core-toggle-button-group [aria-pressed='true'] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-token-input { min-block-size: var(--core-semantic-control-min-height); padding: var(--core-semantic-control-padding-inline); border: 1px solid currentColor; border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-field-background); color: inherit; }
.core-toolbar { display: flex; flex-wrap: wrap; gap: var(--core-reference-dimension-space-2xs); align-items: center; }
.core-tree { display: grid; gap: var(--core-reference-dimension-space-2xs); margin: 0; padding: 0; list-style: none; }
.core-tree-item { padding: var(--core-reference-dimension-space-2xs) var(--core-semantic-control-padding-inline); border-radius: var(--core-semantic-control-radius); }
.core-tree-item[aria-selected='true'], .core-tree-item[data-focused] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-virtualizer { display: block; max-block-size: 100%; contain: strict; }
.core-virtualizer-item { box-sizing: border-box; padding: var(--core-reference-dimension-space-2xs) var(--core-semantic-control-padding-inline); border-radius: var(--core-semantic-control-radius); }
.core-virtualizer-item[aria-selected='true'], .core-virtualizer-item[data-focused] { background: var(--core-semantic-selection-track); color: Canvas; }
@media (forced-colors: active) {
  .core-color-area, .core-color-slider, .core-color-wheel, .core-combo-box-trigger, .core-select-trigger, .core-combo-box-popover, .core-select-popover, .core-token-input { border-color: ButtonText; background: Canvas; color: CanvasText; }
  .core-color-area-thumb, .core-color-slider-thumb, .core-color-wheel-thumb, .core-table-cell, .core-table-column { border-color: ButtonText; box-shadow: none; }
  .core-calendar-cell[data-focused], .core-range-calendar-cell[data-focused], .core-calendar-cell[aria-selected='true'], .core-range-calendar-cell[aria-selected='true'], .core-list-box-item[aria-selected='true'], .core-grid-list-item[aria-selected='true'], .core-menu-item[data-focused], .core-table-row[aria-selected='true'], .core-tab[aria-selected='true'], .core-tree-item[aria-selected='true'], .core-tree-item[data-focused], .core-virtualizer-item[aria-selected='true'], .core-virtualizer-item[data-focused] { background: Highlight; color: HighlightText; }
  .core-radio-indicator { border-color: ButtonText; }
  .core-radio[data-selected] .core-radio-indicator { border-color: Highlight; background: Highlight; box-shadow: inset 0 0 0 .25rem Canvas; }
  .core-list-box-item[data-focus-visible], .core-grid-list-item[data-focus-visible], .core-color-swatch-picker-item[data-focus-visible], .core-table-row[data-focus-visible] { outline-color: Highlight; }
  .core-color-area-thumb[data-focus-visible], .core-color-slider-thumb[data-focus-visible], .core-color-wheel-thumb[data-focus-visible] { outline-color: Highlight; }
}
@media (prefers-contrast: more) {
  .core-color-area, .core-color-slider-track, .core-color-wheel-track, .core-combo-box-trigger, .core-select-trigger, .core-token-input { border-width: 2px; }
  .core-list-box-item[aria-selected='true'], .core-grid-list-item[aria-selected='true'], .core-tab[aria-selected='true'], .core-tree-item[aria-selected='true'], .core-virtualizer-item[aria-selected='true'] { outline: 2px solid currentColor; outline-offset: -2px; }
  .core-list-box-item[data-focus-visible], .core-grid-list-item[data-focus-visible], .core-color-swatch-picker-item[data-focus-visible], .core-table-row[data-focus-visible] { outline-width: 3px; }
}
`;
const fieldCss = `
.core-form { display: flex; flex-direction: column; gap: var(--core-reference-dimension-space-xs); inline-size: 100%; }
.core-text-field, .core-search-field, .core-number-field, .core-date-field, .core-time-field, .core-date-picker, .core-date-range-picker, .core-autocomplete { display: flex; flex-direction: column; gap: var(--core-reference-dimension-space-2xs); inline-size: 100%; max-inline-size: 32rem; }
.core-field-label { color: inherit; font: inherit; font-weight: 600; line-height: 1.25; }
.core-field-description { color: inherit; opacity: .78; font-size: .875em; line-height: 1.35; }
.core-field-error { color: var(--core-semantic-feedback-invalid); font-size: .875em; line-height: 1.35; }
.core-field-input, .core-date-input { box-sizing: border-box; min-block-size: var(--core-semantic-control-min-height); inline-size: 100%; border: 1px solid color-mix(in srgb, currentColor 55%, transparent); border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-field-background); color: inherit; font: inherit; line-height: 1.35; }
.core-field-input { padding: var(--core-semantic-control-padding-inline); }
.core-field-input:hover:not(:disabled), .core-date-input:hover:not([aria-disabled='true']) { border-color: currentColor; }
.core-field-input:focus-visible, .core-date-input:focus-within, .core-number-control:focus-within, .core-date-control:focus-within, .core-date-range-control:focus-within { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-field-input:disabled, [data-disabled] .core-field-input, [data-disabled] .core-date-input { cursor: not-allowed; opacity: .55; }
[data-readonly] .core-field-input, [data-readonly] .core-date-input { background: color-mix(in srgb, var(--core-semantic-field-background) 70%, currentColor); }
[data-invalid] .core-field-input, [data-invalid] .core-date-input, [data-invalid] .core-number-control, [data-invalid] .core-date-control, [data-invalid] .core-date-range-control { border-color: var(--core-semantic-feedback-invalid); }
.core-checkbox-group { display: flex; flex-direction: column; gap: var(--core-reference-dimension-space-2xs); inline-size: 100%; max-inline-size: 32rem; padding: var(--core-semantic-control-padding-inline); border: 1px solid color-mix(in srgb, currentColor 55%, transparent); border-radius: var(--core-semantic-control-radius); }
.core-checkbox-group:focus-within { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-number-control, .core-date-control, .core-date-range-control { display: inline-flex; align-items: stretch; gap: 0; min-block-size: var(--core-semantic-control-min-height); border: 1px solid color-mix(in srgb, currentColor 55%, transparent); border-radius: var(--core-semantic-control-radius); overflow: hidden; }
.core-number-control .core-field-input { min-inline-size: 5rem; flex: 1 1 auto; border: 0; border-radius: 0; }
.core-number-stepper, .core-date-trigger, .core-search-clear { display: inline-flex; align-items: center; justify-content: center; min-block-size: var(--core-semantic-control-min-height); padding-inline: var(--core-reference-dimension-space-2xs); border: 0; border-inline-start: 1px solid color-mix(in srgb, currentColor 30%, transparent); background: transparent; color: inherit; font: inherit; cursor: pointer; }
.core-number-stepper:hover:not(:disabled), .core-date-trigger:hover:not(:disabled), .core-search-clear:hover:not(:disabled) { background: color-mix(in srgb, currentColor 12%, transparent); }
.core-number-stepper:active:not(:disabled), .core-date-trigger:active:not(:disabled), .core-search-clear:active:not(:disabled) { background: color-mix(in srgb, currentColor 20%, transparent); }
.core-number-stepper:focus-visible, .core-date-trigger:focus-visible, .core-search-clear:focus-visible { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: -2px; }
.core-number-stepper:disabled, .core-date-trigger:disabled, .core-search-clear:disabled { cursor: not-allowed; opacity: .5; }
.core-search-field { position: relative; }
.core-search-field .core-field-input { padding-inline-end: 4rem; }
.core-search-clear { position: absolute; inset-inline-end: .25rem; inset-block-end: 0; min-block-size: calc(var(--core-semantic-control-min-height) - .5rem); border: 0; }
.core-date-input { display: inline-flex; align-items: center; inline-size: auto; min-inline-size: 10rem; padding-inline: var(--core-semantic-control-padding-inline); border: 0; border-radius: 0; }
.core-date-segment { padding: .125rem .0625rem; border-radius: .125rem; }
.core-date-segment[data-focused] { background: var(--core-semantic-focus-ring); color: Canvas; }
.core-date-range-control .core-date-input { min-inline-size: 8rem; }
.core-date-range-separator { display: inline-flex; align-items: center; padding-inline: var(--core-reference-dimension-space-2xs); }
.core-date-popover { min-inline-size: 18rem; padding: var(--core-semantic-control-padding-inline); border: 1px solid color-mix(in srgb, currentColor 55%, transparent); border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-overlay-background); box-shadow: 0 8px 24px rgb(0 0 0 / 24%); }
.core-date-dialog { outline: none; }
.core-calendar { display: grid; gap: var(--core-reference-dimension-space-2xs); }
.core-calendar-grid { border-spacing: .125rem; }
.core-calendar-cell { inline-size: 2rem; block-size: 2rem; border-radius: var(--core-semantic-control-radius); color: inherit; }
.core-calendar-cell:hover:not([aria-disabled='true']), .core-calendar-cell[data-focused] { background: color-mix(in srgb, var(--core-semantic-selection-track) 22%, transparent); }
.core-calendar-cell[aria-selected='true'], .core-calendar-cell[data-selected] { background: var(--core-semantic-selection-track); color: Canvas; }
.core-autocomplete-search { inline-size: 100%; }
.core-autocomplete-list { display: flex; flex-direction: column; gap: .125rem; min-inline-size: 100%; max-block-size: 16rem; margin: .25rem 0 0; padding: .25rem; overflow-y: auto; border: 1px solid color-mix(in srgb, currentColor 55%, transparent); border-radius: var(--core-semantic-control-radius); background: var(--core-semantic-overlay-background); box-shadow: 0 8px 24px rgb(0 0 0 / 24%); list-style: none; }
.core-autocomplete-option { padding: var(--core-reference-dimension-space-2xs) var(--core-semantic-control-padding-inline); border-radius: calc(var(--core-semantic-control-radius) - 1px); cursor: pointer; }
.core-autocomplete-option:hover, .core-autocomplete-option[data-focused], .core-autocomplete-option[aria-selected='true'] { background: color-mix(in srgb, var(--core-semantic-selection-track) 20%, transparent); }
.core-autocomplete-option[aria-selected='true'] { color: var(--core-semantic-selection-track); font-weight: 600; }
.core-switch { position: relative; display: inline-flex; align-items: center; gap: var(--core-reference-dimension-space-2xs); inline-size: fit-content; cursor: pointer; }
.core-switch input { position: absolute; inline-size: 1px; block-size: 1px; opacity: 0; }
.core-switch-indicator { position: relative; display: inline-block; inline-size: 2.5rem; block-size: 1.5rem; flex: 0 0 auto; border: 1px solid currentColor; border-radius: 999px; background: transparent; transition: background-color var(--core-semantic-motion-feedback) ease; }
.core-switch-indicator::after { position: absolute; inset-block-start: .1875rem; inset-inline-start: .1875rem; inline-size: 1rem; block-size: 1rem; border-radius: 50%; background: currentColor; content: ''; transition: inset-inline-start var(--core-semantic-motion-feedback) ease; }
.core-switch-indicator[data-selected] { border-color: var(--core-semantic-selection-track); background: var(--core-semantic-selection-track); color: Canvas; }
.core-switch-indicator[data-selected]::after { inset-inline-start: 1.1875rem; background: currentColor; }
.core-switch:focus-within { outline: 2px solid var(--core-semantic-focus-ring); outline-offset: 2px; }
.core-switch[data-disabled] { cursor: not-allowed; opacity: .55; }
.core-switch[data-invalid] .core-switch-indicator { border-color: var(--core-semantic-feedback-invalid); }
@media (prefers-reduced-motion: reduce) { .core-switch-indicator, .core-switch-indicator::after { transition: none; } }
@media (forced-colors: active) {
  .core-field-input, .core-date-input, .core-number-control, .core-date-control, .core-date-range-control, .core-checkbox-group, .core-date-popover, .core-autocomplete-list, .core-switch-indicator { border-color: ButtonText; background: Canvas; color: CanvasText; box-shadow: none; }
  .core-field-input:focus-visible, .core-date-input:focus-within, .core-number-control:focus-within, .core-date-control:focus-within, .core-date-range-control:focus-within, .core-switch:focus-within { outline-color: Highlight; }
  [data-invalid] .core-field-input, [data-invalid] .core-date-input, [data-invalid] .core-number-control, [data-invalid] .core-date-control, [data-invalid] .core-date-range-control, .core-switch[data-invalid] .core-switch-indicator { border-color: Mark; }
  .core-number-stepper, .core-date-trigger, .core-search-clear { color: ButtonText; }
  .core-calendar-cell[aria-selected='true'], .core-calendar-cell[data-selected], .core-autocomplete-option[aria-selected='true'], .core-switch-indicator[data-selected] { background: Highlight; color: HighlightText; }
  .core-switch-indicator::after { background: ButtonText; }
}
@media (prefers-contrast: more) {
  .core-field-input, .core-date-input, .core-number-control, .core-date-control, .core-date-range-control, .core-checkbox-group, .core-date-popover, .core-autocomplete-list, .core-switch-indicator { border-width: 2px; }
  .core-field-label, .core-field-error { font-weight: 700; }
  .core-autocomplete-option[aria-selected='true'], .core-calendar-cell[aria-selected='true'], .core-calendar-cell[data-selected] { outline: 2px solid currentColor; outline-offset: -2px; }
}
`;
const fullCssBody = `${cssBody}\n${componentCss}${collectionCss}${fieldCss}`;

const compatibility = {
  schema: 'core-ui-react-compatibility-v1',
  package: manifest.name,
  version: manifest.version,
  upstream: { package: 'react-aria-components', version: '1.20.0', gitHead: '5ecb3333001313e83898cd07644227897e3bae1f' },
  tokenSource: { path: 'catalog/tokens/default-theme.json', sha256: expectedTokenSha256 },
  support: 'unproved; R1.3 React exports only',
};
const compatibilityBody = `function deepFreeze(value) {\n  if (value && typeof value === 'object' && !Object.isFrozen(value)) {\n    Object.freeze(value);\n    for (const child of Object.values(value)) deepFreeze(child);\n  }\n  return value;\n}\nexport const reactCompatibility = deepFreeze(${canonicalJson(compatibility)});\n`;
const indexBody = "export { reactCompatibility } from './compatibility.mjs';\nexport { Button } from './button.mjs';\nexport { Breadcrumbs, Checkbox, Disclosure, DisclosureGroup, Group, Link, Meter, ProgressBar, Separator, ToggleButton, Autocomplete, CheckboxGroup, DateField, DatePicker, DateRangePicker, Form, NumberField, SearchField, Switch, TextField, TimeField } from './components.mjs';\nexport { Calendar, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorWheel, ComboBox, GridList, ListBox, Menu, RadioGroup, RangeCalendar, Select, Slider, Table, Tabs, TagGroup, ToggleButtonGroup, TokenField, Toolbar, Tree, Virtualizer } from './collections.mjs';\n";
const typesBody = `import type * as React from 'react';

export type ButtonPointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual' | undefined;
export type ComponentPointerType = ButtonPointerType;
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
export interface BreadcrumbItem { id?: string; label: React.ReactNode; href?: string; }
export interface BreadcrumbsProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'aria-label'> { items?: BreadcrumbItem[]; className?: string; 'aria-label': string; onNavigate?: (item: BreadcrumbItem) => void; }
export declare const Breadcrumbs: React.ForwardRefExoticComponent<BreadcrumbsProps & React.RefAttributes<HTMLElement>>;
export interface CheckboxProps extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children' | 'className' | 'onChange'> { children?: React.ReactNode; className?: string; checked?: boolean; defaultChecked?: boolean; disabled?: boolean; indeterminate?: boolean; invalid?: boolean; name?: string; required?: boolean; value?: string; onChange?: (checked: boolean) => void; }
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLLabelElement>>;
export interface DisclosureProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'id' | 'title'> { title: React.ReactNode; children?: React.ReactNode; id?: string; expanded?: boolean; defaultExpanded?: boolean; disabled?: boolean; className?: string; onExpandedChange?: (expanded: boolean) => void; }
export declare const Disclosure: React.ForwardRefExoticComponent<DisclosureProps & React.RefAttributes<HTMLDivElement>>;
export interface DisclosureGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'> { children?: React.ReactNode; expandedIds?: string[]; defaultExpandedIds?: string[]; multiple?: boolean; disabled?: boolean; className?: string; onExpandedChange?: (expandedIds: string[]) => void; }
export declare const DisclosureGroup: React.ForwardRefExoticComponent<DisclosureGroupProps & React.RefAttributes<HTMLDivElement>>;
export interface GroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'role'> { children?: React.ReactNode; className?: string; disabled?: boolean; invalid?: boolean; readOnly?: boolean; role?: 'group' | 'region' | 'presentation'; }
export declare const Group: React.ForwardRefExoticComponent<GroupProps & React.RefAttributes<HTMLDivElement>>;
export interface LinkActivationEvent { readonly type: 'activate'; readonly pointerType: ComponentPointerType; readonly target: HTMLAnchorElement; }
export interface LinkProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'onClick'> { children?: React.ReactNode; className?: string; href?: string; disabled?: boolean; current?: boolean; target?: string; rel?: string; onActivate?: (event: LinkActivationEvent) => void; }
export declare const Link: React.ForwardRefExoticComponent<LinkProps & React.RefAttributes<HTMLElement>>;
export interface MeterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'> { label: React.ReactNode; value?: number; minValue?: number; maxValue?: number; formatOptions?: Intl.NumberFormatOptions; className?: string; }
export declare const Meter: React.ForwardRefExoticComponent<MeterProps & React.RefAttributes<HTMLDivElement>>;
export interface ProgressBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className'> { label: React.ReactNode; value?: number; minValue?: number; maxValue?: number; className?: string; }
export declare const ProgressBar: React.ForwardRefExoticComponent<ProgressBarProps & React.RefAttributes<HTMLDivElement>>;
export interface SeparatorProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'> { orientation?: 'horizontal' | 'vertical'; className?: string; }
export declare const Separator: React.ForwardRefExoticComponent<SeparatorProps & React.RefAttributes<HTMLElement>>;
export interface ToggleButtonActivationEvent { readonly type: 'activate'; readonly pointerType: ComponentPointerType; readonly target: HTMLButtonElement; }
export interface ToggleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'onChange' | 'onClick'> { children?: React.ReactNode; className?: string; selected?: boolean; defaultSelected?: boolean; disabled?: boolean; onChange?: (selected: boolean) => void; onActivate?: (event: ToggleButtonActivationEvent) => void; }
export declare const ToggleButton: React.ForwardRefExoticComponent<ToggleButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const reactCompatibility: Readonly<Record<string, unknown>>;
`;
const fieldsTypes = `
export type CoreDateValue = string;
export interface CoreDateRange { start: CoreDateValue; end: CoreDateValue; }
export interface FieldValidationProps { description?: React.ReactNode; errorMessage?: React.ReactNode; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; className?: string; }
export type CoreAccessibleName =
  | { label: Exclude<React.ReactNode, null | undefined | boolean>; 'aria-label'?: never; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label': string; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label'?: never; 'aria-labelledby': string };
export type CoreAriaAccessibleName =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-label'?: never; 'aria-labelledby': string };
export type CoreAriaLabel = { 'aria-label': string };
export type NamedFieldProps = FieldValidationProps & CoreAccessibleName;
export type TextFieldProps = NamedFieldProps & { value?: string; defaultValue?: string; onChange?: (value: string) => void; name?: string; placeholder?: string; type?: 'text' | 'email' | 'password' | 'url' | 'tel'; };
export declare const TextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<HTMLDivElement>>;
export type SearchFieldProps = NamedFieldProps & { value?: string; defaultValue?: string; onChange?: (value: string) => void; onSubmit?: (value: string) => void; onClear?: () => void; name?: string; placeholder?: string; };
export declare const SearchField: React.ForwardRefExoticComponent<SearchFieldProps & React.RefAttributes<HTMLDivElement>>;
export type NumberFieldProps = NamedFieldProps & { value?: number; defaultValue?: number; onChange?: (value: number) => void; name?: string; minValue?: number; maxValue?: number; step?: number; formatOptions?: Intl.NumberFormatOptions; };
export declare const NumberField: React.ForwardRefExoticComponent<NumberFieldProps & React.RefAttributes<HTMLDivElement>>;
export type CheckboxGroupProps = NamedFieldProps & { value?: string[]; defaultValue?: string[]; onChange?: (value: string[]) => void; name?: string; children?: React.ReactNode; };
export declare const CheckboxGroup: React.ForwardRefExoticComponent<CheckboxGroupProps & React.RefAttributes<HTMLDivElement>>;
export type SwitchProps = CoreAccessibleName & { description?: React.ReactNode; errorMessage?: React.ReactNode; disabled?: boolean; readOnly?: boolean; className?: string; children?: React.ReactNode; selected?: boolean; defaultSelected?: boolean; onChange?: (selected: boolean) => void; name?: string; value?: string; };
export declare const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLDivElement>>;
export interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'children' | 'className' | 'onSubmit' | 'onReset'> { children?: React.ReactNode; className?: string; validationBehavior?: 'aria' | 'native'; onSubmit?: React.FormEventHandler<HTMLFormElement>; onReset?: React.FormEventHandler<HTMLFormElement>; }
export declare const Form: React.ForwardRefExoticComponent<FormProps & React.RefAttributes<HTMLFormElement>>;
export type DateFieldProps = NamedFieldProps & { value?: CoreDateValue; defaultValue?: CoreDateValue; onChange?: (value?: CoreDateValue) => void; name?: string; };
export declare const DateField: React.ForwardRefExoticComponent<DateFieldProps & React.RefAttributes<HTMLDivElement>>;
export type TimeFieldProps = NamedFieldProps & { value?: string; defaultValue?: string; onChange?: (value?: string) => void; name?: string; };
export declare const TimeField: React.ForwardRefExoticComponent<TimeFieldProps & React.RefAttributes<HTMLDivElement>>;
export type DatePickerProps = DateFieldProps & { onOpenChange?: (isOpen: boolean) => void; };
export declare const DatePicker: React.ForwardRefExoticComponent<DatePickerProps & React.RefAttributes<HTMLDivElement>>;
export type DateRangePickerProps = NamedFieldProps & { value?: CoreDateRange; defaultValue?: CoreDateRange; onChange?: (value?: CoreDateRange) => void; startName?: string; endName?: string; onOpenChange?: (isOpen: boolean) => void; };
export declare const DateRangePicker: React.ForwardRefExoticComponent<DateRangePickerProps & React.RefAttributes<HTMLDivElement>>;
export interface AutocompleteItem { id?: string; label?: React.ReactNode; value?: string; }
export interface AutocompleteSelectionItem { id: string; label: React.ReactNode; value: string; }
export type AutocompleteProps = NamedFieldProps & { items?: Array<AutocompleteItem | string>; value?: string; defaultValue?: string; onChange?: (value: string) => void; onSelect?: (item?: AutocompleteSelectionItem) => void; name?: string; placeholder?: string; };
export declare const Autocomplete: React.ForwardRefExoticComponent<AutocompleteProps & React.RefAttributes<HTMLDivElement>>;
`;
const collectionsTypes = `
export type CoreColorValue = string;
export interface CoreCollectionItem { id?: string; key?: string; label?: React.ReactNode; value?: string; textValue?: string; disabled?: boolean; [key: string]: unknown; }
export type CoreSelection = string[] | 'all';
export type CoreItems = Array<CoreCollectionItem | string>;
export type CalendarProps = CoreAccessibleName & { value?: CoreDateValue; defaultValue?: CoreDateValue; focusedValue?: CoreDateValue; minValue?: CoreDateValue; maxValue?: CoreDateValue; onChange?: (value?: CoreDateValue) => void; onFocusChange?: (value?: CoreDateValue) => void; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; className?: string; };
export declare const Calendar: React.ForwardRefExoticComponent<CalendarProps & React.RefAttributes<HTMLDivElement>>;
export type RangeCalendarProps = CoreAccessibleName & { value?: CoreDateRange; defaultValue?: CoreDateRange; minValue?: CoreDateValue; maxValue?: CoreDateValue; onChange?: (value?: CoreDateRange) => void; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; className?: string; };
export declare const RangeCalendar: React.ForwardRefExoticComponent<RangeCalendarProps & React.RefAttributes<HTMLDivElement>>;
export type ColorAreaProps = CoreAccessibleName & { value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; readOnly?: boolean; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorArea: React.ForwardRefExoticComponent<ColorAreaProps & React.RefAttributes<HTMLDivElement>>;
export type ColorFieldProps = NamedFieldProps & { value?: CoreColorValue; defaultValue?: CoreColorValue; onChange?: (value: CoreColorValue) => void; name?: string; };
export declare const ColorField: React.ForwardRefExoticComponent<ColorFieldProps & React.RefAttributes<HTMLDivElement>>;
export type ColorPickerProps = { value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; readOnly?: boolean; onChange?: (value: CoreColorValue) => void; children?: React.ReactNode; className?: string; };
export declare const ColorPicker: React.ForwardRefExoticComponent<ColorPickerProps & React.RefAttributes<HTMLDivElement>>;
export type ColorSliderProps = CoreAccessibleName & { value?: CoreColorValue; defaultValue?: CoreColorValue; channel?: string; colorSpace?: string; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorSlider: React.ForwardRefExoticComponent<ColorSliderProps & React.RefAttributes<HTMLDivElement>>;
export type ColorSwatchProps = { color: CoreColorValue; disabled?: boolean; className?: string; };
export declare const ColorSwatch: React.ForwardRefExoticComponent<ColorSwatchProps & React.RefAttributes<HTMLDivElement>>;
export type ColorSwatchPickerProps = CoreAriaAccessibleName & { items?: CoreItems; value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorSwatchPicker: React.ForwardRefExoticComponent<ColorSwatchPickerProps & React.RefAttributes<HTMLDivElement>>;
export type ColorWheelProps = CoreAriaAccessibleName & { value?: CoreColorValue; defaultValue?: CoreColorValue; disabled?: boolean; onChange?: (value: CoreColorValue) => void; className?: string; };
export declare const ColorWheel: React.ForwardRefExoticComponent<ColorWheelProps & React.RefAttributes<HTMLDivElement>>;
export type CollectionProps = CoreAriaAccessibleName & { items?: CoreItems; selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; disabled?: boolean; selectionMode?: 'none' | 'single' | 'multiple'; onSelectionChange?: (ids: CoreSelection) => void; onAction?: (item?: CoreCollectionItem) => void; className?: string; };
export type GridListProps = CollectionProps;
export declare const GridList: React.ForwardRefExoticComponent<GridListProps & React.RefAttributes<HTMLDivElement>>;
export type ListBoxProps = CollectionProps;
export declare const ListBox: React.ForwardRefExoticComponent<ListBoxProps & React.RefAttributes<HTMLDivElement>>;
export type MenuProps = CoreAriaAccessibleName & { items?: CoreItems; disabled?: boolean; shouldCloseOnSelect?: boolean; onAction?: (item?: CoreCollectionItem) => void; onSelect?: (item?: CoreCollectionItem) => void; className?: string; };
export declare const Menu: React.ForwardRefExoticComponent<MenuProps & React.RefAttributes<HTMLDivElement>>;
export type RadioOption = { id?: string; value: string; label?: React.ReactNode; disabled?: boolean; };
export type RadioGroupProps = CoreAccessibleName & { options?: RadioOption[]; value?: string; defaultValue?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; onChange?: (value: string) => void; className?: string; };
export declare const RadioGroup: React.ForwardRefExoticComponent<RadioGroupProps & React.RefAttributes<HTMLDivElement>>;
export type SelectProps = NamedFieldProps & { items?: CoreItems; value?: string; defaultValue?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; name?: string; placeholder?: string; onChange?: (value?: string) => void; };
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLDivElement>>;
export type ComboBoxProps = NamedFieldProps & { items?: CoreItems; value?: string; defaultValue?: string; selectedId?: string; defaultSelectedId?: string; disabled?: boolean; readOnly?: boolean; required?: boolean; invalid?: boolean; name?: string; placeholder?: string; onChange?: (value: string) => void; onSelect?: (item?: CoreCollectionItem) => void; };
export declare const ComboBox: React.ForwardRefExoticComponent<ComboBoxProps & React.RefAttributes<HTMLDivElement>>;
export type SliderProps = CoreAccessibleName & { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onChange?: (value: number) => void; className?: string; };
export declare const Slider: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<HTMLDivElement>>;
export interface CoreTableColumn extends CoreCollectionItem { isRowHeader?: boolean; sortable?: boolean; }
export interface CoreTableRow extends CoreCollectionItem { values?: Record<string, React.ReactNode>; }
export type TableProps = CoreAriaLabel & { columns?: CoreTableColumn[]; rows?: CoreTableRow[]; selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; disabled?: boolean; selectionMode?: 'none' | 'single' | 'multiple'; onSelectionChange?: (ids: CoreSelection) => void; onRowAction?: (row?: CoreTableRow) => void; className?: string; };
export declare const Table: React.ForwardRefExoticComponent<TableProps & React.RefAttributes<HTMLTableElement>>;
export type TabsProps = CoreAriaAccessibleName & { items?: CoreItems; value?: string; defaultValue?: string; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onChange?: (value: string) => void; className?: string; };
export declare const Tabs: React.ForwardRefExoticComponent<TabsProps & React.RefAttributes<HTMLDivElement>>;
export type TagGroupProps = CoreAccessibleName & { items?: CoreItems; disabled?: boolean; onRemove?: (items: CoreCollectionItem[]) => void; onAction?: (item?: CoreCollectionItem) => void; className?: string; };
export declare const TagGroup: React.ForwardRefExoticComponent<TagGroupProps & React.RefAttributes<HTMLDivElement>>;
export type ToggleButtonGroupProps = CoreAriaAccessibleName & { selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; disabled?: boolean; orientation?: 'horizontal' | 'vertical'; onSelectionChange?: (ids: CoreSelection) => void; children?: React.ReactNode; className?: string; };
export declare const ToggleButtonGroup: React.ForwardRefExoticComponent<ToggleButtonGroupProps & React.RefAttributes<HTMLDivElement>>;
export type TokenFieldProps = CoreAccessibleName & { value?: string[]; defaultValue?: string[]; disabled?: boolean; readOnly?: boolean; name?: string; placeholder?: string; onChange?: (value: string[]) => void; className?: string; };
export declare const TokenField: React.ForwardRefExoticComponent<TokenFieldProps & React.RefAttributes<HTMLDivElement>>;
export type ToolbarProps = CoreAriaAccessibleName & { orientation?: 'horizontal' | 'vertical'; disabled?: boolean; children?: React.ReactNode; className?: string; };
export declare const Toolbar: React.ForwardRefExoticComponent<ToolbarProps & React.RefAttributes<HTMLDivElement>>;
export interface CoreTreeItem extends CoreCollectionItem { children?: CoreTreeItem[]; items?: CoreTreeItem[]; }
export type TreeProps = CoreAriaAccessibleName & { items?: CoreTreeItem[]; selectedIds?: CoreSelection; defaultSelectedIds?: CoreSelection; expandedIds?: CoreSelection; defaultExpandedIds?: CoreSelection; disabled?: boolean; selectionMode?: 'none' | 'single' | 'multiple'; onSelectionChange?: (ids: CoreSelection) => void; onExpandedChange?: (ids: CoreSelection) => void; onAction?: (item?: CoreTreeItem) => void; className?: string; };
export declare const Tree: React.ForwardRefExoticComponent<TreeProps & React.RefAttributes<HTMLDivElement>>;
export type VirtualizerProps = CoreAriaLabel & { items?: CoreItems; height?: number; itemHeight?: number; overscan?: number; disabled?: boolean; onScroll?: React.UIEventHandler<HTMLDivElement>; className?: string; style?: React.CSSProperties; };
export declare const Virtualizer: React.ForwardRefExoticComponent<VirtualizerProps & React.RefAttributes<HTMLDivElement>>;
`;
const reactTypesBody = typesBody.replace("export const reactCompatibility: Readonly<Record<string, unknown>>;\n", `export const reactCompatibility: Readonly<Record<string, unknown>>;\n${fieldsTypes}${collectionsTypes}`);
const testingBody = "export const reactPlatformSafetyFixture = Object.freeze({ componentSupportClaim: 'none', fixture: 'r1.3-react-collections' });\n";
const readmeBody = `# @core-ui/react\n\nExperimental, unpublished R1.3 React slice for the standalone Core UI renderer.\n\n- Button, Breadcrumbs, Checkbox, Disclosure, DisclosureGroup, Group, Link, Meter, ProgressBar, Separator, ToggleButton, Autocomplete, CheckboxGroup, DateField, DatePicker, DateRangePicker, Form, NumberField, SearchField, Switch, TextField, TimeField, Calendar, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorWheel, ComboBox, GridList, ListBox, Menu, RadioGroup, RangeCalendar, Select, Slider, Table, Tabs, TagGroup, ToggleButtonGroup, TokenField, Toolbar, Tree, and Virtualizer are Core-owned public exports for the \`web.react\` binding.\n- React Aria Components 1.20.0 is an internal replaceable substrate.\n- Core owns the public APIs, tokens, styling, accessibility, lifecycle, and support boundary.\n- Tale UI is a pinned styling donor, never a dependency.\n\nThe package remains private and unpublished until the separately authorized React prerelease boundary.\n`;
const descriptorRecord = {
  schema: 'core-ui-renderer-descriptor-v1', generatedFrom: 'packages/react/src/generate.mjs',
  package: manifest.name, version: manifest.version, support: 'unproved; R1.3 React exports only',
  bindings: componentArtifacts.map((artifact) => ({
    binding: `${artifact.id}#web.react`, export: artifact.name, module: '.',
    lifecycle: 'experimental', strategy: 'direct', runtimeProfile: 'web.react',
    selector: `.core-${artifact.id.slice('core:component:'.length)}`, states: artifact.states, api: artifact.bindings['web.react'].api,
  })),
  exports: componentArtifacts.map((artifact) => ({ name: artifact.name, kind: 'component', binding: `${artifact.id}#web.react`, module: '.' })),
};
const releaseRecord = {
  schema: 'core-ui-react-release-candidate-v1', generatedFrom: 'packages/react/src/generate.mjs',
  package: manifest.name, version: manifest.version, lifecycle: 'experimental',
  componentExports: componentArtifacts.map((artifact) => ({ name: artifact.name, export: artifact.name, binding: `${artifact.id}#web.react`, module: '.' })),
  bindings: componentArtifacts.map((artifact) => ({ binding: `${artifact.id}#web.react`, package: manifest.name, export: artifact.name, lifecycle: 'experimental', strategy: 'direct', runtimeProfile: 'web.react' })),
  runtimeProfiles: ['web.react'],
  packagePrivate: manifest.private,
  catalog: { status: 'bound', components: componentArtifacts.map((artifact) => ({ component: artifact.id, binding: `${artifact.id}#web.react`, states: artifact.states })) },
  tokenSource: { path: 'catalog/tokens/default-theme.json', sha256: expectedTokenSha256 },
  evidence: { status: 'pending', ids: ['E-R1.3-01', 'E-R1.3-02', 'E-R1.3-03', 'E-R1.3-04', 'E-R1.3-05'] },
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
  result: { cssSha256: `sha256:${sha256(fullCssBody)}`, selector: '.core-button', status: 'adapted-for-r1.1-button' },
};
const componentDonorComparisonRecord = {
  schema: 'core-ui-react-component-donor-comparison-v1', generatedFrom: 'packages/react/src/generate.mjs',
  donor: { name: crosswalk.donor.name, commit: crosswalk.donor.commit, tree: crosswalk.donor.tree },
  components: componentArtifacts.map((artifact) => {
    const slug = artifact.id.slice('core:component:'.length);
    const source = artifact.name === 'Button' ? crosswalk.button : crosswalk.components[slug] ?? r12Crosswalk.components[slug] ?? r13Crosswalk.components[slug];
    return { ...(source?.donorInputs ? { donorInputs: source.donorInputs } : {}), component: artifact.name, binding: `${artifact.id}#web.react`, disposition: source.disposition, selector: `.core-${slug}`, rules: source.rules };
  }),
};
const r11Artifacts = componentArtifacts.filter((artifact) => {
  const slug = artifact.id.slice('core:component:'.length);
  return !r12Slugs.includes(slug) && !r13Slugs.includes(slug);
});
const r11DescriptorRecord = {
  ...descriptorRecord,
  support: 'unproved; R1.1 React exports only',
  bindings: descriptorRecord.bindings.filter(({ binding }) => !r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`) && !r13Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
  exports: descriptorRecord.exports.filter(({ binding }) => !r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`) && !r13Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
};
const r11ReleaseRecord = {
  ...releaseRecord,
  componentExports: releaseRecord.componentExports.filter(({ binding }) => !r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`) && !r13Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
  bindings: releaseRecord.bindings.filter(({ binding }) => !r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`) && !r13Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
  catalog: { ...releaseRecord.catalog, components: releaseRecord.catalog.components.filter(({ component }) => !r12Slugs.includes(component.slice('core:component:'.length)) && !r13Slugs.includes(component.slice('core:component:'.length))) },
  evidence: { status: 'pending', ids: ['E-R1.1-01', 'E-R1.1-02', 'E-R1.1-03', 'E-R1.1-04'] },
};
const r11ComponentDonorComparisonRecord = {
  ...componentDonorComparisonRecord,
  components: componentDonorComparisonRecord.components.filter(({ component }) => r11Artifacts.some(({ name }) => name === component)),
};
assertReactR11GeneratedContracts({ descriptor: r11DescriptorRecord, release: r11ReleaseRecord, donorComparison: donorComparisonRecord, componentDonorComparison: r11ComponentDonorComparisonRecord, manifest, crosswalk });
const r12DonorComparisonRecord = {
  schema: 'core-ui-react-r1-2-donor-comparison-v1',
  generatedFrom: 'packages/react/src/generate.mjs',
  donor: r12Crosswalk.donor,
  components: r12Slugs.map((slug) => {
  const source = EXPECTED_R12_DONOR_CONTRACT.components[slug];
    return { component: componentArtifacts.find(({ id }) => id === `core:component:${slug}`).name, binding: `core:component:${slug}#web.react`, disposition: source.disposition, selector: `.core-${slug}`, donorInputs: source.donorInputs, tokenHooks: source.tokenHooks, rules: source.rules, result: { cssSelector: `.core-${slug}`, status: 'adapted-for-r1.2' } };
  }),
};
for (const slug of r12Slugs) {
  for (const hook of EXPECTED_R12_DONOR_CONTRACT.components[slug].tokenHooks) {
    if (!fullCssBody.includes(`--core-${hook.replaceAll('.', '-')}`)) throw new Error(`CORE_REACT_R12_TOKEN_HOOK_UNCONSUMED: ${slug}:${hook}`);
  }
}
const r12DescriptorRecord = {
  ...descriptorRecord,
  support: 'unproved; R1.2 React exports only',
  bindings: descriptorRecord.bindings.filter(({ binding }) => r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
  exports: descriptorRecord.exports.filter(({ binding }) => r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
};
const r12ReleaseRecord = {
  ...releaseRecord,
  componentExports: releaseRecord.componentExports.filter(({ binding }) => r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
  bindings: releaseRecord.bindings.filter(({ binding }) => r12Slugs.some((slug) => binding === `core:component:${slug}#web.react`)),
  catalog: { ...releaseRecord.catalog, components: releaseRecord.catalog.components.filter(({ component }) => r12Slugs.includes(component.slice('core:component:'.length))) },
  evidence: { status: 'pending', ids: ['E-R1.2-01', 'E-R1.2-02', 'E-R1.2-03', 'E-R1.2-04'] },
};
assertReactR12GeneratedContracts({ descriptor: r12DescriptorRecord, release: r12ReleaseRecord, donorComparison: r12DonorComparisonRecord, manifest, componentNames: r12Slugs.map((slug) => componentArtifacts.find(({ id }) => id === `core:component:${slug}`).name), crosswalk: r12Crosswalk });
const r13DonorComparisonRecord = {
  schema: 'core-ui-react-r1-3-donor-comparison-v1',
  generatedFrom: 'packages/react/src/generate.mjs',
  donor: r13Crosswalk.donor,
  components: r13Slugs.map((slug) => {
    const source = EXPECTED_R13_DONOR_CONTRACT.components[slug];
    const artifact = componentArtifacts.find(({ id }) => id === `core:component:${slug}`);
    return {
      component: artifact.name,
      binding: `${artifact.id}#web.react`,
      disposition: source.disposition,
      selector: `.core-${slug}`,
      donorInputs: source.donorInputs,
      tokenHooks: source.tokenHooks,
      rules: source.rules,
      result: { cssSelector: `.core-${slug}`, status: source.disposition === 'no-applicable-donor' ? 'no-applicable-donor' : 'adapted-for-r1.3' },
    };
  }),
};
for (const slug of r13Slugs) {
  const source = EXPECTED_R13_DONOR_CONTRACT.components[slug];
  for (const hook of source.tokenHooks) {
    if (!fullCssBody.includes(`--core-${hook.replaceAll('.', '-')}`)) throw new Error(`CORE_REACT_R13_TOKEN_HOOK_UNCONSUMED: ${slug}:${hook}`);
  }
}
assertReactR13GeneratedContracts({ descriptor: descriptorRecord, release: releaseRecord, donorComparison: r13DonorComparisonRecord, manifest, componentNames: componentArtifacts.map(({ name }) => name), crosswalk: r13Crosswalk, collectionsSource });
const descriptor = `${canonicalJson(descriptorRecord)}\n`;
const release = `${canonicalJson(releaseRecord)}\n`;
const donorComparison = `${canonicalJson(donorComparisonRecord)}\n`;
const componentDonorComparison = generatedText(
  'packages/react/src/generate.mjs',
  `${canonicalJson(componentDonorComparisonRecord)}\n`,
);
const r12DonorComparison = generatedText(
  'packages/react/src/generate.mjs',
  `${canonicalJson(r12DonorComparisonRecord)}\n`,
);
const r13DonorComparison = generatedText(
  'packages/react/src/generate.mjs',
  `${canonicalJson(r13DonorComparisonRecord)}\n`,
);
function provenance(path, bytes) {
  const body = `${canonicalJson({ path: `packages/react/generated/${path}`, sha256: `sha256:${sha256(bytes)}` })}\n`;
  return generatedText('packages/react/src/generate.mjs', body);
}

const outputs = new Map([
  ['compatibility.mjs', generatedText('packages/react/src/generate.mjs', compatibilityBody)],
  ['index.mjs', generatedText('packages/react/src/generate.mjs', indexBody)],
  ['index.d.ts', generatedText('packages/react/src/generate.mjs', reactTypesBody)],
  ['button.mjs', generatedText('packages/react/src/button.mjs', buttonSource)],
  ['testing.mjs', generatedText('packages/react/src/generate.mjs', testingBody)],
  ['styles.css', generatedCss('packages/react/src/generate.mjs', fullCssBody)],
  ['descriptor.json', descriptor],
  ['descriptor.json.provenance', provenance('descriptor.json', descriptor)],
  ['release.json', release],
  ['release.json.provenance', provenance('release.json', release)],
  ['button-donor-comparison.json', donorComparison],
  ['button-donor-comparison.json.provenance', provenance('button-donor-comparison.json', donorComparison)],
  ['r1-2-donor-comparison.json', r12DonorComparison],
  ['r1-2-donor-comparison.json.provenance', provenance('r1-2-donor-comparison.json', r12DonorComparison)],
  ['r1-3-donor-comparison.json', r13DonorComparison],
  ['r1-3-donor-comparison.json.provenance', provenance('r1-3-donor-comparison.json', r13DonorComparison)],
  ['component-donor-comparison.json', componentDonorComparison],
  ['component-donor-comparison.json.provenance', provenance('component-donor-comparison.json', componentDonorComparison)],
  ['components.mjs', generatedText('packages/react/src/components.mjs', componentSource)],
  ['fields.mjs', generatedText('packages/react/src/fields.mjs', fieldsSource)],
  ['collections.mjs', generatedText('packages/react/src/collections.mjs', collectionsSource)],
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

console.log('[react] generated standalone R1.3 collection and color projections from canonical owners');
