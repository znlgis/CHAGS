import { describe, expect, it } from 'vitest';
import { findSlotAt, isCorrect, isPlaceComplete, placeProgress, slotFor } from './place.logic';
import { PlaceLevelSchema } from './schemas';
import type { PlaceLevel } from './schemas';

const level: PlaceLevel = PlaceLevelSchema.parse({
  slots: [
    { id: 'sun', x: 170, y: 300, kind: 'sun', radius: 60 },
    { id: 'moon', x: 580, y: 300, kind: 'moon', radius: 60 },
  ],
  orbs: [
    { id: 'leftEye', slotId: 'sun', x: 105, y: 1225, kind: 'eye', speak: '左眼变成了太阳' },
    { id: 'rightEye', slotId: 'moon', x: 215, y: 1225, kind: 'eye', speak: '右眼变成了月亮' },
  ],
});

describe('归位完成度', () => {
  it('同一个洞补两次不算两个', () => {
    expect(isPlaceComplete(level, ['sun', 'sun'])).toBe(false);
    expect(placeProgress(level, ['sun', 'sun'])).toBe(0.5);
  });

  it('不认识的目标 id 不计入', () => {
    expect(placeProgress(level, ['sun', '不是槽位'])).toBe(0.5);
  });

  it('两个都补好才算完成，进度封顶 1', () => {
    expect(isPlaceComplete(level, ['sun', 'moon'])).toBe(true);
    expect(placeProgress(level, ['sun', 'moon', 'moon'])).toBe(1);
  });
});

describe('归位判定', () => {
  it('落在槽位上就算命中，且有宽容度', () => {
    expect(findSlotAt(170, 300, level)?.id).toBe('sun');
    expect(findSlotAt(170 + 55, 300, level)?.id).toBe('sun');
    expect(findSlotAt(170 + 90, 300, level)).toBeNull();
    expect(findSlotAt(170 + 90, 300, level, 70)?.id).toBe('sun');
  });

  it('两个槽位都能覆盖时，取更近的那个（中点 375 是分界）', () => {
    expect(findSlotAt(340, 300, level, 200)?.id).toBe('sun');
    expect(findSlotAt(420, 300, level, 200)?.id).toBe('moon');
  });

  it('拖到空地上不命中任何槽位', () => {
    expect(findSlotAt(375, 900, level)).toBeNull();
  });

  it('只有放对位置才算正确', () => {
    const leftEye = level.orbs[0]!;
    const sun = level.slots[0]!;
    const moon = level.slots[1]!;
    expect(isCorrect(leftEye, sun)).toBe(true);
    expect(isCorrect(leftEye, moon)).toBe(false);
  });

  it('全部归位才算完成', () => {
    expect(isPlaceComplete(level, [])).toBe(false);
    expect(isPlaceComplete(level, ['sun'])).toBe(false);
    expect(isPlaceComplete(level, ['sun', 'moon'])).toBe(true);
    expect(placeProgress(level, ['sun'])).toBe(0.5);
  });

  it('能查到光球该去的槽位', () => {
    expect(slotFor(level, level.orbs[1]!)?.id).toBe('moon');
  });
});

describe('PlaceLevelSchema', () => {
  it('拒绝数量对不上的关卡', () => {
    expect(PlaceLevelSchema.safeParse({ ...level, orbs: [level.orbs[0]!] }).success).toBe(false);
  });

  it('拒绝指向不存在槽位的光球', () => {
    const bad = { ...level, orbs: [{ ...level.orbs[0]!, slotId: 'nope' }, level.orbs[1]!] };
    expect(PlaceLevelSchema.safeParse(bad).success).toBe(false);
  });

  it('拒绝两个光球抢同一个槽位', () => {
    const bad = { ...level, orbs: [level.orbs[0]!, { ...level.orbs[1]!, slotId: 'sun' }] };
    expect(PlaceLevelSchema.safeParse(bad).success).toBe(false);
  });
});
