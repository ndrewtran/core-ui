import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonicalJson, parseJsonStrict, sha256Digest } from '../src/index.mjs';

const schema = JSON.parse(await readFile(new URL('../schemas/change-intent-envelope.schema.json', import.meta.url), 'utf8'));

test('R1 ChangeIntent grammar is private, versioned, and closed', () => {
  assert.equal(schema.$id, 'core-ui-change-intent-envelope-v1');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    'profile', 'schemaVersion', 'intentId', 'authority', 'objective', 'operation',
    'source', 'proposal', 'owners', 'writeSet', 'affected', 'effects', 'checks',
    'review', 'readiness', 'invalidation', 'confirmation',
  ]);
  assert.deepEqual(schema.properties.operation.properties.kind.enum, [
    'r1-lock', 'component-implementation', 'retained-evidence-acceptance',
    'routine-git-operation', 'project-migration',
  ]);
  assert.deepEqual(schema.properties.operation.properties.effectClass.enum, [
    'explanation-only', 'canonical-source-write', 'renderer-source-write',
    'project-write', 'evidence-retention-write',
  ]);
});

test('R1 ChangeIntent canonical bytes reject duplicate keys and noncanonical whitespace', () => {
  assert.throws(
    () => parseJsonStrict('{"profile":"x","profile":"y"}'),
    /JSON_DUPLICATE_KEY/u,
  );
  const value = { b: 2, a: 1 };
  const bytes = canonicalJson(value);
  assert.equal(bytes, '{"a":1,"b":2}');
  assert.equal(sha256Digest(bytes), sha256Digest('{"a":1,"b":2}'));
  const noncanonical = '{ "a": 1, "b": 2 }';
  assert.notEqual(canonicalJson(parseJsonStrict(noncanonical)), noncanonical);
});

test('R1 ChangeIntent schema leaves result optional and keeps readiness fail-closed', () => {
  assert.equal(schema.properties.result.type, 'object');
  assert.deepEqual(schema.properties.readiness.properties.retrieval.enum, [
    'not-applicable', 'unknown', 'blocked', 'proved',
  ]);
  assert.equal(schema.properties.confirmation.properties.required.const, true);
});
