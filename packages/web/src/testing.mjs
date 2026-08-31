import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogJson } from '@muxui/catalog/bundle';
import { inspectRuntime } from './runtime-implementation.mjs';

const bundle = JSON.parse(catalogJson);
const button = bundle.artifacts.find(({ id }) => id === 'muxui:component:button');
const stylesheet = await readFile(resolve(import.meta.dirname, '../generated/button.css'), 'utf8');
const stylesheetDigest = `sha256:${createHash('sha256').update(stylesheet).digest('hex')}`;
const fixtureSource = JSON.parse(await readFile(
  resolve(import.meta.dirname, '../../../tests/fixtures/g1.1/platform-safety-fixtures.json'),
  'utf8',
));

export const platformSafetyFixture = Object.freeze({
  id: fixtureSource.fixture,
  componentSupportClaim: fixtureSource.componentSupportClaim,
  stylesheet,
  stylesheetDigest,
  profiles: Object.freeze(Object.fromEntries(fixtureSource.profiles.map((fixture) => [
    fixture.profile,
    Object.freeze({
      ...fixture,
      requirementSet: button.platformSafetyRequirementSets[`${fixture.profile}:${fixture.profile}`],
    }),
  ]))),
});

export { inspectRuntime };
