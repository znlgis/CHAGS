import { createChainScene } from '@chags/templates/chain';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { lianhuanLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = lianhuanLevel(ctx.content);
    return {
      entry: SCENE_KEYS.chain,
      scenes: [
        createChainScene(ctx, {
          level,
          session,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          // 这个世界：夜里的江面、南岸的火种、四环连环的船团与它们之间的铁索
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：一件事接一件事地安排，中间不断
        }),
      ],
    };
  },
});
