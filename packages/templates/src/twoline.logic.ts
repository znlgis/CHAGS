import type { TwolineLevel } from './schemas';

/**
 * 双线（twoline）的纯判定：明面撑住、暗里推进，两条线抢**同一根手指**。
 *
 * 这一关的账本只有一本：明线（修栈道）随时间往下掉，点一下补一截；
 * 暗线（走小路）点一下推一截，到 goal 就成。两条线各占一只手的时间 ——
 * 只顾暗线会被看穿，只顾明线推不动。**被看穿不是失败**：明线立刻补回 minKeep、
 * 记一次"被看穿"，接着玩就是（零惩罚是这一系列的地基）。
 *
 * 判定全部按**时间轴**算（t 是从这一局开始算起的毫秒数）：
 * 场景每帧把墙钟喂进来结账，单测直接喂数字 —— 同一份判定，两边不会跑偏。
 * **不 import Phaser**。
 */

/** 双线的手感常量（场景、单测、无头验证共用同一份） */
export const TWOLINE_TIMING = {
  /** 明线掉到 minKeep 的这个倍数以下，就该补一笔了 —— 小手与无头验证都看它 */
  urgentRatio: 1.5,
  /**
   * 两次"被看穿"之间至少隔这么久。
   * 明线一旦跌到 minKeep 就停在那个高度（画面红着，提醒你该补了），
   * 没有这个间隔的话，"只顾暗线"的那几秒会被每帧记一次账。
   */
  exposeGapMs: 2600,
} as const;

/** 浮点容差：4 加二十五次不会正好是漂亮的 100 */
const EPS = 1e-9;

/** 一局里攒下来的东西：明线到哪儿了、暗线推到哪儿了、被抓过几次 */
export interface TwolineState {
  /** 明线上一次结算的值 */
  decoy: number;
  /** 明线上一次结算的时刻 */
  decoyAtMs: number;
  /** 暗线推到多少了 */
  real: number;
  /** 被看穿了几次（零惩罚，只用来复盘） */
  exposed: number;
  /** 上一次被看穿是什么时候（表演与"别连珠炮记账"都用它） */
  lastExposedAtMs: number | null;
  /** 暗线点了几下 */
  taps: number;
  /** 明线补了几笔 */
  decoyTaps: number;
}

/**
 * 开局：明线是**满的**。
 * 栈道本来就修在那里、大家一起敲敲打打 —— 这一关要的是维持它，不是从零开始修，
 * 所以 decoy 从 max 起（这也是它必须拿到关卡数据的原因）。
 */
export function twolineStart(level: TwolineLevel): TwolineState {
  return {
    decoy: level.decoy.max,
    decoyAtMs: 0,
    real: 0,
    exposed: 0,
    lastExposedAtMs: null,
    taps: 0,
    decoyTaps: 0,
  };
}

/**
 * 明线此刻的值：从上次结算起，按 decayPerSec 往下掉，夹在 0..max。
 * t 早于上次结算（单测里回看）时按"还没掉"算 —— 不会算出比上次更高的数。
 */
export function decoyNow(level: TwolineLevel, state: TwolineState, t: number): number {
  const sinceMs = Math.max(0, Math.max(0, t) - state.decoyAtMs);
  const value = state.decoy - (level.decoy.decayPerSec * sinceMs) / 1000;
  return Math.min(level.decoy.max, Math.max(0, value));
}

/** 明线还剩几成（0..1）—— 画面上的栈道按它画 */
export function decoyRatio(level: TwolineLevel, state: TwolineState, t: number): number {
  const { max } = level.decoy;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, decoyNow(level, state, t) / max));
}

/** 明线还剩多久会跌破 minKeep（已经跌破了 = 0）—— 画面上的那个钟 */
export function safeMsLeft(level: TwolineLevel, state: TwolineState, t: number): number {
  const above = decoyNow(level, state, t) - level.decoy.minKeep;
  if (above <= 0) return 0;
  return (above / level.decoy.decayPerSec) * 1000;
}

/** 明线该补一笔了吗：掉到 minKeep 的 urgentRatio 倍以下 */
export function needsTopUp(
  level: TwolineLevel,
  state: TwolineState,
  t: number,
  ratio = TWOLINE_TIMING.urgentRatio,
): boolean {
  return decoyNow(level, state, t) < level.decoy.minKeep * ratio;
}

/** 明线跌破 minKeep = 被看穿 */
export function isExposed(level: TwolineLevel, state: TwolineState, t: number): boolean {
  return decoyNow(level, state, t) + EPS < level.decoy.minKeep;
}

