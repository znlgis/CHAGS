import type { GameContext, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import {
  SCENE_KEYS,
  createRewardScene,
  createSessionState,
  createStoryScene,
  createTapScene,
} from '@chags/templates';
import type Phaser from 'phaser';
import { drawBeat, drawFinale, drawStage } from './art';
import { tapLevel } from './logic';
import { manifest } from './manifest';

let game: Phaser.Game | null = null;

const gameModule: GameModule = {
  manifest,

  async mount(ctx: GameContext): Promise<void> {
    const level = tapLevel(ctx.content);
    const session = createSessionState(ctx.services.now());

    let elapsed = 0;
    let drinking = false;

    game = createPhaserGame(ctx, {
      scenes: [
        createStoryScene(ctx, {
          beats: ctx.content.story,
          nextSceneKey: SCENE_KEYS.tap,
          drawBeat,
        }),
        createTapScene(ctx, {
          level,
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
        createRewardScene(ctx, {
          allusionId: ctx.content.id,
          title: ctx.content.title,
          pinyin: ctx.content.pinyin,
          moral: ctx.content.moral,
          keywords: ctx.content.keywords,
          source: ctx.content.source,
          session,
        }),
      ],
    });
  },

  async unmount(): Promise<void> {
    game?.destroy(true);
    game = null;
  },

  pause(): void {
    game?.loop.sleep();
  },

  resume(): void {
    game?.loop.wake();
  },
};

export default gameModule;
