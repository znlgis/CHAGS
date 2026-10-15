import { SCENE_KEYS, createTwolineScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { twolineLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = twolineLevel(ctx.content);
    return {
      entry: SCENE_KEYS.twoline,
      scenes: [
        createTwolineScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语进典故卡之前再说一遍
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