/**
 * 结账：把明线推到此刻。
 * - 还在 minKeep 之上：照常往下掉多少就是多少；
 * - 跌破了：**立刻补回 minKeep**、记一次"被看穿"，然后停在 minKeep 上等你补一笔。
 *
 * 场景每帧调它一次，所以孩子看到的明线始终是最新的值；
 * 被看穿**不结束、不扣星**，只是把"你只顾着暗线"这件事说出来。
 */
export function settleDecoy(level: TwolineLevel, state: TwolineState, t: number): TwolineState {
  const now = Math.max(0, t);
  const value = decoyNow(level, state, t);
  if (value + EPS >= level.decoy.minKeep) {
    return { ...state, decoy: value, decoyAtMs: now };
  }
  // 刚刚被抓过就不再重复记账（见 exposeGapMs）
  const recent =
    state.lastExposedAtMs !== null && now - state.lastExposedAtMs < TWOLINE_TIMING.exposeGapMs;
  return {
    ...state,
    decoy: level.decoy.minKeep,
    decoyAtMs: now,
    exposed: recent ? state.exposed : state.exposed + 1,
    lastExposedAtMs: recent ? state.lastExposedAtMs : now,
  };
}

/** 补一笔明线：先结账，再加上 topUp（封顶 max） */
export function tapDecoy(level: TwolineLevel, state: TwolineState, t: number): TwolineState {
  const settled = settleDecoy(level, state, t);
  return {
    ...settled,
    decoy: Math.min(level.decoy.max, settled.decoy + level.decoy.topUp),
    decoyAtMs: Math.max(0, t),
    decoyTaps: settled.decoyTaps + 1,
  };
}

/** 点一下暗线：推 step，封顶在 goal */
export function tapReal(level: TwolineLevel, state: TwolineState, t: number): TwolineState {
  const settled = settleDecoy(level, state, t);
  return {
    ...settled,
    real: Math.min(level.real.goal, settled.real + level.real.step),
    taps: settled.taps + 1,
  };
}

/** 暗线推到几成（0..1） */
export function realRatio(level: TwolineLevel, state: TwolineState): number {
  if (level.real.goal <= 0) return 1;
  return Math.min(1, Math.max(0, state.real / level.real.goal));
}

/** 暗线还要点几下（提示与关卡验算都看它） */
export function tapsLeft(level: TwolineLevel, state: TwolineState): number {
  if (level.real.step <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil((level.real.goal - state.real) / level.real.step - EPS));
}

/** 暗线点到 goal 就算成 —— 明线被看穿多少次都不影响这一条 */
export function isTwolineDone(level: TwolineLevel, state: TwolineState): boolean {
  return state.real + EPS >= level.real.goal;
}

/**
 * 接下来该点哪条线（小手、提示与无头验证都用它）：
 * 明线快到线了就先撑着，其余时间推暗线。
 */
export function nextLineToTap(
  level: TwolineLevel,
  state: TwolineState,
  t: number,
): 'decoy' | 'real' | null {
  if (needsTopUp(level, state, t)) return 'decoy';
  return isTwolineDone(level, state) ? null : 'real';
}

// ---------------- 点选判定：手指粗也能点得到（与 siege / ruse 同一套路：算距离，不依赖命中区域） ----------------

/** 手指落在明线（栈道）上吗 */
export function hitDecoy(level: TwolineLevel, x: number, y: number, forgive = 0): boolean {
  const { x: cx, y: cy, radius } = level.decoy;
  return Math.hypot(x - cx, y - cy) <= radius + forgive;
}

/** 手指落在暗线（小路）上吗 */
export function hitReal(level: TwolineLevel, x: number, y: number, forgive = 0): boolean {
  const { x: rx, y: ry, radius } = level.real;
  return Math.hypot(x - rx, y - ry) <= radius + forgive;
}

/* ---------------- twoline 扩展：plant（第 33 计 · 反间计） ---------------- */

// 老模式（stack）的判定与类型一个字没动：新模式的类型另起一段引入
import type { TwolinePlantLevel } from './schemas';

