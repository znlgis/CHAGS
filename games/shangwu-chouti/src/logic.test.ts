import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  allRungsBuilt, buildRung, builtCount, climbRatio, isLadderDone, ladderAt, ladderPhase,
  ladderProgress, ladderStart, nextRung, pullLadder, rungAt,
} from '@chags/templates/siege.logic';
import {
  BAIT, CLIMB_MS, DESIGN_H, GROUND_TOP, HINT, PULL, RUNGS, RUNG_RADIUS, SKY_TOP, WALL_TOP,
} from './layout';
import { shangwuLevel } from './logic';

const entry = getEntry('shangwu-chouti')!;
const level = shangwuLevel(entry);

/**
 * 模板的点击宽容度（siege.ts 里 LADDER.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 40;

/** 一级一级搭好：每级花 400 毫秒（从 t0 起算） */
function buildAll(t0 = 0, from = ladderStart(level, 0)): ReturnType<typeof ladderStart> {
  let state = from;
  level.rungs.forEach((rung, index) => {
    state = buildRung(level, state, rung.id, t0 + index * 400);
  });
  return state;
}

describe('上屋抽梯 · 关卡数据', () => {
  it('四级阶梯、绳桩、顶上他要去的地方，与画好的一模一样', () => {
    expect(level.mode).toBe('ladder');
    expect(level.rungs.map((rung) => rung.id)).toEqual(RUNGS.map((rung) => rung.id));
    for (const [index, rung] of level.rungs.entries()) {
      expect(rung.x).toBe(RUNGS[index]!.x);
      expect(rung.y).toBe(RUNGS[index]!.y);
      expect(rung.radius).toBe(RUNG_RADIUS);
    }
    expect(level.bait).toEqual({ x: BAIT.x, y: BAIT.y, radius: BAIT.radius });
    expect(level.ladder).toEqual({ x: PULL.x, y: PULL.y, radius: PULL.radius });
    expect(level.climbMs).toBe(CLIMB_MS);
    expect(level.hint).toBe(HINT);
  });

  it('梯子从下往上：一级比一级高、一级比一级靠墙那头', () => {
    for (const [index, rung] of level.rungs.entries()) {
      if (index === 0) continue;
      const below = level.rungs[index - 1]!;
      expect(rung.y).toBeLessThan(below.y);
      expect(rung.x).toBeGreaterThan(below.x);
    }
    // 四级都在画面里：底下没过界，顶上到墙头
    const lowest = level.rungs[0]!;
    const highest = level.rungs[level.rungs.length - 1]!;
    expect(lowest.y + lowest.radius).toBeLessThan(DESIGN_H);
    expect(highest.y).toBeLessThan(WALL_TOP + 20);
    expect(highest.y).toBeGreaterThan(SKY_TOP);
    expect(GROUND_TOP).toBeGreaterThan(WALL_TOP);
  });

  it('每一级都点得开、绳桩也点得开：手指粗不会点到隔壁去', () => {
    for (const rung of level.rungs) {
      expect(rungAt(level, rung.x, rung.y, TAP_FORGIVE)?.id).toBe(rung.id);
      expect(ladderAt(level, rung.x, rung.y, TAP_FORGIVE)).toBe(false);
    }
    for (const a of level.rungs) {
      for (const b of level.rungs) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * (RUNG_RADIUS + TAP_FORGIVE));
      }
      // 抽梯的绳桩与每一级都不打架
      expect(Math.hypot(PULL.x - a.x, PULL.y - a.y)).toBeGreaterThan(
        RUNG_RADIUS + TAP_FORGIVE + PULL.radius + TAP_FORGIVE,
      );
    }
    expect(ladderAt(level, PULL.x, PULL.y, TAP_FORGIVE)).toBe(true);
    // 点在地上、点在墙头上：什么也不算
    expect(rungAt(level, 375, 1290, TAP_FORGIVE)).toBeUndefined();
    expect(ladderAt(level, 375, 1290, TAP_FORGIVE)).toBe(false);
    // 他要去的地方（粮囤）不是可点的东西
    expect(rungAt(level, BAIT.x, BAIT.y, TAP_FORGIVE)).toBeUndefined();
    expect(ladderAt(level, BAIT.x, BAIT.y, TAP_FORGIVE)).toBe(false);
  });
});

