import { defineGame, SCENE_KEYS } from '@chags/templates/core';
import { drawBeat } from './art';
import { beaconLevel } from './logic';
import { manifest } from './manifest';
import { createBeaconScene } from './scenes/beacon';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => ({
    entry: SCENE_KEYS.beacon,
    scenes: [
      // 夜里的烽火：点一次，她笑一次；点到第三次，天边就空了
      createBeaconScene(ctx, {
        level: beaconLevel(ctx.content),
        session,
        nextSceneKey: SCENE_KEYS.reward,
        reveal: ctx.content.keyMoment.reveal,
      }),
    ],
  }),
});
