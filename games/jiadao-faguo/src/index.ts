import { SCENE_KEYS, createChainScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { jiadaoLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = jiadaoLevel(ctx.content);
    return {
      entry: SCENE_KEYS.chain,
      scenes: [
        createChainScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          // 这个世界：晋营、虞帐、三处关口、虢都，还有那条借来的路
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：借出去的路，回来时可能对着自己
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
