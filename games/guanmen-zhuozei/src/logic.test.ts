import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  closeExit, closeSchedule, closedCount, closeStart, escapeExit, hasEscaped, isCloseDone,
  exitAt, nextExitToClose,
} from '@chags/templates/siege.logic';
import {
  AMBUSH, CLOSE_MS, DESIGN_H, DESIGN_W, ESCAPE_AFTER_MS, EXITS, EXIT_RADIUS, NIGHT_TOP, THIEF,
  WALL_LEFT, WALL_RIGHT,
} from './layout';
import { guanmenLevel } from './logic';

const entry = getEntry('guanmen-zhuozei')!;
const level = guanmenLevel(entry);

/**
 * 模板的点击宽容度（siege.ts 里 SIEGE.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 56;

describe('关门捉贼 · 关卡数据', () => {
  it('四个出口与贼落在画好的位置上 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('close');
    expect(level.exits.map((exit) => exit.id)).toEqual(EXITS.map((exit) => exit.id));
    for (const [index, exit] of level.exits.entries()) {
      expect(exit.x).toBe(EXITS[index]!.x);
      expect(exit.y).toBe(EXITS[index]!.y);
      expect(exit.radius).toBe(EXIT_RADIUS);
      expect(exit.closeMs).toBe(CLOSE_MS);
    }
    expect(level.thief).toEqual({ x: THIEF.x, y: THIEF.y, radius: THIEF.radius });
    expect(level.escapeAfterMs).toBe(ESCAPE_AFTER_MS);
  });

  it('四个出口都在画面里、都围着贼，而且互相点得开', () => {
    // 贼站在道当中，四个出口围着他
    expect(Math.abs(level.thief.x - DESIGN_W / 2)).toBeLessThan(40);
    for (const exit of level.exits) {
      expect(exit.x - exit.radius).toBeGreaterThanOrEqual(0);
      expect(exit.x + exit.radius).toBeLessThanOrEqual(DESIGN_W);
      expect(exit.y - exit.radius).toBeGreaterThan(NIGHT_TOP);
      expect(exit.y + exit.radius).toBeLessThan(DESIGN_H);
      expect(
        Math.hypot(exit.x - level.thief.x, exit.y - level.thief.y),
      ).toBeGreaterThan(exit.radius + level.thief.radius);
    }
    // 任意两扇门的命中圈都不叠在一起 —— 手指粗也不会点到隔壁那扇
    for (const a of level.exits) {
      for (const b of level.exits) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
          2 * (a.radius + TAP_FORGIVE),
        );
      }
    }
  });

  it('两壁夹着一条道：山脊上的伏兵都不站在路当中', () => {
    for (const wall of [WALL_LEFT, WALL_RIGHT]) {
      expect(Math.min(...wall.map((point) => point.y))).toBeGreaterThanOrEqual(NIGHT_TOP);
      // 山壁从两边围过来，中间这条道留给贼和四扇门
      const innermost = wall.reduce((best, point) =>
        Math.abs(point.x - DESIGN_W / 2) < Math.abs(best.x - DESIGN_W / 2) ? point : best,
      );
      expect(Math.abs(innermost.x - DESIGN_W / 2)).toBeGreaterThan(150);
    }
    for (const spot of AMBUSH) {
      expect(Math.abs(spot.x - DESIGN_W / 2)).toBeGreaterThan(200);
    }
  });

  it('四个出口各 1200 毫秒，加起来 4800 —— 比贼跑掉的 9000 早，来得及', () => {
    const total = level.exits.reduce((sum, exit) => sum + exit.closeMs, 0);
    expect(total).toBe(4 * CLOSE_MS);
    expect(total).toBeLessThan(level.escapeAfterMs);
  });

  it('一局真的走得完：一扇一扇关下去，贼跑之前全关上（与场景同一条路）', () => {
    let state = closeStart(level, 0);
    const steps: string[] = [];
    for (let i = 0; i < 10 && !isCloseDone(level, state, 4 * CLOSE_MS); i += 1) {
      const exit = nextExitToClose(level, state);
      expect(exit).toBeDefined();
      if (exit === undefined) break;
      steps.push(exit.id);
      state = closeExit(level, state, exit.id, 0);
    }
    // 先关离贼最近的：西门与东门一样近（245），并列时取关卡里靠前的
    expect(steps).toEqual(['west', 'east', 'south', 'north']);
    expect(closeSchedule(level, state).map((item) => item.doneAtMs)).toEqual([1200, 2400, 3600, 4800]);
    expect(isCloseDone(level, state, 4 * CLOSE_MS - 1)).toBe(false);
    expect(isCloseDone(level, state, 4 * CLOSE_MS)).toBe(true);
    // 全关上了：贼跑不掉，哪怕时钟早就过了那个点
    expect(hasEscaped(level, state, level.escapeAfterMs)).toBe(false);
    expect(hasEscaped(level, state, 60000)).toBe(false);
  });

  it('零惩罚：贼站着的地方没有门；已经关上的门再点也不会更糟', () => {
    expect(exitAt(level, level.thief.x, level.thief.y, TAP_FORGIVE)).toBeUndefined();
    const start = closeStart(level, 0);
    const west = closeExit(level, start, 'west', 0);
    expect(west).not.toBe(start);
    expect(closeExit(level, west, 'west', 0)).toBe(west);
    expect(closeExit(level, west, 'west', 5000)).toBe(west);
    // 点得快也没关系：还没排队的门照样排得进去
    const east = closeExit(level, west, 'east', 0);
    expect(east).not.toBe(west);
    expect(east.queue).toEqual(['west', 'east']);
  });

  it('贼跑了只是重来：门又都开着，账清空、只记一笔（零惩罚）', () => {
    let state = closeStart(level, 0);
    state = closeExit(level, state, 'west', 0);
    expect(hasEscaped(level, state, level.escapeAfterMs - 1)).toBe(false);
    expect(hasEscaped(level, state, level.escapeAfterMs)).toBe(true);
    // 他只从最近的、还没关上的门跑：西门关严了，最近的是东门
    expect(closedCount(level, state, level.escapeAfterMs)).toBe(1);
    expect(escapeExit(level, state, level.escapeAfterMs)?.id).toBe('east');

    const again = closeStart(level, level.escapeAfterMs, state.escapes + 1);
    expect(again.escapes).toBe(1);
    expect(again.queue).toEqual([]);
    expect(closedCount(level, again, level.escapeAfterMs)).toBe(0);
    expect(hasEscaped(level, again, 2 * level.escapeAfterMs - 1)).toBe(false);
    // 重来之后照样关得完：这一局没有"玩坏"这回事
    let retry = again;
    for (const id of ['west', 'east', 'south', 'north']) {
      retry = closeExit(level, retry, id, level.escapeAfterMs);
    }
    expect(isCloseDone(level, retry, level.escapeAfterMs + 4 * CLOSE_MS)).toBe(true);
  });
});

describe('关门捉贼 · 故事与复习', () => {
  it('两幕：又窄又险的马陵道 → 先把门关上；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('马陵道');
    expect(entry.story[1]!.text).toContain('堵住');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['先把两头的山口堵住，再动手']);
    expect(entry.keyMoment.reveal).toContain('退路');
  });

  it('三十六计的登记信息：第 22 计、混战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 22, set: 4 });
    expect(entry.yearApprox).toBe(-341);
    expect(entry.figures).toEqual(['孙膑', '庞涓']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·混战计》');
    expect(entry.source.chapter).toBe('关门捉贼');
    expect(entry.source.quote).toContain('小敌困之');
    expect(entry.moral).toBe('动手之前，先把他的退路想清楚。');
    expect(entry.game.template).toBe('siege');
    expect(entry.game.stages[0]!.template).toBe('siege');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('弹珠');
  });

  it('适龄化：门是"关上"不是"夹住"，贼只是跑掉，没有一处流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).not.toContain('血');
    expect(prose).not.toContain('死');
    expect(prose).not.toContain('夹住');
  });
});

describe('关门捉贼 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('guanmen-zhuozei', 'en')!;
    expect(merged.title).toBe('Shut the Door to Catch the Thief');
  });
});
