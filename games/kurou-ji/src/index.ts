import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSplitScene } from '@chags/templates/split';
import { drawBeat, drawFinale, drawThing, drawWorld } from './art';
import { splitLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = splitLevel(ctx.content);
    return {
      entry: SCENE_KEYS.split,
      scenes: [
        createSplitScene(ctx, {
          level,
          session,
          // 顶栏显示计名（计策游戏的口径与第五辑一致）；titleKey 仍是模板要求的兜底
          titleKey: 'scene.split',
          title: ctx.content.title,
          // 这个世界：两岸、望楼上的探子、我们自己营里的粮囤
          drawWorld,
          // 绳上挂着的每一袋粮
          drawThing,
          drawFinale,
          // 关键抉择点的揭晓语：看见了，才肯信
        }),
      ],
    };
  },
});
