import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSplitScene } from '@chags/templates/split';
import { drawAcorn, drawBeat, drawFinale, drawWorld } from './art';
import { splitLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = splitLevel(ctx.content);
    return {
      entry: SCENE_KEYS.split,
      scenes: [
        createSplitScene(ctx, {
          level,
          session,
          titleKey: 'scene.split',
          drawWorld: (g, state) => drawWorld(g, state),
          drawThing: (g, _kind, x, y, filled) => drawAcorn(g, x, y, filled),
          drawFinale: (g) => drawFinale(g, level.initialLeft, level.total),
        }),
      ],
    };
  },
});
