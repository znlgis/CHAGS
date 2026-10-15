// beam（偷梁换柱）：老模式的三个类型一个字没改，只是这一行多了一个新模式的名字
import type { SwapBeamLevel, SwapLevel, SwapPost, SwapSpare } from './schemas';

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

/* ---------------- swap 扩展：beam（第 25 计 · 偷梁换柱） ---------------- */

/**
 * 偷梁换柱：一排**承重柱**要换成新柱，外形要一模一样。
 *
 * 与 shell（金蝉脱壳）的差别只有两条，手感却完全不同：
 * - **换一根要按住干一会儿**（workMs）：`startWork` 按下、`tickWork` 每帧往前推；
 *   松手只是停下来（进度留着），**不算失败**；
 * - **检查者每隔 checkMs 清点一次**：清点时**正拆着的那根**会被他看个正着 ——
 *   那根的进度清零、记一次 seen，**不结束、不扣星**（零惩罚）。
 *
 * 三条刻意的设计：
 * - **一次只干一根**：进度只跟着"正拆着的那根"走 —— 换一根的同时，别的柱子不会偷偷攒进度。
 *   这正是"赶在下一次清点之前把它换好"这条手感的根（workMs < checkMs 是 schema 守的）。
 * - **零惩罚**：被清点抓个正着、按住不足、点空处，都只是"这一根白干了"或"什么都没发生"；
 *   不结束、不扣星、不锁操作，接着按就是。
 * - **判定不看料堆**：料堆里的新柱（spares）只负责画面（这一根是给哪根柱子准备的），
 *   `isPostRebuilt` 只认进度 —— schema 只保证"每根柱子都找得到同 kind 的新柱"，
 *   那句话不能拿来当判定用（两根柱子同 kind、却只有一根新柱时，判定照样走得完）。
 */

