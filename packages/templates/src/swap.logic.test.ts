import { describe, expect, it } from 'vitest';
import { SwapBeamSchema, SwapLevelSchema } from './schemas';
import {
  // swap 扩展：beam（偷梁换柱）—— 老模式的那一串一个字没改，只是多了一行
  BEAM_TIMING, beamPostAt, beamPostById, beamSeenCount, beamSpareFor, beamStart, check, checkCount,
  isBeamDone, isPostRebuilt, nextCheckInMs, nextPostToWork, rebuiltCount, rebuiltRatio, startWork,
  tickWork, workLeftMs, workRatio, workingMs, workingPostId,
  SWAP_TIMING, canPlace, caughtPosts, gateHit, hasLeft, isAllSwapped, isPostSwapped, isShellDone,
  leave, nextPeekInMs, nextPostToSwap, nextSwapStep, peek, peekCount, placeSpare, postAt, postById,
  seenCount, spareAt, spareById, spareFor, spareOf, spareStandingAt, swapCount, swapOrder, swapStart,
  unswappedPosts, usableSpares,
} from './swap.logic';
import type { SwapBeamState, SwapState } from './swap.logic';

/** 第 21 计 · 金蝉脱壳：一排五个位置（鼓 / 旗 / 火把 / 矛 / 号角），草堆里五个替身 */
const level = SwapLevelSchema.parse({
  mode: 'shell',
  posts: [
    { id: 'p1', x: 120, y: 560, radius: 62, kind: 'drum' },
    { id: 'p2', x: 255, y: 560, radius: 62, kind: 'flag' },
    { id: 'p3', x: 375, y: 560, radius: 62, kind: 'torch' },
    { id: 'p4', x: 495, y: 560, radius: 62, kind: 'spear' },
    { id: 'p5', x: 630, y: 560, radius: 62, kind: 'horn' },
  ],
  spares: [
    { id: 's1', x: 120, y: 1010, radius: 62, kind: 'flag' },
    { id: 's2', x: 255, y: 1010, radius: 62, kind: 'horn' },
    { id: 's3', x: 375, y: 1010, radius: 62, kind: 'drum' },
    { id: 's4', x: 495, y: 1010, radius: 62, kind: 'spear' },
    { id: 's5', x: 630, y: 1010, radius: 62, kind: 'torch' },
  ],
  peekMs: 5200,
  exit: { x: 620, y: 1236, radius: 76 },
  hint: '换好再走',
});

/** 一个位置该用哪个替身：脚本里写死，免得测试跟着"配对算法"一起漂 */
const HOME: Record<string, string> = { p1: 's3', p2: 's1', p3: 's5', p4: 's4', p5: 's2' };

/** 把五个位置全换好（照真实操作：一个一个 placeSpare） */
function swapAll(state: SwapState): SwapState {
  let next = state;
  for (const post of level.posts) next = placeSpare(level, next, post.id, HOME[post.id]!);
  return next;
}

describe('替换：样子对了才换得上', () => {
  it('拿同 kind 的替身放上去，这个位置就换好了', () => {
    const state = placeSpare(level, swapStart(level), 'p1', 's3');
    expect(isPostSwapped(state, 'p1')).toBe(true);
    expect(spareOf(state, 'p1')).toBe('s3');
    expect(swapCount(state)).toBe(1);
    expect(isAllSwapped(level, state)).toBe(false);
    expect(unswappedPosts(level, state).map((post) => post.id)).toEqual(['p2', 'p3', 'p4', 'p5']);
  });

  it('样子不对：原样返回（连状态对象都不换），只提示"样子不对" —— 零惩罚', () => {
    const state = swapStart(level);
    expect(canPlace(level, state, 'p1', 's1')).toBe(false); // 鼓的位置拿了旗的替身
    expect(placeSpare(level, state, 'p1', 's1')).toBe(state);
    expect(swapCount(state)).toBe(0);
    // 一个位置都没被戳穿、也没结束
    expect(state.seen).toBe(0);
    expect(state.caught).toEqual([]);
    expect(isShellDone(level, state)).toBe(false);
  });

  it('写错 id 也原样返回，不抛', () => {
    const state = swapStart(level);
    expect(placeSpare(level, state, 'ghost', 's1')).toBe(state);
    expect(placeSpare(level, state, 'p2', 'ghost')).toBe(state);
    expect(postById(level, 'ghost')).toBeUndefined();
    expect(spareById(level, 'ghost')).toBeUndefined();
    expect(swapCount(state)).toBe(0);
  });

  it('一个稻草人只有一个身子：站在这儿就不能同时站在别处', () => {
    // 两个都是旗的位置、两个旗的替身 —— 正好试"一个身子不能站两处"
    const twinFlags = SwapLevelSchema.parse({
      mode: 'shell',
      posts: [
        { id: 'p2', x: 255, y: 560, radius: 62, kind: 'flag' },
        { id: 'p6', x: 630, y: 560, radius: 62, kind: 'flag' },
        { id: 'p1', x: 120, y: 560, radius: 62, kind: 'drum' },
      ],
      spares: [
        { id: 's1', x: 120, y: 1010, radius: 62, kind: 'flag' },
        { id: 's6', x: 675, y: 1010, radius: 62, kind: 'flag' },
        { id: 's3', x: 375, y: 1010, radius: 62, kind: 'drum' },
      ],
      peekMs: 5200,
      exit: { x: 620, y: 1236, radius: 76 },
      hint: '换好再走',
    });
    let flags = placeSpare(twinFlags, swapStart(twinFlags), 'p2', 's1');
    expect(isPostSwapped(flags, 'p2')).toBe(true);
    expect(spareStandingAt(flags, 's1')).toBe('p2');
    // s1 已经站在 p2 上了：另一个位置再点它，放不上去（原样返回）
    expect(canPlace(twinFlags, flags, 'p6', 's1')).toBe(false);
    expect(placeSpare(twinFlags, flags, 'p6', 's1')).toBe(flags);
    expect(swapCount(flags)).toBe(1);
    // 换一个替身顶上（换错了可以改）——s1 又回草堆里了
    flags = placeSpare(twinFlags, flags, 'p2', 's6');
    expect(spareOf(flags, 'p2')).toBe('s6');
    expect(spareStandingAt(flags, 's1')).toBeUndefined();
    expect(usableSpares(twinFlags, flags).map((spare) => spare.id)).toEqual(['s1', 's3']);
  });

  it('还躺在草堆里的替身才拿得走', () => {
    const state = swapAll(swapStart(level));
    expect(usableSpares(level, state)).toEqual([]);
    expect(swapCount(state)).toBe(5);
    expect(isAllSwapped(level, state)).toBe(true);
    expect(unswappedPosts(level, state)).toEqual([]);
  });
});

