import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  baseLog, fireLevel, isSupportDone, logAt, nextLogToPull, pullLog, standingCount,
  supportStart,
} from '@chags/templates/siege.logic';
import {
  BAR, CAMP_TOP, DESIGN_H, DESIGN_W, FIRE, FIRE_LEVEL, GRANARIES, HILLS, LOGS, LOG_RADIUS,
  MOON, NIGHT_TOP, RAIDERS, WOODPILE,
} from './layout';
import { fudiLevel } from './logic';

const entry = getEntry('fudi-chouxin')!;
const level = fudiLevel(entry);

/**
 * 模板的点击宽容度（siege.ts 里 SIEGE.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 56;

describe('釜底抽薪 · 关卡数据', () => {
  it('火堆与五根柴落在画好的位置上 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('support');
    expect(level.fire).toEqual({ x: FIRE.x, y: FIRE.y, level: FIRE_LEVEL });
    expect(level.logs.map((log) => log.id)).toEqual(LOGS.map((log) => log.id));
    for (const [index, log] of level.logs.entries()) {
      expect(log.x).toBe(LOGS[index]!.x);
      expect(log.y).toBe(LOGS[index]!.y);
      expect(log.radius).toBe(LOG_RADIUS);
    }
  });

  it('五根柴都围着这堆火、都留在画面里，而且互相点得开', () => {
    expect(level.fire.y).toBeGreaterThan(CAMP_TOP);
    for (const log of level.logs) {
      expect(log.x - log.radius).toBeGreaterThanOrEqual(0);
      expect(log.x + log.radius).toBeLessThanOrEqual(DESIGN_W);
      expect(log.y - log.radius).toBeGreaterThan(NIGHT_TOP);
      expect(log.y + log.radius).toBeLessThan(DESIGN_H);
      // 围着火堆，但都不压在火心上
      const toFire = Math.hypot(log.x - level.fire.x, log.y - level.fire.y);
      expect(toFire).toBeGreaterThan(log.radius + 40);
      expect(toFire).toBeLessThan(420);
    }
    // 任意两根柴的命中圈都不叠在一起 —— 手指粗也不会点到隔壁那根
    for (const a of level.logs) {
      for (const b of level.logs) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
          2 * (a.radius + TAP_FORGIVE),
        );
      }
    }
  });

  it('relief 12/14/16/18/40：最后那根是根上的柴，抽掉它火势骤降', () => {
    expect(level.logs.map((log) => log.relief)).toEqual([12, 14, 16, 18, 40]);
    expect(level.logs.map((log) => log.base)).toEqual([false, false, false, false, true]);
    expect(baseLog(level)?.id).toBe('l5');
    expect(baseLog(level)?.relief).toBe(Math.max(...level.logs.map((log) => log.relief)));
    // 五根柴的 relief 加起来正好是开局火势：全抽光 = 火灭了
    expect(level.logs.reduce((sum, log) => sum + log.relief, 0)).toBe(level.fire.level);
  });

  it('一局真的走得完：一根一根抽下去，火势到 0（与场景同一条路）', () => {
    let state = supportStart(level);
    const steps: string[] = [];
    for (let i = 0; i < 10 && !isSupportDone(level, state); i += 1) {
      const log = nextLogToPull(level, state);
      expect(log).toBeDefined();
      if (log === undefined) break;
      steps.push(log.id);
      state = pullLog(level, state, log.id);
    }
    expect(steps).toEqual(['l1', 'l2', 'l3', 'l4', 'l5']);
    expect(fireLevel(level, state)).toBe(0);
    expect(isSupportDone(level, state)).toBe(true);
    expect(standingCount(level, state)).toBe(0);
  });

  it('零惩罚：火堆正中间没有柴；抽过的柴再抽也不会重复降火势', () => {
    expect(logAt(level, level.fire.x, level.fire.y, TAP_FORGIVE)).toBeUndefined();
    const start = supportStart(level);
    const afterBase = pullLog(level, start, 'l5');
    expect(fireLevel(level, afterBase)).toBe(60);
    expect(pullLog(level, afterBase, 'l5')).toBe(afterBase);
    expect(fireLevel(level, afterBase)).toBe(60);
    // 不按顺序抽也照样算数
    const jumped = pullLog(level, afterBase, 'l2');
    expect(fireLevel(level, jumped)).toBe(46);
    expect(jumped.order).toEqual(['l5', 'l2']);
  });

  it('景：粮囤在火堆后头，柴堆与摸上来的兵都留在画面里', () => {
    for (const granary of GRANARIES) {
      expect(granary.x - granary.r).toBeGreaterThanOrEqual(0);
      expect(granary.x + granary.r).toBeLessThanOrEqual(DESIGN_W);
      expect(granary.y).toBeLessThan(FIRE.y);
    }
    expect(MOON.y - MOON.r).toBeGreaterThan(NIGHT_TOP);
    expect(Math.max(...HILLS.map((hill) => hill.y))).toBeLessThan(FIRE.y);
    // 抽出来的柴堆不跟还没抽的柴抢地方
    for (const log of level.logs) {
      expect(Math.hypot(log.x - WOODPILE.x, log.y - WOODPILE.y)).toBeGreaterThan(
        log.radius + LOG_RADIUS + 60,
      );
    }
    // 兵在柴堆下面、在进度条上面
    const lowestLog = Math.max(...level.logs.map((log) => log.y)) + LOG_RADIUS;
    for (const raider of RAIDERS) {
      expect(raider.y).toBeGreaterThan(lowestLog);
      expect(raider.y).toBeLessThan(BAR.y);
    }
  });
});

describe('釜底抽薪 · 故事与复习', () => {
  it('两幕：乌巢的粮山 → 夜里烧粮；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('乌巢');
    expect(entry.story[1]!.text).toContain('粮囤');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['烧掉乌巢的粮草 —— 那是他撑着的根本']);
    expect(entry.keyMoment.reveal).toContain('把底下的柴抽走');
  });

  it('三十六计的登记信息：第 19 计、混战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 19, set: 4 });
    expect(entry.yearApprox).toBe(200);
    expect(entry.figures).toEqual(['曹操', '袁绍']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·混战计》');
    expect(entry.source.chapter).toBe('釜底抽薪');
    expect(entry.source.quote).toContain('不敌其力');
    expect(entry.moral).toBe('不跟火硬碰，从底下把柴一根根抽走。');
    expect(entry.game.template).toBe('siege');
    expect(entry.game.stages[0]!.template).toBe('siege');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('汤');
  });

  it('适龄化：烧的是粮，没有一处流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).not.toContain('血');
    expect(prose).not.toContain('死');
  });
});

describe('釜底抽薪 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('fudi-chouxin', 'en')!;
    expect(merged.title).toBe('Pull the Firewood from Under the Pot');
  });
});
