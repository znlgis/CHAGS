import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSiegeScene } from '@chags/templates/siege';
import { drawBeat, drawLadder, drawLadderFinale } from './art';
import { shangwuLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = shangwuLevel(ctx.content);
    return {
      entry: SCENE_KEYS.siege,
      scenes: [
        createSiegeScene(ctx, {
          level,
          session,
          // 一级级往上架的梯子、顺着梯子往上走的人、抽掉的那一下，都是画面按 metrics 演的
          drawLadder,
          drawLadderFinale,
          // 关键抉择点的揭晓语：先给方便，等他上了屋，梯子就在你手里
        }),
      ],
    };
  },
});
