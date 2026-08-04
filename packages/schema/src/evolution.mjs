import { loadJsonDocument } from './contracts.mjs';
import { SchemaValidationError } from './validation.mjs';

export function classifySchemaChange(changeType) {
  const policy = loadJsonDocument('schema-evolution.json');
  const result = policy.effects[changeType];
  if (!result) {
    throw new SchemaValidationError('CORE_SCHEMA_VERSION_UNSUPPORTED', [
      { path: '$/changeType', message: `${changeType} is not declared` },
    ]);
  }
  return result;
}

export function parseSchemaVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) {
    throw new SchemaValidationError('CORE_SCHEMA_VERSION_UNSUPPORTED', [
      { path: '$/schemaVersion', message: `${version} is not SemVer` },
    ]);
  }
  return match.slice(1).map(Number);
}

export function negotiateSchemaVersion(version, supported) {
  const actual = parseSchemaVersion(version);
  const minimum = parseSchemaVersion(supported.minimum);
  const maximumExclusive = parseSchemaVersion(supported.maximumExclusive);
  const compare = (left, right) => (
    left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
  );
  if (compare(actual, minimum) < 0 || compare(actual, maximumExclusive) >= 0) {
    throw new SchemaValidationError('CORE_SCHEMA_VERSION_UNSUPPORTED', [
      {
        path: '$/schemaVersion',
        message: `${version} is outside [${supported.minimum}, ${supported.maximumExclusive})`,
      },
    ]);
  }
  return { version, compatibility: 'readable' };
}
