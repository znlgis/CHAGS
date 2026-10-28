// layout 只有常量，没有 Phaser：单测里可以直接用真正的设计分辨率
import { getEntry } from '@chags/content/full';
import { DESIGN, WAIT } from '@chags/templates/layout';
import { describe, expect, it } from 'vitest';
import { waitLevel } from './logic';

const raw = getEntry('taigong')!;
const level = waitLevel(raw);

describe('太公钓鱼 · 关卡数据', () => {
  it('等 25 秒：不短到没等过，也不长到坐不住', () => {
    // 2026-10-18 适龄体验轮：58 秒对 7–10 岁太长，缩到 25 秒（"点诱惑会延后"的因果保留）
    expect(level.durationMs).toBe(25_000);
    expect(level.durationMs).toBeLessThanOrEqual(30_000);
  });

  it('三个诱惑，每一个都有一句老人说的话（说了才看得懂"点了没用"）', () => {
    expect(level.temptations.length).toBe(3);
    for (const temptation of level.temptations) {
      expect(temptation.line.trim().length, temptation.id + ' 没有说话').toBeGreaterThan(0);
      expect(temptation.penaltyMs, temptation.id + ' 点了不延后').toBeGreaterThan(0);
    }
    expect(level.temptations.map((t) => t.kind)).toEqual(['bend', 'bait', 'move']);
  });

  it('诱惑有上限：点满之后只回应、不再延后 —— 永远等得到', () => {
    expect(level.penaltyCap).toBeGreaterThanOrEqual(1);
    expect(level.penaltyCap).toBeLessThanOrEqual(3);
    expect(level.penaltyCap).toBeLessThan(level.temptations.length + 2);
  });

  it('点老人时轮着说的话不能是空的', () => {
    expect(level.lines.length).toBeGreaterThanOrEqual(3);
    for (const line of level.lines) {
      expect(line.trim().length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(24);
    }
  });

  it('诱惑按钮排在最下面一排，彼此不挨着 —— 点哪个都点得准', () => {
    for (const temptation of level.temptations) {
      expect(temptation.y).toBeGreaterThan(1000);
      expect(temptation.x).toBeGreaterThan(90);
      expect(temptation.x).toBeLessThan(DESIGN.width - 90);
    }
    const xs = level.temptations.map((t) => t.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]! - xs[i - 1]!, '两个诱惑按钮挨在一起了').toBeGreaterThan(150);
    }
  });

  it('老人（listener）与鱼竿（finale）都在画里，而且点得着', () => {
    const listener = level.listener;
    expect(listener).toBeTruthy();
    expect(listener!.radius).toBeGreaterThanOrEqual(100);
    expect(listener!.x - listener!.radius).toBeGreaterThan(0);
    expect(listener!.x + listener!.radius).toBeLessThan(DESIGN.width);
    expect(listener!.y - listener!.radius).toBeGreaterThan(150);
    expect(listener!.y + listener!.radius).toBeLessThan(DESIGN.height);

    expect(level.finale.radius).toBeGreaterThanOrEqual(100);
    expect(level.finale.x - level.finale.radius).toBeGreaterThan(0);
    expect(level.finale.x + level.finale.radius).toBeLessThan(DESIGN.width);
    expect(level.finale.y).toBeGreaterThan(150);
    expect(level.finale.y).toBeLessThan(DESIGN.height);
  });

  it('收钩的位置离诱惑按钮足够远 —— 想收钩不会点成"多等一会儿"', () => {
    for (const temptation of level.temptations) {
      const gap =
        Math.hypot(temptation.x - level.finale.x, temptation.y - level.finale.y) -
        (WAIT.temptationRadius + level.finale.radius);
      expect(gap, temptation.id + ' 的按钮压在收钩位置上了').toBeGreaterThan(0);
    }
  });

  it('关键抉择在第二幕（愿者上钩）', () => {
    expect(raw.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择：三个选项里只有一个"他要钓的不是鱼"', () => {
    const canonical = raw.keyMoment.options.filter((o) => o.isCanonical);
    expect(canonical[0]!.text).toContain('不是鱼');
  });

  it('迁移题：小鱼一条接一条上钩 —— 放回去，接着等大鱼', () => {
    const transfer = raw.quiz.filter((q) => q.kind === 'transfer');
    expect(transfer.length).toBeGreaterThanOrEqual(1);
    expect(transfer[0]!.options[transfer[0]!.answer]).toContain('放回去');
    expect(raw.quiz.length).toBe(3);
  });

  it('moral 落在"等一个值得等的人"上，且至少列出一种误解', () => {
    expect(raw.moral).toContain('值得等');
  });
});
