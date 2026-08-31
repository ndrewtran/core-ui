import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalJson, parseJsonStrict } from '@muxui/schema';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const verifier = path.join(repositoryRoot, 'tooling/audits/repository-policy/src/phase-c-applicability-topology-correction-verify.mjs');
const decisionPath = path.join(repositoryRoot, 'decisions/0006-phase-c-applicability-topology.json');
const scopePath = path.join(repositoryRoot, 'strategy/product-scope.md');
const acceptancePath = path.join(repositoryRoot, 'decisions/0006-phase-c-applicability-topology-acceptance.json');
const source = parseJsonStrict(fs.readFileSync(decisionPath, 'utf8'));
const scope = fs.readFileSync(scopePath, 'utf8');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'muxui-phase-c-authority-negative-'));

const clone = () => structuredClone(source);
const cases = [
  ['unknown top-level decision field', (value) => { value.unknown = true; }],
  ['unknown nested decision field', (value) => { value.proofTopology.maintenance.unknown = true; }],
  ['omitted direct-parent supersession pointer', (value) => { value.supersession.pointers.pop(); }],
  ['overlapping direct-parent pointers', (value) => { value.supersession.preservedPointers.push('/compatibility/currentCatalog'); value.supersession.preservedPointers.sort(); }],
  ['missing retained authority binding', (value) => { value.proofTopology.authorization.requiredAuthorityBindings.shift(); }],
  ['wrong Product Scope authorization version', (value) => { value.proofTopology.authorization.productScopeVersion = '4.0.0'; }],
  ['wrong decision receipt path', (value) => { value.proofTopology.authorization.receiptPath = 'decisions/0005-default-theme-token-source-identity-acceptance.json'; }],
  ['wrong Phase C profile', (value) => { value.proofTopology.phaseC.profile = 'NOT-TALE-TOKEN-C'; }],
  ['wrong maintenance profile', (value) => { value.proofTopology.maintenance.profile = 'wrong'; }],
  ['wrong maintenance reason code', (value) => { value.proofTopology.maintenance.reasonCode = 'wrong'; }],
  ['wrong capture script', (value) => { value.proofTopology.capture.script = 'tests/evidence/wrong.mjs'; }],
  ['wrong capture check mode', (value) => { value.proofTopology.capture.checkMode = 'writes current state'; }],
  ['wrong common source binding', (value) => { value.proofTopology.sourceBinding = 'mixed source revisions permitted'; }],
  ['wrong implementation boundary', (value) => { value.acceptanceTopology.implementationBoundary = 'implementation may begin before acceptance'; }],
  ['missing authority-stage target', (value) => { value.proofTopology.authorityStage.targets.pop(); }],
  ['authority-stage evidence-record claim', (value) => { value.proofTopology.authorityStage.evidenceRecords = 'one'; }],
  ['wrong authority-stage source boundary', (value) => { value.proofTopology.authorityStage.sourceBoundary = 'capture after merge'; }],
  ['future predecessor bypasses authority stage', (value) => { value.proofTopology.phaseC.successorTargets[0].predecessorPath = 'tests/evidence/authority-39-default-theme-identity/supersessions/phase-b-g0.1.json'; }],
  ['missing maintenance target', (value) => { value.proofTopology.maintenance.targets.pop(); }],
  ['duplicate cross-partition target', (value) => { value.proofTopology.maintenance.targets[0] = structuredClone(value.proofTopology.phaseC.successorTargets[0]); }],
  ['coordinated terminal substitution', (value) => {
    const left = structuredClone(value.proofTopology.maintenance.targets[0]);
    value.proofTopology.maintenance.targets[0] = structuredClone(value.proofTopology.maintenance.targets[1]);
    value.proofTopology.maintenance.targets[1] = left;
  }],
  ['wrong exact successor path', (value) => { value.proofTopology.maintenance.targets[0].successorPath += '.wrong'; }],
  ['seventh Phase C root', (value) => { value.proofTopology.phaseC.rootPaths.push('tests/evidence/tale-token-phase-c-extra/index.json'); value.proofTopology.phaseC.rootCount = 7; }],
  ['maintenance evidence-record claim', (value) => { value.proofTopology.maintenance.evidenceRecords = 'one'; }],
  ['wrong terminal predecessor digest', (value) => { value.proofTopology.authorityStage.targets[0].predecessor.sha256 = 'sha256:' + '0'.repeat(64); }],
  ['package version effect', (value) => { value.versions.packages['@muxui/catalog'].to = '2.0.1'; }],
];

let passed = 0;
for (const [name, mutate] of cases) {
  const value = clone();
  mutate(value);
  const candidate = path.join(temporary, `${passed}.json`);
  fs.writeFileSync(candidate, canonicalJson(value));
  const result = spawnSync(process.execPath, [verifier, candidate, scopePath], { encoding: 'utf8' });
  if (result.status === 0) throw new Error(`negative accepted: ${name}`);
  passed += 1;
}

const badScope = path.join(temporary, 'bad-scope.md');
fs.writeFileSync(badScope, scope.replace('Issue #46 exposed', '+Issue #46 exposed'));
const badScopeResult = spawnSync(process.execPath, [verifier, decisionPath, badScope], { encoding: 'utf8' });
if (badScopeResult.status === 0) throw new Error('negative accepted: Product Scope patch marker');
passed += 1;

const badAcceptance = path.join(temporary, 'bad-acceptance.json');
const acceptance = parseJsonStrict(fs.readFileSync(acceptancePath, 'utf8'));
acceptance.bodySha256 = 'sha256:' + '0'.repeat(64);
fs.writeFileSync(badAcceptance, canonicalJson(acceptance));
const badAcceptanceResult = spawnSync(process.execPath, [verifier, decisionPath, scopePath, badAcceptance], { encoding: 'utf8' });
if (badAcceptanceResult.status === 0) throw new Error('negative accepted: acceptance receipt drift');
passed += 1;

const positive = spawnSync(process.execPath, [verifier, decisionPath, scopePath], { encoding: 'utf8' });
if (positive.status !== 0) throw new Error(`positive rejected: ${positive.stderr}`);

fs.rmSync(temporary, { recursive: true, force: true });
process.stdout.write(`[phase-c-applicability] ${passed}/${cases.length + 2} negative mutations rejected; positive candidate accepted\n`);
