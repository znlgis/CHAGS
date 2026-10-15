import { SCENE_KEYS, createRuseScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawItem, drawShell, drawStage, drawWorld } from './art';
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
          drawShell,
          drawFinale,
          // 关键抉择点的揭晓语进典故卡之前再说一遍
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
