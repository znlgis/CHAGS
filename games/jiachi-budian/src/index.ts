import { SCENE_KEYS, createStillnessScene, defineGame } from '@chags/templates';
import { drawBeat, drawFeign, drawFeignFinale } from './art';
import { jiachiLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = jiachiLevel(ctx.content);
    return {
      entry: SCENE_KEYS.stillness,
      scenes: [
        createStillnessScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          // 灯笼扫过来、孙膑忍住、竹简多一道 —— 都是画面按 state 演的（不写进纯逻辑）
          drawWorld: drawFeign,
          drawFinale: drawFeignFinale,
          // 关键抉择点的揭晓语：忍住不出声，才留得住那一小段空档
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
