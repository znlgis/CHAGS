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
    // 精卫一直在飞，所以场景需要自己累计时间
    let elapsed = 0;

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
          titleKey: 'scene.fill',
          onFrame: (_stage, delta) => {
            elapsed += delta;
          },
          drawStage: (g, stage) => drawStage(g, stage, elapsed),
          drawFinale: (g) => drawFinale(g),
          finaleHoldMs: 2400,
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
