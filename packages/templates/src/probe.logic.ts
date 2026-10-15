import type { ProbeFigure, ProbeLevel, ProbePatch } from './schemas';

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
 * - **零惩罚**：敲了不能走的地方、射错了人，都只是"没收获 / 少一个候选" ——
 *   不扣星、不结束、不锁操作，接着试就是（零惩罚是这一系列的地基）。
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
 * - 射中的不是王：他只退到一边（tried），少一个候选 —— 不扣星、不结束、接着试；
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
