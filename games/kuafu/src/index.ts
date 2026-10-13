import { SCENE_KEYS, createTapScene, defineGame } from '@chags/templates';
import { drawBeat, drawFinale, drawStage } from './art';
import { tapLevel } from './logic';
import { manifest } from './manifest';

export default defineGame({
  manifest,
  drawBeat,

  gameplay: (ctx, session) => {
    let elapsed = 0;
    let drinking = false;

    return {
      entry: SCENE_KEYS.tap,
      scenes: [
        createTapScene(ctx, {
          level: tapLevel(ctx.content),
          session,
          nextSceneKey: SCENE_KEYS.reward,
          titleKey: 'scene.chase',
          onFrame: (_stage, delta) => {
            elapsed += delta;
          },
          drawStage: (g, stage) => drawStage(g, stage, elapsed, drinking),
          drawFinale: (g, stage) => drawFinale(g, stage),
          // 追到河渭：停下来喝一口，点一下再接着追
          onMilestone: (id, api) => {
            if (id !== 'river') {
              api.resume();
              return;
            }
            drinking = true;
            ctx.services.audio.play('splash');

            // 自动通关时不能等玩家点，否则会卡死
            if (ctx.debug?.autoplay === true) {
              api.scene.time.delayedCall(300, () => {
                drinking = false;
                api.resume();
              });
              return;
            }

            api.pause();
            // 延后一帧再监听：当前这次 pointerdown 还在派发中，立刻监听会被它自己触发
            api.scene.time.delayedCall(180, () => {
              api.scene.input.once('pointerdown', () => {
                drinking = false;
                api.resume();
              });
            });
          },
          finaleHoldMs: 3000,
        }),
      ],
    };
  },
});
