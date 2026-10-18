import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { MARK, SCENE_KEYS, resolveEnding } from './layout';
import { hintSurface, markResult, surfaceAt, surfaceWorldX } from './mark.logic';
import type { MarkLevel, MarkSurface } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

export type MarkPhase = 'carve' | 'drift' | 'dive' | 'done';

/** 交给游戏画的一切：江、两岸、水底的剑、船（按 driftPx 摆位置） */
export interface MarkStageState {
  phase: MarkPhase;
  /** 船已经漂了多远（世界像素） */
  driftPx: number;
  /** 这一次刻在哪个面上 */
  markedId: string | null;
  /** 已经刻过的所有面（画刻痕用） */
  marks: string[];
  /** 此刻下水的位置（世界 x），没下水时为 null */
  divingAt: number | null;
  attempts: number;
  result: 'found' | 'miss' | null;
}

export interface MarkConfig {
  level: MarkLevel;
  session: SessionState;
  nextSceneKey?: string;
  titleKey: MessageKey;
  /** 水面高度：下水时的涟漪画在这儿 */
  waterY: number;
  /** 这个世界：江水、两岸、水底的剑、船（船的位置 = 会漂的那个面的世界坐标） */
  drawWorld: (g: Phaser.GameObjects.Graphics, state: MarkStageState) => void;
  /** 剑出水 / 空手而归：由游戏补一点自己的表演（可选） */
  onResult?: (result: 'found' | 'miss', api: { scene: Phaser.Scene }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: MarkStageState) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 在会动的世界上做记号。
 *
 * 三条刻意的设计：
 * - **剑一直在画面里**：它掉在哪儿，孩子从头到尾看得见 —— 这是整个典故的视觉论证。
 * - **记号会跟着走**：刻在船帮上的刻痕随船漂移，肉眼可见"记号动了"。
 * - **零失败**：捞空了不算输，船回到上游重来；再刻的时候，对的那个面会发光。
 */
export function createMarkScene(ctx: GameContext, cfg: MarkConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class MarkScene extends BaseScene {
    private state: MarkStageState = {
      phase: 'carve',
      driftPx: 0,
      markedId: null,
      marks: [],
      divingAt: null,
      attempts: 0,
      result: null,
    };
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private fxGfx: Phaser.GameObjects.Graphics | null = null;
    private hintRing: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;
    private busy = false;
    private finished = false;

    constructor() {
      super(SCENE_KEYS.mark, ctx);
    }


    // ---------------- 画面 ----------------

    private redraw(): void {
      const g = this.worldGfx;
      if (!g) return;
      g.clear();
      cfg.drawWorld(g, this.state);
    }

    // ---------------- 输入 ----------------

    private onTap(pointer: Phaser.Input.Pointer): void {
      if (this.busy || this.finished || this.state.phase !== 'carve') return;
      const surface = surfaceAt(pointer.x, pointer.y, cfg.level, MARK.carveForgive);
      if (surface) this.carve(surface);
    }

    /** 刻一道痕（真实操作与无头验证走的是同一条路） */
    private carve(surface: MarkSurface): void {
      if (this.busy || this.finished) return;
      this.busy = true;
      this.idleMs = 0;
      this.hideHand();
      this.clearRing();
      if (!this.state.marks.includes(surface.id)) this.state.marks.push(surface.id);
      this.state.markedId = surface.id;
      this.state.result = null;
      this.sfx('correct');
      this.speak(surface.speak);
      sparkleAt(this, surface.x, surface.y, THEME.gold, 5);
      this.ctx.emit('beat:enter', { beatId: 'mark:carve:' + surface.id });
      this.redraw();
      this.time.delayedCall(MARK.carveHoldMs, () => this.startDrift());
    }

    // ---------------- 漂 ----------------

    private startDrift(): void {
      if (this.finished) return;
      this.state.phase = 'drift';
      this.redraw();
      const duration = this.autoplay
        ? Math.max(240, cfg.level.driftMs / MARK.autoplayFactor)
        : cfg.level.driftMs;
      this.tweens.addCounter({
        from: 0,
        to: cfg.level.driftDistance,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          this.state.driftPx = tween.getValue() ?? 0;
          this.redraw();
        },
        onComplete: () => {
          this.state.driftPx = cfg.level.driftDistance;
          this.startDive();
        },
      });
    }

    // ---------------- 下水捞 ----------------

    private startDive(): void {
      if (this.finished) return;
      this.state.phase = 'dive';
      const surface = cfg.level.surfaces.find((s) => s.id === this.state.markedId);
      this.state.divingAt = surface ? surfaceWorldX(surface, this.state.driftPx) : cfg.level.sword.x;
      this.redraw();
      this.rippleAt(this.state.divingAt);
      this.sfx('splash');
      this.time.delayedCall(MARK.diveMs, () => this.resolve());
    }

    private resolve(): void {
      if (this.finished) return;
      const surface = cfg.level.surfaces.find((s) => s.id === this.state.markedId);
      const result = surface ? markResult(surface, this.state.driftPx, cfg.level) : 'miss';
      this.state.result = result;
      this.redraw();

      if (result === 'found') {
        this.state.phase = 'done';
        recordAttempt(cfg.session, { ok: true });
        this.sfx('complete');
        sparkleAt(this, cfg.level.sword.x, cfg.level.sword.y, THEME.gold, 10);
        cfg.onResult?.('found', { scene: this });
        this.ctx.emit('beat:enter', { beatId: 'mark:result:found' });
        this.finish();
        return;
      }

      // 捞空：不结束、不锁操作，船回到上游重来；这一下记进 mistakes（只影响星数与复习间隔）
      recordAttempt(cfg.session, { ok: false });
      this.sfx('wrong');
      cfg.onResult?.('miss', { scene: this });
      this.ctx.emit('beat:enter', { beatId: 'mark:result:miss' });
      this.showHint(cfg.level.missLine, 2600, 300);
      const hold = this.autoplay ? 600 : MARK.retryHoldMs;
      this.time.delayedCall(hold, () => this.retry());
    }

    private retry(): void {
      if (this.finished) return;
      this.state.attempts += 1;
      this.state.marks = [];
      this.state.markedId = null;
      this.state.divingAt = null;
      this.state.result = null;
      this.state.phase = 'carve';
      this.ctx.emit('beat:enter', { beatId: 'mark:retry' });

      const from = this.state.driftPx;
      if (from <= 0) {
        this.readyForCarve();
        return;
      }
      this.tweens.addCounter({
        from,
        to: 0,
        duration: this.autoplay ? 260 : 900,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          this.state.driftPx = tween.getValue() ?? 0;
          this.redraw();
        },
        onComplete: () => {
          this.state.driftPx = 0;
          this.redraw();
          this.readyForCarve();
        },
      });
    }

