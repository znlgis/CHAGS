import { describe, expect, it } from 'vitest';
import { WaitLevelSchema } from './schemas';
import {
  applyTemptation, effectiveDuration, isWaitDone, lineAt, waitProgress, waitRequired, waitStart,
} from './wait.logic';

const level = WaitLevelSchema.parse({
  durationMs: 40_000,
  temptations: [
    { id: 'bend', kind: 'bend', x: 140, y: 1150, penaltyMs: 5000, line: '我要钓的，不是鱼。' },
    { id: 'bait', kind: 'bait', x: 375, y: 1150, penaltyMs: 5000, line: '不用饵。' },
  ],
  penaltyCap: 3,
  lines: ['别急。', '水会告诉我的。'],
  finale: { x: 560, y: 340, radius: 90 },
  hint: '再等一等',
});

describe('等', () => {
  it('时间到了就算等到', () => {
    const state = waitStart();
    expect(isWaitDone(level, state, 39_999)).toBe(false);
    expect(isWaitDone(level, state, 40_000)).toBe(true);
  });

  it('点一次诱惑，终点往后挪一点', () => {
    const once = applyTemptation(level, waitStart(), 5000);
    expect(waitRequired(level, once)).toBe(45_000);
    expect(once.hits).toBe(1);
  });

  it('推满上限之后只回应、不再延后 —— 永远不会等不到头', () => {
    let state = waitStart();
    for (let i = 0; i < 10; i += 1) state = applyTemptation(level, state, 5000);
    expect(state.hits).toBe(3);
    expect(waitRequired(level, state)).toBe(55_000);
  });

  it('进度只增不减，而且不会超过 1', () => {
    const state = applyTemptation(level, waitStart(), 5000);
    expect(waitProgress(level, state, 0)).toBe(0);
    expect(waitProgress(level, state, 45_000)).toBe(1);
    expect(waitProgress(level, state, 90_000)).toBe(1);
    expect(waitProgress(level, state, 22_500)).toBeCloseTo(0.5);
  });

  it('点老人时的话轮着来', () => {
    expect(lineAt(level, 0)).toBe('别急。');
    expect(lineAt(level, 1)).toBe('水会告诉我的。');
    expect(lineAt(level, 2)).toBe('别急。');
  });

  it('无头验证下把等待压短，但仍然要等一会儿', () => {
    expect(effectiveDuration(level, false)).toBe(40_000);
    const fast = effectiveDuration(level, true);
    expect(fast).toBeLessThan(8000);
    expect(fast).toBeGreaterThanOrEqual(1500);
  });
});
