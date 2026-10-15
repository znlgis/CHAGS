import type { SwapLevel, SwapPost, SwapSpare } from './schemas';

/**
 * 替换（swap）的纯判定：把一排"还站在那儿的人"换成替身，**样子要对**；
 * 检查者每隔 peekMs 抬头看一次 —— 没换好的位置会被看见，要重新换。
 *
 * **不 import Phaser** —— 判定比画面重要得多，这些函数单测直接调。
 *
 * 三条刻意的设计：
 * - **零惩罚**：样子不对的替身根本放不上去（原样返回，只提示"样子不对"）；
 *   被检查者看见也**不结束、不扣星** —— 只是那个位置被戳穿、要重新换一遍。
 *   孩子可以放心地一个一个试过去。
 * - **"撤销换装"就是检查者抬头的全部代价**：抬头一看，凡是没有换好的位置，
 *   它身上那份换装被撤销（本来就没换好的，撤销之后还是"没换好"，但账要记：
 *   它被看见了一次，要重新换）。**已经换好的位置，检查一个字都不改** ——
 *   这正是"趁两次检查之间把该换的换完"这条手感的根。
 * - **一定要在两次检查之间换完**：下一次抬头的时刻明明白白写在账上
 *   （nextPeekAt / nextPeekInMs），全换好之后才走得掉（leave），
 *   走掉 + 全换好 = 脱壳成功（isShellDone）。
 */

