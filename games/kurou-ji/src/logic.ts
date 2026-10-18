import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import { isSplitSolved, splitState } from '@chags/templates/split.logic';
import { SplitLevelSchema } from '@chags/templates/schemas';
import type { SplitBin, SplitLevel } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function splitLevel(content: ContentEntry): SplitLevel {
  return SplitLevelSchema.parse(stageScript(content, 'split'));
}

/** 探子盯着的那一头 —— 也就是"送出去的"那份 */
export function watchedBin(level: SplitLevel): SplitBin | undefined {
  return level.bins.find((bin) => bin.id === level.audience.watchedBinId);
}

/**
 * 他会点头的那几种分法：**留给自己的一头是几袋**。
 *
 * 一份要送得够多（audience.happyAt），一份自己也不能空（minPerSide）——
 * 两头都留得住才算分好了。这份区间也是"卡住时小手推一格"用的路标。
 */
export function believableLefts(level: SplitLevel): number[] {
  const lefts: number[] = [];
  for (let left = 0; left <= level.total; left += 1) {
    if (isSplitSolved(splitState(left, level), level)) lefts.push(left);
  }
  return lefts;
}