    private readyForCarve(): void {
      this.busy = false;
      this.idleMs = 0;
      // 捞空过一次之后，把对的那个面指给孩子看 —— 零失败。
      // 注意：要按"这一次船会漂多远"来算，而不是此刻（此刻船还在上游，什么记号都够得着）
      if (this.state.attempts > 0) {
        this.showRingAt(hintSurface(cfg.level, cfg.level.driftDistance));
      }
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.hideHand();
      this.clearRing();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? 4200,
        sfx: false,
        reveal: ending.reveal,
        revealY: 300,
        finalize: () => {
          const finale = this.add.graphics().setDepth(40);
          cfg.drawFinale?.(finale, this.state);
        }
      });
    }

    // ---------------- 提示 ----------------


    private showRingAt(surface: MarkSurface | undefined): void {
      if (!surface) return;
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(surface.x, surface.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, surface.radius + 26);
      this.hintRing = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.16,
        alpha: 0.35,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    private clearRing(): void {
      if (!this.hintRing) return;
      this.tweens.killTweensOf(this.hintRing);
      this.hintRing.destroy();
      this.hintRing = null;
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    /** 下水点的一圈涟漪 */
    private rippleAt(x: number): void {
      const g = this.fxGfx;
      if (!g) return;
      g.clear();
      g.lineStyle(6, THEME.paper, 0.9);
      g.strokeEllipse(x, cfg.waterY, 120, 34);
      this.tweens.add({
        targets: g,
        alpha: 0.2,
        duration: 900,
        onComplete: () => {
          g.clear();
          g.setAlpha(1);
        },
      });
    }

    // ---------------- 无头验证 ----------------

    /**
     * 走的是和真实操作同一条路：**先按故事里的做法刻在船上（会漂），捞空一次**，
     * 再刻到不会动的地方 —— 这样无头验证覆盖的是完整的一来一回，而不是抄近路。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          if (this.finished || this.busy || this.state.phase !== 'carve') return;
          // 第一次照故事里的做法刻在船上（会漂），捞空一次之后改刻不会动的地方。
          // 判断"哪个面管用"必须按漂完之后的位置算 —— 这才是这一次刻记号的结果。
          const target =
            this.state.attempts === 0
              ? cfg.level.surfaces.find((s) => s.drifts)
              : hintSurface(cfg.level, cfg.level.driftDistance);
          if (target && !this.state.marks.includes(target.id)) this.carve(target);
        },
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (this.finished || this.busy || this.state.phase !== 'carve') return;
      this.idleMs += delta;
      if (this.idleMs < MARK.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint);
      const target =
        this.state.attempts > 0
          ? hintSurface(cfg.level, cfg.level.driftDistance)
          : cfg.level.surfaces.find((s) => s.drifts);
      if (!target) return;
      this.showRingAt(target);
      if (!this.hand) this.hand = createHand(this, target.x, target.y - 120, 1.15);
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.mark });
      this.drawBackdrop(this.tr(cfg.titleKey));

      this.worldGfx = this.add.graphics().setDepth(2);
      this.fxGfx = this.add.graphics().setDepth(60);
      this.redraw();

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onTap(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }
  };
}
