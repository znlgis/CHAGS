import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createPlaceScene } from '@chags/templates/place';
import { drawBeat, drawFinale, drawOrb, drawPiece } from './art';
import { placeLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => ({
    entry: SCENE_KEYS.place,
    scenes: [
      createPlaceScene(ctx, {
        level: placeLevel(ctx.content),
        session,
        drawPiece,
        drawOrb,
        // 补完天，五色霞光洒向大地
        drawFinale: (g, placedIds) => drawFinale(g, placedIds),
      }),
    ],
  }),
});
