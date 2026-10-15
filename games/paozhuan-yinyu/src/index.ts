import { SCENE_KEYS, createLureScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { lureLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = lureLevel(ctx.content);
    return {
      entry: SCENE_KEYS.lure,
      scenes: [
        createLureScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：把他引开，路就通了
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
