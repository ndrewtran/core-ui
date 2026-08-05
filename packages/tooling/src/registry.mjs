import {
  QUERY_RESPONSE_TYPES,
  QUERY_SELECTORS,
  canonicalJson,
} from '@core-ui/schema';

const BASELINE_COMMANDS = ['get', 'list', 'manifest', 'search'];
const DETAILS = ['brief', 'compact', 'full'];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assert(condition, code, message) {
  if (!condition) throw new Error(`${code}: ${message}`);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function optionMap(registry) {
  return new Map(
    [...registry.globalOptions, ...registry.selectors].map((option) => [option.name, option]),
  );
}

export function validateCommandRegistry(registry) {
  assert(
    registry && typeof registry === 'object' && !Array.isArray(registry),
    'CLI_REGISTRY_INVALID',
    'registry must be an object',
  );
  assert(registry.schemaVersion === '1.0.0', 'CLI_REGISTRY_INVALID', 'schemaVersion must be 1.0.0');
  assert(registry.cli?.name === 'core', 'CLI_REGISTRY_INVALID', 'CLI name must be core');
  assert(
    canonicalJson(registry.outputModes) === canonicalJson(['human', 'json', 'dense']),
    'CLI_REGISTRY_INVALID',
    'output modes must be human, json, and dense',
  );

  const options = [...registry.globalOptions, ...registry.selectors];
  assert(unique(options.map(({ name }) => name)), 'CLI_REGISTRY_INVALID', 'option names must be unique');
  assert(unique(options.map(({ flag }) => flag)), 'CLI_REGISTRY_INVALID', 'option flags must be unique');
  const optionsByName = optionMap(registry);

  for (const selector of registry.selectors) {
    if (QUERY_SELECTORS[selector.name]) {
      assert(
        canonicalJson(selector.choices) === canonicalJson(QUERY_SELECTORS[selector.name]),
        'CLI_SELECTOR_SCHEMA_DRIFT',
        `${selector.name} choices must come from @core-ui/schema`,
      );
    }
  }

  const commands = registry.commands.map(({ name }) => name);
  assert(unique(commands), 'CLI_REGISTRY_INVALID', 'command names must be unique');
  assert(
    canonicalJson([...commands].sort(compareText)) === canonicalJson(BASELINE_COMMANDS),
    'CLI_COMMAND_SURFACE_DRIFT',
    `baseline commands must be exactly ${BASELINE_COMMANDS.join(', ')}`,
  );

  for (const command of registry.commands) {
    assert(
      QUERY_RESPONSE_TYPES.includes(command.responseType),
      'CLI_RESPONSE_TYPE_DRIFT',
      `${command.name} references undeclared response type ${command.responseType}`,
    );
    assert(
      unique(command.options) && command.options.every((name) => optionsByName.has(name)),
      'CLI_OPTION_REFERENCE_INVALID',
      `${command.name} references an unknown or repeated option`,
    );
    assert(
      unique(command.arguments.map(({ name }) => name)),
      'CLI_ARGUMENT_INVALID',
      `${command.name} argument names must be unique`,
    );
    assert(
      canonicalJson(Object.keys(command.tokenBudgets).sort(compareText)) === canonicalJson(DETAILS),
      'CLI_TOKEN_BUDGET_INVALID',
      `${command.name} must declare brief, compact, and full budgets`,
    );
    assert(
      command.budgetFixture && typeof command.budgetFixture === 'object'
        && !Array.isArray(command.budgetFixture),
      'CLI_TOKEN_BUDGET_INVALID',
      `${command.name} must declare its canonical budget fixture`,
    );
    for (const [detail, budget] of Object.entries(command.tokenBudgets)) {
      assert(
        Number.isInteger(budget) && budget > 0,
        'CLI_TOKEN_BUDGET_INVALID',
        `${command.name}.${detail} must be a positive integer`,
      );
    }
  }

  assert(
    registry.commands.some(({ name }) => name === registry.bareJsonRecoveryCommand),
    'CLI_REGISTRY_INVALID',
    'bare JSON recovery command must be available',
  );
  assert(
    registry.surfacePolicy.cli.available === true
      && registry.surfacePolicy.cli.effect === 'read-only'
      && registry.surfacePolicy.cli.requiresConfirmation === false,
    'CLI_CAPABILITY_POLICY_INVALID',
    'baseline CLI must be available and read-only',
  );
  assert(
    registry.surfacePolicy.mcp.available === false,
    'CLI_CAPABILITY_POLICY_INVALID',
    'public MCP must remain unavailable in G0.3',
  );
  return registry;
}

function helpFor(registry) {
  const lines = [
    `${registry.cli.name} ${registry.cli.version}`,
    registry.cli.description,
    '',
    'Usage: core <command> [arguments] [options]',
    '',
    'Commands:',
  ];
  for (const command of registry.commands) {
    const argumentsText = command.arguments
      .map((argument) => argument.required ? `<${argument.name}>` : `[${argument.name}]`)
      .join(' ');
    lines.push(`  ${command.name}${argumentsText ? ` ${argumentsText}` : ''}  ${command.summary}`);
  }
  lines.push('', 'Output: --json | --dense (human is the default)', 'Recovery: core --json');
  return `${lines.join('\n')}\n`;
}

function commandHelp(registry, command, optionsByName) {
  const argumentsText = command.arguments
    .map((argument) => argument.required ? `<${argument.name}>` : `[${argument.name}]`)
    .join(' ');
  const lines = [
    `Usage: core ${command.name}${argumentsText ? ` ${argumentsText}` : ''} [options]`,
    '',
    command.summary,
    '',
    'Options:',
  ];
  for (const name of command.options) {
    const option = optionsByName.get(name);
    const value = option.type === 'boolean' ? '' : ` <${option.name}>`;
    const choices = option.choices ? ` (${option.choices.join('|')})` : '';
    lines.push(`  ${option.flag}${value}${choices}`);
  }
  lines.push('', 'Examples:', ...command.examples.map((example) => `  ${example}`));
  return `${lines.join('\n')}\n`;
}

function inputSchema(command, optionsByName) {
  const properties = {};
  const required = [];
  for (const argument of command.arguments) {
    properties[argument.name] = { type: 'string' };
    if (argument.required) required.push(argument.name);
  }
  for (const name of command.options) {
    if (['dense', 'help', 'json'].includes(name)) continue;
    const option = optionsByName.get(name);
    properties[name] = option.type === 'integer'
      ? { type: 'integer', minimum: option.minimum, maximum: option.maximum }
      : { type: 'string', ...(option.choices ? { enum: option.choices } : {}) };
  }
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function manifestCommand(command, optionsByName) {
  return {
    name: command.name,
    summary: command.summary,
    operation: command.operation,
    arguments: command.arguments,
    options: command.options.map((name) => optionsByName.get(name)),
    responseType: command.responseType,
    responseSchema: '@core-ui/schema/schemas/query-envelope.schema.json',
    outputModes: ['human', 'json', 'dense'],
    tokenBudgets: command.tokenBudgets,
    budgetFixture: command.budgetFixture,
    examples: command.examples,
    capability: { available: true, effect: 'read-only', requiresConfirmation: false },
  };
}

export function buildCommandProjections(input) {
  const registry = validateCommandRegistry(structuredClone(input));
  const optionsByName = optionMap(registry);
  const commands = registry.commands.map((command) => manifestCommand(command, optionsByName));
  const helpByCommand = Object.fromEntries(
    registry.commands.map((command) => [command.name, commandHelp(registry, command, optionsByName)]),
  );
  const parserMetadata = {
    cli: registry.cli,
    bareJsonRecoveryCommand: registry.bareJsonRecoveryCommand,
    globalOptions: registry.globalOptions,
    commands,
  };
  const cliManifest = {
    schemaVersion: registry.schemaVersion,
    cli: registry.cli,
    tokenizer: registry.tokenizer,
    commands,
    unavailableCommands: registry.unavailableCommands.map((command) => ({
      ...command,
      capability: { available: false },
    })),
    outputModes: registry.outputModes,
    surfacePolicy: registry.surfacePolicy,
  };
  const mcpInputSchemas = registry.commands.map((command) => ({
    name: command.name,
    available: false,
    operation: command.operation,
    inputSchema: inputSchema(command, optionsByName),
  }));
  const completionScript = [
    '# generated from the Core UI command registry',
    '_core_complete() {',
    `  local commands="${registry.commands.map(({ name }) => name).join(' ')}"`,
    '  COMPREPLY=( $(compgen -W "$commands" -- "${COMP_WORDS[1]}") )',
    '}',
    'complete -F _core_complete core',
    '',
  ].join('\n');
  const responseTypes = [
    "import type { QueryResponseType } from '@core-ui/schema/types';",
    '',
    ...registry.commands.map((command) => (
      `export type ${command.name[0].toUpperCase()}${command.name.slice(1)}ResponseType = Extract<QueryResponseType, ${JSON.stringify(command.responseType)}>;`
    )),
    '',
  ].join('\n');
  return {
    commandRegistry: registry,
    parserMetadata,
    helpText: helpFor(registry),
    helpByCommand,
    completionScript,
    cliManifest,
    mcpInputSchemas,
    responseTypes,
  };
}

export function commandSurfaceModule(projections) {
  return [
    `export const commandRegistry = Object.freeze(${canonicalJson(projections.commandRegistry)});`,
    `export const parserMetadata = Object.freeze(${canonicalJson(projections.parserMetadata)});`,
    `export const helpText = ${JSON.stringify(projections.helpText)};`,
    `export const helpByCommand = Object.freeze(${canonicalJson(projections.helpByCommand)});`,
    `export const completionScript = ${JSON.stringify(projections.completionScript)};`,
    `export const cliManifest = Object.freeze(${canonicalJson(projections.cliManifest)});`,
    `export const mcpInputSchemas = Object.freeze(${canonicalJson(projections.mcpInputSchemas)});`,
    '',
  ].join('\n');
}
