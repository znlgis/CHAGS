import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createStillnessScene } from '@chags/templates/stillness';
import { drawBeat, drawFinale, drawWorld } from './art';
import { stillnessLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = stillnessLevel(ctx.content);
    return {
      entry: SCENE_KEYS.stillness,
      scenes: [
        createStillnessScene(ctx, {
          level,
          session,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          drawWorld: (g, state) => drawWorld(g, state, level.beats, level.action),
          drawFinale: (g) => drawFinale(g),
        }),
      ],
    };
  },
});
