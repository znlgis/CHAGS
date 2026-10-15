import Phaser from 'phaser';
import type { GameContext } from '@chags/game-kit';
import { BaseScene, THEME, createHand, sparkleAt } from '@chags/phaser-kit';
import { SCENE_KEYS } from './layout';
import {
  TWOLINE_TIMING, decoyRatio, hitDecoy, hitReal, isTwolineDone, needsTopUp, nextLineToTap,
  realRatio, safeMsLeft, settleDecoy, tapDecoy, tapReal, tapsLeft, twolineStart,
} from './twoline.logic';
import type { TwolineState } from './twoline.logic';
import type { TwolineLevel } from './schemas';
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
  /** 被看穿了几次（零惩罚，只是记着） */
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
  nextSceneKey: string;
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
 *   它会红一下、说一句 —— 但这一局不会因为被看见而结束（零惩罚是这一系列的地基）。
 * - **两条线都要人**：只顾暗线会被反复看穿，只顾明线推不动 —— 手在两条线之间来回，
 *   才是"明修栈道、暗度陈仓"落到手上的样子。
 */
export function createTwolineScene(ctx: GameContext, cfg: TwolineConfig): Phaser.Types.Scenes.SceneType {
  return class TwolineScene extends BaseScene {
    private level: TwolineLevel = cfg.level;
    private state: TwolineState = twolineStart(cfg.level);
    private startedAt = 0;
    private finished = false;
    private idleMs = 0;
    private stageGfx: Phaser.GameObjects.Graphics | null = null;
    private finaleGfx: Phaser.GameObjects.Graphics | null = null;
    private ring: Phaser.GameObjects.Graphics | null = null;
    private hand: Phaser.GameObjects.Graphics | null = null;

    constructor() {
      super(SCENE_KEYS.twoline, ctx);
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

    private elapsed(): number {
      return Math.max(0, this.ctx.services.now() - this.startedAt);
    }

    // ---------------- 每一帧 ----------------

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

    /** 被看穿了：红一下、说一句 —— 但**这一局不结束**（零惩罚） */
    private onCaught(): void {
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
      this.sfx('complete');
      this.cameras.main.flash(320, 255, 250, 220);
      sparkleAt(this, this.level.real.x, this.level.real.y, THEME.gold, 10);
      cfg.session.total += 1;
      cfg.session.correct += 1;
      this.ctx.emit('beat:enter', { beatId: 'twoline:done' });
      this.redraw(this.elapsed());
      if (this.finaleGfx) {
        cfg.drawFinale?.(this.finaleGfx, this.stageState(this.elapsed()), this.level);
      }
      const reveal = cfg.reveal;
      if (reveal !== undefined) {
        this.time.delayedCall(1200, () => this.showHint(reveal, 3200, TWOLINE.hintY));
      }
      this.time.delayedCall(cfg.finaleHoldMs ?? TWOLINE.finaleHoldMs, () =>
        this.scene.start(cfg.nextSceneKey),
      );
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
  };
}
