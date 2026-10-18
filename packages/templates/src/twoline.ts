import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand } from '@chags/phaser-kit';
import { SCENE_KEYS, resolveEnding } from './layout';
import {
  TWOLINE_TIMING, decoyRatio, hitDecoy, hitReal, isTwolineDone, needsTopUp, nextLineToTap,
  realRatio, safeMsLeft, settleDecoy, tapDecoy, tapReal, tapsLeft, twolineStart,
} from './twoline.logic';
import type { TwolineState } from './twoline.logic';
import type { TwolineLevel } from './schemas';
import { recordAttempt } from './session';
import type { SessionState } from './session';

/**
 * 双线模板自己的常量 —— 不挤进 layout.ts。
 * 紧迫线与"被看穿"的间隔来自 twoline.logic（单测与画面共用同一份）。
 */
export const TWOLINE = {
  ...TWOLINE_TIMING,
  /** 点两条线的命中宽容度：手指粗也能点到（两条线隔着 300 多像素，不会串） */
  tapForgive: 70,
  /** 开局过一会儿就把"两条线分别管什么"指出来 */
  introHintMs: 1400,
  /** 多久没动静就把小手放到该点的那条线上 */
  idleMs: 9000,
  /** 无头验证：多久点一下（明线紧迫就先补明线，其余点暗线） */
  autoplayStepMs: 200,
  /** 被看穿之后红光闪多久 */
  exposedFlashMs: 1100,
  /** 打赢之后看一眼夜路再走 */
  finaleHoldMs: 4200,
  /** 提示气泡的高度 */
  hintY: 268,
} as const;

/** 交给游戏画的一切：左边明面上的栈道、右边夜里的小路、两边各一条进度 */
export interface TwolineStageState {
  /** 明线此刻的值（0..max）与比例 */
  decoy: number;
  decoyMax: number;
  decoyRatio: number;
  /** 明线掉到"该补了"的线下了没有 */
  decoyUrgent: boolean;
  /** 明线还剩多久跌破 minKeep（0 = 已经跌破、正红着） */
  safeMsLeft: number;
  /** 暗线推到多少、比例、还差几下 */
  real: number;
  realGoal: number;
  realRatio: number;
  tapsLeft: number;
  /** 被看穿了几次（记进 mistakes，只是记着） */
  exposed: number;
  /** 刚被看穿过去多久；没被抓过 = Infinity */
  sinceExposedMs: number;
  /** 一共点了多少下（两条线加起来） */
  taps: number;
  elapsedMs: number;
  /** 这一局打赢了 */
  done: boolean;
}

export interface TwolineApi {
  scene: Phaser.Scene;
  stage: TwolineStageState;
}

export interface TwolineConfig {
  level: TwolineLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：秦岭、栈道要修的那面崖、夜里那条小路（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: TwolineLevel) => void;
  /** 每帧重画：两条线的进度、脚印、红光 */
  drawStage: (g: Phaser.GameObjects.Graphics, state: TwolineStageState, level: TwolineLevel) => void;
  /** 补了一笔明线 */
  onTopUp?: (api: TwolineApi) => void;
  /** 推了一下暗线 */
  onPush?: (api: TwolineApi) => void;
  /** 被看穿了（明线补回 minKeep，**不结束**） */
  onExposed?: (api: TwolineApi) => void;
  drawFinale?: (g: Phaser.GameObjects.Graphics, state: TwolineStageState, level: TwolineLevel) => void;
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 双线：明面撑住、暗里推进，两条线抢同一根手指。
 *
 * 三条刻意的设计：
 * - **判定全在 twoline.logic 里**：场景只做两件事 —— 每帧把明线结账（settleDecoy），
 *   孩子点哪条线就推哪条线。单测与画面用的是同一份判定。
 * - **被看穿不是失败**：明线跌破 minKeep 只是被补回 minKeep、记一次，接着玩就是。
 *   它会红一下、说一句 —— 但这一局不会因为被看见而结束（记进 mistakes，不结束、不锁操作）。
 * - **两条线都要人**：只顾暗线会被反复看穿，只顾明线推不动 —— 手在两条线之间来回，
 *   才是"明修栈道、暗度陈仓"落到手上的样子。
 */
