import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { drawBeat } from './art';
import { butcherLevel } from './logic';
import { manifest } from './manifest';
import { createButcherScene } from './scenes/butcher';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => ({
    entry: SCENE_KEYS.butcher,
    scenes: [
      createButcherScene(ctx, {
        level: butcherLevel(ctx.content),
        session,
        nextSceneKey: SCENE_KEYS.reward,
        titleKey: 'scene.butcher',
        reveal: ctx.content.keyMoment.reveal,
      }),
    ],
  }),
});
