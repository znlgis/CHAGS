import { describe, expect, it } from 'vitest';
import { createSessionState, starsFor } from './session';

/**
 * starsFor 是典故卡星星、也是复习间隔评级的**唯一来源**（PlayView 把 stars 直接当 grade），
 * 但它一直没有测试 —— 改坏了只有孩子的图鉴会变。
 */
describe('一局的状态', () => {
  it('初始值干净', () => {
    const s = createSessionState(1000);
    expect(s).toEqual({ startedAt: 1000, mistakes: 0, correct: 0, total: 0 });
  });

  it('对小朋友永远给星星，没有 0 星', () => {
    expect(starsFor({ ...createSessionState(0), mistakes: 0 })).toBe(3);
    expect(starsFor({ ...createSessionState(0), mistakes: 1 })).toBe(3);
    expect(starsFor({ ...createSessionState(0), mistakes: 2 })).toBe(2);
    expect(starsFor({ ...createSessionState(0), mistakes: 3 })).toBe(2);
    expect(starsFor({ ...createSessionState(0), mistakes: 4 })).toBe(1);
    expect(starsFor({ ...createSessionState(0), mistakes: 99 })).toBe(1);
  });

  it('无论错多少下，星星永远落在 1..3', () => {
    for (const mistakes of [0, 1, 2, 5, 17, 1000]) {
      const stars = starsFor({ ...createSessionState(0), mistakes });
      expect(stars).toBeGreaterThanOrEqual(1);
      expect(stars).toBeLessThanOrEqual(3);
    }
  });
});
