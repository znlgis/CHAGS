import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS, WAIT, resolveEnding } from './layout';
import {
  applyTemptation, effectiveDuration, lineAt, waitProgress, waitStart,
} from './wait.logic';
import type { WaitState } from './wait.logic';
import type { WaitLevel, WaitTemptation } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

export interface WaitStageMetrics {
  width: number;
  height: number;
  /** 已经等了多久 */
  elapsedMs: number;
  /** 还要等多久 */
  remainingMs: number;
  /** 0..1：日影走到哪儿了 */
  progress: number;
  /** 被诱惑往后推了多久 */
  penaltyMs: number;
  /** 点了几次诱惑 */
  hits: number;
  /** 他来了 —— 该把直钩收起来了 */
  arrived: boolean;
  /** 收钩做完了 */
  done: boolean;
}

export interface WaitConfig {
  level: WaitLevel;
  session: SessionState;
  nextSceneKey?: string;
  /**
   * 顶栏上的名字，二选一：
   * - `title`：直接给文本（三十六计这种"顶栏要显示计名"的用它，内容已按语言取好）；
   * - `titleKey`：给界面文案键（太公钓鱼用 "等一等"）。
   */
  title?: string;
  titleKey?: MessageKey;
  /** 渭水、石头、老人、鱼群 */
  drawWorld?: (scene: Phaser.Scene) => void;
  /** 每帧重画：日影、车马的位置都按 metrics 来 */
  drawStage: (g: Phaser.GameObjects.Graphics, metrics: WaitStageMetrics) => void;
  /** 点了诱惑：老人做一个动作（游戏画），做完调 done() */
  onTemptation?: (temptation: WaitTemptation, api: { scene: Phaser.Scene; done: () => void }) => void;
  /** 其它点击（水面、云、老人）—— 支线，纯好玩，不推进主线 */
  onTap?: (x: number, y: number, api: { scene: Phaser.Scene }) => void;
  /** 他来了 */
  onArrive?: (api: { scene: Phaser.Scene }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics) => void;
  reveal?: string;
  revealY?: number;
  finaleHoldMs?: number;
}

/**
 * 等：这条玩法的主线只有一件事 —— 等。
 *
 * 三条刻意的设计：
 * - **按墙钟算**（不累加帧间隔）：慢手机、CI 上"等了 45 秒"就是 45 秒。这是夸父那次的教训。
 * - **诱惑只是分心**：点了就往后推一点，但推满上限只回应、不再延后 —— 不存在玩不下去。
 * - **最后一件事是动作**：等到了要自己把直钩收起来，不然这一场白等。
 */
