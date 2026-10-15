import { SCENE_KEYS, createReadScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { readLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = readLevel(ctx.content);
    return {
      entry: SCENE_KEYS.read,
      scenes: [
        createReadScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：看动作，不是听好话
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
