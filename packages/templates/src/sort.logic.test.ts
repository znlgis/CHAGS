import { describe, expect, it } from 'vitest';
import { SortLevelSchema } from './schemas';
import {
  binAt, binFor, isSortComplete, isSortCorrect, needsTaste, nextUntasted, placedIn,
  probeHit, sortProgress,
} from './sort.logic';

/** 三块木牍 + 四株草；坐标随便给，判定只看 id 与距离 */
const level = SortLevelSchema.parse({
  bins: [
    { id: 'eat', kind: 'eat', x: 140, y: 1120, radius: 100, label: '能吃' },
    { id: 'cure', kind: 'cure', x: 375, y: 1120, radius: 100, label: '能治病' },
    { id: 'poison', kind: 'poison', x: 610, y: 1120, radius: 100, label: '有毒' },
  ],
  items: [
    { id: 'a', binId: 'eat', kind: 'grain', x: 160, y: 700 },
    { id: 'b', binId: 'cure', kind: 'leaf', x: 375, y: 700 },
    { id: 'c', binId: 'poison', kind: 'mushroom', x: 590, y: 700 },
    { id: 'd', binId: 'eat', kind: 'berry', x: 260, y: 860 },
  ],
  hint: '看形状，放进对的那一块',
});

describe('binAt', () => {
  it('落在最近的那块木牍上', () => {
    expect(binAt(375, 1150, level)?.id).toBe('cure');
    expect(binAt(150, 1100, level)?.id).toBe('eat');
  });

  it('离得太远就什么都没接住', () => {
    expect(binAt(375, 400, level)).toBeNull();
  });

  it('dropForgive 让小朋友不用对准', () => {
    expect(binAt(375, 1240, level)).toBeNull();
    expect(binAt(375, 1240, level, 120)?.id).toBe('cure');
  });
});

describe('配对与计数', () => {
  it('该去哪个木牍、放对了没有', () => {
    const item = level.items[0]!;
    const bin = binFor(level, item);
    expect(bin?.id).toBe('eat');
    expect(isSortCorrect(item, bin!)).toBe(true);
    expect(isSortCorrect(item, level.bins[1]!)).toBe(false);
  });

  it('同一件放两次只算一次，乱造的 id 不算数', () => {
    expect(placedIn(level.bins[0]!, level, ['a', 'a', 'ghost'])).toBe(1);
    expect(sortProgress(level, ['a', 'a', 'ghost'])).toBeCloseTo(0.25);
  });

  it('四件都归位才算完成', () => {
    expect(isSortComplete(level, ['a', 'b', 'c'])).toBe(false);
    expect(isSortComplete(level, ['a', 'b', 'c', 'd'])).toBe(true);
    expect(sortProgress(level, [])).toBe(0);
  });
});

describe('先尝后分', () => {
  it('没有 probe 的关卡不需要尝', () => {
    expect(needsTaste(level, level.items[0]!, [])).toBe(false);
    expect(nextUntasted(level, [])).toBeUndefined();
  });

  it('有 probe 时，没尝过就不能分', () => {
    const withProbe = SortLevelSchema.parse({
      ...level,
      probe: { x: 375, y: 330, radius: 90 },
      items: level.items.map((item) => ({ ...item, tastedKind: item.kind + '-tasted' })),
    });
    expect(needsTaste(withProbe, withProbe.items[0]!, [])).toBe(true);
    expect(needsTaste(withProbe, withProbe.items[0]!, ['a'])).toBe(false);
    expect(nextUntasted(withProbe, ['a', 'b'])?.id).toBe('c');
  });

  it('落点在"嘴边"半径内才算尝到', () => {
    const withProbe = SortLevelSchema.parse({
      ...level,
      probe: { x: 375, y: 330, radius: 90 },
      items: level.items.map((item) => ({ ...item, tastedKind: item.kind + '-tasted' })),
    });
    expect(probeHit(375, 380, withProbe)).toBe(true);
    expect(probeHit(375, 600, withProbe)).toBe(false);
    expect(probeHit(375, 600, withProbe, 200)).toBe(true);
  });
});

describe('关卡脚本的自我体检', () => {
  it('指向不存在的木牍、空木牍、缺 tastedKind 都会被拦下', () => {
    const base = {
      bins: level.bins,
      items: level.items,
      probe: { x: 375, y: 330, radius: 90 },
      hint: '先尝一口',
    };
    expect(SortLevelSchema.safeParse(base).success).toBe(false); // 有 probe 却没有 tastedKind
    expect(SortLevelSchema.safeParse({ ...base, probe: undefined, items: [{ ...level.items[0]!, binId: 'nope' }, ...level.items.slice(1)] }).success).toBe(false);
    expect(SortLevelSchema.safeParse({ ...base, probe: undefined, items: level.items.slice(0, 3).filter((i) => i.binId !== 'poison') }).success).toBe(false); // 有一块木牍没东西放
  });
});
