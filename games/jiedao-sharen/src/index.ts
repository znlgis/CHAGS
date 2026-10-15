import { SCENE_KEYS, createBorrowScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage } from './art';
import { borrowLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = borrowLevel(ctx.content);
    // 水车转不转、绳子绷不绷，都靠这一局的节拍（不写进纯逻辑）
    let elapsed = 0;

    return {
      entry: SCENE_KEYS.borrow,
      scenes: [
        createBorrowScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          onFrame: (_stage, delta) => {
            elapsed += delta;
          },
          drawStage: (g, stage) => drawStage(g, stage, level, elapsed),
          drawFinale: (g, stage) => drawFinale(g, stage, level),
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