export function createWaitScene(ctx: GameContext, cfg: WaitConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class WaitScene extends BaseScene {
    private durationMs = 0;
    private state: WaitState = waitStart();
    private startedAt = 0;
    private index = 0;
    private arrived = false;
    private done = false;
    private busy = false;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.wait, ctx);
    }


    /** 这一局实际要等多久（无头验证时缩短） */
    private get lv(): WaitLevel {
      return this.durationMs === cfg.level.durationMs
        ? cfg.level
        : { ...cfg.level, durationMs: this.durationMs };
    }

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    private metrics(): WaitStageMetrics {
      const elapsedMs = this.elapsed();
      const required = this.durationMs + this.state.penaltyMs;
      return {
        width: this.W,
        height: this.H,
        elapsedMs,
        remainingMs: Math.max(0, required - elapsedMs),
        progress: waitProgress(this.lv, this.state, elapsedMs),
        penaltyMs: this.state.penaltyMs,
        hits: this.state.hits,
        arrived: this.arrived,
        done: this.done,
      };
    }

    // ---------------- 输入 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.busy || this.done) return;
      this.idleMs = 0;

      const temptation = cfg.level.temptations.find(
        (t) => Math.hypot(pointer.x - t.x, pointer.y - t.y) <= WAIT.temptationRadius,
      );
      if (temptation) {
        this.takeTemptation(temptation);
        return;
      }
      if (
        this.arrived &&
        Math.hypot(pointer.x - cfg.level.finale.x, pointer.y - cfg.level.finale.y) <=
          cfg.level.finale.radius
      ) {
        this.collect();
        return;
      }
      const listener = cfg.level.listener;
      if (
        listener &&
        Math.hypot(pointer.x - listener.x, pointer.y - listener.y) <= listener.radius
      ) {
        this.sayLine();
        return;
      }
      cfg.onTap?.(pointer.x, pointer.y, { scene: this });
    }

    /** 点了诱惑：多等一会儿。上限之后只回应，不再延后 */
    private takeTemptation(temptation: WaitTemptation): void {
      this.busy = true;
      this.state = applyTemptation(this.lv, this.state, temptation.penaltyMs);
      this.ctx.emit('beat:enter', { beatId: 'tempt:' + temptation.id });
      this.sfx('tap');
      this.showHint(temptation.line, 2600, 250);
      this.speak(temptation.line);
      const done = (): void => {
        this.busy = false;
        this.idleMs = 0;
      };
      if (cfg.onTemptation) cfg.onTemptation(temptation, { scene: this, done });
      else this.time.delayedCall(700, done);
    }

    /** 点老人：听他说一句（支线，不影响进度，也不影响等待时间） */
    private sayLine(): void {
      const line = lineAt(cfg.level, this.index);
      this.index += 1;
      this.sfx('tap');
      this.showHint(line, 2400, 250);
      this.speak(line);
    }

    // ---------------- 等到与收钩 ----------------

    private arrive(): void {
      if (this.arrived) return;
      this.arrived = true;
      this.sfx('unlock');
      this.ctx.emit('beat:enter', { beatId: 'wait:arrived' });
      this.cameras.main.flash(260, 255, 250, 220);
      cfg.onArrive?.({ scene: this });

      // 等他收起直钩：给一只手 + 一圈呼吸的光环
      const { x, y, radius } = cfg.level.finale;
      this.ring = this.add.graphics().setDepth(60);
      this.ring.lineStyle(9, THEME.gold, 0.95);
      this.ring.strokeCircle(x, y, radius);
      this.tweens.add({
        targets: this.ring, scale: 1.16, alpha: 0.4,
        duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.hand = createHand(this, x, y + 90, 1.2);

      // 兜底：一直不点也会自己收钩 —— 绝不会卡在这里
      this.time.delayedCall(this.autoplay ? 500 : WAIT.fallbackMs, () => this.collect());
    }

    private collect(): void {
      if (this.done) return;
      this.done = true;
      this.ring?.destroy();
      this.ring = null;
      if (this.hand) {
        this.tweens.killTweensOf(this.hand);
        this.hand.destroy();
        this.hand = null;
      }
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);
      recordAttempt(cfg.session, { ok: true });
      if (this.finaleGfx) cfg.drawFinale?.(this.finaleGfx);
      this.time.delayedCall(1400, () =>
        this.showHint(ending.reveal, 3200, cfg.revealY ?? 268),
      );
      this.time.delayedCall(cfg.finaleHoldMs ?? 4400, () => this.scene.start(ending.nextSceneKey));
    }

    // ---------------- 每帧 ----------------


    /** 无头验证：全程不碰诱惑，等到他来了就把直钩收起来 */
    private runAutoplay(): void {
      this.time.delayedCall(200, () => {
        if (!this.arrived) this.time.delayedCall(this.durationMs + 300, () => this.collect());
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (this.done) return;
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, this.metrics());
      }
      if (!this.arrived && this.elapsed() >= this.durationMs + this.state.penaltyMs) {
        this.arrive();
        return;
      }
      if (this.busy || this.arrived) return;
      this.idleMs += delta;
      if (this.idleMs < WAIT.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint);
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.wait });
      this.durationMs = effectiveDuration(cfg.level, this.autoplay, WAIT.autoplayFactor);
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.tr(cfg.titleKey ?? 'scene.wait'));
      cfg.drawWorld?.(this);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );
      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }
  };
}
