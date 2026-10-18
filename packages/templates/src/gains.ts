/**
 * 玩法判定要用、schema 的 refine 也要用的两个小函数。
 *
 * 它们原来住在 schemas.ts 里：于是 siege.logic / matchup.logic（生产代码）为了一个纯函数
 * 去 import 整个 schema 模块，连带把 zod 与全部模板 schema 拖进游戏 chunk（约 33 KB gzip）。
 * 拆出来之后：schema 的 refine 与玩法判定 import 同一份实现，生产包里却只有这几行。
 */

/** 正面推一次的增量：阻力越大，推得越少（siege 与关卡验算共用） */
export function siegeGain(resistance: number): number {
  return Math.max(0.2, 1 - resistance / 10);
}

/** 三匹马 vs 三场：六种配对里最多能赢几场（内容写错不该等孩子打到一半才发现） */
export function bestMatchupWins(
  horses: readonly { power: number }[],
  rivals: readonly { power: number }[],
): number {
  let best = 0;
  const walk = (rest: number[], acc: number[]): void => {
    if (rest.length === 0) {
      const wins = acc.filter((h, i) => horses[h]!.power > rivals[i]!.power).length;
      best = Math.max(best, wins);
      return;
    }
    for (const index of rest) walk(rest.filter((x) => x !== index), [...acc, index]);
  };
  if (horses.length === 3 && rivals.length === 3) walk([0, 1, 2], []);
  return best;
}
