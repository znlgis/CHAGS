import { getEntry } from '@chags/content';
import { describe, expect, it } from 'vitest';
import { DECK_BOTTOM, DECK_TOP, SHELF_X, SHIP } from './layout';
import { ruseLevel } from './logic';

describe('瞒天过海 · 关卡数据', () => {
  const raw = getEntry('mantian-guohai');
  const level = ruseLevel(raw!);

  it('三件货各三个外壳，正确答案都是柴捆 —— 越平常的样子越不起眼', () => {
    expect(level.mode).toBe('hide');
    expect(level.items.map((i) => i.id)).toEqual(['drum', 'banner', 'armor']);
    for (const item of level.items) {
      expect(item.disguiseAs).toBe('straw');
      expect(item.shells.map((s) => s.kind)).toEqual(['straw', 'sack', 'net']);
      expect(item.shells.filter((s) => s.kind === item.disguiseAs)).toHaveLength(1);
    }
  });

  it('货与外壳都摆在栈桥的货架上 —— 美术与关卡数据必须一致', () => {
    for (const item of level.items) {
      expect(item.x).toBe(SHELF_X);
      expect(item.y).toBeGreaterThan(DECK_TOP);
      expect(item.y).toBeLessThan(DECK_BOTTOM - 100);
      for (const shell of item.shells) {
        // 外壳摆在货的右手边，和货同一行
        expect(shell.y).toBe(item.y);
        expect(shell.x).toBeGreaterThan(SHELF_X + 100);
        expect(shell.x).toBeLessThan(750);
      }
    }
  });

  it('检查口在海面上、大船的跟前：货拖过去才算真的安全', () => {
    expect(level.gate.y).toBeLessThan(DECK_TOP);
    expect(level.gate.x).toBeGreaterThan(375);
    expect(Math.abs(level.gate.x - SHIP.x)).toBeLessThan(140);
    for (const item of level.items) {
      const dist = Math.hypot(item.x - level.gate.x, item.y - level.gate.y);
      expect(dist).toBeGreaterThan(level.gate.radius);
    }
  });

  it('灯 5.2 秒亮一次、亮前 1.2 秒有征兆；这一关没有锣鼓（靠的是外壳）', () => {
    expect(level.lamp).toEqual({ intervalMs: 5200, warnMs: 1200 });
    expect(level.noises).toEqual([]);
  });

  it('故事两幕：海边发愁 → 大营过海；关键抉择在第二幕', () => {
    expect(raw?.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(raw?.story.every((b) => b.text.length <= 90)).toBe(true);
    expect(raw?.keyMoment.beatId).toBe('s2');
    expect(raw?.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual(['大营']);
    expect(raw?.source.book).toContain('三十六计');
    expect(raw?.source.quote).toContain('备周则意怠');
  });

  it('三十六计的登记信息：第 1 计、胜战计、兵法', () => {
    expect(raw?.group).toBe('stratagem');
    expect(raw?.kind).toBe('strategy');
    expect(raw?.stratagem).toEqual({ number: 1, set: 1 });
    expect(raw?.yearApprox).toBe(645);
    expect(raw?.figures).toEqual(['薛仁贵', '唐太宗']);
    expect(raw?.ageRange).toEqual([7, 10]);
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(raw?.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
    expect(raw?.quiz.length).toBeGreaterThanOrEqual(2);
    for (const q of raw?.quiz ?? []) expect(q.answer).toBeLessThan(q.options.length);
  });
});
