import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { webSurfaces } from '../src/index.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const examples = [
  {
    descriptor: 'catalog/components/button/examples/html/basic.example.json',
    source: 'catalog/components/button/examples/html/basic.html',
    bindingId: 'web.html',
  },
  {
    descriptor: 'catalog/components/button/examples/react/basic.example.json',
    source: 'catalog/components/button/examples/react/basic.tsx',
    bindingId: 'web.react',
  },
];

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function consumedHooks(source) {
  return {
    classes: [...source.matchAll(/(?:class|className)\s*=\s*["']([^"']+)["']/gu)]
      .flatMap((match) => match[1].split(/\s+/u)).filter(Boolean),
    attributes: [...source.matchAll(/\b(data-core-[a-z0-9-]+)(?:\s*=|\b)/gu)].map((match) => match[1]),
    selectors: [...source.matchAll(/querySelector(?:All)?\s*\(\s*["']([^"']+)["']/gu)].map((match) => match[1]),
  };
}

test('E-G1.1-02 canonical examples consume no undocumented topology', async () => {
  const identities = [];
  for (const example of examples) {
    const descriptorBytes = await readFile(resolve(repositoryRoot, example.descriptor), 'utf8');
    const descriptor = JSON.parse(descriptorBytes);
    const source = await readFile(resolve(repositoryRoot, example.source), 'utf8');
    const hooks = consumedHooks(source);
    const surface = webSurfaces[example.bindingId].surface;
    assert.equal(descriptor.binding.ref, surface.bindingRef);
    assert.equal(descriptor.source, example.source);
    assert.ok(hooks.classes.every((name) => name === surface.rootClass.slice(1)));
    assert.ok(hooks.attributes.every((name) => surface.states.includes(name) || name === 'data-core-slot'));
    assert.deepEqual(hooks.selectors, []);
    assert.ok(!/\b(wrapper|utility|keyframe|nth-child)\b/iu.test(source));
    identities.push({
      id: descriptor.id,
      bindingRef: descriptor.binding.ref,
      descriptorDigest: digest(descriptorBytes),
      source: example.source,
      sourceDigest: digest(source),
      consumedHooks: hooks,
    });
  }
  assert.deepEqual(identities.map(({ id }) => id), [
    'core:example:button-basic-html',
    'core:example:button-basic-react',
  ]);
});
