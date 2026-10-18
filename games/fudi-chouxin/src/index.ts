import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createSiegeScene } from '@chags/templates/siege';
import { drawBeat, drawSupport, drawSupportFinale } from './art';
import { fudiLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = fudiLevel(ctx.content);
    return {
      entry: SCENE_KEYS.siege,
      scenes: [
        createSiegeScene(ctx, {
          level,
          session,
          // 抽走的柴由画面挪到左下角那堆柴上（那是画面的事，不写进纯逻辑）
          drawSupport,
          drawSupportFinale,
          // 关键抉择点的揭晓语：不扑火，把底下的柴抽走
        }),
      ],
    };
  },
});
