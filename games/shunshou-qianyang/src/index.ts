import { SCENE_KEYS, createWindowScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawWorld } from './art';
import { windowLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = windowLevel(ctx.content);
    return {
      entry: SCENE_KEYS.window,
      scenes: [
        createWindowScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 顶栏用典故自己的名字（内容已按语言取好）
          title: ctx.content.title,
          drawWorld: (g, state) => drawWorld(g, state, level.jobs),
          drawFinale: (g) => drawFinale(g),
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
