import { describe, expect, it } from 'vitest';
import { GROUPS, groupBy, isGroupId, sortedGroups } from './groups';
import { entries, gameGroups } from './index';
import { ContentEntrySchema } from './schema';

describe('分组表', () => {
  it('分组 id 不重复，order 也不重复', () => {
    const ids = GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = GROUPS.map((g) => g.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('没登记的分组 id 一律不认', () => {
    expect(isGroupId('allusion')).toBe(true);
    expect(isGroupId('stratagem')).toBe(true);
    expect(isGroupId('not-a-group')).toBe(false);
    expect(isGroupId('')).toBe(false);
  });

  it('排序按 order 升序，而且不动原表', () => {
    const sorted = sortedGroups();
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.order).toBeGreaterThan(sorted[i - 1]!.order);
    }
    expect(GROUPS.map((g) => g.id)).toEqual([...GROUPS].map((g) => g.id));
  });

  it('空组也留在归档结果里 —— 三十六计现在没有游戏，但必须占一个位置', () => {
    const grouped = groupBy([{ group: 'allusion' }]);
    expect(grouped.map((entry) => entry.group.id)).toEqual(sortedGroups().map((g) => g.id));
    expect(grouped.find((entry) => entry.group.id === 'stratagem')?.items).toEqual([]);
  });
});

describe('内容与分组的关系', () => {
  it('每条内容的分组都登记过', () => {
    for (const entry of entries) {
      expect(
        isGroupId(entry.group),
        entry.id + ' 的分组「' + entry.group + '」没有登记',
      ).toBe(true);
    }
  });

  it('分组归档不漏也不重：所有组的条目拼起来就是全部内容', () => {
    const ids = gameGroups('zh-CN').flatMap((entry) => entry.games.map((game) => game.id));
    expect(ids.length).toBe(entries.length);
    expect([...ids].sort()).toEqual(entries.map((a) => a.id).sort());
  });

  it('按年代排的组，组内确实按年代递增', () => {
    for (const { group, games } of gameGroups('zh-CN')) {
      if (group.orderBy !== 'year') continue;
      for (let i = 1; i < games.length; i += 1) {
        expect(games[i]!.yearApprox).toBeGreaterThanOrEqual(games[i - 1]!.yearApprox);
      }
    }
  });

  it('schema 拒绝没登记的分组 —— 新增一组时忘了登记，构建期就该红', () => {
    const broken = { ...(JSON.parse(JSON.stringify(entries[0])) as object), group: 'not-a-group' };
    expect(ContentEntrySchema.safeParse(broken).success).toBe(false);
  });

  it('schema 要求必须写明分组 —— 不给默认值，免得三十六计被悄悄归到典故里', () => {
    const missing = JSON.parse(JSON.stringify(entries[0])) as { group?: string };
    delete missing.group;
    expect(ContentEntrySchema.safeParse(missing).success).toBe(false);
  });
});

/**
 * 三十六计的结构约束。
 * 现在还一条内容都没有，所以这几条断言是"空跑"的 —— 等批 1 的内容进来，
 * 它们立刻开始守：序号不重不漏、登记顺序就是计策序号、套号与序号对得上。
 */
describe('三十六计的约束', () => {
  const stratagems = entries.filter((entry) => entry.stratagem !== undefined);

  it('stratagem 组必须写 stratagem 字段，典故组写了就是错', () => {
    for (const entry of entries) {
      expect(
        entry.stratagem !== undefined,
        entry.id + '：group 与 stratagem 字段对不上（group=' + entry.group + '）',
      ).toBe(entry.group === 'stratagem');
    }
  });

  it('登记顺序就是计策序号：从 1 开始、不重、不漏', () => {
    const numbers = stratagems.map((entry) => entry.stratagem!.number);
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });

  it('套号与序号对应：第 n 套 = 序号 6(n−1)+1 … 6n', () => {
    for (const entry of stratagems) {
      const { number, set } = entry.stratagem!;
      expect(set, entry.id + ' 的套号与序号对不上').toBe(Math.ceil(number / 6));
    }
  });

  it('schema 挡住"三十六计忘了写 stratagem"与"典故偷偷写了 stratagem"', () => {
    const base = JSON.parse(JSON.stringify(entries[0])) as Record<string, unknown>;
    const stratagem = { number: 1, set: 1 };
    expect(ContentEntrySchema.safeParse({ ...base, stratagem }).success, '典故组不许有 stratagem').toBe(false);
    expect(ContentEntrySchema.safeParse({ ...base, group: 'stratagem' }).success, '三十六计必须写 stratagem').toBe(false);
    expect(
      ContentEntrySchema.safeParse({ ...base, group: 'stratagem', kind: 'strategy', stratagem }).success,
      '写全了就该通过',
    ).toBe(true);
    expect(
      ContentEntrySchema.safeParse({ ...base, group: 'stratagem', kind: 'strategy', stratagem: { ...stratagem, number: 7, set: 1 } }).success,
      '套号与序号对不上要挡住',
    ).toBe(false);
  });
});
