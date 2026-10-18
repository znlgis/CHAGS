import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { createPlaceScene } from '@chags/templates/place';
import { createTapScene } from '@chags/templates/tap';
import { drawBeat, drawOrb, drawPiece } from './art';
import { placeLevel, tapLevel } from './logic';
import { manifest } from './manifest';
import { createChaosScene } from './scenes/chaos';
import { drawHoldFinale, drawHoldStage } from './scenes/hold';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => ({
    entry: SCENE_KEYS.chaos,
    scenes: [
      // 开：连点蛋壳，混沌炸开（这个场景是盘古专属，不进模板库）
      createChaosScene(ctx, { nextSceneKey: SCENE_KEYS.tap, tapsToBreak: 4 }),
      // 撑：把天一点点顶上去，撑够一万八千年
      createTapScene(ctx, {
        level: tapLevel(ctx.content),
        session,
        nextSceneKey: SCENE_KEYS.place,
        titleKey: 'scene.hold',
        drawStage: drawHoldStage,
        drawFinale: drawHoldFinale,
      }),
      // 化：把自己一件件放回世界
      createPlaceScene(ctx, {
        level: placeLevel(ctx.content),
        session,
        drawPiece,
        drawOrb,
      }),
    ],
  }),
});
