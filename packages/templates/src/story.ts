import type Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { StoryBeat } from '@chags/content';
import { BaseScene, CSS, THEME, roundRect, textStyle } from '@chags/phaser-kit';
import { SCENE_KEYS, STORY_ART, STORY_TEXT_WRAP, STORY_TEXT_Y, STORY_TITLE_Y } from './layout';

export interface StoryConfig {
  beats: StoryBeat[];
  nextSceneKey: string;
  drawBeat?: (
    g: Phaser.GameObjects.Graphics,
    index: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
}

/**
 * 开场：一屏一个画面、一句话，点哪都行。
 * 不再有“下一幕”按钮和文字选择题 —— 故事只用来看懂“问题是什么”，
 * 真正的“怎么解决”留给后面的动手环节。
 */
export function createStoryScene(
  ctx: GameContext,
  cfg: StoryConfig,
): Phaser.Types.Scenes.SceneType {
  return class StoryScene extends BaseScene {
    constructor() {
      super(SCENE_KEYS.story, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.story });
      this.ctx.emit('session:start', { at: this.ctx.services.now() });
      this.showBeat(0);
    }

    private showBeat(index: number): void {
      const beat = cfg.beats[index];
      if (!beat) {
        this.scene.start(cfg.nextSceneKey);
        return;
      }
      this.children.removeAll(true);
      this.drawBackdrop(this.tr('scene.story'));
      this.ctx.emit('beat:enter', { beatId: beat.id });

      // 插画面板
      const panel = this.add.graphics();
      roundRect(
        panel,
        STORY_ART.x - 8,
        STORY_ART.y - 8,
        STORY_ART.w + 16,
        STORY_ART.h + 16,
        44,
        THEME.card,
        THEME.outline,
        6,
      );
      const art = this.add.graphics();
      cfg.drawBeat?.(art, index, STORY_ART);

      let textBottom = STORY_TEXT_Y;
      if (beat.text.length > 0) {
        this.add
          .text(this.W / 2, STORY_TITLE_Y, beat.title, textStyle(58, CSS.red, true))
          .setOrigin(0.5);
        const body = this.add
          .text(this.W / 2, STORY_TEXT_Y, beat.text, {
            ...textStyle(44, CSS.ink, true),
            align: 'center',
            wordWrap: { width: STORY_TEXT_WRAP, useAdvancedWrap: true },
            lineSpacing: 14,
          })
          .setOrigin(0.5, 0);
        textBottom = body.y + body.height;
      }

      if (!this.autoplay) this.speak(beat.narration);
      // 小手跟在正文下面；实在放不下（很长的英文句子）就挪到右下角
      const below = Math.max(this.H - 150, textBottom + 64);
      this.tapToContinue(
        () => this.showBeat(index + 1),
        below <= this.H - 72 ? { y: below } : { x: this.W - 104, y: this.H - 104 },
      );
    }
  };
}
