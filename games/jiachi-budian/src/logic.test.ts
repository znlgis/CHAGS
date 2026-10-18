import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  feignPhaseAt, feignProgress, feignStart, feignTotalMs, hitFeignAction, isFeignDone,
  tapActionFeign,
} from '@chags/templates/stillness.logic';
import {
  ACTION, AWAY, DESIGN_H, DESIGN_W, GROUND_TOP, HINT, SKY_TOP, STEPS, SUNBIN, TESTS, WALL_TOP,
  WATCH,
} from './layout';
import { jiachiLevel } from './logic';

const entry = getEntry('jiachi-budian')!;
const level = jiachiLevel(entry);

/**
 * 模板的"悄悄动手"宽容度（stillness.ts 里 FEIGN.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 52;

/** 三次试探与三个空档各自在时间轴上的位置（与关卡数据一致） */
const GAPS = [2600, 6800, 10600];
const TESTS_AT = [200, 5000, 9000];

describe('假痴不癫 · 关卡数据', () => {
  it('三次试探与空档、动手的地方，与画好的一模一样', () => {
    expect(level.mode).toBe('feign');
    expect(level.tests.map((test) => test.id)).toEqual(TESTS.map((test) => test.id));
    for (const [index, test] of level.tests.entries()) {
      expect(test.testMs).toBe(TESTS[index]!.testMs);
      expect(test.gapMs).toBe(TESTS[index]!.gapMs);
    }
    expect(level.action).toEqual({ x: ACTION.x, y: ACTION.y, radius: ACTION.radius });
    expect(level.steps).toBe(STEPS);
    expect(level.hint).toBe(HINT);
  });

  it('三个空档正好够推满三步 —— 一次试探都不能白忍', () => {
    expect(level.tests.length).toBe(level.steps);
    expect(feignTotalMs(level)).toBe(
      level.tests.reduce((sum, test) => sum + test.testMs + test.gapMs, 0),
    );
  });

  it('人、席子、竹简案都在画面里；手落在案上不会碰到人身上', () => {
    for (const spot of [SUNBIN, WATCH, AWAY]) {
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(DESIGN_W);
      expect(spot.y).toBeGreaterThan(GROUND_TOP);
      expect(spot.y).toBeLessThan(DESIGN_H);
    }
    // 他"走开"就是往院子另一头去
    expect(AWAY.x).toBeGreaterThan(WATCH.x);
    expect(AWAY.x + 60).toBeLessThan(DESIGN_W);
    expect(WALL_TOP).toBeGreaterThan(SKY_TOP);
    expect(GROUND_TOP).toBeGreaterThan(WALL_TOP);

    // 动手的地方在席子下面一截，离孙膑与魏兵都够远
    expect(ACTION.y).toBeGreaterThan(SUNBIN.y);
    for (const spot of [SUNBIN, WATCH, AWAY]) {
      expect(Math.hypot(ACTION.x - spot.x, ACTION.y - spot.y)).toBeGreaterThan(
        ACTION.radius + 120,
      );
    }
  });

  it('手指落在"悄悄动手"的地方上才算动手，点在人身上不算（零惩罚）', () => {
    expect(hitFeignAction(ACTION.x, ACTION.y, level, TAP_FORGIVE)).toBe(true);
    expect(hitFeignAction(ACTION.x, ACTION.y, level)).toBe(true);
    expect(hitFeignAction(SUNBIN.x, SUNBIN.y, level, TAP_FORGIVE)).toBe(false);
    expect(hitFeignAction(WATCH.x, WATCH.y, level, TAP_FORGIVE)).toBe(false);
    expect(hitFeignAction(ACTION.x, ACTION.y + ACTION.radius + TAP_FORGIVE + 4, level, TAP_FORGIVE)).toBe(false);
  });
});

describe('假痴不癫 · 一局真的走得完', () => {
  it('探索期点只记 slip、进度不动；空档期点才推进一步', () => {
    let state = feignStart();
    for (const t of TESTS_AT) {
      const before = state.progress;
      expect(feignPhaseAt(level, t).phase).toBe('test');
      state = tapActionFeign(level, state, t);
      expect(state.progress).toBe(before);
      expect(state.slips).toBe(state.slipTestIds.length);
    }
    expect(state.slips).toBe(3);
    expect(state.progress).toBe(0);
    expect(state.slipTestIds).toEqual(['t1', 't2', 't3']);
    expect(isFeignDone(state)).toBe(false);
  });

  it('三个空档各推一步，走够 steps 判成功（与场景同一条路）', () => {
    let state = feignStart();
    for (const [index, t] of GAPS.entries()) {
      expect(feignPhaseAt(level, t).phase).toBe('gap');
      state = tapActionFeign(level, state, t);
      expect(state.progress).toBe(index + 1);
      expect(feignProgress(level, state)).toBeCloseTo((index + 1) / STEPS, 6);
    }
    expect(state.progress).toBe(STEPS);
    expect(isFeignDone(state)).toBe(true);
    expect(state.slips).toBe(0);
  });

  it('零惩罚：试探期点多少下都只是记一笔，进度一步不退，照样能推满', () => {
    let state = feignStart();
    for (let i = 0; i < 5; i += 1) state = tapActionFeign(level, state, 300);
    expect(state.slips).toBe(5);
    expect(state.progress).toBe(0);
    for (const t of GAPS) state = tapActionFeign(level, state, t);
    expect(isFeignDone(state)).toBe(true);
    expect(state.slips).toBe(5);
  });

  it('一轮走完还没推够，就从头再试探一遍；已经推过的步数不白费', () => {
    // 只抓住第一个空档：只推进一步
    const state = tapActionFeign(level, feignStart(), GAPS[0]!);
    expect(state.progress).toBe(1);
    // 一轮走完（最后一次空档也过去了）之后再点什么也不算
    const after = tapActionFeign(level, state, feignTotalMs(level));
    expect(after).toBe(state);
    expect(feignPhaseAt(level, feignTotalMs(level)).phase).toBe('done');
    // 重开一轮：账留着，缺的那两步在下一个空档里补上
    let again = tapActionFeign(level, state, 0 + GAPS[0]!);
    again = tapActionFeign(level, again, GAPS[1]!);
    expect(again.progress).toBe(3);
    expect(isFeignDone(again)).toBe(true);
  });
});

describe('假痴不癫 · 故事与复习', () => {
  it('两幕：被留在魏国 → 装成糊涂人；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('魏国');
    expect(entry.story[1]!.text).toContain('糊涂');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['先忍住不动，等他走开再悄悄准备']);
    expect(entry.keyMoment.reveal).toContain('忍住');
  });

  it('三十六计的登记信息：第 27 计、并战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 27, set: 5 });
    expect(entry.yearApprox).toBe(-355);
    expect(entry.figures).toEqual(['孙膑', '庞涓']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·并战计》');
    expect(entry.source.chapter).toBe('假痴不癫');
    expect(entry.source.quote).toContain('假作不知而实知');
    expect(entry.moral).toBe('该沉默的时候能忍住，机会才留得住。');
    expect(entry.game.template).toBe('stillness');
    expect(entry.game.stages[0]!.template).toBe('stillness');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('同桌');
  });

  it('儿童化：装糊涂是"忍"，不是骗人，也没有一处流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.question,
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).not.toContain('血');
    expect(prose).not.toContain('死');
    expect(entry.moral).toContain('忍住');
  });
});

describe('假痴不癫 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('jiachi-budian', 'en')!;
    expect(merged.title).toBe('Feign Madness, Keep Your Wits');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Annexation Stratagems');
  });
});
