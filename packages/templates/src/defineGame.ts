import type { GameContext, GameManifest, GameModule } from '@chags/game-kit';
import { createPhaserGame } from '@chags/phaser-kit';
import type Phaser from 'phaser';
import { SCENE_KEYS } from './layout';
import { createRewardScene } from './reward';
import { createSessionState } from './session';
import type { SessionState } from './session';
import { createStoryScene } from './story';

export interface GameplayStage {
  /** 分幕故事之后进入哪一幕 */
  entry: string;
  /** 中间的玩法场景（一到多个） */
  scenes: Phaser.Types.Scenes.SceneType[];
}

export interface GameDefinition {
  manifest: GameManifest;
  /**
   * 分幕插图：每个典故自己画。
   *
   * **契约只画两幕**：index 只有 0 / 1 —— 内容 schema 已把 story 锁成 length(2)
   * （第 3 幕在 pnpm content:check 构建期就报错），与 game-kit 的 Art 渲染约定一致。
   * 真要写三幕，先扩这份契约与 story.ts 的 StoryConfig；别在 art.ts 里加
   * `index === 2` 分支 —— 契约收窄后内联实现的 index 上下文类型是 0 | 1，
   * 写第三幕会直接 typecheck 报错。
   */
  drawBeat?: (
    g: Phaser.GameObjects.Graphics,
    index: 0 | 1,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
  /** 玩法场景。拿到内容与一局状态，返回这一局的场景编排。 */
  gameplay: (ctx: GameContext, session: SessionState) => GameplayStage;
}

/**
 * 一个典故 = 分幕故事 + 玩法 + 典故卡。
 *
 * 这三段外加生命周期的处理，七个典故**一字不差** —— 之前每个游戏包都抄一遍，
 * 七份 60~120 行的 index.ts 里有 15 行完全相同、典故卡配置也几乎一样。
 * 抄错一处（比如忘了 destroy）不会有任何测试发现，所以收到这里来。
 *
 * 游戏包只剩下"这个典故怎么玩"：怎么画分幕、玩法场景怎么拼。
 */
export function defineGame(definition: GameDefinition): GameModule {
  let game: Phaser.Game | null = null;

  return {
    manifest: definition.manifest,

    async mount(ctx: GameContext): Promise<void> {
      // 关卡脚本的校验在构建期：pnpm content:check 用模板 schema 全量校验 53 条内容
      // （pnpm verify / CI / 发版都跑），单测里的负例也直接对 schema 断言。
      // 这里刻意不做运行时校验 —— 那会把 zod + 全部模板 schema 拖进每个游戏 chunk
      // （实测 116 KB 原始 / 32.8 KB gzip，且只在 dev 用得上）。
      const session = createSessionState(ctx.services.now());
      const stage = definition.gameplay(ctx, session);

      game = createPhaserGame(ctx, {
        scenes: [
          createStoryScene(ctx, {
            beats: ctx.content.story,
            nextSceneKey: stage.entry,
            drawBeat: definition.drawBeat,
          }),
          ...stage.scenes,
          createRewardScene(ctx, {
            entryId: ctx.content.id,
            title: ctx.content.title,
            pinyin: ctx.content.pinyin,
            moral: ctx.content.moral,
            keywords: ctx.content.keywords,
            source: ctx.content.source,
            session,
            transfer: ctx.content.transfer,
            thinkingTag: ctx.content.thinkingTag,
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
}

export { SCENE_KEYS };
