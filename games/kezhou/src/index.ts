import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createMarkScene } from '@chags/templates/mark';
import { drawBeat, drawFinale, drawWorld } from './art';
import { WATER_TOP } from './layout';
import { markLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => ({
    entry: SCENE_KEYS.mark,
    scenes: [
      createMarkScene(ctx, {
        level: markLevel(ctx.content),
        session,
        titleKey: 'scene.mark',
        waterY: WATER_TOP,
        drawWorld: (g, state) => drawWorld(g, state),
        drawFinale: (g, state) => drawFinale(g, state),
      }),
    ],
  }),
});
