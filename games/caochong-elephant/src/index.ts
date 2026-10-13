import { SCENE_KEYS, createSubstitutionScene, defineGame } from '@chags/templates';
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
        nextSceneKey: SCENE_KEYS.reward,
        reveal: ctx.content.keyMoment.reveal,
        drawHeavy: (g, scale) => drawElephant(g, 0, 0, scale),
      }),
    ],
  }),
});
