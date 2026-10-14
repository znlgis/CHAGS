import { describe, expect, it } from 'vitest';
import { MarkLevelSchema } from './schemas';
import {
  driftOffset, foundWith, hintSurface, markResult, reachSword, surfaceAt, surfaceWorldX,
} from './mark.logic';

/** 剑在水底 x=200；船帮会漂，岸上的树和一块石头不会动 */
const level = MarkLevelSchema.parse({
  sword: { x: 200, y: 980, radius: 90 },
  surfaces: [
    { id: 'boat', kind: 'boat', x: 200, y: 620, radius: 110, drifts: true, speak: '刻在船帮上' },
    { id: 'tree', kind: 'tree', x: 200, y: 1120, radius: 90, drifts: false, speak: '刻在树上' },
    { id: 'rock', kind: 'rock', x: 620, y: 1240, radius: 90, drifts: false, speak: '刻在石头上' },
  ],
  driftMs: 3600,
  driftDistance: 420,
  missLine: '记号跟着船走了。',
  hint: '记号刻在哪儿？',
});

describe('driftOffset', () => {
  it('按进度线性推进，并夹在 0..1 之间', () => {
    expect(driftOffset(0, 420)).toBe(0);
    expect(driftOffset(0.5, 420)).toBe(210);
    expect(driftOffset(1, 420)).toBe(420);
    expect(driftOffset(2, 420)).toBe(420);
    expect(driftOffset(-1, 420)).toBe(0);
  });
});

describe('surfaceWorldX', () => {
  it('会漂的面跟着船走，不动的面一动不动', () => {
    expect(surfaceWorldX(level.surfaces[0]!, 420)).toBe(620);
    expect(surfaceWorldX(level.surfaces[1]!, 420)).toBe(200);
  });
});

describe('markResult', () => {
  it('船还没开就下水：刻在船上也捞得到（一开始它是对的）', () => {
    expect(markResult(level.surfaces[0]!, 0, level)).toBe('found');
  });

  it('船一漂，刻在船上的记号就废了 —— 误差正好是漂走的距离', () => {
    const boat = level.surfaces[0]!;
    expect(reachSword(boat, 0, level)).toBe(true);
    expect(markResult(boat, 420, level)).toBe('miss');
    expect(Math.abs(surfaceWorldX(boat, 420) - level.sword.x)).toBe(420);
  });

  it('刻在不会动的地方：捞得到', () => {
    expect(markResult(level.surfaces[1]!, 420, level)).toBe('found');
  });

  it('刻在不动、但位置不对的地方：一样捞空', () => {
    expect(markResult(level.surfaces[2]!, 420, level)).toBe('miss');
  });
});

describe('foundWith / hintSurface', () => {
  it('只承认真的够得着的那个记号', () => {
    expect(foundWith(level, ['boat'], 420)).toBe(false);
    expect(foundWith(level, ['boat', 'tree'], 420)).toBe(true);
    expect(foundWith(level, ['rock'], 420)).toBe(false);
  });

  it('捞空之后总能给出一个捞得到的面（零失败）', () => {
    expect(hintSurface(level, 420)?.id).toBe('tree');
  });

  it('提示必须按"船会漂到哪儿"算：按此刻算会把人又指回船帮', () => {
    // 船还在上游时，刻在船上当然够得着 —— 可它马上就要漂走
    expect(hintSurface(level, 0)?.id).toBe('boat');
    expect(hintSurface(level, level.driftDistance)?.id).toBe('tree');
  });

  it('数据里没有能捞到的面时，退回到不会动的面，而不是没有提示', () => {
    // 只留下"会漂的船"和"位置不对的石头"：漂完之后谁都够不着剑
    const broken = MarkLevelSchema.parse({
      ...level,
      surfaces: level.surfaces.filter((s) => s.id !== 'tree'),
    });
    expect(hintSurface(broken, 420)?.id).toBe('rock');
    expect(hintSurface(broken, 420)?.drifts).toBe(false);
  });
});

describe('surfaceAt', () => {
  it('按最近的面判定，宽容度让手指粗也能刻到', () => {
    expect(surfaceAt(200, 620, level)?.id).toBe('boat');
    expect(surfaceAt(640, 1240, level)?.id).toBe('rock');
    expect(surfaceAt(330, 1250, level, 70)).toBeNull();
  });
});

describe('schema', () => {
  it('挡住"没有可比较的选择"的关卡', () => {
    expect(() =>
      MarkLevelSchema.parse({
        ...level,
        surfaces: level.surfaces.map((s) => ({ ...s, drifts: true })),
      }),
    ).toThrow();
  });

  it('会漂的面必须一开始就压在剑的位置上', () => {
    expect(() =>
      MarkLevelSchema.parse({
        ...level,
        surfaces: level.surfaces.map((s) => (s.id === 'boat' ? { ...s, x: 600 } : s)),
      }),
    ).toThrow();
  });
});