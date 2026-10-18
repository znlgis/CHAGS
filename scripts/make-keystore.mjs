import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * 生成安卓签名密钥，并打印要贴进 GitHub Secrets 的四样东西。
 *
 * 为什么需要它：没有密钥时，CI 会用 debug 密钥兜底 —— APK 照样能装到自己手机上
 * （见 docs/打包与分发.md §4），但 debug 密钥可能每次构建都不一样：
 * 手机上装新版会报"签名不一致"，只能先卸载旧版（卸载会清掉本地存档）。
 *
 * 自己生成一次正式密钥：
 *   - 本地 pnpm dist:apk 从此用固定密钥签名；
 *   - 把四样东西贴进仓库 Secrets 后，CI 发的每个版本也能直接覆盖安装。
 *
 * 用法：pnpm keystore [--force]
 */

const args = process.argv.slice(2);
/** --out <目录>：把密钥写到别处（默认 apps/mobile/android，供自测与临时试用） */
const outIndex = args.indexOf('--out');
const ANDROID_DIR = outIndex >= 0 && args[outIndex + 1]
  ? resolve(args[outIndex + 1])
  : join(process.cwd(), 'apps', 'mobile', 'android');
const KEYSTORE = join(ANDROID_DIR, 'chags-release.keystore');
const PROPS = join(ANDROID_DIR, 'keystore.properties');
const ALIAS = 'chags';
const isWindows = process.platform === 'win32';

/** JDK 的 release 文件里有 JAVA_VERSION，用来避开 Gradle 8.14 不支持的 25+ */
function majorOf(jdkDir) {
  try {
    const text = readFileSync(join(jdkDir, 'release'), 'utf8');
    return Number(/JAVA_VERSION="(\d+)/.exec(text)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

function findKeytool() {
  const dirs = [];
  // 1) 环境变量指定的 JDK
  for (const env of ['CHAGS_JDK', 'JAVA_HOME']) {
    const dir = process.env[env];
    if (dir) dirs.push(dir);
  }
  // 2) 常见安装位置（和 scripts/build-apk.mjs 找 JDK 的口径一致）
  const roots = isWindows
    ? ['C:\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java']
    : ['/usr/lib/jvm'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) dirs.push(join(root, name));
  }

  const bin = (dir) => join(dir, 'bin', isWindows ? 'keytool.exe' : 'keytool');
  const usable = dirs.filter((dir) => existsSync(bin(dir)));
  // 优先 17–24（与 gradle 8.14 能用的范围一致），它们生成的是最保守的 PKCS12
  const preferred = usable.find((dir) => {
    const major = majorOf(dir);
    return major >= 17 && major <= 24;
  });
  return preferred ? bin(preferred) : (usable[0] ? bin(usable[0]) : null);
}

const force = args.includes('--force');
mkdirSync(ANDROID_DIR, { recursive: true });
if (existsSync(KEYSTORE) && force) {
  // --force 必须**真的删掉**旧文件：以前只跳过下面的存在性检查，
  // 随后 keytool 用新随机密码去打开旧 keystore，必然失败（"-force 必挂"）。
  rmSync(KEYSTORE, { force: true });
  rmSync(PROPS, { force: true });
}
if (existsSync(KEYSTORE) && !force) {
  console.error(
    [
      '已经存在：' + relative(process.cwd(), KEYSTORE),
      '换密钥会让手机上已装的版本再也无法覆盖安装（只能卸载重装），所以这里不覆盖。',
      '确实要换一把新的，加 --force（旧的请先备份）。',
    ].join('\n'),
  );
  process.exit(1);
}

const keytool = findKeytool();
if (!keytool) {
  console.error(
    [
      '找不到 keytool（JDK 自带）。',
      '装一个 JDK 17–21（Temurin 即可），或用 CHAGS_JDK / JAVA_HOME 指定 JDK 目录。',
    ].join('\n'),
  );
  process.exit(1);
}

// base64url：只有 [A-Za-z0-9_-]，塞进 shell / YAML / Secrets 都不会被转义问题咬到
const storePassword = randomBytes(18).toString('base64url');
const keyPassword = storePassword;

console.log('使用 keytool：' + keytool);
const result = spawnSync(
  keytool,
  [
    '-genkeypair', '-v',
    '-keystore', KEYSTORE,
    '-storepass', storePassword,
    '-keypass', keyPassword,
    '-alias', ALIAS,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    // 10000 天 ≈ 27 年：这是个给小朋友玩的小游戏，别让密钥在用户手里过期
    '-validity', '10000',
    '-dname', 'CN=CHAGS, O=CHAGS, C=CN',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
);
if (result.status !== 0) {
  console.error((result.stderr ?? '') + (result.stdout ?? ''));
  process.exit(result.status ?? 1);
}

// 本地构建（pnpm dist:apk）也走固定密钥：gradle 读的就是这个文件
const props = [
  'storeFile=chags-release.keystore',
  'storePassword=' + storePassword,
  'keyAlias=' + ALIAS,
  'keyPassword=' + keyPassword,
  '',
].join('\n');
writeFileSync(PROPS, props, 'utf8');

const base64 = readFileSync(KEYSTORE).toString('base64');
console.log('');
console.log('✅ 已生成：' + relative(process.cwd(), KEYSTORE));
console.log(
  '✅ 已写入：' + relative(process.cwd(), PROPS) +
    (outIndex >= 0 ? '' : '（本地 pnpm dist:apk 从现在起就用这把密钥）'),
);
console.log('');
console.log('⚠️  这两个文件都不入库（.gitignore 已忽略）—— 请自己备份，丢了就再也发不出能覆盖安装的新版本。');
console.log('');
console.log('想让 CI 发的版本也能直接覆盖安装，把这四个填进');
console.log('GitHub → Settings → Secrets and variables → Actions（名称要一模一样）：');
console.log('');
console.log('ANDROID_KEYSTORE_BASE64 = ' + base64);
console.log('ANDROID_KEYSTORE_PASSWORD = ' + storePassword);
console.log('ANDROID_KEY_ALIAS = ' + ALIAS);
console.log('ANDROID_KEY_PASSWORD = ' + keyPassword);
console.log('');
console.log('（只想自己手机上装、不想配 Secrets 也行：不配时 CI 用 debug 密钥签名，');
console.log('  APK 照样能装，只是换版本时可能要卸载旧版；见 docs/打包与分发.md §4）');