/**
 * 反间计（plant）：**让来访的人自己看到**你想让他看到的东西。
 *
 * 他来回踱步、时不时瞟一眼案上；点 `redirect`（弄出点动静）他会转头去看别处 `lookAwayMs` ——
 * **趁这个空档按住 `spot`**，把东西一点一点摆到他"自己会看到"的地方。
 * 摆到一半他回过头（空档结束）= 被你手忙脚乱的样子露了馅：进度清零、记一笔 caught，
 * **零惩罚** —— 不扣星、不结束、不锁操作：重新弄出动静、重新按住就是。
 *
 * 三条刻意的设计：
 * - **判定全按时间轴算**（t 是从这一局开始算起的毫秒数）：空档什么时候开、什么时候关、
 *   进度攒到多少，全由这几个纯函数算；场景每帧把墙钟喂进来，单测直接喂数字 —— 同一份判定。
 * - **只有"按住 && 他在看别处"才往前走**：松手只是停下来（进度留着，再按住接着摆），
 *   他正看着的时候按下去什么都不发生 —— 两条合起来才是"趁空档"的分量。
 * - **露馅只在他回过头、而手上已经有进度的时候记**：还没动手就被回头看一眼，什么都不算。
 *   零惩罚这条线划在"没做成"上，不划在"孩子的手放错过地方"上。
 *
 * **不 import Phaser**：判定比画面重要得多。
 */

