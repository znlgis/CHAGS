import { SCENE_KEYS, createSiegeScene, defineGame } from '@chags/templates';
import { drawBeat, drawClose, drawCloseFinale } from './art';
import { guanmenLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = guanmenLevel(ctx.content);
    return {
      entry: SCENE_KEYS.siege,
      scenes: [
        createSiegeScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          // 门在转、贼在跑，都是画面按 metrics 演的（不写进纯逻辑）
          drawClose,
          drawCloseFinale,
          // 关键抉择点的揭晓语：门先关好，贼再想跑也没路
          reveal: ctx.content.keyMoment.reveal,
        }),
      ],
    };
  },
});
