import { bestMatchupWins } from './schemas';
import type { MatchupHorse, MatchupLevel, MatchupRival } from './schemas';

/**
 * 配对编排（matchup）的纯判定：谁对谁、这一场谁赢、赢够几场算胜。
 *
 * **不 import Phaser** —— 判定比画面重要得多，这些函数单测直接调。
 *
 * 三条刻意的设计：
 * - **power 大者胜，相等算输**：相等时没有"侥幸赢"，孩子要一眼看得出差距才有得排。
 * - **六种配对全枚举**：三匹马对三场一共 3! = 6 种排法，好牌在手也排得完；
 *   bestRoster 用与内容校验同一套枚举（schemas.bestMatchupWins），
 *   所以"这一关到底能不能赢"在构建期和玩法里是同一个答案。
 * - **输了零惩罚**：把马放回架子上重排就是 —— 不扣星、不结束。李代桃僵的落点
 *   恰恰是"故意舍一局"：输了第一场不等于输了整场。
 */

/** 配对模板的手感常量（场景、单测、e2e 共用同一份） */
export const MATCHUP_TIMING = {
  /** 一场比赛跑完的时长（自己的马从起跑线跑到终点线） */
  raceMs: 1500,
  /** 一场接一场之间的呼吸 */
  raceGapMs: 320,
  /** 输赢的旗子升起来之后，停一会儿再让孩子决定下一步 */
  flagHoldMs: 900,
  /** 无头验证：把每一段演出压成几分之一 */
  autoplayFactor: 3,
  /** 无头验证：再短也留这么久，否则情节看不清 */
  autoplayMinMs: 160,
  /** 无头验证：隔多久走一步 */
  autoplayStepMs: 160,
  /** 多久没动静就把小手放到没上场的马身上 */
  idleMs: 9000,
  /** 赢了整场之后看一眼赛场，再进典故卡 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/**
 * 一种排法：roster[赛次下标] = 马在 level.horses 里的下标。
 * 三个下标互不相同 —— 一匹马只能上一场。
 */
export type Roster = number[];

/** 一场的结果：哪一场、谁对谁、赢了没有 */
export interface RaceResult {
  /** 第几场（0 起，与 level.rivals 的下标一致） */
  index: number;
  rivalId: string;
  horseId: string;
  /** 自己的马 power 更大才算赢；**相等算输** */
  win: boolean;
}

/** 对手那一场的命中半径（木牌画得比马大，点到木牌也算选中这一场） */
export const RIVAL_HIT = 110;

/** 一匹马与一场对手的强弱差（画面画"差一点"用；正数就是我们强） */
export function powerGap(horse: { power: number }, rival: { power: number }): number {
  return horse.power - rival.power;
}

export function winsFor(level: MatchupLevel, roster: Roster): number {
  return resolve(level, roster).filter((race) => race.win).length;
}

/** 一种排法跑下来的每一场 —— 顺序与 level.rivals 一致 */
export function resolve(level: MatchupLevel, roster: Roster): RaceResult[] {
  return level.rivals.map((rival, index) => {
    const horseIndex = roster[index];
    const horse = horseIndex === undefined ? undefined : level.horses[horseIndex];
    return {
      index,
      rivalId: rival.id,
      horseId: horse?.id ?? '',
      win: horse !== undefined && horse.power > rival.power,
    };
  });
}

/** 三匹马对三场一共六种排法（3! = 6）—— 全枚举，一个不漏 */
export function pairings(level: MatchupLevel): Roster[] {
  const out: Roster[] = [];
  const walk = (rest: number[], acc: Roster): void => {
    if (rest.length === 0) {
      out.push(acc);
      return;
    }
    for (const index of rest) walk(rest.filter((item) => item !== index), [...acc, index]);
  };
  walk(
    level.horses.map((_, index) => index),
    [],
  );
  return out;
}

/** 六种排法里赢得最多的那一种；并列时取"更早枚举到"的（确定性，无头验证也照它走） */
export function bestRoster(level: MatchupLevel): Roster {
  let best: Roster = level.horses.map((_, index) => index);
  let bestWins = -1;
  for (const roster of pairings(level)) {
    const wins = winsFor(level, roster);
    if (wins > bestWins) {
      best = roster;
      bestWins = wins;
    }
  }
  return [...best];
}

/** 六种排法里最多能赢几场 —— 与内容校验的 bestMatchupWins 必须是同一个数 */
export function bestWins(level: MatchupLevel): number {
  return bestMatchupWins(level.horses, level.rivals);
}

/** 赢够 needWins 场（三局两胜 = 2）就算赢下整场 */
export function isMatchupDone(level: MatchupLevel, wins: number): boolean {
  return wins >= level.needWins;
}

/** 输了几场 —— 只是复盘用，不扣星也不结束 */
export function lossesFor(level: MatchupLevel, roster: Roster): number {
  return resolve(level, roster).filter((race) => !race.win).length;
}

/** 三场都排好了没有（没排满就不能开赛） */
export function isRosterFull(level: MatchupLevel, roster: Roster): boolean {
  return roster.length === level.rivals.length && roster.every((index) => index >= 0);
}

/** 手指落在哪一匹马身上（按屏幕位置算距离，不依赖命中区域） */
export function horseNear(
  level: MatchupLevel,
  x: number,
  y: number,
  forgive = 0,
): MatchupHorse | undefined {
  let best: MatchupHorse | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const horse of level.horses) {
    const dist = Math.hypot(x - horse.x, y - horse.y);
    if (dist <= horse.radius + forgive && dist < bestDist) {
      best = horse;
      bestDist = dist;
    }
  }
  return best;
}

