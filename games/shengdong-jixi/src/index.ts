import { SCENE_KEYS, createRuseScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawItem, drawStage, drawWorld } from './art';
import { ruseLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = ruseLevel(ctx.content);
    return {
      entry: SCENE_KEYS.ruse,
      scenes: [
        createRuseScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawWorld,
          drawStage,
          drawItem,
          // 这一关没有外壳：靠的是时机
          drawFinale,
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
