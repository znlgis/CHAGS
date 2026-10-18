import { getEntry, stageScript } from '@chags/content/full';
import { SubstitutionLevelSchema, canReach } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import { substitutionLevel } from './logic';

describe('曹冲称象 · 关卡数据', () => {
  const raw = getEntry('caochong-elephant');

  it('内容里的关卡脚本能通过模板 schema', () => {
    expect(raw).toBeTruthy();
    const level = substitutionLevel(raw!);
    expect(level.heavy.weight).toBe(3300);
    expect(level.capacity).toBe(3600);
    expect(level.stones.length).toBe(3);
  });

  it('水痕高度合理：目标重量没有顶到载重上限', () => {
    const level = substitutionLevel(raw!);
    expect(level.heavy.weight / level.capacity).toBeLessThan(0.95);
  });

  it('石头确实凑得出大象的重量（否则孩子会卡死）', () => {
    const level = substitutionLevel(raw!);
    const values = level.stones.map((s) => s.value);
    expect(canReach(level.heavy.weight, level.capacity, level.tolerance, values)).toBe(true);
  });

  it('模板 schema 会拒绝凑不出的关卡', () => {
    const broken = {
      ...(stageScript(raw!, 'substitution') as object),
      stones: [{ id: 'odd', value: 700, radius: 40 }],
    };
    // 注意：生产包里关卡脚本不再过 zod（构建期 content:check 已用同一套 schema 全量校验），
    // 所以这条负例直接对 schema 断言 —— 与 content:check 校验的是同一个 schema。
    expect(() => SubstitutionLevelSchema.parse(broken)).toThrow();
  });

  it('故事很短：屏幕上不超过两句话', () => {
    for (const beat of raw?.story ?? []) {
      expect(beat.text.length).toBeLessThanOrEqual(20);
    }
  });
});
