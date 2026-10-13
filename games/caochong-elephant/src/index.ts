import type { GameContext, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import { balanceLevel, gradeOfRun } from './logic';
import type Phaser from 'phaser';
import {
  SCENE_KEYS,
  createBalanceScene,
  createQuizScene,
  createRewardScene,
  createSessionState,
  createStoryScene,
} from '@chags/templates';
import { manifest } from './manifest';
import { drawBeat } from './art';

let game: Phaser.Game | null = null;

const gameModule: GameModule = {
  manifest,

  async mount(ctx: GameContext): Promise<void> {
    // 关卡脚本来自内容 JSON，模板只认 schema，不认典故
    const level = balanceLevel(ctx.content.game.levelScript);
    const session = createSessionState(ctx.services.now());
    const grade = gradeOfRun(session);

    game = createPhaserGame(ctx, {
      scenes: [
        createStoryScene(ctx, {
          beats: ctx.content.story,
          keyMoment: ctx.content.keyMoment,
          nextSceneKey: SCENE_KEYS.balance,
          session,
          drawBeat,
        }),
        createBalanceScene(ctx, {
          level,
          nextSceneKey: SCENE_KEYS.quiz,
          session,
        }),
        createQuizScene(ctx, {
          questions: ctx.content.quiz,
          nextSceneKey: SCENE_KEYS.reward,
          session,
        }),
        createRewardScene(ctx, {
          allusionId: ctx.content.id,
          title: ctx.content.title,
          pinyin: ctx.content.pinyin,
          moral: ctx.content.moral,
          keywords: ctx.content.keywords,
          source: ctx.content.source,
          session,
          grade,
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