/** 反间计的手感常量（场景、单测、无头验证共用同一份） */
export const PLANT_TIMING = {
  /** 一局的开场：过一会儿就把小手放到该动的地方（不让孩子干等） */
  introHandMs: 900,
  /**
   * 无头验证：隔多久看一次"该弄动静还是该按住"。
   * 它**不是点击的节奏** —— 按住之后由每一帧的 plantStep 往前推，
   * 这个步长只决定"空档开没开、摆好了没有"多久看一遍。
   */
  autoplayStepMs: 260,
  /** 露馅之后红光闪多久（不是惩罚，只是把"刚才被看见了"说出来） */
  caughtFlashMs: 1100,
  /** 多久没动静就把小手重新放上去 */
  idleMs: 9000,
  /** 打赢之后看一眼再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/**
 * 一局里攒下来的东西：都是"记下来的事"，没有一样是惩罚。
 */
export interface TwolinePlantState {
  /** 已经摆上去多少毫秒（按住 && 他在看别处 才涨；松手留着，被撞见清零） */
  progressMs: number;
  /** 摆好了没有 */
  planted: boolean;
  /** 他转头看别处到什么时候（毫秒，从这一局开始算起）；没在转头就是 -1 */
  awayUntilMs: number;
  /** 点了几次 redirect（复盘用） */
  redirects: number;
  /** 被他回过头撞见几次（零惩罚，只用来复盘）—— 这一计最诚实的一笔账 */
  caught: number;
  /** 上一次被撞见是什么时候；还没被撞见过就是 -1 */
  lastCaughtAtMs: number;
  /** 摆好的时刻；还没摆好就是 -1 */
  plantedAtMs: number;
}

/** 一帧的判定结果：正在摆 / 露馅了 / 什么都没发生 */
export type PlantHoldResult = 'planting' | 'exposed' | 'idle';

/** 一帧的账：新的账本 + 这一帧算哪一种（场景两样都要） */
export interface PlantTick {
  state: TwolinePlantState;
  result: PlantHoldResult;
}

/** 浮点容差：1600 毫秒一帧一帧地加，不会正好落在整头上 */
const PLANT_EPS = 1e-9;

function plantClampMs(t: number): number {
  return Number.isNaN(t) ? 0 : Math.max(0, t);
}

/** 开一局：还什么都没摆上，他也没转头（空档要自己点出来） */
export function plantStart(): TwolinePlantState {
  return {
    progressMs: 0,
    planted: false,
    awayUntilMs: -1,
    redirects: 0,
    caught: 0,
    lastCaughtAtMs: -1,
    plantedAtMs: -1,
  };
}

/**
 * 他此刻踱到哪儿了：from → to → from 是一个来回（walkMs），返回 0..1。
 * 画面把他画在这儿，单测也拿它验"被模拟的人真的在动"（§7.10 的那条教训）。
 */
export function visitorWalk(level: TwolinePlantLevel, t: number): number {
  const period = level.visitor.walkMs > 0 ? level.visitor.walkMs : 1;
  const phase = ((plantClampMs(t) % period) + period) % period;
  const k = (phase * 2) / period;
  return k <= 1 ? k : 2 - k;
}

/** 他此刻在哪儿（from 与 to 之间来回走） */
export function visitorAt(level: TwolinePlantLevel, t: number): { x: number; y: number } {
  const k = visitorWalk(level, t);
  return {
    x: level.visitor.from.x + (level.visitor.to.x - level.visitor.from.x) * k,
    y: level.visitor.from.y + (level.visitor.to.y - level.visitor.from.y) * k,
  };
}

/** 他此刻转过头去没有（空档开着没有） */
export function isLookingAway(state: TwolinePlantState, t: number): boolean {
  return lookAwayLeftMs(state, t) > 0;
}

/** 这个空档还剩多久（0 = 他正看着；画面上的那个钟按它画） */
export function lookAwayLeftMs(state: TwolinePlantState, t: number): number {
  if (state.awayUntilMs < 0) return 0;
  return Math.max(0, state.awayUntilMs - plantClampMs(t));
}

/**
 * 弄出点动静：他转过头去看别处，空档从**此刻**起算。
 * 已经摆好了就原样返回（这一局已经成了，谁也不用再转头）。
 * 空档还开着再点一次：从此刻重新算 —— 这是从宽不是惩罚（手快多点一下不该吃亏）。
 */
export function redirectLook(
  level: TwolinePlantLevel,
  state: TwolinePlantState,
  t: number,
): TwolinePlantState {
  if (state.planted) return state;
  return {
    ...state,
    awayUntilMs: plantClampMs(t) + level.redirect.lookAwayMs,
    redirects: state.redirects + 1,
  };
}

/**
 * 一帧的账（场景、无头验证、单测都走它）：
 * - **按住 && 空档开着** → 往前摆 dtMs；摆满 plantMs 就是摆好了（progressMs 封顶在 plantMs）；
 * - **按住 && 他回过头（空档结束）&& 手上已经有进度** → 露馅：进度清零、记一笔 caught
 *   （零惩罚：不结束、不扣星，重新弄出动静、重新按住就是）；
 * - 其余（没按住 / 刚开始按、一点进度都还没有）→ 什么都不发生。
 *
 * 顺序是刻意的：**先算"空档开着"，再算"回过头的代价"** ——
 * 恰好卡在空档最后一帧摆满的那一下算摆好了（从宽，零惩罚）。
 */
export function plantStep(
  level: TwolinePlantLevel,
  state: TwolinePlantState,
  t: number,
  dtMs: number,
  holding: boolean,
): PlantTick {
  const now = plantClampMs(t);
  if (state.planted || !holding) return { state, result: 'idle' };
  if (isLookingAway(state, now)) {
    const progressMs = Math.min(level.spot.plantMs, state.progressMs + Math.max(0, dtMs));
    if (progressMs + PLANT_EPS >= level.spot.plantMs) {
      return {
        state: { ...state, progressMs: level.spot.plantMs, planted: true, plantedAtMs: now },
        result: 'planting',
      };
    }
    return { state: { ...state, progressMs }, result: 'planting' };
  }
  if (state.progressMs > 0) {
    // 他回过头，而你还按着、手上还有进度：被看见了（零惩罚，账要记）
    return {
      state: { ...state, progressMs: 0, caught: state.caught + 1, lastCaughtAtMs: now },
      result: 'exposed',
    };
  }
  return { state, result: 'idle' };
}

/**
 * 规格书里的那一个判定：这一帧算 'planting' / 'exposed' / 'idle'。
 * 它就是 plantStep 的结果 —— 账本由 plantStep 一起交回，两处永远说的是同一件事。
 */
export function plantHold(
  level: TwolinePlantLevel,
  state: TwolinePlantState,
  t: number,
  dtMs: number,
  holding: boolean,
): PlantHoldResult {
  return plantStep(level, state, t, dtMs, holding).result;
}

/** 已经摆上去多少毫秒（进度环与提示都按它算） */
export function plantProgress(state: TwolinePlantState): number {
  return state.progressMs;
}

/** 摆到几成了（0..1）—— 画面上那圈进度环用它 */
export function plantRatio(level: TwolinePlantLevel, state: TwolinePlantState): number {
  if (level.spot.plantMs <= 0) return 1;
  return Math.min(1, Math.max(0, state.progressMs / level.spot.plantMs));
}

/** 摆好了没有（摆满就算 —— 摆上去的东西谁也拿不下来） */
export function isPlantDone(level: TwolinePlantLevel, state: TwolinePlantState): boolean {
  return state.planted || state.progressMs + PLANT_EPS >= level.spot.plantMs;
}

/** 一个空档够不够摆完（schema 守着 plantMs ≤ lookAwayMs；提示语与单测看它） */
export function fitsInLookAway(level: TwolinePlantLevel): boolean {
  return level.spot.plantMs <= level.redirect.lookAwayMs;
}

/** 手指落在案上那块地方没有（要按住的就是这里；宽容度让小朋友不用对准） */
export function hitSpot(level: TwolinePlantLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.spot.x, y - level.spot.y) <= level.spot.radius + forgive;
}

/** 手指落在"弄出点动静"的那一处没有 */
export function hitRedirect(level: TwolinePlantLevel, x: number, y: number, forgive = 0): boolean {
  return Math.hypot(x - level.redirect.x, y - level.redirect.y) <= level.redirect.radius + forgive;
}