/** 偷梁换柱的时间常量（场景、单测、无头验证共用同一份） */
export const BEAM_TIMING = {
  /** 一局的开场：过一会儿就把小手放到第一根柱子上（不让孩子干等） */
  introHandMs: 650,
  /**
   * 无头验证：隔多久看一次"该按哪一根"。
   * 它**不是点击的节奏** —— 手指按下去之后由每一帧的 tickWork 推进，
   * 这个步长只决定"这一根换好了没有、该不该换下一根"多久看一遍。
   */
  autoplayStepMs: 260,
  /** 换好一根：新柱立起来的那一下（立完小手才挪到下一根） */
  standMs: 520,
  /** 清点：检查者从头走到尾的那一趟（被看见的红圈在它之后亮起） */
  sweepMs: 1100,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 全换好之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/**
 * 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚。
 */
export interface SwapBeamState {
  /** 已经换好的柱子（按换好的先后） */
  rebuilt: string[];
  /** postId → spareId：这根柱子上立的是料堆里的哪一根新柱（找不着同 kind 的就不记） */
  covers: Record<string, string>;
  /** 正拆着的那一根 / 已经按住多久 / 什么时候按下去的（毫秒）；没在拆就是 null */
  working: { postId: string; ms: number; sinceMs: number } | null;
  /** 被清点看见过几次 —— 复盘用，不扣星、不结束 */
  seen: number;
  /** 下一次清点的时刻（毫秒，从这一局开始算起） */
  nextCheckAt: number;
  /** 刚被清点打断的那一根；还没被打断过就是 null */
  lastSeenPost: string | null;
  /** 刚被清点打断的那一刻；还没被打断过就是 -1 */
  lastSeenAtMs: number;
  /** 刚换好的那一根 / 什么时候换好的（画面演"立起来"的那一下） */
  lastRebuiltPost: string | null;
  lastRebuiltAtMs: number;
}

/** 开一局：一根都没换，检查者还有 checkMs 才来清点 */
export function beamStart(level: SwapBeamLevel): SwapBeamState {
  return {
    rebuilt: [],
    covers: {},
    working: null,
    seen: 0,
    nextCheckAt: level.checkMs,
    lastSeenPost: null,
    lastSeenAtMs: -1,
    lastRebuiltPost: null,
    lastRebuiltAtMs: -1,
  };
}

/** 这是哪一根柱子（脚本里写了不存在的 id 就给 undefined，不抛） */
export function beamPostById(level: SwapBeamLevel, postId: string): SwapPost | undefined {
  return level.posts.find((post) => post.id === postId);
}

/** 手指落在哪一根柱子上（拿最近的那一根）；forgive 让手指粗一点也点得到 */
export function beamPostAt(
  level: SwapBeamLevel,
  x: number,
  y: number,
  forgive = 0,
): SwapPost | undefined {
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

/** 这一根换好了没有 */
export function isPostRebuilt(state: SwapBeamState, postId: string): boolean {
  return state.rebuilt.includes(postId);
}

/** 换好了几根 */
export function rebuiltCount(state: SwapBeamState): number {
  return state.rebuilt.length;
}

/**
 * 这根柱子该用料堆里的哪一根新柱：同 kind、而且还没被别的柱子用掉。
 * **只给画面用**（搬过去一根、料堆里就少一根）—— 判定不看它。
 */
export function beamSpareFor(
  level: SwapBeamLevel,
  state: SwapBeamState,
  postId: string,
): SwapSpare | undefined {
  const post = beamPostById(level, postId);
  if (post === undefined) return undefined;
  const used = new Set(Object.values(state.covers));
  return level.spares.find((spare) => spare.kind === post.kind && !used.has(spare.id));
}

/** 正拆着的是哪一根；没在拆就是 null */
export function workingPostId(state: SwapBeamState): string | null {
  return state.working === null ? null : state.working.postId;
}

/** 正拆着的那一根按住了多久（毫秒）；没在拆就是 0 */
export function workingMs(state: SwapBeamState): number {
  return state.working === null ? 0 : state.working.ms;
}

/**
 * 这一根还差多久才换好：换好了是 0；没在拆它就是完整的一根（workMs）。
 * 画面据此画那圈进度。
 */
export function workLeftMs(
  level: SwapBeamLevel,
  state: SwapBeamState,
  postId: string,
): number {
  if (isPostRebuilt(state, postId)) return 0;
  if (state.working === null || state.working.postId !== postId) return level.workMs;
  return Math.max(0, level.workMs - state.working.ms);
}

/** 正拆着的那一根干到几分了（0..1）；没在拆就是 0 */
export function workRatio(level: SwapBeamLevel, state: SwapBeamState): number {
  if (state.working === null) return 0;
  return Math.min(1, state.working.ms / level.workMs);
}

/** 换好了几成（0..1）—— 进度槽用它 */
export function rebuiltRatio(level: SwapBeamLevel, state: SwapBeamState): number {
  return level.posts.length === 0 ? 1 : state.rebuilt.length / level.posts.length;
}

/**
 * 按住一根柱子（手指落下去的那一下）：
 * - 已经换好的那一根：原样返回（换好了就不必再动它）。
 * - 正拆着的就是这一根：原样返回 —— **松手再按不算白干**，进度留着接着干。
 * - 改去拆另一根：那一根从头开始（一次只干一根，这就是"赶在两次清点之间"的分量）。
 * - 脚本里没有这一根：**这里也照记**（没有关卡可查）——
 *   `tickWork` 每一帧都要在关卡里找它，找不着就什么都推不动（见下）。
 */
export function startWork(state: SwapBeamState, postId: string, t: number): SwapBeamState {
  if (isPostRebuilt(state, postId)) return state;
  if (state.working !== null && state.working.postId === postId) return state;
  return { ...state, working: { postId, ms: 0, sinceMs: clampMs(t) } };
}

/**
 * 每帧推一次：**按着**就往前走 dtMs，走进度条到 workMs，这一根就换好了。
 *
 * - **松手（holding = false）只是停下来**：进度留着，再按住接着干 —— 零惩罚。
 * - 推进到 workMs：这根柱子换好了（记进 rebuilt、料堆里少一根），手上就空了。
 * - 没有正拆着的、脚本里没有这一根、dtMs 不是正数：都原样返回，什么都不算。
 */
export function tickWork(
  level: SwapBeamLevel,
  state: SwapBeamState,
  t: number,
  dtMs: number,
  holding: boolean,
): SwapBeamState {
  const work = state.working;
  if (work === null) return state;
  const post = beamPostById(level, work.postId);
  if (post === undefined || isPostRebuilt(state, work.postId)) return state;
  if (!holding) return state; // 松手就停：进度留着，不清零
  const ms = work.ms + Math.max(0, dtMs);
  if (ms < level.workMs) return { ...state, working: { ...work, ms } };
  const spare = beamSpareFor(level, state, post.id);
  return {
    ...state,
    rebuilt: [...state.rebuilt, post.id],
    covers: spare === undefined ? state.covers : { ...state.covers, [post.id]: spare.id },
    working: null,
    lastRebuiltPost: post.id,
    lastRebuiltAtMs: clampMs(t),
  };
}

/** 全换好了没有（一根都不许漏） */
export function isBeamDone(level: SwapBeamLevel, state: SwapBeamState): boolean {
  return level.posts.every((post) => isPostRebuilt(state, post.id));
}

/**
 * 该干哪一根：**正拆着的那一根优先**（接着刚才那一下干完），
 * 否则按脚本顺序找第一根还没换好的。全换好了就没有下一根了。
 */
export function nextPostToWork(
  level: SwapBeamLevel,
  state: SwapBeamState,
): SwapPost | undefined {
  if (state.working !== null) {
    const working = beamPostById(level, state.working.postId);
    if (working !== undefined && !isPostRebuilt(state, state.working.postId)) return working;
  }
  return level.posts.find((post) => !isPostRebuilt(state, post.id));
}

/** 距离下一次清点还有多久（画面把这一刻度画出来；0 = 就是现在） */
export function nextCheckInMs(
  level: SwapBeamLevel,
  state: SwapBeamState,
  t: number,
): number {
  void level;
  return Math.max(0, state.nextCheckAt - clampMs(t));
}

/** 已经清点过几次 */
export function checkCount(level: SwapBeamLevel, state: SwapBeamState): number {
  if (level.checkMs <= 0) return 0;
  return Math.max(0, Math.round((state.nextCheckAt - level.checkMs) / level.checkMs));
}

/**
 * 检查者清点一次 —— 这是这一关唯一"有代价"的地方，代价只是"这一根白干了"。
 *
 * 到点了（t ≥ nextCheckAt）就清点一遍：**正拆着的那根被他看个正着** ——
 * 那根的进度清零、seen 加一。**已经换好的柱子，清点一个字都不改**（换好了就是换好了）。
 * 没在拆任何一根时清点：什么也没发现（seen 不动），清点的钟照旧往后走一个 checkMs。
 * 没到点就是原样返回（连状态对象都不换）。
 */
export function check(level: SwapBeamLevel, state: SwapBeamState, t: number): SwapBeamState {
  const ms = clampMs(t);
  if (ms < state.nextCheckAt) return state;
  const work = state.working;
  if (work === null) return { ...state, nextCheckAt: ms + level.checkMs };
  return {
    ...state,
    // 清点打断的只是"手上这一根"：进度清零，手还按着的那根从头再来
    working: { ...work, ms: 0 },
    seen: state.seen + 1,
    lastSeenPost: work.postId,
    lastSeenAtMs: ms,
    nextCheckAt: ms + level.checkMs,
  };
}

/** 被清点看见过几次 —— 只是复盘用，不扣星 */
export function beamSeenCount(state: SwapBeamState): number {
  return state.seen;
}
