import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';

const output = await mkdtemp(join(tmpdir(), 'muxui-react-playground-build-'));
try {
  await build({ logLevel: 'silent', root: resolve(import.meta.dirname, '..'), build: { outDir: output, emptyOutDir: true } });
} finally {
  await rm(output, { recursive: true, force: true });
}
