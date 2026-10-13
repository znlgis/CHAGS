import type { GameContext, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import {
  SCENE_KEYS,
  createPlaceScene,
  createRewardScene,
  createSessionState,
  createStoryScene,
} from '@chags/templates';
import type Phaser from 'phaser';
import { drawBeat, drawFinale, drawOrb, drawPiece } from './art';
import { placeLevel } from './logic';
import { manifest } from './manifest';

let game: Phaser.Game | null = null;

const gameModule: GameModule = {
  manifest,

  async mount(ctx: GameContext): Promise<void> {
    const level = placeLevel(ctx.content);
    const session = createSessionState(ctx.services.now());

    game = createPhaserGame(ctx, {
      scenes: [
        createStoryScene(ctx, {
          beats: ctx.content.story,
          nextSceneKey: SCENE_KEYS.place,
          drawBeat,
        }),
        createPlaceScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawPiece,
          drawOrb,
          reveal: ctx.content.keyMoment.reveal,
          drawFinale: (g, placedIds) => drawFinale(g, placedIds),
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
