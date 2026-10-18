import { describe, expect, it } from 'vitest';
import { createSessionState, recordAttempt, starsFor } from './session';

/**
 * starsFor 是典故卡星星、也是复习间隔评级的**唯一来源**（PlayView 把星星直接当 grade），
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

/**
 * recordAttempt 是所有模板记账的唯一入口：
 * 以前 20 个模板只把成功写进去（total 与 correct 一起 +1），correct / total 恒为 1 ——
 * 复习评级（PlayView 的 gradeFromScore）永远满分、星星也永远是 3 颗。
 * 这几条守的就是"失败也要占一次尝试、correct 真的会小于 total"。
 */
describe('记一次尝试', () => {
  it('做对：total 与 correct 一起 +1，不记失误', () => {
    const s = createSessionState(0);
    recordAttempt(s, { ok: true });
    expect(s).toMatchObject({ total: 1, correct: 1, mistakes: 0 });
    expect(starsFor(s)).toBe(3);
  });

  it('做错：也是"试了一次"（total +1），但 correct 不加、失误 +1', () => {
    const s = createSessionState(0);
    recordAttempt(s, { ok: false });
    expect(s).toMatchObject({ total: 1, correct: 0, mistakes: 1 });
    expect(s.correct).toBeLessThan(s.total);
    expect(starsFor(s)).toBe(3);
  });

  it('恒胜的局：3 星、correct 等于 total（没有"错"的模板不会被冤枉）', () => {
    const s = createSessionState(0);
    for (let i = 0; i < 6; i += 1) recordAttempt(s, { ok: true });
    expect(s).toMatchObject({ total: 6, correct: 6, mistakes: 0 });
    expect(starsFor(s)).toBe(3);
  });

  it('失误多：4 次做错只剩 1 星，但永远不会是 0 星', () => {
    const s = createSessionState(0);
    for (let i = 0; i < 4; i += 1) recordAttempt(s, { ok: false });
    expect(s).toMatchObject({ total: 4, correct: 0, mistakes: 4 });
    expect(starsFor(s)).toBe(1);
  });

  it('有对有错的局：total > 0 时 correct 会真的小于 total，星星也真的会掉', () => {
    const s = createSessionState(0);
    recordAttempt(s, { ok: true });
    recordAttempt(s, { ok: false });
    recordAttempt(s, { ok: false });
    expect(s).toMatchObject({ total: 3, correct: 1, mistakes: 2 });
    expect(s.correct).toBeLessThan(s.total);
    expect(starsFor(s)).toBe(2);
  });
});
