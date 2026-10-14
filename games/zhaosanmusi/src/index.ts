import { SCENE_KEYS, createSplitScene, defineGame } from '@chags/templates';
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
          nextSceneKey: SCENE_KEYS.reward,
          titleKey: 'scene.split',
          drawWorld: (g, state) => drawWorld(g, state),
          drawThing: (g, _kind, x, y, filled) => drawAcorn(g, x, y, filled),
          drawFinale: (g) => drawFinale(g, level.initialLeft, level.total),
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
