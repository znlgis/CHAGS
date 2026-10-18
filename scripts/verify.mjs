import { spawn } from 'node:child_process';

/**
 * 提交前门禁：typecheck / lint / test / content:check / build 并行跑，最后串行跑 size（它读 dist）。
 *
 * 以前根 package.json 用 && 串成一条链（65.8s），其中 typecheck 13s、lint 30s、test 10s
 * 之间没有任何依赖关系 —— 串行纯属浪费。并行后约 35s（4 核机器），
 * 而"提交前必须全绿"这条纪律一点没放松：任一步失败，整体非 0。
 *
 * 步骤之间的输出保留各自前缀，挂在哪一步一眼能看出来。
 */
const STEPS = [
  { name: 'typecheck', command: 'pnpm typecheck' },
  { name: 'lint', command: 'pnpm lint' },
  { name: 'test', command: 'pnpm test' },
  { name: 'content:check', command: 'pnpm content:check' },
  { name: 'build', command: 'pnpm build' },
];

const COLORS = ['\u001b[36m', '\u001b[35m', '\u001b[33m', '\u001b[32m', '\u001b[34m'];
const RESET = '\u001b[0m';

const started = Date.now();

function run(name, command, color) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const prefix = color + '[' + name + ']' + RESET + ' ';
    const pipe = (stream, out) => {
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) out.write(prefix + line + '\n');
      });
      stream.on('end', () => {
        if (buffer.length > 0) out.write(prefix + buffer + '\n');
      });
    };
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on('close', (code) => resolve({ name, code: code ?? 1 }));
  });
}

const results = await Promise.all(
  STEPS.map((step, index) => run(step.name, step.command, COLORS[index % COLORS.length])),
);

const failed = results.filter((result) => result.code !== 0);
if (failed.length > 0) {
  console.error(
    '\n✗ 门禁失败：' + failed.map((result) => result.name + ' (exit ' + result.code + ')').join('、'),
  );
  process.exit(1);
}

// size 读 dist，必须在 build 之后
const size = await run('size', 'pnpm size', COLORS[0]);
if (size.code !== 0) {
  console.error('\n✗ 体积门禁失败');
  process.exit(1);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log('\n✅ 全部门禁通过（' + seconds + 's）');
