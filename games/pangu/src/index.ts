import type { GameContext, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import {
  SCENE_KEYS,
  createTapScene,
  createPlaceScene,
  createRewardScene,
  createSessionState,
  createStoryScene,
} from '@chags/templates';
import type Phaser from 'phaser';
import { drawBeat, drawOrb, drawPiece } from './art';
import { placeLevel, tapLevel } from './logic';
import { manifest } from './manifest';
import { createChaosScene } from './scenes/chaos';
import { drawHoldFinale, drawHoldStage } from './scenes/hold';

let game: Phaser.Game | null = null;

const gameModule: GameModule = {
  manifest,

  async mount(ctx: GameContext): Promise<void> {
    const tap = tapLevel(ctx.content);
    const place = placeLevel(ctx.content);
    const session = createSessionState(ctx.services.now());

    game = createPhaserGame(ctx, {
      scenes: [
        createStoryScene(ctx, {
          beats: ctx.content.story,
          nextSceneKey: SCENE_KEYS.chaos,
          drawBeat,
        }),
        // 开：连点蛋壳，混沌炸开（这个场景是盘古专属，不进模板库）
        createChaosScene(ctx, { nextSceneKey: SCENE_KEYS.tap, tapsToBreak: 4 }),
        // 撑：把天一点点顶上去，撑够一万八千年
        createTapScene(ctx, {
          level: tap,
          session,
          nextSceneKey: SCENE_KEYS.place,
          titleKey: 'scene.hold',
          drawStage: drawHoldStage,
          drawFinale: drawHoldFinale,
        }),
        // 化：把自己一件件放回世界
        createPlaceScene(ctx, {
          level: place,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          drawPiece,
          drawOrb,
          reveal: ctx.content.keyMoment.reveal,
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
