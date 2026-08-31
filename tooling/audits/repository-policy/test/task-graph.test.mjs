import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const affectedTaskRunner = resolve(
  import.meta.dirname,
  '../src/run-workspace-task.mjs',
);

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
  const root = await mkdtemp(join(tmpdir(), 'muxui-task-graph-'));
  await mkdir(join(root, 'packages/leaf'), { recursive: true });
  await mkdir(join(root, 'packages/middle'), { recursive: true });
  await mkdir(join(root, 'packages/app'), { recursive: true });
  await mkdir(join(root, 'tooling/audits/repository-policy'), { recursive: true });

  await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  await writeFile(
    join(root, 'tooling/audits/repository-policy/repository-policy.json'),
    JSON.stringify({ globalTaskInputs: [] }),
  );
  await writeFile(
    join(root, 'record.mjs'),
    "import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.MUXUI_TASK_LOG, `${process.argv[2]}\\n`);\n",
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
  run('git', ['config', 'user.name', 'Mux UI fixture'], { cwd: root });
  run('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: root });
  run('git', ['add', '.'], { cwd: root });
  run('git', ['commit', '--quiet', '-m', 'fixture base'], { cwd: root });
  await writeFile(join(root, 'packages/leaf/change.txt'), 'changed\n');
  run('git', ['add', '.'], { cwd: root });
  run('git', ['commit', '--quiet', '-m', 'change leaf'], { cwd: root });

  const logPath = join(root, 'task-order.txt');
  const result = run(
    process.execPath,
    [affectedTaskRunner, 'check', '--affected'],
    {
      cwd: root,
      env: {
        ...process.env,
        MUXUI_BASE_REF: 'HEAD~1',
        MUXUI_TASK_LOG: logPath,
        MUXUI_TASK_REPOSITORY_ROOT: root,
      },
    },
  );

  assert.match(result.stdout, /\[workspace-task\] check: changed packages plus dependents/);
  assert.deepEqual(
    (await readFile(logPath, 'utf8')).trim().split('\n'),
    ['leaf', 'middle', 'app'],
  );
});
