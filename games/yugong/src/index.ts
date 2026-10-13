import type { GameContext, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import {
  SCENE_KEYS,
  createRewardScene,
  createSessionState,
  createStoryScene,
  createTapScene,
} from '@chags/templates';
import type { TapMilestoneApi } from '@chags/templates';
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
    let generation = 1;
    let zhisou = false;
    let handover = false;

    /** 里程碑要么等玩家点一下，要么（自动通关时）自己放行 —— 绝不能卡死 */
    const waitForTap = (api: TapMilestoneApi, done: () => void): void => {
      if (ctx.debug?.autoplay === true) {
        api.scene.time.delayedCall(320, done);
        return;
      }
      api.pause();
      // 延后一帧再监听：当前这次 pointerdown 还在派发中，立刻监听会被它自己触发
      api.scene.time.delayedCall(180, () => {
        api.scene.input.once('pointerdown', done);
      });
    };

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
          titleKey: 'scene.dig',
          onFrame: (_stage, delta) => {
            elapsed += delta;
          },
          drawStage: (g, stage) => drawStage(g, stage, elapsed, generation, zhisou, handover),
          drawFinale: (g, stage) => drawFinale(g, stage),
          onMilestone: (id, api) => {
            if (id === 'zhisou') {
              // 河曲智叟来嘲笑他。玩家继续挖，他摇着头走开。
              zhisou = true;
              ctx.services.audio.play('wrong');
              waitForTap(api, () => {
                zhisou = false;
                api.resume();
              });
              return;
            }

            // 一代挖不完，把锄头交给下一代
            handover = true;
            waitForTap(api, () => {
              handover = false;
              generation += 1;
              ctx.services.audio.play('unlock');
              api.resume();
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
