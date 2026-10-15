import { ContentEntrySchema, getEntry } from '@chags/content/full';
// layout 只有常量，没有 Phaser：单测里可以直接用真正的设计分辨率
import { DESIGN, WAIT } from '@chags/templates/layout';
import { describe, expect, it } from 'vitest';
import rawTaigongSummary from '../../../packages/content/src/entries/taigong.json';
import rawTaigongDetail from '../../../packages/content/src/entries/taigong.game.json';
import { waitLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const rawTaigong = { ...rawTaigongSummary, ...rawTaigongDetail };

/**
 * 直接读典故 JSON 再过一遍内容 schema：外壳注册（entries/index.ts）由 Lead 负责，
 * 这样不等注册也能先发现内容写错。
 */
const raw = getEntry('taigong') ?? ContentEntrySchema.parse(rawTaigong);
const level = waitLevel(raw);

describe('太公钓鱼 · 关卡数据', () => {
  it('等将近一分钟：不短到没等过，也不长到坐不住', () => {
    expect(level.durationMs).toBeGreaterThanOrEqual(30_000);
    expect(level.durationMs).toBeLessThanOrEqual(90_000);
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

  it('提示语短得能塞进气泡里', () => {
    expect(level.hint.length).toBeGreaterThan(0);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('故事正好两幕：一幕"没人用他"，一幕"愿者上钩"', () => {
    expect(raw.story.length).toBe(2);
    for (const beat of raw.story) expect(beat.text.length).toBeLessThanOrEqual(90);
    expect(raw.story.map((b) => b.id)).toContain(raw.keyMoment.beatId);
    expect(raw.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择：三个选项里只有一个"他要钓的不是鱼"', () => {
    const canonical = raw.keyMoment.options.filter((o) => o.isCanonical);
    expect(canonical.length).toBe(1);
    expect(canonical[0]!.text).toContain('不是鱼');
  });

  it('迁移题：小鱼一条接一条上钩 —— 放回去，接着等大鱼', () => {
    const transfer = raw.quiz.filter((q) => q.kind === 'transfer');
    expect(transfer.length).toBeGreaterThanOrEqual(1);
    expect(transfer[0]!.options[transfer[0]!.answer]).toContain('放回去');
    expect(raw.quiz.length).toBe(3);
    for (const q of raw.quiz) expect(q.answer).toBeLessThan(q.options.length);
  });

  it('moral 落在"等一个值得等的人"上，且至少列出一种误解', () => {
    expect(raw.moral).toContain('值得等');
    expect(raw.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(raw.keywords.length).toBeGreaterThanOrEqual(2);
    expect(raw.keywords.length).toBeLessThanOrEqual(6);
  });
});
