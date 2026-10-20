import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import type { MessageKey } from '@chags/i18n';
import { BaseScene, THEME, createGestureGuard, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS, TRACE, resolveEnding } from './layout';
import {
  advanceTrace, currentTarget, isTraceComplete, traceProgress, traceStart,
} from './trace.logic';
import type { TraceCursor, TracePoint } from './trace.logic';
import type { TraceLevel, TraceSegment } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

export interface TraceStageMetrics {
  width: number;
  height: number;
  /** 正在划第几段 */
  segment: number;
  /** 这一段已经过了几个锚点 */
  anchor: number;
  /** 整体进度 0..1 */
  progress: number;
  /** 已经划出来的轨迹：画水流、画田埂都用它 */
  path: TracePoint[];
  complete: boolean;
}

export interface TraceConfig {
  level: TraceLevel;
  session: SessionState;
  nextSceneKey?: string;
  titleKey: MessageKey;
  /** 顶栏上的名字；不传就用 titleKey 的界面文案（计策游戏传自己的计名，与第五辑一致） */
  title?: string;
  /** 这个世界长什么样：洪水、山、村庄 */
  drawWorld?: (scene: Phaser.Scene) => void;
  /** 每帧重画：水位、流水、露出来的土地都按 metrics 画 */
  drawStage: (g: Phaser.GameObjects.Graphics, stage: TraceStageMetrics) => void;
  /** 划完一段的演出（水退一格、山裂开、路过家门），做完调 done() */
  onSegmentDone?: (segment: TraceSegment, api: { scene: Phaser.Scene; done: () => void }) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics) => void;
  reveal?: string;
  revealY?: number;
  finaleHoldMs?: number;
  /** 划出来的河道长什么样（默认：泥土外沿 + 水色内芯） */
  stroke?: { outer: number; inner: number; width: number };
}

/**
 * 划路：手指从这一头划到那一头，水就顺着走。
 *
 * 三条刻意的设计：
 * - **零失败**：划歪、划断都不算错，接着划就是；已经过的锚点不会退回去。
 * - **只看顺序，不看手感**：判定是"有没有按顺序到过锚点"，不是"画得像不像"。
 * - **画面全外置**：水怎么流、山怎么裂，都由游戏按 metrics 自己画。
 */
