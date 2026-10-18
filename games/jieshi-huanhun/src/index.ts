import { createBorrowScene } from '@chags/templates/borrow';
import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { drawBanner, drawBannerFinale, drawBeat } from './art';
import { bannerLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,
  gameplay: (ctx, session) => {
    const level = bannerLevel(ctx.content);
    return {
      entry: SCENE_KEYS.borrow,
      scenes: [
        createBorrowScene(ctx, {
          level,
          session,
          // 画面上没有尸体：只有一面旧旗、一根旗杆和一群散掉的人
          drawBanner: (g, stage) => drawBanner(g, stage, level),
          drawBannerFinale: (g, stage) => drawBannerFinale(g, stage, level),
        }),
      ],
    };
  },
});
