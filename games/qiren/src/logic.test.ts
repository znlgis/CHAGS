import { AllusionSchema, getAllusion } from '@chags/content';
import { describe, expect, it } from 'vitest';
import rawQiren from '../../../packages/content/src/allusions/qiren.json';
import { placeLevel } from './logic';

/**
 * 直接读典故 JSON 再过一遍内容 schema：外壳注册（allusions/index.ts）由 Lead 负责，
 * 这样不等注册也能先发现内容写错。
 */
const raw = getAllusion('qiren') ?? AllusionSchema.parse(rawQiren);

describe('杞人忧天 · 关卡数据', () => {
  it('四个担忧泡泡、四个"想明白"的光球，一个不多一个不少', () => {
    const level = placeLevel(raw);
    expect(level.slots.length).toBe(4);
    expect(level.orbs.length).toBe(4);
    expect(level.slots.map((s) => s.kind)).toEqual(['sky', 'ground', 'suns', 'stars']);
    expect(level.orbs.map((o) => o.kind)).toEqual(['air', 'soil', 'sunmoon', 'meteor']);
  });

  it('每一条道理都对得上一个泡泡 —— 一对一，没有两可', () => {
    const level = placeLevel(raw);
    const slotIds = new Set(level.slots.map((s) => s.id));
    expect(new Set(level.orbs.map((o) => o.slotId)).size).toBe(level.orbs.length);
    for (const orb of level.orbs) {
      expect(slotIds.has(orb.slotId), orb.id + ' 找不到对应的泡泡').toBe(true);
    }
  });

  it('每个光球都要开口说话（念的是《列子·天瑞》的白话）', () => {
    const level = placeLevel(raw);
    for (const orb of level.orbs) {
      expect(orb.speak.trim().length, orb.id + ' 没有说话').toBeGreaterThan(0);
      expect(orb.speak.endsWith('。'), orb.id + ' 说的不像一句完整的话').toBe(true);
    }
  });

  it('四个泡泡都开在天空区，不会掉到地面', () => {
    const level = placeLevel(raw);
    for (const slot of level.slots) {
      expect(slot.y).toBeGreaterThan(150);
      expect(slot.y).toBeLessThan(640);
      expect(slot.x).toBeGreaterThan(90);
      expect(slot.x).toBeLessThan(660);
    }
  });

  it('泡泡之间不重叠 —— 拖过去不会放到别的泡泡上', () => {
    const level = placeLevel(raw);
    for (let i = 0; i < level.slots.length; i += 1) {
      for (let j = i + 1; j < level.slots.length; j += 1) {
        const a = level.slots[i]!;
        const b = level.slots[j]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.radius + b.radius);
        expect(gap, a.id + ' 与 ' + b.id + ' 挨在一起了').toBeGreaterThan(0);
      }
    }
  });

  it('托盘里的光球排得开，不会叠在一起', () => {
    const level = placeLevel(raw);
    const xs = level.orbs.map((o) => o.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(90);
    }
    for (const orb of level.orbs) {
      expect(orb.y).toBeGreaterThan(1200);
      expect(orb.y).toBeLessThan(1260);
    }
  });

  it('故事正好两幕：一幕"怕"，一幕"想明白"', () => {
    expect(raw.story.length).toBe(2);
    expect(raw.story[0]!.text.length).toBeLessThanOrEqual(90);
    expect(raw.story[1]!.text.length).toBeLessThanOrEqual(90);
    expect(raw.story.map((b) => b.id)).toContain(raw.keyMoment.beatId);
  });

  it('复习题里有一道"怕黑就开灯看一看"—— 想明白了就不怕', () => {
    const transfer = raw.quiz.filter((q) => q.kind === 'transfer');
    expect(transfer.length).toBeGreaterThanOrEqual(1);
    expect(transfer[0]!.options[transfer[0]!.answer]).toContain('灯');
    expect(raw.quiz.length).toBe(3);
    for (const q of raw.quiz) expect(q.answer).toBeLessThan(q.options.length);
  });

  it('moral 不嘲笑杞人 —— 怕，是因为还没想明白', () => {
    expect(raw.moral).toContain('想明白');
    expect(raw.misconceptions.length).toBeGreaterThanOrEqual(1);
  });
});