describe('检查者抬头：没换好的被戳穿（零惩罚）', () => {
  it('还没到点：原样返回（连状态对象都不换）', () => {
    const state = placeSpare(level, swapStart(level), 'p1', 's3');
    expect(peek(level, state, 0)).toBe(state);
    expect(peek(level, state, level.peekMs - 1)).toBe(state);
    expect(nextPeekInMs(level, state, 0)).toBe(level.peekMs);
    expect(peekCount(level, state)).toBe(0);
  });

  it('到点抬头：一个都没换好，五个位置全被看见（各记一次 seen）', () => {
    const state = peek(level, swapStart(level), level.peekMs);
    expect(state.seen).toBe(5);
    expect(caughtPosts(level, state).map((post) => post.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    // 被戳穿的位置身上没有换装（这就是"撤销换装"），要重新换一遍
    for (const post of level.posts) expect(isPostSwapped(state, post.id)).toBe(false);
    // 零惩罚：不结束、不进任何"失败"状态
    expect(hasLeft(state)).toBe(false);
    expect(isShellDone(level, state)).toBe(false);
    // 下一次抬头的钟往后走了一个 peekMs
    expect(state.nextPeekAt).toBe(level.peekMs * 2);
    expect(nextPeekInMs(level, state, level.peekMs + 200)).toBe(level.peekMs - 200);
  });

  it('检查会撤销没换好的：换好两个，剩下三个被戳穿、要重新换', () => {
    let state = placeSpare(level, swapStart(level), 'p1', 's3');
    state = placeSpare(level, state, 'p2', 's1');
    const peeked = peek(level, state, level.peekMs);
    expect(peeked.seen).toBe(3);
    expect(caughtPosts(level, peeked).map((post) => post.id)).toEqual(['p3', 'p4', 'p5']);
    // 被戳穿的三个：身上没有换装 → 必须重新换一遍
    for (const id of ['p3', 'p4', 'p5']) {
      expect(isPostSwapped(peeked, id)).toBe(false);
      expect(spareOf(peeked, id)).toBeUndefined();
    }
    // 重新换好之后就"不再算被戳穿"
    const fixed = placeSpare(level, peeked, 'p3', 's5');
    expect(caughtPosts(level, fixed).map((post) => post.id)).toEqual(['p4', 'p5']);
    expect(seenCount(fixed)).toBe(3); // 账还记着（复盘用），但位置已经补上了
  });

  it('检查不影响已换好的：换好的位置一动不动，也不会被算进 seen', () => {
    const state = placeSpare(level, swapStart(level), 'p4', 's4');
    const peeked = peek(level, state, level.peekMs);
    expect(isPostSwapped(peeked, 'p4')).toBe(true);
    expect(spareOf(peeked, 'p4')).toBe('s4');
    expect(spareStandingAt(peeked, 's4')).toBe('p4');
    expect(peeked.caught).not.toContain('p4');
    // 抬头三次都是这样：换好的那一个一直好好的
    let again = peeked;
    for (let i = 0; i < 3; i += 1) {
      again = peek(level, again, again.nextPeekAt);
      expect(isPostSwapped(again, 'p4')).toBe(true);
    }
    expect(again.seen).toBe(4 * 4); // 每次抬头四个没换好的各看一次
  });

  it('全部换好之后再抬头：谁也没被看见 —— 这就是"趁两次检查之间换完"', () => {
    const all = swapAll(swapStart(level));
    const peeked = peek(level, all, level.peekMs);
    expect(peeked.seen).toBe(0);
    expect(peeked.caught).toEqual([]);
    expect(swapCount(peeked)).toBe(5);
    expect(isAllSwapped(level, peeked)).toBe(true);
  });

  it('可以一直重来：被戳穿几次都不会卡住，最后照样换得完', () => {
    let state = swapStart(level);
    // 前三次抬头：只换两个，被戳穿三次
    state = placeSpare(level, state, 'p1', 's3');
    state = peek(level, state, level.peekMs);
    state = peek(level, state, state.nextPeekAt);
    state = peek(level, state, state.nextPeekAt);
    expect(state.seen).toBe(4 * 3);
    expect(state.caught.length).toBeGreaterThan(0);
    // 第四次之前把该换的一次换完 —— 零惩罚，照样成
    state = swapAll(state);
    state = peek(level, state, state.nextPeekAt);
    expect(state.seen).toBe(4 * 3);
    state = leave(level, state, state.nextPeekAt + 100);
    expect(isShellDone(level, state)).toBe(true);
    expect(seenCount(state)).toBe(12); // 复盘数据留着，星星不受影响
  });
});

describe('走掉：全换好 + 离开才算脱壳成功', () => {
  it('还没换完就走到院门：原样返回（零惩罚，场景只提示一句）', () => {
    const state = placeSpare(level, swapStart(level), 'p1', 's3');
    expect(leave(level, state, 1000)).toBe(state);
    expect(hasLeft(state)).toBe(false);
    expect(isShellDone(level, state)).toBe(false);
  });

  it('全换好了但还没走：也还不算成功', () => {
    const all = swapAll(swapStart(level));
    expect(isAllSwapped(level, all)).toBe(true);
    expect(hasLeft(all)).toBe(false);
    expect(isShellDone(level, all)).toBe(false);
  });

  it('全换好之后走掉：脱壳成功，走掉的时刻记在账上', () => {
    const all = leave(level, swapAll(swapStart(level)), 4321);
    expect(hasLeft(all)).toBe(true);
    expect(all.leftAtMs).toBe(4321);
    expect(isShellDone(level, all)).toBe(true);
    // 走掉之后不会再有人抬头看
    expect(peek(level, all, all.nextPeekAt + 100000)).toBe(all);
    expect(leave(level, all, 9999)).toBe(all); // 也不能走第二次
  });

  it('走掉之后不能再改账（已经成了的一局不再变）', () => {
    const all = leave(level, swapAll(swapStart(level)), 4321);
    expect(placeSpare(level, all, 'p1', 's3')).toBe(all);
  });
});

describe('该先换哪一个 / 无头验证', () => {
  it('先补被看见过、最久没换的那一个', () => {
    let state = placeSpare(level, swapStart(level), 'p1', 's3');
    expect(nextPostToSwap(level, state)?.id).toBe('p2'); // 没人被看见：按脚本顺序
    state = placeSpare(level, state, 'p5', 's2');
    state = peek(level, state, level.peekMs); // p2 p3 p4 被看见
    // 被看见的三个排在最前；p5 已经换好了，不在"该换"的里面
    expect(swapOrder(level, state).map((post) => post.id)).toEqual(['p2', 'p3', 'p4']);
    state = placeSpare(level, state, 'p2', 's1');
    expect(nextPostToSwap(level, state)?.id).toBe('p3');
  });

  it('该拿哪个替身：同 kind、而且还在草堆里', () => {
    const state = swapStart(level);
    const post = postById(level, 'p5')!;
    expect(spareById(level, 's2')?.kind).toBe(post.kind);
    expect(spareFor(level, state, post)?.id).toBe('s2');
    // 已经站到 p5 上了：这一组数据里没有第二个号角替身，谁都补不上它
    const used = placeSpare(level, state, 'p5', 's2');
    expect(spareFor(level, used, post)).toBeUndefined();
    expect(nextSwapStep(level, used)?.spare.id).not.toBe('s2');
  });

  it('无头验证：一步一步把五个位置换完，再走到院门（与真实操作同一条路）', () => {
    const steps: string[] = [];
    let state = swapStart(level);
    for (let i = 0; i < 30 && !isShellDone(level, state); i += 1) {
      const step = nextSwapStep(level, state);
      if (step === undefined) {
        // 全换好了：只剩下"走掉"这一步
        expect(isAllSwapped(level, state)).toBe(true);
        state = leave(level, state, i * SWAP_TIMING.autoplayStepMs);
        steps.push('leave');
        break;
      }
      steps.push(step.post.id + '<-' + step.spare.id);
      state = placeSpare(level, state, step.post.id, step.spare.id);
    }
    expect(isShellDone(level, state)).toBe(true);
    expect(steps).toEqual(['p1<-s3', 'p2<-s1', 'p3<-s5', 'p4<-s4', 'p5<-s2', 'leave']);
    // 全程一次都没被看见：换完五个用的时间远小于第一次抬头的 peekMs
    expect(state.seen).toBe(0);
    expect(steps.length * SWAP_TIMING.autoplayStepMs).toBeLessThan(level.peekMs);
  });

  it('时间常量：无头验证一定赶得上第一次抬头（拿起 + 放下各一步），而且一步看得清', () => {
    // 五个位置 = 拿起五个替身 + 放下五个替身 = 十步
    expect(2 * level.posts.length * SWAP_TIMING.autoplayStepMs).toBeLessThan(level.peekMs);
    expect(SWAP_TIMING.autoplayLeaveMs).toBeGreaterThan(0);
    expect(SWAP_TIMING.placeMs).toBeLessThan(SWAP_TIMING.autoplayStepMs);
    expect(SWAP_TIMING.caughtMs).toBeGreaterThan(0);
    expect(SWAP_TIMING.finaleHoldMs).toBeGreaterThan(0);
  });
});

describe('点选与边界', () => {
  it('点位置 / 点替身：圆心与边缘都算，最近的那个优先', () => {
    expect(postAt(level, 120, 560, 0)?.id).toBe('p1');
    expect(postAt(level, 120 + 62, 560, 0)?.id).toBe('p1');
    expect(postAt(level, 120 + 63, 560, 0)).toBeUndefined();
    expect(postAt(level, 120, 560 + 100, 44)?.id).toBe('p1'); // 宽容度：手指粗一点也点得到
    expect(postAt(level, 120 + 63, 560, 12)?.id).toBe('p1'); // 差一点的那一处，宽容度把它补上
    expect(spareAt(level, 375, 1010, 0)?.id).toBe('s3');
    expect(spareAt(level, 375, 1010 + 63, 0)).toBeUndefined();
    // 两个位置同时够得着的时候，拿最近的那一个
    expect(postAt(level, 189, 560, 12)?.id).toBe('p2');
    expect(postAt(level, 183, 560, 12)?.id).toBe('p1');
    expect(postAt(level, 375, 300, 60)).toBeUndefined();
  });

  it('点在院门上没有', () => {
    expect(gateHit(level, level.exit.x, level.exit.y, 0)).toBe(true);
    expect(gateHit(level, level.exit.x + 76, level.exit.y, 0)).toBe(true);
    expect(gateHit(level, level.exit.x + 77, level.exit.y, 0)).toBe(false);
    expect(gateHit(level, level.exit.x + 100, level.exit.y, 44)).toBe(true);
  });

  it('三个到六个位置 / 替身都合法；两个、七个、重名都不许', () => {
    const post = (id: string, kind: string): { id: string; x: number; y: number; radius: number; kind: string } =>
      ({ id, x: 100, y: 560, radius: 60, kind });
    const spare = post;
    expect(() =>
      SwapLevelSchema.parse({ ...level, posts: [post('a', 'drum'), post('b', 'flag')], spares: [spare('s', 'drum'), spare('t', 'flag')] }),
    ).toThrow();
    expect(() =>
      SwapLevelSchema.parse({
        ...level,
        posts: [post('a', 'drum'), post('b', 'flag'), post('c', 'torch'), post('d', 'spear'), post('e', 'horn'), post('f', 'drum'), post('g', 'flag')],
      }),
    ).toThrow();
    expect(() => SwapLevelSchema.parse({ ...level, posts: [post('a', 'drum'), post('b', 'flag'), post('a', 'torch')] })).toThrow();
    expect(() => SwapLevelSchema.parse({ ...level, spares: [spare('s', 'drum'), spare('s', 'flag'), spare('t', 'torch')] })).toThrow();
    // 六个位置（schema 的上限）也合法
    expect(
      SwapLevelSchema.parse({
        ...level,
        posts: [post('a', 'drum'), post('b', 'flag'), post('c', 'torch'), post('d', 'spear'), post('e', 'horn'), post('f', 'drum')],
        spares: [spare('s1', 'drum'), spare('s2', 'flag'), spare('s3', 'torch'), spare('s4', 'spear'), spare('s5', 'horn'), spare('s6', 'drum')],
      }).posts,
    ).toHaveLength(6);
  });

  it('有位置找不到同 kind 的替身 —— schema 当场拒掉（这一关不可能全换好）', () => {
    expect(() =>
      SwapLevelSchema.parse({
        ...level,
        spares: [
          { id: 's1', x: 120, y: 1010, radius: 62, kind: 'flag' },
          { id: 's2', x: 255, y: 1010, radius: 62, kind: 'horn' },
          { id: 's3', x: 375, y: 1010, radius: 62, kind: 'drum' },
          { id: 's4', x: 495, y: 1010, radius: 62, kind: 'spear' },
          { id: 's5', x: 630, y: 1010, radius: 62, kind: 'spear' }, // 少了火把
        ],
      }),
    ).toThrow();
  });

  it('peekMs 必须是正的；提示语不许太长', () => {
    expect(() => SwapLevelSchema.parse({ ...level, peekMs: 0 })).toThrow();
    expect(() => SwapLevelSchema.parse({ ...level, peekMs: -100 })).toThrow();
    expect(() => SwapLevelSchema.parse({ ...level, hint: '太长的提示语'.repeat(6) })).toThrow();
  });
});

/* ---------------- swap 扩展：beam（第 25 计 · 偷梁换柱） ---------------- */

/** 第 25 计 · 偷梁换柱：大殿四根承重柱（龙 / 云 / 水 / 火纹），料堆里四根新柱 */
const beamLevel = SwapBeamSchema.parse({
  mode: 'beam',
  posts: [
    { id: 'b1', x: 96, y: 620, radius: 78, kind: 'dragon' },
    { id: 'b2', x: 282, y: 620, radius: 78, kind: 'cloud' },
    { id: 'b3', x: 468, y: 620, radius: 78, kind: 'wave' },
    { id: 'b4', x: 654, y: 620, radius: 78, kind: 'flame' },
  ],
  spares: [
    { id: 'n1', x: 96, y: 1010, radius: 78, kind: 'dragon' },
    { id: 'n2', x: 282, y: 1010, radius: 78, kind: 'cloud' },
    { id: 'n3', x: 468, y: 1010, radius: 78, kind: 'wave' },
    { id: 'n4', x: 654, y: 1010, radius: 78, kind: 'flame' },
  ],
  workMs: 1400,
  checkMs: 4200,
  hint: '按住不放，趁清点前换好一根',
});

/** 一帧多长：与场景里 Phaser 的 delta 同一个数量级 */
const FRAME_MS = 16;

/** 按住一根干 toMs 毫秒（照真实操作：手指按下去按住不放） */
function hold(
  state: SwapBeamState,
  postId: string,
  ms: number,
  fromMs = 0,
): { state: SwapBeamState; at: number } {
  let next = startWork(state, postId, fromMs);
  let at = fromMs;
  let left = ms;
  while (left > 0) {
    const dt = Math.min(FRAME_MS, left);
    next = tickWork(beamLevel, next, at, dt, true);
    at += dt;
    left -= dt;
  }
  return { state: next, at };
}

/** 按住一根干到好（与场景同一条路：一帧一帧推进） */
function workThrough(
  state: SwapBeamState,
  postId: string,
  fromMs = 0,
): { state: SwapBeamState; at: number } {
  let next = startWork(state, postId, fromMs);
  let at = fromMs;
  for (let i = 0; i < 400 && !isPostRebuilt(next, postId); i += 1) {
    next = tickWork(beamLevel, next, at, FRAME_MS, true);
    at += FRAME_MS;
  }
  return { state: next, at };
}

describe('偷梁换柱：按住才干得完', () => {
  it('按住够 workMs 才算换好；差一毫秒都不算（按住不足不算换好）', () => {
    const start = beamStart(beamLevel);
    expect(rebuiltCount(start)).toBe(0);
    expect(workRatio(beamLevel, start)).toBe(0);
    expect(workLeftMs(beamLevel, start, 'b1')).toBe(beamLevel.workMs);

    const pressed = startWork(start, 'b1', 0);
    expect(workingPostId(pressed)).toBe('b1');
    expect(isPostRebuilt(pressed, 'b1')).toBe(false);

    // 按住 1399ms：还差 1ms，就是没换好
    const almost = tickWork(beamLevel, pressed, 0, beamLevel.workMs - 1, true);
    expect(workingMs(almost)).toBe(beamLevel.workMs - 1);
    expect(isPostRebuilt(almost, 'b1')).toBe(false);
    expect(workLeftMs(beamLevel, almost, 'b1')).toBe(1);
    expect(workRatio(beamLevel, almost)).toBeCloseTo(1399 / 1400, 6);

    // 再按 1ms：这一根换好了，料堆里那根同 kind 的新柱也搬过去了
    const done = tickWork(beamLevel, almost, beamLevel.workMs, 1, true);
    expect(isPostRebuilt(done, 'b1')).toBe(true);
    expect(rebuiltCount(done)).toBe(1);
    expect(done.rebuilt).toEqual(['b1']);
    expect(done.covers['b1']).toBe('n1');
    expect(workingPostId(done)).toBeNull();
    expect(workLeftMs(beamLevel, done, 'b1')).toBe(0);
    expect(isBeamDone(beamLevel, done)).toBe(false);
  });

  it('松手只是停下来：进度留着，再按住接着干 —— 零惩罚', () => {
    const pressed = startWork(beamStart(beamLevel), 'b1', 0);
    const held = tickWork(beamLevel, pressed, 0, 700, true);
    expect(workingMs(held)).toBe(700);
    // 松手：原样返回，进度一点不动
    expect(tickWork(beamLevel, held, 800, 320, false)).toBe(held);
    // 再按住：从 700 接着干
    const again = startWork(held, 'b1', 900);
    expect(again).toBe(held); // 同一根：连状态都不换
    const more = tickWork(beamLevel, again, 900, beamLevel.workMs - 700, true);
    expect(isPostRebuilt(more, 'b1')).toBe(true);
    expect(more.seen).toBe(0);
  });

  it('一次只干一根：改去拆另一根，前一根攒的进度就没了', () => {
    const held = tickWork(beamLevel, startWork(beamStart(beamLevel), 'b1', 0), 0, 900, true);
    expect(workingMs(held)).toBe(900);
    const switched = startWork(held, 'b2', 1000);
    expect(workingPostId(switched)).toBe('b2');
    expect(workingMs(switched)).toBe(0);
    // b1 上攒的那 900ms 不算数了：从零开始
    expect(workLeftMs(beamLevel, switched, 'b1')).toBe(beamLevel.workMs);
    expect(isPostRebuilt(switched, 'b2')).toBe(false);
  });

  it('点选：圆心与边缘都算，最近的那一根优先', () => {
    expect(beamPostAt(beamLevel, 96, 620, 0)?.id).toBe('b1');
    expect(beamPostAt(beamLevel, 96 + 78, 620, 0)?.id).toBe('b1');
    expect(beamPostAt(beamLevel, 96 + 79, 620, 0)).toBeUndefined();
    expect(beamPostAt(beamLevel, 96, 620 + 100, 44)?.id).toBe('b1'); // 手指粗一点也点得到
    // 两根之间的中间那条线上，拿最近的那一根
    expect(beamPostAt(beamLevel, 190, 620, 44)?.id).toBe('b2');
    expect(beamPostAt(beamLevel, 188, 620, 44)?.id).toBe('b1');
    expect(beamPostAt(beamLevel, 375, 240, 60)).toBeUndefined();
    expect(beamPostById(beamLevel, 'ghost')).toBeUndefined();
    expect(beamPostById(beamLevel, 'b3')?.kind).toBe('wave');
    // 料堆里的新柱：同 kind 的那一根（搬走了就不会再给第二根柱子）
    expect(beamSpareFor(beamLevel, beamStart(beamLevel), 'b3')?.id).toBe('n3');
  });
});

describe('偷梁换柱：清点打断未完成的那根（零惩罚）', () => {
  it('还没到点：原样返回（连状态对象都不换）', () => {
    const state = startWork(beamStart(beamLevel), 'b1', 0);
    expect(check(beamLevel, state, 0)).toBe(state);
    expect(check(beamLevel, state, beamLevel.checkMs - 1)).toBe(state);
    expect(nextCheckInMs(beamLevel, state, 0)).toBe(beamLevel.checkMs);
    expect(checkCount(beamLevel, state)).toBe(0);
  });

  it('到点清点：正拆着的那根进度清零、记一次 seen，但不结束（零惩罚）', () => {
    const held = tickWork(beamLevel, startWork(beamStart(beamLevel), 'b1', 0), 0, 900, true);
    expect(workingMs(held)).toBe(900);

    const caught = check(beamLevel, held, beamLevel.checkMs);
    expect(caught.seen).toBe(1);
    expect(beamSeenCount(caught)).toBe(1);
    expect(caught.lastSeenPost).toBe('b1');
    expect(caught.lastSeenAtMs).toBe(beamLevel.checkMs);
    // 进度清零：这一根要重新按住干满 workMs
    expect(workingPostId(caught)).toBe('b1');
    expect(workingMs(caught)).toBe(0);
    expect(workLeftMs(beamLevel, caught, 'b1')).toBe(beamLevel.workMs);
    // 零惩罚：不结束、不扣星、也没把这一根锁死
    expect(isBeamDone(beamLevel, caught)).toBe(false);
    expect(rebuiltCount(caught)).toBe(0);
    expect(caught.nextCheckAt).toBe(beamLevel.checkMs * 2);
    expect(nextCheckInMs(beamLevel, caught, beamLevel.checkMs + 200)).toBe(beamLevel.checkMs - 200);

    // 手还按着：从头再来一遍照样换得完
    const { state } = workThrough(caught, 'b1', beamLevel.checkMs);
    expect(isPostRebuilt(state, 'b1')).toBe(true);
    expect(state.seen).toBe(1);
  });

  it('没在拆任何一根时清点：什么也没发现，清点的钟照走', () => {
    const quiet = check(beamLevel, beamStart(beamLevel), beamLevel.checkMs);
    expect(quiet.seen).toBe(0);
    expect(quiet.lastSeenPost).toBeNull();
    expect(quiet.nextCheckAt).toBe(beamLevel.checkMs * 2);
    expect(checkCount(beamLevel, quiet)).toBe(1);
    // 清点之后接着干，照样干得完
    const { state } = workThrough(quiet, 'b2', beamLevel.checkMs);
    expect(isPostRebuilt(state, 'b2')).toBe(true);
    expect(state.seen).toBe(0);
  });

  it('已经换好的柱子不受影响：清点一个字都不改它', () => {
    const first = workThrough(beamStart(beamLevel), 'b1');
    expect(isPostRebuilt(first.state, 'b1')).toBe(true);

    // 换好一根之后开始第二根，才换到一半就赶上清点
    const half = tickWork(
      beamLevel,
      startWork(first.state, 'b2', first.at),
      first.at,
      600,
      true,
    );
    const caught = check(beamLevel, half, beamLevel.checkMs);
    // 换好的那根：立着，料堆里那根新柱也还记在它名下
    expect(isPostRebuilt(caught, 'b1')).toBe(true);
    expect(caught.covers['b1']).toBe('n1');
    // n1 已经被 b1 用掉了：换好的柱子不再指着它，别的柱子也不会重复拿同一根
    expect(beamSpareFor(beamLevel, caught, 'b1')).toBeUndefined();
    expect(beamSpareFor(beamLevel, caught, 'b2')?.id).toBe('n2');
    // 正拆着的那根：只有它被清点打断，而且 seen 只记这一笔
    expect(caught.seen).toBe(1);
    expect(caught.lastSeenPost).toBe('b2');
    expect(workingMs(caught)).toBe(0);
    expect(rebuiltCount(caught)).toBe(1);
    // 抬头三次都是这样：换好的那一根一直好好的
    let again = caught;
    for (let i = 0; i < 3; i += 1) {
      again = check(beamLevel, again, again.nextCheckAt);
      expect(isPostRebuilt(again, 'b1')).toBe(true);
    }
    expect(rebuiltCount(again)).toBe(1);
  });

  it('被清点几次都还能继续：四根一根根换完，最后照样成', () => {
    let state = beamStart(beamLevel);
    let at = 0;
    // 第一次清点前只换好一根；后面每次都被打断一次
    for (const id of ['b1', 'b2', 'b3', 'b4']) {
      state = check(beamLevel, state, at);
      const half = hold(state, id, Math.floor(beamLevel.workMs / 2), at + 100);
      at = half.at + 100;
      state = check(beamLevel, half.state, beamLevel.checkMs * (state.seen + 1));
      const full = workThrough(state, id, at);
      state = full.state;
      at = full.at;
      expect(isPostRebuilt(state, id)).toBe(true);
    }
    expect(rebuiltCount(state)).toBe(4);
    expect(isBeamDone(beamLevel, state)).toBe(true);
    // 被打断了好几次，但一次也没"结束"、一次也没扣星 —— 复盘数据留着
    expect(state.seen).toBeGreaterThan(0);
    expect(beamSeenCount(state)).toBe(state.seen);
  });
});

describe('偷梁换柱：无头验证（与真实操作同一条路）', () => {
  it('一根接一根，赶在清点之前换完：四根都换好，最多被打断一次', () => {
    let state = beamStart(beamLevel);
    let at = 0;
    let nextPollAt = 0;
    const steps: string[] = [];
    while (!isBeamDone(beamLevel, state) && at < 20_000) {
      // 场景每一帧做的事：先推、再清点（清点只打断还没换好的）
      state = tickWork(beamLevel, state, at, FRAME_MS, workingPostId(state) !== null);
      state = check(beamLevel, state, at);
      // 无头验证每隔 autoplayStepMs 看一次"该按哪一根"（走的是同一条 startWork）
      if (at >= nextPollAt) {
        nextPollAt = at + BEAM_TIMING.autoplayStepMs;
        const post = nextPostToWork(beamLevel, state);
        if (post !== undefined && workingPostId(state) !== post.id) {
          state = startWork(state, post.id, at);
          steps.push(post.id);
        }
      }
      at += FRAME_MS;
    }
    expect(steps).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(isBeamDone(beamLevel, state)).toBe(true);
    expect(rebuiltCount(state)).toBe(4);
    expect(rebuiltRatio(beamLevel, state)).toBe(1);
    // workMs（1400）比 checkMs（4200）短得多：最多被打断一次，照样做得完
    expect(state.seen).toBeLessThanOrEqual(1);
    // 一局走完 + 收尾的停顿，远在 e2e 的等待之内
    expect(at + BEAM_TIMING.finaleHoldMs).toBeLessThan(30_000);
  });

  it('时间常量：无头验证看得够勤，一步也看得清', () => {
    // 每一步都要比"换一根"勤，不然换完一根会干等半天才有人来按下一根
    expect(BEAM_TIMING.autoplayStepMs).toBeLessThan(beamLevel.workMs);
    expect(BEAM_TIMING.standMs).toBeGreaterThan(0);
    expect(BEAM_TIMING.sweepMs).toBeGreaterThan(0);
    expect(BEAM_TIMING.finaleHoldMs).toBeGreaterThan(0);
    // schema 守的那一条：换一根一定短于两次清点之间
    expect(beamLevel.workMs).toBeLessThan(beamLevel.checkMs);
  });
});

describe('偷梁换柱：schema 与边界', () => {
  it('workMs 必须比 checkMs 短 —— 不然永远换不完（schema 当场拒掉）', () => {
    expect(() => SwapBeamSchema.parse({ ...beamLevel, workMs: beamLevel.checkMs })).toThrow();
    expect(() => SwapBeamSchema.parse({ ...beamLevel, workMs: 5000 })).toThrow();
    expect(() => SwapBeamSchema.parse({ ...beamLevel, workMs: 0 })).toThrow();
    expect(() => SwapBeamSchema.parse({ ...beamLevel, checkMs: 0 })).toThrow();
  });

  it('有柱子找不到同 kind 的新柱 —— schema 当场拒掉（这一关不可能全换好）', () => {
    expect(() =>
      SwapBeamSchema.parse({
        ...beamLevel,
        spares: [
          { id: 'n1', x: 96, y: 1010, radius: 78, kind: 'dragon' },
          { id: 'n2', x: 282, y: 1010, radius: 78, kind: 'cloud' },
          { id: 'n3', x: 468, y: 1010, radius: 78, kind: 'wave' },
          { id: 'n4', x: 654, y: 1010, radius: 78, kind: 'cloud' }, // 少了火纹那一根
        ],
      }),
    ).toThrow();
  });

  it('三到六根柱子都合法；两根、七根、重名都不许', () => {
    const post = (id: string, kind: string): { id: string; x: number; y: number; radius: number; kind: string } =>
      ({ id, x: 100, y: 620, radius: 70, kind });
    const spare = post;
    expect(() =>
      SwapBeamSchema.parse({
        ...beamLevel,
        posts: [post('a', 'dragon'), post('b', 'cloud')],
        spares: [spare('n1', 'dragon'), spare('n2', 'cloud')],
      }),
    ).toThrow();
    expect(() =>
      SwapBeamSchema.parse({
        ...beamLevel,
        posts: [
          post('a', 'dragon'), post('b', 'cloud'), post('c', 'wave'), post('d', 'flame'),
          post('e', 'dragon'), post('f', 'cloud'), post('g', 'wave'),
        ],
      }),
    ).toThrow();
    expect(() =>
      SwapBeamSchema.parse({
        ...beamLevel,
        posts: [post('a', 'dragon'), post('b', 'cloud'), post('a', 'wave')],
      }),
    ).toThrow();
    // 六根（schema 的上限）也合法
    expect(
      SwapBeamSchema.parse({
        ...beamLevel,
        posts: [
          post('a', 'dragon'), post('b', 'cloud'), post('c', 'wave'),
          post('d', 'flame'), post('e', 'dragon'), post('f', 'cloud'),
        ],
        spares: [
          spare('n1', 'dragon'), spare('n2', 'cloud'), spare('n3', 'wave'),
          spare('n4', 'flame'), spare('n5', 'dragon'), spare('n6', 'cloud'),
        ],
      }).posts,
    ).toHaveLength(6);
    expect(() => SwapBeamSchema.parse({ ...beamLevel, hint: '太长的提示语'.repeat(6) })).toThrow();
  });

  it('写错 id / 没按住就推 / 已经换好再按：都原样返回，什么都不算', () => {
    const fresh = beamStart(beamLevel);
    // 没有正拆着的那一根：每帧推也是原样返回
    expect(tickWork(beamLevel, fresh, 0, 320, true)).toBe(fresh);
    // 脚本里没有这一根：按住也推不动、也换不好
    const ghost = startWork(fresh, 'ghost', 0);
    expect(tickWork(beamLevel, ghost, 0, beamLevel.workMs, true)).toBe(ghost);
    expect(rebuiltCount(ghost)).toBe(0);
    expect(isBeamDone(beamLevel, ghost)).toBe(false);
    // 换好的那一根再按：原样返回（不必再动它）
    const { state } = workThrough(fresh, 'b1');
    expect(startWork(state, 'b1', 5000)).toBe(state);
    expect(tickWork(beamLevel, startWork(state, 'b1', 5000), 5000, 320, true)).toBe(
      startWork(state, 'b1', 5000),
    );
  });
});

