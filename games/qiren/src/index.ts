import { SCENE_KEYS, createPlaceScene, defineGame } from '@chags/templates';
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
        nextSceneKey: SCENE_KEYS.reward,
        drawPiece,
        drawOrb,
        reveal: ctx.content.keyMoment.reveal,
        // 四个泡泡都破了：黑云散开，星光安静地亮着
        drawFinale: (g, placedIds) => drawFinale(g, placedIds),
      }),
    ],
  }),
});
