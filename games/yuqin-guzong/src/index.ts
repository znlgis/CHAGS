import { createChaseScene } from '@chags/templates/chase';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { chaseLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = chaseLevel(ctx.content);
    return {
      entry: SCENE_KEYS.chase,
      scenes: [
        createChaseScene(ctx, {
          level,
          session,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语进典故卡之前再说一遍
        }),
      ],
    };
  },
});