/** 替换模板的时间常量（场景、单测、无头验证共用同一份） */
export const SWAP_TIMING = {
  /** 一个替身落到位置上：落位的那个动作演多久（要短于无头验证的步长） */
  placeMs: 280,
  /** 检查者抬头的那一下：探照灯从岗楼上扫过去（被戳穿的红圈在它之后亮起） */
  sweepMs: 1100,
  /** 被戳穿之后，那个位置上的红圈亮多久 —— 不是惩罚，只是"这里被看见了" */
  caughtMs: 1400,
  /**
   * 无头验证：隔多久走一步（拿起一个替身、放下它，各算一步）。
   * 一步要比一次落位（placeMs）长 —— 画面把上一步演完再走下一步；
   * 五个位置一共十步，必须赶在一次 peekMs（5200ms）之前换完，
   * 所以这个步长要远小于它 —— 单测里有一条专门守这件事（见 swap.logic.test.ts）。
   */
  autoplayStepMs: 320,
  /** 无头验证：全换好之后，走到院门那一步 */
  autoplayLeaveMs: 900,
  /** 开局过一会儿就把小手放到该动的地方（不让孩子干等） */
  introHandMs: 650,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 脱壳成功之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/**
 * 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚。
 */
export interface SwapState {
  /** postId → spareId：此刻站在那个位置上的替身（没换好的位置不在里面） */
  covers: Record<string, string>;
  /** 被检查者看见过、还没重新换好的位置（按被看见的先后） */
  caught: string[];
  /** 被看见了几次 —— 复盘用，不扣星、不结束 */
  seen: number;
  /** 下一次抬头的时刻（毫秒，从这一局开始算起） */
  nextPeekAt: number;
  /** 已经走掉了没有（从院门走掉的那一步） */
  left: boolean;
  /** 走掉的时刻；还没走就是 -1 */
  leftAtMs: number;
}

function clampMs(t: number): number {
  return Number.isNaN(t) ? 0 : Math.max(0, t);
}

/** 开一局：一个人都没换，检查者还有 peekMs 才抬头 */
export function swapStart(level: SwapLevel): SwapState {
  return { covers: {}, caught: [], seen: 0, nextPeekAt: level.peekMs, left: false, leftAtMs: -1 };
}

// ---------------- 找东西 ----------------

/** 这是哪一个位置（脚本里写了不存在的 id 就给 undefined，不抛） */
export function postById(level: SwapLevel, postId: string): SwapPost | undefined {
  return level.posts.find((post) => post.id === postId);
}

/** 这是哪一个替身（同上） */
export function spareById(level: SwapLevel, spareId: string): SwapSpare | undefined {
  return level.spares.find((spare) => spare.id === spareId);
}

/** 手指落在哪一个位置上（拿最近的那一个）；forgive 让手指粗一点也点得到 */
export function postAt(level: SwapLevel, x: number, y: number, forgive = 0): SwapPost | undefined {
  let best: SwapPost | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const post of level.posts) {
    const dist = Math.hypot(x - post.x, y - post.y);
    if (dist <= post.radius + forgive && dist < bestDist) {
      best = post;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指落在哪一个替身上（替身躺在下面的草堆里） */
export function spareAt(level: SwapLevel, x: number, y: number, forgive = 0): SwapSpare | undefined {
  let best: SwapSpare | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const spare of level.spares) {
    const dist = Math.hypot(x - spare.x, y - spare.y);
    if (dist <= spare.radius + forgive && dist < bestDist) {
      best = spare;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指点在院门上没有（全换好之后从这里走掉） */
export function gateHit(level: SwapLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.exit.x, y - level.exit.y) <= level.exit.radius + forgive;
}

// ---------------- 换装 ----------------

/** 这个位置换好了没有 */
export function isPostSwapped(state: SwapState, postId: string): boolean {
  return state.covers[postId] !== undefined;
}

/** 站在这个位置上的是哪一个替身；还没换好就是 undefined */
export function spareOf(state: SwapState, postId: string): string | undefined {
  return state.covers[postId];
}

/** 这个替身此刻站在哪个位置上；还躺在草堆里就是 undefined（一个替身不能同时站两处） */
export function spareStandingAt(state: SwapState, spareId: string): string | undefined {
  for (const [postId, covered] of Object.entries(state.covers)) {
    if (covered === spareId) return postId;
  }
  return undefined;
}

/** 还躺在草堆里、可以拿去用的替身（按脚本顺序） */
export function usableSpares(level: SwapLevel, state: SwapState): SwapSpare[] {
  return level.spares.filter((spare) => spareStandingAt(state, spare.id) === undefined);
}

/**
 * 这个替身能不能放到这个位置上：位置与替身都得存在、**样子（kind）要对**、
 * 而且这个替身此刻不能正站在别处（稻草人只有一个身子）。
 */
export function canPlace(
  level: SwapLevel,
  state: SwapState,
  postId: string,
  spareId: string,
): boolean {
  const post = postById(level, postId);
  const spare = spareById(level, spareId);
  if (post === undefined || spare === undefined) return false;
  if (post.kind !== spare.kind) return false;
  const standing = spareStandingAt(state, spare.id);
  return standing === undefined || standing === post.id;
}

/**
 * 把一个替身放到位置上。
 *
 * - 样子不对 / 位置或替身不存在 / 这个替身正站在别处 → **原样返回**：
 *   场景据此只提示一句"样子不对"，不扣星、不结束（零惩罚）。
 * - 放对了就换好；这个位置如果原本站着另一个替身，那一个就回草堆里去（换错了可以改）。
 * - 被戳穿过的位置一旦换好，就不再算"戳穿"了 —— 它重新换好了。
 */
export function placeSpare(
  level: SwapLevel,
  state: SwapState,
  postId: string,
  spareId: string,
): SwapState {
  // 已经走掉的一局不再改账：壳已经脱了，谁也不再回头换装
  if (state.left || !canPlace(level, state, postId, spareId)) return state;
  const covers: Record<string, string> = { ...state.covers, [postId]: spareId };
  // 原来的那个替身回草堆：它不再站在任何位置上
  for (const [otherId, covered] of Object.entries(covers)) {
    if (otherId !== postId && covered === spareId) delete covers[otherId];
  }
  return {
    ...state,
    covers,
    caught: state.caught.filter((id) => id !== postId),
  };
}

/** 换好了几个位置 */
export function swapCount(state: SwapState): number {
  return Object.keys(state.covers).length;
}

/** 还没换好的位置（按脚本顺序）—— 提示、无头验证与进度条都用它 */
export function unswappedPosts(level: SwapLevel, state: SwapState): SwapPost[] {
  return level.posts.filter((post) => !isPostSwapped(state, post.id));
}

/** 被戳穿、还没重新换好的位置（按被看见的先后） */
export function caughtPosts(level: SwapLevel, state: SwapState): SwapPost[] {
  return state.caught
    .map((id) => postById(level, id))
    .filter((post): post is SwapPost => post !== undefined);
}

/** 被看见了几次 —— 只是复盘用，不扣星 */
export function seenCount(state: SwapState): number {
  return state.seen;
}

/** 全换好了没有（一个位置都不许漏 —— 漏一个就等于没走成） */
export function isAllSwapped(level: SwapLevel, state: SwapState): boolean {
  return level.posts.every((post) => isPostSwapped(state, post.id));
}

/**
 * 该先换哪一个：**先补被看见过、最久没换的那个**，再按脚本顺序补剩下的。
 * 被戳穿的位置是检查者已经知道的地方 —— 当然先补它。
 */
export function swapOrder(level: SwapLevel, state: SwapState): SwapPost[] {
  const caught = caughtPosts(level, state).filter((post) => !isPostSwapped(state, post.id));
  const rest = level.posts.filter(
    (post) => !isPostSwapped(state, post.id) && !caught.some((item) => item.id === post.id),
  );
  return [...caught, ...rest];
}

/** 下一个该换的位置；全换好了就是 undefined */
export function nextPostToSwap(level: SwapLevel, state: SwapState): SwapPost | undefined {
  return swapOrder(level, state)[0];
}

/** 该拿哪一个替身去补这个位置：同 kind、而且还躺在草堆里的那一个 */
export function spareFor(
  level: SwapLevel,
  state: SwapState,
  post: SwapPost,
): SwapSpare | undefined {
  return level.spares.find(
    (spare) => spare.kind === post.kind && spareStandingAt(state, spare.id) === undefined,
  );
}

/** 无头验证与小手共用的"下一步"：该换哪个位置、拿哪个替身 */
export interface SwapStep {
  post: SwapPost;
  spare: SwapSpare;
}

export function nextSwapStep(level: SwapLevel, state: SwapState): SwapStep | undefined {
  if (state.left) return undefined;
  const post = nextPostToSwap(level, state);
  if (post === undefined) return undefined;
  const spare = spareFor(level, state, post);
  return spare === undefined ? undefined : { post, spare };
}

// ---------------- 检查者抬头 ----------------

/** 距离下一次抬头还有多久（画面把这一刻度画出来；0 = 就是现在） */
export function nextPeekInMs(level: SwapLevel, state: SwapState, t: number): number {
  void level;
  return Math.max(0, state.nextPeekAt - clampMs(t));
}

/** 已经抬头看过几次 */
export function peekCount(level: SwapLevel, state: SwapState): number {
  if (level.peekMs <= 0) return 0;
  return Math.max(0, Math.round((state.nextPeekAt - level.peekMs) / level.peekMs));
}

/**
 * 检查者抬头看一次 —— 这是这一关唯一"有代价"的地方。
 *
 * 到点了（t ≥ nextPeekAt）就抬头看一眼：**没有换好的位置会被看见**。
 * 被看见的位置就被戳穿：它身上那份换装被撤销（本来就没换好的，撤销之后还是"没换好"，
 * 但账要记 —— 它要重新换一遍），seen 加一。**已经换好的位置，检查一个字都不改。**
 * 没到点就是原样返回（连状态对象都不换）。
 *
 * 抬头看完，下一次抬头的时刻往后推一个 peekMs。走掉之后不会再有人看（这一局已经成了）。
 */
export function peek(level: SwapLevel, state: SwapState, t: number): SwapState {
  const ms = clampMs(t);
  if (state.left || ms < state.nextPeekAt) return state;
  const covers: Record<string, string> = { ...state.covers };
  const caught = [...state.caught];
  let seen = state.seen;
  for (const post of level.posts) {
    if (covers[post.id] !== undefined) continue; // 已经换好的：检查不影响它
    delete covers[post.id]; // 撤销换装（被戳穿）
    seen += 1;
    if (!caught.includes(post.id)) caught.push(post.id);
  }
  return { ...state, covers, caught, seen, nextPeekAt: ms + level.peekMs };
}

// ---------------- 走掉 ----------------

/**
 * 从院门走掉：**全换好了才走得成**。
 * 还没换完就点了：原样返回（场景只提示一句"还有人没换下来"，零惩罚）。
 */
export function leave(level: SwapLevel, state: SwapState, t: number): SwapState {
  if (state.left || !isAllSwapped(level, state)) return state;
  return { ...state, left: true, leftAtMs: clampMs(t) };
}

/** 走掉了没有 */
export function hasLeft(state: SwapState): boolean {
  return state.left;
}

/** 走掉的时刻；还没走就是 -1 */
export function leftAtMs(state: SwapState): number {
  return state.leftAtMs;
}

/** 全换好 + 已经走掉 = 脱壳成功 */
export function isShellDone(level: SwapLevel, state: SwapState): boolean {
  return hasLeft(state) && isAllSwapped(level, state);
}
