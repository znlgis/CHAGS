import type Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, CSS, THEME, roundRect, sparkleAt, textStyle } from '@chags/phaser-kit';
import { REWARD, SCENE_KEYS } from './layout';
import { starsFor } from './session';
import type { SessionState } from './session';

export interface RewardConfig {
  allusionId: string;
  title: string;
  pinyin: string;
  moral: string;
  keywords: string[];
  source: { book: string; quote: string };
  session: SessionState;
}

/** 典故卡：把这一局变成一张可以收集、可以反复看的卡片 */
export function createRewardScene(ctx: GameContext, cfg: RewardConfig): Phaser.Types.Scenes.SceneType {
  return class RewardScene extends BaseScene {
    constructor() {
      super(SCENE_KEYS.reward, ctx);
    }

    create(): void {
      this.drawBackdrop(this.tr('scene.reward'));
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.reward });

      const stars = starsFor(cfg.session);
      const { x, y, w, h } = REWARD.card;

      const panel = this.add.graphics();
      roundRect(panel, x, y, w, h, 46, THEME.card, THEME.outline, 7);
      roundRect(panel, x + 12, y + 12, w - 24, h - 24, 36, THEME.card, THEME.gold, 5);

      this.add.text(this.W / 2, y + 74, cfg.title, textStyle(70, CSS.red, true)).setOrigin(0.5);
      this.add.text(this.W / 2, y + 152, cfg.pinyin, textStyle(30, CSS.inkSoft)).setOrigin(0.5);
      this.add
        .text(this.W / 2, y + 236, '★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(58, CSS.gold, true))
        .setOrigin(0.5);

      this.add
        .text(this.W / 2, y + 350, cfg.moral, {
          ...textStyle(46, CSS.ink, true),
          align: 'center',
          wordWrap: { width: w - 110, useAdvancedWrap: true },
          lineSpacing: 14,
        })
        .setOrigin(0.5);

      this.add
        .text(this.W / 2, y + 560, this.tr('reward.keywords') + '  ' + cfg.keywords.join(' · '), textStyle(34, CSS.teal, true))
        .setOrigin(0.5);

      this.add
        .text(this.W / 2, y + 650, this.tr('reward.source') + ' ' + cfg.source.book, textStyle(28, CSS.inkSoft))
        .setOrigin(0.5);
      this.add
        .text(this.W / 2, y + 706, cfg.source.quote, {
          ...textStyle(30, CSS.inkSoft),
          align: 'center',
          wordWrap: { width: w - 120, useAdvancedWrap: true },
        })
        .setOrigin(0.5);

      this.addButton(REWARD.done.x, REWARD.done.y, this.tr('reward.accept'), () => this.done(), { color: THEME.red });

      sparkleAt(this, this.W / 2, y + 236, THEME.gold, 8);

      const now = this.ctx.services.now();
      this.ctx.emit('card:unlocked', { allusionId: cfg.allusionId, cardId: cfg.allusionId });
      this.ctx.emit('level:complete', {
        levelId: 'main',
        stars,
        mistakes: cfg.session.mistakes,
        correct: cfg.session.correct,
        total: cfg.session.total,
        durationMs: now - cfg.session.startedAt,
      });
      this.sfx('complete');
      if (!this.autoplay) this.speak(cfg.moral);

      if (this.autoplay) this.time.delayedCall(200, () => this.done());
    }

    private done(): void {
      this.ctx.emit('session:exit', { reason: 'complete', progress: 1 });
      this.ctx.requestExit();
    }
  };
}
