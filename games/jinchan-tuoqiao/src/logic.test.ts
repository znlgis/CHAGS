import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  SWAP_TIMING, isAllSwapped, isShellDone, leave, nextSwapStep, peek, placeSpare, seenCount,
  swapCount, swapStart,
} from '@chags/templates/swap.logic';
import {
  GATE, PILE_BOTTOM, PILE_TOP, POST_KINDS, POST_RADIUS, POST_XS, POST_Y, SPARE_KINDS,
  SPARE_RADIUS, SPARE_XS, SPARE_Y, TOWER, WALL_BOTTOM, WALL_TOP,
} from './layout';
import { jinchanLevel } from './logic';

const entry = getEntry('jinchan-tuoqiao')!;
const level = jinchanLevel(entry);

/** 一局里该走的那几步（照模板 runAutoplay 的同一条路：拿起来 → 放下去 → 走掉） */
function runAutoplay(): { steps: string[]; state: ReturnType<typeof swapStart> } {
  const steps: string[] = [];
  let state = swapStart(level);
  for (let i = 0; i < 30 && !isShellDone(level, state); i += 1) {
    const step = nextSwapStep(level, state);
    if (step === undefined) {
      state = leave(level, state, i * 620);
      steps.push('leave');
      break;
    }
    steps.push(step.post.id + '<-' + step.spare.id);
    state = placeSpare(level, state, step.post.id, step.spare.id);
  }
  return { steps, state };
}

