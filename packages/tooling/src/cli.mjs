import {
  getArtifact,
  getManifest,
  listArtifacts,
  searchArtifacts,
} from '@core-ui/catalog';
import { ARTIFACT_REF_PATTERN, canonicalJson, validateFamily } from '@core-ui/schema';
import { cliManifest, commandRegistry } from '../generated/command-surface.mjs';
import { parseCliArguments } from './parser.mjs';
import { renderDense, renderHuman, renderJson } from './renderers.mjs';

const EXIT_CODES = {
  CORE_QUERY_INVALID: 2,
  CORE_CURSOR_INVALID: 3,
  CORE_ARTIFACT_NOT_FOUND: 4,
};

function canonicalAlias(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function errorResponse(code, ruleId, message, details, nextCommand) {
  const response = {
    apiVersion: '1.0.0',
    type: 'error',
    error: {
      code,
      ruleId,
      message,
      retryable: true,
      details,
      nextCommand: {
        command: nextCommand,
        effect: 'read-only',
        requiresConfirmation: false,
      },
    },
  };
  validateFamily('query-envelope', response);
  return response;
}

function requestWithout(request, keys) {
  return Object.fromEntries(Object.entries(request).filter(([key]) => !keys.includes(key)));
}

function resolveAlias(value, request) {
  if (new RegExp(ARTIFACT_REF_PATTERN).test(value)) return { id: value };
  const query = searchArtifacts({
    ...requestWithout(request, ['id-or-alias', 'section']),
    query: value,
    detail: 'brief',
    limit: 100,
    cursor: null,
  });
  if (query.type === 'error') return { error: query };
  const alias = canonicalAlias(value);
  const matches = query.data.items.filter((item) => (
    canonicalAlias(item.name) === alias || item.id.endsWith(`:${alias}`)
  ));
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length > 1) {
    return { error: errorResponse(
      'CORE_QUERY_INVALID',
      'cli.alias.ambiguous',
      `Alias ${JSON.stringify(value)} matched more than one artifact.`,
      { alias: value, candidates: matches.map(({ id }) => id).sort() },
      `core search ${JSON.stringify(value)} --json`,
    ) };
  }
  return { error: errorResponse(
    'CORE_ARTIFACT_NOT_FOUND',
    'artifact.resolve.exists',
    `No artifact matched ${JSON.stringify(value)}.`,
    { alias: value },
    `core search ${JSON.stringify(value)} --json`,
  ) };
}

function cliManifestFor(detail) {
  if (detail === 'brief') {
    return {
      name: cliManifest.cli.name,
      version: cliManifest.cli.version,
      commands: cliManifest.commands.map(({ name }) => name),
    };
  }
  if (detail === 'compact') {
    return {
      cli: cliManifest.cli,
      commands: cliManifest.commands.map(({ name, summary, responseType, tokenBudgets }) => ({
        name,
        summary,
        responseType,
        tokenBudgets,
      })),
      outputModes: cliManifest.outputModes,
      unavailableCommands: cliManifest.unavailableCommands,
    };
  }
  return cliManifest;
}

function manifestResponse(request) {
  const response = structuredClone(getManifest());
  response.data.cli = cliManifestFor(request.detail);
  response.meta.detail = request.detail;
  validateFamily('query-envelope', response);
  return response;
}

export function executeCommand(command, request) {
  if (command === 'manifest') return manifestResponse(request);
  if (command === 'list') {
    const { kind = null, ...selectors } = request;
    return listArtifacts({ ...selectors, kind });
  }
  if (command === 'search') {
    const { query, ...selectors } = request;
    return searchArtifacts({ ...selectors, query });
  }
  if (command === 'get') {
    const resolved = resolveAlias(request['id-or-alias'], request);
    if (resolved.error) return resolved.error;
    return getArtifact({
      ...requestWithout(request, ['id-or-alias']),
      id: resolved.id,
    });
  }
  throw new Error(`CLI_COMMAND_UNDECLARED: ${command}`);
}

function diagnostics(response) {
  return response.type === 'error' ? [response.error] : response.warnings;
}

export function assertSafeDiagnostics(response) {
  for (const diagnostic of diagnostics(response)) {
    const next = diagnostic.nextCommand;
    if (next && next.effect !== 'read-only' && next.requiresConfirmation !== true) {
      throw new Error(
        `CLI_UNSAFE_NEXT_COMMAND: ${next.effect} suggestions must require confirmation`,
      );
    }
  }
  return response;
}

function enrichDiagnostic(response, command) {
  if (response.type !== 'error' || response.error.nextCommand) return response;
  const nextCommand = response.error.code === 'CORE_ARTIFACT_NOT_FOUND'
    ? `core search ${JSON.stringify(response.error.details.id ?? '')} --json`
    : `core ${command} --help`;
  const enriched = structuredClone(response);
  enriched.error.nextCommand = {
    command: nextCommand,
    effect: 'read-only',
    requiresConfirmation: false,
  };
  validateFamily('query-envelope', enriched);
  return enriched;
}

function render(response, mode) {
  if (mode === 'json') return renderJson(response);
  if (mode === 'dense') return renderDense(response);
  return renderHuman(response);
}

export function normalizeSurfaceResponse(response) {
  const normalized = structuredClone(response);
  if (normalized.type === 'catalog.manifest') {
    delete normalized.data.cli;
    normalized.meta.detail = 'full';
  }
  if (normalized.type === 'error') delete normalized.error.nextCommand;
  return normalized;
}

export function runCli(args) {
  const parsed = parseCliArguments(args);
  if (parsed.kind === 'help') return { stdout: parsed.text, stderr: '', exitCode: 0 };
  const response = assertSafeDiagnostics(
    parsed.error ?? enrichDiagnostic(executeCommand(parsed.command, parsed.request), parsed.command),
  );
  const text = render(response, parsed.mode);
  const exitCode = response.type === 'error' ? (EXIT_CODES[response.error.code] ?? 1) : 0;
  if (response.type === 'error' && parsed.mode === 'human') {
    return { stdout: '', stderr: text, exitCode };
  }
  return { stdout: text, stderr: '', exitCode };
}

export function registryIdentity() {
  return canonicalJson(commandRegistry);
}
