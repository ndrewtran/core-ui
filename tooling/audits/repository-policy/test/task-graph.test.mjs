import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function run(command, args, options) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

test('E-G0.0-02: affected selection runs a changed package before every dependent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'core-ui-task-graph-'));
  await mkdir(join(root, 'packages/leaf'), { recursive: true });
  await mkdir(join(root, 'packages/middle'), { recursive: true });
  await mkdir(join(root, 'packages/app'), { recursive: true });

  await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  await writeFile(
    join(root, 'record.mjs'),
    "import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.CORE_UI_TASK_LOG, `${process.argv[2]}\\n`);\n",
  );

  const packages = [
    ['leaf', {}],
    ['middle', { '@fixture/leaf': 'workspace:*' }],
    ['app', { '@fixture/middle': 'workspace:*' }],
  ];
  for (const [name, dependencies] of packages) {
    await writeFile(
      join(root, `packages/${name}/package.json`),
      JSON.stringify({
        name: `@fixture/${name}`,
        version: '0.0.0',
        private: true,
        scripts: { check: `node ../../record.mjs ${name}` },
        dependencies,
      }),
    );
  }

  run('git', ['init', '--quiet'], { cwd: root });
  run('git', ['config', 'user.name', 'Core UI fixture'], { cwd: root });
  run('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  run('git', ['add', '.'], { cwd: root });
  run('git', ['commit', '--quiet', '-m', 'fixture base'], { cwd: root });
  await writeFile(join(root, 'packages/leaf/change.txt'), 'changed\n');
  run('git', ['add', '.'], { cwd: root });
  run('git', ['commit', '--quiet', '-m', 'change leaf'], { cwd: root });

  const logPath = join(root, 'task-order.txt');
  run(
    'pnpm',
    [
      '--recursive',
      '--sort',
      '--workspace-concurrency=1',
      '--filter',
      '...[HEAD~1]',
      '--if-present',
      'run',
      'check',
    ],
    {
      cwd: root,
      env: { ...process.env, CORE_UI_TASK_LOG: logPath },
    },
  );

  assert.deepEqual(
    (await readFile(logPath, 'utf8')).trim().split('\n'),
    ['leaf', 'middle', 'app'],
  );
});
