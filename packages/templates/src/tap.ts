import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import {
  BaseScene, CSS, THEME, createHand, roundRect, sparkleAt, textStyle,
} from '@chags/phaser-kit';
import { TAP, SCENE_KEYS, resolveEnding } from './layout';
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
  nextSceneKey?: string;
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
  /**
   * 每帧回调。给需要持续动画的游戏用：
   * 精卫的鸟一直在飞、夸父的太阳一直在跑 —— 都不该只在"数值变化"时才动。
   */
  onFrame?: (stage: TapStageMetrics, delta: number) => void;
  /** 每次推进后回调：连点模式下"这一下做了什么" */
  onAdvance?: (stage: TapStageMetrics) => void;
  finaleHoldMs?: number;
}

export function createTapScene(ctx: GameContext, cfg: TapConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class TapScene extends BaseScene {
    private value = 0;
    private stage: Phaser.GameObjects.Graphics | null = null;
    private finale: Phaser.GameObjects.Graphics | null = null;
    private counterText: Phaser.GameObjects.Text | null = null;
    private counterPill: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    private holding = false;
    /** 现在按着的手指数：多点触控下，抬起其中一根不能算"松手"（长按玩法会断） */
    private readonly holdPointers = new Set<number>();
    private started = false;
    private finished = false;
    private paused = false;
    private firing = false;
    private fired: string[] = [];
    private lastInputAt = 0;
    private idleMs = 0;
    /** 长按模式下"已经按住多久"：用来决定小手什么时候才收起来 */
    private heldMs = 0;
    /** 这一次按住的起点（墙钟 + 那一刻的数值），松手后重新记 */
    private holdStartedAt = 0;
    private holdStartValue = 0;

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
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.holdPointers.add(pointer.id);
          // 第二根手指落下时不要重置起点，否则进度会从"此刻"重新算、白按一段
          if (this.holding) return;
          this.holding = true;
          // 记下起点，之后**按墙钟时间**算进度，不再累加帧间隔。
          // Phaser 在帧率低时会钳制 delta，慢机器上"按住 6 秒"累积不到 6 秒的进度 ——
          // 而旧安卓手机正是目标用户。CI 上就是卡在这里：按住 3.4 秒到不了 45%。
          this.holdStartedAt = this.ctx.services.now();
          this.holdStartValue = this.value;
        });
        // 手指一根一根抬：还有手指按着就继续算"按住"（孩子常用两根拇指交替按）
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.releaseHold(pointer));
        this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) =>
          this.releaseHold(pointer),
        );
      }

      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.lastInputAt = this.ctx.services.now();
      this.redraw();
      this.fadeIn();

      if (this.autoplay) this.runAutoplay();
    }

    // ---------------- 输入 ----------------

    /** 松手：只在自己这根手指抬起、且没有别的手指按着时才算真的松手 */
    private releaseHold(pointer: Phaser.Input.Pointer): void {
      this.holdPointers.delete(pointer.id);
      if (this.holdPointers.size === 0) this.holding = false;
    }

    private tap(): void {
      // 暂停（里程碑等玩家点一下）时不再静默：给一声回应，孩子才知道"屏幕收到了，
      // 只是现在要等这一步"；真正的恢复由游戏自己注册的 pointerdown 负责。
      if (this.paused) {
        this.tapAck();
        return;
      }
      if (this.finished) return;
      const now = this.ctx.services.now();
      const combo = this.lastInputAt === 0 ? 0 : comboLevel(now - this.lastInputAt);
      this.lastInputAt = now;
      this.setValue(Math.min(cfg.level.targetValue, this.value + cfg.level.stepValue), true);
      if (combo >= 2) sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, combo);
      this.cameras.main.shake(60, 0.0015);
    }

    /** 每帧：推进（长按模式）→ 让游戏动起来 → 重画 */
    private tick(delta: number): void {
      if (this.finished) return;

      if (!this.paused) {
        if (cfg.level.mode === 'hold' && this.holding) {
          this.heldMs = this.ctx.services.now() - this.holdStartedAt;
          this.setValue(advanceHold(this.holdStartValue, cfg.level, this.heldMs), false);
        } else {
          this.heldMs = 0;
        }

        // 长时间没有推进就给提示 —— **两种模式都要**。
        // 之前这段只写在连点分支里，于是长按模式（夸父）永远不提示：
        // 孩子只会点不会按的话，点一下只涨 30，要 60 下才满，而他完全不知道问题在哪。
        this.idleMs += delta;
        if (this.idleMs > 8000) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint);
          // 光有文字小朋友不一定看得懂，把小手找回来
          this.updateHand(true);
        }
      }

      cfg.onFrame?.(this.metrics(false), delta);
      this.redraw();
    }

    /** 小手的显隐：会玩了就收起，卡住了再拿出来 */
    private updateHand(show: boolean): void {
      if (show && !this.hand) {
        this.hand = createHand(this, this.W / 2, this.H - 230, 1.25);
      } else if (!show && this.hand) {
        this.hand.destroy();
        this.hand = null;
      }
    }

    private setValue(next: number, fromTap: boolean): void {
      if (next === this.value) return;
      this.value = next;
      this.idleMs = 0;

      if (fromTap) {
        this.ctx.services.audio.tone(300 + easedProgress(this.value, cfg.level) * 520, 90);
      }

      // 长按模式要按住一会儿才算"会了"。否则孩子按一下、小手立刻消失，
      // 松手之后就再也看不到该怎么玩 —— 这正是夸父最容易卡住的地方。
      if (!this.started && (cfg.level.mode === 'tap' || this.heldMs > 420)) {
        this.started = true;
        this.updateHand(false);
      }

      const stage = this.metrics(false);
      cfg.onAdvance?.(stage);
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
      // 每帧都会重画，但计数只在数值变化时才动（避免每帧重建文字纹理）。
      // 必须取整：长按模式按时间累加，直接显示会冒出 814.967999999994 这种小数。
      const label = Math.round(this.value) + ' ' + cfg.level.unit;
      if (text.text !== label) text.setText(label);
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
      // 必须发事件：否则"暂停有没有生效、id 有没有接错"全靠肉眼看 ——
      // 把 pause 删掉、把三条里程碑合成一条，所有测试都会绿。
      this.ctx.emit('beat:enter', { beatId: 'milestone:' + id });
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
      // 先刷新一次画面：完成后 tick 会提前返回，否则计数会停在上一次的值
      this.redraw();
      this.ctx.emit('beat:enter', { beatId: 'complete' });
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 10);

      this.finale?.clear();
      if (this.finale) cfg.drawFinale?.(this.finale, this.metrics(true));

      this.time.delayedCall(cfg.finaleHoldMs ?? 2000, () => this.scene.start(ending.nextSceneKey));
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
