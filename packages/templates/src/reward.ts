import type Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, CSS, THEME, textStyle } from '@chags/phaser-kit';
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
  grade: 0 | 1 | 2 | 3;
}

/** 典故卡：把这一局变成一张可以收集、可以反复看的卡片 */
export function createRewardScene(ctx: GameContext, cfg: RewardConfig): Phaser.Types.Scenes.SceneType {
  return class RewardScene extends BaseScene {
    constructor() {
      super(SCENE_KEYS.reward, ctx);
    }

    create(): void {
      this.drawBackdrop('典故卡');
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.reward });
      const stars = starsFor(cfg.session);
      const { x, y, w, h } = REWARD.card;

      const panel = this.add.graphics();
      panel.fillStyle(THEME.card, 0.98);
      panel.fillRoundedRect(x, y, w, h, 40);
      panel.lineStyle(6, THEME.gold, 1);
      panel.strokeRoundedRect(x, y, w, h, 40);

      this.add.text(375, y + 60, cfg.title, textStyle(64, CSS.red, true)).setOrigin(0.5);
      this.add.text(375, y + 130, cfg.pinyin, textStyle(28, CSS.inkSoft)).setOrigin(0.5);
      this.add
        .text(375, y + 200, '★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(52, CSS.gold, true))
        .setOrigin(0.5);

      this.addBody(x + 45, y + 280, cfg.moral, 44, CSS.ink, w - 90, true);
      this.addBody(
        x + 45,
        y + 420,
        '关键词：' + cfg.keywords.join(' · '),
        32,
        CSS.teal,
        w - 90,
      );
      this.addBody(x + 45, y + 500, '出处：' + cfg.source.book, 28, CSS.inkSoft, w - 90);
      this.addBody(x + 45, y + 560, cfg.source.quote, 30, CSS.ink, w - 90);

      this.addButton(REWARD.done.x, REWARD.done.y, '完成', () => this.done(), { color: THEME.red });

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
      this.fadeIn();

      if (this.autoplay) this.time.delayedCall(200, () => this.done());
    }

    private done(): void {
      this.ctx.emit('session:exit', { reason: 'complete', progress: 1 });
      this.ctx.requestExit();
    }
  };
}