export function createTraceScene(ctx: GameContext, cfg: TraceConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  const stroke = cfg.stroke ?? { outer: 0x8a6a2f, inner: 0x7cc6e8, width: TRACE.channelWidth };

  return class TraceScene extends BaseScene {
    private cursor: TraceCursor = traceStart();
    private path: TracePoint[] = [];
    private lastPoint: TracePoint | null = null;
    private drawing = false;
    /** 这一笔属于哪根手指（多点触控下别的手指不能接走） */
    private readonly gesture = createGestureGuard();
    private busy = false;
    private finished = false;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private strokeGfx: Phaser.GameObjects.Graphics | null = null;
    private guideLine: Phaser.GameObjects.Graphics | null = null;
    private guideRing: Phaser.GameObjects.Graphics | null = null;
    private guideTween: Phaser.Tweens.Tween | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.trace, ctx);
    }


    // ---------------- 输入 ----------------

    private beginStroke(pointer: Phaser.Input.Pointer): void {
      if (this.busy || this.finished) return;
      // 多点触控：一笔只属于一根手指，别的手指不能把线接走
      if (!this.gesture.begin(pointer)) return;
      this.drawing = true;
      this.idleMs = 0;
      this.hideHand();
      const point = { x: pointer.x, y: pointer.y };
      this.lastPoint = point;
      this.path = [point];
      this.redraw();
    }

    private moveStroke(pointer: Phaser.Input.Pointer): void {
      if (!this.drawing || this.busy || this.finished) return;
      if (!this.gesture.isActive(pointer)) return;
      this.advance({ x: pointer.x, y: pointer.y });
    }

    private endStroke(pointer?: Phaser.Input.Pointer): void {
      // 只认正在画的那根手指抬起
      if (pointer) {
        if (!this.gesture.isActive(pointer)) return;
        this.gesture.end(pointer);
      }
      this.drawing = false;
      this.lastPoint = null;
    }

    /** 推进一格（真实操作与无头验证走的是同一条路） */
    private advance(point: TracePoint): void {
      const before = this.cursor;
      const next = advanceTrace(cfg.level, before, point, this.lastPoint ?? undefined);
      this.lastPoint = point;
      this.path.push(point);
      if (next === before) {
        // 没推进就只让笔迹跟着手指走，别每帧重建提示
        this.redrawStroke();
        return;
      }

      const target = currentTarget(cfg.level, before);
      if (target) {
        this.sfx('tap');
        sparkleAt(this, target.x, target.y, THEME.teal, 4);
        this.ctx.emit('beat:enter', {
          beatId: 'trace:' + (cfg.level.segments[before.segment]?.id ?? before.segment) + ':' + before.anchor,
        });
      }
      this.cursor = next;
      this.idleMs = 0;
      if (next.segment > before.segment) {
        this.finishSegment(before.segment);
        return;
      }
      this.redraw();
    }

    // ---------------- 阶段与收尾 ----------------

    private finishSegment(index: number): void {
      this.busy = true;
      this.drawing = false;
      this.hideHand();
      this.clearGuide();
      const segment = cfg.level.segments[index];
      this.sfx('correct');
      this.cameras.main.shake(160, 0.002);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.teal, 8);
      recordAttempt(cfg.session, { ok: true });

      const done = (): void => {
        this.path = [];
        this.lastPoint = null;
        this.busy = false;
        this.idleMs = 0;
        this.redraw();
        if (isTraceComplete(cfg.level, this.cursor)) this.finish();
      };

      if (!segment || !cfg.onSegmentDone) {
        this.time.delayedCall(700, done);
        return;
      }
      cfg.onSegmentDone(segment, { scene: this, done });
    }

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearGuide();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? 4200,
        sparkle: { x: this.W / 2, y: this.H / 2, color: THEME.gold, count: 12 },
        reveal: ending.reveal,
        revealY: cfg.revealY ?? 268,
        finalize: () => {
          if (this.finaleGfx) cfg.drawFinale?.(this.finaleGfx);
        }
      });
    }

    // ---------------- 画面 ----------------

    private metrics(): TraceStageMetrics {
      return {
        width: this.W,
        height: this.H,
        segment: this.cursor.segment,
        anchor: this.cursor.anchor,
        progress: traceProgress(cfg.level, this.cursor),
        path: this.path,
        complete: this.finished,
      };
    }

    private redraw(): void {
      this.redrawStage();
      this.redrawStroke();
      this.redrawGuide();
    }

    /** 舞台每帧重画：水要流起来，不能只在数值变化时才动 */
    private redrawStage(): void {
      if (!this.stageGfx) return;
      this.stageGfx.clear();
      cfg.drawStage(this.stageGfx, this.metrics());
    }

    private redrawStroke(): void {
      const g = this.strokeGfx;
      if (!g) return;
      g.clear();
      if (this.path.length < 2) return;
      g.lineStyle(stroke.width + 10, THEME.outline, 0.75);
      this.tracePath(g);
      g.lineStyle(stroke.width, stroke.outer, 1);
      this.tracePath(g);
      g.lineStyle(stroke.width * 0.45, stroke.inner, 1);
      this.tracePath(g);
    }

    private tracePath(g: Phaser.GameObjects.Graphics): void {
      g.beginPath();
      this.path.forEach((point, index) => {
        if (index === 0) g.moveTo(point.x, point.y);
        else g.lineTo(point.x, point.y);
      });
      g.strokePath();
    }

    /** 还没划到的地方点一条虚线，目标处一圈会呼吸的光环：告诉孩子"往这儿划"，但不抢戏 */
    private redrawGuide(): void {
      const line = this.guideLine;
      if (!line) return;
      line.clear();
      if (this.busy || this.finished) {
        this.clearGuide();
        return;
      }

      const segment = cfg.level.segments[this.cursor.segment];
      if (!segment) return;
      const target = currentTarget(cfg.level, this.cursor);
      if (!target) return;

      line.lineStyle(7, THEME.card, 0.85);
      const from = this.path.length > 0 ? this.path[this.path.length - 1]! : segment.start;
      const steps = Math.max(2, Math.round(Math.hypot(target.x - from.x, target.y - from.y) / 34));
      for (let i = 0; i < steps; i += 1) {
        if (i % 2 === 1) continue;
        const a = i / steps;
        const b = (i + 1) / steps;
        line.lineBetween(
          from.x + (target.x - from.x) * a,
          from.y + (target.y - from.y) * a,
          from.x + (target.x - from.x) * b,
          from.y + (target.y - from.y) * b,
        );
      }

      const ring = this.ensureRing();
      ring.setPosition(target.x, target.y);
      ring.clear();
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, target.radius + TRACE.hintRing);
    }

    /** 呼吸的光环只建一次，之后只挪位置 —— 每帧重建会让它一直在闪 */
    private ensureRing(): Phaser.GameObjects.Graphics {
      if (this.guideRing) return this.guideRing;
      const ring = this.add.graphics().setDepth(31);
      this.guideRing = ring;
      this.guideTween = this.tweens.add({
        targets: ring,
        scale: 1.16,
        alpha: 0.4,
        duration: 560,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      return ring;
    }

    private clearGuide(): void {
      this.guideLine?.clear();
      this.guideTween?.stop();
      this.guideTween = null;
      this.guideRing?.destroy();
      this.guideRing = null;
    }

    // ---------------- 提示与无头验证 ----------------


    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    /** 无头验证：沿锚点插值出一条路径，逐点喂给同一条推进逻辑 */
    private runAutoplay(): void {
      const step = (index: number): void => {
        if (this.finished || index >= cfg.level.segments.length) return;
        const segment = cfg.level.segments[index]!;
        const stops: TracePoint[] = [
          segment.start,
          ...segment.anchors.map((a) => ({ x: a.x, y: a.y })),
          { x: segment.end.x, y: segment.end.y },
        ];
        const samples: TracePoint[] = [];
        for (let i = 1; i < stops.length; i += 1) {
          const from = stops[i - 1]!;
          const to = stops[i]!;
          const steps = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 80));
          for (let s = 1; s <= steps; s += 1) {
            samples.push({
              x: from.x + ((to.x - from.x) * s) / steps,
              y: from.y + ((to.y - from.y) * s) / steps,
            });
          }
        }
        let i = 0;
        this.time.addEvent({
          delay: 26,
          loop: true,
          callback: () => {
            if (this.finished) return;
            if (this.busy) return;
            if (i >= samples.length) {
              this.time.delayedCall(160, () => step(index + 1));
              return;
            }
            this.path.push(samples[i]!);
            this.advanceAutoplay(samples[i]!);
            i += 1;
          },
        });
      };
      this.time.delayedCall(240, () => step(0));
    }

    private advanceAutoplay(point: TracePoint): void {
      const before = this.cursor;
      const next = advanceTrace(cfg.level, before, point);
      this.lastPoint = point;
      if (next === before) {
        this.redrawStroke();
        return;
      }
      this.cursor = next;
      if (next.segment > before.segment) {
        this.finishSegment(before.segment);
        return;
      }
      this.redraw();
    }
    private idleMs = 0;
    private tick(delta: number): void {
      if (this.finished) return;
      // 水一直在流，所以舞台每帧都要重画
      this.redrawStage();
      if (this.busy || this.drawing) return;
      this.idleMs += delta;
      if (this.idleMs < TRACE.idleMs) return;
      this.idleMs = 0;
      this.showHint(cfg.level.hint);
      const target = currentTarget(cfg.level, this.cursor);
      if (!target || this.hand) return;
      this.hand = createHand(this, target.x, target.y + 80, 1.2);
      this.tweens.add({ targets: this.hand, x: target.x, duration: 700, yoyo: true, repeat: -1 });
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.trace });
      this.drawBackdrop(cfg.title ?? this.tr(cfg.titleKey));
      cfg.drawWorld?.(this);

      this.stageGfx = this.add.graphics().setDepth(2);
      this.strokeGfx = this.add.graphics().setDepth(3);
      this.guideLine = this.add.graphics().setDepth(30);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.beginStroke(pointer));
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.moveStroke(pointer));
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.endStroke(pointer));
      this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.endStroke(pointer));

      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.redraw();
      this.fadeIn();
      if (this.autoplay) this.runAutoplay();
    }
  };
}