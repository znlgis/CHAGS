import { SCENE_KEYS, createProbeScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { qinzeiLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = qinzeiLevel(ctx.content);
    return {
      entry: SCENE_KEYS.probe,
      scenes: [
        createProbeScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：找出关键的那一个（不是打倒他）
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
