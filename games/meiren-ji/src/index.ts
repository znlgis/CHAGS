import { SCENE_KEYS, createLureScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { meirenLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = meirenLevel(ctx.content);
    return {
      entry: SCENE_KEYS.lure,
      scenes: [
        createLureScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 他看过去的那道目光、被他看着的那样东西外面那圈金环，都是画面按 state 演的
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：先弄清他在意什么，再送那一样
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
