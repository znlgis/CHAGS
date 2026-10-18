import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSwapScene } from '@chags/templates/swap';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { jinchanLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = jinchanLevel(ctx.content);
    return {
      entry: SCENE_KEYS.swap,
      scenes: [
        createSwapScene(ctx, {
          level,
          session,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：该响的鼓还在响，该站的人还站着 —— 人才走得掉
        }),
      ],
    };
  },
});
