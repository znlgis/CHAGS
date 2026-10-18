// hint（指桑骂槐）：老模式的三个类型一个字没改，只是这一行多了一个新模式的名字
import type { ProbeFigure, ProbeHintLevel, ProbeLevel, ProbePatch } from './schemas';

/**
 * 试探（probe）的纯判定：拿一枝**没有杀伤**的试探，换来信息。
 *
 * 两个模式共用这一句话，账本各记各的：
 * - **knock（打草惊蛇）**：路上几丛草，一处一处敲过去。敲到有蛇的那一处，蛇窜出来，
 *   把 scareRadius 内的草丛（含自身）一起搅乱 —— **那里就不能走了**。
 *   敲过、确认没有蛇、又没被搅乱的那一处，才能走过去（canCross → cross）。
 * - **spot（擒贼擒王）**：一排一模一样的身影，拿蒿箭一个个试。射中不是王的，他退到一边
 *   （tried，少一个候选）；射中王的，就成了。
 *
 * 三条刻意的设计：
 * - **不结束**：敲了不能走的地方只是"没收获"；射错了人少一个候选（记进 mistakes）——
 *   不结束、不锁操作，接着试就是（场景把敲错 / 射错记进 mistakes）。
 * - **同一个只算一次**：同一丛敲两下、同一个身影射两箭，都不重复记账。
 * - **一定有解**：schema 保证至少有一处 clear 的草丛不在任何蛇的 scareRadius 里 ——
 *   它永远搅不乱，所以无论按什么顺序敲，最后都走得过（见 nextPatchToKnock）。
 *
 * **不 import Phaser**：判定比画面重要得多。
 */

/** 试探模板的时间常量（场景、单测、无头验证共用同一份） */
export const PROBE_TIMING = {
  /** 敲一下之后，画面把草浪演完的时长 —— 无头验证也隔这么久走下一步 */
  knockMs: 900,
  /** 敲到蛇之后，附近的草一起塌下去的那一段（红圈也涨到 scareRadius） */
  scareMs: 1400,
  /** 从确认安全的那一丛走到 exit 的一小段 */
  crossMs: 1100,
  /** 一箭飞过去要多久 */
  shotMs: 700,
  /** 射错的那一个退到一边 */
  stepAsideMs: 900,
  /** 无头验证：隔多久走一步（够画面把上一步演完） */
  autoplayStepMs: 900,
  /** 开局过一会儿就把小手放到该动的地方（不让孩子干等） */
  introHandMs: 650,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 打赢之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 只有 knock 的那一半关卡脚本（从联合类型里 Narrow 出来） */
export type KnockLevel = Extract<ProbeLevel, { mode: 'knock' }>;
/** 只有 spot 的那一半 */
export type SpotLevel = Extract<ProbeLevel, { mode: 'spot' }>;

/**
 * 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚。
 * knock 用前三个字段、spot 用后两个 —— 两个模式互不干扰，所以一份状态就够了。
 */
export interface ProbeState {
  /** knock：敲过的草丛（按敲的先后，重复的不记） */
  knocked: string[];
  /** knock：被蛇搅乱的草丛（蛇自己也在内）—— 这些地方不能走了 */
  spooked: string[];
  /** knock：走过去的那一处；还没走过去就是 null */
  crossed: string | null;
  /** spot：试过、不是王的那几个身影（他们退到了一边） */
  tried: string[];
  /** spot：反应最大的那一个 = 王；还没找到就是 null */
  king: string | null;
}

export function probeStart(): ProbeState {
  return { knocked: [], spooked: [], crossed: null, tried: [], king: null };
}

// ---------------- knock：打草惊蛇 ----------------

/** 这一丛是哪一丛（脚本里写了不存在的 id 就给 undefined，不抛） */
export function patchById(level: KnockLevel, patchId: string): ProbePatch | undefined {
  return level.patches.find((patch) => patch.id === patchId);
}

/** 这一丛里有蛇吗 —— 只有敲过之后才让孩子看见（"看起来一模一样"由画面守） */
export function hasSnake(level: KnockLevel, patchId: string): boolean {
  return patchById(level, patchId)?.has === 'snake';
}

/** 手指落在哪一丛草上（拿最近的那一丛）；forgive 让手指粗一点也点得到 */
export function probeAt(
  level: KnockLevel,
  x: number,
  y: number,
  forgive = 0,
): ProbePatch | undefined {
  let best: ProbePatch | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const patch of level.patches) {
    const dist = Math.hypot(x - patch.x, y - patch.y);
    if (dist <= patch.radius + forgive && dist < bestDist) {
      best = patch;
      bestDist = dist;
    }
  }
  return best;
}

