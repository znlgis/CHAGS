import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createReadScene } from '@chags/templates/read';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { readLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = readLevel(ctx.content);
    return {
      entry: SCENE_KEYS.read,
      scenes: [
        createReadScene(ctx, {
          level,
          session,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：看动作，不是听好话
        }),
      ],
    };
  },
});