describe('上屋抽梯 · 一局真的走得完', () => {
  it('跳级搭不了：只认下一级，搭过的再搭也不动', () => {
    const start = ladderStart(level, 0);
    expect(buildRung(level, start, 'r3', 100)).toBe(start);
    expect(buildRung(level, start, 'nowhere', 100)).toBe(start);
    const one = buildRung(level, start, 'r1', 100);
    expect(one.built).toEqual(['r1']);
    expect(nextRung(level, one)?.id).toBe('r2');
    expect(buildRung(level, one, 'r1', 300)).toBe(one);
    expect(buildRung(level, one, 'r4', 300)).toBe(one);
  });

  it('没搭完不能抽：梯子还没架上，点绳桩什么也不发生（零惩罚）', () => {
    let state = ladderStart(level, 0);
    for (const [index, rung] of level.rungs.entries()) {
      state = buildRung(level, state, rung.id, index * 400);
      if (index < level.rungs.length - 1) {
        expect(allRungsBuilt(level, state)).toBe(false);
        expect(pullLadder(level, state, index * 400)).toBe(state);
        expect(state.drops).toBe(0);
      }
    }
    expect(builtCount(state)).toBe(level.rungs.length);
    expect(ladderProgress(level, state)).toBe(1);
  });

  it('搭完最后一级他才往上走：climbing → ready，只有到位才抽得动', () => {
    const state = buildAll(0);
    // 最后一级是在 1200 搭上的
    expect(ladderPhase(level, state, 1200)).toBe('climbing');
    expect(ladderPhase(level, state, 1200 + CLIMB_MS - 1)).toBe('climbing');
    expect(ladderPhase(level, state, 1200 + CLIMB_MS)).toBe('ready');
    expect(climbRatio(level, state, 1200)).toBe(0);
    expect(climbRatio(level, state, 1200 + CLIMB_MS / 2)).toBeCloseTo(0.5, 6);
    // 到点了抽：成了
    const done = pullLadder(level, state, 1200 + CLIMB_MS);
    expect(isLadderDone(done)).toBe(true);
    expect(ladderPhase(level, done, 1200 + CLIMB_MS)).toBe('done');
    expect(done.drops).toBe(0);
  });

  it('早了抽会掉回来：进度清零、要重新搭；重新搭好、等到位，再抽才成功', () => {
    // 还没爬完就抽：他从半截上滑回地面
    let state = buildAll(0);
    state = pullLadder(level, state, 2000);
    expect(state.drops).toBe(1);
    expect(state.built).toEqual([]);
    expect(ladderPhase(level, state, 2000)).toBe('building');
    expect(isLadderDone(state)).toBe(false);
    expect(nextRung(level, state)?.id).toBe('r1');

    // 重新搭：又得一级一级来
    state = buildRung(level, state, 'r2', 2100);
    expect(state.built).toEqual([]);
    state = buildAll(2200, state);
    expect(allRungsBuilt(level, state)).toBe(true);
    // 这一次等到位再抽
    expect(ladderPhase(level, state, 2200 + 3 * 400 + CLIMB_MS)).toBe('ready');
    state = pullLadder(level, state, 2200 + 3 * 400 + CLIMB_MS);
    expect(isLadderDone(state)).toBe(true);
    expect(state.drops).toBe(1);
  });

  it('零惩罚：掉回来多少回都只是记一笔，重新搭照样搭得成', () => {
    let state = buildAll(0);
    for (let i = 0; i < 3; i += 1) {
      state = pullLadder(level, state, 2000);
      expect(isLadderDone(state)).toBe(false);
      state = buildAll(3000 + i * 2000, state);
    }
    expect(state.drops).toBe(3);
    expect(allRungsBuilt(level, state)).toBe(true);
    expect(isLadderDone(state)).toBe(false);
    state = pullLadder(level, state, 3000 + 2 * 2000 + 3 * 400 + CLIMB_MS);
    expect(isLadderDone(state)).toBe(true);
  });
});

describe('上屋抽梯 · 故事与复习', () => {
  it('两幕：背水列阵 → 夺营换旗；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('河边');
    expect(entry.story[1]!.text).toContain('两千轻骑');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['让早先备好的两千轻骑，趁空冲进去换旗']);
    expect(entry.keyMoment.reveal).toContain('梯子');
  });

  it('三十六计的登记信息：第 28 计、并战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 28, set: 5 });
    expect(entry.yearApprox).toBe(-204);
    expect(entry.figures).toEqual(['韩信', '陈馀']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·并战计》');
    expect(entry.source.chapter).toBe('上屋抽梯');
    expect(entry.source.quote).toContain('假之以便');
    expect(entry.moral).toBe('先给方便，再讲条件 —— 等他上来了，梯子在你手里。');
    expect(entry.game.template).toBe('siege');
    expect(entry.game.stages[0]!.template).toBe('siege');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('小表弟');
  });

  it('儿童化：换的是旗、抽的是梯子，没有一处流血', () => {
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
    expect(prose).toContain('红旗');
  });
});

describe('上屋抽梯 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('shangwu-chouti', 'en')!;
    expect(merged.title).toBe('Lure Him Up, Then Pull the Ladder');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Annexation Stratagems');
  });
});