export function isKnocked(state: ProbeState, patchId: string): boolean {
  return state.knocked.includes(patchId);
}

export function isSpooked(state: ProbeState, patchId: string): boolean {
  return state.spooked.includes(patchId);
}

/**
 * 敲一处：记下"敲过了"。
 * 敲到有蛇的那一处，蛇窜出来，把 scareRadius 内的草丛（含自身）一起搅乱 ——
 * **这就是"打草"的代价**，只是代价落在"那些地方不能走了"，而不是扣星。
 * 同一丛敲第二下什么也不会变（原样返回）。
 */
export function knock(level: KnockLevel, state: ProbeState, patchId: string): ProbeState {
  const patch = patchById(level, patchId);
  if (patch === undefined || isKnocked(state, patchId)) return state;
  const knocked = [...state.knocked, patch.id];
  if (patch.has !== 'snake') return { ...state, knocked };
  const spooked = [...state.spooked];
  for (const other of level.patches) {
    if (spooked.includes(other.id)) continue;
    if (Math.hypot(other.x - patch.x, other.y - patch.y) <= level.scareRadius) spooked.push(other.id);
  }
  return { ...state, knocked, spooked };
}

/** 这一丛能不能走过去：敲过、确认没有蛇、而且没被搅乱 */
export function canCross(level: KnockLevel, state: ProbeState, patchId: string): boolean {
  const patch = patchById(level, patchId);
  if (patch === undefined || patch.has !== 'clear') return false;
  return isKnocked(state, patchId) && !isSpooked(state, patchId);
}

/** 走过去：只有 canCross 的那一处走得成；走不了的原样返回（点了不能走的地方 = 无事发生） */
export function cross(level: KnockLevel, state: ProbeState, patchId: string): ProbeState {
  if (!canCross(level, state, patchId)) return state;
  return { ...state, crossed: patchId };
}

/** 走过去了 = 这一关过了 */
export function isKnockDone(state: ProbeState): boolean {
  return state.crossed !== null;
}

/** 此刻能走的草丛（可能不止一处 —— 不是"只能走这一个"） */
export function crossablePatches(level: KnockLevel, state: ProbeState): ProbePatch[] {
  return level.patches.filter((patch) => canCross(level, state, patch.id));
}

/**
 * 该按什么顺序敲：**从最外圈往里**。
 * 中间那几丛左右都有邻居，先敲它，万一有蛇就一次搅乱两边；从最外圈敲起，
 * 最坏也只是少掉一侧。距离一样时保持关卡脚本里的顺序（sort 是稳定的）。
 */
export function knockOrder(level: KnockLevel): ProbePatch[] {
  const count = level.patches.length;
  if (count === 0) return [];
  const cx = level.patches.reduce((sum, patch) => sum + patch.x, 0) / count;
  const cy = level.patches.reduce((sum, patch) => sum + patch.y, 0) / count;
  const outward = (patch: ProbePatch): number => Math.hypot(patch.x - cx, patch.y - cy);
  return [...level.patches].sort((a, b) => outward(b) - outward(a));
}

/**
 * 下一丛该敲哪儿（小手、提示与无头验证都用它）：还没敲过、也没被搅乱的里面，最外圈的那一丛。
 * 都敲过 / 都被搅乱了才兜底返回还没敲过的那一丛 —— schema 保证不会无解，但绝不卡住。
 */
export function nextPatchToKnock(level: KnockLevel, state: ProbeState): ProbePatch | undefined {
  const order = knockOrder(level);
  const fresh = order.find((patch) => !isKnocked(state, patch.id) && !isSpooked(state, patch.id));
  if (fresh !== undefined) return fresh;
  return order.find((patch) => !isKnocked(state, patch.id));
}

/** 无头验证与小手共用的"下一步"：能走的先走，走不了就去敲最外圈那一丛 */
export type ProbeStep =
  | { kind: 'cross'; patch: ProbePatch }
  | { kind: 'knock'; patch: ProbePatch };

export function nextKnockStep(level: KnockLevel, state: ProbeState): ProbeStep | undefined {
  if (isKnockDone(state)) return undefined;
  const crossable = crossablePatches(level, state)[0];
  if (crossable !== undefined) return { kind: 'cross', patch: crossable };
  const next = nextPatchToKnock(level, state);
  return next === undefined ? undefined : { kind: 'knock', patch: next };
}

// ---------------- spot：擒贼擒王 ----------------

/** 这是哪一个身影（脚本里写了不存在的 id 就给 undefined，不抛） */
export function figureById(level: SpotLevel, figureId: string): ProbeFigure | undefined {
  return level.figures.find((figure) => figure.id === figureId);
}

