import type { ChainGate, ChainLevel, ChainStepLevel } from './schemas';

/**
 * 连环（chain）的纯判定：先谈成"借路"，再**按顺序**取下沿途关口，最后回师。
 *
 * **不 import Phaser** —— 判定比画面重要得多，这些函数单测直接调。
 *
 * 三条刻意的设计：
 * - **顺序不能跳**：没借到路，一个关口也拿不了；前一个关口没拿下，后一个动不了。
 *   这不是"禁止点击"，而是这一计本身的样子 —— 别人愿意借路，是因为你说只是路过；
 *   你一步一步走进去，别人才发现回不了头。
 * - **点错零惩罚**：点在后一个关口上、重复点已经拿下的、还没借路就点关口 ——
 *   都只是**原样返回**（场景把关卡自己的那句提示再亮一遍，并用小手指出该动的地方），
 *   不扣星、不结束、不锁操作。
 * - **回师是最后一步**：全部关口拿下之后才回得了自己的营地（returnHome）；
 *   借路 + 关口全拿下 + 回师 = 这一局成了（isPassDone）。
 */

/** 连环模板的时间常量（场景、单测、无头验证共用同一份） */
export const CHAIN_TIMING = {
  /** 谈成借路的那一下（使者点头）：画面按它演 */
  envoyMs: 900,
  /** 取下一处关口的一次演出 */
  gateMs: 900,
  /** 回师的那一段路 */
  homeMs: 1300,
  /** 无头验证：隔多久走一步（够画面把上一步演完） */
  autoplayStepMs: 900,
  /** 开局过一会儿就把小手放到该动的地方 */
  introHandMs: 650,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 成了之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚 */
export interface ChainState {
  /** 借到路了没有（使者谈成的那一步） */
  pass: boolean;
  /** 按顺序拿下的关口（id，按下手的先后） */
  taken: string[];
  /** 回到自己的营地了没有 */
  home: boolean;
  /** 借路谈成的时刻；还没谈成就是 -1 */
  passAtMs: number;
  /** 回师的时刻；还没回就是 -1 */
  homeAtMs: number;
}

function clampMs(t: number): number {
  return Number.isNaN(t) ? 0 : Math.max(0, t);
}

/** 开一局：路还没借着，一个关口也没拿下，人还在路上 */
export function chainStart(): ChainState {
  return { pass: false, taken: [], home: false, passAtMs: -1, homeAtMs: -1 };
}

// ---------------- 找东西 ----------------

/** 这是哪一处关口（脚本里写了不存在的 id 就给 undefined，不抛） */
export function gateById(level: ChainLevel, gateId: string): ChainGate | undefined {
  return level.gates.find((gate) => gate.id === gateId);
}

/** 手指落在哪一处关口上（拿最近的那一个）；forgive 让手指粗一点也点得到 */
export function gateAt(level: ChainLevel, x: number, y: number, forgive = 0): ChainGate | undefined {
  let best: ChainGate | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const gate of level.gates) {
    const dist = Math.hypot(x - gate.x, y - gate.y);
    if (dist <= gate.radius + forgive && dist < bestDist) {
      best = gate;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指点在谈借路的地方没有 */
export function envoyHit(level: ChainLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.envoy.x, y - level.envoy.y) <= level.envoy.radius + forgive;
}

/** 手指点在自己的营地（回师）上没有 */
export function homeHit(level: ChainLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.home.x, y - level.home.y) <= level.home.radius + forgive;
}

// ---------------- 借路 ----------------

/** 借到路了没有 */
export function hasPass(state: ChainState): boolean {
  return state.pass;
}

/**
 * 谈成借路（使者那一步）。
 * 已经谈成了就原样返回 —— 场景据此跳过重复的演出。
 */
export function askPass(state: ChainState, t: number): ChainState {
  if (state.pass) return state;
  return { ...state, pass: true, passAtMs: clampMs(t) };
}

// ---------------- 关口：只认"下一个" ----------------

/** 下一个该拿下的关口；全拿下了就是 undefined */
export function nextGate(level: ChainLevel, state: ChainState): ChainGate | undefined {
  return level.gates.find((gate) => !state.taken.includes(gate.id));
}

/** 这是不是"下一个"关口（不是下一个就动不了） */
export function isNextGate(level: ChainLevel, state: ChainState, gateId: string): boolean {
  return nextGate(level, state)?.id === gateId;
}

/** 还剩下几处关口没拿下 */
export function gatesLeft(level: ChainLevel, state: ChainState): number {
  return level.gates.filter((gate) => !state.taken.includes(gate.id)).length;
}

/** 这个关口拿下了没有 */
export function isGateTaken(state: ChainState, gateId: string): boolean {
  return state.taken.includes(gateId);
}

/**
 * 拿下一处关口：**只接受"下一个"**。
 *
 * - 还没借到路 → 原样返回（一个关口也拿不了：人家根本没答应让你过）；
 * - 不是下一个（跳着点 / 回头点已经拿下的 / 点了个不存在的）→ 原样返回；
 * - 正好是下一个 → 拿下，记进 taken。
 *
 * 三种情况都**不扣星、不结束**，只是没进展 —— 场景提示一句就是了。
 */
export function takeGate(level: ChainLevel, state: ChainState, gateId: string): ChainState {
  if (!state.pass) return state;
  if (!isNextGate(level, state, gateId)) return state;
  return { ...state, taken: [...state.taken, gateId] };
}

/** 拿下几处关口了 */
export function takenCount(state: ChainState): number {
  return state.taken.length;
}

/** 沿途关口全拿下了没有 */
export function isAllGatesTaken(level: ChainLevel, state: ChainState): boolean {
  return level.gates.every((gate) => state.taken.includes(gate.id));
}

// ---------------- 回师 ----------------

/**
 * 收兵回师：**全部关口拿下之后才回得去**。
 * 还没拿完就点了自家营地：原样返回（场景只提示一句"前面还有关口"，零惩罚）。
 */
export function returnHome(level: ChainLevel, state: ChainState, t: number): ChainState {
  if (state.home || !state.pass || !isAllGatesTaken(level, state)) return state;
  return { ...state, home: true, homeAtMs: clampMs(t) };
}

/** 回到自己的营地了没有 */
export function hasReturnedHome(state: ChainState): boolean {
  return state.home;
}

/** 借路 + 沿途关口全拿下 + 回师 = 这一局成了 */
export function isPassDone(level: ChainLevel, state: ChainState): boolean {
  return state.pass && state.home && isAllGatesTaken(level, state);
}

// ---------------- 无头验证与小手共用的"下一步" ----------------

/** 该动的地方：谈借路 / 拿下一处关口 / 回师 */
export type ChainStep =
  | { kind: 'envoy' }
  | { kind: 'gate'; gate: ChainGate }
  | { kind: 'home' };

/**
 * 下一步该干什么 —— 小手、提示与无头验证都用它（与孩子走的是同一条路）。
 * 顺序就是这一关的顺序：先借路，再一个一个关口，最后回师。
 */
export function chainStep(level: ChainLevel, state: ChainState): ChainStep | undefined {
  if (!state.pass) return { kind: 'envoy' };
  const gate = nextGate(level, state);
  if (gate !== undefined) return { kind: 'gate', gate };
  if (!state.home) return { kind: 'home' };
  return undefined;
}

/* ---------------- step：反客为主（第 30 计） ---------------- */

/**
 * 反客为主：每一步都要**先被允许**。
 *
 * 与 pass（假道伐虢）的差别在**门槛从哪儿来**：pass 的门槛是"顺序"（没借到路一个关口也拿不了），
 * step 的门槛是**一张会过期的允许** —— 点求允许的地方，允许只持续 grantMs；
 * 在有效期内点下一个岗位才接得下来，过期作废（重新求一次就是，零惩罚）。
 *
 * 三条刻意的设计：
 * - **先求，再接手**：手里没有有效允许时，点岗位原样返回 —— 不是禁止点击，
 *   而是"这一步本来就得先问过"。
 * - **允许是一次性的**：接管一个岗位，这次允许就用掉了；下一步要重新求。
 *   所以这一关的节奏是"一步一问"，急不得（第 30 计的落点）。
 * - **过期零惩罚**：允许过期只是没进展，不扣星、不结束、不锁操作；重新求一次就好。
 *   schema 里还卡了一道 grantMs ≥ 600 —— 允许太短就变成比手速了。
 */
export type ChainStepPost = ChainStepLevel['posts'][number];

/** step 模式的节拍（场景、单测、无头验证共用同一份） */
export const CHAIN_STEP_TIMING = {
  /** 求一次允许的那一下（递上名帖、对面点头）：画面按它演 */
  grantAskMs: 700,
  /** 接管一处岗位的演出 */
  takeoverMs: 900,
  /** 无头验证：隔多久走一步 —— 必须远小于关卡的 grantMs，不然还没接手就过期了 */
  autoplayStepMs: 700,
  /** 允许过期之后，过一会儿再把小手放回求允许的地方 */
  lapseHintMs: 900,
  /** 开局过一会儿就把小手放到该动的地方 */
  introHandMs: 650,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 成了之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 一局里攒下来的东西：接手的顺序、以及手里那张允许是**什么时候**求到的 */
export interface StepState {
  /** 按顺序接手的岗位（id，按下手的先后） */
  taken: string[];
  /** 求到允许的那一刻；没求过（或者已经用掉）就是 -1 */
  grantAtMs: number;
  /** 一共求了几次允许（复盘用，不惩罚） */
  asks: number;
}

/** 开一局：一个岗位也没接手，手里也没有允许 */
export function stepStart(): StepState {
  return { taken: [], grantAtMs: -1, asks: 0 };
}

/**
 * 求一次允许：允许从此刻起算，只持续关卡的 grantMs。
 * 已经求过、还没过期时再求一次 = 重新盖章（时间从新的一刻起算），零惩罚。
 */
export function askGrant(state: StepState, t: number): StepState {
  return { ...state, grantAtMs: clampMs(t), asks: state.asks + 1 };
}

/** 求过允许没有（用掉了、过期了也算求过） */
export function hasAsked(state: StepState): boolean {
  return state.grantAtMs >= 0;
}

/**
 * 这一次允许还剩多久；没求过、已经过期、已经用掉都是 0。
 * 时间往回走（单测里回看）时按"整张还完整"算 —— 不会冒出一个比 grantMs 还长的数。
 */
export function grantLeftMs(level: ChainStepLevel, state: StepState, t: number): number {
  if (state.grantAtMs < 0) return 0;
  const since = clampMs(t) - state.grantAtMs;
  if (since < 0) return level.grantMs;
  return Math.max(0, level.grantMs - since);
}

/** 此刻允许还有效吗 —— 过期就作废（重新求一次就是了，零惩罚） */
export function isGranted(level: ChainStepLevel, state: StepState, t: number): boolean {
  return grantLeftMs(level, state, t) > 0;
}

// ---------------- 找东西 ----------------

/** 这是哪一处岗位（脚本里写了不存在的 id 就给 undefined，不抛） */
export function postById(level: ChainStepLevel, postId: string): ChainStepPost | undefined {
  return level.posts.find((post) => post.id === postId);
}

/** 手指落在哪一处岗位上（拿最近的那一个）；forgive 让手指粗一点也点得到 */
export function postAt(
  level: ChainStepLevel,
  x: number,
  y: number,
  forgive = 0,
): ChainStepPost | undefined {
  let best: ChainStepPost | undefined;
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

/** 手指点在求允许的地方没有 */
export function grantHit(level: ChainStepLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.grant.x, y - level.grant.y) <= level.grant.radius + forgive;
}

// ---------------- 岗位：只认"下一个"，而且要有允许 ----------------

/** 下一个该接手的岗位；全接手了就是 undefined */
export function nextPost(level: ChainStepLevel, state: StepState): ChainStepPost | undefined {
  return level.posts.find((post) => !state.taken.includes(post.id));
}

/** 这是不是"下一个"岗位 */
export function isNextPost(level: ChainStepLevel, state: StepState, postId: string): boolean {
  return nextPost(level, state)?.id === postId;
}

/** 这一处岗位接手了没有 */
export function isPostTaken(state: StepState, postId: string): boolean {
  return state.taken.includes(postId);
}

/** 接手了几处岗位 */
export function takenPosts(state: StepState): number {
  return state.taken.length;
}

/** 还剩几处岗位没接手 */
export function postsLeft(level: ChainStepLevel, state: StepState): number {
  return level.posts.filter((post) => !state.taken.includes(post.id)).length;
}

/** 全部岗位都接手了没有 */
export function isAllPostsTaken(level: ChainStepLevel, state: StepState): boolean {
  return level.posts.every((post) => state.taken.includes(post.id));
}

/**
 * 接手一处岗位：**只认"下一个岗位 + 允许有效"**。
 *
 * - 没求允许 / 允许已经过期 → 原样返回（这一步还没被允许）；
 * - 不是下一个（跳着点 / 回头点已经接手的 / 点了个不存在的）→ 原样返回；
 * - 正好是下一个、而且允许有效 → 接手，这次允许就用掉了（下一步要重新求）。
 *
 * 三种情况都**不扣星、不结束**，只是没进展 —— 场景提示一句、把小手放回该动的地方。
 */
export function takeOver(
  level: ChainStepLevel,
  state: StepState,
  postId: string,
  t: number,
): StepState {
  if (!isGranted(level, state, t)) return state;
  if (!isNextPost(level, state, postId)) return state;
  return { ...state, taken: [...state.taken, postId], grantAtMs: -1 };
}

/** 全部岗位都接手了 = 成了主导 */
export function isStepDone(level: ChainStepLevel, state: StepState): boolean {
  return isAllPostsTaken(level, state);
}

// ---------------- 无头验证与小手共用的"下一步" ----------------

/** 该动的地方：求允许 / 接手一处岗位 */
export type StepMove = { kind: 'grant' } | { kind: 'post'; post: ChainStepPost };

/**
 * 下一步该干什么 —— 小手、提示与无头验证都用它（与孩子走的是同一条路）：
 * 手里没有有效允许（没求过 / 过期了 / 刚用掉）就先去求一次；
 * 有允许了，就去接手下一个岗位。
 */
export function nextStep(
  level: ChainStepLevel,
  state: StepState,
  t: number,
): StepMove | undefined {
  if (isStepDone(level, state)) return undefined;
  if (!isGranted(level, state, t)) return { kind: 'grant' };
  const post = nextPost(level, state);
  if (post === undefined) return undefined;
  return { kind: 'post', post };
}
