import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt, tapRipple } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  PROBE_TIMING, canCross, cross, crossablePatches, figureAt, hasSnake, isFigureTried, isKnocked,
  knock, nextFigureToShoot, nextKnockStep, probeAt, probeStart, remainingFigures, shoot,
} from './probe.logic';
import type { ProbeState } from './probe.logic';
import type { ProbeFigure, ProbeLevel, ProbePatch } from './schemas';
import type { SessionState } from './session';

/**
 * 试探模板自己的布局与手感常量 —— 不挤进 layout.ts：
 * 新模板之间、与既有模板之间都不会互相踩。
 * 时间的那几个（knockMs / scareMs / autoplayStepMs…）来自 probe.logic，
 * 单测、画面与无头验证用的是同一份。
 */
export const PROBE = {
  ...PROBE_TIMING,
  /** 点的宽容度：草丛与身影都不小，手指粗也点得到 */
  tapForgive: 44,
  /** 点空时那圈涟漪亮多久（亮完就销毁，别一直画下去） */
  rippleMs: 700,
  /** "这里可以走过去"的金圈比草丛大多少 */
  ringPad: 22,
  /** 小手放在目标的下面多少 */
  handDrop: 34,
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface ProbeStageState {
  /** 这一局是哪一半：knock 敲草丛 / spot 试身影 */
  mode: 'knock' | 'spot';
  /** 这一局过了多久（墙钟，从开局算起）—— 收尾的走位与"退到一边"按它插值 */
  elapsedMs: number;
  /** knock：敲过的草丛 */
  knocked: string[];
  /** knock：被蛇搅乱的草丛（这些地方不能走了） */
  spooked: string[];
  /** knock：此刻能走过去的那几丛（金色的光圈按它画） */
  landable: string[];
  /** knock：走过去的那一处；还没走过去就是 null */
  crossed: string | null;
  /** knock：走过去的那一刻（没走过去就是 -1） */
  crossedAtMs: number;
  /** spot：试过、退到一边的那几个 */
  tried: string[];
  /** spot：找到的王；还没找到就是 null */
  king: string | null;
  /** spot：还站着、还没试过的候选有几个 */
  remaining: number;
  /** knock：刚敲的那一丛 / 什么时候敲的（草浪按它涨开） */
  lastKnock: ProbePatch | null;
  lastKnockAtMs: number;
  /** knock：刚窜出蛇的那一丛（红圈一直涨到 scareRadius） */
  lastSnake: ProbePatch | null;
  lastSnakeAtMs: number;
  /** spot：刚射中的那一个 / 什么时候射的（箭与光圈按它演） */
  lastShot: ProbeFigure | null;
  lastShotAtMs: number;
  /** spot：刚射中的是不是王（王是金的，退到一边的是灰的） */
  lastShotWasKing: boolean;
  /** 点空了 / 点在了不能走的地方：什么也没发生（零惩罚），画面自己给个小反馈 */
  lastMissAtMs: number;
  /** 空点了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 这一局成了 */
  done: boolean;
}

export interface ProbeConfig {
  level: ProbeLevel;
  session: SessionState;
  nextSceneKey: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：路、草丛、一排身影（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: ProbeLevel) => void;
  /** 每帧重画：草丛 / 身影此刻的样子（有没有蛇、谁退到了一边） */
  drawStage: (g: Phaser.GameObjects.Graphics, state: ProbeStageState, level: ProbeLevel) => void;
  /** 收尾：走过去 / 找到王之后的样子 */
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: ProbeStageState, level: ProbeLevel) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 试探：用一枝**没有杀伤**的试探，换来信息。
 *
 * 三条刻意的设计：
 * - **判定全在 probe.logic 里**：场景只负责"手指落在哪儿"与画面，
 *   敲哪一丛、能不能走、射中了谁，单测与画面用的是同一份判定，不会跑偏。
 * - **零惩罚**：点了没确认安全的地方、射错了人，都只是"没收获 / 少一个候选" ——
 *   不扣星、不结束、不锁操作。孩子可以放心地一处一处试过去。
 * - **提示给在点上**：小手从来只指"最外圈那一丛"（打草惊蛇要避免先动中间）与
 *   "下一个该试的身影"；点错了马上再指一次，绝不让孩子对着屏幕干瞪眼。
 */
