import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, CSS, THEME, createHand, roundRect, sparkleAt, textStyle,
} from '@chags/phaser-kit';
import { TAP, SCENE_KEYS } from './layout';
import {
  advanceHold, comboLevel, easedProgress, isTapComplete, pendingMilestones, progressFor,
} from './tap.logic';
import type { TapLevel } from './schemas';
import type { SessionState } from './session';

export interface TapStageMetrics {
  width: number;
  height: number;
  /** 原始进度 0..1 */
  progress: number;
  /** 缓动后的进度 —— 画面按这个画，才有"越到后面越吃力"的感觉 */
  eased: number;
  /** 当前累计值 */
  value: number;
  complete: boolean;
}

export interface TapMilestoneApi {
  /** 暂停推进（例如愚公换代时要等玩家点"交接"） */
  pause(): void;
  resume(): void;
  /** 游戏插入自己的交互（换代按钮、智叟）时用 */
  readonly scene: Phaser.Scene;
}

export interface TapConfig {
  level: TapLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏标题 */
  titleKey: MessageKey;
  /**
   * 画面完全由游戏决定。
   * 模板只提供"连点/长按推进"这套循环 —— 盘古撑天、精卫填海、愚公挖山、夸父追日
   * 共用同一套逻辑，画面却毫不相干。
   */
  drawStage: (g: Phaser.GameObjects.Graphics, stage: TapStageMetrics) => void;
  /** 完成时的收尾表现（可选） */
  drawFinale?: (g: Phaser.GameObjects.Graphics, stage: TapStageMetrics) => void;
  /** 里程碑：游戏接管，处理完调用 api.resume() 继续 */
  onMilestone?: (id: string, api: TapMilestoneApi) => void;
  finaleHoldMs?: number;
}

export function createTapScene(ctx: GameContext, cfg: TapConfig): Phaser.Types.Scenes.SceneType {
  return class TapScene extends BaseScene {
    private value = 0;
    private stage: Phaser.GameObjects.Graphics | null = null;
    private finale: Phaser.GameObjects.Graphics | null = null;
    private counterText: Phaser.GameObjects.Text | null = null;
    private counterPill: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    private holding = false;
    private started = false;
    private finished = false;
    private paused = false;
    private firing = false;
    private fired: string[] = [];
    private lastInputAt = 0;
    private idleMs = 0;
    private hintShown = false;

    constructor() {
      super(SCENE_KEYS.tap, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.tap });
      this.drawBackdrop(this.tr(cfg.titleKey));

      this.stage = this.add.graphics().setDepth(2);
      this.finale = this.add.graphics().setDepth(3);
      this.counterPill = this.add.graphics().setDepth(50);
      this.counterText = this.add
        .text(this.W / 2, TAP.counterY, '', textStyle(66, CSS.ink, true))
        .setOrigin(0.5)
        .setDepth(51);

      this.hand = createHand(this, this.W / 2, this.H - 230, 1.25);

      if (cfg.level.mode === 'tap') {
        this.input.on('pointerdown', () => this.tap());
      } else {
        // 长按：松手就停，会有"追不上"的紧张感
        this.input.on('pointerdown', () => {
          this.holding = true;
        });
        this.input.on('pointerup', () => {
          this.holding = false;
        });
        this.input.on('pointerupoutside', () => {
          this.holding = false;
        });
      }

      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.step(delta),
      );

      this.lastInputAt = this.ctx.services.now();
      this.redraw();
      this.fadeIn();

      if (this.autoplay) this.runAutoplay();
    }

    // ---------------- 输入 ----------------

    private tap(): void {
      if (this.finished || this.paused) return;
      const now = this.ctx.services.now();
      const combo = this.lastInputAt === 0 ? 0 : comboLevel(now - this.lastInputAt);
      this.lastInputAt = now;
      this.setValue(Math.min(cfg.level.targetValue, this.value + cfg.level.stepValue), true);
      if (combo >= 2) sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, combo);
      this.cameras.main.shake(60, 0.0015);
    }

    private step(delta: number): void {
      if (this.finished || this.paused) return;

      if (cfg.level.mode === 'hold') {
        if (!this.holding) return;
        this.setValue(advanceHold(this.value, cfg.level, delta), false);
        return;
      }

      // 连点模式下，长时间没动作就给点提示（图形为主，文字为辅）
      this.idleMs += delta;
      if (this.idleMs > 6500 && !this.hintShown) {
        this.hintShown = true;
        this.showHint(cfg.level.hint);
      }
    }

    private setValue(next: number, fromTap: boolean): void {
      if (next === this.value) return;
      this.value = next;
      this.idleMs = 0;
      this.idleMs = 0;

      if (fromTap) {
        this.ctx.services.audio.tone(300 + easedProgress(this.value, cfg.level) * 520, 90);
      }
      if (!this.started) {
        this.started = true;
        this.hand?.destroy();
        this.hand = null;
      }

      this.redraw();
      this.fireMilestones();
      if (isTapComplete(this.value, cfg.level)) this.complete();
    }

    // ---------------- 画面 ----------------

    private metrics(complete: boolean): TapStageMetrics {
      return {
        width: this.W,
        height: this.H,
        progress: progressFor(this.value, cfg.level),
        eased: easedProgress(this.value, cfg.level),
        value: this.value,
        complete,
      };
    }

    private redraw(): void {
      this.stage?.clear();
      if (this.stage) cfg.drawStage(this.stage, this.metrics(false));

      const text = this.counterText;
      const pill = this.counterPill;
      if (!text || !pill) return;
      text.setText(this.value + ' ' + cfg.level.unit);
      const w = text.width + 76;
      const h = text.height + 36;
      pill.clear();
      roundRect(pill, this.W / 2 - w / 2, TAP.counterY - h / 2, w, h, h / 2, THEME.card, THEME.outline, 6);
    }

    // ---------------- 里程碑 ----------------

    private fireMilestones(): void {
      if (this.firing) return;
      const due = pendingMilestones(cfg.level, this.value, this.fired);
      const id = due[0];
      if (id === undefined) return;
      this.fired.push(id);
      if (!cfg.onMilestone) return;

      this.firing = true;
      cfg.onMilestone(id, {
        pause: () => {
          this.paused = true;
        },
        resume: () => {
          this.paused = false;
          this.firing = false;
          this.lastInputAt = this.ctx.services.now();
          this.idleMs = 0;
        },
        scene: this,
      });
    }

    private complete(): void {
      if (this.finished) return;
      this.finished = true;
      this.ctx.emit('beat:enter', { beatId: 'complete' });
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 10);

      this.finale?.clear();
      if (this.finale) cfg.drawFinale?.(this.finale, this.metrics(true));

      this.time.delayedCall(cfg.finaleHoldMs ?? 2000, () => this.scene.start(cfg.nextSceneKey));
    }

    // ---------------- 自动通关（无头验证用） ----------------

    private runAutoplay(): void {
      if (cfg.level.mode === 'hold') {
        this.holding = true;
        return;
      }
      // 用循环定时器而不是固定次数：里程碑可能暂停推进
      this.time.addEvent({
        delay: 80,
        loop: true,
        callback: () => {
          if (!this.finished && !this.paused) this.tap();
        },
      });
    }
  };
}
