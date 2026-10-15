import { ContentEntrySchema, getEntry } from '@chags/content/full';
import { DESIGN, WAIT } from '@chags/templates/layout';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/gean-guanhuo.json';
import rawDetail from '../../../packages/content/src/entries/gean-guanhuo.game.json';
import { waitLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('gean-guanhuo') ?? ContentEntrySchema.parse(raw);
const level = waitLevel(entry);

describe('隔岸观火 · 关卡数据', () => {
  it('等 45 秒：不短到没等过，也不长到坐不住', () => {
    expect(level.durationMs).toBe(45000);
    expect(level.penaltyCap).toBe(3);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('两处"过河劝架"就是两个诱惑：点了多等 6 秒，说的话是"你一过去，他们就一起冲你来"', () => {
    expect(level.temptations.length).toBe(2);
    for (const temptation of level.temptations) {
      expect(temptation.penaltyMs).toBe(6000);
      expect(temptation.line).toContain('一起冲你来');
      // 点满上限之后只回应、不再延后 —— 永远等得到
      expect(level.penaltyCap).toBeLessThanOrEqual(3);
    }
    expect(level.temptations.map((t) => t.kind)).toEqual(['boat', 'ford']);
  });

  it('两句渡口在河边摆开，彼此不挨着 —— 点哪个都点得准', () => {
    const xs = level.temptations.map((t) => t.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]! - xs[i - 1]!, '两处渡口挨在一起了').toBeGreaterThan(150);
    }
    for (const temptation of level.temptations) {
      expect(temptation.y).toBeGreaterThan(560);
      expect(temptation.x - WAIT.temptationRadius).toBeGreaterThan(0);
      expect(temptation.x + WAIT.temptationRadius).toBeLessThan(DESIGN.width);
    }
  });

  it('曹操坐在自己这一岸（listener），点他说三句独白', () => {
    const listener = level.listener;
    expect(listener).toBeTruthy();
    expect(listener!.radius).toBeGreaterThanOrEqual(100);
    expect(listener!.x - listener!.radius).toBeGreaterThan(0);
    expect(listener!.x + listener!.radius).toBeLessThan(DESIGN.width);
    expect(listener!.y).toBeGreaterThan(880);
    expect(listener!.y + listener!.radius).toBeLessThan(DESIGN.height);

    expect(level.lines.length).toBe(3);
    for (const line of level.lines) {
      expect(line.trim().length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(24);
    }
  });

  it('收束点在对岸那块空地上，离两处渡口足够远 —— 想收尾不会点成"多等一会儿"', () => {
    expect(level.finale.y).toBeLessThan(560);
    expect(level.finale.radius).toBeGreaterThanOrEqual(100);
    expect(level.finale.x - level.finale.radius).toBeGreaterThan(0);
    expect(level.finale.x + level.finale.radius).toBeLessThan(DESIGN.width);
    for (const temptation of level.temptations) {
      const gap =
        Math.hypot(temptation.x - level.finale.x, temptation.y - level.finale.y) -
        (WAIT.temptationRadius + level.finale.radius);
      expect(gap, temptation.id + ' 的渡口压在收束点上了').toBeGreaterThan(0);
    }
  });

  it('故事两幕：一幕对岸吵起来，一幕曹操坐着没动、对岸自己散开', () => {
    expect(entry.story.length).toBe(2);
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    for (const beat of entry.story) expect(beat.text.length).toBeLessThanOrEqual(90);
    expect(entry.keyMoment.beatId).toBe('s1');
  });

  it('史源用《三十六计》本计按语：第 9 计 · 敌战计（第 2 套）', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 9, set: 2 });
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('隔岸观火');
    expect(entry.source.quote).toContain('阳乖序乱');
    expect(entry.yearApprox).toBe(205);
    expect(entry.figures).toEqual(['曹操']);
    expect(entry.ageRange).toEqual([8, 12]);
  });

  it('关键抉择点恰好一个"不过去，先等着"', () => {
    const canonical = entry.keyMoment.options.filter((o) => o.isCanonical);
    expect(canonical.length).toBe(1);
    expect(canonical[0]!.text).toContain('先等着');
  });

  it('复习题：记忆题问曹操做了什么，迁移题问什么时候去劝最合适', () => {
    const quiz = entry.quiz;
    expect(quiz.length).toBeGreaterThanOrEqual(2);
    expect(quiz.some((q) => q.kind === 'transfer')).toBe(true);
    expect(quiz[0]!.question).toContain('曹操');
    expect(quiz.find((q) => q.kind === 'transfer')?.question).toContain('劝');
    for (const q of quiz) expect(q.answer).toBeLessThan(q.options.length);
  });

  it('moral 落在"等他们自己乱完"上，misconceptions 至少一条', () => {
    expect(entry.moral).toContain('自己乱完');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.keywords.length).toBeGreaterThanOrEqual(2);
    expect(entry.keywords.length).toBeLessThanOrEqual(6);
  });
});
