import type Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, CSS, THEME, roundRect, sparkleAt, textStyle } from '@chags/phaser-kit';
import { REWARD, SCENE_KEYS } from './layout';
import { starsFor } from './session';
import type { SessionState } from './session';

export interface RewardConfig {
  entryId: string;
  title: string;
  pinyin: string;
  moral: string;
  keywords: string[];
  source: { book: string; quote: string };
  session: SessionState;
  /** 三十六计的正向迁移（孩子/家长看得见）；典故没有这一步 */
  transfer?: string;
  /** 思维标签（2–6 字），例如「留退路」 */
  thinkingTag?: string;
}

/**
 * 典故卡：把这一局变成一张可以收集、可以反复看的卡片。
 *
 * 版面必须**先量后排**：中文五六个字，英文可能三十个字母，
 * 早期用固定纵坐标排，英文版直接糊成一团（标题出框、星星压住寓意、出处压在原文上）。
 */
export function createRewardScene(ctx: GameContext, cfg: RewardConfig): Phaser.Types.Scenes.SceneType {
  return class RewardScene extends BaseScene {
    constructor() {
      super(SCENE_KEYS.reward, ctx);
    }

    create(): void {
      this.drawBackdrop(this.tr('scene.reward'));
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.reward });

      const stars = starsFor(cfg.session);
      const innerW = REWARD.cardW - REWARD.cardPad * 2;

      const block = (
        content: string,
        style: Phaser.Types.GameObjects.Text.TextStyle,
        wrap = true,
      ): Phaser.GameObjects.Text =>
        this.add
          .text(0, 0, content, {
            ...style,
            align: 'center',
            wordWrap: wrap ? { width: innerW, useAdvancedWrap: true } : undefined,
            lineSpacing: 10,
          })
          .setOrigin(0.5, 0);

      // 顺序即版面顺序；换行宽度统一按卡片内宽，任何语言都不会出框
      const blocks: Phaser.GameObjects.Text[] = [
        block(cfg.title, textStyle(52, CSS.red, true)),
        block(cfg.pinyin, textStyle(28, CSS.inkSoft), false),
        block('★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(48, CSS.goldDeep, true), false),
        // 星星不是评分羞辱，而是一句可理解的反馈：为什么这局少一颗、再来一次会怎样
        block(
          cfg.session.mistakes >= 2
            ? this.tr('reward.starsWhy', { n: Math.max(2, cfg.session.mistakes) })
            : this.tr('reward.starsFull'),
          textStyle(26, CSS.inkSoft, true),
        ),
        block(cfg.moral, textStyle(38, CSS.ink, true)),
        ...(cfg.transfer === undefined
          ? []
          : [block(this.tr('reward.transfer') + '  ' + cfg.transfer, textStyle(28, CSS.tealDeep, true))]),
        block(this.tr('reward.keywords') + '  ' + cfg.keywords.join(' · '), textStyle(28, CSS.tealDeep, true)),
        block(this.tr('reward.source') + '  ' + cfg.source.book, textStyle(28, CSS.inkSoft)),
        block(cfg.source.quote, textStyle(26, CSS.inkSoft)),
      ];
      // 间距按块数给：最后一个永远是 0（贴底），其余按行高微调
      const gapAfter = blocks.map((_, index) => (index === blocks.length - 1 ? 0 : 8));

      let contentH = 0;
      blocks.forEach((item, index) => {
        contentH += item.height + (gapAfter[index] ?? 0);
      });

      const available = REWARD.regionBottom - REWARD.regionTop;
      const cardH = Math.min(contentH + REWARD.cardPad * 2, available);
      // 内容实在放不下时整体等比缩小 —— 宁可小一点，也绝不重叠
      const scale = Math.min(1, (cardH - REWARD.cardPad * 2) / Math.max(1, contentH));
      const cardTop = REWARD.regionTop + Math.max(0, (available - cardH) / 2);

      const card = this.add.graphics().setDepth(0);
      roundRect(card, REWARD.cardX, cardTop, REWARD.cardW, cardH, 46, THEME.card, THEME.outline, 7);
      roundRect(
        card,
        REWARD.cardX + 12,
        cardTop + 12,
        REWARD.cardW - 24,
        cardH - 24,
        36,
        THEME.card,
        THEME.gold,
        5,
      );

      // 卡片是按实测高度后画的，所以文字必须抬到它上面
      let cursor = cardTop + REWARD.cardPad;
      blocks.forEach((item, index) => {
        item.setScale(scale).setPosition(this.W / 2, cursor).setDepth(2);
        cursor += (item.height + (gapAfter[index] ?? 0)) * scale;
      });

      // 两个按钮并排：左边「再来一次」把"想再玩"从 6+ 步缩成 1 步；右边「收下」回游戏馆。
      // 位置固定，自动化用例直接按坐标点。
      this.addButton(
        REWARD.done.x - 168,
        REWARD.done.y,
        this.tr('reward.again'),
        () => this.replay(),
        { width: 288, height: 104, fontSize: 38, color: THEME.teal },
      );
      this.addButton(REWARD.done.x + 168, REWARD.done.y, this.tr('reward.accept'), () => this.done(), {
        width: 288,
        height: 104,
        fontSize: 38,
        color: THEME.red,
      });

      const starLine = blocks[2];
      if (starLine) sparkleAt(this, this.W / 2, starLine.y + starLine.height / 2, THEME.gold, 8);

      const now = this.ctx.services.now();
      this.ctx.emit('card:unlocked', { entryId: cfg.entryId, cardId: cfg.entryId });
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

      // ?card=hold：自动通关也停在卡片上（双语版面巡检要拍卡面）
      if (this.autoplay && this.ctx.debug?.cardHold !== true) {
        this.time.delayedCall(200, () => this.done());
      }
    }

    private done(): void {
      this.ctx.emit('session:exit', { reason: 'complete', progress: 1 });
      this.ctx.requestExit();
    }

    /** 原地再开一局：外壳会重新 mount 这一部游戏，不用回大厅再找一遍 */
    private replay(): void {
      this.ctx.emit('session:exit', { reason: 'replay', progress: 1 });
      this.ctx.requestExit('replay');
    }
  };
}
