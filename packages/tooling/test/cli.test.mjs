import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getArtifact,
  getManifest,
  listArtifacts,
  searchArtifacts,
} from '@core-ui/catalog';
import {
  cliManifest,
  commandRegistry,
  completionScript,
  helpText,
  mcpInputSchemas,
  parserMetadata,
} from '../generated/command-surface.mjs';
import {
  assertSafeDiagnostics,
  countTokens,
  executeCommand,
  normalizeSurfaceResponse,
  parseDense,
  parseHuman,
  renderDense,
  renderHuman,
  renderJson,
  runCli,
  tokenBudgetFor,
} from '../src/index.mjs';
import { buildCommandProjections } from '../src/registry.mjs';

const details = ['brief', 'compact', 'full'];
const commandCases = {
  manifest: (detail) => ({ args: ['manifest', '--detail', detail], request: { detail } }),
  list: (detail) => ({ args: ['list', '--detail', detail], request: { detail, limit: 20, platform: null, purpose: null, cursor: null, kind: null } }),
  search: (detail) => ({ args: ['search', 'button', '--detail', detail], request: { detail, limit: 20, platform: null, purpose: null, cursor: null, query: 'button' } }),
  get: (detail) => ({ args: ['get', 'Button', '--detail', detail], request: { detail, platform: null, purpose: null, section: null, 'id-or-alias': 'Button' } }),
};

