import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSwapScene } from '@chags/templates/swap';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { touliangLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = touliangLevel(ctx.content);
    return {
      entry: SCENE_KEYS.swap,
      scenes: [
        createSwapScene(ctx, {
          level,
          session,
          // 柱子被按住时那圈进度、清点的灯柱、新柱立起来的那一下，都是画面按 state 演的
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：关键的那一根换好了，别的都还立着
        }),
      ],
    };
  },
});
