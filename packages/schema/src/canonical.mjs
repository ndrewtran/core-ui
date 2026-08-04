import { createHash } from 'node:crypto';

export class CanonicalJsonError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'CanonicalJsonError';
    this.code = code;
  }
}

function normalize(value, seen) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalJsonError('CANONICAL_NUMBER_INVALID', 'numbers must be finite');
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new CanonicalJsonError(
      'CANONICAL_VALUE_INVALID',
      `unsupported ${typeof value} value`,
    );
  }
  if (seen.has(value)) {
    throw new CanonicalJsonError('CANONICAL_CYCLE', 'cyclic input is not JSON');
  }
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((item) => normalize(item, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalJsonError('CANONICAL_OBJECT_INVALID', 'objects must be plain');
    }
    result = {};
    for (const key of Object.keys(value).sort()) {
      const normalizedKey = key.replace(/\r\n?/g, '\n');
      if (Object.hasOwn(result, normalizedKey)) {
        throw new CanonicalJsonError(
          'CANONICAL_KEY_COLLISION',
          `keys collide after LF normalization: ${JSON.stringify(key)}`,
        );
      }
      result[normalizedKey] = normalize(value[key], seen);
    }
  }
  seen.delete(value);
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value, new Set()));
}

export function sha256Digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function canonicalDigest(value) {
  return sha256Digest(canonicalJson(value));
}

export function parseJsonStrict(source) {
  let index = 0;

  function fail(message) {
    throw new CanonicalJsonError('JSON_PARSE_INVALID', `${message} at byte ${index}`);
  }

  function whitespace() {
    while (
      source[index] === ' '
      || source[index] === '\t'
      || source[index] === '\r'
      || source[index] === '\n'
    ) {
      index += 1;
    }
  }

  function string() {
    if (source[index] !== '"') fail('expected string');
    const start = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index];
      index += 1;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        return JSON.parse(source.slice(start, index));
      }
    }
    fail('unterminated string');
  }

  function array() {
    index += 1;
    whitespace();
    const result = [];
    if (source[index] === ']') {
      index += 1;
      return result;
    }
    while (true) {
      result.push(value());
      whitespace();
      if (source[index] === ']') {
        index += 1;
        return result;
      }
      if (source[index] !== ',') fail('expected comma');
      index += 1;
      whitespace();
    }
  }

  function object() {
    index += 1;
    whitespace();
    const result = {};
    const keys = new Set();
    if (source[index] === '}') {
      index += 1;
      return result;
    }
    while (true) {
      const key = string();
      if (keys.has(key)) {
        throw new CanonicalJsonError('JSON_DUPLICATE_KEY', `duplicate key ${key}`);
      }
      keys.add(key);
      whitespace();
      if (source[index] !== ':') fail('expected colon');
      index += 1;
      whitespace();
      result[key] = value();
      whitespace();
      if (source[index] === '}') {
        index += 1;
        return result;
      }
      if (source[index] !== ',') fail('expected comma');
      index += 1;
      whitespace();
    }
  }

  function value() {
    whitespace();
    const character = source[index];
    if (character === '"') return string();
    if (character === '{') return object();
    if (character === '[') return array();
    for (const [literal, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literal, index)) {
        index += literal.length;
        return parsed;
      }
    }
    const number = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      index += number[0].length;
      const parsed = Number(number[0]);
      if (!Number.isFinite(parsed)) fail('non-finite number');
      return parsed;
    }
    fail('unexpected token');
  }

  const parsed = value();
  whitespace();
  if (index !== source.length) fail('trailing input');
  return parsed;
}
