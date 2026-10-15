import { describe, expect, it } from 'vitest';
import { GROUPS, groupBy, isGroupId, sortedGroups } from './groups';
import { allusions, gameGroups } from './index';
import { AllusionSchema } from './schema';

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
    for (const allusion of allusions) {
      expect(
        isGroupId(allusion.group),
        allusion.id + ' 的分组「' + allusion.group + '」没有登记',
      ).toBe(true);
    }
  });

  it('分组归档不漏也不重：所有组的条目拼起来就是全部内容', () => {
    const ids = gameGroups('zh-CN').flatMap((entry) => entry.games.map((game) => game.id));
    expect(ids.length).toBe(allusions.length);
    expect([...ids].sort()).toEqual(allusions.map((a) => a.id).sort());
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
    const broken = { ...(JSON.parse(JSON.stringify(allusions[0])) as object), group: 'not-a-group' };
    expect(AllusionSchema.safeParse(broken).success).toBe(false);
  });

  it('schema 要求必须写明分组 —— 不给默认值，免得三十六计被悄悄归到典故里', () => {
    const missing = JSON.parse(JSON.stringify(allusions[0])) as { group?: string };
    delete missing.group;
    expect(AllusionSchema.safeParse(missing).success).toBe(false);
  });
});
