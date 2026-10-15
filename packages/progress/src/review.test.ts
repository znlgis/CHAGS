import { describe, expect, it } from 'vitest';
import { DAY_MS, createReviewState, daysUntil, gradeFromScore, isDue, nextReview } from './review';
import { migrate, emptySave, ProgressManager } from './manager';
import { SAVE_SCHEMA_VERSION } from '@chags/game-kit';
import type { SaveData } from '@chags/game-kit';

describe('nextReview', () => {
  it('答对升一级，间隔按 1/3/7/21/60 天递增', () => {
    const now = 1_000_000;
    const s0 = createReviewState();
    const s1 = nextReview(s0, 2, now);
    expect(s1.level).toBe(1);
    expect(s1.dueAt).toBe(now + 3 * DAY_MS);
    const s2 = nextReview(s1, 3, now);
    expect(s2.level).toBe(2);
    expect(s2.dueAt).toBe(now + 7 * DAY_MS);
  });

  it('答错降一级，最低回到 1 天', () => {
    const now = 0;
    let s = createReviewState();
    s = nextReview(s, 3, now);
    s = nextReview(s, 3, now);
    expect(s.level).toBe(2);
    s = nextReview(s, 0, now);
    expect(s.level).toBe(1);
    expect(s.dueAt).toBe(now + 3 * DAY_MS);
    s = nextReview(s, 0, now);
    expect(s.level).toBe(0);
    expect(s.dueAt).toBe(now + DAY_MS);
    s = nextReview(s, 0, now);
    expect(s.level).toBe(0);
  });

  it('等级不会超过最大间隔', () => {
    const now = 0;
    let s = createReviewState();
    for (let i = 0; i < 10; i += 1) s = nextReview(s, 3, now);
    expect(s.level).toBe(4);
    expect(s.dueAt).toBe(now + 60 * DAY_MS);
  });

  it('isDue 只在到期后为真', () => {
    const s = nextReview(createReviewState(), 2, 1000);
    expect(isDue(s, 1000)).toBe(false);
    expect(isDue(s, 1000 + 3 * DAY_MS)).toBe(true);
    expect(isDue(createReviewState(), Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe('daysUntil', () => {
  it('向上取整，且至少 1 天', () => {
    expect(daysUntil(3 * DAY_MS, 0)).toBe(3);
    expect(daysUntil(3 * DAY_MS + 1, 0)).toBe(4);
    expect(daysUntil(DAY_MS - 1, 0)).toBe(1);
    // 已经过期（孩子隔了很久才回来）：显示 1 天，不显示负数或 0
    expect(daysUntil(0, 5 * DAY_MS)).toBe(1);
  });
});

describe('gradeFromScore', () => {
  it('按答对率给出 0..3 级', () => {
    expect(gradeFromScore(3, 3)).toBe(3);
    expect(gradeFromScore(2, 3)).toBe(2);
    expect(gradeFromScore(1, 3)).toBe(1);
    expect(gradeFromScore(0, 3)).toBe(0);
    expect(gradeFromScore(0, 0)).toBe(0);
  });

  // 两条阈值线（100% / 60% / 30%）直接决定"下次什么时候复习"，
  // 以前只测了分母为 3 的四个点：把 0.6 改成 0.7 测试照样绿。
  it('恰好压在阈值线上：60% 是 2 级，30% 是 1 级', () => {
    expect(gradeFromScore(3, 5)).toBe(2);
    expect(gradeFromScore(3, 10)).toBe(1);
    expect(gradeFromScore(2, 10)).toBe(0);
    expect(gradeFromScore(4, 10)).toBe(1);
  });

  it('分母为 0（没答过题）不给级别，也不抛错', () => {
    expect(gradeFromScore(0, 0)).toBe(0);
    expect(gradeFromScore(5, 0)).toBe(0);
  });
});

describe('migrate', () => {
  it('版本不匹配时降级为空档而不是崩溃', () => {
    const now = 42;
    expect(migrate(null, now)).toEqual(emptySave(now));
    expect(migrate({ schemaVersion: 999, allusions: {} }, now)).toEqual(emptySave(now));
    expect(migrate({ foo: 'bar' }, now)).toEqual(emptySave(now));
  });

  it('版本匹配时保留数据', () => {
    const save: SaveData = { schemaVersion: SAVE_SCHEMA_VERSION, allusions: {}, updatedAt: 7 };
    expect(migrate(save, 42)).toEqual(save);
  });
});

describe('ProgressManager', () => {
  function memoryStore() {
    let saved: SaveData | null = null;
    return {
      saved: () => saved,
      load: async () => saved ?? emptySave(0),
      save: async (d: SaveData) => {
        saved = d;
      },
    };
  }

  it('星星只增不减，并写入复习计划', async () => {
    const store = memoryStore();
    const manager = new ProgressManager(store, () => 1000);
    await manager.init();
    const first = await manager.recordCompletion('caochong-elephant', 3, 3);
    expect(first.stars).toBe(3);
    expect(first.completions).toBe(1);
    const second = await manager.recordCompletion('caochong-elephant', 1, 1);
    expect(second.stars).toBe(3);
    expect(second.completions).toBe(2);
    expect(store.saved()?.allusions['caochong-elephant']?.stars).toBe(3);
  });

  it('due 只返回到期且学过的典故', async () => {
    const store = memoryStore();
    let clock = 0;
    const manager = new ProgressManager(store, () => clock);
    await manager.init();
    await manager.recordCompletion('a', 3, 1); // 答得一般 → 1 天后复习
    await manager.recordCompletion('b', 3, 3); // 全对 → 3 天后复习
    clock = 1 * DAY_MS + 1;
    expect(manager.due(['a', 'b', 'never-played'])).toEqual(['a']);
    clock = 4 * DAY_MS;
    expect(manager.due(['a', 'b'])).toEqual(['a', 'b']);
  });
});
