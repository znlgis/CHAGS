import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 构建安卓 APK。
 *
 * 存在的理由：系统上装的可能是 JDK 25，而 **Gradle 8.14 只支持到 JDK 24**
 * （实测报 "Unsupported class file major version 69"）。
 * 这里自动挑一个 17–21 的 JDK，避免每个人都要手动切 JAVA_HOME。
 */

const repoRoot = process.cwd();
const androidDir = join(repoRoot, 'apps', 'mobile', 'android');
const isWindows = process.platform === 'win32';

function findJdk() {
  const candidates = [];
  if (process.env.CHAGS_JDK) candidates.push(process.env.CHAGS_JDK);
  candidates.push(isWindows ? 'C:\\Java\\jdk21' : '/usr/lib/jvm/temurin-21-jdk');

  const roots = isWindows
    ? ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java']
    : ['/usr/lib/jvm'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (/^jdk-?(17|21|23)[.\-_]/i.test(name) || /^temurin-(17|21|23)-/i.test(name)) {
        candidates.push(join(root, name));
      }
    }
  }

  for (const dir of candidates) {
    const java = join(dir, 'bin', isWindows ? 'java.exe' : 'java');
    if (!existsSync(java)) continue;
    const probe = spawnSync(java, ['-version'], { encoding: 'utf8' });
    const text = (probe.stderr ?? '') + (probe.stdout ?? '');
    const major = Number(/version "(\d+)/.exec(text)?.[1] ?? '0');
    if (major >= 17 && major <= 24) return { dir, major };
  }
  return null;
}

const jdk = findJdk();
if (!jdk) {
  console.error(
    [
      '找不到可用的 JDK（需要 17–24）。',
      'Gradle 8.14 不支持 JDK 25，会报 "Unsupported class file major version 69"。',
      '安装 Temurin 21 后重试，或用 CHAGS_JDK 指定 JDK 目录。',
    ].join('\n'),
  );
  process.exit(1);
}

console.log('使用 JDK ' + jdk.major + '：' + jdk.dir);
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradlew, ['assembleRelease', '--no-daemon'], {
  cwd: androidDir,
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: jdk.dir },
});
process.exit(result.status ?? 1);
