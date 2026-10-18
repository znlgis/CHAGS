import { getEntry } from '@chags/content/full';
import { bestMatchupWins } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import {
  bestRoster, bestWins, isMatchupDone, pairings, resolve, winsFor,
} from '@chags/templates/matchup.logic';
import { matchupLevel } from './logic';

const entry = getEntry('lidai-taojiang')!;
const level = matchupLevel(entry);

/** 孙膑那三句话：下驷对上驷、上驷对中驷、中驷对下驷 */
const sunBin = [2, 0, 1];
/** 硬碰硬：上对上、中对中、下对下 */
const headOn = [0, 1, 2];

describe('李代桃僵 · 关卡数据', () => {
  it('三匹马 6 / 5 / 4，三场对手 7 / 5 / 3，三局两胜', () => {
    expect(level.horses.map((horse) => horse.power)).toEqual([6, 5, 4]);
    expect(level.horses.map((horse) => horse.rank)).toEqual(['top', 'mid', 'low']);
    expect(level.rivals.map((rival) => rival.power)).toEqual([7, 5, 3]);
    expect(level.needWins).toBe(2);
    expect(level.mode).toBe('pair');
    for (const rival of level.rivals) expect(rival.label.length).toBeLessThanOrEqual(12);
  });

  it('验算：下对上输、上对中赢（6>5）、中对下赢（4>3）—— 正好两胜', () => {
    expect(resolve(level, sunBin).map((race) => race.win)).toEqual([false, true, true]);
    expect(winsFor(level, sunBin)).toBe(2);
    expect(isMatchupDone(level, winsFor(level, sunBin))).toBe(true);
  });

  it('验算：上对上、中对中、下对下只赢一场 —— 还没有赢下整场', () => {
    expect(resolve(level, headOn).map((race) => race.win)).toEqual([false, false, true]);
    expect(winsFor(level, headOn)).toBe(1);
    expect(isMatchupDone(level, winsFor(level, headOn))).toBe(false);
  });

  it('六种配对里最好的那种就是孙膑的排法：两胜', () => {
    expect(pairings(level).length).toBe(6);
    expect(bestWins(level)).toBe(2);
    expect(bestWins(level)).toBe(bestMatchupWins(level.horses, level.rivals));
    expect(winsFor(level, bestRoster(level))).toBe(2);
  });

  it('三匹马在等候区并排，三场对手在跑道上从高到低排', () => {
    const ys = level.horses.map((horse) => horse.y);
    expect(new Set(ys).size).toBe(1);
    expect(level.horses.map((horse) => horse.x)).toEqual([180, 375, 570]);
    expect(level.rivals.map((rival) => rival.y)).toEqual([622, 812, 1002]);
    for (const horse of level.horses) expect(horse.radius).toBeGreaterThanOrEqual(60);
    // 对手在最右边，我们的马在下面 —— 两条线分得开，画面不打架
    for (const rival of level.rivals) {
      expect(rival.x).toBeGreaterThan(500);
      expect(rival.y).toBeLessThan(1030);
    }
    for (const horse of level.horses) expect(horse.y).toBeGreaterThan(1030);
  });

  it('两幕故事，关键抉择点在第一幕；迁移题问"三局两胜的棋怎么安排"', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.find((option) => option.isCanonical)?.id).toBe('low-first');
    const transfer = entry.quiz.filter((question) => question.kind === 'transfer');
    expect(transfer.length).toBeGreaterThanOrEqual(1);
    expect(transfer[0]!.question).toContain('三局两胜');
  });

  it('史源与定位：敌战计第 11 计，引的是《史记》原文', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 11, set: 2 });
    expect(entry.source.book).toContain('史记');
    expect(entry.source.quote).toContain('下驷与彼上驷');
    expect(entry.figures).toEqual(['孙膑', '田忌']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.game.template).toBe('matchup');
    expect(entry.game.stages[0]!.template).toBe('matchup');
  });

  it('儿童化：赛场不是战场，输一局只是"这一局我们认了"', () => {
    expect(entry.moral).toBe('舍一局，赢整场 —— 局部吃点亏，整体反而赢。');
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    // 没有流血、没有杀伤的写法
    for (const word of ['血', '杀', '死', '伤']) expect(prose).not.toContain(word);
  });
});
