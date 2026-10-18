import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createTapScene } from '@chags/templates/tap';
import { drawBeat, drawFinale, drawStage } from './art';
import { tapLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => {
    // 精卫一直在飞，所以场景需要自己累计时间
    let elapsed = 0;

    return {
      entry: SCENE_KEYS.tap,
      scenes: [
        createTapScene(ctx, {
          level: tapLevel(ctx.content),
          session,
          titleKey: 'scene.fill',
          onFrame: (_stage, delta) => {
            elapsed += delta;
          },
          drawStage: (g, stage) => drawStage(g, stage, elapsed),
          drawFinale: (g) => drawFinale(g),
          finaleHoldMs: 2400,
        }),
      ],
    };
  },
});
