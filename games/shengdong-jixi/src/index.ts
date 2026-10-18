import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createRuseScene } from '@chags/templates/ruse';
import { drawBeat, drawFinale, drawItem, drawStage, drawWorld } from './art';
import { ruseLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = ruseLevel(ctx.content);
    return {
      entry: SCENE_KEYS.ruse,
      scenes: [
        createRuseScene(ctx, {
          level,
          session,
          drawWorld,
          drawStage,
          drawItem,
          // 这一关没有外壳：靠的是时机
          drawFinale,
        }),
      ],
    };
  },
});
