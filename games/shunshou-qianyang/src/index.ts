import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createWindowScene } from '@chags/templates/window';
import { drawBeat, drawFinale, drawWorld } from './art';
import { windowLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = windowLevel(ctx.content);
    return {
      entry: SCENE_KEYS.window,
      scenes: [
        createWindowScene(ctx, {
          level,
          session,
          // 顶栏用典故自己的名字（内容已按语言取好）
          title: ctx.content.title,
          drawWorld: (g, state) => drawWorld(g, state, level.jobs),
          drawFinale: (g) => drawFinale(g),
        }),
      ],
    };
  },
});
