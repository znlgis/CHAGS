import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSubstitutionScene } from '@chags/templates/substitution';
import { drawBeat, drawElephant } from './art';
import { substitutionLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => ({
    entry: SCENE_KEYS.substitution,
    scenes: [
      createSubstitutionScene(ctx, {
        level: substitutionLevel(ctx.content),
        session,
        drawHeavy: (g, scale) => drawElephant(g, 0, 0, scale),
      }),
    ],
  }),
});
