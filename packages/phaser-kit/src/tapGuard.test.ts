import { describe, expect, it } from 'vitest';
import { TAP_LOCK_MS, isTapArmed, tapArmedAt } from './tapGuard';

/**
 * 这条规矩是 e2e 抓出来的：点击区从**建区时刻**起锁 350ms 时，
 * "故事刚念完就点"这一下会被静默吞掉 —— 听完却进不了玩法。
 */
describe('连点保护：锁从"上一次翻页"起算', () => {
  it('故事刚念完就点：算数（旧的"从建区起算"会把它吞掉）', () => {
    const lastAdvance = 0; // 上一幕翻页的时刻
    const readyAt = 4200; // 这一幕念完、点击区建好的时刻
    const tapAt = readyAt + 5; // 孩子看到小手出现，抬手就点
    expect(isTapArmed(tapAt, lastAdvance)).toBe(true);
    // 旧写法是从建区起算的：这 5ms 之差就是 e2e 里"听完了却进不了玩法"
    expect(tapAt - readyAt).toBeLessThan(TAP_LOCK_MS);
  });

  it('紧接着上一次翻页的第二下不算数（无正文的一幕会被整段跳过）', () => {
    expect(isTapArmed(0, 0)).toBe(false);
    expect(isTapArmed(TAP_LOCK_MS - 1, 0)).toBe(false);
    expect(isTapArmed(TAP_LOCK_MS, 0)).toBe(true);
  });

  it('还没翻过页时（第一幕）立刻就能点', () => {
    expect(tapArmedAt(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
    expect(isTapArmed(0, Number.NEGATIVE_INFINITY)).toBe(true);
  });
});