/** 手指落在第几场比赛上；对着对手的马也能选中它那一场 */
export function rivalAt(
  level: MatchupLevel,
  x: number,
  y: number,
  forgive = 0,
): MatchupRival | undefined {
  let best: MatchupRival | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const rival of level.rivals) {
    const dist = Math.hypot(x - rival.x, y - rival.y);
    if (dist <= RIVAL_HIT + forgive && dist < bestDist) {
      best = rival;
      bestDist = dist;
    }
  }
  return best;
}

/** 这一匹马现在排在第几场；没上场就是 -1 */
export function slotOfHorse(level: MatchupLevel, roster: Roster, horseId: string): number {
  const index = level.horses.findIndex((horse) => horse.id === horseId);
  if (index < 0) return -1;
  return roster.indexOf(index);
}

/** 第几场现在是谁的马；空着就是 undefined */
export function horseAtSlot(level: MatchupLevel, roster: Roster, slot: number): MatchupHorse | undefined {
  const index = roster[slot];
  return index === undefined || index < 0 ? undefined : level.horses[index];
}

/** 把一匹马放到第几场：原来占用这一场的马被换下来（零惩罚 —— 随便改） */
export function assign(level: MatchupLevel, roster: Roster, slot: number, horseId: string): Roster {
  const index = level.horses.findIndex((horse) => horse.id === horseId);
  if (index < 0 || slot < 0 || slot >= level.rivals.length) return [...roster];
  const next = roster.slice(0, level.rivals.length);
  while (next.length < level.rivals.length) next.push(-1);
  const wasAt = next.indexOf(index);
  const occupant = next[slot] ?? -1;
  if (wasAt >= 0 && occupant >= 0) {
    // 两匹马换位置：孩子把马放到别场，原来那一场的马顺势挪回去
    next[wasAt] = occupant;
  } else if (wasAt >= 0) {
    // 目标场次空着：直接挪过去（马不会留在两个场次上）
    next[wasAt] = -1;
  } else if (occupant >= 0) {
    // 目标场次原来有马：把它放回架子 —— 一匹马只能上一场
    next[slot] = -1;
  }
  next[slot] = index;
  return next;
}

/** 把马从场上放回架子（输了就想重排 —— 这一步永远是免费的） */
export function takeBack(level: MatchupLevel, roster: Roster, slot: number): Roster {
  const next = roster.slice(0, level.rivals.length);
  while (next.length < level.rivals.length) next.push(-1);
  if (slot >= 0 && slot < next.length) next[slot] = -1;
  return next;
}

/** 清空重来 */
export function resetRoster(level: MatchupLevel): Roster {
  return level.rivals.map(() => -1);
}

/** 把一种排法摊成"第几场放哪匹马"（无头验证与提示都按它走，与画面同一份数据） */
export function placements(level: MatchupLevel, roster: Roster): { slot: number; horse: MatchupHorse }[] {
  const out: { slot: number; horse: MatchupHorse }[] = [];
  for (let slot = 0; slot < level.rivals.length; slot += 1) {
    const horse = horseAtSlot(level, roster, slot);
    if (horse !== undefined) out.push({ slot, horse });
  }
  return out;
}

/** 还差几场才赢下整场 */
export function winsNeeded(level: MatchupLevel, wins: number): number {
  return Math.max(0, level.needWins - wins);
}

/** 0..1：画面上的计分按它画 */
export function matchupProgress(level: MatchupLevel, wins: number): number {
  if (level.needWins <= 0) return 1;
  return Math.max(0, Math.min(1, wins / level.needWins));
}

/** 演出时长：无头验证时压短（绝不短到看不见） */
export function scaledMs(value: number, autoplay: boolean, factor = MATCHUP_TIMING.autoplayFactor): number {
  if (!autoplay) return value;
  return Math.max(MATCHUP_TIMING.autoplayMinMs, Math.round(value / factor));
}
