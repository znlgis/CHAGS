import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { KeyMoment, KeyMomentOption, StoryBeat } from '@chags/content';
import { BaseScene, CSS, THEME, textStyle } from '@chags/phaser-kit';
import { CHOICE_OPTIONS, CHOICE_QUESTION_Y, CHOICE_TITLE_Y, CHOICE_TOAST_Y, REVEAL_NEXT, SCENE_KEYS, STORY_ART, STORY_NEXT, STORY_TEXT_Y, STORY_TITLE_Y } from './layout';
import type { SessionState } from './session';

export interface StoryConfig {
  beats: StoryBeat[];
  keyMoment: KeyMoment;
  nextSceneKey: string;
  session: SessionState;
  drawBeat?: (
    g: Phaser.GameObjects.Graphics,
    index: number,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
}

/** 分幕绘本 + 关键抉择：先看懂故事，再自己找到那个办法 */
export function createStoryScene(
  ctx: GameContext,
  cfg: StoryConfig,
): Phaser.Types.Scenes.SceneType {
  return class StoryScene extends BaseScene {
    private root: Phaser.GameObjects.Container | null = null;
    private choiceShownAt = 0;

    constructor() {
      super(SCENE_KEYS.story, ctx);
    }

    create(): void {
      this.drawBackdrop('看故事');
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.story });
      this.ctx.emit('session:start', { at: this.ctx.services.now() });
      this.showBeat(0);
    }

    private clearRoot(): void {
      this.root?.destroy(true);
      this.root = null;
    }

    private showBeat(index: number): void {
      const beat = cfg.beats[index];
      if (!beat) {
        this.showChoice();
        return;
      }
      this.ctx.emit('beat:enter', { beatId: beat.id });
      this.clearRoot();

      const container = this.add.container(0, 0);
      this.root = container;

      const panel = this.add.graphics();
      panel.fillStyle(THEME.card, 0.95);
      panel.fillRoundedRect(STORY_ART.x, STORY_ART.y, STORY_ART.w, STORY_ART.h, 36);
      container.add(panel);

      const art = this.add.graphics();
      cfg.drawBeat?.(art, index, STORY_ART);
      container.add(art);

      container.add(
        this.add.text(375, STORY_TITLE_Y, beat.title, textStyle(56, CSS.red, true)).setOrigin(0.5),
      );
      container.add(this.addBody(95, STORY_TEXT_Y, beat.text, 42, CSS.ink, this.W - 190));
      container.add(
        this.add
          .text(375, 1080, index + 1 + ' / ' + cfg.beats.length, textStyle(30, CSS.inkSoft))
          .setOrigin(0.5),
      );
      container.add(
        this.addButton(
          STORY_NEXT.x,
          STORY_NEXT.y,
          index + 1 < cfg.beats.length ? '下一幕' : '想一想',
          () => this.showBeat(index + 1),
        ),
      );

      if (!this.autoplay) this.speak(beat.narration);
      this.fadeIn();

      if (this.autoplay) {
        this.time.delayedCall(120, () => this.showBeat(index + 1));
      }
    }

    private showChoice(): void {
      this.clearRoot();
      const km = cfg.keyMoment;
      const container = this.add.container(0, 0);
      this.root = container;

      container.add(
        this.add.text(375, CHOICE_TITLE_Y, '想一想', textStyle(56, CSS.red, true)).setOrigin(0.5),
      );
      container.add(this.addBody(85, CHOICE_QUESTION_Y, km.question, 42, CSS.ink, this.W - 170));
      this.choiceShownAt = this.ctx.services.now();

      km.options.slice(0, CHOICE_OPTIONS.length).forEach((option, i) => {
        const pos = CHOICE_OPTIONS[i];
        if (!pos) return;
        container.add(
          this.addButton(pos.x, pos.y, option.text, () => this.pick(option), {
            width: 650,
            height: 150,
            color: THEME.teal,
            fontSize: 32,
          }),
        );
      });

      if (!this.autoplay) this.speak(km.question);

      if (this.autoplay) {
        const canonical = km.options.find((o) => o.isCanonical);
        if (canonical) this.time.delayedCall(120, () => this.pick(canonical));
      }
    }

    private pick(option: KeyMomentOption): void {
      const latencyMs = this.ctx.services.now() - this.choiceShownAt;
      this.ctx.emit('choice:made', {
        beatId: cfg.keyMoment.beatId,
        choiceId: option.id,
        correct: option.isCanonical,
        latencyMs,
      });

      if (!option.isCanonical) {
        cfg.session.mistakes += 1;
        this.sfx('wrong');
        this.ctx.emit('hint:used', {
          beatId: cfg.keyMoment.beatId,
          level: cfg.session.mistakes,
        });
        this.showToast(option.hint.length > 0 ? option.hint : '再想一想哦～');
        return;
      }

      this.sfx('correct');
      this.showReveal();
    }

    /** 引导式提示：不直接给答案，只把思路往前推一步 */
    private showToast(message: string): void {
      const toast = this.add
        .text(375, CHOICE_TOAST_Y, message, {
          ...textStyle(34, CSS.white, true),
          backgroundColor: CSS.red,
          padding: { x: 28, y: 16 },
          wordWrap: { width: this.W - 160, useAdvancedWrap: true },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.tweens.add({
        targets: toast,
        alpha: 0,
        delay: 1500,
        duration: 400,
        onComplete: () => toast.destroy(),
      });
    }

    private showReveal(): void {
      this.clearRoot();
      const container = this.add.container(0, 0);
      this.root = container;

      container.add(
        this.add.text(375, 230, '原来是这么做的', textStyle(54, CSS.teal, true)).setOrigin(0.5),
      );
      const panel = this.add.graphics();
      panel.fillStyle(THEME.card, 0.96);
      panel.fillRoundedRect(70, 320, 610, 460, 36);
      container.add(panel);
      container.add(this.addBody(115, 380, cfg.keyMoment.reveal, 44, CSS.ink, 520));
      container.add(
        this.addButton(REVEAL_NEXT.x, REVEAL_NEXT.y, '去动手试试', () => this.go(), {
          color: THEME.red,
        }),
      );

      if (!this.autoplay) this.speak(cfg.keyMoment.reveal);
      if (this.autoplay) this.time.delayedCall(120, () => this.go());
    }

    private go(): void {
      this.scene.start(cfg.nextSceneKey);
    }
  };
}
