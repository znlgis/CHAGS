import { getAllusion } from '@chags/content';
import { tapsNeeded } from '@chags/templates/tap.logic';
import { slotFor } from '@chags/templates/place.logic';
import { describe, expect, it } from 'vitest';
import { placeLevel, tapLevel } from './logic';

describe('盘古开天辟地 · 关卡数据', () => {
  const raw = getAllusion('pangu');

  it('典故被标记为神话，排在信史之前', () => {
    expect(raw?.kind).toBe('myth');
    expect(raw!.yearApprox).toBeLessThan(-1000);
  });

  it('撑天要 40 次点击，正好点满一万八千年', () => {
    const level = tapLevel(raw!);
    expect(level.targetValue).toBe(18000);
    expect(level.mode).toBe('tap');
    expect(tapsNeeded(level)).toBe(40);
  });

  it('六个部位各归各位，一个不多一个不少', () => {
    const level = placeLevel(raw!);
    expect(level.slots.length).toBe(6);
    expect(level.orbs.length).toBe(6);
    const slotIds = new Set(level.slots.map((s) => s.id));
    for (const orb of level.orbs) expect(slotIds.has(orb.slotId)).toBe(true);
  });

  it('日月星辰在上半屏，江河草木在下半屏', () => {
    const level = placeLevel(raw!);
    const sky = level.slots.filter((s) => s.y < 640).map((s) => s.id).sort();
    const ground = level.slots.filter((s) => s.y >= 640).map((s) => s.id).sort();
    expect(sky).toEqual(['moon', 'stars', 'sun', 'wind']);
    expect(ground).toEqual(['grass', 'river']);
  });

  it('每个光球都有一句归位时念的原文', () => {
    const level = placeLevel(raw!);
    for (const orb of level.orbs) {
      expect(orb.speak.length).toBeGreaterThan(0);
      expect(slotFor(level, orb)).toBeTruthy();
    }
  });

  it('故事很短，屏幕上不超过两句话', () => {
    expect(raw?.story.length).toBeLessThanOrEqual(2);
  });

  it('模板 schema 会拒绝点不满的撑天脚本', () => {
    const broken = {
      ...raw!,
      game: {
        template: 'tap',
        stages: [
          { template: 'tap', levelScript: { ...(tapLevel(raw!) as object), targetValue: 18500 } },
          raw!.game.stages[1]!,
        ],
      },
    };
    expect(() => tapLevel(broken)).toThrow();
  });
});