export function createTwolineScene(ctx: GameContext, cfg: TwolineConfig): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class TwolineScene extends BaseScene {
    private level: TwolineLevel = cfg.level;
    private state: TwolineState = twolineStart(cfg.level);
    private startedAt = 0;
    private finished = false;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.twoline, ctx);
    }


    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /** 明线结账：掉多少算多少；跌破 minKeep 就是被看穿（补回 minKeep、记一次，不结束） */
    private settle(): void {
      const before = this.state.exposed;
      this.state = settleDecoy(this.level, this.state, this.elapsed());
      if (this.state.exposed > before) this.onCaught();
    }

    private redraw(elapsed: number): void {
      const g = this.stageGfx;
      if (!g) return;
      g.clear();
      cfg.drawStage(g, this.stageState(elapsed), this.level);
    }

    private stageState(elapsed: number): TwolineStageState {
      return {
        decoy: Math.max(0, this.state.decoy),
        decoyMax: this.level.decoy.max,
        decoyRatio: decoyRatio(this.level, this.state, elapsed),
        decoyUrgent: needsTopUp(this.level, this.state, elapsed),
        safeMsLeft: safeMsLeft(this.level, this.state, elapsed),
        real: this.state.real,
        realGoal: this.level.real.goal,
        realRatio: realRatio(this.level, this.state),
        tapsLeft: tapsLeft(this.level, this.state),
        exposed: this.state.exposed,
        sinceExposedMs:
          this.state.lastExposedAtMs === null
            ? Number.POSITIVE_INFINITY
            : elapsed - this.state.lastExposedAtMs,
        taps: this.state.taps + this.state.decoyTaps,
        elapsedMs: elapsed,
        done: this.finished && isTwolineDone(this.level, this.state),
      };
    }

    // ---------------- 点两条线 ----------------

    private onPress(pointer: Phaser.Input.Pointer): void {
      if (this.finished) return;
      // 先结账：手指落下去之前，明线该掉多少是多少 —— 点下去不是"没看见"
      this.settle();
      if (hitDecoy(this.level, pointer.x, pointer.y, TWOLINE.tapForgive)) {
        this.topUpDecoy();
        return;
      }
      if (hitReal(this.level, pointer.x, pointer.y, TWOLINE.tapForgive)) this.pushReal();
    }

    /** 补一笔明线（真实操作与无头验证走的是同一条路） */
    private topUpDecoy(): void {
      if (this.finished) return;
      const elapsed = this.elapsed();
      this.state = tapDecoy(this.level, this.state, elapsed);
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('tap');
      this.ctx.services.audio.tone(320, 70);
      if (this.state.decoyTaps % 5 === 1) {
        this.ctx.emit('beat:enter', { beatId: 'twoline:topup:' + this.state.decoyTaps });
      }
      cfg.onTopUp?.({ scene: this, stage: this.stageState(elapsed) });
      this.redraw(elapsed);
    }

    /** 推一下暗线（真实操作与无头验证走的是同一条路） */
    private pushReal(): void {
      if (this.finished) return;
      const elapsed = this.elapsed();
      this.state = tapReal(this.level, this.state, elapsed);
      this.idleMs = 0;
      this.clearRing();
      this.hideHand();
      this.sfx('tap');
      this.ctx.services.audio.tone(300 + realRatio(this.level, this.state) * 260, 60);
      if (this.state.taps % 5 === 1) {
        this.ctx.emit('beat:enter', { beatId: 'twoline:push:' + this.state.taps });
      }
      cfg.onPush?.({ scene: this, stage: this.stageState(elapsed) });
      this.redraw(elapsed);
      if (isTwolineDone(this.level, this.state)) this.finish();
    }

    /** 被看穿了：红一下、说一句 —— 这一局不结束、不锁操作；这一下记进 mistakes */
    private onCaught(): void {
      recordAttempt(cfg.session, { ok: false });
      this.clearRing();
      this.hideHand();
      this.sfx('wrong');
      this.cameras.main.shake(160, 0.0022);
      this.ctx.emit('beat:enter', { beatId: 'twoline:exposed:' + this.state.exposed });
      this.showHint(cfg.level.hint, 2600, TWOLINE.hintY);
      cfg.onExposed?.({ scene: this, stage: this.stageState(this.elapsed()) });
    }

    // ---------------- 收尾 ----------------

    private finish(): void {
      if (this.finished) return;
      this.finished = true;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? TWOLINE.finaleHoldMs,
        sparkle: { x: this.level.real.x, y: this.level.real.y, color: THEME.gold, count: 10 },
        reveal: ending.reveal,
        revealY: TWOLINE.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'twoline:done' });
          this.redraw(this.elapsed());
          if (this.finaleGfx) {
            cfg.drawFinale?.(this.finaleGfx, this.stageState(this.elapsed()), this.level);
          }
        }
      });
    }

    // ---------------- 小手 ----------------

    /** 把小手放到此刻该点的那条线上：明线紧迫就先撑着，其余时间推暗线 */
    private pointAtNext(): void {
      if (this.finished) return;
      const line = nextLineToTap(this.level, this.state, this.elapsed());
      if (line === null) return;
      const at = line === 'decoy' ? this.level.decoy : this.level.real;
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(at.x, at.y);
      ring.lineStyle(9, line === 'decoy' ? THEME.gold : THEME.teal, 0.95);
      ring.strokeCircle(0, 0, at.radius + 24);
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
      this.hand = createHand(this, at.x, at.y + at.radius + 34, 1.1);
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

    // ---------------- 无头验证 ----------------

    /**
     * 交替点：明线掉到 minKeep 的 1.5 倍以下先补一笔，其余时间推暗线 ——
     * 与孩子该做的事一模一样，用的也是同一条 topUpDecoy() / pushReal() 路径。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: TWOLINE.autoplayStepMs,
        loop: true,
        callback: () => {
          if (this.finished) return;
          const line = nextLineToTap(this.level, this.state, this.elapsed());
          if (line === 'decoy') this.topUpDecoy();
          else if (line === 'real') this.pushReal();
        },
      });
    }
    private idleMs = 0;
    private tick(delta: number): void {
      const elapsed = this.elapsed();
      if (!this.finished) {
        this.settle();
        this.idleMs += delta;
        if (this.idleMs >= TWOLINE.idleMs) {
          this.idleMs = 0;
          this.showHint(cfg.level.hint, 2600, TWOLINE.hintY);
          this.pointAtNext();
        }
        if (isTwolineDone(this.level, this.state)) this.finish();
      }
      this.redraw(elapsed);
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.twoline });
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      const world = this.add.graphics().setDepth(1);
      cfg.drawWorld(world, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPress(pointer));
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 2600, TWOLINE.hintY);
        this.time.delayedCall(TWOLINE.introHintMs, () => this.pointAtNext());
      }
    }
  };
}

/* ---------------- twoline 扩展：plant（第 33 计 · 反间计） ---------------- */
//
// 老模式（stack）的场景**一行没动**：plant 另起一个具名工厂，由游戏包按 level.mode 分派。
// 新模式的判定与类型另起一段引入，免得碰到上面那些行。

import {
  PLANT_TIMING, hitRedirect, hitSpot, isLookingAway, isPlantDone, lookAwayLeftMs, plantProgress,
  plantRatio, plantStart, plantStep, redirectLook, visitorAt, visitorWalk,
} from './twoline.logic';
import type { TwolinePlantState } from './twoline.logic';
import type { TwolinePlantLevel } from './schemas';

/**
 * 反间计的手感常量 —— 时间的那几个（introHandMs / autoplayStepMs / caughtFlashMs…）
 * 来自 twoline.logic，单测、画面与无头验证用的是同一份。
 */
export const TWOLINE_PLANT = {
  ...PLANT_TIMING,
  /** 点的宽容度：案上与帐角都是巴掌大的地方，手指粗也点得到 */
  tapForgive: 64,
  /** 小手放在目标下面多少 */
  handDrop: 34,
  /** 提示光圈比目标大多少 */
  ringPad: 22,
  /** 点空处那圈涟漪亮多久（画在 mark 层上） */
  rippleMs: 700,
} as const;

/** 交给游戏画的一切（每帧一份新的） */
export interface TwolinePlantStageState {
  /** 这一局过了多久（墙钟，从开局算起） */
  elapsedMs: number;
  /** 他此刻在哪儿（来回踱步）与走到几成（0 = from，1 = to）—— 画面把他画在这儿 */
  visitorAt: { x: number; y: number };
  visitorWalk: number;
  /** 他此刻转过头去看别处没有（空档开着没有） */
  lookingAway: boolean;
  /** 这个空档还剩多久（0 = 他正看着）—— 画面上的那个钟按它画 */
  lookAwayLeftMs: number;
  /** 摆到几成了（0..1）—— 那圈进度环按它合拢 */
  plantRatio: number;
  /** 已经摆上去多少毫秒 / 一共要摆多少 */
  plantedMs: number;
  plantMs: number;
  /** 摆好了没有 */
  planted: boolean;
  /** 手指正按在案上（按住才往前走） */
  holding: boolean;
  /** 被他回过头撞见过几次 —— 复盘用，也记进 mistakes */
  caught: number;
  /** 刚被撞见的那一刻；-1 = 还没被撞见过 */
  lastCaughtAtMs: number;
  /** 弄出过几次动静 */
  redirects: number;
  /** 点空了几次：只是复盘用，不扣星也不结束 */
  misses: number;
  /** 刚点空的位置与时刻（画一圈涟漪"这里什么都没有"）；没点空过就是 null / -1 */
  lastMissAt: { x: number; y: number } | null;
  lastMissAtMs: number;
  /** 这一局成了 */
  done: boolean;
}

export interface TwolinePlantConfig {
  level: TwolinePlantLevel;
  session: SessionState;
  nextSceneKey?: string;
  /** 顶栏上的名字；不传就用内容自己的标题 */
  title?: string;
  /** 这个世界：帐里那张案、帐角的动静、地席、烛台（画一次） */
  drawWorld: (g: Phaser.GameObjects.Graphics, level: TwolinePlantLevel) => void;
  /** 每帧重画：他踱到哪儿了、转头了没有、案上摆到几成了 */
  drawStage: (
    g: Phaser.GameObjects.Graphics,
    state: TwolinePlantStageState,
    level: TwolinePlantLevel,
  ) => void;
  /** 收尾：东西摆好了、他正看着案上 —— 他自己会看到 */
  drawFinale?: (
    g: Phaser.GameObjects.Graphics,
    state: TwolinePlantStageState,
    level: TwolinePlantLevel,
  ) => void;
  /** 打赢之后念的那句话（关键抉择点的揭晓语） */
  reveal?: string;
  finaleHoldMs?: number;
}

/**
 * 反间计：让来访的人**自己看到**你想让他看到的东西。
 *
 * 三条刻意的设计：
 * - **判定全在 twoline.logic 里**：空档什么时候开、按住推进了多少、他回过头时谁被清零，
 *   单测与画面用的是同一份函数（连无头验证也走同一条 onPress → plantStep）。
 * - **零惩罚**：被他回过头撞见只是"这一回白摆了"（进度清零、记一笔 caught，也记进 mistakes），
 *   不结束、不锁操作；他正看着的时候按住、点空处，也什么都不发生。
 * - **提示给在点上**：小手只指"此刻该动的那一处" —— 他正看着就指帐角（先弄出动静），
 *   空档开着就指案上（按住摆），绝不让画面自己说话。
 */
export function createTwolinePlantScene(
  ctx: GameContext,
  cfg: TwolinePlantConfig,
): Phaser.Types.Scenes.SceneType {
  const ending = resolveEnding(ctx, cfg);
  return class TwolinePlantScene extends BaseScene {
    private level: TwolinePlantLevel = cfg.level;
    private state: TwolinePlantState = plantStart();
    private startedAt = 0;
    /** 手指按在案上没有：按住才往前走（真实操作与无头验证都是这个开关） */
    private holding = false;
    private done = false;
    private misses = 0;
    private lastMissAt: { x: number; y: number } | null = null;
    private lastMissAtMs = -1;
    private worldGfx: Phaser.GameObjects.Graphics | null = null;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private markGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.twoline, ctx);
    }


    private now(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------


    /**
     * 一帧的账：把墙钟喂给 plantStep（判定全在那边）。
     * 顺序是刻意的：**先算"空档开着"，再算"回过头的代价"** ——
     * 恰好卡在空档最后一帧摆满的那一下算摆好了（从宽，零惩罚）。
     */
    private step(t: number, delta: number): void {
      if (this.done) return;
      const previous = this.state;
      const tick = plantStep(this.level, previous, t, delta, this.holding);
      this.state = tick.state;

      if (tick.result === 'exposed') {
        this.onCaught();
        return;
      }
      if (!previous.planted && isPlantDone(this.level, this.state)) {
        this.finish(t);
        return;
      }
      // 空档刚关（上一帧还开着）、他也没撞见你：小手挪回"弄出点动静"的那一处
      const wasAway = lookAwayLeftMs(previous, Math.max(0, t - delta)) > 0;
      if (wasAway && !isLookingAway(this.state, t) && !this.autoplay) {
        this.idleMs = 0;
        this.pointAtNext();
      }
    }

    /** 被他回过头撞见了：进度清零（判定那边已经清了）、红光一下、说一句 —— 这一局不结束；这一下记进 mistakes */
    private onCaught(): void {
      recordAttempt(cfg.session, { ok: false });
      this.clearRing();
      this.hideHand();
      this.idleMs = 0;
      this.ctx.emit('beat:enter', { beatId: 'twoline:caught:' + this.state.caught });
      this.time.delayedCall(TWOLINE_PLANT.caughtFlashMs, () => {
        if (!this.done) this.pointAtNext();
      });
      if (this.autoplay) return;
      // 一声低音 + 轻微一晃：这是"被看见了"的分量，不是"答错了"
      this.sfx('wrong');
      this.ctx.services.audio.tone(196, 240);
      this.cameras.main.shake(180, 0.005);
      this.showHint(this.level.caughtLine, 2400, TWOLINE_PLANT.hintY);
    }

    private redraw(t: number): void {
      const stage = this.stageState(t);
      if (this.stageGfx) {
        this.stageGfx.clear();
        cfg.drawStage(this.stageGfx, stage, this.level);
      }
      this.drawMarks(stage);
      if (this.done && this.finaleGfx) {
        this.finaleGfx.clear();
        cfg.drawFinale?.(this.finaleGfx, stage, this.level);
      }
    }

    private stageState(t: number): TwolinePlantStageState {
      const at = visitorAt(this.level, t);
      return {
        elapsedMs: t,
        visitorAt: at,
        visitorWalk: visitorWalk(this.level, t),
        lookingAway: isLookingAway(this.state, t),
        lookAwayLeftMs: lookAwayLeftMs(this.state, t),
        plantRatio: plantRatio(this.level, this.state),
        plantedMs: plantProgress(this.state),
        plantMs: this.level.spot.plantMs,
        planted: isPlantDone(this.level, this.state),
        holding: this.holding,
        caught: this.state.caught,
        lastCaughtAtMs: this.state.lastCaughtAtMs,
        redirects: this.state.redirects,
        misses: this.misses,
        lastMissAt: this.lastMissAt,
        lastMissAtMs: this.lastMissAtMs,
        done: this.done,
      };
    }

    /**
     * 模板自己画的那一点反馈：案上那圈**跟着手合拢的进度环**、
     * 被撞见时案上红一下、刚摆好那一下的金光、点空处的涟漪 ——
     * 都是"刚才那一下发生了什么"，不额外写字。
     */
    private drawMarks(stage: TwolinePlantStageState): void {
      const g = this.markGfx;
      if (!g) return;
      const t = stage.elapsedMs;
      const { spot } = this.level;

      // 案上的进度环：空档开着（或者手已经按上去了）才画 —— 一眼看出"还差多少"
      if (!stage.done && (stage.lookingAway || stage.holding || stage.plantRatio > 0)) {
        const r = spot.radius;
        g.lineStyle(6, THEME.inkSoft, 0.28);
        g.strokeCircle(spot.x, spot.y, r);
        if (stage.plantRatio > 0) {
          g.lineStyle(11, stage.holding ? THEME.teal : THEME.gold, 0.92);
          g.beginPath();
          g.arc(spot.x, spot.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stage.plantRatio);
          g.strokePath();
        }
      }

      // 被撞见了：案上红一下（"这里被看见了"，不是惩罚）
      const sinceCaught = t - stage.lastCaughtAtMs;
      if (stage.lastCaughtAtMs >= 0 && sinceCaught >= 0 && sinceCaught <= TWOLINE_PLANT.caughtFlashMs) {
        const p = sinceCaught / TWOLINE_PLANT.caughtFlashMs;
        g.lineStyle(9, THEME.red, 0.9 * (1 - p));
        g.strokeCircle(spot.x, spot.y, spot.radius + 40 + 90 * p);
      }

      // 刚摆好：金光往外扩一圈（他下一眼就会看见它）
      if (stage.planted && !stage.done) {
        g.lineStyle(10, THEME.gold, 0.85);
        g.strokeCircle(spot.x, spot.y, spot.radius + 18);
      }

      // 点空处：一圈涟漪（"这里什么都没有"）
      const miss = stage.lastMissAt;
      const sinceMiss = t - stage.lastMissAtMs;
      if (miss !== null && sinceMiss >= 0 && sinceMiss <= TWOLINE_PLANT.rippleMs) {
        const p = sinceMiss / TWOLINE_PLANT.rippleMs;
        g.lineStyle(7, THEME.inkSoft, 0.5 * (1 - p));
        g.strokeCircle(miss.x, miss.y, 44 + 70 * p);
      }
    }

    // ---------------- 点 ----------------

    /** 手指落下去：落在案上就按住不放（按住才往前走），落在帐角就弄出点动静 */
    private onPress(x: number, y: number): void {
      if (this.done) return;
      this.idleMs = 0;
      if (hitSpot(this.level, x, y, TWOLINE_PLANT.tapForgive)) {
        this.holding = true;
        this.hideHand();
        this.sfx('tap');
        this.ctx.emit('beat:enter', { beatId: 'twoline:press' });
        // 他正看着的时候按下去：什么都不发生（零惩罚）—— 小手挪回"先弄出点动静"那一处
        if (!isLookingAway(this.state, this.now())) this.pointAtNext();
        return;
      }
      if (hitRedirect(this.level, x, y, TWOLINE_PLANT.tapForgive)) {
        this.distract();
        return;
      }
      this.nothing(x, y);
    }

    /** 手指抬起来：这一回就停在原地（进度留着，再按住接着摆）—— 零惩罚 */
    private onRelease(): void {
      this.holding = false;
      if (this.done) return;
      this.ctx.emit('beat:enter', { beatId: 'twoline:release' });
    }

    /** 弄出点动静：他转头看别处，空档从此刻起算（真实操作与无头验证走的是同一条路） */
    private distract(): void {
      if (this.done) return;
      const t = this.now();
      const before = this.state;
      this.state = redirectLook(this.level, this.state, t);
      if (this.state === before) {
        this.nothing(this.level.redirect.x, this.level.redirect.y);
        return;
      }
      this.idleMs = 0;
      this.sfx('tap');
      this.ctx.services.audio.tone(420, 70);
      this.ctx.emit('beat:enter', { beatId: 'twoline:redirect:' + this.state.redirects });
      this.hideHand();
      // 空档开了：小手立刻挪到案上（按住）
      this.pointAtNext();
    }

    /** 点了空处：只是没收获 —— 不扣星、不结束 */
    private nothing(x: number, y: number): void {
      if (this.done) return;
      this.misses += 1;
      this.idleMs = 0;
      this.lastMissAt = { x, y };
      this.lastMissAtMs = this.now();
      this.sfx('tap');
      this.ctx.emit('beat:enter', { beatId: 'twoline:miss:' + this.misses });
    }

    // ---------------- 收尾 ----------------

    /** 摆好了：他自己会看到 —— 这一局成了 */
    private finish(t: number): void {
      if (this.done || !isPlantDone(this.level, this.state)) return;
      this.done = true;
      this.holding = false;
      this.clearRing();
      this.hideHand();
      this.completeLevel({
        nextSceneKey: ending.nextSceneKey,
        holdMs: cfg.finaleHoldMs ?? TWOLINE_PLANT.finaleHoldMs,
        sparkle: { x: this.level.spot.x, y: this.level.spot.y, color: THEME.gold, count: 10 },
        reveal: ending.reveal,
        revealDelayMs: 1400,
        revealY: TWOLINE_PLANT.hintY,
        finalize: () => {
          recordAttempt(cfg.session, { ok: true });
          this.ctx.emit('beat:enter', { beatId: 'twoline:done' });
          this.ctx.emit('choice:made', {
            beatId: 'twoline:plant',
            choiceId: 'plant',
            correct: true,
            latencyMs: t,
          });
          this.redraw(t);
          this.showHint(this.level.plantedLine, 3200, TWOLINE_PLANT.hintY);
        }
      });
    }

    // ---------------- 小手 ----------------

    /** 把小手放到此刻该动的那一处：他正看着指帐角，空档开着指案上（按住） */
    private pointAtNext(): void {
      if (this.done) return;
      const away = isLookingAway(this.state, this.now());
      const at = away
        ? { x: this.level.spot.x, y: this.level.spot.y, radius: this.level.spot.radius }
        : { x: this.level.redirect.x, y: this.level.redirect.y, radius: this.level.redirect.radius };
      this.clearRing();
      const ring = this.add.graphics().setDepth(50);
      ring.setPosition(at.x, at.y);
      ring.lineStyle(9, away ? THEME.teal : THEME.gold, 0.95);
      ring.strokeCircle(0, 0, at.radius + TWOLINE_PLANT.ringPad);
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
      this.hand = createHand(this, at.x, at.y + at.radius + TWOLINE_PLANT.handDrop, 1.1);
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

    // ---------------- 无头验证 ----------------

    /**
     * 无头验证：走的还是**真实操作同一条路** ——
     * 他正看着就点帐角弄出动静，空档开着就把手指按在案上不放（走 onPress 的判定），
     * 由每一帧的 plantStep 把它摆完，摆好了进 reward。
     */
    private runAutoplay(): void {
      this.time.addEvent({
        delay: TWOLINE_PLANT.autoplayStepMs,
        loop: true,
        callback: () => this.autoStep(),
      });
    }

    private autoStep(): void {
      if (this.done) return;
      const t = this.now();
      if (isLookingAway(this.state, t)) {
        // 空档开着：按到案上不放（让帧去推，别重复按 —— 真实的孩子也是按着不放）
        if (!this.holding) this.onPress(this.level.spot.x, this.level.spot.y);
        return;
      }
      // 他正看着：先弄出点动静（抬手，再点帐角）—— 空档从此刻重新开
      this.onRelease();
      this.onPress(this.level.redirect.x, this.level.redirect.y);
    }
    private idleMs = 0;
    private tick(delta: number): void {
      const t = this.now();
      this.step(t, delta);
      this.redraw(t);
      if (this.done) return;
      // 卡住了：把关卡自己的那句话再亮一遍，并指一指此刻该动的那一处
      this.idleMs += delta;
      if (this.idleMs >= TWOLINE_PLANT.idleMs) {
        this.idleMs = 0;
        this.showHint(this.level.hint, 2600, TWOLINE_PLANT.hintY);
        this.pointAtNext();
      }
    }
    create(): void {
      this.ctx.emit('scene:enter', { scene: SCENE_KEYS.twoline });
      this.level = cfg.level;
      this.state = plantStart();
      this.startedAt = this.ctx.services.now();

      this.drawBackdrop(cfg.title ?? this.ctx.content.title);
      this.worldGfx = this.add.graphics().setDepth(1);
      cfg.drawWorld(this.worldGfx, this.level);
      this.stageGfx = this.add.graphics().setDepth(2);
      this.finaleGfx = this.add.graphics().setDepth(40);
      this.markGfx = this.add.graphics().setDepth(60);

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
        this.onPress(pointer.x, pointer.y),
      );
      this.input.on('pointerup', () => this.onRelease());
      // 手指滑出画面也算松手：进度不会因为一次意外一直攒着
      this.input.on('pointerupoutside', () => this.onRelease());
      this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) =>
        this.tick(delta),
      );

      this.fadeIn();
      if (this.autoplay) {
        this.runAutoplay();
      } else {
        this.showHint(cfg.level.hint, 3000, TWOLINE_PLANT.hintY);
        this.time.delayedCall(TWOLINE_PLANT.introHandMs, () => this.pointAtNext());
      }
    }
  };
}
