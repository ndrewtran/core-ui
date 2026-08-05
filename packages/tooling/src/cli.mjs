import * as catalogApi from '@core-ui/catalog';
import { canonicalJson, validateFamily } from '@core-ui/schema';
import { commandRegistry } from '../generated/command-surface.mjs';
import { parseCliArguments } from './parser.mjs';
import { renderDense, renderHuman, renderJson } from './renderers.mjs';

const EXIT_CODES = {
  CORE_QUERY_INVALID: 2,
  CORE_CURSOR_INVALID: 3,
  CORE_ARTIFACT_NOT_FOUND: 4,
};

function requestWithout(request, keys) {
  return Object.fromEntries(Object.entries(request).filter(([key]) => !keys.includes(key)));
}

export function executeCommand(command, request) {
  const definition = commandRegistry.commands.find(({ name }) => name === command);
  if (!definition) throw new Error(`CLI_COMMAND_UNDECLARED: ${command}`);
  const operation = catalogApi[definition.operation];
  if (typeof operation !== 'function') {
    throw new Error(`CLI_OPERATION_UNAVAILABLE: ${definition.operation}`);
  }
  const argumentNames = definition.arguments.map(({ name }) => name);
  const operationRequest = requestWithout(request, argumentNames);
  for (const argument of definition.arguments) {
    operationRequest[argument.requestKey ?? argument.name] = request[argument.name];
  }
  const response = operation(operationRequest);
  if (response.type !== 'error' && response.type !== definition.responseType) {
    throw new Error(
      `CLI_RESPONSE_TYPE_DRIFT: ${command} expected ${definition.responseType}, got ${response.type}`,
    );
  }
  return response;
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
