import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { entrySummaries } from './index';

/**
 * 内容登记守卫：目录里有多少 JSON，就必须在四份手写登记表里各出现多少次。
 *
 * 以前这些地方全靠人抄（新增一个游戏要改 4 个文件、各加一行 import）：
 * 抄漏了没有任何测试会发现 —— 大厅少一个游戏、或者进游戏时"内容不存在"。
 * 这几条断言把"漏登记"变成 pnpm test 里的红。
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));
const ENTRIES = join(SRC, 'entries');
const EN = join(SRC, 'i18n', 'en');

const ids = entrySummaries.map((entry) => entry.id).sort();

function idsOf(dir: string, suffix: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => name.slice(0, -suffix.length))
    .sort();
}

describe('内容目录 ↔ 手写登记表', () => {
  it('目录里每个摘要 JSON 都登记进了 entrySummaries', () => {
    expect(ids).toEqual(idsOf(ENTRIES, '.json').filter((id) => !id.endsWith('.game')));
  });

  it('每条内容都有详情文件（<id>.game.json）', () => {
    expect(idsOf(ENTRIES, '.game.json')).toEqual(ids);
  });

  it('每条内容都有英文摘要补丁与英文详情补丁', () => {
    expect(idsOf(EN, '.json').filter((id) => !id.endsWith('.game')), '摘要译文').toEqual(ids);
    expect(idsOf(EN, '.game.json'), '详情译文').toEqual(ids);
  });

  it('四份手写登记表里每个 id 都出现了（漏一行就是"点进去找不到"）', () => {
    const registrations = [
      'entries/index.ts',
      'entries/detail.ts',
      'i18n/en.ts',
      'i18n/game.ts',
    ];
    for (const relative of registrations) {
      const text = readFileSync(join(SRC, relative), 'utf8');
      const missing = ids.filter((id) => !text.includes(id));
      expect(missing, relative + ' 里漏登记了：' + missing.join('、')).toEqual([]);
    }
  });
});
