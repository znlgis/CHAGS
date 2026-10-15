import { SCENE_KEYS, createSiegeScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage, playWithdraw } from './art';
import { siegeLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = siegeLevel(ctx.content);
    // 回防的兵马从哪一刻出发：画面用它画一次过场（不写进纯逻辑）
    const relievedAt = new Map<string, number>();
    let elapsed = 0;

    return {
      entry: SCENE_KEYS.siege,
      scenes: [
        createSiegeScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          onFrame: (_stage, delta) => {
            elapsed += delta;
          },
          onRelieve: (vital, api) => {
            relievedAt.set(vital.id, elapsed);
            playWithdraw(api.scene, vital, level);
          },
          drawStage: (g, stage) => drawStage(g, stage, level),
          drawFinale: (g, stage) => drawFinale(g, stage, level),
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
