import { getEntry } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { placeLevel } from './logic';

describe('女娲补天 · 关卡数据', () => {
  const raw = getEntry('nuwa');

  it('五色石补五个洞，一个不多一个不少', () => {
    const level = placeLevel(raw!);
    expect(level.slots.length).toBe(5);
    expect(level.orbs.length).toBe(5);
  });

  it('每个洞的形状都不一样 —— 判定靠形状，不靠颜色（色弱的孩子也能玩）', () => {
    const level = placeLevel(raw!);
    const kinds = level.slots.map((s) => s.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('石头与洞的形状一一对应', () => {
    const level = placeLevel(raw!);
    for (const orb of level.orbs) {
      const slot = level.slots.find((s) => s.id === orb.slotId);
      expect(slot, orb.id + ' 找不到对应的洞').toBeTruthy();
      expect(orb.kind).toBe(slot!.kind);
    }
  });

  it('五个洞都开在天上，不会掉到地面', () => {
    const level = placeLevel(raw!);
    for (const slot of level.slots) {
      expect(slot.y).toBeLessThan(640);
      expect(slot.x).toBeGreaterThan(80);
      expect(slot.x).toBeLessThan(670);
    }
  });

  it('托盘里的石头排得开，不会叠在一起', () => {
    const level = placeLevel(raw!);
    const xs = level.orbs.map((o) => o.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(90);
    }
  });

  it('故事很短', () => {
    expect(raw?.story.length).toBeLessThanOrEqual(2);
  });
});
