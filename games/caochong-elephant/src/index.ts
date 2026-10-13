import type { GameContext, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import {
  SCENE_KEYS,
  createRewardScene,
  createSessionState,
  createStoryScene,
  createSubstitutionScene,
} from '@chags/templates';
import type Phaser from 'phaser';
import { drawBeat, drawElephant } from './art';
import { substitutionLevel } from './logic';
import { manifest } from './manifest';

let game: Phaser.Game | null = null;

const gameModule: GameModule = {
  manifest,

  async mount(ctx: GameContext): Promise<void> {
    // 关卡脚本来自内容 JSON；模板只认 schema，不认典故
    const level = substitutionLevel(ctx.content);
    const session = createSessionState(ctx.services.now());

    game = createPhaserGame(ctx, {
      scenes: [
        createStoryScene(ctx, {
          beats: ctx.content.story,
          nextSceneKey: SCENE_KEYS.substitution,
          drawBeat,
        }),
        createSubstitutionScene(ctx, {
          level,
          session,
          nextSceneKey: SCENE_KEYS.reward,
          reveal: ctx.content.keyMoment.reveal,
          drawHeavy: (g, scale) => drawElephant(g, 0, 0, scale),
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
