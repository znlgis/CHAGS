import { SCENE_KEYS, createChainScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, drawWorld } from './art';
import { fankeLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = fankeLevel(ctx.content);
    return {
      entry: SCENE_KEYS.chain,
      scenes: [
        createChainScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 顶栏用典故自己的名字（内容已按语言取好），不另开一套界面文案
          title: ctx.content.title,
          // 这个世界：蜀道、层叠的山、刘璋的营帐与沿途四处岗位
          drawWorld,
          drawStage,
          drawFinale,
          // 关键抉择点的揭晓语：一步一步来，急不得
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
