import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createStillnessScene } from '@chags/templates/stillness';
import { drawBeat, drawFinale, drawWorld } from './art';
import { kongchengLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = kongchengLevel(ctx.content);
    return {
      entry: SCENE_KEYS.stillness,
      scenes: [
        createStillnessScene(ctx, {
          level,
          session,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          // 他盯着看的那道目光、两扇营门的开合、动一下留下的记号，都是画面按 state 演的
          drawWorld,
          drawFinale,
          // 关键抉择点的揭晓语：越是紧张，越不能乱动
        }),
      ],
    };
  },
});