/** 这一个是不是王 —— 只有射中之后才有反应，之前谁都一样 */
export function isKingFigure(level: SpotLevel, figureId: string): boolean {
  return figureById(level, figureId)?.isKing === true;
}

/** 手指落在哪一个身影上（拿最近的那一个） */
export function figureAt(
  level: SpotLevel,
  x: number,
  y: number,
  forgive = 0,
): ProbeFigure | undefined {
  let best: ProbeFigure | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const figure of level.figures) {
    const dist = Math.hypot(x - figure.x, y - figure.y);
    if (dist <= figure.radius + forgive && dist < bestDist) {
      best = figure;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 射一箭（**没有杀伤**的蒿箭）：
 * - 射中王：记下"就是他"，这一关就成了；
 * - 射中的不是王：他只退到一边（tried），少一个候选 —— 记进 mistakes、不结束、接着试；
 * - 同一个身影射第二箭不重复计数；已经找到王之后，射谁都不再记账。
 */
export function shoot(level: SpotLevel, state: ProbeState, figureId: string): ProbeState {
  const figure = figureById(level, figureId);
  if (figure === undefined || state.king !== null) return state;
  if (figure.isKing) return { ...state, king: figure.id };
  if (isFigureTried(state, figure.id)) return state;
  return { ...state, tried: [...state.tried, figure.id] };
}

/** 这一个试过了没有（试过的都退到了一边） */
export function isFigureTried(state: ProbeState, figureId: string): boolean {
  return state.tried.includes(figureId);
}

/** 还站着、还没试过的候选有几个（王找到了之后，他不再算"候选"） */
export function remainingFigures(level: SpotLevel, state: ProbeState): number {
  return level.figures.filter(
    (figure) => figure.id !== state.king && !isFigureTried(state, figure.id),
  ).length;
}

/** 射中反应最大的那一个 = 找到王了 */
export function isSpotDone(state: ProbeState): boolean {
  return state.king !== null;
}

/** 下一个该试谁（小手与无头验证都用它）：按一排里的顺序，跳过试过的；找到王就没有下一个了 */
export function nextFigureToShoot(level: SpotLevel, state: ProbeState): ProbeFigure | undefined {
  if (isSpotDone(state)) return undefined;
  return level.figures.find((figure) => !isFigureTried(state, figure.id));
}

/* ---------------- probe 扩展：hint（第 26 计 · 指桑骂槐） ---------------- */

/**
 * 指桑骂槐：**不能点名** —— 场上几样东西，敲**对**的那样，该听懂的人自己往前走一步。
 *
 * 与 knock / spot 的差别只有一条：这里要试的不是"草丛里有没有蛇"，
 * 而是**"这样东西是不是他听得懂的那一样"** ——
 * `props[].has` 在这个模式下就是"这样东西的类别"（字段名沿用老模式那个，
 * 关卡脚本里就两三种类别），`listener.wants` 是他的那一样。敲对了，他往前走一步；
 * 敲别的只是没收获 —— **记一笔 wrongKnocks 就完事**（记进 mistakes、不结束、不锁操作）。
 *
 * 四条刻意的设计：
 * - **判定只看"对不对"**：敲错多少次都不影响这一关走不走得完 —— 挨个试过去总能敲对
 *   （schema 保证至少有那么一样是他听得懂的）。
 * - **敲对的那一样可以反复敲**：他一步一步往前走，走够 steps 步，他自己就做出了正确的选择。
 *   "换个说法，别人更容易听进去"是这一计的落点 —— 不是替他把话说出来。
 * - **敲过的东西记下来**：只是复盘与画面用（哪一样敲过了），不算分、不扣分。
 * - **判定不看走位**：他走了几步由 `hintProgress` 说，画面上他站在哪儿是美术的事。
 *
 * 账本与 knock / spot **各记各的**：老的 `ProbeState` 一个字没改，
 * 这里另起一个 `ProbeHintState` —— 共用一份状态只会让老模式多出一堆用不上的字段。
 */

/** 指桑骂槐的时间常量（场景、单测、无头验证共用同一份） */
export const HINT_TIMING = {
  /** 敲一下之后，画面把"他有没有反应"演完的时长 */
  knockMs: 900,
  /** 他听懂一步、往前走一步要走多久 */
  stepMs: 1100,
  /** 开局过一会儿就把小手放到"该敲的那样东西"上（不让孩子干等） */
  introHandMs: 650,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 他做出选择之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/**
 * 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚。
 */
export interface ProbeHintState {
  /** 敲对了走了几步（他要走 steps 步） */
  progress: number;
  /** 敲错了几次 —— 复盘用，场景据此记 mistakes */
  wrongKnocks: number;
  /** 敲过的东西（按敲的先后，重复的不记）—— 画面据此画"敲过了" */
  knocked: string[];
  /** 刚敲的是哪一样；还没敲过就是 null */
  lastKnock: string | null;
  /** 刚敲的那一样是不是他听得懂的（画面据此演"他往前走了一步 / 他没有反应"） */
  lastWasWanted: boolean;
}

/** 开一局：一样都还没敲，他站在原地 */
export function hintStart(): ProbeHintState {
  return { progress: 0, wrongKnocks: 0, knocked: [], lastKnock: null, lastWasWanted: false };
}

/** 这是哪一样东西（脚本里写了不存在的 id 就给 undefined，不抛） */
export function hintPropById(level: ProbeHintLevel, propId: string): ProbePatch | undefined {
  return level.props.find((prop) => prop.id === propId);
}

/** 他听得懂的是哪一样（`has` 在这个模式下就是它的 kind） */
export function wantedKind(level: ProbeHintLevel): string {
  return level.listener.wants;
}

/** 这一样是不是他听得懂的 */
export function isWantedProp(level: ProbeHintLevel, propId: string): boolean {
  return hintPropById(level, propId)?.has === level.listener.wants;
}

/** 手指落在哪一样东西上（拿最近的那一样）；forgive 让手指粗一点也点得到 */
export function hintPropAt(
  level: ProbeHintLevel,
  x: number,
  y: number,
  forgive = 0,
): ProbePatch | undefined {
  let best: ProbePatch | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const prop of level.props) {
    const dist = Math.hypot(x - prop.x, y - prop.y);
    if (dist <= prop.radius + forgive && dist < bestDist) {
      best = prop;
      bestDist = dist;
    }
  }
  return best;
}

/** 敲对了几步 */
export function hintProgress(state: ProbeHintState): number {
  return state.progress;
}

/** 敲错了几次 —— 复盘用，场景据此记 mistakes */
export function wrongKnocks(state: ProbeHintState): number {
  return state.wrongKnocks;
}

/** 他还要走几步 */
export function hintStepsLeft(level: ProbeHintLevel, state: ProbeHintState): number {
  return Math.max(0, level.steps - state.progress);
}

/** 他已经走到第几步（0..steps —— 画面上他站在哪儿按它插值） */
export function listenerStep(level: ProbeHintLevel, state: ProbeHintState): number {
  return Math.min(level.steps, state.progress);
}

/**
 * 敲一样东西：
 * - **敲到他听得懂的那一样**：`hintProgress` 加一 —— 他往前走一步；走够 steps 步，
 *   他自己就做出了正确的选择。
 * - **敲别的**：只是没收获 —— `wrongKnocks` 记一笔（同一样再敲，账照记），
 *   **不结束、不锁操作**（记进 mistakes）：孩子可以放心地一样一样试过去。
 * - 脚本里没有这一样、或者他已经走够了：原样返回（连状态对象都不换）。
 */
export function knockHint(
  level: ProbeHintLevel,
  state: ProbeHintState,
  propId: string,
): ProbeHintState {
  const prop = hintPropById(level, propId);
  if (prop === undefined || isHintDone(level, state)) return state;
  const knocked = state.knocked.includes(prop.id) ? state.knocked : [...state.knocked, prop.id];
  if (prop.has !== level.listener.wants) {
    return {
      ...state,
      wrongKnocks: state.wrongKnocks + 1,
      knocked,
      lastKnock: prop.id,
      lastWasWanted: false,
    };
  }
  return {
    ...state,
    progress: state.progress + 1,
    knocked,
    lastKnock: prop.id,
    lastWasWanted: true,
  };
}

/** 走够 steps 步 = 他自己做出了正确的选择（这一关成了） */
export function isHintDone(level: ProbeHintLevel, state: ProbeHintState): boolean {
  return state.progress >= level.steps;
}

/**
 * 该敲哪一样：**他听得懂的那样东西**（按脚本顺序的第一样 —— schema 保证至少有一个）。
 * 小手与无头验证都用它：它指的不是"敲哪儿都行"，是"敲了才有用"的那一样。
 * 已经走够了就没有下一个了。
 */
export function nextHintProp(
  level: ProbeHintLevel,
  state: ProbeHintState,
): ProbePatch | undefined {
  if (isHintDone(level, state)) return undefined;
  return level.props.find((prop) => prop.has === level.listener.wants);
}
