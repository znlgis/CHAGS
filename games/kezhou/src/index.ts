import { SCENE_KEYS, createMarkScene, defineGame } from '@chags/templates';
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
        nextSceneKey: SCENE_KEYS.reward,
        titleKey: 'scene.mark',
        waterY: WATER_TOP,
        drawWorld: (g, state) => drawWorld(g, state),
        drawFinale: (g, state) => drawFinale(g, state),
        reveal: ctx.content.keyMoment.reveal,
      }),
    ],
  }),
});
