import { canonicalJson } from '@core-ui/schema';

const DENSE_HEADER = '@core-ui/dense=1';

function responseEntries(response) {
  if (response.responseType === 'artifact.detail.section-page') {
    return ['schemaVersion', 'responseType', 'meta', 'entries', 'page', 'diagnostics']
      .map((key) => [key, response[key]]);
  }
  const order = response.type === 'error'
    ? ['apiVersion', 'type', 'error']
    : ['apiVersion', 'type', 'data', 'meta', 'warnings'];
  return order.map((key) => [key, response[key]]);
}

export function renderJson(response) {
  return `${canonicalJson(response)}\n`;
}

export function renderDense(response) {
  return `${[
    DENSE_HEADER,
    ...responseEntries(response).map(([key, value]) => `${key}=${canonicalJson(value)}`),
  ].join('\n')}\n`;
}

export function parseDense(text) {
  const lines = text.trimEnd().split('\n');
  if (lines.shift() !== DENSE_HEADER) throw new Error('CLI_DENSE_HEADER_INVALID');
  return Object.fromEntries(lines.map((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error('CLI_DENSE_LINE_INVALID');
    return [line.slice(0, separator), JSON.parse(line.slice(separator + 1))];
  }));
}

export function renderHuman(response) {
  return `${[
    `Core UI ${response.type ?? response.responseType}`,
    ...responseEntries(response).map(([key, value]) => `${key}: ${canonicalJson(value)}`),
  ].join('\n')}\n`;
}

export function parseHuman(text) {
  const lines = text.trimEnd().split('\n');
  if (!lines.shift()?.startsWith('Core UI ')) throw new Error('CLI_HUMAN_HEADER_INVALID');
  return Object.fromEntries(lines.map((line) => {
    const separator = line.indexOf(': ');
    if (separator < 1) throw new Error('CLI_HUMAN_LINE_INVALID');
    return [line.slice(0, separator), JSON.parse(line.slice(separator + 2))];
  }));
}

export function countTokens(text) {
  return text.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

export function tokenBudgetFor(commandRegistry, command, detail) {
  const definition = commandRegistry.commands.find(({ name }) => name === command);
  if (!definition) throw new Error(`CLI_COMMAND_UNDECLARED: ${command}`);
  const budget = definition.tokenBudgets[detail];
  if (!Number.isInteger(budget)) throw new Error(`CLI_TOKEN_BUDGET_UNDECLARED: ${command}.${detail}`);
  return budget;
}
