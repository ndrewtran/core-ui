import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFamily } from '../src/index.mjs';

const CODES = [
  'CORE_PROJECT_NOT_FOUND',
  'CORE_CATALOG_NOT_DECLARED',
  'CORE_CATALOG_NOT_INSTALLED',
  'CORE_CATALOG_DECLARATION_DRIFT',
  'CORE_CATALOG_INTEGRITY_MISMATCH',
  'CORE_CATALOG_RESOLUTION_AMBIGUOUS',
  'CORE_CATALOG_INCOMPATIBLE',
];

function diagnostic(code) {
  return {
    code,
    ruleId: 'resolver.fixture.closed',
    message: 'Resolver fixture.',
    retryable: true,
    details: {
      workspacePackage: 'consumer',
      workspacePath: 'apps/consumer',
      packageManager: 'pnpm@10.33.0',
      declaredRange: '^1.0.0',
      lockfileVersions: ['1.0.0'],
      installedVersions: ['1.0.0'],
      catalogVersion: '1.0.0',
      catalogDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      expectedDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      actualDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      candidates: [{
        relativePath: 'node_modules/@core-ui/catalog',
        version: '1.0.0',
        catalogDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        rejectionReasons: [],
      }],
      compatibilityFailures: [],
      secondaryFailures: [],
    },
  };
}

test('G0.4 resolver codes discriminate closed detail schemas', () => {
  for (const code of CODES) {
    assert.equal(validateFamily('diagnostic', diagnostic(code)).code, code);
    const unknown = diagnostic(code);
    unknown.details.absoluteWorkspaceRoot = '/private/consumer';
    assert.throws(() => validateFamily('diagnostic', unknown), /CORE_SCHEMA_INVALID/);
  }
});
