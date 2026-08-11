import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const labels = [
  'Source identity',
  'Executed identity',
  'Proof-tool identity',
  'Identity correlation owner',
  'Evidence identity',
  'Review packet identity',
  'Invalidation domains',
];

export function registerTemplateTests(repositoryRoot) {
  test('E-DELIVERY-08 candidate templates collect distinct identities and link profile-owned values', async () => {
    const pullRequest = await readFile(join(repositoryRoot, '.github/pull_request_template.md'), 'utf8');
    const evidence = await readFile(join(repositoryRoot, '.github/ISSUE_TEMPLATE/evidence.yml'), 'utf8');
    for (const label of labels) {
      assert.equal(pullRequest.split(`${label}:`).length - 1, 1, `${label} PR field`);
      assert.match(evidence, new RegExp(`label: ${label.replace(' identity', '.*identity')}`, 'i'));
    }
    assert.match(pullRequest, /delivery-workflow-profile\.json/);
    assert.match(evidence, /active delivery workflow profile/);
  });

  test('E-DELIVERY-08 cold-start routes reach both runbooks, skill, and profile', async () => {
    const tooling = await readFile(join(repositoryRoot, 'tooling/AGENTS.md'), 'utf8');
    const tests = await readFile(join(repositoryRoot, 'tests/AGENTS.md'), 'utf8');
    const packageRunbook = await readFile(join(repositoryRoot, 'tooling/audits/repository-policy/README.md'), 'utf8');
    const evidenceRunbook = await readFile(join(repositoryRoot, 'tests/evidence/README.md'), 'utf8');
    const skill = await readFile(join(repositoryRoot, '.agents/skills/core-ui-delivery/SKILL.md'), 'utf8');
    assert.match(tooling, /repository-policy\/README\.md/);
    assert.match(tests, /evidence\/README\.md/);
    assert.match(packageRunbook, /delivery-workflow-profile\.json/);
    assert.match(evidenceRunbook, /delivery-workflow-profile\.json/);
    assert.match(skill, /core-ui-delivery-guard/);
  });
}
