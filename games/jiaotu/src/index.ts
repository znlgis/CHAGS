import { createBurrowScene } from '@chags/templates/burrow';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { drawBeat, drawFinale, drawWorld } from './art';
import { burrowLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = burrowLevel(ctx.content);
    return {
      entry: SCENE_KEYS.burrow,
      scenes: [
        createBurrowScene(ctx, {
          level,
          session,
          titleKey: 'scene.burrow',
          drawWorld: (g, state) => drawWorld(g, state, level.spots),
          drawFinale: (g) => drawFinale(g, level.spots),
        }),
      ],
    };
  },
});