function jsonResult(args) {
  const result = runCli([...args, '--json']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('E-G0.3-01 API and CLI JSON normalize to the same query responses', () => {
  assert.deepEqual(
    normalizeSurfaceResponse(jsonResult(['manifest', '--detail', 'full'])),
    getManifest(),
  );
  assert.deepEqual(
    jsonResult(['list', '--detail', 'compact']),
    listArtifacts({ detail: 'compact', limit: 20, platform: null, purpose: null, cursor: null, kind: null }),
  );
  assert.deepEqual(
    jsonResult(['search', 'button', '--detail', 'brief']),
    searchArtifacts({ query: 'button', detail: 'brief', limit: 20, platform: null, purpose: null, cursor: null }),
  );
  assert.deepEqual(
    jsonResult(['get', 'Button', '--platform', 'web.react', '--detail', 'full']),
    getArtifact({ id: 'core:component:button', platform: 'web.react', detail: 'full', purpose: null, section: null }),
  );
});

test('E-G0.3-02 human, JSON, and dense projections preserve one response object', () => {
  const response = executeCommand('get', {
    'id-or-alias': 'Button',
    platform: 'web.react',
    detail: 'compact',
    purpose: null,
    section: null,
  });
  assert.deepEqual(JSON.parse(renderJson(response)), response);
  assert.deepEqual(parseDense(renderDense(response)), response);
  assert.deepEqual(parseHuman(renderHuman(response)), response);
  assert.equal(response.data.artifact.id, 'core:component:button');
  assert.equal(response.meta.platform, 'web.react');
  assert.match(response.meta.revisions.bindingSpec, /^sha256:/);
  assert.equal(response.meta.resolution.authority, 'advisory');
  assert.equal(response.meta.resolution.compatibility, 'unresolved');
  assert.equal(response.meta.resolution.catalogSource, 'package');
});

test('E-G0.3-03 dense outputs round-trip deterministically within every locked budget', () => {
  for (const [command, makeCase] of Object.entries(commandCases)) {
    for (const detail of details) {
      const { request } = makeCase(detail);
      const definition = commandRegistry.commands.find(({ name }) => name === command);
      const response = executeCommand(command, { ...request, ...definition.budgetFixture });
      const first = renderDense(response);
      const second = renderDense(response);
      assert.equal(first, second, `${command}.${detail} must be deterministic`);
      assert.deepEqual(parseDense(first), response, `${command}.${detail} must round-trip`);
      assert.ok(
        countTokens(first) <= tokenBudgetFor(commandRegistry, command, detail),
        `${command}.${detail} exceeded its token budget`,
      );
    }
  }
});

test('E-G0.3-03 dense golden snapshots remain stable', async () => {
  const goldenCases = {
    'manifest-brief.txt': executeCommand('manifest', { detail: 'brief' }),
    'list-brief.txt': executeCommand('list', { ...commandCases.list('brief').request, limit: 1 }),
    'search-brief.txt': executeCommand('search', { ...commandCases.search('brief').request, limit: 1 }),
    'get-compact.txt': executeCommand('get', commandCases.get('compact').request),
  };
  for (const [name, response] of Object.entries(goldenCases)) {
    const expected = await readFile(new URL(`goldens/${name}`, import.meta.url), 'utf8');
    assert.equal(renderDense(response), expected, name);
  }
});

test('E-G0.3-04 registry generates parser, help, completion, manifest, types, and future MCP inputs', async () => {
  const names = commandRegistry.commands.map(({ name }) => name);
  assert.deepEqual(names, ['manifest', 'list', 'search', 'get']);
  assert.deepEqual(parserMetadata.commands.map(({ name }) => name), names);
  assert.deepEqual(cliManifest.commands.map(({ name }) => name), names);
  assert.deepEqual(mcpInputSchemas.map(({ name }) => name), names);
  assert.ok(mcpInputSchemas.every(({ available }) => available === false));
  for (const name of names) {
    assert.match(helpText, new RegExp(`\\b${name}\\b`));
    assert.match(completionScript, new RegExp(`\\b${name}\\b`));
  }
  const types = await readFile(new URL('../generated/response-types.d.ts', import.meta.url), 'utf8');
  for (const command of commandRegistry.commands) assert.match(types, new RegExp(command.responseType));

  const extra = structuredClone(commandRegistry);
  extra.commands.push({ ...extra.commands[0], name: 'doctor' });
  assert.throws(() => buildCommandProjections(extra), /CLI_COMMAND_SURFACE_DRIFT/);
  const responseDrift = structuredClone(commandRegistry);
  responseDrift.commands[0].responseType = 'cli.unknown';
  assert.throws(() => buildCommandProjections(responseDrift), /CLI_RESPONSE_TYPE_DRIFT/);
  const selectorDrift = structuredClone(commandRegistry);
  selectorDrift.selectors.find(({ name }) => name === 'detail').choices.push('verbose');
  assert.throws(() => buildCommandProjections(selectorDrift), /CLI_SELECTOR_SCHEMA_DRIFT/);
});

test('E-G0.3-05 structured errors have stable codes, safe actions, and meaningful exits', () => {
  const fixtures = [
    { args: ['unknown', '--json'], code: 'CORE_QUERY_INVALID', exitCode: 2 },
    { args: ['list', '--detail', 'verbose', '--json'], code: 'CORE_QUERY_INVALID', exitCode: 2 },
    { args: ['list', '--cursor', 'wrong', '--json'], code: 'CORE_CURSOR_INVALID', exitCode: 3 },
    { args: ['get', 'missing', '--json'], code: 'CORE_ARTIFACT_NOT_FOUND', exitCode: 4 },
  ];
  for (const fixture of fixtures) {
    const result = runCli(fixture.args);
    assert.equal(result.exitCode, fixture.exitCode);
    assert.equal(result.stderr, '');
    const response = JSON.parse(result.stdout);
    assert.equal(response.type, 'error');
    assert.equal(response.error.code, fixture.code);
    assert.equal(typeof response.error.details, 'object');
    assert.equal(response.error.nextCommand.effect, 'read-only');
    assert.equal(response.error.nextCommand.requiresConfirmation, false);
  }
  assert.throws(() => assertSafeDiagnostics({
    apiVersion: '1.0.0',
    type: 'error',
    error: {
      code: 'CORE_QUERY_INVALID',
      ruleId: 'cli.fixture.unsafe',
      message: 'unsafe fixture',
      retryable: false,
      details: {},
      nextCommand: {
        command: 'core init',
        effect: 'project-write',
        requiresConfirmation: false,
      },
    },
  }), /CLI_UNSAFE_NEXT_COMMAND/);
  const human = runCli(['get', 'missing']);
  assert.equal(human.stdout, '');
  assert.match(human.stderr, /CORE_ARTIFACT_NOT_FOUND/);
});

test('E-G0.3-05 process boundary keeps JSON singular and diagnostics off stderr', () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../bin/core.mjs', import.meta.url)),
    'get',
    'missing',
    '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 4);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).error.code, 'CORE_ARTIFACT_NOT_FOUND');
  assert.equal(result.stdout.trim().split('\n').length, 1);
});

test('E-G0.3-06 bare JSON cold start discovers manifest and retrieves without repository crawling', () => {
  const manifestResult = runCli(['--json']);
  assert.equal(manifestResult.exitCode, 0);
  const manifest = JSON.parse(manifestResult.stdout);
  assert.equal(manifest.type, 'catalog.manifest');
  assert.deepEqual(manifest.data.cli.commands.map(({ name }) => name), [
    'manifest', 'list', 'search', 'get',
  ]);
  assert.deepEqual(
    manifest.data.capabilities.find(({ id }) => id === 'core:capability:query-baseline').availableOn,
    ['api', 'cli'],
  );
  const search = jsonResult(['search', 'button', '--detail', 'brief']);
  const id = search.data.items.find(({ name }) => name === 'Button').id;
  const detail = jsonResult(['get', id, '--detail', 'compact']);
  assert.equal(detail.data.artifact.id, 'core:component:button');
  assert.equal(detail.meta.resolution.catalogSource, 'package');
});
