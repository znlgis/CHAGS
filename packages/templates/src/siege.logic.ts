import { siegeGain } from './schemas';
import type { SiegeLevel, SiegeVital } from './schemas';

/**
 * 正面推了多少、推了几下、哪些要害已经点到。
 * 状态是纯数据：单测直接造一个就能跑，不需要浏览器。
 */
export interface SiegeState {
  /** 正面推进的总量，到 goal 就解围 */
  progress: number;
  /** 点过的要害 id —— 每个要害只能点一次 */
  relieved: string[];
  /** 正面推了几次（"光靠蛮力要推一百下"这件事是看得见的） */
  taps: number;
}

/** 浮点容差：0.2 加一百次不会正好是漂亮的 20 */
const EPS = 1e-9;

export function siegeStart(): SiegeState {
  return { progress: 0, relieved: [], taps: 0 };
}

/** 现在的阻力：初始阻力减去所有"已回防"的要害，最低到 0 */
export function resistanceOf(level: SiegeLevel, state: SiegeState): number {
  const relieved = new Set(state.relieved);
  const relief = level.vital
    .filter((vital) => relieved.has(vital.id))
    .reduce((sum, vital) => sum + vital.relief, 0);
  return Math.max(0, level.resistance - relief);
}

/** 正面推一下能推多远：阻力越大推得越少（siegeGain 的封装） */
export function frontGain(level: SiegeLevel, state: SiegeState): number {
  return siegeGain(resistanceOf(level, state));
}

/** 推一下正面 —— 纯函数，返回新状态；进度封顶在 goal */
export function frontTap(level: SiegeLevel, state: SiegeState): SiegeState {
  const gain = frontGain(level, state);
  return {
    progress: Math.min(level.goal, state.progress + gain),
    relieved: [...state.relieved],
    taps: state.taps + 1,
  };
}

/**
 * 点一处要害：只有第一次生效。
 * 同一个要害点两次不会重复减阻力 —— 不然"点过的要害"就能刷出无限的收益。
 */
export function relieve(level: SiegeLevel, state: SiegeState, vitalId: string): SiegeState {
  const vital = level.vital.find((item) => item.id === vitalId);
  if (!vital || state.relieved.includes(vital.id)) return state;
  return {
    progress: state.progress,
    relieved: [...state.relieved, vital.id],
    taps: state.taps,
  };
}

export function isRelieved(state: SiegeState, vitalId: string): boolean {
  return state.relieved.includes(vitalId);
}

/** 还差几下正面才解围 —— 提示、验算与单测都看它 */
export function tapsToFinish(level: SiegeLevel, state: SiegeState): number {
  const gain = frontGain(level, state);
  if (gain <= 0) return Number.POSITIVE_INFINITY;
  const left = level.goal - state.progress;
  if (left <= EPS) return 0;
  return Math.ceil(left / gain - EPS);
}

/** 0..1：画面上的进度条按它画 */
export function siegeProgress(level: SiegeLevel, state: SiegeState): number {
  if (level.goal <= 0) return 1;
  return Math.max(0, Math.min(1, state.progress / level.goal));
}

/** 推进到 goal 就算解围 */
export function isSiegeDone(level: SiegeLevel, progress: number): boolean {
  return progress + EPS >= level.goal;
}

/** 手指落在哪一处要害上；forgive 让小朋友不用对准 */
export function vitalAt(
  x: number,
  y: number,
  level: SiegeLevel,
  forgive = 0,
): SiegeVital | null {
  let best: SiegeVital | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const vital of level.vital) {
    const dist = Math.hypot(x - vital.x, y - vital.y);
    if (dist <= vital.radius + forgive && dist < bestDist) {
      best = vital;
      bestDist = dist;
    }
  }
  return best;
}

/** 还没点过的要害（按关卡里的顺序）—— 提示与无头验证都用它 */
export function untouchedVitals(level: SiegeLevel, state: SiegeState): SiegeVital[] {
  return level.vital.filter((vital) => !state.relieved.includes(vital.id));
}

export function nextVital(level: SiegeLevel, state: SiegeState): SiegeVital | undefined {
  return untouchedVitals(level, state)[0];
}
