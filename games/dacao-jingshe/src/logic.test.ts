import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  canCross, cross, crossablePatches, hasSnake, isKnockDone, isKnocked, isSpooked, knock,
  knockOrder, nextKnockStep, probeStart,
} from '@chags/templates/probe.logic';
import { EXIT, GROUND_TOP, PATCHES, PATCH_RADIUS, SCARE_RADIUS, WALKER, YARD_TOP } from './layout';
import { dacaoLevel } from './logic';

const entry = getEntry('dacao-jingshe')!;
const level = dacaoLevel(entry);

/** 不在任何蛇的惊吓范围里的空草丛 —— 敲到蛇也搅不乱它，这一关的"解"就是它 */
function neverSpookedIds(): string[] {
  const snakes = level.patches.filter((patch) => patch.has === 'snake');
  return level.patches
    .filter((patch) => patch.has === 'clear')
    .filter((patch) =>
      snakes.every((snake) => Math.hypot(patch.x - snake.x, patch.y - snake.y) > level.scareRadius),
    )
    .map((patch) => patch.id);
}

describe('打草惊蛇 · 关卡数据', () => {
  it('五丛草长在小路两边 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('knock');
    expect(level.patches.map((patch) => patch.id)).toEqual(PATCHES.map((patch) => patch.id));
    for (const [index, patch] of level.patches.entries()) {
      expect(patch.x).toBe(PATCHES[index]!.x);
      expect(patch.y).toBe(PATCHES[index]!.y);
      expect(patch.radius).toBe(PATCH_RADIUS);
    }
    expect(level.scareRadius).toBe(SCARE_RADIUS);
    expect(level.exit).toEqual(EXIT);
  });

  it('五丛草全在画面里，小路从王鲁脚下通到右边的院门', () => {
    for (const patch of level.patches) {
      expect(patch.x - patch.radius).toBeGreaterThanOrEqual(0);
      expect(patch.x + patch.radius).toBeLessThanOrEqual(750);
      expect(patch.y - patch.radius).toBeGreaterThan(GROUND_TOP);
      expect(patch.y + patch.radius).toBeLessThan(1334);
      // 五丛都长在后院的地上，不在墙上
      expect(patch.y).toBeGreaterThan(YARD_TOP);
    }
    // 王鲁站在小路这一头（左下角），院门在右侧
    expect(WALKER.y).toBeGreaterThan(Math.max(...level.patches.map((patch) => patch.y)));
    expect(EXIT.x).toBeGreaterThan(Math.max(...level.patches.map((patch) => patch.x)));
  });

  it('两处有蛇、三处空的：只有最靠近院门的那一丛是谁也搅不乱的安全路', () => {
    const snakes = level.patches.filter((patch) => patch.has === 'snake').map((patch) => patch.id);
    const clears = level.patches.filter((patch) => patch.has === 'clear').map((patch) => patch.id);
    expect(snakes).toEqual(['c1', 'c3']);
    expect(clears).toEqual(['c2', 'c4', 'c5']);
    // 恰好一处"解"：c5 —— 两处空的（c2、c4）都贴着某条蛇
    expect(neverSpookedIds()).toEqual(['c5']);
    // 而且它就在院门边上：五丛里离 exit 最近的就是它
    const toExit = (id: string): number => {
      const patch = level.patches.find((item) => item.id === id)!;
      return Math.hypot(patch.x - EXIT.x, patch.y - EXIT.y);
    };
    for (const patch of level.patches) {
      if (patch.id === 'c5') continue;
      expect(toExit('c5')).toBeLessThan(toExit(patch.id));
    }
  });

  it('敲到蛇：附近的草一起塌下去，那一片就不能走了（零惩罚，换一处就是）', () => {
    let state = knock(level, probeStart(), 'c1');
    expect(hasSnake(level, 'c1')).toBe(true);
    expect(isSpooked(state, 'c1')).toBe(true);
    expect(isSpooked(state, 'c2')).toBe(true); // 离 c1 只有 143.7 < 150
    expect(isSpooked(state, 'c4')).toBe(false);
    // 敲过但被搅乱的，走不过去
    expect(canCross(level, state, 'c2')).toBe(false);
    // 王鲁脚边那一丛就是蛇：这就是"打草惊蛇"那一下
    expect(isKnocked(state, 'c1')).toBe(true);
    expect(isKnockDone(state)).toBe(false);
    // 接着敲最外圈那一丛（c5），照样走得掉
    state = knock(level, state, 'c5');
    expect(canCross(level, state, 'c5')).toBe(true);
    expect(isKnockDone(cross(level, state, 'c5'))).toBe(true);
  });

  it('从最外圈往里敲：第一步永远是最外圈那一丛，不是中间那丛', () => {
    expect(knockOrder(level).map((patch) => patch.id)).toEqual(['c5', 'c1', 'c2', 'c4', 'c3']);
    const step = nextKnockStep(level, probeStart());
    expect(step?.kind).toBe('knock');
    expect(step?.patch.id).toBe('c5');
  });

  it('一局真的走得完：敲最外圈那一丛 → 确认安全 → 走过去（与场景同一条路）', () => {
    const steps: string[] = [];
    let state = probeStart();
    for (let i = 0; i < 20 && !isKnockDone(state); i += 1) {
      const step = nextKnockStep(level, state);
      expect(step).toBeDefined();
      if (step === undefined) break;
      steps.push(step.kind + ':' + step.patch.id);
      state = step.kind === 'cross'
        ? cross(level, state, step.patch.id)
        : knock(level, state, step.patch.id);
    }
    expect(isKnockDone(state)).toBe(true);
    expect(steps).toEqual(['knock:c5', 'cross:c5']);
  });

  it('无论先敲哪一丛，最后都还有路：五丛全敲过之后 c5 依然走得通', () => {
    let state = probeStart();
    for (const patch of level.patches) state = knock(level, state, patch.id);
    expect(crossablePatches(level, state).map((patch) => patch.id)).toEqual(['c5']);
    expect(isSpooked(state, 'c5')).toBe(false);
  });
});

describe('打草惊蛇 · 故事与复习', () => {
  it('两幕：案卷上的名字 → 拨草见蛇；关键抉择在第一幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('自己的名字');
    expect(entry.story[1]!.text).toContain('蛇');
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text))
      .toEqual(['先轻轻拨一处，看清楚再说']);
    expect(entry.keyMoment.reveal).toContain('先拨一处');
  });

  it('三十六计的登记信息：第 13 计、攻战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 13, set: 3 });
    expect(entry.yearApprox).toBe(940);
    expect(entry.figures).toEqual(['王鲁']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('打草惊蛇');
    expect(entry.source.quote).toContain('疑以叩实');
    expect(entry.moral).toBe('先试一试，再动手 —— 但试本身也会惊动别人。');
    expect(entry.game.template).toBe('probe');
    expect(entry.game.stages[0]!.template).toBe('probe');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('抽屉');
  });

  it('适龄化：蛇只是窜出来，没有一处流血', () => {
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

describe('打草惊蛇 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('dacao-jingshe', 'en')!;
    expect(merged.title).toBe('Beating the Grass to Startle the Snake');
  });
});
