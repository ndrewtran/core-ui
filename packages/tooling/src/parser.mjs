import { canonicalJson } from '@core-ui/schema';
import {
  helpByCommand,
  helpText,
  parserMetadata,
} from '../generated/command-surface.mjs';

function usageError(ruleId, message, details, nextCommand = 'core --json') {
  return {
    apiVersion: '1.0.0',
    type: 'error',
    error: {
      code: 'CORE_QUERY_INVALID',
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
}

function optionMap(command) {
  return new Map(command.options.map((option) => [option.flag, option]));
}

function outputMode(values) {
  if (values.json) return 'json';
  if (values.dense) return 'dense';
  return 'human';
}

function parseOptionValue(option, value) {
  if (option.type === 'integer') {
    if (!/^[0-9]+$/.test(value)) return { invalid: true };
    const parsed = Number(value);
    if (parsed < option.minimum || parsed > option.maximum) return { invalid: true };
    return { value: parsed };
  }
  if (option.choices && !option.choices.includes(value)) return { invalid: true };
  return { value };
}

export function parseCliArguments(args) {
  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
    return { mode: 'human', error: usageError(
      'cli.arguments.array',
      'CLI arguments must be strings.',
      {},
    ) };
  }
  if (args.length === 0 || canonicalJson(args) === canonicalJson(['--help'])) {
    return { kind: 'help', mode: 'human', text: helpText };
  }
  if (canonicalJson(args) === canonicalJson(['--json'])) {
    return { kind: 'command', command: 'manifest', mode: 'json', request: { detail: 'compact' } };
  }

  const requestedMode = args.includes('--json') ? 'json' : args.includes('--dense') ? 'dense' : 'human';

  const [commandName, ...tokens] = args;
  const command = parserMetadata.commands.find(({ name }) => name === commandName);
  if (!command) {
    return { mode: requestedMode, error: usageError(
      'cli.command.unknown',
      `Unknown or unavailable command ${JSON.stringify(commandName)}.`,
      { command: commandName },
    ) };
  }

  const options = optionMap(command);
  const values = Object.fromEntries(command.options.map((option) => [option.name, option.default]));
  const positionals = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const option = options.get(token);
    if (!option) {
      return { mode: requestedMode, error: usageError(
        'cli.option.unknown',
        `${commandName} does not declare option ${JSON.stringify(token)}.`,
        { command: commandName, option: token },
        `core ${commandName} --help`,
      ) };
    }
    if (option.type === 'boolean') {
      values[option.name] = true;
      continue;
    }
    const raw = tokens[index + 1];
    if (raw === undefined || raw.startsWith('--')) {
      return { mode: requestedMode, error: usageError(
        'cli.option.value',
        `${option.flag} requires a value.`,
        { command: commandName, option: option.name },
        `core ${commandName} --help`,
      ) };
    }
    index += 1;
    const parsed = parseOptionValue(option, raw);
    if (parsed.invalid) {
      return { mode: requestedMode, error: usageError(
        'cli.option.value',
        `${option.flag} received an invalid value.`,
        { command: commandName, option: option.name, value: raw },
        `core ${commandName} --help`,
      ) };
    }
    values[option.name] = parsed.value;
  }

  for (const option of command.options) {
    if (!values[option.name]) continue;
    for (const conflict of option.conflicts ?? []) {
      if (values[conflict]) {
        return { mode: 'json', error: usageError(
          'cli.option.conflict',
          `${option.flag} conflicts with --${conflict}.`,
          { command: commandName, options: [option.name, conflict].sort() },
          `core ${commandName} --help`,
        ) };
      }
    }
  }

  const mode = outputMode(values);
  if (values.help) return { kind: 'help', mode: 'human', text: helpByCommand[commandName] };
  const requiredCount = command.arguments.filter(({ required }) => required).length;
  if (positionals.length < requiredCount || positionals.length > command.arguments.length) {
    return { mode, error: usageError(
      'cli.argument.count',
      `${commandName} received the wrong number of arguments.`,
      { command: commandName, received: positionals.length },
      `core ${commandName} --help`,
    ) };
  }

  const request = {};
  command.arguments.forEach((argument, index) => {
    if (positionals[index] !== undefined) request[argument.name] = positionals[index];
  });
  for (const option of command.options) {
    if (['dense', 'help', 'json'].includes(option.name)) continue;
    request[option.name] = values[option.name];
  }
  return { kind: 'command', command: commandName, mode, request };
}
