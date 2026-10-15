import type { GameManifest } from '@chags/game-kit';
import { entrySummaries } from '@chags/content';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { registry } from './registry';

/**
 * 内容 id 一共出现在四个地方：内容 JSON（摘要 + 详情两份）、entries/index.ts、这个注册表、以及 e2e 的遍历。
 * 新增一个游戏（或者手滑打错一个 id）时，以前是全绿 —— 用户点进去才会看到"找不到这个游戏"。
 */
describe('内容注册表', () => {
  it('内容里有几条，注册表里就要有几个', () => {
    expect(Object.keys(registry).sort()).toEqual(entrySummaries.map((a) => a.id).sort());
  });

  it('注册表里的每个 id 都能对应到一份内容', () => {
    const ids = new Set(entrySummaries.map((a) => a.id));
    for (const id of Object.keys(registry)) {
      expect(ids.has(id), id + ' 没有对应的内容 JSON').toBe(true);
    }
  });

  it('每个 id 都有懒加载入口（不是 undefined）', () => {
    for (const [id, load] of Object.entries(registry)) {
      expect(typeof load, id + ' 的加载函数不对').toBe('function');
    }
  });
});

/**
 * 游戏包的 manifest 是**第五处**登记内容 id 的地方，而且它以前谁都不看：
 * 盘古的 template 写着早已不存在的 'grow'、曹冲的 version 与 package.json 不一致，
 * 两处都活了很久没人发现（apps/site 不读 manifest.template，也没有测试比对）。
 *
 * manifest 只 import 类型与纯常量（@chags/templates/layout），所以能在 Node 里直接导入 ——
 * 这一条是那次 import 改动的回报。
 */
// 注意用**根路径**写法：'../../games/...' 这种相对 glob 在 vitest 里匹配不到（实测 0 个）
const manifests = import.meta.glob<{ manifest: GameManifest }>('/games/*/src/manifest.ts', {
  eager: true,
});

const ENTRY_DIR = fileURLToPath(new URL('../../../packages/content/src/entries', import.meta.url));

/** 这条内容实际用到的玩法模板（关卡脚本在"详情"那半：<id>.game.json） */
function stageTemplates(id: string): string[] {
  const raw = JSON.parse(readFileSync(join(ENTRY_DIR, id + '.game.json'), 'utf8')) as {
    game: { stages: { template: string }[] };
  };
  return raw.game.stages.map((stage) => stage.template);
}

/** 游戏包 package.json 里的版本号 */
function packageVersion(id: string): string {
  const path = join(ENTRY_DIR, '..', '..', '..', '..', 'games', id, 'package.json');
  return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
}

describe('游戏包 manifest ↔ 内容 ↔ 注册表', () => {
  const byId = new Map(
    Object.entries(manifests).map(([path, mod]) => {
      const match = /[\\/]games[\\/]([^\\/]+)[\\/]src[\\/]manifest\.ts$/.exec(path);
      if (!match) throw new Error('manifest 路径不像 games/<id>/src/manifest.ts：' + path);
      return [match[1]!, mod.manifest];
    }),
  );

  it('每个内容 id 都有一个游戏包 manifest（少一个就是"点进去打不开"）', () => {
    expect([...byId.keys()].sort()).toEqual(entrySummaries.map((entry) => entry.id).sort());
  });

  it('manifest.id 必须等于它所在的目录名', () => {
    for (const [id, manifest] of byId) {
      expect(manifest.id, id + ' 的 manifest.id 与目录名对不上').toBe(id);
    }
  });

  it('标题与年龄跟内容摘要一致（两边各写一份，最容易抄错）', () => {
    for (const entry of entrySummaries) {
      const manifest = byId.get(entry.id);
      expect(manifest, entry.id + ' 缺少 manifest').toBeTruthy();
      expect(manifest!.title, entry.id + ' 的标题不一致').toBe(entry.title);
      expect(manifest!.ageRange, entry.id + ' 的年龄不一致').toEqual(entry.ageRange);
    }
  });

  it('manifest.template 必须真的用在这条内容的关卡脚本里', () => {
    for (const entry of entrySummaries) {
      const manifest = byId.get(entry.id)!;
      const stages = stageTemplates(entry.id);
      expect(
        stages,
        entry.id + ' 的 manifest.template = ' + manifest.template + ' 不在关卡脚本 ' + stages.join('/') + ' 里',
      ).toContain(manifest.template);
    }
  });

  it('manifest.version 与游戏包 package.json 一致', () => {
    for (const [id, manifest] of byId) {
      expect(manifest.version, id + ' 的版本号两处不一致').toBe(packageVersion(id));
    }
  });
});