export function createProbeScene(ctx: GameContext, cfg: ProbeConfig): Phaser.Types.Scenes.SceneType {
  return class ProbeScene extends BaseScene {
    private level: ProbeLevel = cfg.level;
    private state: ProbeState = probeStart();
    private startedAt = 0;
    private finished = false;
    private idleMs = 0;
    private misses = 0;
    private crossedAt = -1;
    private lastKnock: ProbePatch | null = null;
    private lastKnockAt = -1;
    private lastSnake: ProbePatch | null = null;
    private lastSnakeAt = -1;
    private lastShot: ProbeFigure | null = null;
    private lastShotAt = -1;
    private lastShotWasKing = false;
    private lastMissAt = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.probe, ctx);
    }

    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.probe });
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.markGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 3000, PROBE.hintY);
        this.time.delayedCall(PROBE.introHandMs, () => this.pointAtNext());
      }
    }

    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

    private tick(delta: number): void {
      this.redraw(this.now());
      if (this.finished) return;
      // 卡住了：把该动的地方再指一遍（不换说法，提示语就是关卡自己那一句）
      this.idleMs += delta;
      if (this.idleMs >= PROBE.idleMs) {
        this.idleMs = 0;
        this.showHint(this.level.hint, 2600, PROBE.hintY);
        this.pointAtNext();
      }
    }

    private redraw(elapsed: number): void {
      const stage = this.stageState(elapsed);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(stage);
      if (this.finished && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(elapsed: number): ProbeStageState {
      const level = this.level;
      return {
        mode: level.mode,
        elapsedMs: elapsed,
        knocked: [...this.state.knocked],
        spooked: [...this.state.spooked],
        landable:
          level.mode === 'knock'
            ? crossablePatches(level, this.state).map((patch) => patch.id)
            : [],
        crossed: this.state.crossed,
        crossedAtMs: this.crossedAt,
        tried: [...this.state.tried],
        king: this.state.king,
        remaining: level.mode === 'spot' ? remainingFigures(level, this.state) : 0,
        lastKnock: this.lastKnock,
        lastKnockAtMs: this.lastKnockAt,
        lastSnake: this.lastSnake,
        lastSnakeAtMs: this.lastSnakeAt,
        lastShot: this.lastShot,
        lastShotAtMs: this.lastShotAt,
        lastShotWasKing: this.lastShotWasKing,
        lastMissAtMs: this.lastMissAt,
        misses: this.misses,
        done: this.finished,
      };
    }

    /**
     * 模板自己画的那一点反馈：
     * 敲下去的草浪、蛇窜出来时涨到 scareRadius 的红圈、能走过去的那一圈金光、
     * 射中时的一圈光环 —— 都是"刚才那一下发生了什么"，不额外写字。
     */
    private drawMarks(stage: ProbeStageState): void {
      const g = this.markGfx;
      if (!g) return;
      g.clear();
      const level = this.level;

      if (level.mode === 'knock') {
        const knocked = stage.lastKnock;
        const sinceKnock = stage.elapsedMs - stage.lastKnockAtMs;
        if (knocked !== null && sinceKnock >= 0 && sinceKnock <= PROBE.knockMs) {
          const p = sinceKnock / PROBE.knockMs;
          const snake = knocked.has === 'snake';
          g.lineStyle(8, snake ? THEME.red : THEME.gold, 0.85 * (1 - p));
          g.strokeCircle(knocked.x, knocked.y, knocked.radius + 10 + 90 * p);
        }

        // 打草惊蛇的那一下：红圈一直涨到 scareRadius —— "搅乱了多大一片"要看得见
        const snake = stage.lastSnake;
        const sinceSnake = stage.elapsedMs - stage.lastSnakeAtMs;
        if (snake !== null && sinceSnake >= 0 && sinceSnake <= PROBE.scareMs) {
          const p = sinceSnake / PROBE.scareMs;
          g.fillStyle(THEME.red, 0.12 * (1 - p));
          g.fillCircle(snake.x, snake.y, level.scareRadius * p);
          g.lineStyle(9, THEME.red, 0.75 * (1 - p));
          g.strokeCircle(snake.x, snake.y, level.scareRadius * p);
        }

        // 确认安全、能走过去的那一丛：一圈一直在呼吸的金光
        const breathe = 0.72 + 0.28 * Math.sin(stage.elapsedMs / 240);
        for (const patch of level.patches) {
          if (!stage.landable.includes(patch.id)) continue;
          g.lineStyle(9, THEME.gold, 0.9 * breathe);
          g.strokeCircle(patch.x, patch.y, patch.radius + PROBE.ringPad + 12 * breathe);
        }
      } else {
        const shot = stage.lastShot;
        const sinceShot = stage.elapsedMs - stage.lastShotAtMs;
        if (shot !== null && sinceShot >= 0) {
          // 箭飞过去的那一小段（箭本身由游戏画），落点先亮一下
          const impact = Math.max(0, sinceShot - PROBE.shotMs);
          if (impact <= PROBE.stepAsideMs) {
            const p = impact / PROBE.stepAsideMs;
            const color = stage.lastShotWasKing ? THEME.gold : THEME.inkSoft;
            g.lineStyle(9, color, 0.9 * (1 - p));
            g.strokeCircle(shot.x, shot.y, shot.radius + 18 + 46 * p);
            if (stage.lastShotWasKing) {
              g.lineStyle(5, THEME.gold, 0.5 * (1 - p));
              g.strokeCircle(shot.x, shot.y, shot.radius + 44 + 60 * p);
            }
          }
        }
      }
    }

    // ---------------- 点 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished) return;
      this.idleMs = 0;
      const level = this.level;
      if (level.mode === 'knock') this.pressKnock(pointer.x, pointer.y);
      else this.pressSpot(pointer.x, pointer.y);
    }

    /** 敲草丛：能走的就走过去，没敲过的就敲一下，其余什么也不发生 */
    private pressKnock(x: number, y: number): void {
      const level = this.level;
      if (this.finished || level.mode !== 'knock') return;
      const patch = probeAt(level, x, y, PROBE.tapForgive);
      if (patch === undefined) {
        this.nothing(x, y);
        return;
      }
      if (canCross(level, this.state, patch.id)) {
        this.crossPatch(patch);
        return;
      }
      if (!isKnocked(this.state, patch.id)) {
        this.knockPatch(patch);
        return;
      }
      // 敲过了却走不过去（有蛇 / 被搅乱）：点了也不会更糟
      this.nothing(x, y);
    }

    /** 一声闷响：草浪、蛇探头、附近的草一起塌下去 */
    private knockPatch(patch: ProbePatch): void {
      const level = this.level;
      if (this.finished || level.mode !== 'knock') return;
      const before = this.state;
      this.state = knock(level, this.state, patch.id);
      if (this.state === before) return; // 敲过的：不重复表演
      const t = this.now();
      this.lastKnock = patch;
      this.lastKnockAt = t;
      const snake = hasSnake(level, patch.id);
      if (snake) {
        this.lastSnake = patch;
        this.lastSnakeAt = t;
      }
      this.idleMs = 0;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'probe:knock:' + patch.id });
      if (snake) {
        // 打草惊蛇：蛇窜出来，附近的草一起被搅乱 —— 代价是"那里不能走了"，不扣星。
        // 声音用一声低音，而不是"答错了"的那个音：蛇窜出来是**试出来的信息**，不是错。
        this.ctx.services.audio.tone(196, 260);
        this.cameras.main.shake(180, 0.006);
        this.ripple(patch.x, patch.y, 64, THEME.red);
        this.ctx.emit('beat:enter', { beatId: 'probe:snake:' + patch.id });
      } else {
        this.sfx('tap');
        sparkleAt(this, patch.x, patch.y, THEME.gold, 4);
      }
      if (canCross(level, this.state, patch.id)) {
        // 这一处确认安全了：再点一下就过去（提示照旧是关卡自己那一句）
        this.ctx.emit('beat:enter', { beatId: 'probe:safe:' + patch.id });
        this.showHint(level.hint, 2200, PROBE.hintY);
      }
      this.time.delayedCall(PROBE.knockMs, () => this.pointAtNext());
    }

    /** 走过去：确认安全的那一丛才走得成 */
    private crossPatch(patch: ProbePatch): void {
      const level = this.level;
      if (this.finished || level.mode !== 'knock' || !canCross(level, this.state, patch.id)) return;
      this.state = cross(level, this.state, patch.id);
      this.crossedAt = this.now();
      this.clearRing();
      this.hideHand();
      this.sfx('correct');
      sparkleAt(this, patch.x, patch.y, THEME.gold, 6);
      this.ctx.emit('beat:enter', { beatId: 'probe:cross:' + patch.id });
      this.ctx.emit('choice:made', {
        beatId: 'probe:cross',
        choiceId: patch.id,
        correct: true,
        latencyMs: this.crossedAt,
      });
      this.finish();
    }

    /** 用蒿箭试一个身影：射中王就成了，射错只是少一个候选 */
    private pressSpot(x: number, y: number): void {
      const level = this.level;
      if (this.finished || level.mode !== 'spot') return;
      const figure = figureAt(level, x, y, PROBE.tapForgive);
      if (figure === undefined) {
        this.nothing(x, y);
        return;
      }
      if (isFigureTried(this.state, figure.id) || this.state.king !== null) {
        this.nothing(x, y);
        return;
      }
      this.shootFigure(figure);
    }

    private shootFigure(figure: ProbeFigure): void {
      const level = this.level;
      if (this.finished || level.mode !== 'spot') return;
      const before = this.state;
      this.state = shoot(level, this.state, figure.id);
      if (this.state === before) return; // 同一个身影射第二箭不重复记账
      const t = this.now();
      this.lastShot = figure;
      this.lastShotAt = t;
      this.lastShotWasKing = this.state.king !== null;
      this.idleMs = 0;
      this.hideHand();
      this.ctx.emit('beat:enter', { beatId: 'probe:shot:' + figure.id });
      if (this.state.king !== null) {
        // 反应最大的那一个 —— 就是他
        this.sfx('correct');
        sparkleAt(this, figure.x, figure.y, THEME.gold, 8);
        this.ctx.emit('beat:enter', { beatId: 'probe:king:' + figure.id });
        this.ctx.emit('choice:made', {
          beatId: 'probe:king',
          choiceId: figure.id,
          correct: true,
          latencyMs: t,
        });
        this.finish();
        return;
      }
      // 蒿箭没有杀伤：他只是退到一边（少一个候选）—— 不扣星、不结束、接着试
      this.sfx('tap');
      this.ctx.emit('beat:enter', {
        beatId: 'probe:tried:' + figure.id + ':' + this.state.tried.length,
      });
      this.showHint(level.hint, 2200, PROBE.hintY);
      this.time.delayedCall(PROBE.stepAsideMs, () => this.pointAtNext());
    }

    /** 点了没确认安全的地方 / 射了个空：只是没收获 —— 不扣星、不结束、不锁操作 */
    private nothing(x: number, y: number): void {
      if (this.finished) return;
      this.misses += 1;
      this.lastMissAt = this.now();
      this.idleMs = 0;
      this.sfx('tap');
      this.ripple(x, y, 44, THEME.inkSoft);
      this.showHint(this.level.hint, 2400, PROBE.hintY);
      this.ctx.emit('beat:enter', { beatId: 'probe:miss:' + this.misses });
      this.pointAtNext();
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.W / 2, this.H / 2, THEME.gold, 12);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'probe:done' });
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, PROBE.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? PROBE.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
    }

    // ---------------- 小手与提示 ----------------

    /** 把小手与光圈放到"该动的那一处"：最外圈还没敲的那一丛 / 下一个该试的身影 */
    private pointAtNext(): void {
      if (this.finished) return;
      const target = this.nextTarget();
      if (target === null) return;
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(target.x, target.y);
      ring.lineStyle(9, THEME.gold, 0.95);
      ring.strokeCircle(0, 0, target.radius + PROBE.ringPad);
      this.ring = ring;
      this.tweens.add({
        targets: ring,
        scale: 1.14,
        alpha: 0.4,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.hideHand();
      this.hand = createHand(this, target.x, target.y + target.radius + PROBE.handDrop, 1.1);
    }

    private nextTarget(): { x: number; y: number; radius: number } | null {
      const level = this.level;
      if (level.mode === 'knock') {
        const step = nextKnockStep(level, this.state);
        if (step === undefined) return null;
        return { x: step.patch.x, y: step.patch.y, radius: step.patch.radius };
      }
      const figure = nextFigureToShoot(level, this.state);
      return figure === undefined ? null : { x: figure.x, y: figure.y, radius: figure.radius };
    }

    private clearRing(): void {
      if (!this.ring) return;
      this.tweens.killTweensOf(this.ring);
      this.ring.destroy();
      this.ring = null;
    }

    private hideHand(): void {
      if (!this.hand) return;
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }

    private ripple(x: number, y: number, radius: number, color: number): void {
      const g = tapRipple(this, x, y, radius, color);
      this.time.delayedCall(PROBE.rippleMs, () => g.destroy());
    }

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：隔一会儿走一步，走的是**与孩子完全同一条路** ——
     * 把手指按在该动的那一丛 / 那一个身影上（连点选判定都走一遍），
     * 敲到安全的那一处就走过去，射到王就收工。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: PROBE.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.finished) return;
      const level = this.level;
      if (level.mode === 'knock') {
        const step = nextKnockStep(level, this.state);
        if (step === undefined) return;
        this.pressKnock(step.patch.x, step.patch.y);
        return;
      }
      const figure = nextFigureToShoot(level, this.state);
      if (figure !== undefined) this.pressSpot(figure.x, figure.y);
    }
  };
}