describe('金蝉脱壳 · 美术与关卡数据互锁', () => {
  it('五个岗位就在墙下那一排 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('shell');
    expect(level.posts.map((post) => post.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(level.posts.map((post) => post.x)).toEqual([...POST_XS]);
    expect(level.posts.map((post) => post.kind)).toEqual([...POST_KINDS]);
    for (const post of level.posts) {
      expect(post.y).toBe(POST_Y);
      expect(post.radius).toBe(POST_RADIUS);
      expect(post.y).toBeGreaterThan(WALL_TOP); // 站在营墙下
      expect(post.y).toBeLessThan(WALL_BOTTOM);
    }
  });

  it('五个替身躺在墙根的草堆里，而且**样子是打乱的**：要挑，不是照着放', () => {
    expect(level.spares.map((spare) => spare.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(level.spares.map((spare) => spare.x)).toEqual([...SPARE_XS]);
    expect(level.spares.map((spare) => spare.kind)).toEqual([...SPARE_KINDS]);
    for (const spare of level.spares) {
      expect(spare.y).toBe(SPARE_Y);
      expect(spare.radius).toBe(SPARE_RADIUS);
      expect(spare.y).toBeGreaterThan(PILE_TOP);
      expect(spare.y).toBeLessThan(PILE_BOTTOM);
    }
    // 一打乱，"第 n 个替身配第 n 个位置"这条捷径就没用了
    expect([...SPARE_KINDS]).not.toEqual([...POST_KINDS]);
    // 但每个岗位都要有一个同 kind 的替身（否则这一关不可能全换好）
    for (const post of level.posts) {
      expect(level.spares.filter((spare) => spare.kind === post.kind)).toHaveLength(1);
    }
  });

  it('院门在右下角，检查者在岗楼上 —— 位置与美术一字不差', () => {
    expect(level.exit).toEqual(GATE);
    expect(level.exit.x).toBeGreaterThan(375);
    expect(level.exit.y).toBeGreaterThan(PILE_BOTTOM);
    expect(TOWER.x).toBeGreaterThan(375); // 岗楼在右边，灯从左扫到右
    expect(TOWER.y).toBeLessThan(WALL_TOP);
    expect(level.peekMs).toBe(5200);
  });

  it('所有的位置都在画面里（750×1334）', () => {
    for (const item of [...level.posts, ...level.spares]) {
      expect(item.x - item.radius).toBeGreaterThanOrEqual(0);
      expect(item.x + item.radius).toBeLessThanOrEqual(750);
      expect(item.y - item.radius).toBeGreaterThan(0);
      expect(item.y + item.radius).toBeLessThan(1334);
    }
    expect(level.exit.x + level.exit.radius).toBeLessThanOrEqual(750);
    expect(level.exit.y + level.exit.radius).toBeLessThan(1334);
    // 草堆与院门不重叠：点在哪儿都要分得清
    for (const spare of level.spares) {
      expect(Math.hypot(spare.x - level.exit.x, spare.y - level.exit.y)).toBeGreaterThan(
        spare.radius + level.exit.radius,
      );
    }
  });
});

describe('金蝉脱壳 · 一局真的走得完（照模板 runAutoplay 的同一条路）', () => {
  it('五个位置一个一个换成替身，再从院门走掉 —— 全程没被看见', () => {
    const { steps, state } = runAutoplay();
    expect(steps).toEqual(['p1<-s3', 'p2<-s1', 'p3<-s5', 'p4<-s4', 'p5<-s2', 'leave']);
    expect(isAllSwapped(level, state)).toBe(true);
    expect(isShellDone(level, state)).toBe(true);
    expect(swapCount(state)).toBe(5);
    expect(seenCount(state)).toBe(0);
    // 换完五个用的时间远小于第一次抬头（5200ms）：
    // 拿起 + 放下各算一步 —— 十步也要赶在检查者抬头之前换完
    expect(2 * level.posts.length * SWAP_TIMING.autoplayStepMs).toBeLessThan(level.peekMs);
  });

  it('换到一半被抬头看见：那个位置被戳穿、要重新换 —— 零惩罚，照样走得完', () => {
    let state = placeSpare(level, swapStart(level), 'p1', 's3');
    state = placeSpare(level, state, 'p2', 's1');
    state = peek(level, state, level.peekMs); // 抬头：剩下三个位置被看见
    expect(state.seen).toBe(3);
    expect(state.caught).toEqual(['p3', 'p4', 'p5']);
    // 已经换好的两个不受影响
    expect(state.covers['p1']).toBe('s3');
    expect(state.covers['p2']).toBe('s1');
    // 不结束：接着把没换好的补上，还是走得掉
    expect(isShellDone(level, state)).toBe(false);
    // 剩下的三处一个一个补上（每一处都用同 kind 的替身）
    for (const post of level.posts) {
      if (state.covers[post.id] !== undefined) continue;
      const step = nextSwapStep(level, state);
      expect(step?.post.id).toBe(post.id);
      if (step === undefined) break;
      state = placeSpare(level, state, step.post.id, step.spare.id);
    }
    expect(isAllSwapped(level, state)).toBe(true);
    state = leave(level, state, 8000);
    expect(isShellDone(level, state)).toBe(true);
    expect(seenCount(state)).toBe(3); // 账记着，星星不受影响
  });

  it('样子拿错了：放不上去（原样返回），零惩罚', () => {
    const state = swapStart(level);
    expect(placeSpare(level, state, 'p1', 's1')).toBe(state); // 鼓的岗位拿了旗的替身
    expect(swapCount(state)).toBe(0);
    expect(seenCount(state)).toBe(0);
    expect(isShellDone(level, state)).toBe(false);
  });

  it('没换完就走向院门：走不掉（零惩罚）', () => {
    const half = placeSpare(level, swapStart(level), 'p1', 's3');
    expect(leave(level, half, 2000)).toBe(half);
    expect(isShellDone(level, half)).toBe(false);
  });
});

describe('金蝉脱壳 · 内容', () => {
  it('两幕：鼓声响了一夜 → 天亮看清全是稻草人；关键抉择在第一幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('鼓');
    expect(entry.story[1]!.text).toContain('稻草人');
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['每个岗位都换上替身，样子照旧']);
    expect(entry.keyMoment.reveal).toContain('别让人看出来');
  });

  it('三十六计的登记信息：第 21 计、混战计（第四套）；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 21, set: 4 });
    expect(entry.yearApprox).toBe(1206);
    expect(entry.figures).toEqual(['毕再遇']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·混战计》');
    expect(entry.source.chapter).toBe('金蝉脱壳');
    expect(entry.source.quote).toContain('存其形');
    expect(entry.game.template).toBe('swap');
    expect(entry.game.stages[0]!.template).toBe('swap');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz.some((q) => q.question.includes('模型'))).toBe(true);
  });

  it('适龄化：壳是稻草人，没有一处流血 —— 人只是悄悄走了', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).not.toContain('血');
    expect(prose).not.toContain('死');
    expect(prose).toContain('稻草人');
  });
});

describe('金蝉脱壳 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('jinchan-tuoqiao', 'en')!;
    expect(merged.title).toBe('The Golden Cicada Sheds Its Shell');
  });
});
