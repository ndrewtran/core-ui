import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deriveControlState, deriveFormSummary } from '../src/logic/index.mjs';
import { semanticState } from '../src/semantic/index.mjs';

test('E-G1.0-05 foundation is semantic plus pure logic with interaction honestly absent', async () => {
  const packageManifest = JSON.parse(await readFile(
    new URL('../package.json', import.meta.url),
    'utf8',
  ));
  const semanticSource = await readFile(new URL('../src/semantic/index.mjs', import.meta.url), 'utf8');
  const logicSource = await readFile(new URL('../src/logic/index.mjs', import.meta.url), 'utf8');
  const forbidden = ['document', 'window', 'navigator', 'react', 'selector', 'UIView', 'android.view'];
  assert.deepEqual(Object.keys(packageManifest.exports).sort(), ['./logic', './semantic']);
  assert.equal(Object.hasOwn(packageManifest.exports, './interaction'), false);
  for (const source of [semanticSource, logicSource]) {
    for (const value of forbidden) assert.equal(source.includes(value), false, value);
  }
  assert.equal(semanticSource.includes("../logic"), false);
  assert.equal(logicSource.includes("../semantic/index.mjs"), true);

  const input = { intent: 'field', disabled: false, invalid: true, required: true };
  assert.deepEqual(semanticState(input), semanticState(structuredClone(input)));
  assert.deepEqual(deriveControlState(input), deriveControlState(structuredClone(input)));
  assert.deepEqual(deriveFormSummary([input]), {
    valid: false,
    actionable: true,
    requiredCount: 1,
  });
});
