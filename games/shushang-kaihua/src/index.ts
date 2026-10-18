import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createShowScene } from '@chags/templates/show';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { shushangLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = shushangLevel(ctx.content);
    return {
      entry: SCENE_KEYS.show,
      scenes: [
        createShowScene(ctx, {
          level,
          session,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          // 这个世界：河、桥、对岸的林子与土坡、天边的追兵
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：树上的花是借来的
        }),
      ],
    };
  },
});
